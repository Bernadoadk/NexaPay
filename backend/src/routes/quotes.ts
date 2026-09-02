import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { QuoteStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { generateQuoteNumber } from '../utils/quoteNumber';
import { syncQuoteFromFedapay } from '../lib/quoteSync';
import { logActivity } from '../lib/activityLog';
import { scanExpiringQuotes } from '../lib/notificationEvents';
import { sendQuoteEmail } from '../utils/email';
import { NotificationService } from '../lib/notificationService';

const router = Router();

const CLASSIC_TEMPLATE_IDS = new Set([
  'classique', 'marine', 'bordeaux', 'or', 'anthracite', 'prune', 'sable', 'encre',
]);

function canUseQuoteTemplate(plan: string | null | undefined, templateId: string) {
  return plan === 'BUSINESS' || CLASSIC_TEMPLATE_IDS.has(templateId);
}

router.use(authenticate);

// L'envoi accepte un PDF fourni par le client et part de notre SMTP : sans
// limite, un compte peut s'en servir comme relais d'expédition.
const sendEmailLimiter = rateLimit({
  keyPrefix: 'quote-send-email',
  windowMs: 60 * 60 * 1000,
  max: 30,
  key: (req) => (req as AuthRequest).userId || req.ip || 'unknown',
  message: 'Trop d’envois de devis cette heure-ci. Réessayez plus tard.',
});

function calcTotals(items: any[], taxRate: number, discount: number) {
  const subtotal = items.reduce((s: number, it: any) => s + it.quantity * it.unitPrice, 0);
  const discountAmt = subtotal * (discount / 100);
  const taxable = subtotal - discountAmt;
  const taxAmount = taxable * (taxRate / 100);
  return { subtotal, taxAmount, total: taxable + taxAmount };
}

/** Le client doit appartenir au compte : sans ça on rattache un devis au carnet d'adresses d'autrui. */
async function assertOwnsClient(userId: string, clientId: unknown): Promise<boolean> {
  const found = await prisma.client.findFirst({
    where: { id: String(clientId), userId },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * Ne conserve que les productId appartenant au compte. Un id étranger n'est pas
 * une erreur bloquante (la ligne reste valable avec sa description), on coupe
 * juste la référence.
 */
async function keepOwnedProductIds(userId: string, items: any[]): Promise<Set<string>> {
  const requested = items
    .map((it) => (it?.productId ? String(it.productId) : null))
    .filter((id): id is string => Boolean(id));
  if (requested.length === 0) return new Set();

  const owned = await prisma.product.findMany({
    where: { id: { in: requested }, userId },
    select: { id: true },
  });
  return new Set(owned.map((p) => p.id));
}

router.get('/', async (req: AuthRequest, res): Promise<void> => {
  const { status, clientId } = req.query;
  const quotes = await prisma.quote.findMany({
    where: {
      userId: req.userId,
      ...(status ? { status: status as QuoteStatus } : {}),
      ...(clientId ? { clientId: String(clientId) } : {}),
    },
    include: {
      client: { select: { id: true, name: true, color: true } },
      items: { orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Background sync: for any SENT quote with a Fedapay paymentRef, check status.
  // Throttled inside syncQuoteFromFedapay (5s/quote) so listing the same page
  // repeatedly is cheap. We don't await — the response goes out immediately and
  // the next poll/refetch will pick up any change.
  const pending = quotes.filter(q => q.status === 'SENT' && q.paymentRef);
  if (pending.length > 0) {
    Promise.allSettled(pending.map(q => syncQuoteFromFedapay(q.id))).catch(() => {});
  }

  // Alerte « devis bientôt expiré » — throttlée par utilisateur, sans cron.
  scanExpiringQuotes(req.userId!).catch(() => {});

  res.json(quotes);
});

router.post(
  '/',
  body('title').trim().notEmpty(),
  body('clientId').notEmpty(),
  body('items').isArray({ min: 1 }),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

      const PLAN_LIMITS: Record<string, number> = { FREE: 5, PRO: 30, BUSINESS: 9999 };
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      const plan = (user?.plan as string) || 'FREE';
      const limit = PLAN_LIMITS[plan] ?? 5;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const quotesThisMonth = await prisma.quote.count({
        where: { userId: req.userId!, createdAt: { gte: startOfMonth } },
      });
      if (quotesThisMonth >= limit) {
        res.status(403).json({ message: `Limite de ${limit} devis/mois atteinte pour le plan ${plan}`, code: 'PLAN_LIMIT_REACHED', plan, limit });
        return;
      }

      const { title, clientId, items, notes, taxRate = 18, discount = 0, issuedAt, validDays = 30 } = req.body;

      if (!(await assertOwnsClient(req.userId!, clientId))) {
        res.status(404).json({ message: 'Client introuvable' });
        return;
      }
      const ownedProductIds = await keepOwnedProductIds(req.userId!, items);

      const { subtotal, taxAmount, total } = calcTotals(items, taxRate, discount);

      let quote;
      for (let attempt = 0; attempt < 3; attempt++) {
        const number = await generateQuoteNumber(req.userId!);
        try {
          quote = await prisma.quote.create({
            data: {
              number, title, clientId, userId: req.userId!,
              notes, taxRate, discount, subtotal, taxAmount, total,
              validDays: Number(validDays) || 30,
              ...(issuedAt ? { issuedAt: new Date(issuedAt) } : {}),
              items: {
                create: items.map((it: any, i: number) => ({
                  description: it.description,
                  quantity: Number(it.quantity) || 1,
                  unitPrice: Number(it.unitPrice) || 0,
                  total: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
                  order: i,
                  ...(it.unit ? { unit: String(it.unit).trim() || null } : {}),
                  ...(it.productId && ownedProductIds.has(String(it.productId))
                    ? { productId: String(it.productId) }
                    : {}),
                })),
              },
            },
            include: { client: true, items: { orderBy: { order: 'asc' } } },
          });
          break;
        } catch (err: any) {
          if (err?.code === 'P2002' && attempt < 2) continue;
          throw err;
        }
      }
      if (quote) logActivity(req.userId!, 'quote_created', { quoteId: quote.id, total: quote.total }, req);
      res.status(201).json(quote);
    } catch (err: any) {
      console.error('[POST /quotes]', err?.message ?? err);
      res.status(500).json({ message: 'Erreur lors de la création du devis' });
    }
  }
);

router.get('/:id', async (req: AuthRequest, res): Promise<void> => {
  const quoteId = String(req.params.id);
  let quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId: req.userId },
    include: {
      client: true,
      items: { orderBy: { order: 'asc' } },
      user: { select: { name: true, companyName: true, phone: true, address: true, ifu: true, rccm: true, email: true, logoUrl: true, quoteLogoUrl: true, useProfilePhotoAsLogo: true } },
    },
  });
  if (!quote) { res.status(404).json({ message: 'Devis introuvable' }); return; }

  // Auto-sync if waiting for payment. Throttled internally — safe to await here
  // because the front-end relies on the fresh status to update the UI.
  if (quote.status === 'SENT' && quote.paymentRef) {
    const result = await syncQuoteFromFedapay(quote.id).catch(() => null);
    if (result?.changed) {
      quote = await prisma.quote.findFirst({
        where: { id: quoteId, userId: req.userId },
        include: {
          client: true,
          items: { orderBy: { order: 'asc' } },
          user: { select: { name: true, companyName: true, phone: true, address: true, ifu: true, rccm: true, email: true, logoUrl: true, quoteLogoUrl: true, useProfilePhotoAsLogo: true } },
        },
      });
    }
  }
  res.json(quote);
});

// Manual "check now" — bypasses the throttle, used by the "Vérifier" button.
router.post('/:id/check-payment', async (req: AuthRequest, res): Promise<void> => {
  const quoteId = String(req.params.id);
  const exists = await prisma.quote.findFirst({
    where: { id: quoteId, userId: req.userId },
    select: { id: true, status: true, paymentRef: true },
  });
  if (!exists) { res.status(404).json({ message: 'Devis introuvable' }); return; }
  if (exists.status === 'PAID') { res.json({ changed: false, status: 'PAID' }); return; }
  if (!exists.paymentRef) {
    res.status(400).json({ message: "Ce devis n'a pas de lien de paiement actif" });
    return;
  }

  try {
    const result = await syncQuoteFromFedapay(exists.id, { force: true });
    res.json(result);
  } catch (err: any) {
    console.error('[CheckPayment] Erreur:', err.message);
    res.status(500).json({ message: `Erreur de vérification : ${err.message}` });
  }
});

router.put('/:id', async (req: AuthRequest, res): Promise<void> => {
  const quoteId = String(req.params.id);
  const exists = await prisma.quote.findFirst({ where: { id: quoteId, userId: req.userId } });
  if (!exists) { res.status(404).json({ message: 'Devis introuvable' }); return; }

  const { items, title, clientId, notes, taxRate, discount, issuedAt, validDays } = req.body;

  if (clientId !== undefined && !(await assertOwnsClient(req.userId!, clientId))) {
    res.status(404).json({ message: 'Client introuvable' });
    return;
  }
  const ownedProductIds = items ? await keepOwnedProductIds(req.userId!, items) : new Set<string>();

  const effectiveTax = taxRate ?? exists.taxRate;
  const effectiveDiscount = discount ?? exists.discount;

  const totals = items ? calcTotals(items, effectiveTax, effectiveDiscount) : {};

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: {
      ...(title !== undefined && { title }),
      ...(clientId !== undefined && { clientId }),
      ...(notes !== undefined && { notes }),
      ...(taxRate !== undefined && { taxRate }),
      ...(discount !== undefined && { discount }),
      ...(issuedAt !== undefined && { issuedAt: new Date(issuedAt) }),
      ...(validDays !== undefined && { validDays: Number(validDays) || 30 }),
      ...totals,
      ...(items && {
        items: {
          deleteMany: {},
          create: items.map((it: any, i: number) => ({
            description: it.description,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            total: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
            order: i,
            ...(it.unit ? { unit: String(it.unit).trim() || null } : {}),
            ...(it.productId && ownedProductIds.has(String(it.productId))
              ? { productId: String(it.productId) }
              : {}),
          })),
        },
      }),
    },
    include: { client: true, items: { orderBy: { order: 'asc' } } },
  });
  res.json(updated);
});

router.patch('/:id/status', async (req: AuthRequest, res): Promise<void> => {
  const quoteId = String(req.params.id);
  const exists = await prisma.quote.findFirst({ where: { id: quoteId, userId: req.userId } });
  if (!exists) { res.status(404).json({ message: 'Devis introuvable' }); return; }

  const { status } = req.body;
  if (!Object.values(QuoteStatus).includes(status)) {
    res.status(400).json({ message: 'Statut invalide' });
    return;
  }

  const extra: Record<string, Date> = {};
  if (status === 'SENT') extra.sentAt = new Date();
  if (status === 'PAID') extra.paidAt = new Date();

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: { status, ...extra },
    include: { client: true, items: { orderBy: { order: 'asc' } } },
  });
  res.json(updated);
});

router.post('/:id/send-email', sendEmailLimiter, async (req: AuthRequest, res): Promise<void> => {
  const quoteId = String(req.params.id);
  const { pdfBase64, templateId, templateName } = req.body ?? {};

  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    res.status(400).json({ message: 'PDF manquant pour l’envoi du devis' });
    return;
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId: req.userId },
    include: {
      client: true,
      items: { orderBy: { order: 'asc' } },
      user: { select: { name: true, companyName: true, email: true, plan: true } },
    },
  });
  if (!quote) { res.status(404).json({ message: 'Devis introuvable' }); return; }
  if (!quote.client?.email) {
    res.status(400).json({ message: 'Ce client n’a pas d’adresse e-mail' });
    return;
  }
  if (!canUseQuoteTemplate(quote.user.plan, String(templateId || 'classique'))) {
    res.status(403).json({ message: 'Ce modèle de devis nécessite le plan Business' });
    return;
  }

  const cleanBase64 = pdfBase64.includes(',')
    ? pdfBase64.split(',').pop()!
    : pdfBase64;
  const pdfBuffer = Buffer.from(cleanBase64, 'base64');
  if (!pdfBuffer.length) {
    res.status(400).json({ message: 'PDF invalide pour l’envoi du devis' });
    return;
  }

  try {
    await sendQuoteEmail({
      to: quote.client.email,
      clientName: quote.client.contact || quote.client.name,
      quoteNumber: quote.number,
      quoteTitle: quote.title,
      total: quote.total,
      companyName: quote.user.companyName || quote.user.name || 'NexaPay',
      templateName: templateName || templateId,
      paymentUrl: quote.paymentUrl
        ? `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/pay/${quote.id}`
        : undefined,
      pdfBuffer,
    });

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'SENT', sentAt: new Date() },
      include: { client: true, items: { orderBy: { order: 'asc' } } },
    });

    await NotificationService.createNotification(
      quote.userId,
      'quote_sent',
      'Devis envoyé',
      `Votre devis ${quote.number} a été envoyé à ${quote.client.name}`,
      { quoteId: quote.id }
    );

    res.json(updated);
  } catch (err: any) {
    console.error('[QuoteEmail] Envoi échoué:', err?.message ?? err);
    res.status(502).json({ message: `Envoi e-mail échoué : ${err?.message ?? 'SMTP indisponible'}` });
  }
});

router.post('/:id/duplicate', async (req: AuthRequest, res): Promise<void> => {
  const quoteId = String(req.params.id);
  const original = await prisma.quote.findFirst({
    where: { id: quoteId, userId: req.userId },
    include: { items: { orderBy: { order: 'asc' } } },
  });
  if (!original) { res.status(404).json({ message: 'Devis introuvable' }); return; }

  const number = await generateQuoteNumber(req.userId!);
  const copy = await prisma.quote.create({
    data: {
      number,
      title: `${original.title} (copie)`,
      clientId: original.clientId,
      userId: req.userId!,
      status: 'DRAFT',
      notes: original.notes ?? undefined,
      taxRate: original.taxRate,
      discount: original.discount,
      subtotal: original.subtotal,
      taxAmount: original.taxAmount,
      total: original.total,
      issuedAt: new Date(),
      validDays: original.validDays,
      items: {
        create: original.items.map((it, i) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
          order: i,
          ...(it.unit ? { unit: it.unit } : {}),
          ...(it.productId ? { productId: it.productId } : {}),
        })),
      },
    },
    include: { client: true, items: { orderBy: { order: 'asc' } } },
  });
  res.status(201).json(copy);
});

router.delete('/:id', async (req: AuthRequest, res): Promise<void> => {
  const quoteId = String(req.params.id);
  const exists = await prisma.quote.findFirst({ where: { id: quoteId, userId: req.userId } });
  if (!exists) { res.status(404).json({ message: 'Devis introuvable' }); return; }
  await prisma.quote.delete({ where: { id: quoteId } });
  res.status(204).send();
});

export { router as quotesRouter };
