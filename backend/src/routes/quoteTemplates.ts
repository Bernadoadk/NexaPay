import { Router } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function calcTotals(items: TemplateItemInput[], taxRate: number, discount: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount = subtotal * (discount / 100);
  const taxable = subtotal - discountAmount;
  const taxAmount = taxable * (taxRate / 100);
  return { subtotal, taxAmount, total: taxable + taxAmount };
}

type TemplateItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string | null;
  productId?: string | null;
};

function sanitizePayload(body: any) {
  const name = cleanString(body?.name);
  const title = cleanString(body?.title);
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items = rawItems
    .map((item: any): TemplateItemInput => ({
      description: cleanString(item?.description),
      quantity: Number(item?.quantity) || 1,
      unitPrice: Number(item?.unitPrice) || 0,
      unit: cleanString(item?.unit) || null,
      productId: cleanString(item?.productId) || null,
    }))
    .filter((item: TemplateItemInput) => item.description);

  const taxRate = Math.min(100, Math.max(0, Number(body?.taxRate ?? 18) || 0));
  const discount = Math.min(100, Math.max(0, Number(body?.discount ?? 0) || 0));
  const validDays = Math.max(1, Number(body?.validDays ?? 30) || 30);
  const totals = calcTotals(items, taxRate, discount);

  return {
    name,
    category: cleanString(body?.category) || null,
    description: cleanString(body?.description) || null,
    title,
    notes: typeof body?.notes === 'string' ? body.notes.trim() || null : null,
    taxRate,
    discount,
    validDays,
    items,
    totals,
  };
}

function mapItems(items: TemplateItemInput[]) {
  return items.map((item, index) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.quantity * item.unitPrice,
    order: index,
    ...(item.unit ? { unit: item.unit } : {}),
    ...(item.productId ? { productId: item.productId } : {}),
  }));
}

router.get('/', async (req: AuthRequest, res): Promise<void> => {
  const templates = await prisma.quoteTemplate.findMany({
    where: { userId: req.userId },
    include: { items: { orderBy: { order: 'asc' } } },
    orderBy: [{ updatedAt: 'desc' }],
  });
  res.json(templates);
});

router.post('/', async (req: AuthRequest, res): Promise<void> => {
  try {
    const data = sanitizePayload(req.body);
    if (!data.name) { res.status(400).json({ message: 'Le nom du template est obligatoire' }); return; }
    if (!data.title) { res.status(400).json({ message: "L'objet du devis est obligatoire" }); return; }
    if (data.items.length === 0) { res.status(400).json({ message: 'Ajoutez au moins une ligne au template' }); return; }

    const template = await prisma.quoteTemplate.create({
      data: {
        name: data.name,
        category: data.category,
        description: data.description,
        title: data.title,
        notes: data.notes,
        taxRate: data.taxRate,
        discount: data.discount,
        validDays: data.validDays,
        subtotal: data.totals.subtotal,
        taxAmount: data.totals.taxAmount,
        total: data.totals.total,
        userId: req.userId!,
        items: { create: mapItems(data.items) },
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json(template);
  } catch (err: any) {
    console.error('[POST /quote-templates]', err?.message ?? err);
    res.status(500).json({ message: 'Erreur lors de la création du template' });
  }
});

router.post('/from-quote/:quoteId', async (req: AuthRequest, res): Promise<void> => {
  try {
    const quote = await prisma.quote.findFirst({
      where: { id: String(req.params.quoteId), userId: req.userId },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!quote) { res.status(404).json({ message: 'Devis introuvable' }); return; }

    const template = await prisma.quoteTemplate.create({
      data: {
        name: cleanString(req.body?.name) || quote.title,
        category: cleanString(req.body?.category) || null,
        description: cleanString(req.body?.description) || null,
        title: quote.title,
        notes: quote.notes,
        taxRate: quote.taxRate,
        discount: quote.discount,
        validDays: quote.validDays,
        subtotal: quote.subtotal,
        taxAmount: quote.taxAmount,
        total: quote.total,
        userId: req.userId!,
        items: {
          create: quote.items.map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            order: index,
            ...(item.unit ? { unit: item.unit } : {}),
            ...(item.productId ? { productId: item.productId } : {}),
          })),
        },
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json(template);
  } catch (err: any) {
    console.error('[POST /quote-templates/from-quote]', err?.message ?? err);
    res.status(500).json({ message: 'Erreur lors de la création du template' });
  }
});

router.put('/:id', async (req: AuthRequest, res): Promise<void> => {
  try {
    const exists = await prisma.quoteTemplate.findFirst({
      where: { id: String(req.params.id), userId: req.userId },
      select: { id: true },
    });
    if (!exists) { res.status(404).json({ message: 'Template introuvable' }); return; }

    const data = sanitizePayload(req.body);
    if (!data.name) { res.status(400).json({ message: 'Le nom du template est obligatoire' }); return; }
    if (!data.title) { res.status(400).json({ message: "L'objet du devis est obligatoire" }); return; }
    if (data.items.length === 0) { res.status(400).json({ message: 'Ajoutez au moins une ligne au template' }); return; }

    const updated = await prisma.quoteTemplate.update({
      where: { id: String(req.params.id) },
      data: {
        name: data.name,
        category: data.category,
        description: data.description,
        title: data.title,
        notes: data.notes,
        taxRate: data.taxRate,
        discount: data.discount,
        validDays: data.validDays,
        subtotal: data.totals.subtotal,
        taxAmount: data.totals.taxAmount,
        total: data.totals.total,
        items: {
          deleteMany: {},
          create: mapItems(data.items),
        },
      } satisfies Prisma.QuoteTemplateUpdateInput,
      include: { items: { orderBy: { order: 'asc' } } },
    });

    res.json(updated);
  } catch (err: any) {
    console.error('[PUT /quote-templates/:id]', err?.message ?? err);
    res.status(500).json({ message: 'Erreur lors de la modification du template' });
  }
});

router.post('/:id/use', async (req: AuthRequest, res): Promise<void> => {
  const exists = await prisma.quoteTemplate.findFirst({
    where: { id: String(req.params.id), userId: req.userId },
    select: { id: true },
  });
  if (!exists) { res.status(404).json({ message: 'Template introuvable' }); return; }

  const updated = await prisma.quoteTemplate.update({
    where: { id: String(req.params.id) },
    data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    include: { items: { orderBy: { order: 'asc' } } },
  });
  res.json(updated);
});

router.delete('/:id', async (req: AuthRequest, res): Promise<void> => {
  const exists = await prisma.quoteTemplate.findFirst({
    where: { id: String(req.params.id), userId: req.userId },
    select: { id: true },
  });
  if (!exists) { res.status(404).json({ message: 'Template introuvable' }); return; }

  await prisma.quoteTemplate.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
});

export { router as quoteTemplatesRouter };
