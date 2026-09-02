import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { analyticsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDialogs } from '@/components/ui/Dialog';
import { AlertTriangle, UsersIcon, SettingsIcon, BarChart3Icon, CheckIcon } from '@/components/ui/Icon';

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-border-strong'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? 'translate-x-5' : ''
          }`}
        />
      </button>
      <span className="text-sm text-text-muted">{label}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-text-muted">{label}</div>
      <div className="text-[14px] font-medium text-text mt-1">{value}</div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const { confirm, choose, dialog } = useDialogs();

  const { data: stats } = useQuery({
    queryKey: ['admin-stats', 30],
    queryFn: () => analyticsApi.stats({ days: 30 }).then((r) => r.data),
  });

  const purgeMutation = useMutation({
    mutationFn: (days: number) => analyticsApi.purgeActivity(days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-activity'] });
      queryClient.invalidateQueries({ queryKey: ['admin-timeseries'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  /**
   * Purge réelle des journaux. L'ancienne version affichait une confirmation
   * puis un message de succès sans rien supprimer.
   */
  async function handlePurge() {
    const choice = await choose<'90' | '30' | '0'>({
      title: "Purger le journal d'activité",
      description:
        "Les entrées antérieures à la période choisie seront définitivement supprimées. Les statistiques d'utilisateurs actifs et les courbes d'activité s'en trouveront réduites d'autant.",
      options: [
        { value: '90', label: 'Plus de 90 jours', hint: 'Conserve le dernier trimestre' },
        { value: '30', label: 'Plus de 30 jours', hint: 'Conserve le dernier mois' },
        { value: '0', label: 'Tout le journal', hint: 'Supprime l’intégralité de l’historique' },
      ],
      defaultValue: '90',
      confirmLabel: 'Continuer',
      tone: 'danger',
    });
    if (!choice) return;

    const ok = await confirm({
      title: 'Confirmer la suppression',
      description:
        choice === '0'
          ? "L'intégralité du journal d'activité va être supprimée. Cette action est irréversible."
          : `Les entrées de plus de ${choice} jours vont être supprimées. Cette action est irréversible.`,
      confirmLabel: 'Supprimer définitivement',
      tone: 'danger',
    });
    if (ok) purgeMutation.mutate(Number(choice));
  }

  return (
    <div className="p-5 sm:p-6 space-y-5 overflow-y-auto h-full scrollbar-thin max-w-[900px]">
      <header>
        <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">Réglages</h1>
        <p className="text-[13px] text-text-muted mt-0.5">Compte administrateur et maintenance</p>
      </header>

      {/* Compte */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-[14px] font-semibold flex items-center gap-2 mb-4">
          <UsersIcon size={16} className="text-text-muted" />
          Compte administrateur
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Row label="Nom" value={user?.name ?? '—'} />
          <Row label="E-mail" value={user?.email ?? '—'} />
          <Row label="Entreprise" value={user?.companyName ?? '—'} />
          <Row
            label="Rôle"
            value={<Badge variant="primary">{user?.role === 'ADMIN' ? 'Administrateur' : 'Utilisateur'}</Badge>}
          />
        </div>
      </section>

      {/* Préférences */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-[14px] font-semibold flex items-center gap-2 mb-4">
          <SettingsIcon size={16} className="text-text-muted" />
          Préférences
        </h2>
        <Toggle enabled={isDark} onToggle={toggleTheme} label={isDark ? 'Mode sombre' : 'Mode clair'} />
      </section>

      {/* État de la plateforme */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-[14px] font-semibold flex items-center gap-2 mb-4">
          <BarChart3Icon size={16} className="text-text-muted" />
          État de la plateforme
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Row label="Comptes" value={stats?.users?.total ?? '—'} />
          <Row label="Devis" value={stats?.quotes?.total ?? '—'} />
          <Row label="Commandes" value={stats?.orders?.total ?? '—'} />
          <Row
            label="Reversements KO"
            value={
              stats?.volume?.failedPayouts ? (
                <span className="text-danger">{stats.volume.failedPayouts}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-primary">
                  <CheckIcon size={14} /> 0
                </span>
              )
            }
          />
        </div>
      </section>

      {/* Zone de danger */}
      <section className="bg-surface border border-danger/25 rounded-xl p-5">
        <h2 className="text-[14px] font-semibold flex items-center gap-2 mb-2 text-danger">
          <AlertTriangle size={16} />
          Zone de danger
        </h2>
        <p className="text-[13px] text-text-muted mb-4 leading-relaxed">
          La purge du journal d'activité supprime définitivement l'historique des connexions et des
          actions. Les comptes, devis et paiements ne sont pas touchés.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="destructive" onClick={handlePurge} disabled={purgeMutation.isPending}>
            {purgeMutation.isPending ? 'Suppression...' : "Purger le journal d'activité"}
          </Button>
          {purgeMutation.isSuccess && (
            <span className="text-[13px] text-primary">
              {purgeMutation.data?.data?.deleted ?? 0} entrée(s) supprimée(s).
            </span>
          )}
          {purgeMutation.isError && (
            <span className="text-[13px] text-danger">La purge a échoué. Réessayez.</span>
          )}
        </div>
      </section>

      {dialog}
    </div>
  );
}
