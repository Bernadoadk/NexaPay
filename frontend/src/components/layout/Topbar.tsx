import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { quotesApi } from '@/lib/api';
import { SearchIcon, BellIcon } from '@/components/ui/Icon';
import SearchOverlay from './SearchOverlay';
import NotificationsDropdown from './NotificationsDropdown';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Preload quotes for notifications badge count
  const { data: quotes = [] } = useQuery({
    queryKey: ['notif-quotes'],
    queryFn: () => quotesApi.list().then(r => r.data),
    staleTime: 60_000,
  });
  const overdueCount = (quotes as any[]).filter((q: any) => q.status === 'OVERDUE').length;

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <header className="h-16 px-7 border-b border-border flex items-center gap-4 bg-surface flex-shrink-0 w-full">
        <div className="flex-1 leading-[1.2]">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">{title}</div>
          {subtitle && <div className="text-[12.5px] text-text-muted mt-0.5">{subtitle}</div>}
        </div>

        {/* Universal search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 h-9 rounded-sm bg-surface-2 text-text-muted text-[13px] w-[260px] border border-border hover:border-border-strong transition-colors"
        >
          <SearchIcon size={15} />
          <span className="flex-1 text-left">Rechercher devis, clients…</span>
          <kbd className="font-mono text-[11px] bg-surface border border-border rounded px-[5px] py-px text-text-muted">⌘K</kbd>
        </button>

        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative h-9 w-9 flex items-center justify-center rounded-xl hover:bg-surface-2 transition-colors"
          >
            <BellIcon size={18} />
            {overdueCount > 0 && (
              <span className="absolute top-[7px] right-[7px] w-[8px] h-[8px] bg-danger rounded-full border-[1.5px] border-surface" />
            )}
            {overdueCount === 0 && (
              <span className="absolute top-[7px] right-[7px] w-[7px] h-[7px] bg-primary rounded-full border-[1.5px] border-surface" />
            )}
          </button>
          <NotificationsDropdown open={notifOpen} onClose={() => setNotifOpen(false)} />
        </div>

        {actions}
      </header>
    </>
  );
}
