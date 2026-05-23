import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clientsApi, quotesApi } from '@/lib/api';
import { fmtXOF } from '@/lib/utils';
import { SearchIcon, XIcon, UsersIcon, FileIcon } from '@/components/ui/Icon';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import type { Client, Quote } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ open, onClose }: Props) {
  const [q, setQ] = useState('');
  const [focusIdx, setFocusIdx] = useState(-1);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setFocusIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const enabled = q.trim().length >= 2;

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['search-clients', q],
    queryFn: () => clientsApi.list(q).then(r => r.data),
    enabled,
    staleTime: 10_000,
  });

  const { data: allQuotes = [] } = useQuery<Quote[]>({
    queryKey: ['search-quotes-all'],
    queryFn: () => quotesApi.list().then(r => r.data),
    staleTime: 30_000,
  });

  const filteredQuotes = enabled
    ? allQuotes.filter(qt =>
        qt.title?.toLowerCase().includes(q.toLowerCase()) ||
        qt.number?.toLowerCase().includes(q.toLowerCase()) ||
        qt.client?.name?.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 5)
    : [];

  const clientSlice = clients.slice(0, 4);
  const allItems: Array<{ type: 'client'; data: Client } | { type: 'quote'; data: Quote }> = [
    ...clientSlice.map(c => ({ type: 'client' as const, data: c })),
    ...filteredQuotes.map(qt => ({ type: 'quote' as const, data: qt })),
  ];
  const hasResults = allItems.length > 0;

  function go(path: string) {
    onClose();
    navigate(path);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && focusIdx >= 0) {
      const item = allItems[focusIdx];
      if (item.type === 'client') go('/clients');
      else go(`/quotes/${item.data.id}`);
    }
  }

  if (!open) return null;

  let itemIdx = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      style={{ background: 'rgba(15,20,18,0.35)' }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[560px] mx-4 bg-surface rounded-xl shadow-2xl border border-border overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
          <SearchIcon size={18} className="text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => { setQ(e.target.value); setFocusIdx(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher devis, clients…"
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-text placeholder:text-text-muted"
          />
          {q ? (
            <button onClick={() => setQ('')} className="text-text-muted hover:text-text transition-colors">
              <XIcon size={16} />
            </button>
          ) : (
            <kbd className="font-mono text-[11px] bg-surface-2 border border-border rounded px-[5px] py-px text-text-muted">Esc</kbd>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
          {!enabled && (
            <div className="px-4 py-10 text-center text-[13px] text-text-muted">
              Tapez au moins 2 caractères pour rechercher
            </div>
          )}

          {enabled && !hasResults && (
            <div className="px-4 py-10 text-center text-[13px] text-text-muted">
              Aucun résultat pour «&nbsp;{q}&nbsp;»
            </div>
          )}

          {clientSlice.length > 0 && (
            <section>
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] flex items-center gap-1.5">
                <UsersIcon size={11} /> Clients
              </div>
              {clientSlice.map(c => {
                itemIdx++;
                const idx = itemIdx;
                return (
                  <button
                    key={c.id}
                    onClick={() => go('/clients')}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 transition-colors text-left ${focusIdx === idx ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
                  >
                    <Avatar name={c.name} color={c.color} size={30} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{c.name}</div>
                      <div className="text-[11.5px] text-text-muted truncate">{c.city ?? c.email ?? ''}</div>
                    </div>
                    <span className="text-[11.5px] text-text-muted">{c.quotesCount ?? 0} devis</span>
                  </button>
                );
              })}
            </section>
          )}

          {filteredQuotes.length > 0 && (
            <section>
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] flex items-center gap-1.5">
                <FileIcon size={11} /> Devis
              </div>
              {filteredQuotes.map(qt => {
                itemIdx++;
                const idx = itemIdx;
                return (
                  <button
                    key={qt.id}
                    onClick={() => go(`/quotes/${qt.id}`)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 transition-colors text-left ${focusIdx === idx ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
                  >
                    <div className="w-[30px] h-[30px] rounded-md bg-surface-2 grid place-items-center flex-shrink-0">
                      <FileIcon size={14} className="text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{qt.title}</div>
                      <div className="text-[11.5px] text-text-muted">
                        <span className="font-mono">{qt.number}</span>
                        {qt.client && ` · ${qt.client.name}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono text-[13px] font-semibold">{fmtXOF(qt.total)}</span>
                      <Badge
                        status={qt.status === 'SENT' && qt.paymentRef ? 'AWAITING' : qt.status}
                        pulse={qt.status === 'SENT' && !!qt.paymentRef}
                      />
                    </div>
                  </button>
                );
              })}
            </section>
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2.5 border-t border-border flex gap-4 text-[11px] text-text-muted">
          <span><kbd className="font-mono bg-surface-2 border border-border rounded px-1 mr-1">↑↓</kbd>naviguer</span>
          <span><kbd className="font-mono bg-surface-2 border border-border rounded px-1 mr-1">↵</kbd>ouvrir</span>
          <span><kbd className="font-mono bg-surface-2 border border-border rounded px-1 mr-1">Esc</kbd>fermer</span>
        </div>
      </div>
    </div>
  );
}
