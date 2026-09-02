import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import PeriodPicker, { type PeriodDays } from '@/components/ui/PeriodPicker';
import {
  BarChart3Icon,
  UsersIcon,
  WalletIcon,
  ReceiptIcon,
  AlertCircleIcon,
  RefreshCw,
} from '@/components/ui/Icon';
import { formatDayLabel, formatXof, tooltipStyle, useChartPalette } from '@/lib/chartTheme';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const PLAN_LABELS: Record<string, string> = { FREE: 'Gratuit', PRO: 'Pro', BUSINESS: 'Business' };

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

const ACTIVITY_PAGE = 25;

export default function Analytics() {
  const queryClient = useQueryClient();
  const palette = useChartPalette();
  const [days, setDays] = useState<PeriodDays>(30);
  const [activityPage, setActivityPage] = useState(0);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats', days],
    queryFn: () => analyticsApi.stats({ days }).then((res) => res.data),
  });

  const { data: timeseries, isLoading: seriesLoading } = useQuery({
    queryKey: ['admin-timeseries', days],
    queryFn: () => analyticsApi.timeseries({ days }).then((res) => res.data),
  });

  const { data: activityData, isFetching: activityFetching } = useQuery({
    queryKey: ['admin-activity', activityPage],
    queryFn: () =>
      analyticsApi
        .activity({ limit: ACTIVITY_PAGE, offset: activityPage * ACTIVITY_PAGE })
        .then((res) => res.data),
  });

  const series: any[] = (timeseries?.series ?? []).map((point: any) => ({
    ...point,
    label: formatDayLabel(point.date),
  }));

  const planData = Object.entries((stats?.plans ?? {}) as Record<string, number>).map(([key, value]) => ({
    key,
    name: PLAN_LABELS[key] ?? key,
    value,
  }));

  const planTotal = planData.reduce((sum, plan) => sum + plan.value, 0);

  const logs: any[] = activityData?.logs ?? [];
  const activityPagination = activityData?.pagination ?? { total: 0, hasMore: false };

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    queryClient.invalidateQueries({ queryKey: ['admin-timeseries'] });
    queryClient.invalidateQueries({ queryKey: ['admin-activity'] });
  }

  const volume = stats?.volume ?? {};
  const revenue = stats?.revenue ?? {};
  const users = stats?.users ?? {};

  return (
    <div className="p-5 sm:p-6 space-y-5 overflow-y-auto h-full scrollbar-thin">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">Analytics</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            Tendances d'usage et de revenus sur {days} jours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodPicker value={days} onChange={setDays} />
          <Button variant="outline" onClick={refreshAll} aria-label="Actualiser">
            <RefreshCw size={16} />
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Commissions"
          value={formatXof(revenue.commissionPeriod ?? 0)}
          Icon={WalletIcon}
          tone="primary"
          trend={revenue.trend ?? null}
        />
        <StatCard
          label="Volume traité"
          value={formatXof(volume.gmvPeriod ?? 0)}
          Icon={ReceiptIcon}
          hint={`${volume.transactionsPeriod ?? 0} transactions`}
        />
        <StatCard
          label="Nouveaux comptes"
          value={String(users.newPeriod ?? 0)}
          Icon={UsersIcon}
          trend={users.trend ?? null}
        />
        <StatCard
          label="Reversements en échec"
          value={String(volume.failedPayouts ?? 0)}
          Icon={AlertCircleIcon}
          tone={volume.failedPayouts > 0 ? 'danger' : 'default'}
          trendPositiveIsGood={false}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-surface border border-border rounded-xl p-4 sm:p-5">
          <h2 className="text-[14px] font-semibold mb-4">Activité de la plateforme</h2>
          <div className="h-[260px]">
            {seriesLoading ? (
              <div className="h-full rounded-lg bg-surface-2 animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
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
                    width={32}
                  />
                  <Tooltip contentStyle={tooltipStyle(palette)} />
                  <Legend wrapperStyle={{ fontSize: 12, color: palette.axis }} />
                  <Line
                    type="monotone"
                    dataKey="quotes"
                    name="Devis"
                    stroke={palette.blue}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="payments"
                    name="Paiements"
                    stroke={palette.primary}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="signups"
                    name="Inscriptions"
                    stroke={palette.warn}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
          <h2 className="text-[14px] font-semibold mb-4">Répartition des plans</h2>

          {/*
            Barres de proportion plutôt qu'un camembert : les valeurs sont
            lisibles directement, la comparaison est plus juste sur 3 catégories,
            et on évite le secteur unique que Recharts ne dessine pas.
          */}
          {isLoading ? (
            <div className="h-[220px] rounded-lg bg-surface-2 animate-pulse" />
          ) : planTotal === 0 ? (
            <div className="h-[220px] grid place-items-center text-[13px] text-text-muted">
              Aucune donnée
            </div>
          ) : (
            <div className="space-y-4">
              {planData.map((plan, index) => {
                const share = planTotal > 0 ? (plan.value / planTotal) * 100 : 0;
                const color = palette.categorical[index % palette.categorical.length];
                return (
                  <div key={plan.key}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[13px] font-medium text-text">{plan.name}</span>
                      <span className="text-[12.5px] text-text-muted tabular-nums">
                        <span className="font-semibold text-text">{plan.value}</span>
                        {' · '}
                        {share.toFixed(share < 10 ? 1 : 0)} %
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(share, 2)}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 mt-1 border-t border-border flex items-baseline justify-between">
                <span className="text-[12px] text-text-muted">Comptes payants</span>
                <span className="text-[13px] font-semibold">
                  {users.paying ?? 0}{' '}
                  <span className="text-[12px] font-normal text-text-muted">
                    ({users.conversionRate ?? 0} %)
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-4 sm:p-5">
        <h2 className="text-[14px] font-semibold mb-4">Commissions journalières</h2>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
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
              <Bar dataKey="commission" fill={palette.primary} radius={[5, 5, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Journal d'activité */}
      <section className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-[14px] font-semibold flex items-center gap-2">
            <BarChart3Icon size={16} className="text-text-muted" />
            Journal d'activité
          </h2>
          <span className="text-[12px] text-text-muted">{activityPagination.total} entrées</span>
        </div>

        {logs.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-text-muted">Aucune activité enregistrée.</p>
        ) : (
          <ul className={`divide-y divide-border ${activityFetching ? 'opacity-60' : ''}`}>
            {logs.map((log) => (
              <li key={log.id} className="px-4 sm:px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium">
                    {ACTION_LABELS[log.action] ?? log.action.replace(/_/g, ' ')}
                  </div>
                  <Link
                    to={`/users/${log.userId}`}
                    className="text-[12px] text-text-muted hover:text-primary truncate block"
                  >
                    {log.user?.email ?? 'Utilisateur supprimé'}
                  </Link>
                  {log.details && typeof log.details === 'object' && (
                    <div className="text-[11.5px] text-text-subtle mt-1 truncate">
                      {Object.entries(log.details as Record<string, unknown>)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </div>
                  )}
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

        {(activityPage > 0 || activityPagination.hasMore) && (
          <div className="px-4 sm:px-5 py-3 border-t border-border flex items-center justify-between">
            <Button
              variant="outline"
              disabled={activityPage === 0}
              onClick={() => setActivityPage((p) => Math.max(0, p - 1))}
            >
              Précédent
            </Button>
            <span className="text-[12.5px] text-text-muted">Page {activityPage + 1}</span>
            <Button
              variant="outline"
              disabled={!activityPagination.hasMore}
              onClick={() => setActivityPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
