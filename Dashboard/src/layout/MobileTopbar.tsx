import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { analyticsApi } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import { AlertCircleIcon } from '@/components/ui/Icon';

/**
 * En-tête mobile du back-office.
 *
 * L'ancienne version affichait un bouton « retour » portant une croix, et une
 * cloche qui n'ouvrait rien (son badge ne s'affichait jamais, `unreadCount`
 * étant l'objet `{ count }`). On garde l'essentiel : le titre de la page et le
 * signal d'exploitation qui demande une action.
 */
export default function MobileTopbar({ title }: { title: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['sidebar-health'],
    queryFn: () => analyticsApi.stats().then((r) => r.data),
    refetchInterval: 120_000,
  });
  const failedPayouts = stats?.volume?.failedPayouts ?? 0;

  return (
    <header className="flex h-14 items-center gap-3 px-3.5 border-b border-border bg-surface">
      <div className="w-8 h-8 rounded-lg bg-primary grid place-items-center flex-shrink-0">
        <span className="text-white font-bold text-[13px]">NX</span>
      </div>

      <h1 className="flex-1 text-[15px] font-semibold tracking-[-0.01em] truncate">{title}</h1>

      {failedPayouts > 0 && (
        <button
          type="button"
          onClick={() => navigate('/analytics')}
          aria-label={`${failedPayouts} reversements en échec`}
          className="relative w-9 h-9 rounded-lg grid place-items-center bg-danger-soft text-danger"
        >
          <AlertCircleIcon size={17} />
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-danger text-white text-[9.5px] font-bold leading-none rounded-full border-2 border-surface">
            {failedPayouts > 9 ? '9+' : failedPayouts}
          </span>
        </button>
      )}

      <Avatar name={user?.name ?? 'A'} photoUrl={user?.logoUrl} color="#14201C" size={30} />
    </header>
  );
}
