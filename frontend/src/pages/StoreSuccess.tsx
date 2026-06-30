import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { storesApi } from '@/lib/api';
import { fmtDateFR, fmtXOF } from '@/lib/utils';
import type { StoreOrder } from '@/types';
import Button from '@/components/ui/Button';
import { AlertCircleIcon, CheckIcon, DownloadIcon } from '@/components/ui/Icon';
import { downloadWithTemplate, type TemplateId } from '@/components/quotes/QuotePDFTemplates';
import { buildStoreTheme, loadGoogleFonts } from '@/lib/storeTheme';

export default function StoreSuccess() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderId = params.get('orderId');
  const mode = params.get('mode');
  const qc = useQueryClient();
  const confirmed = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || confirmed.current || mode === 'cod') return;
    confirmed.current = true;
    setConfirming(true);
    storesApi
      .confirmOrder(orderId)
      .then(() => qc.invalidateQueries({ queryKey: ['public-store-order', orderId] }))
      .catch((err) => setConfirmError(err?.response?.data?.message || 'Paiement non confirmé'))
      .finally(() => setConfirming(false));
  }, [orderId]);

  const { data: order, isLoading } = useQuery<StoreOrder>({
    queryKey: ['public-store-order', orderId],
    queryFn: () => storesApi.publicOrder(orderId!).then(r => r.data),
    enabled: !!orderId,
    refetchInterval: (q) => q.state.data?.status === 'PENDING_PAYMENT' ? 5000 : false,
  });

  async function downloadReceipt() {
    if (!order?.quote || !order.store) return;
    try {
      setDownloadError(null);
      await downloadWithTemplate(order.quote, order.store.quoteTemplateId as TemplateId, order.store.user?.plan);
    } catch (err: any) {
      setDownloadError(err?.message || 'Téléchargement impossible');
    }
  }

  const isCashOnDelivery = mode === 'cod' || order?.paymentMethod === 'COD';
  const paid = !!order?.status && order.status !== 'PENDING_PAYMENT' && !isCashOnDelivery;
  const accepted = isCashOnDelivery || paid;

  useEffect(() => {
    if (order?.store?.themeFontFamily) loadGoogleFonts([order.store.themeFontFamily]);
  }, [order?.store?.themeFontFamily]);

  return (
    <div className="storefront-root min-h-screen flex items-center justify-center p-5" style={buildStoreTheme(order?.store)}>
      <div className="w-full max-w-[520px] bg-surface border border-border rounded shadow-sm p-6 text-center">
        <div className={`w-16 h-16 rounded-full mx-auto grid place-items-center mb-5 ${accepted ? 'bg-primary-soft text-primary-hover' : 'bg-warn-soft text-warn'}`}>
          {confirming || isLoading ? (
            <div className="w-7 h-7 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : accepted ? (
            <CheckIcon size={28} strokeWidth={2.4} />
          ) : (
            <AlertCircleIcon size={28} />
          )}
        </div>

        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          {isCashOnDelivery ? 'Commande envoyée' : paid ? 'Commande payée' : confirming ? 'Vérification du paiement' : 'Paiement à vérifier'}
        </h1>
        <p className="text-[14px] text-text-muted leading-relaxed mt-2">
          {isCashOnDelivery
            ? 'Votre commande a été transmise à la boutique. Le paiement se fera à la livraison.'
            : paid
            ? 'Votre achat a bien été enregistré. Vous pouvez télécharger votre reçu.'
            : 'Nous vérifions la transaction auprès de FedaPay. Cette page se mettra à jour automatiquement.'}
        </p>

        {confirmError && (
          <div className="mt-4 p-3 rounded bg-danger-soft border border-danger/25 text-danger text-[12.5px] text-left">
            {confirmError}
          </div>
        )}

        {order && (
          <div className="mt-5 border border-border rounded p-4 text-left">
            <div className="flex justify-between gap-3 mb-3">
              <div>
                <div className="font-mono text-[12px] text-text-muted">{order.number}</div>
                <div className="text-[15px] font-semibold">{order.store?.name}</div>
              </div>
              <div className="font-mono text-[16px] font-semibold text-primary-hover">{fmtXOF(order.total)}</div>
            </div>
            <div className="flex flex-col gap-2">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate">{item.quantity} × {item.name}</span>
                  <span className="font-mono">{fmtXOF(item.total)}</span>
                </div>
              ))}
            </div>
            {isCashOnDelivery && (
              <div className="text-[12px] text-text-muted mt-3">Paiement prévu à la livraison.</div>
            )}
            {order.paidAt && (
              <div className="text-[12px] text-text-muted mt-3">Payée le {fmtDateFR(order.paidAt)}</div>
            )}
          </div>
        )}

        {downloadError && (
          <div className="mt-3 text-[12.5px] text-danger">{downloadError}</div>
        )}

        <div className="flex gap-2 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => navigate(`/store/${slug}`)}>
            Retour boutique
          </Button>
          <Button
            variant="primary"
            className="flex-[1.4]"
            style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
            onClick={downloadReceipt}
            disabled={!paid || !order?.quote}
          >
            <DownloadIcon size={15} /> Télécharger le reçu
          </Button>
        </div>
      </div>
    </div>
  );
}
