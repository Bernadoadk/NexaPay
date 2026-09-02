import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileNav from './MobileNav';
import MobileTopbar from './MobileTopbar';
import MobileMoreSheet from './MobileMoreSheet';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, X } from 'lucide-react';

const TITLE_MAP: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Tableau de bord administrateur', subtitle: 'Vue d\'ensemble de la plateforme' },
  '/users': { title: 'Gestion des utilisateurs', subtitle: 'Liste et gestion des comptes' },
  '/analytics': { title: 'Analytics détaillés', subtitle: 'Métriques et tendances' },
  '/settings': { title: 'Réglages', subtitle: 'Configuration du système' },
};

const MOBILE_TITLE_MAP: Record<string, string> = {
  '/': 'Tableau de bord admin',
  '/users': 'Utilisateurs',
  '/analytics': 'Analytics',
  '/settings': 'Réglages',
};

function useMeta() {
  const { pathname } = useLocation();
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  return { title: 'NexaPay Admin' };
}

function useMobileTitle() {
  const { pathname } = useLocation();
  if (MOBILE_TITLE_MAP[pathname]) return MOBILE_TITLE_MAP[pathname];
  return 'NexaPay Admin';
}

export default function AppShell() {
  const meta = useMeta();
  const mobileTitle = useMobileTitle();
  const { pathname } = useLocation();
  // Hide bottom nav on certain pages if needed
  const hideNav = false; // Show nav everywhere for admin dashboard
  const contentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem('admin-banner-dismissed') === '1',
  );
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Desktop topbar */}
        <div className="hidden lg:flex">
          <Topbar title={meta.title} subtitle={meta.subtitle} />
        </div>

        {/* Mobile topbar — back, title, notifications */}
        <div className="lg:hidden">
          <MobileTopbar title={mobileTitle} />
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-hidden transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        {!hideNav && (
          <div className="lg:hidden">
            <MobileNav onOpenMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
          </div>
        )}
      </div>

      {/* Mobile "Plus" sheet (rendered outside the main column to overlay everything) */}
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}