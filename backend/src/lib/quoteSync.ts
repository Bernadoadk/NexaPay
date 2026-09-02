import { prisma } from './prisma';
import { NotificationService } from './notificationService';
import { logActivity } from './activityLog';
import { notifyPayoutCompleted, notifyPayoutFailed } from './notificationEvents';
import { fedapayReq, fedapayTransfer, getTx, getTxAmount } from './fedapay';

// Commission prélevée sur les encaissements par lien de paiement.
// Surchargeable pour aligner sur la commission boutique (Store.commissionRate).
const COMMISSION_RATE = Number(process.env.QUOTE_COMMISSION_RATE ?? 0.03);

// In-memory throttle: { quoteId → last-check timestamp (ms) }.
// Prevents hammering Fedapay when the freelancer's UI polls every 8 s.
const lastChecked = new Map<string, number>();
const THROTTLE_MS = 5_000;

function assertQuoteTransactionMatches(tx: any, expectedAmount: number, expectedDescription: string) {
  const txAmount = getTxAmount(tx);
  const txDescription = String(tx?.description ?? '');
  if (txAmount !== expectedAmount || txDescription !== expectedDescription) {
    throw Object.assign(
      new Error('Transaction FedaPay incohérente avec le devis'),
      { status: 400 },
    );
  }
}

export interface SyncResult {
  changed: boolean;            // true if status moved to PAID in this call
  status: string;              // final status
  fedapayStatus?: string;      // raw fedapay status
  skipped?: 'throttled' | 'no-paymentref' | 'no-api-key' | 'not-sent';
}

/**
 * Idempotent. Queries Fedapay for the latest status of a quote's payment link,
 * and if approved, marks the quote PAID and triggers the reversement.
 *
 * Called from:
 *   - the public webhook (Fedapay → backend)
 *   - the customer's PaymentSuccess page (after Fedapay redirect)
 *   - the freelancer's QuoteDetail page (auto + manual "vérifier")
 */
export async function syncQuoteFromFedapay(
  quoteId: string,
  opts: { force?: boolean } = {},
): Promise<SyncResult> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { user: { select: { phone: true, phoneCountry: true } } },
  });
  if (!quote) return { changed: false, status: 'NOT_FOUND' };
  if (quote.status === 'PAID') return { changed: false, status: 'PAID' };
  if (quote.status !== 'SENT') return { changed: false, status: quote.status, skipped: 'not-sent' };
  if (!quote.paymentRef) return { changed: false, status: quote.status, skipped: 'no-paymentref' };
  if (!process.env.FEDAPAY_SECRET_KEY) return { changed: false, status: quote.status, skipped: 'no-api-key' };

  // Throttle: skip if we just checked.
  if (!opts.force) {
    const last = lastChecked.get(quoteId) || 0;
    if (Date.now() - last < THROTTLE_MS) {
      return { changed: false, status: quote.status, skipped: 'throttled' };
    }
  }
  lastChecked.set(quoteId, Date.now());

  let fedapayStatus = '';
  try {
    const txData: any = await fedapayReq('GET', `/transactions/${quote.paymentRef}`);
    const tx = getTx(txData);
    fedapayStatus = tx?.status ?? '';
    if (fedapayStatus === 'approved') {
      assertQuoteTransactionMatches(
        tx,
        Math.round(quote.total),
        `${quote.number} — ${quote.title}`,
      );
    }
  } catch (err: any) {
    console.error(`[syncQuote] Fedapay GET ${quote.paymentRef} échec:`, err.message);
    return { changed: false, status: quote.status, fedapayStatus: 'error' };
  }

  if (fedapayStatus !== 'approved') {
    return { changed: false, status: quote.status, fedapayStatus };
  }

  // ---- Approved: flip to PAID once. If webhook + redirect confirm at the
  // same time, only the first caller continues to create the payout.
  const claimed = await prisma.quote.updateMany({
    where: { id: quote.id, status: { not: 'PAID' } },
    data: { status: 'PAID', paidAt: new Date(), paidViaLink: true },
  });
  if (claimed.count === 0) {
    return { changed: false, status: 'PAID', fedapayStatus };
  }
  console.log(`[syncQuote] Devis ${quote.number} → PAID (tx ${quote.paymentRef})`);

  await NotificationService.createNotification(
    quote.userId,
    'payment_received',
    'Paiement reçu',
    `Le paiement de votre devis ${quote.number} a été reçu.`,
    { quoteId: quote.id }
  );

  logActivity(quote.userId, 'payment_received', { quoteId: quote.id, total: quote.total });

  // Payment row: skip if already exists for this quote (quoteId is unique).
  const existingPayment = await prisma.payment.findUnique({
    where: { quoteId: quote.id },
  });

  if (!existingPayment) {
    const grossAmount = Math.round(quote.total);
    const commission = Math.round(grossAmount * COMMISSION_RATE);
    const netAmount = grossAmount - commission;

    const payment = await prisma.payment.create({
      data: {
        quoteId: quote.id,
        userId: quote.userId,
        grossAmount,
        commission,
        netAmount,
        status: 'PENDING',
        fedapayTxId: String(quote.paymentRef),
      },
    });

    if (quote.user?.phone) {
      try {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'TRANSFERRING' } });
        const transferId = await fedapayTransfer(
          quote.user.phone,
          quote.user.phoneCountry || 'bj',
          netAmount,
          `Reversement devis ${quote.number}`,
        );
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'TRANSFERRED', transferId: String(transferId), transferredAt: new Date() },
        });
        console.log(`[syncQuote] Reversement ${netAmount} XOF effectué pour ${quote.number}`);
        await notifyPayoutCompleted(quote.userId, netAmount, quote.number, {
          quoteId: quote.id,
          paymentId: payment.id,
        }).catch(() => {});
      } catch (transferErr: any) {
        console.error('[syncQuote] Erreur reversement:', transferErr.message);
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failReason: transferErr.message },
        });
        await notifyPayoutFailed(quote.userId, netAmount, quote.number, transferErr.message, {
          quoteId: quote.id,
          paymentId: payment.id,
        }).catch(() => {});
      }
    } else {
      console.log(`[syncQuote] Pas de téléphone configuré — reversement ignoré (${quote.number})`);
      await notifyPayoutFailed(
        quote.userId,
        netAmount,
        quote.number,
        'aucun numéro Mobile Money enregistré',
        { quoteId: quote.id, paymentId: payment.id },
      ).catch(() => {});
    }
  }

  return { changed: true, status: 'PAID', fedapayStatus };
}
