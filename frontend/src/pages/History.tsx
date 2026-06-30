import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { quotesApi, paymentsApi, storesApi } from '@/lib/api';
import { fmtDateFR, fmtXOF } from '@/lib/utils';
import type { Payout, PayoutStatus, Quote, QuoteStatus, StoreOrder, StoreOrderStatus } from '@/types';
import Button from '@/components/ui/Button';
import { ClockIcon, FileIcon, ReceiptIcon, SearchIcon, WalletIcon, ArrowRightIcon } from '@/components/ui/Icon';
import { CheckCircle2, CircleDollarSign, PackageCheck, TimerReset } from 'lucide-react';

type HistoryKind = 'all' | 'quote' | 'payment' | 'order';
type StatusGroup = 'all' | 'open' | 'done' | 'attention';

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

interface StatusMeta {
  label: string;
  detail: string;
  group: Exclude<StatusGroup, 'all'>;
  tone: Tone;
  step: number;
}

interface HistoryItem {
  id: string;
  kind: Exclude<HistoryKind, 'all'>;
  title: string;
  subtitle: string;
  amount: number;
  date: string;
  status: string;
  meta: StatusMeta;
  href: string;
  reference?: string;
  customer?: string;
}

const KIND_FILTERS: { label: string; value: HistoryKind }[] = [
  { label: 'Tout', value: 'all' },
  { label: 'Devis générés', value: 'quote' },
  { label: 'Paiements', value: 'payment' },
  { label: 'Commandes boutique', value: 'order' },
];

const STATUS_FILTERS: { label: string; value: StatusGroup }[] = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'En cours', value: 'open' },
  { label: 'Terminés', value: 'done' },
  { label: 'À traiter', value: 'attention' },
];

const QUOTE_STATUS: Record<QuoteStatus, StatusMeta> = {
  DRAFT: { label: 'Brouillon', detail: 'Devis créé, pas encore envoyé au client.', group: 'open', tone: 'neutral', step: 1 },
  SENT: { label: 'Envoyé', detail: 'Le client peut consulter et payer ce devis.', group: 'open', tone: 'info', step: 2 },
  PAID: { label: 'Payé', detail: 'Paiement reçu pour ce devis.', group: 'done', tone: 'success', step: 4 },
  OVERDUE: { label: 'En retard', detail: 'Validité dépassée, relance recommandée.', group: 'attention', tone: 'danger', step: 3 },
  CANCELLED: { label: 'Annulé', detail: 'Ce devis ne doit plus avancer.', group: 'attention', tone: 'neutral', step: 0 },
};

const PAYMENT_STATUS: Record<PayoutStatus, StatusMeta> = {
  PENDING: { label: 'En attente', detail: 'Paiement reçu, reversement en préparation.', group: 'open', tone: 'warning', step: 1 },
  TRANSFERRING: { label: 'En transfert', detail: 'Reversement Mobile Money en cours.', group: 'open', tone: 'info', step: 2 },
  TRANSFERRED: { label: 'Effectué', detail: 'Argent reversé sur votre Mobile Money.', group: 'done', tone: 'success', step: 3 },
  FAILED: { label: 'Échec', detail: 'Reversement à vérifier ou relancer.', group: 'attention', tone: 'danger', step: 0 },
};

const ORDER_STATUS: Record<StoreOrderStatus, StatusMeta> = {
  PENDING_PAYMENT: { label: 'Paiement attendu', detail: 'Commande reçue, paiement pas encore confirmé.', group: 'open', tone: 'warning', step: 1 },
  PAID: { label: 'Payée', detail: 'Paiement confirmé, commande à préparer.', group: 'open', tone: 'info', step: 2 },
  PROCESSING: { label: 'En cours', detail: 'Commande en préparation ou livraison.', group: 'open', tone: 'info', step: 3 },
  COMPLETED: { label: 'Terminée', detail: 'Commande finalisée.', group: 'done', tone: 'success', step: 4 },
  CANCELLED: { label: 'Annulée', detail: 'Commande stoppée.', group: 'attention', tone: 'neutral', step: 0 },
  REFUNDED: { label: 'Remboursée', detail: 'Commande remboursée au client.', group: 'attention', tone: 'danger', step: 0 },
};

const TONE_CLASS: Record<Tone, { bg: string; text: string; dot: string; border: string }> = {
  neutral: { bg: 'bg-surface-2', text: 'text-text-muted', dot: 'bg-text-subtle', border: 'border-border' },
  info: { bg: 'bg-blue-soft', text: 'text-blue', dot: 'bg-blue', border: 'border-blue/20' },
  warning: { bg: 'bg-warn-soft', text: 'text-warn', dot: 'bg-warn', border: 'border-warn/25' },
  success: { bg: 'bg-primary-soft', text: 'text-primary-hover', dot: 'bg-primary', border: 'border-primary-soft-2' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger', dot: 'bg-danger', border: 'border-danger/25' },
};

const KIND_META: Record<Exclude<HistoryKind, 'all'>, { label: string; icon: React.ReactNode; accent: string }> = {
  quote: { label: 'Devis', icon: <FileIcon size={15} />, accent: 'bg-primary-soft text-primary-hover' },
  payment: { label: 'Paiement', icon: <WalletIcon size={15} />, accent: 'bg-warn-soft text-warn' },
  order: { label: 'Commande', icon: <ReceiptIcon size={15} />, accent: 'bg-blue-soft text-blue' },
};

export default function History() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<HistoryKind>('all');
  const [statusGroup, setStatusGroup] = useState<StatusGroup>('all');
  const [search, setSearch] = useState('');

  const quotesQuery = useQuery<Quote[]>({
    queryKey: ['history-quotes'],
    queryFn: () => quotesApi.list().then(r => r.data),
    refetchInterval: q => (q.state.data ?? []).some(item => item.status === 'SENT' && item.paymentRef) ? 10000 : false,
  });

  const paymentsQuery = useQuery<Payout[]>({
    queryKey: ['history-payments'],
    queryFn: () => paymentsApi.history().then(r => r.data),
    refetchInterval: q => (q.state.data ?? []).some(item => item.status === 'PENDING' || item.status === 'TRANSFERRING') ? 8000 : false,
  });

  const ordersQuery = useQuery<StoreOrder[]>({
    queryKey: ['history-store-orders'],
    queryFn: async () => {
      try {
        const response = await storesApi.orders();
        return response.data;
      } catch (error: any) {
        if ([403, 404].includes(error?.response?.status)) return [];
        throw error;
      }
    },
    retry: false,
    refetchInterval: q => (q.state.data ?? []).some(item => item.status === 'PENDING_PAYMENT') ? 8000 : false,
  });

  const items = useMemo<HistoryItem[]>(() => {
    const quoteItems = (quotesQuery.data ?? []).map(quote => toQuoteItem(quote));
    const paymentItems = (paymentsQuery.data ?? []).map(payment => toPaymentItem(payment));
    const orderItems = (ordersQuery.data ?? []).map(order => toOrderItem(order));
    return [...quoteItems, ...paymentItems, ...orderItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ordersQuery.data, paymentsQuery.data, quotesQuery.data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(item => {
      const matchesKind = kind === 'all' || item.kind === kind;
      const matchesGroup = statusGroup === 'all' || item.meta.group === statusGroup;
      const matchesSearch = !needle || [
        item.title,
        item.subtitle,
        item.reference,
        item.customer,
        item.meta.label,
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(needle));
      return matchesKind && matchesGroup && matchesSearch;
    });
  }, [items, kind, search, statusGroup]);

  const stats = useMemo(() => {
    const done = items.filter(item => item.meta.group === 'done');
    const open = items.filter(item => item.meta.group === 'open');
    const attention = items.filter(item => item.meta.group === 'attention');
    const paidAmount = done
      .filter(item => item.kind === 'payment' || item.kind === 'order' || item.status === 'PAID')
      .reduce((sum, item) => sum + item.amount, 0);
    return { total: items.length, done: done.length, open: open.length, attention: attention.length, paidAmount };
  }, [items]);

  const loading = quotesQuery.isLoading || paymentsQuery.isLoading || ordersQuery.isLoading;

  return (
    <div className="h-full overflow-auto bg-surface-2 scrollbar-thin">
      <div className="mx-auto max-w-[1240px] px-4 py-5 pb-24 lg:px-6 lg:py-7">
        <section className="mb-5 rounded-lg border border-border bg-surface p-4 shadow-sm lg:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary-soft-2 bg-primary-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-primary-hover">
                <ClockIcon size={13} /> Suivi commercial
              </div>
              <h1 className="text-[22px] font-semibold tracking-[-0.02em] lg:text-[26px]">Historique</h1>
              <p className="mt-1 max-w-[720px] text-[13px] leading-relaxed text-text-muted">
                Suivez les devis générés, les paiements et les commandes boutique avec une logique de statuts lisible.
              </p>
            </div>
            <Button variant="primary" onClick={() => navigate('/quotes/new')}>
              Nouveau devis
            </Button>
          </div>
        </section>

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Activités" value={String(stats.total)} hint="devis, paiements, commandes" icon={<TimerReset size={17} />} />
          <SummaryCard label="En cours" value={String(stats.open)} hint="à suivre maintenant" icon={<ClockIcon size={17} />} />
          <SummaryCard label="Terminés" value={String(stats.done)} hint="payés ou finalisés" icon={<PackageCheck size={17} />} />
          <SummaryCard label="Montant confirmé" value={fmtXOF(stats.paidAmount)} hint={`${stats.attention} à traiter`} icon={<CircleDollarSign size={17} />} mono />
        </div>

        <section className="mb-4 rounded-lg border border-border bg-surface p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-md bg-surface-2 p-1">
              {KIND_FILTERS.map(filter => (
                <FilterButton
                  key={filter.value}
                  active={kind === filter.value}
                  onClick={() => setKind(filter.value)}
                >
                  {filter.label}
                </FilterButton>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-md bg-surface-2 p-1">
              {STATUS_FILTERS.map(filter => (
                <FilterButton
                  key={filter.value}
                  active={statusGroup === filter.value}
                  onClick={() => setStatusGroup(filter.value)}
                >
                  {filter.label}
                </FilterButton>
              ))}
            </div>
            <label className="relative block xl:w-[300px]">
              <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Rechercher client, numéro, statut..."
                className="h-10 w-full rounded-sm border border-border-strong bg-surface pl-9 pr-3 text-[13.5px] outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary-soft"
              />
            </label>
          </div>
        </section>

        <StatusGuide />

        <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div className="hidden grid-cols-[150px_minmax(0,1.4fr)_130px_160px_120px_32px] gap-3 border-b border-border bg-surface-2 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted lg:grid">
            <span>Type</span>
            <span>Détail</span>
            <span>Montant</span>
            <span>Statut</span>
            <span>Date</span>
            <span />
          </div>

          {loading ? (
            <div className="grid min-h-[220px] place-items-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasSearch={!!search || kind !== 'all' || statusGroup !== 'all'} onReset={() => { setSearch(''); setKind('all'); setStatusGroup('all'); }} />
          ) : (
            <div>
              {filtered.map(item => (
                <HistoryRow key={item.id} item={item} onOpen={() => navigate(item.href)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function toQuoteItem(quote: Quote): HistoryItem {
  const awaitingPayment = quote.status === 'SENT' && !!quote.paymentRef;
  const meta = awaitingPayment
    ? { ...QUOTE_STATUS.SENT, label: 'Paiement en attente', detail: 'Lien de paiement actif, règlement client attendu.', tone: 'warning' as Tone }
    : QUOTE_STATUS[quote.status];

  return {
    id: `quote-${quote.id}`,
    kind: 'quote',
    title: quote.title,
    subtitle: quote.client?.name ? `Client: ${quote.client.name}` : 'Devis sans client affiché',
    amount: quote.total,
    date: quote.updatedAt ?? quote.createdAt,
    status: quote.status,
    meta,
    href: `/quotes/${quote.id}`,
    reference: quote.number,
    customer: quote.client?.name,
  };
}

function toPaymentItem(payment: Payout): HistoryItem {
  const title = payment.quote?.title ?? 'Paiement de devis';
  return {
    id: `payment-${payment.id}`,
    kind: 'payment',
    title,
    subtitle: payment.quote?.number ? `Reversement lié au devis ${payment.quote.number}` : 'Reversement client',
    amount: payment.netAmount,
    date: payment.transferredAt ?? payment.quote?.paidAt ?? payment.createdAt,
    status: payment.status,
    meta: PAYMENT_STATUS[payment.status],
    href: `/payouts`,
    reference: payment.quote?.number,
  };
}

function toOrderItem(order: StoreOrder): HistoryItem {
  const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  return {
    id: `order-${order.id}`,
    kind: 'order',
    title: `Commande ${order.number}`,
    subtitle: `${order.customerName} · ${itemCount} article${itemCount > 1 ? 's' : ''}`,
    amount: order.total,
    date: order.completedAt ?? order.paidAt ?? order.updatedAt ?? order.createdAt,
    status: order.status,
    meta: ORDER_STATUS[order.status],
    href: '/store',
    reference: order.number,
    customer: order.customerName,
  };
}

function SummaryCard({ label, value, hint, icon, mono }: { label: string; value: string; hint: string; icon: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-text-muted">{label}</span>
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-surface-2 text-text-muted">{icon}</span>
      </div>
      <div className={`truncate text-[18px] font-semibold tracking-[-0.02em] ${mono ? 'font-mono' : ''}`}>{value}</div>
      <div className="mt-1 truncate text-[11.5px] text-text-subtle">{hint}</div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 flex-shrink-0 rounded-sm px-3 text-[12.5px] font-semibold transition-colors ${
        active ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:bg-surface hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

function StatusGuide() {
  const steps = [
    { label: 'Créé', text: 'brouillon, paiement attendu', icon: <ClockIcon size={15} /> },
    { label: 'En cours', text: 'envoyé, payé, préparation', icon: <TimerReset size={15} /> },
    { label: 'Terminé', text: 'paiement effectué ou commande terminée', icon: <CheckCircle2 size={15} /> },
  ];

  return (
    <section className="mb-4 grid gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm lg:grid-cols-3">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2.5">
          <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-surface text-primary-hover">
            {step.icon}
          </span>
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold">{index + 1}. {step.label}</div>
            <div className="truncate text-[11.5px] text-text-muted">{step.text}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

function HistoryRow({ item, onOpen }: { item: HistoryItem; onOpen: () => void }) {
  const kind = KIND_META[item.kind];
  return (
    <button
      onClick={onOpen}
      className="block w-full border-t border-border px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary-soft lg:grid lg:grid-cols-[150px_minmax(0,1.4fr)_130px_160px_120px_32px] lg:items-center lg:gap-3"
    >
      <div className="mb-2 flex items-center justify-between gap-3 lg:mb-0">
        <span className={`inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-[12px] font-semibold ${kind.accent}`}>
          {kind.icon}
          {kind.label}
        </span>
        <span className="font-mono text-[12px] text-text-muted lg:hidden">{fmtDateFR(item.date)}</span>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-[14px] font-semibold">{item.title}</div>
          {item.reference && <span className="hidden flex-shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-text-muted sm:inline">{item.reference}</span>}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-text-muted">{item.subtitle}</div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 lg:mt-0 lg:block">
        <span className="text-[11.5px] text-text-muted lg:hidden">Montant</span>
        <span className="font-mono text-[13.5px] font-semibold">{fmtXOF(item.amount)}</span>
      </div>

      <div className="mt-2 lg:mt-0">
        <StatusPill meta={item.meta} pulse={item.meta.group === 'open' && item.meta.tone !== 'neutral'} />
        <div className="mt-1 hidden truncate text-[10.5px] text-text-subtle xl:block">{item.meta.detail}</div>
      </div>

      <div className="hidden font-mono text-[12px] text-text-muted lg:block">{fmtDateFR(item.date)}</div>
      <ArrowRightIcon size={16} className="hidden text-text-subtle lg:block" />
    </button>
  );
}

function StatusPill({ meta, pulse }: { meta: StatusMeta; pulse?: boolean }) {
  const tone = TONE_CLASS[meta.tone];
  return (
    <span className={`inline-flex h-6 w-fit items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-semibold ${tone.bg} ${tone.text} ${tone.border}`}>
      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
        {pulse && <span className={`absolute inset-0 animate-ping rounded-full opacity-70 ${tone.dot}`} />}
        <span className={`relative h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      </span>
      {meta.label}
    </span>
  );
}

function EmptyState({ hasSearch, onReset }: { hasSearch: boolean; onReset: () => void }) {
  return (
    <div className="grid min-h-[260px] place-items-center px-4 py-10 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-primary-soft text-primary-hover">
          <ClockIcon size={22} />
        </div>
        <div className="text-[15px] font-semibold">Aucun historique trouvé</div>
        <div className="mt-1 max-w-[360px] text-[12.5px] leading-relaxed text-text-muted">
          {hasSearch ? 'Ajustez la recherche ou les filtres pour retrouver vos activités.' : 'Vos devis, paiements et commandes apparaitront ici.'}
        </div>
        {hasSearch && (
          <button onClick={onReset} className="mt-3 text-[12.5px] font-semibold text-primary-hover hover:text-primary">
            Réinitialiser les filtres
          </button>
        )}
      </div>
    </div>
  );
}
