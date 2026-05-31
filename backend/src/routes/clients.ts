import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { toE164 } from '../utils/phone';

const router = Router();
const prisma = new PrismaClient();
const COLORS = ['#0F8F65', '#2563EB', '#C2691B', '#7C4FBF', '#B43A3A'];

router.use(authenticate);

router.get('/', async (req: AuthRequest, res): Promise<void> => {
  const { search } = req.query;
  const clients = await prisma.client.findMany({
    where: {
      userId: req.userId,
      ...(search
        ? {
            OR: [
              { name: { contains: String(search), mode: 'insensitive' } },
              { contact: { contains: String(search), mode: 'insensitive' } },
              { city: { contains: String(search), mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { quotes: true } },
      quotes: { select: { total: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = clients.map(({ _count, quotes, ...c }) => ({
    ...c,
    quotesCount: _count.quotes,
    totalBilled: quotes.reduce((s, q) => s + q.total, 0),
  }));
  res.json(result);
});

router.post(
  '/',
  body('name').trim().notEmpty(),
  async (req: AuthRequest, res): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const count = await prisma.client.count({ where: { userId: req.userId } });
    const color = req.body.color || COLORS[count % COLORS.length];
    const { name, contact, email, city, address, ifu } = req.body;
    const phoneCountry = req.body.phoneCountry || 'bj';
    const phone = req.body.phone ? toE164(req.body.phone, phoneCountry) : undefined;

    const client = await prisma.client.create({
      data: { name, contact, email, phone, phoneCountry, city, address, ifu, userId: req.userId!, color },
    });
    res.status(201).json(client);
  }
);

router.get('/:id', async (req: AuthRequest, res): Promise<void> => {
  const clientId = String(req.params.id);
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId: req.userId },
    include: { quotes: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });
  if (!client) { res.status(404).json({ message: 'Client introuvable' }); return; }
  res.json(client);
});

router.put('/:id', async (req: AuthRequest, res): Promise<void> => {
  const clientId = String(req.params.id);
  const exists = await prisma.client.findFirst({ where: { id: clientId, userId: req.userId } });
  if (!exists) { res.status(404).json({ message: 'Client introuvable' }); return; }
  // Strip virtual/computed fields and immutable fields
  const { userId: _, id: _id, quotesCount: _qc, totalBilled: _tb, createdAt: _ca, updatedAt: _ua, ...rest } = req.body;
  const phoneCountry = rest.phoneCountry || exists.phoneCountry || 'bj';
  const data = {
    ...rest,
    phoneCountry,
    ...(rest.phone !== undefined ? { phone: rest.phone ? toE164(rest.phone, phoneCountry) : null } : {}),
  };
  const updated = await prisma.client.update({ where: { id: clientId }, data });
  res.json(updated);
});

router.delete('/:id', async (req: AuthRequest, res): Promise<void> => {
  const clientId = String(req.params.id);
  const exists = await prisma.client.findFirst({ where: { id: clientId, userId: req.userId } });
  if (!exists) { res.status(404).json({ message: 'Client introuvable' }); return; }
  await prisma.client.delete({ where: { id: clientId } });
  res.status(204).send();
});

export { router as clientsRouter };
