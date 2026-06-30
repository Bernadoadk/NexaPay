import { Router } from 'express';
import { Prisma, PrismaClient, StoreOrderStatus, StoreProduct, StoreProductStatus } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createPaidQuoteForOrder, syncStoreOrderFromFedapay } from '../lib/storeSync';
import { cleanCountryCode, countryFromPhone, e164ToLocalDigits, toE164 } from '../utils/phone';

const router = Router();
const prisma = new PrismaClient();

const FEDAPAY_BASE = process.env.FEDAPAY_ENV === 'live'
  ? 'https://api.fedapay.com/v1'
  : 'https://sandbox-api.fedapay.com/v1';

const ADMIN_STATUSES = new Set(['PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED']);
const PAYMENT_MODES = new Set(['ONLINE', 'COD', 'BOTH']);
const CHECKOUT_PAYMENT_METHODS = new Set(['ONLINE', 'COD']);
const FALLBACK_FONTS = [
  ['Inter', 'sans-serif'], ['Roboto', 'sans-serif'], ['Open Sans', 'sans-serif'],
  ['Lato', 'sans-serif'], ['Montserrat', 'sans-serif'], ['Poppins', 'sans-serif'],
  ['Nunito Sans', 'sans-serif'], ['DM Sans', 'sans-serif'], ['Manrope', 'sans-serif'],
  ['Work Sans', 'sans-serif'], ['Rubik', 'sans-serif'], ['Raleway', 'sans-serif'],
  ['Source Sans 3', 'sans-serif'], ['Libre Franklin', 'sans-serif'], ['Mulish', 'sans-serif'],
  ['Playfair Display', 'serif'], ['Merriweather', 'serif'], ['Lora', 'serif'],
  ['Libre Baskerville', 'serif'], ['Cormorant Garamond', 'serif'], ['Bitter', 'serif'],
  ['Roboto Slab', 'serif'], ['DM Serif Display', 'serif'], ['Bodoni Moda', 'serif'],
  ['Oswald', 'sans-serif'], ['Archivo', 'sans-serif'], ['Barlow', 'sans-serif'],
  ['Figtree', 'sans-serif'], ['Outfit', 'sans-serif'], ['Plus Jakarta Sans', 'sans-serif'],
] as const;
let fontsCache: { expiresAt: number; items: { family: string; category: string }[] } | null = null;
const FONT_PRIORITY = new Map<string, number>(FALLBACK_FONTS.map(([family], index) => [family, index]));

function slugify(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'boutique';
}

function cleanColor(input: unknown, fallback: string) {
  if (typeof input !== 'string') return fallback;
  const value = input.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : fallback;
}

function isPaymentMethodAllowed(mode: string | null | undefined, method: string) {
  const paymentMode = mode || 'ONLINE';
  return paymentMode === 'BOTH' || paymentMode === method;
}

async function getGoogleFonts() {
  if (fontsCache && fontsCache.expiresAt > Date.now()) return fontsCache.items;

  let items: { family: string; category: string }[] = [];
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  try {
    if (apiKey) {
      const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${encodeURIComponent(apiKey)}`);
      if (!response.ok) throw new Error(`Google Fonts API ${response.status}`);
      const data = await response.json() as any;
      items = (data.items ?? []).map((font: any) => ({
        family: String(font.family),
        category: normalizeFontCategory(font.category),
      }));
    } else {
      const response = await fetch('https://fonts.google.com/metadata/fonts');
      if (!response.ok) throw new Error(`Google Fonts metadata ${response.status}`);
      const raw = await response.text();
      const data = JSON.parse(raw.replace(/^\)\]\}'\s*/, ''));
      items = (data.familyMetadataList ?? []).map((font: any) => ({
        family: String(font.family),
        category: normalizeFontCategory(font.category),
      }));
    }
  } catch (error: any) {
    console.warn('[GoogleFonts] Catalogue distant indisponible:', error.message);
  }

  if (items.length === 0) {
    items = FALLBACK_FONTS.map(([family, category]) => ({ family, category }));
  }
  items.sort((a, b) => {
    const aPriority = FONT_PRIORITY.get(a.family) ?? Number.MAX_SAFE_INTEGER;
    const bPriority = FONT_PRIORITY.get(b.family) ?? Number.MAX_SAFE_INTEGER;
    return aPriority - bPriority || a.family.localeCompare(b.family);
  });
  fontsCache = { items, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return items;
}

function normalizeFontCategory(value: unknown) {
  const category = String(value || '').toLowerCase();
  if (category.includes('mono')) return 'monospace';
  if (category.includes('serif') && !category.includes('sans')) return 'serif';
  if (category.includes('handwriting') || category.includes('display')) return category.includes('handwriting') ? 'handwriting' : 'display';
  return 'sans-serif';
}

async function ensureUniqueSlug(base: string, currentStoreId?: string) {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === currentStoreId) return slug;
  }
  return `${root}-${Date.now()}`;
}

async function requireProStoreUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, plan: true, name: true, companyName: true, email: true, phone: true, phoneCountry: true },
  });
  if (!user) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
  if (user.plan === 'FREE') {
    throw Object.assign(new Error('La boutique est réservée aux comptes Pro et Business'), { status: 403 });
  }
  return user;
}

function sanitizeStore(body: any) {
  const out: any = {};
  if (typeof body?.name === 'string') out.name = body.name.trim();
  if (typeof body?.description === 'string') out.description = body.description.trim() || null;
  if (typeof body?.logoUrl === 'string') out.logoUrl = body.logoUrl.trim() || null;
  if (typeof body?.coverImageUrl === 'string') out.coverImageUrl = body.coverImageUrl.trim() || null;
  if (body?.themePrimaryColor !== undefined) out.themePrimaryColor = cleanColor(body.themePrimaryColor, '#0F8F65');
  if (body?.themeAccentColor !== undefined) out.themeAccentColor = cleanColor(body.themeAccentColor, '#14201C');
  if (body?.themeBackgroundColor !== undefined) out.themeBackgroundColor = cleanColor(body.themeBackgroundColor, '#FAFAF7');
  if (body?.themeSurfaceColor !== undefined) out.themeSurfaceColor = cleanColor(body.themeSurfaceColor, '#FFFFFF');
  if (body?.themeTextColor !== undefined) out.themeTextColor = cleanColor(body.themeTextColor, '#14201C');
  if (body?.themeMutedTextColor !== undefined) out.themeMutedTextColor = cleanColor(body.themeMutedTextColor, '#6B7570');
  if (body?.themeBorderColor !== undefined) out.themeBorderColor = cleanColor(body.themeBorderColor, '#E2E4DF');
  if (body?.themeButtonTextColor !== undefined) out.themeButtonTextColor = cleanColor(body.themeButtonTextColor, '#FFFFFF');
  if (body?.themeInputBackgroundColor !== undefined) out.themeInputBackgroundColor = cleanColor(body.themeInputBackgroundColor, '#FFFFFF');
  if (body?.themeInputTextColor !== undefined) out.themeInputTextColor = cleanColor(body.themeInputTextColor, '#14201C');
  if (body?.themeInputBorderColor !== undefined) out.themeInputBorderColor = cleanColor(body.themeInputBorderColor, '#C8CCC6');
  if (typeof body?.themeFontFamily === 'string') out.themeFontFamily = body.themeFontFamily.trim().slice(0, 100) || 'Inter';
  const phoneCountry = cleanCountryCode(body?.phoneCountry);
  const whatsappCountry = cleanCountryCode(body?.whatsappCountry ?? phoneCountry);
  const momoCountry = cleanCountryCode(body?.momoCountry ?? phoneCountry);
  if (typeof body?.phoneCountry === 'string') out.phoneCountry = phoneCountry;
  if (typeof body?.whatsappCountry === 'string') out.whatsappCountry = whatsappCountry;
  if (typeof body?.momoCountry === 'string') out.momoCountry = momoCountry;
  if (typeof body?.whatsapp === 'string') out.whatsapp = body.whatsapp.trim() ? toE164(body.whatsapp, whatsappCountry) : null;
  if (typeof body?.phone === 'string') out.phone = body.phone.trim() ? toE164(body.phone, phoneCountry) : null;
  if (typeof body?.email === 'string') out.email = body.email.trim().toLowerCase() || null;
  if (typeof body?.momoPhone === 'string') out.momoPhone = body.momoPhone.trim() ? toE164(body.momoPhone, momoCountry) : null;
  if (typeof body?.quoteTemplateId === 'string') out.quoteTemplateId = body.quoteTemplateId.trim() || 'classique';
  if (typeof body?.receiptTitle === 'string') out.receiptTitle = body.receiptTitle.trim() || "Reçu d'achat";
  if (body?.taxRate !== undefined) {
    const n = Number(body.taxRate);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw Object.assign(new Error('TVA invalide'), { status: 400 });
    out.taxRate = n;
  }
  if (body?.active !== undefined) out.active = Boolean(body.active);
  if (body?.acceptsOrders !== undefined) out.acceptsOrders = Boolean(body.acceptsOrders);
  if (typeof body?.paymentMode === 'string' && PAYMENT_MODES.has(body.paymentMode)) out.paymentMode = body.paymentMode;
  return out;
}

function sanitizeProduct(body: any) {
  const out: any = {};
  if (typeof body?.name === 'string') out.name = body.name.trim();
  if (typeof body?.description === 'string') out.description = body.description.trim() || null;
  if (typeof body?.category === 'string') out.category = body.category.trim() || null;
  if (typeof body?.unit === 'string') out.unit = body.unit.trim() || null;
  if (typeof body?.imageUrl === 'string') out.imageUrl = body.imageUrl.trim() || null;
  if (Array.isArray(body?.imageUrls)) {
    out.imageUrls = body.imageUrls.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 8);
  }
  if (typeof body?.sku === 'string') out.sku = body.sku.trim() || null;
  if (body?.status !== undefined && Object.values(StoreProductStatus).includes(body.status)) out.status = body.status;
  if (body?.price !== undefined) {
    const n = Number(body.price);
    if (!Number.isFinite(n) || n < 0) throw Object.assign(new Error('Le prix doit être positif'), { status: 400 });
    out.price = Math.round(n);
  }
  if (body?.stock !== undefined && body.stock !== null && body.stock !== '') {
    const n = Number(body.stock);
    if (!Number.isInteger(n) || n < 0) throw Object.assign(new Error('Stock invalide'), { status: 400 });
    out.stock = n;
  } else if (body?.stock === null || body?.stock === '') {
    out.stock = null;
  }
  if (body?.trackStock !== undefined) out.trackStock = Boolean(body.trackStock);
  if (body?.allowBackorder !== undefined) out.allowBackorder = Boolean(body.allowBackorder);
  if (body?.featured !== undefined) out.featured = Boolean(body.featured);
  if (body?.order !== undefined) out.order = Number(body.order) || 0;
  if (body?.productId !== undefined) out.productId = body.productId ? String(body.productId) : null;
  if (body?.variantsJson !== undefined) out.variantsJson = body.variantsJson ?? Prisma.JsonNull;
  return out;
}

function calcTotals(lines: { quantity: number; unitPrice: number }[], taxRate: number) {
  const subtotal = lines.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100));
  return { subtotal, taxAmount, total: subtotal + taxAmount };
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

function getTx(data: any) {
  return data?.['v1/transaction'] ?? data?.v1?.transaction ?? data;
}

async function createFedapayPaymentLink(transactionId: string | number): Promise<string> {
  const tokenData: any = await fedapayReq('POST', `/transactions/${transactionId}/token`);
  const paymentUrl = tokenData?.url ?? tokenData?.payment_url;
  if (!paymentUrl) throw new Error('Lien de paiement FedaPay manquant');
  return String(paymentUrl);
}

async function nextOrderNumber(userId: string) {
  const now = new Date();
  const prefix = `CMD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await prisma.storeOrder.count({
    where: { userId, number: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

function publicStoreInclude() {
  return {
    products: {
      where: { status: { in: ['ACTIVE', 'SOLD_OUT'] as StoreProductStatus[] } },
      orderBy: [{ featured: 'desc' as const }, { order: 'asc' as const }, { createdAt: 'desc' as const }],
    },
    user: {
      select: {
        name: true,
        companyName: true,
        email: true,
        phone: true,
        address: true,
        ifu: true,
        rccm: true,
        logoUrl: true,
        quoteLogoUrl: true,
        useProfilePhotoAsLogo: true,
        plan: true,
      },
    },
  };
}

// Merchant dashboard
router.get('/fonts', authenticate, async (_req, res): Promise<void> => {
  const fonts = await getGoogleFonts();
  res.json(fonts);
});

router.get('/slug-availability', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    await requireProStoreUser(req.userId!);
    const slug = slugify(String(req.query.slug || ''));
    const [currentStore, existing] = await Promise.all([
      prisma.store.findUnique({ where: { userId: req.userId! }, select: { id: true, slug: true } }),
      prisma.store.findUnique({ where: { slug }, select: { id: true } }),
    ]);
    const available = !existing || existing.id === currentStore?.id;
    res.json({ slug, available, current: slug === currentStore?.slug });
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || 'Vérification du lien impossible' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    await requireProStoreUser(req.userId!);
    let store = await prisma.store.findUnique({
      where: { userId: req.userId! },
      include: { _count: { select: { products: true, orders: true } } },
    });

    if (!store) {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      const name = user?.companyName || user?.name || 'Ma boutique';
      store = await prisma.store.create({
        data: {
          userId: req.userId!,
          name,
          slug: await ensureUniqueSlug(name),
          phone: user?.phone ?? null,
          momoPhone: user?.phone ?? null,
          momoCountry: user?.phoneCountry ?? 'bj',
          email: user?.email ?? null,
        },
        include: { _count: { select: { products: true, orders: true } } },
      });
    }

    res.json(store);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur boutique' });
  }
});

router.put('/me', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    await requireProStoreUser(req.userId!);
    const data = sanitizeStore(req.body);
    if (!data.name) { res.status(400).json({ message: 'Le nom de la boutique est obligatoire' }); return; }

    const existing = await prisma.store.findUnique({ where: { userId: req.userId! } });
    const slugSource = typeof req.body?.slug === 'string' && req.body.slug.trim() ? req.body.slug : data.name;
    const slug = await ensureUniqueSlug(slugSource, existing?.id);

    const store = await prisma.store.upsert({
      where: { userId: req.userId! },
      update: { ...data, slug },
      create: { ...data, slug, userId: req.userId! },
    });
    res.json(store);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur enregistrement boutique' });
  }
});

router.get('/me/products', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    await requireProStoreUser(req.userId!);
    const store = await prisma.store.findUnique({ where: { userId: req.userId! }, select: { id: true } });
    if (!store) { res.json([]); return; }
    const products = await prisma.storeProduct.findMany({
      where: { storeId: store.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(products);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur produits boutique' });
  }
});

router.post('/me/products', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    await requireProStoreUser(req.userId!);
    const store = await prisma.store.findUnique({ where: { userId: req.userId! }, select: { id: true } });
    if (!store) { res.status(404).json({ message: 'Créez la boutique avant d’ajouter des produits' }); return; }
    const data = sanitizeProduct(req.body);
    if (!data.name) { res.status(400).json({ message: 'Le nom du produit est obligatoire' }); return; }
    const product = await prisma.storeProduct.create({
      data: { ...data, name: data.name, storeId: store.id },
    });
    res.status(201).json(product);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur création produit' });
  }
});

router.put('/me/products/:id', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    await requireProStoreUser(req.userId!);
    const store = await prisma.store.findUnique({ where: { userId: req.userId! }, select: { id: true } });
    const product = store
      ? await prisma.storeProduct.findFirst({ where: { id: String(req.params.id), storeId: store.id }, select: { id: true } })
      : null;
    if (!product) { res.status(404).json({ message: 'Produit boutique introuvable' }); return; }
    const data = sanitizeProduct(req.body);
    if (data.name === '') { res.status(400).json({ message: 'Le nom ne peut pas être vide' }); return; }
    const updated = await prisma.storeProduct.update({ where: { id: product.id }, data });
    res.json(updated);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur modification produit' });
  }
});

router.delete('/me/products/:id', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    await requireProStoreUser(req.userId!);
    const store = await prisma.store.findUnique({ where: { userId: req.userId! }, select: { id: true } });
    const product = store
      ? await prisma.storeProduct.findFirst({ where: { id: String(req.params.id), storeId: store.id }, select: { id: true } })
      : null;
    if (!product) { res.status(404).json({ message: 'Produit boutique introuvable' }); return; }
    await prisma.storeProduct.delete({ where: { id: product.id } });
    res.status(204).send();
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur suppression produit' });
  }
});

router.get('/me/orders', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    await requireProStoreUser(req.userId!);
    const status = String(req.query.status ?? '');
    const orders = await prisma.storeOrder.findMany({
      where: {
        userId: req.userId!,
        ...(Object.values(StoreOrderStatus).includes(status as StoreOrderStatus) ? { status: status as StoreOrderStatus } : {}),
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        payment: true,
        quote: { select: { id: true, number: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur commandes boutique' });
  }
});

router.get('/me/stats', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    await requireProStoreUser(req.userId!);
    const [ordersCount, paidRows, productsCount, pendingCount] = await Promise.all([
      prisma.storeOrder.count({ where: { userId: req.userId! } }),
      prisma.storeOrder.aggregate({
        where: { userId: req.userId!, status: { in: ['PAID', 'PROCESSING', 'COMPLETED'] } },
        _sum: { total: true },
      }),
      prisma.storeProduct.count({ where: { store: { userId: req.userId! } } }),
      prisma.storeOrder.count({ where: { userId: req.userId!, status: 'PENDING_PAYMENT' } }),
    ]);
    const commissionRows = await prisma.storePayment.aggregate({
      where: { userId: req.userId! },
      _sum: { commission: true, netAmount: true },
    });
    res.json({
      ordersCount,
      productsCount,
      pendingCount,
      revenue: paidRows._sum.total ?? 0,
      commission: commissionRows._sum.commission ?? 0,
      netRevenue: commissionRows._sum.netAmount ?? 0,
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur statistiques boutique' });
  }
});

router.patch('/me/orders/:id/status', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    await requireProStoreUser(req.userId!);
    const status = String(req.body?.status ?? '');
    if (!ADMIN_STATUSES.has(status)) { res.status(400).json({ message: 'Statut invalide' }); return; }
    const order = await prisma.storeOrder.findFirst({ where: { id: String(req.params.id), userId: req.userId! } });
    if (!order) { res.status(404).json({ message: 'Commande introuvable' }); return; }
    const shouldCompleteCod = status === 'COMPLETED' && order.paymentMethod === 'COD';
    const shouldRestoreCodStock = status === 'CANCELLED' && order.paymentMethod === 'COD' && order.status !== 'CANCELLED';
    const updated = await prisma.storeOrder.update({
      where: { id: order.id },
      data: {
        status: status as StoreOrderStatus,
        ...(shouldCompleteCod ? { paidAt: new Date() } : {}),
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
      },
      include: { items: { orderBy: { sortOrder: 'asc' } }, payment: true, quote: { select: { id: true, number: true } } },
    });

    if (shouldRestoreCodStock) {
      await prisma.$transaction(async tx => {
        for (const item of updated.items) {
          if (!item.storeProductId) continue;
          const product = await tx.storeProduct.findUnique({
            where: { id: item.storeProductId },
            select: { stock: true, status: true },
          });
          if (!product) continue;
          const nextStock = (product.stock ?? 0) + item.quantity;
          await tx.storeProduct.update({
            where: { id: item.storeProductId },
            data: {
              stock: nextStock,
              ...(product.status === 'SOLD_OUT' ? { status: 'ACTIVE' as const } : {}),
            },
          });
        }
      });
    }

    if (shouldCompleteCod) {
      await createPaidQuoteForOrder(order.id);
    }

    const result = await prisma.storeOrder.findUnique({
      where: { id: order.id },
      include: { items: { orderBy: { sortOrder: 'asc' } }, payment: true, quote: { select: { id: true, number: true } } },
    });
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur statut commande' });
  }
});

// Public store
router.get('/public/:slug', async (req, res): Promise<void> => {
  const store = await prisma.store.findUnique({
    where: { slug: String(req.params.slug) },
    include: publicStoreInclude(),
  });
  if (!store || !store.active) { res.status(404).json({ message: 'Boutique introuvable' }); return; }
  res.json(store);
});

router.post('/public/:slug/checkout', async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { products: true, user: true },
  });
  if (!store || !store.active) { res.status(404).json({ message: 'Boutique introuvable' }); return; }
  if (!store.acceptsOrders) { res.status(403).json({ message: 'Cette boutique ne prend pas de commandes pour le moment' }); return; }
  if (store.user.plan === 'FREE') { res.status(403).json({ message: 'Boutique indisponible' }); return; }

  const customerName = String(req.body?.customerName ?? '').trim();
  const requestedCustomerCountry = cleanCountryCode(req.body?.customerPhoneCountry ?? store.momoCountry ?? store.phoneCountry ?? 'bj');
  const customerPhoneCountry = countryFromPhone(req.body?.customerPhone, requestedCustomerCountry);
  const customerPhone = req.body?.customerPhone ? toE164(String(req.body.customerPhone), customerPhoneCountry) : '';
  const customerEmail = typeof req.body?.customerEmail === 'string' ? req.body.customerEmail.trim().toLowerCase() : null;
  const customerCity = typeof req.body?.customerCity === 'string' ? req.body.customerCity.trim() : null;
  const customerAddress = typeof req.body?.customerAddress === 'string' ? req.body.customerAddress.trim() : null;
  const customerNote = typeof req.body?.customerNote === 'string' ? req.body.customerNote.trim() : null;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const paymentMethod = CHECKOUT_PAYMENT_METHODS.has(String(req.body?.paymentMethod)) ? String(req.body.paymentMethod) : 'ONLINE';

  if (!customerName || !customerPhone) { res.status(400).json({ message: 'Nom et téléphone client obligatoires' }); return; }
  if (items.length === 0) { res.status(400).json({ message: 'Panier vide' }); return; }
  if (!isPaymentMethodAllowed(store.paymentMode, paymentMethod)) {
    res.status(400).json({ message: 'Mode de paiement indisponible pour cette boutique' });
    return;
  }
  if (paymentMethod === 'ONLINE' && !process.env.FEDAPAY_SECRET_KEY) {
    res.status(503).json({ message: 'Paiement non configuré' });
    return;
  }

  const productMap = new Map(store.products.map(p => [p.id, p]));
  const lines: { product: StoreProduct; quantity: number; unitPrice: number }[] = [];
  for (const raw of items) {
    const productId = String(raw?.productId ?? '');
    const quantity = Math.max(1, Math.min(999, Math.floor(Number(raw?.quantity) || 1)));
    const product = productMap.get(productId);
    if (!product || product.status !== 'ACTIVE') {
      res.status(400).json({ message: 'Un produit du panier n’est plus disponible' });
      return;
    }
    if (product.trackStock && !product.allowBackorder && (product.stock ?? 0) < quantity) {
      res.status(409).json({ message: `Stock insuffisant pour ${product.name}` });
      return;
    }
    lines.push({
      product,
      quantity,
      unitPrice: Math.round(product.price),
    });
  }

  const totals = calcTotals(lines, store.taxRate);
  const number = await nextOrderNumber(store.userId);
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

  try {
    const order = await prisma.storeOrder.create({
      data: {
        number,
        storeId: store.id,
        userId: store.userId,
        customerName,
        customerPhone,
        customerPhoneCountry,
        customerEmail,
        customerCity,
        customerAddress,
        customerNote,
        paymentMethod,
        status: paymentMethod === 'COD' ? 'PROCESSING' : 'PENDING_PAYMENT',
        subtotal: totals.subtotal,
        taxRate: store.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        items: {
          create: lines.map(({ product, quantity, unitPrice }, index) => ({
            storeProductId: product.id,
            productId: product.productId,
            name: product.name,
            description: product.description,
            quantity,
            unitPrice,
            total: quantity * unitPrice,
            unit: product.unit,
            imageUrl: product.imageUrl,
            sortOrder: index,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (paymentMethod === 'COD') {
      await prisma.$transaction(async tx => {
        for (const line of lines) {
          if (!line.product.trackStock) continue;
          const nextStock = Math.max(0, (line.product.stock ?? 0) - line.quantity);
          await tx.storeProduct.update({
            where: { id: line.product.id },
            data: {
              stock: nextStock,
              ...(nextStock <= 0 && !line.product.allowBackorder ? { status: 'SOLD_OUT' as const } : {}),
            },
          });
        }
      });
      res.status(201).json({ order, paymentUrl: null, paymentMethod });
      return;
    }

    const description = `Boutique ${store.slug} — ${order.number}`;
    const txData: any = await fedapayReq('POST', '/transactions', {
      description,
      amount: Math.round(order.total),
      currency: { iso: store.currency },
      callback_url: `${frontendUrl}/store/${store.slug}/success?orderId=${order.id}`,
      customer: {
        firstname: customerName.split(' ')[0] || 'Client',
        lastname: customerName.split(' ').slice(1).join(' ') || '.',
        email: customerEmail || `client-${order.id}@nexapay.app`,
        phone_number: {
          number: e164ToLocalDigits(customerPhone, customerPhoneCountry),
          country: customerPhoneCountry,
        },
      },
    });
    const tx = getTx(txData);
    const transId = tx?.id;
    if (!transId) throw new Error('Transaction ID manquant dans la réponse Fedapay');

    const paymentUrl = await createFedapayPaymentLink(transId);
    const updated = await prisma.storeOrder.update({
      where: { id: order.id },
      data: { paymentRef: String(transId), paymentUrl },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    res.status(201).json({ order: updated, paymentUrl, transactionId: transId });
  } catch (err: any) {
    console.error('[StoreCheckout]', err.message);
    res.status(500).json({ message: `Erreur paiement : ${err.message}` });
  }
});

router.get('/orders/:orderId/public', async (req, res): Promise<void> => {
  const order = await prisma.storeOrder.findUnique({
    where: { id: String(req.params.orderId) },
    include: {
      store: { include: { user: { select: { name: true, companyName: true, email: true, phone: true, address: true, ifu: true, rccm: true, logoUrl: true, quoteLogoUrl: true, useProfilePhotoAsLogo: true, plan: true } } } },
      items: { orderBy: { sortOrder: 'asc' } },
      quote: { include: { client: true, items: { orderBy: { order: 'asc' } }, user: { select: { name: true, companyName: true, email: true, phone: true, address: true, ifu: true, rccm: true, logoUrl: true, quoteLogoUrl: true, useProfilePhotoAsLogo: true, plan: true } } } },
    },
  });
  if (!order) { res.status(404).json({ message: 'Commande introuvable' }); return; }
  res.json(order);
});

router.post('/orders/:orderId/confirm', async (req, res): Promise<void> => {
  try {
    const result = await syncStoreOrderFromFedapay(String(req.params.orderId), { force: true });
    if (result.status !== 'PAID' && !result.changed) {
      res.status(402).json({ message: `Paiement non confirmé par FedaPay (statut: ${result.fedapayStatus || 'inconnu'})` });
      return;
    }
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('[StoreConfirm]', err.message);
    res.status(err.status || 500).json({ message: `Erreur confirmation : ${err.message}` });
  }
});

export { router as storesRouter };
