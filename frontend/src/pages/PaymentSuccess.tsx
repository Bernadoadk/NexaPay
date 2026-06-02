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
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteId || confirmed.current) return;
    confirmed.current = true;
    setIsConfirming(true);
    paymentsApi
      .confirmQuote(quoteId)
      .then(() => {
        setIsConfirmed(true);
        return qc.invalidateQueries({ queryKey: ['pay-quote', quoteId] });
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || 'Erreur inconnue';
        console.error('[PaymentSuccess] confirmQuote échoué:', msg);
        setConfirmError(msg);
      })
      .finally(() => setIsConfirming(false));
  }, [quoteId]);

  const { data: quote } = useQuery<Quote>({
    queryKey: ['pay-quote', quoteId],
    queryFn: () => paymentsApi.quote(quoteId!).then(r => r.data),
    enabled: !!quoteId,
  });

  const total = quote ? quote.total : 0;

  const iconRef = useEntrance<HTMLDivElement>('popIn', { duration: 600 });
  const titleRef = useEntrance<HTMLDivElement>('fadeInUp', { delay: 280 });
  const cardRef = useEntrance<HTMLDivElement>('fadeInUp', { delay: 420 });

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-[420px] text-center">
        <div
          ref={iconRef}
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
            isConfirmed
              ? 'bg-[#DCFCE7]'
              : isConfirming
                ? 'bg-blue-soft'
                : 'bg-red-50'
          }`}
        >
          {isConfirmed ? (
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#14532D" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : isConfirming ? (
            <div className="w-7 h-7 rounded-full border-2 border-blue border-t-transparent animate-spin" />
          ) : (
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#B91C1C" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          )}
        </div>

        <div ref={titleRef} className="text-[22px] font-semibold tracking-[-0.02em] mb-2">
          {isConfirmed ? 'Paiement reçu !' : isConfirming ? 'Vérification du paiement…' : 'Paiement à vérifier'}
        </div>
        <div className="text-text-muted text-[14px] leading-relaxed mb-6">
          {isConfirmed ? (
            <>
              Votre paiement a bien été enregistré.{' '}
              {quote && <>Un reçu sera transmis à <strong>{quote.client?.email || quote.user?.email}</strong>.</>}
            </>
          ) : isConfirming ? (
            <>Nous confirmons la transaction auprès de FedaPay. Cette étape peut prendre quelques secondes.</>
          ) : (
            <>La transaction n'a pas encore pu être confirmée automatiquement.</>
          )}
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
