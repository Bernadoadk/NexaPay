import { prisma } from './prisma';
import { generateQuoteNumber } from '../utils/quoteNumber';
import { NotificationService } from './notificationService';
import { logActivity } from './activityLog';
import { notifyPayoutCompleted, notifyPayoutFailed, notifyStockOut } from './notificationEvents';
import { fedapayReq, fedapayTransfer, getTx, getTxAmount } from './fedapay';

const lastChecked = new Map<string, number>();
const THROTTLE_MS = 5_000;

function expectedDescription(order: { number: string; store: { slug: string } }) {
  return `Boutique ${order.store.slug} — ${order.number}`;
}

function assertStoreTransactionMatches(tx: any, expectedAmount: number, expected: string) {
  const txAmount = getTxAmount(tx);
  const txDescription = String(tx?.description ?? '');
  if (txAmount !== expectedAmount || txDescription !== expected) {
    throw Object.assign(new Error('Transaction FedaPay incohérente avec la commande'), { status: 400 });
  }
}

export async function createPaidQuoteForOrder(orderId: string) {
  const order = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    include: {
      store: { include: { user: true } },
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!order) throw new Error('Commande introuvable');
  if (order.quoteId) return order.quoteId;

  const existingClient = order.customerEmail
    ? await prisma.client.findFirst({
        where: { userId: order.userId, email: order.customerEmail },
        select: { id: true },
      })
    : null;

  const client = existingClient
    ? existingClient
    : await prisma.client.create({
        data: {
          userId: order.userId,
          name: order.customerName,
          contact: order.customerName,
          email: order.customerEmail || null,
          phone: order.customerPhone,
          phoneCountry: order.customerPhoneCountry || 'bj',
          city: order.customerCity || null,
          address: order.customerAddress || null,
        },
        select: { id: true },
      });

  let quote;
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = await generateQuoteNumber(order.userId);
    try {
      quote = await prisma.quote.create({
        data: {
          number,
          title: `${order.store.receiptTitle} — ${order.number}`,
          status: 'PAID',
          notes: `Commande boutique ${order.number}${order.customerNote ? ` — ${order.customerNote}` : ''}`,
          taxRate: order.taxRate,
          discount: 0,
          subtotal: order.subtotal,
          taxAmount: order.taxAmount,
          total: order.total,
          validDays: 0,
          paidAt: order.paidAt ?? new Date(),
          paymentRef: order.paymentRef,
          paidViaLink: order.paymentMethod !== 'COD',
          clientId: client.id,
          userId: order.userId,
          items: {
            create: order.items.map((item, index) => ({
              description: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              unit: item.unit ?? undefined,
              order: index,
              productId: item.productId ?? undefined,
            })),
          },
        },
      });
      break;
    } catch (err: any) {
      if (err?.code === 'P2002' && attempt < 2) continue;
      throw err;
    }
  }

  if (!quote) throw new Error('Création du reçu impossible');
  await prisma.storeOrder.update({
    where: { id: order.id },
    data: { quoteId: quote.id },
  });
  return quote.id;
}

export interface StoreSyncResult {
  changed: boolean;
  status: string;
  fedapayStatus?: string;
  skipped?: 'throttled' | 'no-paymentref' | 'no-api-key' | 'not-pending';
}

export async function syncStoreOrderFromFedapay(
  orderId: string,
  opts: { force?: boolean } = {},
): Promise<StoreSyncResult> {
  const order = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    include: {
      store: { select: { slug: true, commissionRate: true, momoPhone: true, momoCountry: true } },
      items: true,
    },
  });
  if (!order) return { changed: false, status: 'NOT_FOUND' };
  if (order.status !== 'PENDING_PAYMENT') return { changed: false, status: order.status, skipped: 'not-pending' };
  if (!order.paymentRef) return { changed: false, status: order.status, skipped: 'no-paymentref' };
  if (!process.env.FEDAPAY_SECRET_KEY) return { changed: false, status: order.status, skipped: 'no-api-key' };

  if (!opts.force) {
    const last = lastChecked.get(order.id) || 0;
    if (Date.now() - last < THROTTLE_MS) {
      return { changed: false, status: order.status, skipped: 'throttled' };
    }
  }
  lastChecked.set(order.id, Date.now());

  let fedapayStatus = '';
  try {
    const txData: any = await fedapayReq('GET', `/transactions/${order.paymentRef}`);
    const tx = getTx(txData);
    fedapayStatus = tx?.status ?? '';
    if (fedapayStatus === 'approved') {
      assertStoreTransactionMatches(tx, Math.round(order.total), expectedDescription(order));
    }
  } catch (err: any) {
    console.error(`[syncStoreOrder] Fedapay GET ${order.paymentRef} échec:`, err.message);
    return { changed: false, status: order.status, fedapayStatus: 'error' };
  }

  if (fedapayStatus !== 'approved') {
    return { changed: false, status: order.status, fedapayStatus };
  }

  const claimed = await prisma.storeOrder.updateMany({
    where: { id: order.id, status: 'PENDING_PAYMENT' },
    data: { status: 'PAID', paidAt: new Date() },
  });
  if (claimed.count === 0) return { changed: false, status: 'PAID', fedapayStatus };

  const depletedProducts: { id: string; name: string }[] = [];
  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (!item.storeProductId) continue;
      const product = await tx.storeProduct.findUnique({
        where: { id: item.storeProductId },
        select: { trackStock: true, stock: true, allowBackorder: true },
      });
      if (!product?.trackStock) continue;
      const nextStock = Math.max(0, (product.stock ?? 0) - item.quantity);
      await tx.storeProduct.update({
        where: { id: item.storeProductId },
        data: {
          stock: nextStock,
          ...(nextStock <= 0 && !product.allowBackorder ? { status: 'SOLD_OUT' as const } : {}),
        },
      });
      if (nextStock <= 0) depletedProducts.push({ id: item.storeProductId, name: item.name });
    }
  });

  const quoteId = await createPaidQuoteForOrder(order.id);
  console.log(`[syncStoreOrder] Commande ${order.number} → PAID, reçu ${quoteId} (tx ${order.paymentRef})`);

  await NotificationService.createNotification(
    order.userId,
    'order_received',
    'Nouvelle commande payée',
    `La commande ${order.number} a été payée (${Math.round(order.total).toLocaleString('fr-FR')} FCFA).`,
    { orderId: order.id, quoteId },
  ).catch((err) => console.error('[syncStoreOrder] Notification échouée:', err?.message ?? err));

  logActivity(order.userId, 'order_paid', { orderId: order.id, total: order.total });

  for (const product of depletedProducts) {
    await notifyStockOut(order.userId, product.id, product.name).catch(() => {});
  }

  const existingPayment = await prisma.storePayment.findUnique({ where: { orderId: order.id } });
  if (!existingPayment) {
    const grossAmount = Math.round(order.total);
    const commission = Math.round(grossAmount * order.store.commissionRate);
    const netAmount = grossAmount - commission;

    const payment = await prisma.storePayment.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        grossAmount,
        commission,
        netAmount,
        status: 'PENDING',
        fedapayTxId: String(order.paymentRef),
      },
    });

    if (order.store.momoPhone) {
      try {
        await prisma.storePayment.update({ where: { id: payment.id }, data: { status: 'TRANSFERRING' } });
        const transferId = await fedapayTransfer(
          order.store.momoPhone,
          order.store.momoCountry || 'bj',
          netAmount,
          `Reversement boutique ${order.number}`,
          { emailPrefix: 'store-payout' },
        );
        await prisma.storePayment.update({
          where: { id: payment.id },
          data: { status: 'TRANSFERRED', transferId: String(transferId), transferredAt: new Date() },
        });
        await notifyPayoutCompleted(order.userId, netAmount, order.number, {
          orderId: order.id,
        }).catch(() => {});
      } catch (transferErr: any) {
        console.error('[syncStoreOrder] Erreur reversement:', transferErr.message);
        await prisma.storePayment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failReason: transferErr.message },
        });
        await notifyPayoutFailed(order.userId, netAmount, order.number, transferErr.message, {
          orderId: order.id,
        }).catch(() => {});
      }
    }
  }

  return { changed: true, status: 'PAID', fedapayStatus };
}
