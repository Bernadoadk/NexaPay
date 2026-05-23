import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api';
import { fmtXOF, fmtDateFR } from '@/lib/utils';
import type { Quote } from '@/types';
import { useEntrance } from '@/hooks/useAnime';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get('quoteId');
  const qc = useQueryClient();
  const confirmed = useRef(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteId || confirmed.current) return;
    confirmed.current = true;
    paymentsApi
      .confirmQuote(quoteId)
      .then(() => qc.invalidateQueries({ queryKey: ['pay-quote', quoteId] }))
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || 'Erreur inconnue';
        console.error('[PaymentSuccess] confirmQuote échoué:', msg);
        setConfirmError(msg);
      });
  }, [quoteId]);

  const { data: quote } = useQuery<Quote>({
    queryKey: ['pay-quote', quoteId],
    queryFn: () => paymentsApi.quote(quoteId!).then(r => r.data),
    enabled: !!quoteId,
  });

  const total = quote ? quote.subtotal * (1 + quote.taxRate / 100) : 0;

  const iconRef = useEntrance<HTMLDivElement>('popIn', { duration: 600 });
  const titleRef = useEntrance<HTMLDivElement>('fadeInUp', { delay: 280 });
  const cardRef = useEntrance<HTMLDivElement>('fadeInUp', { delay: 420 });

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-[420px] text-center">
        {/* Success icon */}
        <div ref={iconRef} className="w-16 h-16 bg-[#DCFCE7] rounded-full flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#14532D" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div ref={titleRef} className="text-[22px] font-semibold tracking-[-0.02em] mb-2">Paiement reçu !</div>
        <div className="text-text-muted text-[14px] leading-relaxed mb-6">
          Votre paiement a bien été enregistré.{' '}
          {quote && <>Un reçu sera transmis à <strong>{quote.client?.email || quote.user?.email}</strong>.</>}
        </div>
        {confirmError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-[12px] text-red-700 text-left">
            Erreur de confirmation : {confirmError}
          </div>
        )}

        {quote && (
          <div ref={cardRef} className="bg-surface border border-border rounded shadow-sm p-5 text-left mb-6">
            <div className="text-[12px] text-text-muted font-mono mb-1">{quote.number}</div>
            <div className="text-[15px] font-semibold mb-3">{quote.title}</div>
            <div className="flex justify-between text-[13px]">
              <span className="text-text-muted">Montant réglé</span>
              <span className="font-mono font-semibold text-primary">{fmtXOF(total)}</span>
            </div>
            {quote.paidAt && (
              <div className="flex justify-between text-[13px] mt-1.5">
                <span className="text-text-muted">Date</span>
                <span>{fmtDateFR(quote.paidAt)}</span>
              </div>
            )}
          </div>
        )}

        <div className="text-[12px] text-text-subtle">
          Merci de votre confiance · Propulsé par{' '}
          <span className="font-semibold text-text-muted">NexaPay</span>
        </div>
      </div>
    </div>
  );
}
