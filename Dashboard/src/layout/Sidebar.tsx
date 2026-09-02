import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { analyticsApi } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import {
  HomeIcon,
  UsersIcon,
  BarChart3Icon,
  SettingsIcon,
  LogOutIcon,
  AlertCircleIcon,
} from '@/components/ui/Icon';
import { useEntrance, useChildrenStagger } from '@/hooks/useAnime';

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', Icon: HomeIcon, end: true },
  { to: '/users', label: 'Utilisateurs', Icon: UsersIcon },
  { to: '/analytics', label: 'Analytics', Icon: BarChart3Icon },
  { to: '/settings', label: 'Réglages', Icon: SettingsIcon },
];

/**
 * Navigation du back-office.
 *
 * Ne contient que ce qui concerne l'administration de la plateforme. Les blocs
 * hérités de l'application cliente (crédits IA du compte, badge d'abonnement,
 * bouton d'upgrade, création de devis) n'avaient pas leur place ici : un
 * administrateur pilote les comptes des autres, pas le sien.
 */
export default function Sidebar() {
  const { user, logout } = useAuth();
  const logoRef = useEntrance<HTMLDivElement>('fadeIn', { duration: 400 });
  const navRef = useChildrenStagger<HTMLElement>([], { stagger: 45, delay: 120 });

  // Signal opérationnel : des reversements en échec demandent une action.
  const { data: stats } = useQuery({
    queryKey: ['sidebar-health'],
    queryFn: () => analyticsApi.stats().then((r) => r.data),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const failedPayouts = stats?.volume?.failedPayouts ?? 0;

  return (
    <aside className="w-[232px] flex-shrink-0 bg-surface border-r border-border flex flex-col p-[14px] h-full">
      <div ref={logoRef} className="flex items-center gap-2.5 px-1 pb-5 pt-1">
        <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-[15px]">NX</span>
        </div>
        <div className="leading-[1.15] min-w-0">
          <div className="text-[14px] font-semibold tracking-[-0.01em] truncate">NexaPay</div>
          <div className="text-[11px] text-text-muted">Administration</div>
        </div>
      </div>

      <nav ref={navRef} className="flex flex-col gap-0.5 flex-1">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-[10px] py-[9px] rounded-sm border-none text-[13.5px] text-left transition-colors ${
                isActive
                  ? 'bg-primary-soft text-primary-hover font-semibold'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} strokeWidth={isActive ? 2 : 1.6} />
                <span className="flex-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Alerte d'exploitation : visible sans avoir à ouvrir une page. */}
      {failedPayouts > 0 && (
        <NavLink
          to="/analytics"
          className="mb-2.5 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2.5 flex items-start gap-2.5 hover:opacity-90 transition-opacity"
        >
          <AlertCircleIcon size={16} className="text-danger flex-shrink-0 mt-0.5" />
          <div className="leading-[1.25] min-w-0">
            <div className="text-[12px] font-semibold text-danger">
              {failedPayouts} reversement{failedPayouts > 1 ? 's' : ''} en échec
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">Action requise</div>
          </div>
        </NavLink>
      )}

      <button
        onClick={logout}
        className="flex items-center gap-2.5 px-[10px] py-2 rounded-sm hover:bg-surface-2 transition-colors w-full text-left group"
      >
        <Avatar name={user?.name ?? 'A'} photoUrl={user?.logoUrl} color="#14201C" size={28} />
        <div className="flex-1 leading-[1.15] min-w-0">
          <div className="text-[12.5px] font-semibold truncate flex items-center gap-1.5">
            {user?.name}
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary-soft text-primary-hover leading-none">
              Admin
            </span>
          </div>
          <div className="text-[11px] text-text-muted truncate">{user?.email}</div>
        </div>
        <LogOutIcon size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </aside>
  );
}
