import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api';
import { fmtXOF, fmtDateFR } from '@/lib/utils';
import type { Quote } from '@/types';

function LogoMark() {
  return (
    <div className="w-9 h-9 rounded-[10px] bg-primary grid place-items-center text-white flex-shrink-0">
      <span className="text-[15px] font-bold">D</span>
    </div>
  );
}

export default function PaymentPage() {
  const { quoteId } = useParams<{ quoteId: string }>();

  const { data: quote, isLoading, isError } = useQuery<Quote>({
    queryKey: ['pay-quote', quoteId],
    queryFn: () => paymentsApi.quote(quoteId!).then(r => r.data),
    enabled: !!quoteId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <div className="text-center p-8">
          <div className="text-[18px] font-semibold mb-2">Devis introuvable</div>
          <div className="text-text-muted text-[14px]">Ce lien de paiement n'est plus valide.</div>
        </div>
      </div>
    );
  }

  const isPaid = quote.status === 'PAID';
  const { client, user, items = [] } = quote;
  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const tvaAmount = subtotal * (quote.taxRate / 100);
  const total = subtotal + tvaAmount;

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border px-5 py-4 flex items-center gap-3">
        <LogoMark />
        <div className="leading-[1.15]">
          <div className="font-semibold text-[14px]">{user?.companyName || user?.name}</div>
          <div className="text-[11px] text-text-muted">Paiement sécurisé via Fedapay</div>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 flex items-start justify-center p-5 pt-8">
        <div className="w-full max-w-[520px] flex flex-col gap-4">

          {/* Status banner */}
          {isPaid && (
            <div className="bg-[#DCFCE7] border border-[#86EFAC] text-[#14532D] rounded-sm px-4 py-3 text-[13.5px] font-medium flex items-center gap-2">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Ce devis a déjà été réglé. Merci !
            </div>
          )}

          {/* Quote card */}
          <div className="bg-surface border border-border rounded shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-text-muted font-mono">{quote.number}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  isPaid ? 'bg-[#DCFCE7] text-[#14532D]' : 'bg-blue-soft text-blue'
                }`}>
                  {isPaid ? 'Payé' : 'En attente'}
                </span>
              </div>
              <div className="text-[17px] font-semibold leading-snug">{quote.title}</div>
              {client && (
                <div className="text-[13px] text-text-muted mt-1">
                  {client.name}{client.contact ? ` · ${client.contact}` : ''}
                </div>
              )}
              <div className="text-[12px] text-text-muted mt-0.5">
                Émis le {fmtDateFR(quote.issuedAt)}
              </div>
            </div>

            {/* Items */}
            <div className="px-6 py-4 flex flex-col gap-2.5">
              {items.map((it, i) => (
                <div key={i} className="flex justify-between text-[13px]">
                  <div className="flex-1 pr-4">
                    <div>{it.description}</div>
                    {it.unitPrice > 0 && (
                      <div className="text-text-muted text-[12px]">{it.quantity} × {fmtXOF(it.unitPrice)}</div>
                    )}
                  </div>
                  <div className="font-mono font-semibold">{it.total > 0 ? fmtXOF(it.total) : 'Inclus'}</div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="px-6 py-4 bg-surface-2 border-t border-border flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-text-muted">Sous-total HT</span>
                <span className="font-mono">{fmtXOF(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-text-muted">TVA {quote.taxRate}%</span>
                <span className="font-mono">{fmtXOF(tvaAmount)}</span>
              </div>
              <div className="flex justify-between text-[15px] font-semibold mt-1 pt-2 border-t border-border">
                <span>Total TTC</span>
                <span className="font-mono text-primary">{fmtXOF(total)}</span>
              </div>
            </div>
          </div>

          {/* Pay button */}
          {!isPaid && quote.paymentUrl ? (
            <div className="flex flex-col gap-2">
              <a
                href={quote.paymentUrl}
                className="block w-full bg-primary hover:bg-primary-hover text-white text-[14.5px] font-semibold rounded-sm py-3.5 text-center transition-colors shadow-sm"
              >
                Payer {fmtXOF(total)}
              </a>
              <div className="text-center text-[11.5px] text-text-muted">
                Mobile Money · Carte bancaire (Visa, Mastercard)
              </div>
            </div>
          ) : !isPaid ? (
            <div className="text-center text-[13px] text-text-muted p-4 bg-surface border border-border rounded">
              Le lien de paiement n'est pas encore disponible. Contactez {user?.name} pour régulariser.
            </div>
          ) : null}

          {/* Methods */}
          {!isPaid && (
            <div className="text-center">
              <div className="text-[11.5px] text-text-muted mb-2">Méthodes acceptées</div>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { label: 'MTN MoMo', kind: 'momo' },
                  { label: 'Moov Money', kind: 'momo' },
                  { label: 'Wave', kind: 'momo' },
                  { label: 'Orange Money', kind: 'momo' },
                  { label: 'Celtiis Cash', kind: 'momo' },
                  { label: 'Visa', kind: 'card' },
                  { label: 'Mastercard', kind: 'card' },
                ].map(m => (
                  <span
                    key={m.label}
                    className={`text-[11px] px-2.5 py-1 rounded-full border ${
                      m.kind === 'card'
                        ? 'bg-blue-soft border-blue/20 text-blue'
                        : 'bg-surface border-border text-text-muted'
                    }`}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Secured by */}
          <div className="text-center text-[11px] text-text-subtle mt-1">
            Paiement sécurisé · Propulsé par{' '}
            <span className="font-semibold text-text-muted">Fedapay</span>
          </div>
        </div>
      </main>
    </div>
  );
}
