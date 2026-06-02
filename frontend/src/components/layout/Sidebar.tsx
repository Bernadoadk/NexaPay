import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { creditsApi } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import {
  HomeIcon, FileIcon, UsersIcon, ReceiptIcon,
  PlusIcon, LogOutIcon, SettingsIcon,
} from '@/components/ui/Icon';
import { useEntrance, useChildrenStagger } from '@/hooks/useAnime';
import { useTheme } from '@/contexts/ThemeContext';
import { Sparkles } from 'lucide-react';
import logoSrc from '@/assets/Logo.png';
import logoDarkSrc from '@/assets/Logo-dark.png';

const PLAN_LABELS: Record<string, string> = { FREE: 'Gratuit', PRO: 'Pro', BUSINESS: 'Business' };

const PLAN_NEXT: Record<string, { label: string; plan: string } | null> = {
  FREE: { label: 'Passer à Pro', plan: 'PRO' },
  PRO: { label: 'Passer à Business', plan: 'BUSINESS' },
  BUSINESS: null,
};

const PLAN_COLOR: Record<string, { bg: string; text: string; badge: string }> = {
  FREE: { bg: 'bg-surface-2', text: 'text-text-muted', badge: 'bg-border text-text-muted' },
  PRO: { bg: 'bg-primary-soft', text: 'text-primary-hover', badge: 'bg-primary-soft-2 text-primary-hover' },
  BUSINESS: { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
};

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', Icon: HomeIcon, end: true },
  { to: '/quotes', label: 'Devis', Icon: FileIcon, badge: null },
  { to: '/clients', label: 'Clients', Icon: UsersIcon },
  { to: '/products', label: 'Produits & services', Icon: ReceiptIcon },
  { to: '/templates', label: 'Templates', Icon: ReceiptIcon },
  { to: '/settings', label: 'Réglages', Icon: SettingsIcon },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const logoRef = useEntrance<HTMLDivElement>('fadeIn', { duration: 400 });
  const navRef = useChildrenStagger<HTMLElement>([], { stagger: 45, delay: 120 });

  const { data: credits } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.balance().then(r => r.data),
    enabled: !!user,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
  const aiCredits = credits?.aiCredits ?? user?.aiCredits ?? 0;
  const monthlyQuota = credits?.monthlyQuota ?? 0;
  const lowCredits = aiCredits < 5;

  return (
    <aside className="w-[232px] flex-shrink-0 bg-surface border-r border-border flex flex-col p-[14px] h-full">
      {/* Logo */}
      <div ref={logoRef} className="flex justify-center pb-[18px]">
        <img src={isDark ? logoDarkSrc : logoSrc} alt="NexaPay" className="h-16 w-auto object-contain" />
      </div>

      {/* Create button */}
      <Button variant="primary" className="w-full mb-[18px]" onClick={() => navigate('/quotes/new')}>
        <PlusIcon size={16} /> Créer un devis
      </Button>

      {/* Nav */}
      <nav ref={navRef} className="flex flex-col gap-0.5 flex-1">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-[10px] py-[9px] rounded-sm border-none text-[13.5px] text-left transition-colors
              ${isActive
                ? 'bg-primary-soft text-primary-hover font-semibold'
                : 'bg-transparent text-text font-medium hover:bg-surface-2'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} />
                <span className="flex-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Crédits IA — visible en permanence */}
      <button
        onClick={() => navigate('/pricing')}
        title="Acheter des crédits IA"
        className={`group mb-2.5 w-full rounded-lg border px-3 py-2.5 flex items-center gap-2.5 transition-colors text-left ${
          lowCredits
            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/40 hover:bg-amber-100/70 dark:hover:bg-amber-950/30'
            : 'bg-primary-soft border-primary-soft-2 hover:bg-primary-soft/80'
        }`}
      >
        <div className={`flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 ${
          lowCredits ? 'bg-amber-200/60 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                     : 'bg-white/60 dark:bg-black/20 text-primary-hover'
        }`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0 leading-[1.15]">
          <div className={`text-[11px] font-semibold uppercase tracking-[0.04em] ${
            lowCredits ? 'text-amber-700 dark:text-amber-400' : 'text-primary-hover'
          }`}>
            Crédits IA
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-[16px] font-semibold ${
              lowCredits ? 'text-amber-800 dark:text-amber-300' : 'text-primary-hover'
            }`}>
              {aiCredits}
            </span>
            {monthlyQuota > 0 && (
              <span className="text-[10.5px] text-text-muted">/ {monthlyQuota}/mois</span>
            )}
          </div>
        </div>
        <span className={`text-[10.5px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${
          lowCredits ? 'text-amber-700 dark:text-amber-400' : 'text-primary-hover'
        }`}>
          + Acheter
        </span>
      </button>

      {/* Plan card */}
      {(() => {
        const plan = user?.plan || 'FREE';
        const next = PLAN_NEXT[plan];
        const colors = PLAN_COLOR[plan];
        return (
          <div className={`mb-3 rounded-lg p-3 ${colors.bg} border border-border`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11.5px] font-semibold text-text-muted uppercase tracking-[0.04em]">
                Abonnement
              </span>
              <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                {PLAN_LABELS[plan]}
              </span>
            </div>
            <p className="text-[11.5px] text-text-muted leading-snug mb-2.5">
              {plan === 'FREE' && 'Accès aux fonctionnalités de base.'}
              {plan === 'PRO' && 'Devis illimités, PDF personnalisé, WhatsApp.'}
              {plan === 'BUSINESS' && 'Toutes les fonctionnalités incluses.'}
            </p>
            {next ? (
              <button
                onClick={() => navigate('/pricing')}
                className="w-full h-7 rounded-md bg-primary text-white text-[12px] font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                {next.label}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-1 text-[11px] text-amber-600 font-medium">
                <Sparkles size={11} strokeWidth={2} /> Plan maximal actif
              </div>
            )}
          </div>
        );
      })()}

      {/* User */}
      <button
        onClick={logout}
        className="flex items-center gap-2.5 px-[10px] py-2 rounded-sm hover:bg-surface-2 transition-colors w-full text-left group"
      >
        <Avatar name={user?.name ?? 'U'} photoUrl={user?.logoUrl} color="#14201C" size={28} />
        <div className="flex-1 leading-[1.15] min-w-0">
          <div className="text-[12.5px] font-semibold truncate flex items-center gap-1.5">
            {user?.name}
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-2 border border-border text-text-muted leading-none">
              {PLAN_LABELS[user?.plan || 'FREE']}
            </span>
          </div>
          <div className="text-[11px] text-text-muted truncate">{user?.companyName || user?.email}</div>
        </div>
        <LogOutIcon size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </aside>
  );
}
