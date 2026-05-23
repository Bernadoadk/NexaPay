import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/stats', async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const now = new Date();

  // Support optional date range filter (from/to query params)
  const fromParam = req.query.from as string | undefined;
  const toParam = req.query.to as string | undefined;

  let rangeStart: Date;
  let rangeEnd: Date;

  if (fromParam && toParam) {
    rangeStart = new Date(fromParam + 'T00:00:00');
    rangeEnd = new Date(toParam + 'T23:59:59');
  } else {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    rangeEnd = now;
  }

  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [totalQuotes, totalClients, paidNowAgg, paidPrevAgg, pendingAgg, overdueCount, recentQuotes] =
    await Promise.all([
      prisma.quote.count({ where: { userId, createdAt: { gte: rangeStart, lte: rangeEnd } } }),
      prisma.client.count({ where: { userId } }),
      prisma.quote.aggregate({
        where: { userId, status: 'PAID', paidAt: { gte: rangeStart, lte: rangeEnd } },
        _sum: { total: true },
      }),
      prisma.quote.aggregate({
        where: { userId, status: 'PAID', paidAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { total: true },
      }),
      prisma.quote.aggregate({
        where: { userId, status: { in: ['SENT', 'OVERDUE'] } },
        _sum: { total: true },
      }),
      prisma.quote.count({ where: { userId, status: 'OVERDUE' } }),
      prisma.quote.findMany({
        where: { userId },
        include: { client: { select: { id: true, name: true, color: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

  const revenue = paidNowAgg._sum.total ?? 0;
  const prevRevenue = paidPrevAgg._sum.total ?? 0;
  const revenueGrowth = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0;

  const monthlyRevenue = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
      const next = new Date(now.getFullYear(), now.getMonth() - (6 - i) + 1, 1);
      return Promise.all([
        prisma.quote.aggregate({
          where: { userId, status: 'PAID', paidAt: { gte: d, lt: next } },
          _sum: { total: true },
        }),
        prisma.quote.aggregate({
          where: { userId, status: 'SENT', sentAt: { gte: d, lt: next } },
          _sum: { total: true },
        }),
      ]).then(([paid, sent]) => ({
        month: d.toLocaleDateString('fr-FR', { month: 'short' }),
        paid: (paid._sum.total ?? 0) / 1_000_000,
        sent: (sent._sum.total ?? 0) / 1_000_000,
      }));
    })
  );

  res.json({
    totalQuotes,
    totalClients,
    revenue,
    revenueGrowth,
    pending: pendingAgg._sum.total ?? 0,
    overdueCount,
    recentQuotes,
    monthlyRevenue,
  });
});

export { router as dashboardRouter };
