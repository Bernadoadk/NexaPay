import { NavLink } from 'react-router-dom';
import { HomeIcon, UsersIcon, BarChart3Icon, MoreIcon } from '@/components/ui/Icon';

interface Props {
  onOpenMore: () => void;
  moreOpen?: boolean;
}

const items = [
  { to: '/',           label: 'Tableau de bord', Icon: HomeIcon,  end: true },
  { to: '/users',      label: 'Utilisateurs',   Icon: UsersIcon },
  { to: '/analytics',  label: 'Analytics',      Icon: BarChart3Icon },
];

export default function MobileNav({ onOpenMore, moreOpen }: Props) {
  return (
    <nav className="flex-shrink-0 flex justify-around items-center px-3 pt-2 pb-[max(env(safe-area-inset-bottom),18px)] border-t border-border bg-surface">
      {items.map(({ to, label, Icon, end }) => {
        return (
          <NavLink key={to} to={to} end={end} className="flex-1">
            {({ isActive }) => (
              <button
                className={`flex flex-col items-center gap-[3px] w-full py-1.5 border-none bg-transparent text-[10.5px] font-medium ${
                  isActive ? 'text-primary font-semibold' : 'text-text-subtle'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.6} />
                <span>{label}</span>
              </button>
            )}
          </NavLink>
        );
      })}

      {/* "Plus" tab — opens the bottom sheet */}
      <button
        onClick={onOpenMore}
        aria-label="Plus de navigation"
        className={`flex-1 flex flex-col items-center gap-[3px] py-1.5 border-none bg-transparent text-[10.5px] font-medium ${
          moreOpen ? 'text-primary font-semibold' : 'text-text-subtle'
        }`}
      >
        <MoreIcon size={20} />
        <span>Plus</span>
      </button>
    </nav>
  );
}