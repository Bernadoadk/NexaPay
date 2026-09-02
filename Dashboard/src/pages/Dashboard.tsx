import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { analyticsApi } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import PeriodPicker, { type PeriodDays } from '@/components/ui/PeriodPicker';
import { Button } from '@/components/ui/button';
import {
  UsersIcon,
  WalletIcon,
  ClipboardListIcon,
  ReceiptIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  RefreshCw,
} from '@/components/ui/Icon';
import { formatDayLabel, formatXof, tooltipStyle, useChartPalette } from '@/lib/chartTheme';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const ACTION_LABELS: Record<string, string> = {
  login: 'Connexion',
  email_verified: 'E-mail vérifié',
  quote_created: 'Devis créé',
  payment_received: 'Paiement reçu',
  order_paid: 'Commande payée',
  credit_adjustment: 'Crédits ajustés',
  plan_changed: 'Plan modifié',
  account_blocked: 'Compte bloqué',
  account_unblocked: 'Compte débloqué',
  activity_logs_purged: 'Journaux purgés',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ');
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const palette = useChartPalette();
  const [days, setDays] = useState<PeriodDays>(30);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin-stats', days],
    queryFn: () => analyticsApi.stats({ days }).then((res) => res.data),
    refetchInterval: 120_000,
  });

  const { data: timeseries } = useQuery({
    queryKey: ['admin-timeseries', days],
    queryFn: () => analyticsApi.timeseries({ days }).then((res) => res.data),
    refetchInterval: 120_000,
  });

  const { data: activityData } = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: () => analyticsApi.activity({ limit: 8 }).then((res) => res.data),
    refetchInterval: 120_000,
  });

  const series: any[] = (timeseries?.series ?? []).map((point: any) => ({
    ...point,
    label: formatDayLabel(point.date),
  }));
  const recentLogs: any[] = activityData?.logs ?? [];

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    queryClient.invalidateQueries({ queryKey: ['admin-timeseries'] });
    queryClient.invalidateQueries({ queryKey: ['admin-recent-activity'] });
  }

  if (isLoading) {
    return (
      <div className="p-5 sm:p-6 space-y-5">
        <div className="h-8 w-64 rounded-lg bg-surface-2 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
        <div className="h-[320px] rounded-xl bg-surface border border-border animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-danger-soft border border-danger/20 text-danger rounded-xl p-5 text-center">
          <AlertCircleIcon size={22} className="mx-auto mb-2" />
          <p className="text-[13.5px]">Impossible de charger les indicateurs. Vérifiez la connexion à l'API.</p>
          <Button variant="outline" className="mt-3" onClick={refreshAll}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const revenue = stats?.revenue ?? {};
  const volume = stats?.volume ?? {};
  const users = stats?.users ?? {};
  const quotes = stats?.quotes ?? {};

  return (
    <div className="p-5 sm:p-6 space-y-5 overflow-y-auto h-full scrollbar-thin">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">Tableau de bord</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            Activité de la plateforme sur les {days} derniers jours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodPicker value={days} onChange={setDays} />
          <Button variant="outline" onClick={refreshAll} aria-label="Actualiser">
            <RefreshCw size={16} />
          </Button>
        </div>
      </header>

      {/* Revenu de la plateforme — commissions, pas volume traité. */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Revenu (commissions)"
          value={formatXof(revenue.commissionPeriod ?? 0)}
          Icon={WalletIcon}
          tone="primary"
          trend={revenue.trend ?? null}
          hint={`${formatXof(revenue.commissionTotal ?? 0)} depuis le début`}
        />
        <StatCard
          label="MRR"
          value={formatXof(revenue.mrr ?? 0)}
          Icon={TrendingUpIcon}
          tone="primary"
          hint={`ARPU ${formatXof(revenue.arpu ?? 0)}`}
        />
        <StatCard
          label="Volume traité"
          value={formatXof(volume.gmvPeriod ?? 0)}
          Icon={ReceiptIcon}
          hint={`${volume.transactionsPeriod ?? 0} transactions`}
        />
        <StatCard
          label="Reversements en échec"
          value={String(volume.failedPayouts ?? 0)}
          Icon={AlertCircleIcon}
          tone={volume.failedPayouts > 0 ? 'danger' : 'default'}
          hint={volume.failedPayouts > 0 ? 'À traiter' : 'Aucun incident'}
        />
      </section>

      {/* Acquisition et usage */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Utilisateurs"
          value={String(users.total ?? 0)}
          Icon={UsersIcon}
          trend={users.trend ?? null}
          hint={`+${users.newPeriod ?? 0} sur la période`}
        />
        <StatCard
          label="Actifs aujourd'hui"
          value={String(users.activeToday ?? 0)}
          Icon={UsersIcon}
          hint={`${users.newToday ?? 0} inscrits aujourd'hui`}
        />
        <StatCard
          label="Comptes payants"
          value={String(users.paying ?? 0)}
          Icon={WalletIcon}
          tone="primary"
          hint={`${users.conversionRate ?? 0} % de conversion`}
        />
        <StatCard
          label="Devis créés"
          value={String(quotes.period ?? 0)}
          Icon={ClipboardListIcon}
          trend={quotes.trend ?? null}
          hint={`${quotes.total ?? 0} au total`}
        />
      </section>

      {/* Graphiques */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-surface border border-border rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold">Commissions encaissées</h2>
            <span className="text-[11.5px] text-text-muted">{days} derniers jours</span>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="commissionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.primary} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={palette.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: palette.axis }}
                  tickLine={false}
                  axisLine={{ stroke: palette.grid }}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: palette.axis }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatXof(Number(v), true)}
                  width={52}
                />
                <Tooltip
                  contentStyle={tooltipStyle(palette)}
                  formatter={(value: any) => [formatXof(Number(value)), 'Commissions']}
                />
                <Area
                  type="monotone"
                  dataKey="commission"
                  stroke={palette.primary}
                  strokeWidth={2}
                  fill="url(#commissionFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold">Inscriptions</h2>
            <span className="text-[11.5px] text-text-muted">par jour</span>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: palette.axis }}
                  tickLine={false}
                  axisLine={{ stroke: palette.grid }}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: palette.axis }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={tooltipStyle(palette)}
                  formatter={(value: any) => [value, 'Inscriptions']}
                />
                <Bar dataKey="signups" fill={palette.blue} radius={[5, 5, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Activité récente */}
      <section className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Activité récente</h2>
          <Link to="/analytics" className="text-[12.5px] text-primary hover:underline">
            Tout voir
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-text-muted">Aucune activité enregistrée.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentLogs.map((log) => (
              <li key={log.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-surface-2 grid place-items-center flex-shrink-0">
                  <ClipboardListIcon size={15} className="text-text-muted" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{actionLabel(log.action)}</div>
                  <Link
                    to={`/users/${log.userId}`}
                    className="text-[12px] text-text-muted hover:text-primary truncate block"
                  >
                    {log.user?.email ?? 'Utilisateur supprimé'}
                  </Link>
                </div>
                <span className="text-[11.5px] text-text-muted whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
