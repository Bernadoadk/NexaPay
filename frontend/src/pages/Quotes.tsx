import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '@/lib/api';
import { useStagger, useChildrenStagger } from '@/hooks/useAnime';
import { fmtXOF, fmtDateFR } from '@/lib/utils';
import type { Quote, QuoteStatus } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ContextMenu from '@/components/ui/ContextMenu';
import { PlusIcon, DownloadIcon, SearchIcon, FilterIcon, MoreIcon, EditIcon, CopyIcon, TrashIcon, SendIcon } from '@/components/ui/Icon';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'Tous', value: '' },
  { label: 'Brouillon', value: 'DRAFT' },
  { label: 'Envoyé', value: 'SENT' },
  { label: 'Payé', value: 'PAID' },
  { label: 'En retard', value: 'OVERDUE' },
  { label: 'Annulé', value: 'CANCELLED' },
];

function exportQuotesCSV(quotes: Quote[]) {
  const rows = [
    ['Numéro', 'Client', 'Objet', 'Date', 'Montant', 'Statut'],
    ...quotes.map(q => [
      q.number, q.client?.name ?? '', q.title,
      fmtDateFR(q.issuedAt), String(q.total), q.status,
    ]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'devis-nexapay.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function Quotes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const activeStatus = searchParams.get('status') || '';
  const qc = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ['quotes', activeStatus],
    queryFn: () => quotesApi.list(activeStatus ? { status: activeStatus } : undefined).then(r => r.data),
    refetchInterval: (q) => (q.state.data ?? []).some(qt => qt.status === 'SENT') ? 10000 : false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => quotesApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['notif-quotes'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => quotesApi.duplicate(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      navigate(`/quotes/${res.data.id}`);
    },
  });

  const filtered = quotes.filter(q =>
    search === '' ||
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    q.number.toLowerCase().includes(search.toLowerCase()) ||
    (q.client?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const tableBodyRef = useStagger<HTMLTableSectionElement>('tr', [filtered.length, activeStatus], { stagger: 40 });
  const mobileListRef = useChildrenStagger<HTMLDivElement>([filtered.length, activeStatus], { stagger: 50 });

  function getMenuItems(q: Quote) {
    return [
      {
        label: 'Voir le détail',
        icon: null,
        onClick: () => navigate(`/quotes/${q.id}`),
      },
      {
        label: 'Modifier',
        icon: <EditIcon size={13} />,
        onClick: () => navigate(`/quotes/${q.id}/edit`),
      },
      {
        label: 'Dupliquer',
        icon: <CopyIcon size={13} />,
        onClick: () => duplicateMutation.mutate(q.id),
      },
      ...(q.status !== 'SENT' && q.status !== 'PAID' ? [{
        label: 'Marquer envoyé',
        icon: <SendIcon size={13} />,
        onClick: () => statusMutation.mutate({ id: q.id, status: 'SENT' }),
      }] : []),
      ...(q.status !== 'PAID' ? [{
        label: 'Marquer payé',
        icon: null,
        onClick: () => statusMutation.mutate({ id: q.id, status: 'PAID' }),
      }] : []),
      {
        label: 'Supprimer',
        icon: <TrashIcon size={13} />,
        danger: true,
        onClick: () => {
          if (confirm(`Supprimer ${q.number} ?`)) deleteMutation.mutate(q.id);
        },
      },
    ];
  }

  // Count per status for badge
  const countByStatus: Record<string, number> = {};
  quotes.forEach(q => { countByStatus[q.status] = (countByStatus[q.status] ?? 0) + 1; });

  return (
    <div className="h-full overflow-auto scrollbar-thin p-6 lg:p-7">
      {/* Header */}
      <div className="flex items-center mb-4 lg:mb-5">
        <div className="flex-1">
          <div className="text-[22px] font-semibold tracking-[-0.02em] lg:hidden">Devis</div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportQuotesCSV(filtered)}>
            <DownloadIcon size={14} /> Exporter
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/quotes/new')}>
            <PlusIcon size={14} /> Nouveau devis
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-0 mb-4 border-b border-border overflow-x-auto">
        {STATUS_TABS.map(tab => {
          const count = tab.value === '' ? quotes.length : (countByStatus[tab.value] ?? 0);
          return (
            <button
              key={tab.value}
              onClick={() => setSearchParams(tab.value ? { status: tab.value } : {})}
              className={`px-4 py-2.5 text-[13.5px] font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeStatus === tab.value
                ? 'border-primary text-primary-hover'
                : 'border-transparent text-text-muted hover:text-text'
                }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${activeStatus === tab.value ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-text-muted'
                  }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2.5 mb-4">
        <div className="relative flex-1 max-w-[380px]">
          <SearchIcon size={15} className="absolute left-3 top-[13px] text-text-muted" />
          <input
            className="w-full h-10 pl-9 pr-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            placeholder="Rechercher par titre, numéro, client…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block bg-surface border border-border rounded overflow-hidden shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['', 'Numéro', 'Client', 'Objet', 'Date', 'Montant', 'Statut', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-[0.02em] border-b border-border bg-surface-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={tableBodyRef}>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-text-muted text-[13px]">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <div className="text-[14px] text-text-muted">Aucun devis trouvé</div>
                  {!activeStatus && (
                    <button onClick={() => navigate('/quotes/new')} className="mt-2 text-primary text-[13px] font-medium hover:underline">
                      Créer votre premier devis
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map(q => (
                <tr
                  key={q.id}
                  onClick={() => navigate(`/quotes/${q.id}`)}
                  className="border-t border-border hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3.5"><input type="checkbox" onClick={e => e.stopPropagation()} /></td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-[13px] font-semibold">{q.number}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {q.client && (
                      <div className="flex items-center gap-2.5">
                        <Avatar name={q.client.name} color={q.client.color} size={28} />
                        <span className="text-[13.5px] font-medium">{q.client.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] max-w-[200px] truncate">{q.title}</td>
                  <td className="px-4 py-3.5 text-[13px] text-text-muted">{fmtDateFR(q.issuedAt)}</td>
                  <td className="px-4 py-3.5 font-mono font-semibold text-[13.5px]">{fmtXOF(q.total)}</td>
                  <td className="px-4 py-3.5"><Badge
                    status={q.status === 'SENT' && q.paymentRef ? 'AWAITING' : q.status}
                    pulse={q.status === 'SENT' && !!q.paymentRef}
                  /></td>
                  <td className="px-4 py-3.5">
                    <ContextMenu items={getMenuItems(q)}>
                      <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted">
                        <MoreIcon size={16} />
                      </button>
                    </ContextMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div ref={mobileListRef} className="lg:hidden flex flex-col gap-2">
        {isLoading ? (
          <div className="text-center py-12 text-text-muted text-[13px]">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[14px] text-text-muted">Aucun devis</div>
            {!activeStatus && (
              <button onClick={() => navigate('/quotes/new')} className="mt-2 text-primary text-[13px] underline">Créer un devis</button>
            )}
          </div>
        ) : (
          filtered.map(q => (
            <div key={q.id} className="flex items-center gap-3 p-3 bg-surface border border-border rounded shadow-sm">
              <button
                onClick={() => navigate(`/quotes/${q.id}`)}
                className="flex items-center gap-3 flex-1 text-left min-w-0"
              >
                {q.client && <Avatar name={q.client.name} color={q.client.color} size={40} />}
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{q.title}</div>
                  <div className="text-[11.5px] text-text-muted mt-0.5">
                    {q.client?.name.split(' ')[0]} · <span className="font-mono">{q.number.slice(-4)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-semibold text-[13px]">{fmtXOF(q.total)}</div>
                  <div className="mt-1"><Badge
                    status={q.status === 'SENT' && q.paymentRef ? 'AWAITING' : q.status}
                    pulse={q.status === 'SENT' && !!q.paymentRef}
                  /></div>
                </div>
              </button>
              <ContextMenu items={getMenuItems(q)}>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted flex-shrink-0">
                  <MoreIcon size={16} />
                </button>
              </ContextMenu>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
