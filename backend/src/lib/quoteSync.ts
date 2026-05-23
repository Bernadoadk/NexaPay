import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FEDAPAY_BASE = process.env.FEDAPAY_ENV === 'live'
  ? 'https://api.fedapay.com/v1'
  : 'https://sandbox-api.fedapay.com/v1';

const COMMISSION_RATE = 0.03;

// In-memory throttle: { quoteId → last-check timestamp (ms) }.
// Prevents hammering Fedapay when the freelancer's UI polls every 8 s.
const lastChecked = new Map<string, number>();
const THROTTLE_MS = 5_000;

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

async function fedapayTransfer(phone: string, country: string, amount: number, description: string) {
  const txData: any = await fedapayReq('POST', '/transfers', {
    amount,
    description,
    currency: { iso: 'XOF' },
    phone_number: { number: phone.replace(/\s/g, ''), country },
  });
  const transfer = txData?.['v1/transfer'] ?? txData?.v1?.transfer ?? txData;
  const transferId = transfer?.id;
  if (!transferId) throw new Error('Transfer ID manquant dans la réponse Fedapay');
  await fedapayReq('PUT', `/transfers/${transferId}/send`, {});
  return transferId;
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
    const tx = txData?.['v1/transaction'] ?? txData?.v1?.transaction ?? txData;
    fedapayStatus = tx?.status ?? '';
  } catch (err: any) {
    console.error(`[syncQuote] Fedapay GET ${quote.paymentRef} échec:`, err.message);
    return { changed: false, status: quote.status, fedapayStatus: 'error' };
  }

  if (fedapayStatus !== 'approved') {
    return { changed: false, status: quote.status, fedapayStatus };
  }

  // ---- Approved: flip to PAID and create the Payment record (idempotent).
  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: 'PAID', paidAt: new Date(), paidViaLink: true },
  });
  console.log(`[syncQuote] Devis ${quote.number} → PAID (tx ${quote.paymentRef})`);

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
      } catch (transferErr: any) {
        console.error('[syncQuote] Erreur reversement:', transferErr.message);
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failReason: transferErr.message },
        });
      }
    } else {
      console.log(`[syncQuote] Pas de téléphone configuré — reversement ignoré (${quote.number})`);
    }
  }

  return { changed: true, status: 'PAID', fedapayStatus };
}
