import { NavLink } from 'react-router-dom';
import { HomeIcon, FileIcon, PlusIcon, UsersIcon, MoreIcon } from '@/components/ui/Icon';

interface Props {
  onOpenMore: () => void;
  moreOpen?: boolean;
}

const items = [
  { to: '/',           label: 'Accueil', Icon: HomeIcon,  end: true },
  { to: '/quotes',     label: 'Devis',   Icon: FileIcon },
  { to: '/quotes/new', label: '',        Icon: PlusIcon,  primary: true },
  { to: '/clients',    label: 'Clients', Icon: UsersIcon },
];

export default function MobileNav({ onOpenMore, moreOpen }: Props) {
  return (
    <nav className="flex-shrink-0 flex justify-around items-center px-3 pt-2 pb-[max(env(safe-area-inset-bottom),18px)] border-t border-border bg-surface">
      {items.map(({ to, label, Icon, end, primary }) => {
        if (primary) {
          return (
            <NavLink key={to} to={to} className="flex-shrink-0">
              <button
                aria-label="Créer un devis"
                className="w-[52px] h-[52px] rounded-[16px] bg-primary text-white grid place-items-center -translate-y-3 shadow-[0_6px_14px_-4px_rgba(15,143,101,0.5),0_1px_0_rgba(255,255,255,0.2)_inset] active:scale-95 transition-transform"
              >
                <Icon size={24} strokeWidth={2.2} />
              </button>
            </NavLink>
          );
        }
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
