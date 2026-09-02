import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Avatar from '@/components/ui/Avatar';
import { useDialogs } from '@/components/ui/Dialog';
import {
  SearchIcon,
  DownloadIcon,
  RefreshCw,
  ChevronRightIcon,
  AlertCircleIcon,
  UsersIcon,
} from '@/components/ui/Icon';
import type { Plan, User } from '@/types';

const PAGE_SIZE = 20;
type BlockedFilter = 'all' | 'active' | 'blocked';

const PLAN_LABELS: Record<string, string> = { FREE: 'Gratuit', PRO: 'Pro', BUSINESS: 'Business' };
const PLAN_VARIANT: Record<string, 'secondary' | 'primary' | 'warning'> = {
  FREE: 'secondary',
  PRO: 'primary',
  // Business est le meilleur plan : surtout pas la teinte « destructive ».
  BUSINESS: 'warning',
};

export default function Users() {
  const queryClient = useQueryClient();
  const { confirm, prompt, choose, dialog } = useDialogs();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [blockedFilter, setBlockedFilter] = useState<BlockedFilter>('all');

  // Recherche côté serveur, décalée pour ne pas requêter à chaque frappe.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const blockedParam =
    blockedFilter === 'all' ? undefined : blockedFilter === 'blocked' ? true : false;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['users-list', page, search, blockedFilter],
    // La pagination et la recherche sont faites en base : filtrer côté client
    // sur une page tronquée masquait tous les comptes au-delà de la limite.
    queryFn: () =>
      analyticsApi
        .users({ page, limit: PAGE_SIZE, search: search || undefined, blocked: blockedParam })
        .then((res) => res.data),
    placeholderData: keepPreviousData,
  });

  const users: User[] = data?.users ?? [];
  const pagination = data?.pagination ?? { page: 1, pages: 1, total: 0 };

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  }

  const blockMutation = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      analyticsApi.blockUser(id, blocked),
    onSuccess: invalidate,
  });

  const planMutation = useMutation({
    mutationFn: ({ id, plan, months }: { id: string; plan: Plan; months: number | null }) =>
      analyticsApi.updateUserPlan(id, plan, months),
    onSuccess: invalidate,
  });

  const creditsMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      analyticsApi.updateUserCredits(id, amount),
    onSuccess: invalidate,
  });

  async function handleBlock(user: User) {
    const blocking = !user.blocked;
    const ok = await confirm({
      eyebrow: user.email,
      title: blocking ? 'Bloquer ce compte ?' : 'Débloquer ce compte ?',
      description: blocking
        ? `${user.name} sera immédiatement déconnecté et ne pourra plus accéder à NexaPay. Ses données sont conservées.`
        : `${user.name} retrouvera l'accès complet à son compte.`,
      confirmLabel: blocking ? 'Bloquer' : 'Débloquer',
      tone: blocking ? 'danger' : 'primary',
    });
    if (ok) blockMutation.mutate({ id: user.id, blocked: blocking });
  }

  async function handlePlan(user: User) {
    const plan = await choose<Plan>({
      eyebrow: user.email,
      title: 'Modifier l’abonnement',
      description: `Plan actuel : ${PLAN_LABELS[user.plan ?? 'FREE']}. Le nouveau plan prend effet immédiatement.`,
      options: [
        { value: 'FREE', label: 'Gratuit', hint: '5 devis par mois' },
        { value: 'PRO', label: 'Pro', hint: '30 devis, boutique, lien de paiement' },
        { value: 'BUSINESS', label: 'Business', hint: 'Tout illimité, modèles premium' },
      ],
      defaultValue: (user.plan ?? 'FREE') as Plan,
      confirmLabel: 'Continuer',
      tone: 'primary',
    });
    if (!plan) return;

    if (plan === 'FREE') {
      planMutation.mutate({ id: user.id, plan, months: null });
      return;
    }

    const months = await prompt({
      eyebrow: user.email,
      title: `Durée du plan ${PLAN_LABELS[plan]}`,
      description: 'Nombre de mois accordés à partir d’aujourd’hui.',
      label: 'Durée (mois)',
      type: 'number',
      min: 1,
      max: 60,
      defaultValue: '1',
      helpText: 'À l’échéance, le compte repasse automatiquement au plan gratuit.',
      confirmLabel: 'Appliquer',
      tone: 'primary',
    });
    if (months === null) return;

    planMutation.mutate({ id: user.id, plan, months: Number(months) });
  }

  async function handleCredits(user: User) {
    const value = await prompt({
      eyebrow: user.email,
      title: 'Ajuster les crédits IA',
      description: `Solde actuel : ${user.aiCredits ?? 0} crédits. Un nombre négatif retire des crédits.`,
      label: 'Ajustement',
      type: 'number',
      min: -1000,
      max: 1000,
      defaultValue: '10',
      helpText: 'L’opération apparaît dans l’historique de crédits du client.',
      confirmLabel: 'Appliquer',
      tone: 'primary',
    });
    if (value === null) return;
    creditsMutation.mutate({ id: user.id, amount: Number(value) });
  }

  /** Export CSV de la page courante — suffisant pour un contrôle ponctuel. */
  function exportCsv() {
    const header = ['Nom', 'Email', 'Entreprise', 'Plan', 'Crédits', 'Bloqué', 'Devis', 'Inscription'];
    const rows = users.map((user) => [
      user.name,
      user.email,
      user.companyName ?? '',
      PLAN_LABELS[user.plan ?? 'FREE'],
      String(user.aiCredits ?? 0),
      user.blocked ? 'oui' : 'non',
      String(user._count?.quotes ?? 0),
      user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    // BOM UTF-8 : sans lui, Excel ouvre le CSV en ANSI et casse les accents.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexapay-utilisateurs-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const busy = blockMutation.isPending || planMutation.isPending || creditsMutation.isPending;

  const filters = useMemo(
    () =>
      [
        { key: 'all' as const, label: 'Tous' },
        { key: 'active' as const, label: 'Actifs' },
        { key: 'blocked' as const, label: 'Bloqués' },
      ],
    [],
  );

  return (
    <div className="p-5 sm:p-6 space-y-4 overflow-y-auto h-full scrollbar-thin">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">Utilisateurs</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            {pagination.total} compte{pagination.total > 1 ? 's' : ''}
            {search && ` correspondant à « ${search} »`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={users.length === 0}>
            <DownloadIcon size={16} /> Exporter
          </Button>
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['users-list'] })}
            aria-label="Actualiser"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </header>

      {/* Recherche + filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher par nom ou e-mail..."
            aria-label="Rechercher un utilisateur"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-surface text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-surface-2 border border-border rounded-lg">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={blockedFilter === key}
              onClick={() => {
                setBlockedFilter(key);
                setPage(1);
              }}
              className={`h-8 px-3 rounded-md text-[12.5px] font-semibold transition-colors ${
                blockedFilter === key ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {error ? (
          <div className="py-14 text-center px-4">
            <AlertCircleIcon size={22} className="mx-auto mb-2 text-danger" />
            <p className="text-[13.5px] text-text-muted">Impossible de charger les utilisateurs.</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['users-list'] })}
            >
              Réessayer
            </Button>
          </div>
        ) : isLoading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-surface-2 animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 grid place-items-center mx-auto mb-3">
              <UsersIcon size={20} className="text-text-subtle" />
            </div>
            <p className="text-[14px] font-medium">Aucun utilisateur trouvé</p>
            <p className="text-[12.5px] text-text-muted mt-1">
              {search ? 'Essayez un autre terme de recherche.' : 'Aucun compte ne correspond à ce filtre.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {['Utilisateur', 'Plan', 'Crédits', 'Devis', 'Statut', 'Inscription', ''].map((label, i) => (
                    <th
                      key={label || i}
                      className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y divide-border ${isFetching ? 'opacity-60 transition-opacity' : ''}`}>
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/users/${user.id}`} className="flex items-center gap-2.5 group min-w-0">
                        <Avatar name={user.name} photoUrl={user.logoUrl} color="#14201C" size={32} />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold truncate group-hover:text-primary transition-colors">
                            {user.name}
                          </span>
                          <span className="block text-[12px] text-text-muted truncate">{user.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={PLAN_VARIANT[user.plan ?? 'FREE']}>
                        {PLAN_LABELS[user.plan ?? 'FREE']}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums">{user.aiCredits ?? 0}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums">{user._count?.quotes ?? 0}</td>
                    <td className="px-4 py-3">
                      {user.blocked ? (
                        <Badge variant="destructive">Bloqué</Badge>
                      ) : user.isEmailVerified ? (
                        <Badge variant="primary">Actif</Badge>
                      ) : (
                        <Badge variant="warning">Non vérifié</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-text-muted whitespace-nowrap">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" className="h-8 px-2.5 text-[12px]" disabled={busy} onClick={() => handlePlan(user)}>
                          Plan
                        </Button>
                        <Button variant="outline" className="h-8 px-2.5 text-[12px]" disabled={busy} onClick={() => handleCredits(user)}>
                          Crédits
                        </Button>
                        <Button
                          variant={user.blocked ? 'outline' : 'destructive'}
                          className="h-8 px-2.5 text-[12px]"
                          disabled={busy}
                          onClick={() => handleBlock(user)}
                        >
                          {user.blocked ? 'Débloquer' : 'Bloquer'}
                        </Button>
                        <Link
                          to={`/users/${user.id}`}
                          aria-label={`Voir le détail de ${user.name}`}
                          className="w-8 h-8 rounded-lg grid place-items-center text-text-muted hover:bg-surface hover:text-text transition-colors"
                        >
                          <ChevronRightIcon size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Précédent
          </Button>
          <span className="text-[12.5px] text-text-muted">
            Page {pagination.page} sur {pagination.pages}
          </span>
          <Button
            variant="outline"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}

      {dialog}
    </div>
  );
}
