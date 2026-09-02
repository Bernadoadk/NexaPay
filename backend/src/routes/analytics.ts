import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendAdminAlertEmail } from '../utils/email';
import { prisma } from '../lib/prisma';
import { NotificationService } from '../lib/notificationService';
import { logActivity } from '../lib/activityLog';

const router = Router();

// Helper to ensure admin
const ensureAdmin = (req: AuthRequest, res: Response): boolean => {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return false;
  }
  return true;
};

/**
 * GET /api/analytics/users
 * Query: page (default 1), limit (default 20), search (email/name), blocked (boolean)
 */
router.get('/users', authenticate, async (req: AuthRequest, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const search = (req.query.search as string) || '';
  const blockedParam = req.query.blocked;
  const blockedFilter = blockedParam !== undefined ? { blocked: blockedParam === 'true' } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: {
        AND: [
          blockedFilter,
          search
            ? {
                OR: [
                  { email: { contains: search, mode: 'insensitive' } },
                  { name: { contains: search, mode: 'insensitive' } },
                ]
              }
            : {},
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
        plan: true,
        aiCredits: true,
        blocked: true,
        isEmailVerified: true,
        authProvider: true,
        createdAt: true,
        _count: {
          select: {
            quotes: true,
            activityLogs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({
      where: {
        AND: [
          blockedFilter,
          search
            ? {
                OR: [
                  { email: { contains: search, mode: 'insensitive' } },
                  { name: { contains: search, mode: 'insensitive' } },
                ]
              }
            : {},
        ],
      },
    }),
  ]);

  res.json({
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /api/analytics/users/:id
 * Get detailed user info including recent activity logs
 */
router.get('/users/:id', authenticate, async (req: AuthRequest, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const userId = req.params.id as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      plan: true,
      planExpiresAt: true,
      planInterval: true,
      aiCredits: true,
      aiCreditsLastRenewedAt: true,
      phoneCountry: true,
      isEmailVerified: true,
      authProvider: true,
      blocked: true,
      createdAt: true,
      updatedAt: true,
      quotes: {
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          total: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      activityLogs: {
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: {
          quotes: true,
          activityLogs: true,
          payments: true,
          creditTransactions: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

/**
 * PATCH /api/analytics/users/:id/block
 * Body: { blocked: boolean }
 */
router.patch('/users/:id/block', authenticate, async (req: AuthRequest, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const userId = req.params.id as string;
  const { blocked } = req.body as { blocked?: boolean };
  if (blocked === undefined) {
    return res.status(400).json({ error: 'Blocked status required' });
  }
  // Se bloquer soi-même reviendrait à se verrouiller hors du back-office.
  if (blocked && userId === req.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas bloquer votre propre compte' });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { blocked },
    select: {
      id: true,
      email: true,
      name: true,
      blocked: true,
    },
  });

  await NotificationService.createNotification(
    user.id,
    'account_blocked',
    blocked ? 'Compte bloqué' : 'Compte débloqué',
    `Votre compte a été ${blocked ? 'bloqué' : 'débloqué'} par un administrateur.`,
    { blocked }
  );

  logActivity(userId, blocked ? 'account_blocked' : 'account_unblocked', { performedBy: req.userId }, req);

  // Optionally send an admin alert email
  try {
    await sendAdminAlertEmail({
      subject: `User ${blocked ? 'blocked' : 'unblocked'}`,
      title: `User ${blocked ? 'blocked' : 'unblocked'}`,
      message: `User ${user.email} (${user.name}) has been ${blocked ? 'blocked' : 'unblocked'} by an administrator.`,
      details: {
        userId: user.id,
        blocked,
        performedBy: req.userId || 'admin',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('Failed to send admin alert email:', e);
  }

  res.json(user);
});

/**
 * PATCH /api/analytics/users/:id/plan
 * Body: { plan: 'FREE' | 'PRO' | 'BUSINESS' }
 */
router.patch('/users/:id/plan', authenticate, async (req: AuthRequest, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const userId = req.params.id as string;
  const { plan, months } = req.body as { plan?: 'FREE' | 'PRO' | 'BUSINESS'; months?: number | null };
  if (!plan || !['FREE', 'PRO', 'BUSINESS'].includes(plan)) {
    return res.status(400).json({ error: 'Valid plan required' });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Sans échéance cohérente, un plan accordé ici serait annulé dès la requête
  // suivante par la vérification d'expiration (`planExpiresAt` restait dans le
  // passé). `months: null` accorde le plan sans date de fin.
  let planExpiresAt: Date | null = null;
  if (plan !== 'FREE' && months !== null) {
    const duration = Number.isFinite(Number(months)) ? Math.max(1, Math.floor(Number(months))) : 1;
    planExpiresAt = new Date();
    planExpiresAt.setMonth(planExpiresAt.getMonth() + duration);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { plan, planExpiresAt },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      planExpiresAt: true,
    },
  });

  await NotificationService.createNotification(
    user.id,
    'subscription_updated',
    'Plan mis à jour',
    `Votre abonnement a été changé pour le plan ${plan}.`,
    { plan }
  );

  logActivity(userId, 'plan_changed', { plan, planExpiresAt, performedBy: req.userId }, req);

  try {
    await sendAdminAlertEmail({
      subject: `Plan changed for user ${user.email}`,
      title: `Plan updated to ${plan}`,
      message: `User ${user.email} (${user.name}) plan changed to ${plan} by an administrator.`,
      details: {
        userId: user.id,
        newPlan: plan,
        performedBy: req.userId || 'admin',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('Failed to send admin alert email:', e);
  }

  res.json(user);
});

/**
 * PATCH /api/analytics/users/:id/credits
 * Body: { amount: number } (positive or negative)
 */
router.patch('/users/:id/credits', authenticate, async (req: AuthRequest, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const userId = req.params.id as string;
  const { amount } = req.body as { amount?: number };
  if (amount === undefined || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Valid amount required' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const newCredits = Math.max(0, user.aiCredits + amount);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { aiCredits: newCredits },
    select: {
      id: true,
      email: true,
      name: true,
      aiCredits: true,
    },
  });

  // Log credit adjustment as activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'credit_adjustment',
      details: {
        amount,
        previousCredits: user.aiCredits,
        newCredits: newCredits,
        reason: 'admin_adjustment',
        performedBy: req.userId,
      },
    },
  });

  // Sans cette écriture, l'ajustement n'apparaîtrait pas dans l'historique de
  // crédits du client (/api/credits/history), qui semblerait alors incohérent.
  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: newCredits - user.aiCredits,
      type: 'admin_adjustment',
      description: 'Ajustement par un administrateur',
      balanceAfter: newCredits,
    },
  });

  await NotificationService.createNotification(
    updated.id,
    'credits_updated',
    'Crédits mis à jour',
    `Vos crédits ont été ajustés de ${amount}. Nouveau solde: ${newCredits}.`,
    { amount, newCredits }
  );

  try {
    await sendAdminAlertEmail({
      subject: `Credits adjusted for user ${user.email}`,
      title: `Credits changed by ${amount}`,
      message: `User ${user.email} (${user.name}) AI credits changed by ${amount} (from ${user.aiCredits} to ${newCredits}) by an administrator.`,
      details: {
        userId: user.id,
        amountChanged: amount,
        previousCredits: user.aiCredits,
        newCredits,
        performedBy: req.userId || 'admin',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('Failed to send admin alert email:', e);
  }

  res.json(updated);
});

/**
 * Tarifs de référence pour le calcul du MRR. Doit rester aligné sur
 * PLAN_PRICES / ANNUAL_DISCOUNT dans routes/payments.ts.
 */
const PLAN_MONTHLY_PRICE: Record<string, number> = { FREE: 0, PRO: 3500, BUSINESS: 9000 };
const MRR_ANNUAL_DISCOUNT = 0.15;

function monthlyValue(plan: string, interval: string): number {
  const base = PLAN_MONTHLY_PRICE[plan] ?? 0;
  // Un abonnement annuel est encaissé d'un coup : on le ramène au mois pour le MRR.
  return interval === 'annual' ? Math.round(base * (1 - MRR_ANNUAL_DISCOUNT)) : base;
}

/** Variation en pourcentage entre deux périodes comparables. */
function trend(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * GET /api/analytics/stats?days=30
 *
 * KPI de la plateforme. Point d'attention : le revenu de NexaPay, ce sont les
 * commissions prélevées — pas les montants encaissés (GMV) ni les sommes
 * reversées aux marchands, qui appartiennent à ces derniers.
 */
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodStart = new Date(now.getTime() - days * 86400000);
  const previousStart = new Date(now.getTime() - 2 * days * 86400000);

  const [
    totalUsers,
    activeUsersLogs,
    newUsersToday,
    newUsersPeriod,
    newUsersPrevious,
    totalQuotes,
    quotesToday,
    quotesPeriod,
    quotesPrevious,
    usersByPlan,
    creditsStats,
    paidSubscribers,
    quotePayments,
    storePayments,
    quotePaymentsPeriod,
    storePaymentsPeriod,
    quotePaymentsPrevious,
    storePaymentsPrevious,
    failedQuotePayouts,
    failedStorePayouts,
    storeOrders,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.activityLog.findMany({
      where: { createdAt: { gte: startOfDay } },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.user.count({ where: { createdAt: { gte: periodStart } } }),
    prisma.user.count({ where: { createdAt: { gte: previousStart, lt: periodStart } } }),
    prisma.quote.count(),
    prisma.quote.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.quote.count({ where: { createdAt: { gte: periodStart } } }),
    prisma.quote.count({ where: { createdAt: { gte: previousStart, lt: periodStart } } }),
    prisma.user.groupBy({ by: ['plan'], _count: true }),
    prisma.user.aggregate({
      _avg: { aiCredits: true },
      _sum: { aiCredits: true },
      _min: { aiCredits: true },
      _max: { aiCredits: true },
    }),
    prisma.user.findMany({
      where: {
        plan: { not: 'FREE' },
        OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }],
      },
      select: { plan: true, planInterval: true },
    }),
    prisma.payment.aggregate({ _sum: { commission: true, grossAmount: true, netAmount: true }, _count: true }),
    prisma.storePayment.aggregate({ _sum: { commission: true, grossAmount: true, netAmount: true }, _count: true }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: periodStart } },
      _sum: { commission: true, grossAmount: true },
      _count: true,
    }),
    prisma.storePayment.aggregate({
      where: { createdAt: { gte: periodStart } },
      _sum: { commission: true, grossAmount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: previousStart, lt: periodStart } },
      _sum: { commission: true },
    }),
    prisma.storePayment.aggregate({
      where: { createdAt: { gte: previousStart, lt: periodStart } },
      _sum: { commission: true },
    }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.storePayment.count({ where: { status: 'FAILED' } }),
    prisma.storeOrder.count(),
  ]);

  const mrr = paidSubscribers.reduce(
    (sum, user) => sum + monthlyValue(user.plan, user.planInterval),
    0,
  );
  const payingUsers = paidSubscribers.length;

  const commissionTotal = (quotePayments._sum.commission ?? 0) + (storePayments._sum.commission ?? 0);
  const commissionPeriod = (quotePaymentsPeriod._sum.commission ?? 0) + (storePaymentsPeriod._sum.commission ?? 0);
  const commissionPrevious = (quotePaymentsPrevious._sum.commission ?? 0) + (storePaymentsPrevious._sum.commission ?? 0);

  const gmvTotal = (quotePayments._sum.grossAmount ?? 0) + (storePayments._sum.grossAmount ?? 0);
  const gmvPeriod = (quotePaymentsPeriod._sum.grossAmount ?? 0) + (storePaymentsPeriod._sum.grossAmount ?? 0);
  const payoutsTotal = (quotePayments._sum.netAmount ?? 0) + (storePayments._sum.netAmount ?? 0);
  const transactionsTotal = quotePayments._count + storePayments._count;
  const transactionsPeriod = quotePaymentsPeriod._count + storePaymentsPeriod._count;

  res.json({
    period: { days, start: periodStart.toISOString(), end: now.toISOString() },
    users: {
      total: totalUsers,
      activeToday: activeUsersLogs.length,
      newToday: newUsersToday,
      newPeriod: newUsersPeriod,
      trend: trend(newUsersPeriod, newUsersPrevious),
      paying: payingUsers,
      conversionRate: totalUsers > 0 ? Math.round((payingUsers / totalUsers) * 1000) / 10 : 0,
    },
    quotes: {
      total: totalQuotes,
      today: quotesToday,
      period: quotesPeriod,
      trend: trend(quotesPeriod, quotesPrevious),
    },
    orders: { total: storeOrders },
    // Revenu NexaPay = commissions. `gmv` est le volume traité (argent des
    // marchands), `payouts` ce qui leur a été reversé.
    revenue: {
      commissionTotal,
      commissionPeriod,
      trend: trend(commissionPeriod, commissionPrevious),
      mrr,
      arpu: payingUsers > 0 ? Math.round(mrr / payingUsers) : 0,
    },
    volume: {
      gmvTotal,
      gmvPeriod,
      payoutsTotal,
      transactionsTotal,
      transactionsPeriod,
      failedPayouts: failedQuotePayouts + failedStorePayouts,
    },
    plans: usersByPlan.reduce((acc, cur) => {
      acc[cur.plan] = cur._count;
      return acc;
    }, {} as Record<string, number>),
    credits: {
      average: Math.round(creditsStats._avg.aiCredits ?? 0),
      total: creditsStats._sum.aiCredits ?? 0,
      min: creditsStats._min.aiCredits ?? 0,
      max: creditsStats._max.aiCredits ?? 0,
    },
    timestamp: now.toISOString(),
  });
});

/**
 * GET /api/analytics/timeseries?days=30
 *
 * Séries journalières agrégées en base. Le dashboard construisait auparavant
 * ses courbes en téléchargeant les journaux bruts, ce qui les rendait fausses
 * dès que le volume dépassait la limite de pagination.
 */
router.get('/timeseries', authenticate, async (req: AuthRequest, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const days = Math.min(180, Math.max(7, parseInt(req.query.days as string) || 30));
  const since = new Date(Date.now() - (days - 1) * 86400000);
  since.setHours(0, 0, 0, 0);

  type Row = { day: Date; count: number; total?: number | null };

  const [signups, quotes, payments, activity] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "User" WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "Quote" WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT day, SUM(count)::int AS count, SUM(total)::float AS total FROM (
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count, SUM("commission") AS total
        FROM "Payment" WHERE "createdAt" >= ${since} GROUP BY 1
        UNION ALL
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count, SUM("commission") AS total
        FROM "StorePayment" WHERE "createdAt" >= ${since} GROUP BY 1
      ) merged GROUP BY day ORDER BY day`,
    prisma.$queryRaw<Row[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "ActivityLog" WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
  ]);

  const key = (d: Date) => new Date(d).toISOString().slice(0, 10);
  const index = (rows: Row[]) => new Map(rows.map((r) => [key(r.day), r]));
  const signupMap = index(signups);
  const quoteMap = index(quotes);
  const paymentMap = index(payments);
  const activityMap = index(activity);

  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const dayKey = key(date);
    series.push({
      date: dayKey,
      signups: Number(signupMap.get(dayKey)?.count ?? 0),
      quotes: Number(quoteMap.get(dayKey)?.count ?? 0),
      payments: Number(paymentMap.get(dayKey)?.count ?? 0),
      commission: Number(paymentMap.get(dayKey)?.total ?? 0),
      activity: Number(activityMap.get(dayKey)?.count ?? 0),
    });
  }

  res.json({ days, series });
});

/**
 * GET /api/analytics/activity
 * Query: userId?, startDate?, endDate?, limit?
 * Returns paginated activity logs (across all users or filtered)
 */
router.get('/activity', authenticate, async (req: AuthRequest, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
  const userId = (req.query.userId as string) || undefined;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

  const where: any = {};
  if (userId) where.userId = userId;
  if (startDate) where.createdAt = { ...(where.createdAt ?? {}), gte: startDate };
  if (endDate) where.createdAt = { ...(where.createdAt ?? {}), lte: endDate };

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        userId: true,
        action: true,
        details: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  res.json({
    logs,
    pagination: {
      limit,
      offset,
      total,
      returned: logs.length,
      hasMore: offset + logs.length < total,
    },
  });
});

/**
 * DELETE /api/analytics/activity?days=90
 *
 * Purge les journaux d'activité antérieurs à N jours. Remplace le bouton
 * « zone de danger » qui affichait une confirmation sans rien supprimer.
 */
router.delete('/activity', authenticate, async (req: AuthRequest, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const days = Math.max(0, parseInt(req.query.days as string) || 0);
  const cutoff = new Date(Date.now() - days * 86400000);

  const deleted = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  logActivity(req.userId!, 'activity_logs_purged', { days, deleted: deleted.count }, req);

  res.json({ deleted: deleted.count, before: cutoff.toISOString() });
});

export { router as analyticsRouter };