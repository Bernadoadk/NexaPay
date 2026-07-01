import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileNav from './MobileNav';
import MobileTopbar from './MobileTopbar';
import MobileMoreSheet from './MobileMoreSheet';
import anime from 'animejs';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, X } from 'lucide-react';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';

const TITLE_MAP: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Tableau de bord', subtitle: 'Aperçu de votre activité commerciale' },
  '/quotes': { title: 'Devis', subtitle: 'Tous vos devis en un coup d\'œil' },
  '/quotes/new': { title: 'Créer un devis', subtitle: 'Nouveau document' },
  '/clients': { title: 'Clients', subtitle: 'Carnet d\'adresses & historique' },
  '/products': { title: 'Produits & services', subtitle: 'Gérer votre catalogue de prestations' },
  '/history': { title: 'Historique', subtitle: 'Devis, paiements et commandes boutique' },
  '/settings': { title: 'Réglages', subtitle: 'Profil et informations de facturation' },
};

const MOBILE_TITLE_MAP: Record<string, string> = {
  '/': 'Tableau de bord',
  '/quotes': 'Devis',
  '/quotes/new': 'Nouveau devis',
  '/clients': 'Clients',
  '/products': 'Produits & services',
  '/history': 'Historique',
  '/settings': 'Réglages',
  '/payouts': 'Reversements',
  '/pricing': 'Plans & crédits',
};

function useMeta() {
  const { pathname } = useLocation();
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  if (pathname.startsWith('/quotes/') && pathname.endsWith('/edit')) return { title: 'Modifier le devis' };
  if (pathname.startsWith('/quotes/')) return { title: 'Détail devis' };
  return { title: 'NexaPay' };
}

function useMobileTitle() {
  const { pathname } = useLocation();
  if (MOBILE_TITLE_MAP[pathname]) return MOBILE_TITLE_MAP[pathname];
  if (pathname.startsWith('/quotes/') && pathname.endsWith('/edit')) return 'Modifier le devis';
  if (pathname.startsWith('/quotes/')) return 'Devis';
  return 'NexaPay';
}

export default function AppShell() {
  const meta = useMeta();
  const mobileTitle = useMobileTitle();
  const { pathname } = useLocation();
  // Hide bottom nav on quote detail/edit and on payment pages — those have their own action bars
  const hideNav = pathname.startsWith('/quotes/') && pathname !== '/quotes';
  const contentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem('momo-banner-dismissed') === '1',
  );
  const [moreOpen, setMoreOpen] = useState(false);

  // Show a warning if the user can't receive payouts because no MoMo number is configured.
  // Hidden on auth pages and on the Settings page itself (where they fix it).
  const needsMomoSetup = !!user && !user.phone && !pathname.startsWith('/settings');

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    anime({
      targets: el,
      opacity: [0, 1],
      translateY: [7, 0],
      duration: 260,
      easing: 'easeOutQuad',
    });
  }, [pathname]);

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

        {/* Mobile topbar — back, title, credits, search, notifications */}
        <div className="lg:hidden">
          <MobileTopbar title={mobileTitle} />
        </div>

        {/* MoMo not configured — payout will fail until set */}
        {needsMomoSetup && !bannerDismissed && (
          <button
            onClick={() => navigate('/settings')}
            className="bg-[#FEF3C7] border-b border-[#FCD34D] px-4 lg:px-7 py-2.5 flex items-center gap-2.5 flex-shrink-0 w-full text-left hover:bg-[#FDE68A] transition-colors"
          >
            <AlertTriangle size={16} strokeWidth={2} className="flex-shrink-0 text-[#92400E]" />
            <div className="flex-1 text-[12px] lg:text-[12.5px] text-[#92400E] leading-snug min-w-0">
              <span className="lg:hidden">
                <strong>MoMo non configuré.</strong> Vos paiements ne seront pas reversés.
              </span>
              <span className="hidden lg:inline">
                <strong>Aucun numéro Mobile Money configuré.</strong> Vos paiements clients seront reçus
                mais <strong>ne pourront pas vous être reversés</strong> tant que vous n'avez pas renseigné votre numéro MoMo.
              </span>
            </div>
            <span className="text-[11.5px] font-semibold px-2.5 h-7 rounded bg-[#92400E] text-white flex items-center whitespace-nowrap">
              Configurer
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                sessionStorage.setItem('momo-banner-dismissed', '1');
                setBannerDismissed(true);
              }}
              className="text-[#92400E]/60 hover:text-[#92400E] w-6 h-6 flex items-center justify-center rounded flex-shrink-0"
              title="Masquer (réapparaîtra à la prochaine session)"
              aria-label="Masquer"
              role="button"
            >
              <X size={14} strokeWidth={2.5} />
            </span>
          </button>
        )}

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-hidden">
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
      {user && <FeedbackWidget />}
    </div>
  );
}
