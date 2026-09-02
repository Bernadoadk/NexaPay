/**
 * Accès à l'API FedaPay — encaissements et reversements Mobile Money.
 *
 * Ce module remplace les copies de `fedapayReq` / `getTx` / `fedapayTransfer`
 * qui vivaient en double dans les routes paiements, crédits, boutique et dans
 * les deux fichiers de synchronisation.
 */

export const FEDAPAY_BASE = process.env.FEDAPAY_ENV === 'live'
  ? 'https://api.fedapay.com/v1'
  : 'https://sandbox-api.fedapay.com/v1';

/**
 * Modes de reversement tentés dans l'ordre.
 *
 * FedaPay exige le bon opérateur : un numéro Moov envoyé en `mtn_open` échoue.
 * Plutôt que de maintenir une table de préfixes béninois (qui a changé avec le
 * passage à 10 chiffres), on essaie les modes successivement — la première
 * réponse acceptée gagne. Surchargeable via FEDAPAY_PAYOUT_MODES.
 */
export const PAYOUT_MODES: string[] = (process.env.FEDAPAY_PAYOUT_MODES || 'mtn_open,moov_open')
  .split(',')
  .map((mode) => mode.trim())
  .filter(Boolean);

export async function fedapayReq(method: string, path: string, body?: object) {
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

/** L'API enveloppe ses objets ('v1/transaction') de façon inconstante selon l'endpoint. */
export function getTx(data: any) {
  return data?.['v1/transaction'] ?? data?.v1?.transaction ?? data;
}

export function getCustomerEmail(tx: any): string {
  return String(tx?.customer?.email ?? tx?.customer_email ?? '').toLowerCase();
}

export function getTxAmount(tx: any): number {
  return Number(tx?.amount ?? tx?.amount_debited ?? tx?.amount_transferred ?? 0);
}

export async function createFedapayPaymentLink(transactionId: string | number): Promise<string> {
  const tokenData: any = await fedapayReq('POST', `/transactions/${transactionId}/token`);
  const paymentUrl = tokenData?.url ?? tokenData?.payment_url;
  if (!paymentUrl) throw new Error('Lien de paiement FedaPay manquant');
  return String(paymentUrl);
}

export async function getApprovedFedapayTransaction(transactionId: string | number) {
  const txData: any = await fedapayReq('GET', `/transactions/${transactionId}`);
  const tx = getTx(txData);
  if (tx?.status !== 'approved') {
    throw Object.assign(
      new Error(`Transaction non approuvée (statut: ${tx?.status || 'inconnu'})`),
      { status: 402 },
    );
  }
  return tx;
}

async function startPayout(
  mode: string,
  phone: string,
  country: string,
  amount: number,
  description: string,
  emailPrefix: string,
): Promise<string> {
  const payoutData: any = await fedapayReq('POST', '/payouts', {
    amount,
    description,
    mode,
    currency: { iso: 'XOF' },
    customer: {
      firstname: 'NexaPay',
      lastname: 'Merchant',
      email: `${emailPrefix}-${phone.replace(/\D/g, '')}@nexapay.app`,
      phone_number: { number: phone, country },
    },
  });
  const payout = payoutData?.['v1/payout'] ?? payoutData?.v1?.payout ?? payoutData;
  const payoutId = payout?.id;
  if (!payoutId) throw new Error('Payout ID manquant dans la réponse Fedapay');

  const startedData: any = await fedapayReq('PUT', '/payouts/start', [{
    id: payoutId,
    phone_number: { number: phone, country },
  }]);
  const started = Array.isArray(startedData) ? startedData[0] : startedData?.[0] ?? startedData;
  return String(started?.id ?? payoutId);
}

/**
 * Reverse un montant sur un numéro Mobile Money, en essayant chaque opérateur
 * supporté. Lève la dernière erreur si aucun mode n'aboutit.
 */
export async function fedapayTransfer(
  phone: string,
  country: string,
  amount: number,
  description: string,
  options: { emailPrefix?: string } = {},
): Promise<string> {
  const cleanPhone = phone.replace(/\s/g, '');
  const emailPrefix = options.emailPrefix ?? 'payout';
  let lastError: unknown;

  for (const mode of PAYOUT_MODES) {
    try {
      return await startPayout(mode, cleanPhone, country, amount, description, emailPrefix);
    } catch (err) {
      lastError = err;
      console.warn(`[Fedapay] Reversement en ${mode} refusé:`, (err as Error)?.message);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Reversement refusé par FedaPay');
}
