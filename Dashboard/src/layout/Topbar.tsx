import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Avatar from '@/components/ui/Avatar';
import { ChevronDownIcon, SettingsIcon, LogOutIcon } from '@/components/ui/Icon';

/**
 * Barre supérieure du back-office.
 *
 * La cloche de notifications a été retirée : elle n'ouvrait rien et son badge
 * ne s'affichait jamais (comparaison numérique sur l'objet `{ count }` renvoyé
 * par l'API). Les alertes d'exploitation figurent désormais dans la barre
 * latérale, là où elles concernent la plateforme et non le compte admin.
 */
export default function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="flex h-[4.25rem] items-center justify-between px-4 lg:px-6 border-b border-border bg-surface">
      <div className="flex-1 min-w-0">
        <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-text truncate">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-text-muted truncate">{subtitle}</p>}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 h-10 pl-1.5 pr-2.5 rounded-lg border border-border bg-surface hover:bg-surface-2 transition-colors"
        >
          <Avatar name={user?.name ?? 'A'} photoUrl={user?.logoUrl} color="#14201C" size={28} />
          <span className="hidden sm:block text-[13px] font-medium max-w-[140px] truncate">
            {user?.name ?? 'Admin'}
          </span>
          <ChevronDownIcon size={15} className="text-text-muted rotate-90" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1.5 w-[220px] bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-50"
          >
            <div className="px-3.5 py-3 border-b border-border">
              <div className="text-[13px] font-semibold truncate">{user?.name}</div>
              <div className="text-[12px] text-text-muted truncate">{user?.email}</div>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/settings');
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-left hover:bg-surface-2 transition-colors"
            >
              <SettingsIcon size={15} className="text-text-muted" />
              Réglages
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                logout();
                navigate('/login');
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-left text-danger hover:bg-danger-soft transition-colors"
            >
              <LogOutIcon size={15} />
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
