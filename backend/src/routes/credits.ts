import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const FEDAPAY_BASE = process.env.FEDAPAY_ENV === 'live'
  ? 'https://api.fedapay.com/v1'
  : 'https://sandbox-api.fedapay.com/v1';

// Monthly credit quota per plan
export const PLAN_CREDITS: Record<string, number> = { FREE: 0, PRO: 80, BUSINESS: 200 };
// Credit cap = 2× monthly quota
export const PLAN_CREDIT_CAP: Record<string, number> = { FREE: 10, PRO: 160, BUSINESS: 400 };

// Credit packs available for purchase
export const CREDIT_PACKS = [
  { id: 'pack_10', credits: 10, price: 1500, label: '10 crédits' },
  { id: 'pack_30', credits: 30, price: 3500, label: '30 crédits' },
  { id: 'pack_100', credits: 100, price: 9000, label: '100 crédits' },
];

async function fedapayReq(method: string, path: string, body?: object) {
  const apiKey = process.env.FEDAPAY_SECRET_KEY || '';
  const res = await fetch(`${FEDAPAY_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.message || JSON.stringify(data));
  return data;
}

// Renew credits if 30+ days since last renewal (for paid plans)
export async function maybeRenewCredits(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, aiCredits: true, aiCreditsLastRenewedAt: true },
  });
  if (!user || user.plan === 'FREE') return;

  const now = new Date();
  const lastRenewed = user.aiCreditsLastRenewedAt;
  const daysSinceRenewal = lastRenewed
    ? (now.getTime() - lastRenewed.getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  if (daysSinceRenewal < 30) return;

  const monthlyQuota = PLAN_CREDITS[user.plan] ?? 0;
  const cap = PLAN_CREDIT_CAP[user.plan] ?? monthlyQuota;
  const newBalance = Math.min(user.aiCredits + monthlyQuota, cap);
  const added = newBalance - user.aiCredits;

  if (added <= 0) return;

  await prisma.user.update({
    where: { id: userId },
    data: { aiCredits: newBalance, aiCreditsLastRenewedAt: now },
  });

  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: added,
      type: 'plan_renewal',
      description: `Renouvellement mensuel ${user.plan}`,
      balanceAfter: newBalance,
    },
  });
}

// ──────────────────────────────────────────────────────────────
// GET /api/credits/balance
// ──────────────────────────────────────────────────────────────
router.get('/balance', authenticate, async (req: AuthRequest, res): Promise<void> => {
  await maybeRenewCredits(req.userId!);
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { aiCredits: true, plan: true, planInterval: true },
  });
  if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

  const monthlyQuota = PLAN_CREDITS[user.plan] ?? 0;
  const cap = PLAN_CREDIT_CAP[user.plan] ?? 10;

  res.json({
    aiCredits: user.aiCredits,
    plan: user.plan,
    planInterval: user.planInterval,
    monthlyQuota,
    cap,
    packs: CREDIT_PACKS,
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/credits/history
// ──────────────────────────────────────────────────────────────
router.get('/history', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const transactions = await prisma.creditTransaction.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(transactions);
});

// ──────────────────────────────────────────────────────────────
// POST /api/credits/confirm-purchase — confirm a Fedapay credit-pack
// purchase after redirect. Idempotent: if the webhook already
// credited the user, this endpoint just returns the current balance.
// ──────────────────────────────────────────────────────────────
router.post('/confirm-purchase', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const { transactionId, packId } = req.body as { transactionId: string | number; packId: string };
  const pack = CREDIT_PACKS.find(p => p.id === packId);
  if (!transactionId || !pack) {
    res.status(400).json({ message: 'Paramètres invalides' });
    return;
  }

  try {
    const txRef = String(transactionId);

    // Idempotency: if a transaction with this Fedapay ID was already credited, return current balance.
    const existing = await prisma.creditTransaction.findFirst({
      where: { userId: req.userId!, type: 'purchase', description: { contains: `tx ${txRef}` } },
    });
    if (existing) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { aiCredits: true },
      });
      res.json({ alreadyCredited: true, aiCredits: user?.aiCredits ?? 0, added: 0 });
      return;
    }

    const txData: any = await fedapayReq('GET', `/transactions/${txRef}`);
    const tx = txData?.['v1/transaction'] ?? txData?.v1?.transaction ?? txData;
    const status: string = tx?.status ?? '';
    if (status !== 'approved') {
      res.status(402).json({ message: `Paiement non confirmé (statut: ${status})` });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.userId! },
      data: { aiCredits: { increment: pack.credits } },
      select: { aiCredits: true },
    });

    await prisma.creditTransaction.create({
      data: {
        userId: req.userId!,
        amount: pack.credits,
        type: 'purchase',
        description: `Achat pack ${pack.label} — tx ${txRef}`,
        balanceAfter: updated.aiCredits,
      },
    });

    console.log(`[ConfirmPurchase] +${pack.credits} crédits pour user ${req.userId} (tx ${txRef})`);
    res.json({ success: true, aiCredits: updated.aiCredits, added: pack.credits });
  } catch (err: any) {
    console.error('[ConfirmPurchase] Erreur:', err.message);
    res.status(500).json({ message: `Erreur confirmation : ${err.message}` });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/credits/purchase — initiate Fedapay payment for a credit pack
// ──────────────────────────────────────────────────────────────
router.post('/purchase', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const { packId } = req.body as { packId: string };
  const pack = CREDIT_PACKS.find(p => p.id === packId);
  if (!pack) { res.status(400).json({ message: 'Pack de crédits invalide' }); return; }
  if (!process.env.FEDAPAY_SECRET_KEY) {
    res.status(503).json({ message: 'Paiement non configuré' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const txData: any = await fedapayReq('POST', '/transactions', {
      description: `NexaPay Crédits IA — ${pack.label}`,
      amount: pack.price,
      currency: { iso: 'XOF' },
      callback_url: `${frontendUrl}/pricing?credits_purchased=${pack.credits}&pack=${pack.id}`,
      customer: {
        firstname: user.name.split(' ')[0],
        lastname: user.name.split(' ').slice(1).join(' ') || '.',
        email: user.email,
        phone_number: user.phone
          ? { number: user.phone.replace(/\s/g, ''), country: user.phoneCountry || 'bj' }
          : undefined,
      },
    });

    const tx = txData?.['v1/transaction'] ?? txData?.v1?.transaction ?? txData;
    const transId = tx?.id;
    const checkoutBase = process.env.FEDAPAY_ENV === 'live'
      ? 'https://checkout.fedapay.com/v1/checkout'
      : 'https://sandbox-checkout.fedapay.com/v1/checkout';
    const paymentUrl: string = tx?.payment_url
      || (tx?.token ? `${checkoutBase}?token=${tx.token}` : '');

    res.json({ paymentUrl, transactionId: transId, pack });
  } catch (err: any) {
    res.status(500).json({ message: `Erreur Fedapay : ${err.message}` });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/credits/use — internal: deduct credits for an AI action
// Returns updated balance or 402 if insufficient
// ──────────────────────────────────────────────────────────────
router.post('/use', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const { action = 'action IA', amount = 1 } = req.body as { action?: string; amount?: number };
  const cost = Math.max(1, Math.floor(amount));

  await maybeRenewCredits(req.userId!);

  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { aiCredits: true },
  });
  if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

  if (user.aiCredits < cost) {
    res.status(402).json({
      message: 'Crédits IA insuffisants',
      aiCredits: user.aiCredits,
      required: cost,
    });
    return;
  }

  const newBalance = user.aiCredits - cost;
  await prisma.user.update({ where: { id: req.userId! }, data: { aiCredits: newBalance } });
  await prisma.creditTransaction.create({
    data: {
      userId: req.userId!,
      amount: -cost,
      type: 'ai_use',
      description: action,
      balanceAfter: newBalance,
    },
  });

  res.json({ aiCredits: newBalance, used: cost });
});

export { router as creditsRouter };
