import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { creditsApi } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import PwaInstallSheet from './PwaInstallSheet';
import {
  DownloadIcon, ReceiptIcon, SettingsIcon, WalletIcon, LogOutIcon, XIcon, ChevronRightIcon,
} from '@/components/ui/Icon';

const PLAN_LABELS: Record<string, string> = { FREE: 'Gratuit', PRO: 'Pro', BUSINESS: 'Business' };

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-up sheet behind the "Plus" tab of the mobile bottom nav.
 * Hosts every page that doesn't fit in the 4 main tabs.
 */
export default function MobileMoreSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [installOpen, setInstallOpen] = useState(false);

  // Lock body scroll behind the sheet
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const { data: credits } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.balance().then(r => r.data),
    enabled: !!user && open,
    staleTime: 30_000,
  });
  const aiCredits = credits?.aiCredits ?? user?.aiCredits ?? 0;
  const monthlyQuota = credits?.monthlyQuota ?? 0;
  const plan = user?.plan ?? 'FREE';

  function go(path: string) {
    onClose();
    setTimeout(() => navigate(path), 100); // let the sheet close before navigating
  }

  function openInstallSheet() {
    onClose();
    setTimeout(() => setInstallOpen(true), 100);
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-text/40"
          onClick={onClose}
          aria-hidden
        />

      {/* Sheet */}
      <div
        className={`absolute left-0 right-0 bottom-0 bg-surface rounded-t-2xl border-t border-border shadow-[0_-12px_32px_rgba(0,0,0,0.18)] transition-transform duration-250 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-label="Plus de navigation"
      >
        {/* Grabber */}
        <div className="flex items-center justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        {/* Header */}
        <div className="px-4 pt-2 pb-3 flex items-center gap-3 border-b border-border">
          <Avatar name={user?.name ?? 'U'} photoUrl={user?.logoUrl} size={42} />
          <div className="flex-1 min-w-0 leading-[1.2]">
            <div className="text-[14px] font-semibold truncate flex items-center gap-1.5">
              {user?.name}
              <span className="text-[10px] font-medium px-1.5 py-px rounded-full bg-surface-2 border border-border text-text-muted">
                {PLAN_LABELS[plan]}
              </span>
            </div>
            <div className="text-[12px] text-text-muted truncate">{user?.companyName || user?.email}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* AI credits card */}
        <button
          onClick={() => go('/pricing')}
          className="mx-4 mt-3 mb-1 w-[calc(100%-2rem)] p-3 rounded-lg bg-primary-soft border border-primary-soft-2 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 rounded-md bg-white/60 dark:bg-black/20 grid place-items-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-primary-hover">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          </div>
          <div className="flex-1 leading-[1.15]">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-primary-hover">
              Crédits IA
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-semibold text-primary-hover">{aiCredits}</span>
              {monthlyQuota > 0 && (
                <span className="text-[11px] text-text-muted">/ {monthlyQuota}/mois</span>
              )}
            </div>
          </div>
          <span className="text-[11.5px] font-semibold text-primary-hover whitespace-nowrap">
            + Acheter
          </span>
        </button>

        {/* Items */}
        <div className="px-2 py-2 flex flex-col">
          <MoreItem
            label="Réglages du compte"
            hint="Profil, logo, MoMo, IFU"
            icon={<SettingsIcon size={18} />}
            onClick={() => go('/settings')}
          />
          <MoreItem
            label="Installer l'application"
            hint="Ajouter sur l'ecran d'accueil"
            icon={<DownloadIcon size={18} />}
            onClick={openInstallSheet}
          />
          <MoreItem
            label="Produits & services"
            hint="Catalogue réutilisable"
            icon={<ReceiptIcon size={18} />}
            onClick={() => go('/products')}
          />
          <MoreItem
            label="Mes reversements"
            hint="Argent reçu via MoMo"
            icon={<WalletIcon size={18} />}
            onClick={() => go('/payouts')}
          />
          <MoreItem
            label="Mon plan & facturation"
            hint={`Plan ${PLAN_LABELS[plan]}`}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 2l3 6 6 .9-4.5 4.4 1 6.2L12 17l-5.5 2.5 1-6.2L3 8.9 9 8z"/>
              </svg>
            }
            onClick={() => go('/pricing')}
          />
        </div>

        <div className="border-t border-border px-2 py-2">
          <MoreItem
            label="Se déconnecter"
            icon={<LogOutIcon size={18} />}
            danger
            onClick={() => { onClose(); logout(); }}
          />
        </div>

        {/* Safe area on iOS */}
        <div className="h-[20px]" />
      </div>
      </div>
      <PwaInstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </>
  );
}

function MoreItem({
  label,
  hint,
  icon,
  danger,
  onClick,
}: {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg active:bg-surface-2 transition-colors text-left ${
        danger ? 'text-danger' : 'text-text'
      }`}
    >
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        danger ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-text-muted'
      }`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0 leading-[1.2]">
        <div className="text-[14px] font-semibold">{label}</div>
        {hint && <div className="text-[11.5px] text-text-muted">{hint}</div>}
      </div>
      {!danger && <ChevronRightIcon size={15} className="text-text-subtle" />}
    </button>
  );
}
