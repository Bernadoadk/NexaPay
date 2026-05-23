import { Router } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// ──────────────────────────────────────────────────────────────
// Whitelisted product fields. Anything else in req.body is dropped
// to avoid mass-assignment (userId, archived flag, etc.).
// ──────────────────────────────────────────────────────────────
function sanitize(body: any): Partial<Prisma.ProductCreateInput> {
  const out: any = {};
  if (typeof body?.name === 'string') out.name = body.name.trim();
  if (typeof body?.description === 'string') out.description = body.description.trim() || null;
  if (typeof body?.category === 'string') out.category = body.category.trim() || null;
  if (typeof body?.unit === 'string') out.unit = body.unit.trim() || null;
  if (body?.price !== undefined) {
    const n = Number(body.price);
    if (!Number.isFinite(n) || n < 0) {
      const err: any = new Error('Le prix doit être un nombre positif');
      err.status = 400;
      throw err;
    }
    out.price = Math.round(n);
  }
  return out;
}

// ──────────────────────────────────────────────────────────────
// GET /api/products
// Query: ?search=&sort=name|price-asc|price-desc|used|recent&archived=0|1|all
// Always returns usageCount and totalBilled per product.
// ──────────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res): Promise<void> => {
  const search = String(req.query.search ?? '').trim();
  const sortKey = String(req.query.sort ?? 'name');
  const archivedParam = String(req.query.archived ?? '0');

  const where: Prisma.ProductWhereInput = { userId: req.userId };
  if (archivedParam === '0') where.archived = false;
  else if (archivedParam === '1') where.archived = true;
  // 'all' → no filter

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sortKey === 'price-asc'  ? { price: 'asc' } :
    sortKey === 'price-desc' ? { price: 'desc' } :
    sortKey === 'recent'     ? { createdAt: 'desc' } :
    /* default name */         { name: 'asc' };

  const products = await prisma.product.findMany({
    where,
    orderBy,
    include: {
      _count: { select: { items: true } },
    },
  });

  // Total billed per product = SUM(QuoteItem.total) only for PAID quotes.
  const billedRows = await prisma.quoteItem.groupBy({
    by: ['productId'],
    where: {
      productId: { in: products.map(p => p.id) },
      quote: { userId: req.userId, status: 'PAID' },
    },
    _sum: { total: true },
  });
  const billedMap = new Map(billedRows.map(r => [r.productId, r._sum.total ?? 0]));

  let enriched = products.map(p => ({
    ...p,
    usageCount: p._count.items,
    totalBilled: billedMap.get(p.id) ?? 0,
  }));

  if (sortKey === 'used') {
    enriched = enriched.sort((a, b) => b.usageCount - a.usageCount);
  }

  res.json(enriched);
});

// ──────────────────────────────────────────────────────────────
// POST /api/products
// ──────────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res): Promise<void> => {
  try {
    const data = sanitize(req.body);
    if (!data.name) { res.status(400).json({ message: 'Le nom est obligatoire' }); return; }

    const product = await prisma.product.create({
      data: { ...data, name: data.name, userId: req.userId! } as Prisma.ProductUncheckedCreateInput,
    });
    res.status(201).json(product);
  } catch (err: any) {
    if (err.status === 400) { res.status(400).json({ message: err.message }); return; }
    console.error('[POST /products]', err.message);
    res.status(500).json({ message: 'Erreur lors de la création' });
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/products/:id
// ──────────────────────────────────────────────────────────────
router.put('/:id', async (req: AuthRequest, res): Promise<void> => {
  try {
    const exists = await prisma.product.findFirst({
      where: { id: String(req.params.id), userId: req.userId },
      select: { id: true },
    });
    if (!exists) { res.status(404).json({ message: 'Produit introuvable' }); return; }

    const data = sanitize(req.body);
    if (data.name === '') { res.status(400).json({ message: 'Le nom ne peut pas être vide' }); return; }

    const updated = await prisma.product.update({ where: { id: String(req.params.id) }, data });
    res.json(updated);
  } catch (err: any) {
    if (err.status === 400) { res.status(400).json({ message: err.message }); return; }
    console.error('[PUT /products/:id]', err.message);
    res.status(500).json({ message: 'Erreur lors de la modification' });
  }
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/products/:id/archive  { archived: boolean }
// ──────────────────────────────────────────────────────────────
router.patch('/:id/archive', async (req: AuthRequest, res): Promise<void> => {
  const exists = await prisma.product.findFirst({
    where: { id: String(req.params.id), userId: req.userId },
    select: { id: true },
  });
  if (!exists) { res.status(404).json({ message: 'Produit introuvable' }); return; }

  const archived = Boolean(req.body?.archived);
  const updated = await prisma.product.update({
    where: { id: String(req.params.id) },
    data: { archived },
  });
  res.json(updated);
});

// ──────────────────────────────────────────────────────────────
// POST /api/products/:id/duplicate
// ──────────────────────────────────────────────────────────────
router.post('/:id/duplicate', async (req: AuthRequest, res): Promise<void> => {
  const original = await prisma.product.findFirst({
    where: { id: String(req.params.id), userId: req.userId },
  });
  if (!original) { res.status(404).json({ message: 'Produit introuvable' }); return; }

  const copy = await prisma.product.create({
    data: {
      name: `${original.name} (copie)`,
      description: original.description,
      category: original.category,
      price: original.price,
      unit: original.unit,
      userId: req.userId!,
    },
  });
  res.status(201).json(copy);
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/products/:id
// Refuses to hard-delete a product used in past quotes — instructs
// the client to archive it instead, preserving history.
// ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res): Promise<void> => {
  const exists = await prisma.product.findFirst({
    where: { id: String(req.params.id), userId: req.userId },
    select: { id: true, _count: { select: { items: true } } },
  });
  if (!exists) { res.status(404).json({ message: 'Produit introuvable' }); return; }

  if (exists._count.items > 0) {
    res.status(409).json({
      message: `Ce produit est utilisé dans ${exists._count.items} devis — archivez-le pour conserver l'historique`,
      code: 'IN_USE',
      usageCount: exists._count.items,
    });
    return;
  }

  await prisma.product.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
});

// ──────────────────────────────────────────────────────────────
// GET /api/products/categories — distinct categories for autocomplete
// ──────────────────────────────────────────────────────────────
router.get('/categories', async (req: AuthRequest, res): Promise<void> => {
  const rows = await prisma.product.findMany({
    where: { userId: req.userId, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  res.json(rows.map(r => r.category).filter(Boolean));
});

export { router as productsRouter };
