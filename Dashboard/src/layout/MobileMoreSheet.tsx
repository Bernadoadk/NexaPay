import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { analyticsApi } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import {
  SettingsIcon,
  LogOutIcon,
  XIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  BarChart3Icon,
  UsersIcon,
} from '@/components/ui/Icon';

/**
 * Feuille « Plus » du back-office sur mobile.
 *
 * Reprend le pattern de l'application cliente (feuille ancrée en bas, poignée,
 * fermeture au voile) mais avec un contenu d'administration : plus de crédits
 * IA, de badge d'abonnement ni d'installation PWA — c'était du copié-collé.
 */
interface Props {
  open: boolean;
  onClose: () => void;
}

function SheetItem({
  label,
  hint,
  icon,
  onClick,
  tone = 'default',
}: {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left"
    >
      <span
        className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-text-muted'
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[13.5px] font-medium ${tone === 'danger' ? 'text-danger' : 'text-text'}`}>
          {label}
        </span>
        {hint && <span className="block text-[12px] text-text-muted truncate">{hint}</span>}
      </span>
      <ChevronRightIcon size={16} className="text-text-subtle flex-shrink-0" />
    </button>
  );
}

export default function MobileMoreSheet({ open, onClose }: Props) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['sidebar-health'],
    queryFn: () => analyticsApi.stats().then((r) => r.data),
    enabled: open,
  });
  const failedPayouts = stats?.volume?.failedPayouts ?? 0;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function go(path: string) {
    navigate(path);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Menu"
        className="fixed inset-x-0 bottom-0 z-[9999] bg-surface border-t border-border rounded-t-2xl overflow-hidden lg:hidden max-h-[85vh] flex flex-col"
      >
        <div className="pt-2.5 pb-1 grid place-items-center">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        <header className="px-4 py-3 flex items-center gap-3 border-b border-border">
          <Avatar name={user?.name ?? 'A'} photoUrl={user?.logoUrl} color="#14201C" size={38} />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold truncate">{user?.name}</div>
            <div className="text-[12px] text-text-muted truncate">{user?.email}</div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="w-8 h-8 rounded-lg grid place-items-center text-text-muted hover:bg-surface-2"
          >
            <XIcon size={16} />
          </button>
        </header>

        <div className="overflow-y-auto scrollbar-thin">
          {failedPayouts > 0 && (
            <button
              type="button"
              onClick={() => go('/analytics')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-danger-soft border-b border-danger/20 text-left"
            >
              <AlertCircleIcon size={18} className="text-danger flex-shrink-0" />
              <span className="flex-1 text-[13px] font-semibold text-danger">
                {failedPayouts} reversement{failedPayouts > 1 ? 's' : ''} en échec
              </span>
              <ChevronRightIcon size={16} className="text-danger" />
            </button>
          )}

          <SheetItem
            label="Utilisateurs"
            hint="Comptes, plans, crédits"
            icon={<UsersIcon size={17} />}
            onClick={() => go('/users')}
          />
          <SheetItem
            label="Analytics"
            hint="Tendances et journal d'activité"
            icon={<BarChart3Icon size={17} />}
            onClick={() => go('/analytics')}
          />
          <SheetItem
            label="Réglages"
            hint="Compte et maintenance"
            icon={<SettingsIcon size={17} />}
            onClick={() => go('/settings')}
          />

          <div className="px-4 py-3 flex items-center justify-between border-t border-border">
            <span className="text-[13.5px] font-medium">Mode sombre</span>
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              aria-label="Mode sombre"
              onClick={toggleTheme}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isDark ? 'bg-primary' : 'bg-border-strong'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  isDark ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="border-t border-border pb-[max(env(safe-area-inset-bottom),0.5rem)]">
            <SheetItem
              label="Se déconnecter"
              icon={<LogOutIcon size={17} />}
              tone="danger"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
