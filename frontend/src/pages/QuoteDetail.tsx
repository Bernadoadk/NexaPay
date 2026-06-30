import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi, paymentsApi, quoteTemplatesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { fmtXOF, fmtDateFR, validUntil } from '@/lib/utils';
import type { Quote } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import TemplateSelectorModal from '@/components/quotes/TemplateSelectorModal';
import SaveQuoteTemplateModal, { type SaveQuoteTemplateMeta } from '@/components/quotes/SaveQuoteTemplateModal';
import ContextMenu from '@/components/ui/ContextMenu';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  ChevronLeftIcon, CopyIcon, EditIcon, MailIcon, DownloadIcon,
  SendIcon, PhoneIcon, TrashIcon, MoreIcon,
} from '@/components/ui/Icon';
import { Check } from 'lucide-react';

function Timeline({ events }: { events: { dot: string; title: string; time: string }[] }) {
  return (
    <div className="flex flex-col gap-3.5 relative">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3 relative">
          <div className="relative w-2">
            <div className="w-2 h-2 rounded-full mt-1" style={{ background: e.dot }} />
            {i < events.length - 1 && (
              <div className="absolute left-[3.5px] top-3.5 bottom-[-14px] w-px bg-border" />
            )}
          </div>
          <div className="flex-1 leading-[1.3]">
            <div className="text-[13px]">{e.title}</div>
            <div className="text-[11.5px] text-text-muted mt-0.5">{e.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}


export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: authUser } = useAuth();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSendTemplateModal, setShowSendTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const { data: quote, isLoading, isFetching } = useQuery<Quote>({
    queryKey: ['quote', id],
    queryFn: () => quotesApi.get(id!).then(r => r.data),
    enabled: !!id,
    // Poll more aggressively when a payment link is waiting for the client.
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d || d.status !== 'SENT') return false;
      return d.paymentRef ? 6000 : 12000;
    },
    refetchOnWindowFocus: true,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => quotesApi.updateStatus(id!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quote', id] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['notif-quotes'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => quotesApi.duplicate(id!),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      navigate(`/quotes/${res.data.id}`);
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (meta: SaveQuoteTemplateMeta) => quoteTemplatesApi.createFromQuote(id!, meta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quote-templates'] });
      setShowSaveTemplateModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => quotesApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/quotes');
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () => paymentsApi.initiate(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quote', id] });
    },
  });

  const [checkFeedback, setCheckFeedback] = useState<null | 'paid' | 'pending'>(null);
  const checkPaymentMutation = useMutation({
    mutationFn: () => quotesApi.checkPayment(id!),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quote', id] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['notif-quotes'] });
      setCheckFeedback(res.data?.changed ? 'paid' : 'pending');
      setTimeout(() => setCheckFeedback(null), 4000);
    },
  });

  useEffect(() => {
    if (quote && searchParams.get('send') === '1') {
      setShowSendTemplateModal(true);
      navigate(`/quotes/${id}`, { replace: true });
    }
  }, [quote, searchParams, navigate, id]);

  if (isLoading || !quote) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const { client, user, items = [] } = quote;
  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const tvaAmount = subtotal * (quote.taxRate / 100);
  const total = subtotal + tvaAmount;
  const issuedDate = fmtDateFR(quote.issuedAt);
  const validDate = validUntil(quote.issuedAt, quote.validDays);

  const shareUrl = `${window.location.origin}/pay/${id}`;
  const awaitingPayment = quote.status === 'SENT' && !!quote.paymentRef;
  const displayStatus = awaitingPayment ? 'AWAITING' : quote.status;
  const canUseMomo = authUser?.plan === 'PRO' || authUser?.plan === 'BUSINESS';

  const whatsappMessage = encodeURIComponent(
    `Bonjour ${client?.contact || client?.name || ''}, voici le devis ${quote.number} — ${quote.title} (${fmtXOF(total)}). Lien de paiement MoMo / carte bancaire : ${shareUrl}`,
  );
  const whatsappHref = client?.phone
    ? `https://wa.me/${client.phone.replace(/[^0-9]/g, '')}?text=${whatsappMessage}`
    : `https://wa.me/?text=${whatsappMessage}`;

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!quote) return;
    const confirmed = await confirm({
      eyebrow: 'Suppression définitive',
      title: `Supprimer le devis ${quote.number} ?`,
      description: `Le devis "${quote.title}" et son historique seront supprimés. Cette action est irréversible.`,
      confirmLabel: 'Supprimer le devis',
      tone: 'danger',
    });
    if (confirmed) deleteMutation.mutate();
  }

  async function handleManualPaidConfirm(longLabel = false) {
    const confirmed = await confirm({
      eyebrow: 'Confirmation de paiement',
      title: 'Marquer ce devis comme payé ?',
      description: longLabel
        ? 'Utilisez cette action seulement si vous avez reçu le paiement hors lien, par exemple en espèces ou par virement.'
        : 'Utilisez cette action seulement si vous avez reçu le paiement hors lien.',
      confirmLabel: 'Marquer payé',
      tone: 'warning',
    });
    if (confirmed) statusMutation.mutate('PAID');
  }

  const moreMenuItems = [
    { label: 'Enregistrer comme template', icon: <CopyIcon size={14} />, onClick: () => setShowSaveTemplateModal(true) },
    { label: 'Dupliquer', icon: <CopyIcon size={14} />, onClick: () => duplicateMutation.mutate() },
    { label: 'Renvoyer par e-mail', icon: <SendIcon size={14} />, onClick: () => setShowSendTemplateModal(true) },
    { label: 'Supprimer', danger: true, icon: <TrashIcon size={14} />, onClick: handleDelete },
  ];

  return (
    <div className="h-full overflow-auto scrollbar-thin bg-surface-2 pb-24 lg:pb-0">
      {/* Action bar */}
      <div className="sticky top-0 z-10 px-3 lg:px-7 py-2.5 lg:py-4 bg-surface border-b border-border flex items-center gap-2 lg:gap-3 flex-wrap">
        {/* Back chevron — visible only on desktop; mobile has the topbar back button */}
        <button
          onClick={() => navigate('/quotes')}
          className="hidden lg:flex items-center gap-1 text-[13px] text-text-muted hover:text-text transition-colors"
        >
          <ChevronLeftIcon size={15} /> Retour aux devis
        </button>
        <div className="hidden lg:block w-px h-5 bg-border" />
        <span className="font-mono text-[12.5px] lg:text-[13px] font-semibold">{quote.number}</span>
        <Badge status={displayStatus} pulse={awaitingPayment} />
        {awaitingPayment && (
          <div className="hidden lg:flex items-center gap-1.5 text-[11.5px] text-text-muted">
            <span className={`w-1.5 h-1.5 rounded-full ${isFetching ? 'bg-primary animate-pulse' : 'bg-text-subtle'}`} />
            Vérification auto · toutes les 6s
          </div>
        )}
        <div className="flex-1" />

        {/* DESKTOP actions */}
        <div className="hidden lg:flex items-center gap-3">
          <Button
            variant="ghost" size="sm"
            loading={saveTemplateMutation.isPending}
            onClick={() => setShowSaveTemplateModal(true)}
          >
            <CopyIcon size={14} /> Enregistrer comme template
          </Button>
          <Button
            variant="ghost" size="sm"
            loading={duplicateMutation.isPending}
            onClick={() => duplicateMutation.mutate()}
          >
            <CopyIcon size={14} /> Dupliquer
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/quotes/${id}/edit`)}>
            <EditIcon size={14} /> Modifier
          </Button>
          <Button
            variant="secondary" size="sm"
            onClick={() => setShowSendTemplateModal(true)}
          >
            <SendIcon size={14} /> Renvoyer
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowTemplateModal(true)}>
            <DownloadIcon size={14} /> Télécharger PDF
          </Button>
          <Button
            variant="ghost" size="sm"
            className="text-danger hover:bg-danger-soft"
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            <TrashIcon size={14} />
          </Button>
        </div>

        {/* MOBILE actions — compact, primary in sticky bottom bar */}
        <div className="lg:hidden flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/quotes/${id}/edit`)}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-2 border border-border text-text-muted active:bg-border"
            aria-label="Modifier"
          >
            <EditIcon size={15} />
          </button>
          <ContextMenu items={moreMenuItems}>
            <button
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-2 border border-border text-text-muted active:bg-border"
              aria-label="Plus d'actions"
            >
              <MoreIcon size={16} />
            </button>
          </ContextMenu>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 lg:gap-5 p-3 lg:p-7 items-start">
        {/* Document preview */}
        <div className="bg-surface border border-border rounded shadow-md overflow-hidden">
          {/* Sent banner */}
          {quote.sentAt && (
            <div className="px-4 lg:px-10 py-2.5 bg-blue-soft text-blue text-[12px] lg:text-[12.5px] flex items-center gap-2">
              <SendIcon size={13} className="flex-shrink-0" />
              <span className="truncate">
                Envoyé à <strong>{client?.email}</strong> le {fmtDateFR(quote.sentAt)}
              </span>
            </div>
          )}

          <div className="p-5 lg:p-12">
            {/* Doc header */}
            <div className="flex items-start mb-6 lg:mb-8 gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-3 lg:mb-4">
                  {(() => {
                    const logoUrl = user?.useProfilePhotoAsLogo !== false ? user?.logoUrl : user?.quoteLogoUrl;
                    return logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-[10px] object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-[10px] bg-primary grid place-items-center text-white flex-shrink-0">
                        <span className="text-[14px] font-bold">
                          {(user?.companyName || user?.name || 'D')[0].toUpperCase()}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="leading-[1.2] min-w-0">
                    <div className="font-semibold text-[14px] truncate">{user?.companyName || user?.name}</div>
                  </div>
                </div>
                <div className="text-[11.5px] lg:text-[12px] text-text-muted leading-[1.55]">
                  {user?.address || 'Abomey-Calavi, Bénin'}<br />
                  {user?.phone}{user?.email && ` · ${user.email}`}<br />
                  {user?.ifu && `IFU ${user.ifu}`}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[20px] lg:text-[26px] font-semibold tracking-[-0.02em]">DEVIS</div>
                <div className="font-mono text-[12px] lg:text-[13px] text-text-muted mt-0.5">{quote.number}</div>
                <div className="mt-2.5 lg:mt-3.5 text-[11.5px] lg:text-[12px] text-text-muted leading-[1.7]">
                  <div>Émis le <strong className="text-text">{issuedDate}</strong></div>
                  <div>Valable jusqu'au <strong className="text-text">{validDate}</strong></div>
                </div>
              </div>
            </div>

            {/* Bill to */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 mb-6 lg:mb-7 p-3.5 lg:p-4 bg-surface-2 rounded-[10px]">
              <div>
                <div className="text-[10.5px] lg:text-[11px] text-text-muted uppercase tracking-[0.05em] mb-1.5">Adressé à</div>
                <div className="font-semibold text-[13.5px] lg:text-[14px]">{client?.name}</div>
                <div className="text-[11.5px] lg:text-[12px] text-text-muted mt-1 leading-[1.55]">
                  À l'attention de {client?.contact}<br />
                  {client?.city}, Bénin<br />
                  {client?.email}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] lg:text-[11px] text-text-muted uppercase tracking-[0.05em] mb-1.5">Objet</div>
                <div className="font-semibold text-[13.5px] lg:text-[14px] leading-snug">{quote.title}</div>
              </div>
            </div>

            {/* Lines — horizontal scroll on mobile to preserve alignment */}
            <div className="overflow-x-auto -mx-1 lg:mx-0 mb-6">
              <table className="w-full min-w-[480px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #14201C' }}>
                    {['Désignation', 'Qté', 'P.U.', 'Total HT'].map((h, i) => (
                      <th key={h} className={`py-2.5 text-[11px] lg:text-[11.5px] font-semibold uppercase tracking-[0.05em] ${i > 0 ? 'text-right' : 'text-left'} ${i === 1 ? 'w-16' : i > 1 ? 'w-24 lg:w-28' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-3 lg:py-3.5 text-[12.5px] lg:text-[13px] pr-2">{it.description}</td>
                      <td className="py-3 lg:py-3.5 text-[12.5px] lg:text-[13px] font-mono text-right whitespace-nowrap">
                        {it.quantity}
                        {it.unit && <span className="text-text-muted font-sans"> {it.unit}</span>}
                      </td>
                      <td className="py-3 lg:py-3.5 text-[12.5px] lg:text-[13px] font-mono text-right whitespace-nowrap">{it.unitPrice ? fmtXOF(it.unitPrice) : '—'}</td>
                      <td className="py-3 lg:py-3.5 text-[12.5px] lg:text-[13px] font-mono font-semibold text-right whitespace-nowrap">{it.total ? fmtXOF(it.total) : 'Inclus'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-[280px] flex flex-col gap-2">
                <div className="flex text-[13px]"><span className="flex-1 text-text-muted">Sous-total HT</span><span className="font-mono">{fmtXOF(subtotal)}</span></div>
                <div className="flex text-[13px]"><span className="flex-1 text-text-muted">TVA {quote.taxRate} %</span><span className="font-mono">{fmtXOF(tvaAmount)}</span></div>
                <div className="h-px bg-text my-1" />
                <div className="flex items-baseline">
                  <span className="flex-1 text-[13px] font-semibold">Total TTC</span>
                  <span className="font-mono text-[20px] font-semibold tracking-[-0.01em]">{fmtXOF(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <div className="p-4 bg-surface-2 rounded-[10px] text-[12.5px] text-text-muted leading-relaxed">
                <strong className="text-text">Conditions de paiement. </strong>{quote.notes}
              </div>
            )}

            {/* Footer */}
            <div className="mt-7 flex justify-between text-[11px] text-text-subtle">
              <span>{user?.companyName || user?.name}{user?.rccm ? ` · RCCM ${user.rccm}` : ''}{user?.ifu ? ` · IFU ${user.ifu}` : ''}</span>
              <span>Page 1/1</span>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3.5 lg:sticky lg:top-[80px]">
          {/* Activity */}
          <div className="bg-surface border border-border rounded shadow-sm p-[18px]">
            <div className="text-[13px] font-semibold mb-3.5">Activité</div>
            <Timeline events={[
              ...(quote.paidAt ? [{
                dot: '#0F8F65',
                title: quote.paidViaLink ? 'Paiement reçu par lien MoMo / carte' : 'Marqué comme payé',
                time: fmtDateFR(quote.paidAt),
              }] : []),
              ...(awaitingPayment ? [{
                dot: '#C2691B',
                title: 'Lien de paiement actif · en attente du client',
                time: 'Vérification automatique toutes les 6s',
              }] : []),
              ...(quote.sentAt ? [{ dot: '#2563EB', title: 'Envoyé par e-mail', time: fmtDateFR(quote.sentAt) }] : []),
              { dot: '#97A09B', title: 'Brouillon créé', time: fmtDateFR(quote.createdAt) },
            ]} />
          </div>

          {/* Client */}
          {client && (
            <div className="bg-surface border border-border rounded shadow-sm p-[18px]">
              <div className="text-[13px] font-semibold mb-3">Client</div>
              <div className="flex items-center gap-3 mb-3.5">
                <Avatar name={client.name} color={client.color} size={38} />
                <div className="flex-1 min-w-0 leading-[1.2]">
                  <div className="text-[13.5px] font-semibold truncate">{client.name}</div>
                  <div className="text-[12px] text-text-muted mt-0.5">{client.contact}</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                {client.phone ? (
                  <a href={`tel:${client.phone}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      <PhoneIcon size={13} /> Appeler
                    </Button>
                  </a>
                ) : (
                  <Button variant="secondary" size="sm" className="flex-1" disabled>
                    <PhoneIcon size={13} /> Appeler
                  </Button>
                )}
                {client.email ? (
                  <a href={`mailto:${client.email}?subject=${encodeURIComponent(`Devis ${quote.number} — ${quote.title}`)}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      <MailIcon size={13} /> E-mail
                    </Button>
                  </a>
                ) : (
                  <Button variant="secondary" size="sm" className="flex-1" disabled>
                    <MailIcon size={13} /> E-mail
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Paiement reçu — affiché uniquement si PAID */}
          {quote.status === 'PAID' && (
            <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded shadow-sm p-[18px]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-[#DCFCE7] flex items-center justify-center flex-shrink-0">
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#14532D" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-[13px] font-semibold text-[#14532D]">Paiement reçu</div>
              </div>
              <div className="flex justify-between text-[12.5px] mb-1.5">
                <span className="text-[#166534]">Montant</span>
                <span className="font-mono font-semibold text-[#14532D]">{fmtXOF(total)}</span>
              </div>
              {quote.paidAt && (
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-[#166534]">Date</span>
                  <span className="text-[#166534]">{fmtDateFR(quote.paidAt)}</span>
                </div>
              )}
            </div>
          )}

          {/* En attente de paiement — quand le lien existe et le devis n'est pas encore réglé */}
          {awaitingPayment && quote.paymentUrl && (
            <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded shadow-sm p-[18px]">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-warn animate-ping opacity-70" />
                  <span className="relative w-2 h-2 rounded-full bg-warn" />
                </span>
                <div className="text-[13px] font-semibold text-[#92400E]">En attente de paiement</div>
              </div>
              <div className="text-[11.5px] text-[#A1530F] mb-3 leading-snug">
                Votre client peut régler par <strong>Mobile Money</strong> ou <strong>carte bancaire</strong>.
                Dès qu'il a payé, le statut passe automatiquement à <strong>Payé</strong>.
              </div>

              {/* Lien à partager */}
              <div className="flex gap-1.5 mb-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 h-8 px-2 text-[11.5px] font-mono bg-white border border-[#FDE68A] rounded-sm text-text-muted truncate"
                />
                <button
                  onClick={() => handleCopy(shareUrl)}
                  title="Copier le lien"
                  className="h-8 px-2.5 rounded-sm border border-[#FDE68A] bg-white hover:bg-[#FEF3C7] text-[12px] text-[#92400E] transition-colors"
                >
                  {copied ? <Check size={13} strokeWidth={2.5} /> : <CopyIcon size={13} />}
                </button>
              </div>

              {/* Partage WhatsApp */}
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full h-8 rounded-sm bg-[#25D366] hover:bg-[#1ebe5d] text-white text-[12.5px] font-semibold transition-colors mb-2"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                Envoyer sur WhatsApp
              </a>

              {/* Vérifier maintenant */}
              <Button
                variant="secondary" size="sm" className="w-full"
                loading={checkPaymentMutation.isPending}
                onClick={() => checkPaymentMutation.mutate()}
              >
                {checkPaymentMutation.isPending ? 'Vérification…' : 'Vérifier le paiement'}
              </Button>

              {checkFeedback === 'paid' && (
                <div className="mt-2 flex items-center gap-1 text-[11.5px] text-[#0F8F65] font-medium">
                  <Check size={13} strokeWidth={2.5} /> Paiement confirmé !
                </div>
              )}
              {checkFeedback === 'pending' && (
                <div className="mt-2 text-[11.5px] text-text-muted">
                  Toujours en attente — votre client n'a pas encore payé.
                </div>
              )}
              {checkPaymentMutation.isError && (
                <div className="mt-2 text-[11.5px] text-danger">
                  {(checkPaymentMutation.error as any)?.response?.data?.message || 'Erreur de vérification'}
                </div>
              )}

              {/* Actions secondaires */}
              <div className="mt-3 pt-3 border-t border-[#FDE68A] flex items-center justify-between text-[11.5px]">
                <button
                  onClick={() => paymentMutation.mutate()}
                  disabled={paymentMutation.isPending}
                  className="text-[#92400E] hover:underline disabled:opacity-50"
                >
                  Régénérer le lien
                </button>
                <button
                  onClick={() => handleManualPaidConfirm(true)}
                  disabled={statusMutation.isPending}
                  className="text-text-muted hover:text-text hover:underline disabled:opacity-50"
                >
                  Marquer payé manuellement
                </button>
              </div>
            </div>
          )}

          {/* Pas encore de lien de paiement */}
          {canUseMomo && quote.status !== 'PAID' && !quote.paymentUrl && (
            <div className="bg-surface border border-border rounded shadow-sm p-[18px]">
              <div className="text-[13px] font-semibold mb-1">Lien de paiement</div>
              <div className="text-[12px] text-text-muted mb-3">
                Générez un lien MoMo / carte bancaire à envoyer à votre client — le statut se mettra à jour automatiquement après paiement.
              </div>
              <Button
                variant="primary" size="sm"
                className="w-full"
                loading={paymentMutation.isPending}
                onClick={() => paymentMutation.mutate()}
              >
                <SendIcon size={13} /> Générer le lien
              </Button>
              {paymentMutation.isError && (
                <div className="mt-2 text-[12px] text-danger">
                  {(paymentMutation.error as any)?.response?.data?.message || 'Impossible de générer le lien'}
                </div>
              )}
              <button
                onClick={() => handleManualPaidConfirm()}
                disabled={statusMutation.isPending}
                className="mt-3 text-[11.5px] text-text-muted hover:text-text hover:underline disabled:opacity-50 w-full text-center"
              >
                Marquer payé manuellement
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Mobile sticky bottom action bar — primary CTA always reachable */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] flex gap-2 shadow-[0_-6px_16px_rgba(0,0,0,0.06)]">
        <Button
          variant="secondary" size="md"
          onClick={() => navigate(`/quotes/${id}/edit`)}
          className="flex-1"
        >
          <EditIcon size={14} /> Modifier
        </Button>
        <Button
          variant="primary" size="md"
          onClick={() => setShowTemplateModal(true)}
          className="flex-1"
        >
          <DownloadIcon size={14} /> PDF
        </Button>
      </div>

      {showTemplateModal && (
        <TemplateSelectorModal
          quote={quote}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
      {showSendTemplateModal && (
        <TemplateSelectorModal
          quote={quote}
          mode="send"
          onClose={() => setShowSendTemplateModal(false)}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ['quote', id] });
            qc.invalidateQueries({ queryKey: ['quotes'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['notif-quotes'] });
          }}
        />
      )}
      {showSaveTemplateModal && (
        <SaveQuoteTemplateModal
          defaultName={quote.title}
          loading={saveTemplateMutation.isPending}
          error={(saveTemplateMutation.error as any)?.response?.data?.message || (saveTemplateMutation.error as any)?.message}
          onClose={() => setShowSaveTemplateModal(false)}
          onSave={(meta) => saveTemplateMutation.mutate(meta)}
        />
      )}
      {confirmDialog}
    </div>
  );
}
