import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { quotesApi } from '@/lib/api';
import { fmtXOF, fmtDateFR } from '@/lib/utils';
import { BellIcon, AlertCircleIcon, CheckCircleIcon, SendIcon, FileIcon } from '@/components/ui/Icon';
import Badge from '@/components/ui/Badge';
import type { Quote } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

function notifIcon(status: string) {
  if (status === 'OVERDUE') return <AlertCircleIcon size={14} className="text-danger flex-shrink-0" />;
  if (status === 'PAID') return <CheckCircleIcon size={14} className="text-primary flex-shrink-0" />;
  if (status === 'SENT') return <SendIcon size={14} className="text-blue flex-shrink-0" />;
  return <FileIcon size={14} className="text-text-muted flex-shrink-0" />;
}

function notifLabel(q: Quote): string {
  if (q.status === 'OVERDUE') return `Devis en retard de paiement`;
  if (q.status === 'PAID') return `Paiement reçu`;
  if (q.status === 'SENT') return `Devis envoyé au client`;
  if (q.status === 'DRAFT') return `Brouillon créé`;
  return `Statut mis à jour`;
}

export default function NotificationsDropdown({ open, onClose }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ['notif-quotes'],
    queryFn: () => quotesApi.list().then(r => r.data),
    staleTime: 60_000,
  });

  // Show overdue first, then recently updated (last 30 days)
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 30);

  const notifs = quotes
    .filter(q => q.status === 'OVERDUE' || new Date(q.updatedAt) > threshold)
    .sort((a, b) => {
      if (a.status === 'OVERDUE' && b.status !== 'OVERDUE') return -1;
      if (b.status === 'OVERDUE' && a.status !== 'OVERDUE') return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 8);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 w-[360px] bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden"
      style={{ boxShadow: '0 12px 32px rgba(15,20,18,0.14)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center">
        <div className="flex items-center gap-2 flex-1">
          <BellIcon size={15} className="text-text-muted" />
          <span className="text-[13.5px] font-semibold">Notifications</span>
          {notifs.some(q => q.status === 'OVERDUE') && (
            <span className="px-1.5 py-px bg-danger text-white text-[11px] font-bold rounded-full">
              {notifs.filter(q => q.status === 'OVERDUE').length}
            </span>
          )}
        </div>
        <button className="text-[12px] text-primary hover:underline">Tout marquer lu</button>
      </div>

      {/* Items */}
      <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
        {notifs.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-text-muted">
            Aucune notification pour l'instant
          </div>
        ) : (
          notifs.map(q => (
            <button
              key={q.id}
              onClick={() => { onClose(); navigate(`/quotes/${q.id}`); }}
              className="flex items-start gap-3 w-full px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2 transition-colors text-left"
            >
              <div className="mt-0.5">{notifIcon(q.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate">{q.title}</div>
                <div className="text-[11.5px] text-text-muted mt-0.5">{notifLabel(q)}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge
                    status={q.status === 'SENT' && q.paymentRef ? 'AWAITING' : q.status}
                    pulse={q.status === 'SENT' && !!q.paymentRef}
                  />
                  <span className="text-[11px] text-text-subtle">{fmtDateFR(q.updatedAt)}</span>
                  <span className="text-[11px] font-mono text-text-muted ml-auto">{fmtXOF(q.total)}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border">
        <button
          onClick={() => { onClose(); navigate('/quotes?status=OVERDUE'); }}
          className="w-full text-[12px] text-center text-text-muted hover:text-text transition-colors"
        >
          Voir tous les devis en retard →
        </button>
      </div>
    </div>
  );
}
