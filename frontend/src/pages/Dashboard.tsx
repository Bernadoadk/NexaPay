import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { fmtXOF, fmtDateFR } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { DashboardStats, Quote } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DatePicker';
import {
  PlusIcon, UsersIcon, SendIcon, ReceiptIcon,
  ArrowUpIcon, ArrowDownIcon, ArrowRightIcon,
  CalendarIcon, DownloadIcon, ChevronRightIcon, ChevronDownIcon,
} from '@/components/ui/Icon';
import { useEntrance, useChildrenStagger, useCountUp } from '@/hooks/useAnime';

function Sparkline({ points, color = '#0F8F65' }: { points: number[]; color?: string }) {
  const w = 80, h = 28;
  const max = Math.max(...points), min = Math.min(...points);
  const range = max - min || 1;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ label, value, numericValue, delta, deltaDir = 'up', sub, sparkline }: {
  label: string; value: string; numericValue?: number; delta?: string; deltaDir?: 'up' | 'down'; sub?: string; sparkline?: React.ReactNode;
}) {
  const countRef = useCountUp(numericValue ?? 0, [numericValue]);
  return (
    <Card className="flex-1 min-w-0">
      <div className="text-[12.5px] text-text-muted font-semibold">{label}</div>
      <div className="flex items-baseline gap-2.5 mt-1.5">
        <div className="font-mono font-num text-[26px] font-semibold tracking-[-0.02em]">
          {numericValue != null
            ? <span ref={countRef as React.RefObject<HTMLSpanElement>}>0</span>
            : value}
        </div>
        {delta && (
          <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${deltaDir === 'up' ? 'text-primary-hover' : 'text-danger'}`}>
            {deltaDir === 'up' ? <ArrowUpIcon size={11} strokeWidth={2.2} /> : <ArrowDownIcon size={11} strokeWidth={2.2} />}
            {delta}
          </span>
        )}
      </div>
      <div className="flex items-end gap-2 mt-3">
        <div className="text-[11.5px] text-text-subtle flex-1 leading-snug">{sub}</div>
        {sparkline}
      </div>
    </Card>
  );
}

function RevenueChart({ data }: { data: DashboardStats['monthlyRevenue'] }) {
  const max = Math.max(...data.flatMap(d => [d.paid, d.sent]), 1);
  return (
    <div className="flex items-end gap-[18px] h-[180px] px-1">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
          <div className="h-[160px] w-full flex items-end justify-center gap-1">
            <div className="w-3.5 bg-primary rounded-t-[4px]" style={{ height: `${(d.paid / max) * 100}%` }} />
            <div className="w-3.5 bg-primary-soft-2 rounded-t-[4px]" style={{ height: `${(d.sent / max) * 100}%` }} />
          </div>
          <div className="text-[11px] text-text-muted">{d.month}</div>
        </div>
      ))}
    </div>
  );
}

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

const PRESETS = [
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date();
  const defaultFrom = toISO(new Date(today.getFullYear(), today.getMonth(), 1));
  const defaultTo = toISO(today);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', from, to],
    queryFn: () => dashboardApi.stats({ from, to }).then(r => r.data),
  });

  const greetingRef = useEntrance<HTMLDivElement>('fadeIn', { duration: 500 });
  const statsRef = useChildrenStagger<HTMLDivElement>([!!stats], { stagger: 80, delay: 60 });
  const actionsRef = useChildrenStagger<HTMLDivElement>([!!stats], { stagger: 55, delay: 200 });
  const chartsRef = useChildrenStagger<HTMLDivElement>([!!stats], { stagger: 100, delay: 300 });

  const todayLabel = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  function applyPreset(days: number) {
    const d = new Date();
    d.setDate(d.getDate() - days + 1);
    setFrom(toISO(d));
    setTo(toISO(today));
    setShowDatePicker(false);
  }

  function exportCSV() {
    if (!stats) return;
    const rows = [
      ['Mois', 'Encaissé (FCFA)', 'Envoyé (FCFA)'],
      ...stats.monthlyRevenue.map(r => [r.month, String(r.paid * 1_000_000), String(r.sent * 1_000_000)]),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NexaPay-export-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const quickActions = [
    { icon: PlusIcon, label: 'Créer un devis', sub: 'Nouveau document à envoyer', accent: true, onClick: () => navigate('/quotes/new') },
    { icon: UsersIcon, label: 'Ajouter un client', sub: 'Élargir votre carnet d\'adresses', onClick: () => navigate('/clients') },
    { icon: SendIcon, label: 'Relancer impayés', sub: `${stats.overdueCount} facture(s) en retard`, onClick: () => navigate('/quotes?status=OVERDUE') },
    { icon: ReceiptIcon, label: 'Catalogue produits', sub: 'Gérer vos prestations & tarifs', onClick: () => navigate('/products') },
  ];

  return (
    <div className="h-full overflow-auto scrollbar-thin p-6 lg:p-7 space-y-[18px]">
      {/* Greeting */}
      <div ref={greetingRef} className="flex items-end flex-wrap gap-3">
        <div className="flex-1">
          <div className="text-[22px] font-semibold tracking-[-0.02em]">Bonjour {user?.name?.split(' ')[0]}</div>
          <div className="text-[13.5px] text-text-muted mt-1 capitalize">{todayLabel}</div>
        </div>
        <div className="hidden lg:flex gap-2 items-center relative">
          {/* Preset buttons */}
          {PRESETS.map(p => (
            <button
              key={p.days}
              onClick={() => applyPreset(p.days)}
              className="h-8 px-3 text-[12.5px] font-medium text-text-muted rounded-sm border border-border hover:bg-surface-2 transition-colors"
            >
              {p.label}
            </button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setShowDatePicker(v => !v)}>
            <CalendarIcon size={14} /> {from} → {to} <ChevronDownIcon size={13} />
          </Button>
          {showDatePicker && (
            <div className="absolute right-0 top-full mt-1 z-20">
              <DateRangePicker
                from={from} to={to}
                onFromChange={v => setFrom(v)}
                onToChange={v => { setTo(v); setShowDatePicker(false); }}
              />
            </div>
          )}
          <Button size="sm" variant="secondary" onClick={exportCSV}>
            <DownloadIcon size={14} /> Exporter CSV
          </Button>
        </div>
      </div>

      {/* Mobile hero card */}
      <div className="lg:hidden rounded-xl p-[18px] text-white" style={{ background: 'linear-gradient(135deg,#0F8F65,#0C7A56)', boxShadow: '0 12px 28px -10px rgba(15,143,101,0.5)' }}>
        <div className="text-[12px] opacity-85">Encaissé sur la période</div>
        <div className="font-mono font-num text-[28px] font-semibold tracking-[-0.02em] mt-1">{fmtXOF(stats.revenue)}</div>
        <div className="flex items-center gap-1.5 text-[12px] mt-1.5 opacity-90">
          {stats.revenueGrowth >= 0
            ? <><ArrowUpIcon size={12} strokeWidth={2.2} /> +{stats.revenueGrowth} % vs. mois dernier</>
            : <><ArrowDownIcon size={12} strokeWidth={2.2} /> {stats.revenueGrowth} % vs. mois dernier</>
          }
        </div>
        <div className="flex gap-2 mt-4">
          <div className="flex-1 px-3 py-2.5 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <div className="text-[10.5px] opacity-85">Devis</div>
            <div className="font-mono font-semibold text-[16px] mt-0.5">{stats.totalQuotes}</div>
          </div>
          <div className="flex-1 px-3 py-2.5 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <div className="text-[10.5px] opacity-85">En attente</div>
            <div className="font-mono font-semibold text-[16px] mt-0.5">{fmtXOF(stats.pending / 1_000_000).replace(' F', 'M')}</div>
          </div>
        </div>
      </div>

      {/* Stat cards — desktop only */}
      <div ref={statsRef} className="hidden lg:flex gap-3.5">
        <StatCard label="Total devis" value={String(stats.totalQuotes)} numericValue={stats.totalQuotes} delta="+12%"
          sub="sur la période sélectionnée"
          sparkline={<Sparkline points={[3, 5, 4, 7, 6, 9, stats.totalQuotes]} />} />
        <StatCard label="Clients actifs" value={String(stats.totalClients)} numericValue={stats.totalClients}
          sub="clients enregistrés" sparkline={<Sparkline points={[20, 21, 23, 22, 25, 27, stats.totalClients]} color="#2563EB" />} />
        <StatCard label="Revenus encaissés" value={fmtXOF(stats.revenue)}
          delta={stats.revenueGrowth >= 0 ? `+${stats.revenueGrowth}%` : `${stats.revenueGrowth}%`}
          deltaDir={stats.revenueGrowth >= 0 ? 'up' : 'down'}
          sub="vs. mois précédent" sparkline={<Sparkline points={[8, 9, 11, 10, 12, 13, stats.revenue / 1_000_000]} />} />
        <StatCard label="En attente paiement" value={fmtXOF(stats.pending)}
          delta={`${stats.overdueCount} retard(s)`} deltaDir="down"
          sub="devis envoyés" sparkline={<Sparkline points={[4, 3.5, 4.2, 3.8, 4.1, 3.6, stats.pending / 1_000_000]} color="#C2691B" />} />
      </div>

      {/* Quick actions */}
      <div ref={actionsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map(({ icon: Icon, label, sub, accent, onClick }) => (
          <button key={label} onClick={onClick} className={`flex items-center gap-3 p-3 rounded-[10px] border text-left transition-colors hover:bg-surface-2 ${accent ? 'border-primary-soft-2 bg-primary-soft' : 'border-border bg-surface shadow-sm'}`}>
            <div className={`w-[34px] h-[34px] rounded-[9px] grid place-items-center flex-shrink-0 ${accent ? 'bg-primary text-white' : 'bg-surface-2 text-text'}`}>
              <Icon size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[13.5px] font-semibold ${accent ? 'text-primary-hover' : 'text-text'}`}>{label}</div>
              <div className="text-[11.5px] text-text-muted mt-0.5 truncate">{sub}</div>
            </div>
            <ChevronRightIcon size={15} className="text-text-subtle flex-shrink-0 hidden lg:block" />
          </button>
        ))}
      </div>

      {/* Chart + Recent quotes */}
      <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5">
        <Card>
          <div className="flex items-center mb-4">
            <div className="flex-1">
              <div className="text-[14px] font-semibold">Revenus mensuels</div>
              <div className="text-[12px] text-text-muted mt-0.5">Encaissés vs. en attente — en millions XOF</div>
            </div>
            <div className="hidden lg:flex gap-3.5 text-[12px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-primary rounded-[2px]" /> Encaissé</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-primary-soft-2 rounded-[2px]" /> Envoyé</span>
            </div>
          </div>
          {stats.monthlyRevenue.length > 0
            ? <RevenueChart data={stats.monthlyRevenue} />
            : <div className="h-[180px] flex items-center justify-center text-text-muted text-[13px]">Aucune donnée encore</div>
          }
        </Card>

        <Card padding={false}>
          <div className="px-[18px] pt-4 pb-3 flex items-center">
            <div className="flex-1 text-[14px] font-semibold">Devis récents</div>
            <button onClick={() => navigate('/quotes')} className="text-[13px] text-text-muted hover:text-text flex items-center gap-1">
              Voir tout <ArrowRightIcon size={13} />
            </button>
          </div>
          {stats.recentQuotes.length === 0 ? (
            <div className="px-[18px] pb-4 text-[13px] text-text-muted">Aucun devis encore. <button onClick={() => navigate('/quotes/new')} className="text-primary underline">Créer un premier devis</button></div>
          ) : (
            stats.recentQuotes.map((q: Quote) => (
              <button
                key={q.id}
                onClick={() => navigate(`/quotes/${q.id}`)}
                className="flex items-center gap-3 w-full px-[18px] py-2.5 border-t border-border hover:bg-surface-2 transition-colors text-left"
              >
                {q.client && <Avatar name={q.client.name} color={q.client.color} size={30} />}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{q.title}</div>
                  <div className="text-[11.5px] text-text-muted mt-0.5">
                    <span className="font-mono">{q.number}</span> · {q.client?.name.split(' ')[0]}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-semibold text-[13px]">{fmtXOF(q.total)}</div>
                  <div className="mt-0.5">
                    <Badge
                      status={q.status === 'SENT' && q.paymentRef ? 'AWAITING' : q.status}
                      pulse={q.status === 'SENT' && !!q.paymentRef}
                    />
                  </div>
                </div>
              </button>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
