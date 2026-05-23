import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { fmtXOF, fmtDateFR } from '@/lib/utils';
import type { Payout, PayoutStatus } from '@/types';
import Button from '@/components/ui/Button';
import { ChevronLeftIcon, AlertCircleIcon } from '@/components/ui/Icon';
import { Check, AlertCircle } from 'lucide-react';

const STATUS_LABELS: Record<PayoutStatus, string> = {
  PENDING: 'En attente',
  TRANSFERRING: 'En cours',
  TRANSFERRED: 'Reversé',
  FAILED: 'Échec',
};

const STATUS_COLORS: Record<PayoutStatus, { bg: string; text: string; dot: string }> = {
  PENDING:      { bg: '#F5F4EE', text: '#6B7570', dot: '#97A09B' },
  TRANSFERRING: { bg: '#FBEFDF', text: '#A1530F', dot: '#C2691B' },
  TRANSFERRED:  { bg: '#E6F4EE', text: '#0C7A56', dot: '#0F8F65' },
  FAILED:       { bg: '#F8E5E5', text: '#B43A3A', dot: '#B43A3A' },
};

function StatusBadge({ status, pulse }: { status: PayoutStatus; pulse?: boolean }) {
  const c = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11.5px] font-semibold"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="relative flex w-1.5 h-1.5">
        {pulse && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-70" style={{ background: c.dot }} />
        )}
        <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      </span>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function Payouts() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const { data: payouts = [], isLoading } = useQuery<Payout[]>({
    queryKey: ['payouts'],
    queryFn: () => paymentsApi.history().then(r => r.data),
    // Poll while there's pending/transferring work so the UI reflects progress.
    refetchInterval: (q) => {
      const list = q.state.data ?? [];
      return list.some(p => p.status === 'PENDING' || p.status === 'TRANSFERRING') ? 8000 : false;
    },
  });

  const retryMutation = useMutation({
    mutationFn: (paymentId: string) => paymentsApi.retryPayout(paymentId),
    onSuccess: () => {
      setFeedback({ kind: 'ok', msg: 'Reversement renvoyé avec succès.' });
      qc.invalidateQueries({ queryKey: ['payouts'] });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err: any) => {
      setFeedback({
        kind: 'err',
        msg: err?.response?.data?.message || 'Erreur lors de la nouvelle tentative',
      });
      qc.invalidateQueries({ queryKey: ['payouts'] });
      setTimeout(() => setFeedback(null), 6000);
    },
    onSettled: () => setRetryingId(null),
  });

  const stats = useMemo(() => {
    let totalReceived = 0;
    let totalNet = 0;
    let totalCommission = 0;
    let pending = 0;
    let failed = 0;
    for (const p of payouts) {
      if (p.status === 'TRANSFERRED') {
        totalNet += p.netAmount;
        totalCommission += p.commission;
        totalReceived += p.grossAmount;
      }
      if (p.status === 'PENDING' || p.status === 'TRANSFERRING') pending++;
      if (p.status === 'FAILED') failed++;
    }
    return { totalReceived, totalNet, totalCommission, pending, failed };
  }, [payouts]);

  const noMomo = !user?.phone;

  return (
    <div className="h-full overflow-auto scrollbar-thin bg-surface-2">
      <div className="max-w-[960px] mx-auto px-4 lg:px-5 py-4 lg:py-8">

        {/* Back — desktop only (mobile uses topbar back) */}
        <button
          onClick={() => navigate('/settings')}
          className="hidden lg:flex items-center gap-1 text-[13px] text-text-muted hover:text-text transition-colors mb-4"
        >
          <ChevronLeftIcon size={15} /> Retour aux réglages
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap mb-5 lg:mb-6">
          <div className="flex-1 min-w-0">
            <div className="text-[20px] lg:text-[24px] font-semibold tracking-[-0.02em]">Mes reversements</div>
            <div className="text-[12.5px] lg:text-[13px] text-text-muted mt-1 leading-relaxed">
              Argent reçu de vos clients via lien de paiement et reversé sur votre Mobile Money.
              Commission NexaPay : <strong className="text-text">3 %</strong>.
            </div>
          </div>
        </div>

        {/* No MoMo warning */}
        {noMomo && (
          <div className="mb-5 p-4 bg-[#FEF3C7] border border-[#FCD34D] rounded-lg flex items-start gap-3">
            <AlertCircleIcon size={18} className="text-[#92400E] flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-[13px] text-[#92400E] leading-relaxed">
              <strong>Aucun numéro MoMo enregistré.</strong> Les paiements de vos clients arriveront chez nous
              mais ne pourront <strong>pas vous être reversés</strong> tant que vous n'avez pas renseigné votre numéro.
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate('/settings')}>
              Configurer maintenant
            </Button>
          </div>
        )}

        {/* Feedback banner */}
        {feedback && (
          <div className={`mb-4 p-3 rounded text-[13px] font-medium flex items-center gap-2 ${
            feedback.kind === 'ok'
              ? 'bg-[#DCFCE7] border border-[#86EFAC] text-[#14532D]'
              : 'bg-danger-soft border border-danger/30 text-danger'
          }`}>
            {feedback.kind === 'ok'
              ? <Check size={15} strokeWidth={2.5} className="flex-shrink-0" />
              : <AlertCircle size={15} strokeWidth={2} className="flex-shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Reversé sur MoMo" value={fmtXOF(stats.totalNet)} hint="net après commission" mono />
          <StatCard label="Encaissé total" value={fmtXOF(stats.totalReceived)} hint="brut payé par vos clients" mono />
          <StatCard label="Commission NexaPay" value={fmtXOF(stats.totalCommission)} hint="3 % sur encaissés" mono />
          <StatCard
            label="En attente / Échec"
            value={`${stats.pending} · ${stats.failed}`}
            hint={stats.failed > 0 ? 'à relancer manuellement' : 'rien à faire'}
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : payouts.length === 0 ? (
          <div className="bg-surface border border-border border-dashed rounded p-10 text-center">
            <div className="text-[15px] font-semibold mb-1">Aucun reversement pour le moment</div>
            <div className="text-[13px] text-text-muted">
              Dès qu'un client paiera un devis via votre lien Mobile Money, vous verrez le reversement ici.
            </div>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded overflow-hidden shadow-sm">
            {/* Desktop header */}
            <div className="hidden lg:grid grid-cols-[1fr_120px_120px_140px_120px_120px] gap-3 px-5 py-2.5 bg-surface-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.04em] border-b border-border">
              <span>Devis</span>
              <span className="text-right">Encaissé</span>
              <span className="text-right">Commission</span>
              <span className="text-right">Reversé (net)</span>
              <span>Date</span>
              <span>Statut</span>
            </div>

            {payouts.map(p => (
              <PayoutRow
                key={p.id}
                payout={p}
                onRetry={() => { setRetryingId(p.id); retryMutation.mutate(p.id); }}
                retrying={retryingId === p.id}
                disabled={retryMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* How it works */}
        <details className="mt-6 bg-surface border border-border rounded">
          <summary className="px-4 py-3 cursor-pointer text-[13px] font-semibold text-text-muted hover:text-text">
            Comment fonctionne le reversement ?
          </summary>
          <div className="px-4 pb-4 text-[12.5px] text-text-muted leading-relaxed flex flex-col gap-2">
            <p>1. Votre client paie le devis via votre lien Mobile Money ou par carte bancaire. L'argent atterrit dans le compte sécurisé NexaPay (Fedapay).</p>
            <p>2. <strong className="text-text">Immédiatement après</strong>, NexaPay prélève sa commission de 3 % et déclenche un transfert du net (97 %) vers votre numéro MoMo enregistré.</p>
            <p>3. Vous recevez l'argent sur votre MoMo en quelques secondes (jusqu'à quelques minutes selon l'opérateur). Vous voyez le statut passer en <strong className="text-[#0C7A56]">Reversé</strong> sur cette page.</p>
            <p>4. En cas d'échec (numéro invalide, opérateur HS…), le statut passe en <strong className="text-danger">Échec</strong> avec le détail. Vous pouvez relancer en un clic — votre argent reste sécurisé chez nous tant qu'il n'est pas réussi.</p>
          </div>
        </details>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, mono }: { label: string; value: string; hint?: string; mono?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded p-3.5">
      <div className="text-[11.5px] text-text-muted uppercase tracking-[0.04em] font-semibold">{label}</div>
      <div className={`text-[17px] font-semibold mt-1 ${mono ? 'font-mono' : ''}`}>{value}</div>
      {hint && <div className="text-[11px] text-text-subtle mt-0.5">{hint}</div>}
    </div>
  );
}

function PayoutRow({
  payout,
  onRetry,
  retrying,
  disabled,
}: {
  payout: Payout;
  onRetry: () => void;
  retrying: boolean;
  disabled: boolean;
}) {
  const navigate = useNavigate();
  const isPending = payout.status === 'PENDING' || payout.status === 'TRANSFERRING';
  const isFailed = payout.status === 'FAILED';
  const date = payout.transferredAt ?? payout.quote?.paidAt ?? payout.createdAt;

  return (
    <div className="border-t border-border first:border-t-0">
      {/* Desktop row */}
      <div className="hidden lg:grid grid-cols-[1fr_120px_120px_140px_120px_120px] gap-3 px-5 py-3 items-center hover:bg-surface-2 transition-colors">
        <button
          onClick={() => navigate(`/quotes/${payout.quoteId}`)}
          className="text-left min-w-0"
        >
          <div className="text-[13.5px] font-semibold truncate hover:text-primary-hover transition-colors">{payout.quote?.title ?? 'Devis supprimé'}</div>
          <div className="text-[11.5px] text-text-muted font-mono mt-0.5">{payout.quote?.number ?? '—'}</div>
        </button>
        <span className="font-mono text-[13px] text-right text-text-muted">{fmtXOF(payout.grossAmount)}</span>
        <span className="font-mono text-[13px] text-right text-text-subtle">−{fmtXOF(payout.commission)}</span>
        <span className="font-mono text-[14px] font-semibold text-right text-[#0C7A56]">{fmtXOF(payout.netAmount)}</span>
        <span className="text-[12.5px] text-text-muted">{fmtDateFR(date)}</span>
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={payout.status} pulse={isPending} />
          {isFailed && (
            <button
              onClick={onRetry}
              disabled={disabled}
              className="text-[11.5px] font-semibold text-primary hover:underline disabled:opacity-50 whitespace-nowrap"
            >
              {retrying ? '…' : 'Relancer'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile row */}
      <div className="lg:hidden p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => navigate(`/quotes/${payout.quoteId}`)}
            className="text-left min-w-0 flex-1"
          >
            <div className="text-[14px] font-semibold truncate">{payout.quote?.title ?? 'Devis supprimé'}</div>
            <div className="text-[11.5px] text-text-muted font-mono mt-0.5">{payout.quote?.number ?? '—'}</div>
          </button>
          <StatusBadge status={payout.status} pulse={isPending} />
        </div>
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="text-text-muted">Reversé sur MoMo</span>
          <span className="font-mono font-semibold text-[#0C7A56] text-[14px]">{fmtXOF(payout.netAmount)}</span>
        </div>
        <div className="flex items-baseline justify-between text-[11.5px] text-text-muted">
          <span>Encaissé {fmtXOF(payout.grossAmount)} · commission {fmtXOF(payout.commission)}</span>
          <span>{fmtDateFR(date)}</span>
        </div>
        {isFailed && payout.failReason && (
          <div className="mt-1 text-[11.5px] text-danger bg-danger-soft border border-danger/20 rounded p-2 leading-snug">
            {payout.failReason}
          </div>
        )}
        {isFailed && (
          <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry} className="self-start">
            Relancer le reversement
          </Button>
        )}
      </div>

      {/* Desktop failure detail */}
      {isFailed && payout.failReason && (
        <div className="hidden lg:block mx-5 mb-3 text-[11.5px] text-danger bg-danger-soft border border-danger/20 rounded p-2 leading-snug">
          Détail Fedapay : {payout.failReason}
        </div>
      )}
    </div>
  );
}
