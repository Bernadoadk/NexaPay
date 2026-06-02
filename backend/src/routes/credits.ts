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

type CreditPack = typeof CREDIT_PACKS[number];

function getTx(data: any) {
  return data?.['v1/transaction'] ?? data?.v1?.transaction ?? data;
}

function getCustomerEmail(tx: any): string {
  return String(tx?.customer?.email ?? tx?.customer_email ?? '').toLowerCase();
}

function getTxAmount(tx: any): number {
  return Number(tx?.amount ?? tx?.amount_debited ?? tx?.amount_transferred ?? 0);
}

async function getApprovedFedapayTransaction(transactionId: string | number) {
  const txData: any = await fedapayReq('GET', `/transactions/${transactionId}`);
  const tx = getTx(txData);
  if (tx?.status !== 'approved') {
    throw Object.assign(new Error(`Paiement non confirmé (statut: ${tx?.status || 'inconnu'})`), { status: 402 });
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

function assertCreditTransactionMatches(tx: any, pack: CreditPack, expectedEmail?: string) {
  const expectedDescription = `NexaPay Crédits IA — ${pack.label}`;
  const matchesPayment =
    String(tx?.description ?? '') === expectedDescription &&
    getTxAmount(tx) === pack.price;

  if (!matchesPayment) {
    throw Object.assign(new Error('Transaction FedaPay incohérente avec la demande'), { status: 400 });
  }

  if (expectedEmail && getCustomerEmail(tx) !== expectedEmail.toLowerCase()) {
    throw Object.assign(new Error('Transaction FedaPay liée à un autre compte'), { status: 403 });
  }
}

export async function activateCreditPurchase(userId: string, pack: CreditPack, txRef: string) {
  const existing = await prisma.creditTransaction.findFirst({
    where: {
      type: 'purchase',
      OR: [
        { fedapayTxId: txRef },
        { description: { contains: `tx ${txRef}` } },
      ],
    } as any,
  });

  if (existing) {
    if (existing.userId !== userId) {
      throw Object.assign(new Error('Transaction FedaPay déjà utilisée par un autre compte'), { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiCredits: true },
    });
    await prisma.creditPayment.updateMany({
      where: { fedapayTxId: txRef, userId },
      data: { status: 'APPROVED', confirmedAt: new Date() },
    });
    return { aiCredits: user?.aiCredits ?? 0, added: 0, alreadyCredited: true };
  }

  const updated = await prisma.$transaction(async (txClient) => {
    const updatedUser = await txClient.user.update({
      where: { id: userId },
      data: { aiCredits: { increment: pack.credits } },
      select: { aiCredits: true },
    });

    await txClient.creditTransaction.create({
      data: {
        userId,
        amount: pack.credits,
        type: 'purchase',
        description: `Achat pack ${pack.label} — tx ${txRef}`,
        balanceAfter: updatedUser.aiCredits,
        fedapayTxId: txRef,
      } as any,
    });

    await txClient.creditPayment.updateMany({
      where: { fedapayTxId: txRef, userId },
      data: { status: 'APPROVED', confirmedAt: new Date() },
    });

    return updatedUser;
  });

  return { aiCredits: updated.aiCredits, added: pack.credits, alreadyCredited: false };
}

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
      where: {
        userId: req.userId!,
        type: 'purchase',
        OR: [
          { fedapayTxId: txRef },
          { description: { contains: `tx ${txRef}` } },
        ],
      } as any,
    });
    if (existing) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { aiCredits: true },
      });
      res.json({ alreadyCredited: true, aiCredits: user?.aiCredits ?? 0, added: 0 });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

    const tx = await getApprovedFedapayTransaction(txRef);

    const creditPayment = await prisma.creditPayment.findUnique({ where: { fedapayTxId: txRef } });
    if (creditPayment) {
      if (creditPayment.userId !== user.id) {
        res.status(403).json({ message: 'Transaction FedaPay liée à un autre compte' });
        return;
      }
      if (creditPayment.packId !== pack.id || creditPayment.credits !== pack.credits || creditPayment.amount !== pack.price) {
        res.status(400).json({ message: 'Transaction FedaPay incohérente avec la demande' });
        return;
      }
      assertCreditTransactionMatches(tx, pack);
    } else {
      // Backward compatibility for transactions created before CreditPayment existed.
      assertCreditTransactionMatches(tx, pack, user.email);
    }

    const result = await activateCreditPurchase(user.id, pack, txRef);

    console.log(`[ConfirmPurchase] +${pack.credits} crédits pour user ${req.userId} (tx ${txRef})`);
    res.json({
      success: true,
      aiCredits: result.aiCredits,
      added: result.added,
      alreadyCredited: result.alreadyCredited,
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const transaction = await prisma.creditTransaction.findFirst({
        where: { fedapayTxId: String(transactionId) },
        select: { userId: true },
      });
      if (transaction && transaction.userId !== req.userId) {
        res.status(403).json({ message: 'Transaction FedaPay déjà utilisée par un autre compte' });
        return;
      }
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { aiCredits: true },
      });
      res.json({ alreadyCredited: true, aiCredits: user?.aiCredits ?? 0, added: 0 });
      return;
    }
    console.error('[ConfirmPurchase] Erreur:', err.message);
    res.status(err.status || 500).json({ message: `Erreur confirmation : ${err.message}` });
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

    const tx = getTx(txData);
    const transId = tx?.id;
    if (!transId) throw new Error('Transaction ID manquant dans la réponse Fedapay');
    await prisma.creditPayment.upsert({
      where: { fedapayTxId: String(transId) },
      update: {
        userId: user.id,
        packId: pack.id,
        credits: pack.credits,
        amount: pack.price,
        status: 'PENDING',
        confirmedAt: null,
      },
      create: {
        userId: user.id,
        fedapayTxId: String(transId),
        packId: pack.id,
        credits: pack.credits,
        amount: pack.price,
      },
    });
    const paymentUrl = await createFedapayPaymentLink(transId);

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
