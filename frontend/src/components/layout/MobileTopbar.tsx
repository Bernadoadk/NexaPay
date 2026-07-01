import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { quotesApi, creditsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeftIcon, BellIcon, SearchIcon } from '@/components/ui/Icon';
import AiComingSoonDialog from '@/components/ui/AiComingSoonDialog';
import SearchOverlay from './SearchOverlay';
import NotificationsDropdown from './NotificationsDropdown';

interface Props {
  title: string;
  subtitle?: string;
  /** When set, replaces the back chevron logic with a custom action. */
  onBack?: () => void;
  /** Force showing back chevron even on root pages. */
  showBack?: boolean;
}

/**
 * Topbar visible only on mobile (`lg:hidden`).
 *
 * Layout, left-to-right:
 *   ← back · page title       · AI credits chip · search · bell
 *
 * The clock/battery decoration that was here is removed — the OS already shows that.
 */
export default function MobileTopbar({ title, subtitle, onBack, showBack }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showAiComingSoon, setShowAiComingSoon] = useState(false);

  // Show back chevron on every non-root page by default.
  const showBackChevron = showBack ?? pathname !== '/';

  const { data: quotes = [] } = useQuery({
    queryKey: ['notif-quotes'],
    queryFn: () => quotesApi.list().then(r => r.data),
    staleTime: 60_000,
  });
  const overdueCount = (quotes as any[]).filter((q: any) => q.status === 'OVERDUE').length;

  const { data: credits } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.balance().then(r => r.data),
    enabled: !!user,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
  const aiCredits = credits?.aiCredits ?? user?.aiCredits ?? 0;
  const lowCredits = aiCredits < 5;

  function handleBack() {
    if (onBack) return onBack();
    // Browser history if there's something to go back to, else root.
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  return (
    <>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <header className="h-12 px-3 border-b border-border flex items-center gap-1.5 bg-surface flex-shrink-0">
        {showBackChevron ? (
          <button
            onClick={handleBack}
            aria-label="Retour"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted -ml-1"
          >
            <ChevronLeftIcon size={20} />
          </button>
        ) : (
          <span className="w-2" />
        )}

        <div className="flex-1 min-w-0 leading-[1.15]">
          <div className="text-[14.5px] font-semibold truncate">{title}</div>
          {subtitle && (
            <div className="text-[10.5px] text-text-muted truncate">{subtitle}</div>
          )}
        </div>

        {/* AI credits chip — tap to view/buy */}
        {user && (
          <button
            onClick={() => setShowAiComingSoon(true)}
            title="Crédits IA bientôt disponibles"
            className={`flex items-center gap-1 h-7 px-2 rounded-full text-[11.5px] font-semibold whitespace-nowrap transition-colors ${
              lowCredits
                ? 'bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40'
                : 'bg-primary-soft text-primary-hover border border-primary-soft-2'
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
            {aiCredits}
          </button>
        )}

        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Rechercher"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted"
        >
          <SearchIcon size={17} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(v => !v)}
            aria-label="Notifications"
            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted"
          >
            <BellIcon size={17} />
            {overdueCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-danger rounded-full border-[1.5px] border-surface" />
            )}
          </button>
          <NotificationsDropdown open={notifOpen} onClose={() => setNotifOpen(false)} />
        </div>
      </header>
      <AiComingSoonDialog open={showAiComingSoon} onClose={() => setShowAiComingSoon(false)} />
    </>
  );
}
