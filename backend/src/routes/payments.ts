import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Webhook } from 'fedapay';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { activateCreditPurchase, CREDIT_PACKS, PLAN_CREDITS, PLAN_CREDIT_CAP } from './credits';
import { syncQuoteFromFedapay } from '../lib/quoteSync';
import { syncStoreOrderFromFedapay } from '../lib/storeSync';

const router = Router();
const prisma = new PrismaClient();

const FEDAPAY_BASE = process.env.FEDAPAY_ENV === 'live'
  ? 'https://api.fedapay.com/v1'
  : 'https://sandbox-api.fedapay.com/v1';

const PLAN_LIMITS: Record<string, number> = { FREE: 5, PRO: 30, BUSINESS: 9999 };
const PLAN_PRICES: Record<string, number> = { PRO: 3500, BUSINESS: 9000 };
const ANNUAL_DISCOUNT = 0.15;

const webhookLimiter = rateLimit({
  keyPrefix: 'fedapay-webhook',
  windowMs: 60 * 1000,
  max: 60,
});

function getTx(data: any) {
  return data?.['v1/transaction'] ?? data?.v1?.transaction ?? data;
}

function getCustomerEmail(tx: any): string {
  return String(tx?.customer?.email ?? tx?.customer_email ?? '').toLowerCase();
}

function getTxAmount(tx: any): number {
  return Number(tx?.amount ?? tx?.amount_debited ?? tx?.amount_transferred ?? 0);
}

function expectedPlanPayment(plan: 'PRO' | 'BUSINESS', interval: 'monthly' | 'annual') {
  const monthlyPrice = PLAN_PRICES[plan];
  const months = interval === 'annual' ? 12 : 1;
  const amount = interval === 'annual'
    ? Math.round(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT))
    : monthlyPrice;
  return {
    months,
    amount,
    description: `Abonnement NexaPay ${plan} — ${months} mois`,
  };
}

async function getApprovedFedapayTransaction(transactionId: string | number) {
  const txData: any = await fedapayReq('GET', `/transactions/${transactionId}`);
  const tx = getTx(txData);
  if (tx?.status !== 'approved') {
    throw Object.assign(new Error(`Transaction non approuvée (statut: ${tx?.status || 'inconnu'})`), { status: 402 });
  }
  return tx;
}

async function createFedapayPaymentLink(transactionId: string | number): Promise<string> {
  const tokenData: any = await fedapayReq('POST', `/transactions/${transactionId}/token`);
  const paymentUrl = tokenData?.url ?? tokenData?.payment_url;
  if (!paymentUrl) {
    throw new Error('Lien de paiement FedaPay manquant');
  }
  return String(paymentUrl);
}

function assertTransactionMatches(
  tx: any,
  expected: { description: string; amount: number; email?: string },
) {
  const txDescription = String(tx?.description ?? '');
  const txAmount = getTxAmount(tx);
  const txEmail = getCustomerEmail(tx);

  if (txDescription !== expected.description || txAmount !== expected.amount) {
    throw Object.assign(new Error('Transaction FedaPay incohérente avec la demande'), { status: 400 });
  }
  if (expected.email && txEmail !== expected.email.toLowerCase()) {
    throw Object.assign(new Error('Transaction FedaPay liée à un autre compte'), { status: 403 });
  }
}

async function activatePlanUpgrade(
  userId: string,
  plan: 'PRO' | 'BUSINESS',
  interval: 'monthly' | 'annual',
  txRef: string,
) {
  const months = interval === 'annual' ? 12 : 1;
  const planExpiresAt = new Date();
  planExpiresAt.setMonth(planExpiresAt.getMonth() + months);

  const monthlyCredits = PLAN_CREDITS[plan] ?? 0;
  const creditCap = PLAN_CREDIT_CAP[plan] ?? monthlyCredits;

  const already = await prisma.creditTransaction.findFirst({
    where: {
      type: 'plan_renewal',
      OR: [
        { fedapayTxId: txRef },
        { description: { contains: `tx ${txRef}` } },
      ],
    } as any,
  });

  if (already) {
    if (already.userId !== userId) {
      throw Object.assign(new Error('Transaction FedaPay déjà utilisée par un autre compte'), { status: 403 });
    }

    const refreshed = await prisma.user.update({
      where: { id: userId },
      data: { plan, planExpiresAt, planInterval: interval },
    });
    await prisma.planPayment.updateMany({
      where: { fedapayTxId: txRef, userId },
      data: { status: 'APPROVED', confirmedAt: new Date() },
    });
    return { user: refreshed, alreadyCredited: true };
  }

  return prisma.$transaction(async (txClient) => {
    const user = await txClient.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    }

    const currentCredits = user.aiCredits ?? 0;
    const newCredits = Math.min(currentCredits + monthlyCredits, creditCap);
    const added = newCredits - currentCredits;

    const updatedUser = await txClient.user.update({
      where: { id: userId },
      data: {
        plan,
        planExpiresAt,
        planInterval: interval,
        aiCredits: newCredits,
        aiCreditsLastRenewedAt: new Date(),
      },
    });

    await txClient.creditTransaction.create({
      data: {
        userId,
        amount: added,
        type: 'plan_renewal',
        description: `Activation plan ${plan} (${months} mois) — tx ${txRef}`,
        balanceAfter: newCredits,
        fedapayTxId: txRef,
      } as any,
    });

    await txClient.planPayment.updateMany({
      where: { fedapayTxId: txRef, userId },
      data: { status: 'APPROVED', confirmedAt: new Date() },
    });

    return { user: updatedUser, alreadyCredited: false };
  });
}

function verifyFedapayWebhook(req: any) {
  const secret = process.env.FEDAPAY_WEBHOOK_SHARED_SECRET;
  if (!secret) return req.body;

  const signature = req.header('x-fedapay-signature');
  if (!signature) {
    throw Object.assign(new Error('Signature FedaPay manquante'), { status: 401 });
  }

  const payload = Buffer.isBuffer(req.rawBody)
    ? req.rawBody.toString('utf8')
    : JSON.stringify(req.body);

  return Webhook.constructEvent(payload, signature, secret);
}

async function fedapayReq(method: string, path: string, body?: object) {
  const apiKey = process.env.FEDAPAY_SECRET_KEY || '';
  const res = await fetch(`${FEDAPAY_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.message || JSON.stringify(data));
  return data;
}

// ──────────────────────────────────────────────────────────────
// PUBLIC — get quote info for the payment page (no auth)
// ──────────────────────────────────────────────────────────────
router.get('/quote/:quoteId', async (req, res): Promise<void> => {
  const quoteId = String(req.params.quoteId);
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      client: { select: { name: true, contact: true, city: true } },
      user: { select: { name: true, companyName: true } },
      items: { orderBy: { order: 'asc' } },
    },
  });
  if (!quote) { res.status(404).json({ message: 'Devis introuvable' }); return; }
  res.json(quote);
});

// ──────────────────────────────────────────────────────────────
// AUTHENTICATED — generate/refresh a Fedapay payment link
// ──────────────────────────────────────────────────────────────
router.post('/initiate/:quoteId', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const quoteId = String(req.params.quoteId);
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { plan: true, phone: true, phoneCountry: true },
  });
  if (user?.plan === 'FREE') {
    res.status(403).json({ message: 'Le lien de paiement MoMo / carte nécessite un plan Pro ou Business' });
    return;
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId: req.userId },
    include: {
      client: true,
      user: { select: { phone: true, phoneCountry: true } },
    },
  });
  if (!quote) { res.status(404).json({ message: 'Devis introuvable' }); return; }
  if (quote.status === 'PAID') { res.status(400).json({ message: 'Ce devis est déjà payé' }); return; }
  if (!process.env.FEDAPAY_SECRET_KEY) {
    res.status(503).json({ message: 'Paiement non configuré — ajoutez FEDAPAY_SECRET_KEY dans .env' });
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const contactParts = (quote.client?.contact || quote.client?.name || 'Client').split(' ');
  const clientCountry = quote.user?.phoneCountry || 'bj';

  try {
    const txData: any = await fedapayReq('POST', '/transactions', {
      description: `${quote.number} — ${quote.title}`,
      amount: Math.round(quote.total),
      currency: { iso: 'XOF' },
      callback_url: `${frontendUrl}/pay/success?quoteId=${quote.id}`,
      customer: {
        firstname: contactParts[0] || 'Client',
        lastname: contactParts.slice(1).join(' ') || '.',
        email: quote.client?.email || `client@nexapay.app`,
        phone_number: quote.client?.phone
          ? { number: quote.client.phone.replace(/\s/g, ''), country: clientCountry }
          : undefined,
      },
    });

    const tx = getTx(txData);
    const transId = tx?.id;
    if (!transId) throw new Error('Transaction ID manquant dans la réponse Fedapay');

    const paymentUrl = await createFedapayPaymentLink(transId);

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        paymentRef: String(transId),
        paymentUrl,
        status: 'SENT',
        sentAt: quote.sentAt ?? new Date(),
      },
    });

    res.json({
      paymentUrl,
      shareUrl: `${frontendUrl}/pay/${quote.id}`,
      transactionId: transId,
    });
  } catch (err: any) {
    console.error('[Fedapay] Erreur:', err.message);
    res.status(500).json({ message: `Erreur Fedapay : ${err.message}` });
  }
});

// ──────────────────────────────────────────────────────────────
// PUBLIC — confirm quote payment after Fedapay redirect
// (FedaPay sometimes redirects before the status is final, so we retry.)
// ──────────────────────────────────────────────────────────────
router.post('/confirm-quote/:quoteId', async (req, res): Promise<void> => {
  const quoteId = String(req.params.quoteId);

  try {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) { res.status(404).json({ message: 'Devis introuvable' }); return; }
    if (quote.status === 'PAID') { res.json({ alreadyPaid: true }); return; }
    if (!quote.paymentRef) { res.status(400).json({ message: 'Aucune transaction liée à ce devis' }); return; }

    let result = await syncQuoteFromFedapay(quoteId, { force: true });
    for (let attempt = 1; attempt < 4 && !result.changed && result.status === 'SENT'; attempt++) {
      console.log(`[ConfirmQuote] tentative ${attempt}/4 — Fedapay: "${result.fedapayStatus}"`);
      await new Promise(r => setTimeout(r, 2000));
      result = await syncQuoteFromFedapay(quoteId, { force: true });
    }

    if (!result.changed) {
      res.status(402).json({
        message: `Paiement non confirmé par FedaPay (statut: ${result.fedapayStatus || 'inconnu'})`,
      });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[ConfirmQuote] Erreur:', err.message);
    res.status(500).json({ message: `Erreur confirmation : ${err.message}` });
  }
});

// PUBLIC WEBHOOK — called by Fedapay on payment completion
// ──────────────────────────────────────────────────────────────
router.post('/webhook', webhookLimiter, async (req, res): Promise<void> => {
  try {
    const event = verifyFedapayWebhook(req) as any;
    const isApproved =
      event?.name === 'transaction.approved' ||
      event?.status === 'approved' ||
      event?.entity?.status === 'approved';

    if (isApproved) {
      const transId = event?.entity?.id ?? event?.id;

      if (transId) {
        let tx: any = null;
        try {
          tx = await getApprovedFedapayTransaction(transId);
        } catch (e: any) {
          console.warn('[Webhook] Transaction non vérifiée:', e.message);
          res.json({ received: true });
          return;
        }
        const txDescription = String(tx?.description ?? '');
        const txCustomerEmail = getCustomerEmail(tx);

        // Case 1: quote payment — delegate to shared sync helper.
        const quote = await prisma.quote.findFirst({
          where: { paymentRef: String(transId) },
          select: { id: true },
        });
        if (quote) {
          await syncQuoteFromFedapay(quote.id, { force: true }).catch((e) =>
            console.error('[Webhook] syncQuote échec:', e.message),
          );
        }

        // Case 1b: store order payment
        const storeOrder = await prisma.storeOrder.findFirst({
          where: { paymentRef: String(transId) },
          select: { id: true },
        });
        if (storeOrder) {
          await syncStoreOrderFromFedapay(storeOrder.id, { force: true }).catch((e) =>
            console.error('[Webhook] syncStoreOrder échec:', e.message),
          );
        }

        // Case 2: plan upgrade
        const planMatch = txDescription.match(/Abonnement NexaPay (PRO|BUSINESS) — (\d+) mois/);
        if (planMatch) {
          const plan = planMatch[1] as 'PRO' | 'BUSINESS';
          const months = parseInt(planMatch[2], 10) || 1;
          const interval = months >= 12 ? 'annual' : 'monthly';
          const expected = expectedPlanPayment(plan, interval);
          assertTransactionMatches(tx, { description: expected.description, amount: expected.amount });
          const txRef = String(transId);

          const planPayment = await prisma.planPayment.findUnique({
            where: { fedapayTxId: txRef },
            include: { user: true },
          });
          const targetUser = planPayment?.user ?? await prisma.user.findUnique({ where: { email: txCustomerEmail } });
          if (targetUser) {
            if (planPayment && (planPayment.plan !== plan || planPayment.interval !== interval || planPayment.amount !== expected.amount)) {
              console.warn(`[Webhook] PlanPayment incohérent pour tx ${txRef}`);
            } else {
              await activatePlanUpgrade(targetUser.id, plan, interval, txRef);
              console.log(`[Webhook] Plan ${plan} (${months} mois) activé pour ${targetUser.email} (tx ${txRef})`);
            }
          }
        }

        // Case 3: credit pack purchase
        const creditPackMatch = txDescription.match(/NexaPay Crédits IA — (\d+) crédits/);
        if (creditPackMatch) {
          const credits = parseInt(creditPackMatch[1], 10);
          const txRef = String(transId);
          const pack = CREDIT_PACKS.find(p => p.credits === credits);
          const creditPayment = await prisma.creditPayment.findUnique({
            where: { fedapayTxId: txRef },
            include: { user: true },
          });
          const targetUser = creditPayment?.user
            ?? (txCustomerEmail ? await prisma.user.findUnique({ where: { email: txCustomerEmail } }) : null);

          if (pack && targetUser) {
            const expectedDescription = `NexaPay Crédits IA — ${pack.label}`;
            if (String(tx?.description ?? '') !== expectedDescription || getTxAmount(tx) !== pack.price) {
              console.warn(`[Webhook] CreditPayment incohérent pour tx ${txRef}`);
            } else if (
              creditPayment &&
              (creditPayment.packId !== pack.id || creditPayment.credits !== pack.credits || creditPayment.amount !== pack.price)
            ) {
              console.warn(`[Webhook] CreditPayment local incohérent pour tx ${txRef}`);
            } else {
              await activateCreditPurchase(targetUser.id, pack, txRef);
              console.log(`[Webhook] ${credits} crédits IA ajoutés pour ${targetUser.email} (tx ${txRef})`);
            }
          }
        }
      }
    }
    res.json({ received: true });
  } catch (err: any) {
    console.error('[Webhook] Erreur:', err.message || err);
    if (err.status === 401) {
      res.status(401).json({ received: false });
      return;
    }
    res.status(200).json({ received: true }); // Always 200 to Fedapay after valid signature
  }
});

// ──────────────────────────────────────────────────────────────
// AUTHENTICATED — confirm upgrade after Fedapay redirect
// ──────────────────────────────────────────────────────────────
router.post('/confirm-upgrade', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const { transactionId, plan, interval = 'monthly' } = req.body as {
    transactionId: string | number;
    plan: 'PRO' | 'BUSINESS';
    interval?: 'monthly' | 'annual';
  };

  if (!transactionId || !['PRO', 'BUSINESS'].includes(plan)) {
    res.status(400).json({ message: 'Paramètres invalides' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

    const txRef = String(transactionId);
    const tx = await getApprovedFedapayTransaction(txRef);
    const expected = expectedPlanPayment(plan, interval);

    const planPayment = await prisma.planPayment.findUnique({ where: { fedapayTxId: txRef } });
    if (planPayment) {
      if (planPayment.userId !== user.id) {
        res.status(403).json({ message: 'Transaction FedaPay liée à un autre compte' });
        return;
      }
      if (planPayment.plan !== plan || planPayment.interval !== interval || planPayment.amount !== expected.amount) {
        res.status(400).json({ message: 'Transaction FedaPay incohérente avec la demande' });
        return;
      }
      assertTransactionMatches(tx, { description: expected.description, amount: expected.amount });
    } else {
      // Backward compatibility for transactions created before PlanPayment existed.
      assertTransactionMatches(tx, {
        description: expected.description,
        amount: expected.amount,
        email: user.email,
      });
    }

    const result = await activatePlanUpgrade(user.id, plan, interval, txRef);

    console.log(`[ConfirmUpgrade] Plan ${plan} activé pour ${user.email} (tx ${txRef})`);
    res.json({ success: true, user: result.user, alreadyCredited: result.alreadyCredited });
  } catch (err: any) {
    console.error('[ConfirmUpgrade] Erreur:', err.message);
    res.status(err.status || 500).json({ message: `Erreur confirmation : ${err.message}` });
  }
});

// ──────────────────────────────────────────────────────────────
// AUTHENTICATED — upgrade plan via FedaPay checkout
// ──────────────────────────────────────────────────────────────
router.post('/upgrade', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const { plan, interval = 'monthly' } = req.body as { plan: 'PRO' | 'BUSINESS'; interval?: 'monthly' | 'annual' };
  if (!['PRO', 'BUSINESS'].includes(plan)) { res.status(400).json({ message: 'Plan invalide' }); return; }
  if (!['monthly', 'annual'].includes(interval)) { res.status(400).json({ message: 'Intervalle invalide' }); return; }
  if (!process.env.FEDAPAY_SECRET_KEY) {
    res.status(503).json({ message: 'Paiement non configuré' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

  const { amount, months, description } = expectedPlanPayment(plan, interval);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const txData: any = await fedapayReq('POST', '/transactions', {
      description,
      amount,
      currency: { iso: 'XOF' },
      callback_url: `${frontendUrl}/pricing?upgraded=${plan}&interval=${interval}`,
      customer: {
        firstname: user.name.split(' ')[0],
        lastname: user.name.split(' ').slice(1).join(' ') || '.',
        email: user.email,
        phone_number: user.phone
          ? { number: user.phone.replace(/\s/g, ''), country: user.phoneCountry || 'bj' }
          : undefined,
      },
    });

    const tx2 = getTx(txData);
    const transId = tx2?.id;
    if (!transId) throw new Error('Transaction ID manquant dans la réponse Fedapay');
    await prisma.planPayment.upsert({
      where: { fedapayTxId: String(transId) },
      update: {
        userId: user.id,
        plan,
        interval,
        amount,
        status: 'PENDING',
        confirmedAt: null,
      },
      create: {
        userId: user.id,
        fedapayTxId: String(transId),
        plan,
        interval,
        amount,
      },
    });
    const paymentUrl = await createFedapayPaymentLink(transId);

    res.json({ paymentUrl, transactionId: transId, plan, interval, amount });
  } catch (err: any) {
    res.status(500).json({ message: `Erreur Fedapay : ${err.message}` });
  }
});

// ──────────────────────────────────────────────────────────────
// AUTHENTICATED — check plan quota
// ──────────────────────────────────────────────────────────────
router.get('/quota', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const quotesThisMonth = await prisma.quote.count({
    where: { userId: req.userId!, createdAt: { gte: startOfMonth } },
  });
  const plan = (user?.plan as string) || 'FREE';
  const limit = PLAN_LIMITS[plan] ?? 5;
  res.json({ plan, quotesThisMonth, limit, remaining: Math.max(0, limit - quotesThisMonth) });
});

// ──────────────────────────────────────────────────────────────
// AUTHENTICATED — payment history (reversements)
// ──────────────────────────────────────────────────────────────
router.get('/history', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const payments = await prisma.payment.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    include: {
      quote: { select: { number: true, title: true, total: true, paidAt: true } },
    },
  });
  res.json(payments);
});

// ──────────────────────────────────────────────────────────────
// AUTHENTICATED — retry a FAILED payout to the user's MoMo
// ──────────────────────────────────────────────────────────────
router.post('/:paymentId/retry', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const payment = await prisma.payment.findFirst({
    where: { id: String(req.params.paymentId), userId: req.userId },
    include: { user: { select: { phone: true, phoneCountry: true } }, quote: { select: { number: true } } },
  });
  if (!payment) { res.status(404).json({ message: 'Reversement introuvable' }); return; }
  if (payment.status === 'TRANSFERRED') {
    res.status(400).json({ message: 'Ce reversement a déjà été effectué' });
    return;
  }
  if (!payment.user?.phone) {
    res.status(400).json({ message: 'Aucun numéro MoMo configuré — renseignez-le dans Réglages' });
    return;
  }
  if (!process.env.FEDAPAY_SECRET_KEY) {
    res.status(503).json({ message: 'Paiement non configuré' });
    return;
  }

  try {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'TRANSFERRING', failReason: null },
    });

    const cleanPhone = payment.user.phone.replace(/\s/g, '');
    const payoutData: any = await fedapayReq('POST', '/payouts', {
      amount: payment.netAmount,
      description: `Reversement devis ${payment.quote?.number ?? ''} (retry)`,
      mode: 'mtn_open',
      currency: { iso: 'XOF' },
      customer: {
        firstname: 'NexaPay',
        lastname: 'Merchant',
        email: `payout-${cleanPhone.replace(/\D/g, '')}@nexapay.app`,
        phone_number: {
          number: cleanPhone,
          country: payment.user.phoneCountry || 'bj',
        },
      },
    });
    const payout = payoutData?.['v1/payout'] ?? payoutData?.v1?.payout ?? payoutData;
    const transferId = payout?.id;
    if (!transferId) throw new Error('Payout ID manquant');

    await fedapayReq('PUT', '/payouts/start', [{
      id: transferId,
      phone_number: {
        number: cleanPhone,
        country: payment.user.phoneCountry || 'bj',
      },
    }]);

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'TRANSFERRED',
        transferId: String(transferId),
        transferredAt: new Date(),
      },
    });
    console.log(`[RetryPayout] OK pour ${payment.user.phone} (${payment.netAmount} XOF)`);
    res.json(updated);
  } catch (err: any) {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failReason: err.message },
    });
    res.status(502).json({ message: `Échec du reversement : ${err.message}`, payment: updated });
  }
});

export { router as paymentsRouter };
