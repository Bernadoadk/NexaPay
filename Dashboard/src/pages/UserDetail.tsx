import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Card from '@/components/ui/Card';
import CardHeader from '@/components/ui/CardHeader';
import CardTitle from '@/components/ui/CardTitle';
import CardContent from '@/components/ui/CardContent';
import { Badge } from '@/components/ui/badge';
import { useDialogs } from '@/components/ui/Dialog';
import { UsersIcon, SettingsIcon } from '@/components/ui/Icon';
import { AlertCircle as AlertCircleIcon } from 'lucide-react';

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { confirm, prompt, choose, dialog } = useDialogs();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user-detail', id],
    queryFn: () => analyticsApi.user(id!).then(res => res.data),
    enabled: !!id,
  });

  const blockUserMutation = useMutation({
    mutationFn: ({ blocked }: { blocked: boolean }) =>
      analyticsApi.blockUser(id!, blocked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ plan, months }: { plan: 'FREE' | 'PRO' | 'BUSINESS'; months: number | null }) =>
      analyticsApi.updateUserPlan(id!, plan, months),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const updateCreditsMutation = useMutation({
    mutationFn: ({ amount }: { amount: number }) =>
      analyticsApi.updateUserCredits(id!, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-text-muted">Chargement des données utilisateur...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-center">
          <AlertCircleIcon size={20} className="mx-4 h-4 w-4" />
          <p className="mt-4">Utilisateur non trouvé</p>
        </div>
      </div>
    );
  }

  async function handlePlan() {
    const plan = await choose<'FREE' | 'PRO' | 'BUSINESS'>({
      eyebrow: user.email,
      title: "Modifier l'abonnement",
      description: `Plan actuel : ${user.plan === 'FREE' ? 'Gratuit' : user.plan === 'PRO' ? 'Pro' : 'Business'}.`,
      options: [
        { value: 'FREE', label: 'Gratuit', hint: '5 devis par mois' },
        { value: 'PRO', label: 'Pro', hint: '30 devis, boutique, lien de paiement' },
        { value: 'BUSINESS', label: 'Business', hint: 'Tout illimité, modèles premium' },
      ],
      defaultValue: user.plan,
      confirmLabel: 'Continuer',
      tone: 'primary',
    });
    if (!plan) return;

    if (plan === 'FREE') {
      updatePlanMutation.mutate({ plan, months: null });
      return;
    }

    const months = await prompt({
      eyebrow: user.email,
      title: 'Durée du plan',
      description: "Nombre de mois accordés à partir d'aujourd'hui.",
      label: 'Durée (mois)',
      type: 'number',
      min: 1,
      max: 60,
      defaultValue: '1',
      helpText: "À l'échéance, le compte repasse automatiquement au plan gratuit.",
      confirmLabel: 'Appliquer',
      tone: 'primary',
    });
    if (months === null) return;
    updatePlanMutation.mutate({ plan, months: Number(months) });
  }

  async function handleCredits() {
    const value = await prompt({
      eyebrow: user.email,
      title: 'Ajuster les crédits IA',
      description: `Solde actuel : ${user.aiCredits ?? 0} crédits. Un nombre négatif en retire.`,
      label: 'Ajustement',
      type: 'number',
      min: -1000,
      max: 1000,
      defaultValue: '10',
      helpText: "L'opération apparaît dans l'historique de crédits du client.",
      confirmLabel: 'Appliquer',
      tone: 'primary',
    });
    if (value === null) return;
    updateCreditsMutation.mutate({ amount: Number(value) });
  }

  async function handleBlock() {
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
    if (ok) blockUserMutation.mutate({ blocked: blocking });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Détails de l'utilisateur</h1>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            ← Retour
          </Button>
        </div>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UsersIcon size={20} />
            <span>Informations utilisateur</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-primary rounded flex items-center justify-center">
              <span className="text-white font-bold text-xl">{user.name?.charAt(0) ?? 'U'}</span>
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-lg font-bold">{user.name}</div>
              <div className="text-sm text-text-muted">{user.email}</div>
              {user.companyName && (
                <div className="text-sm text-text-muted">{user.companyName}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div>
              <div className="text-sm font-medium text-text-muted">Plan</div>
              <Badge variant={user.plan === 'FREE' ? 'secondary' : user.plan === 'PRO' ? 'primary' : 'warning'}>
                {user.plan === 'FREE' ? 'Gratuit' : user.plan === 'PRO' ? 'Pro' : 'Business'}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-text-muted">Crédits IA</div>
              <div className="text-xl font-bold">{user.aiCredits}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-text-muted">Email vérifié</div>
              <Badge variant={user.isEmailVerified ? 'primary' : 'warning'}>
                {user.isEmailVerified ? 'Oui' : 'Non'}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-text-muted">Statut</div>
              <Badge variant={user.blocked ? 'destructive' : 'primary'}>
                {user.blocked ? 'Bloqué' : 'Actif'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <div className="text-sm font-medium text-text-muted">Inscription</div>
              <div className="text-sm">{new Date(user.createdAt || 0).toLocaleDateString('fr-FR')}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-text-muted">Dernière mise à jour</div>
              <div className="text-sm">{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString('fr-FR') : '-'}</div>
            </div>
          </div>

          {/* Counters from API */}
          {user._count && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-border">
              <div className="pt-3">
                <div className="text-sm font-medium text-text-muted">Devis</div>
                <div className="text-lg font-bold">{user._count.quotes ?? 0}</div>
              </div>
              <div className="pt-3">
                <div className="text-sm font-medium text-text-muted">Paiements</div>
                <div className="text-lg font-bold">{user._count.payments ?? 0}</div>
              </div>
              <div className="pt-3">
                <div className="text-sm font-medium text-text-muted">Logs d'activité</div>
                <div className="text-lg font-bold">{user._count.activityLogs ?? 0}</div>
              </div>
              <div className="pt-3">
                <div className="text-sm font-medium text-text-muted">Transactions crédits</div>
                <div className="text-lg font-bold">{user._count.creditTransactions ?? 0}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SettingsIcon size={20} />
            <span>Actions administratives</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handlePlan}>
              Modifier l'abonnement
            </Button>
            <Button variant="outline" onClick={handleCredits}>
              Ajuster les crédits
            </Button>
            <Button
              variant={user.blocked ? 'outline' : 'destructive'}
              onClick={handleBlock}
            >
              {user.blocked ? 'Débloquer' : "Bloquer l'utilisateur"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Quotes */}
      {user.quotes && user.quotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Derniers devis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {user.quotes.map((quote: any) => (
                <div key={quote.id} className="flex justify-between items-center border-b border-border pb-3">
                  <div>
                    <div className="font-medium">{quote.clientName || 'Client'}</div>
                    <div className="text-sm text-text-muted">
                      {quote.quoteNumber} · {new Date(quote.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {(quote.totalTTC || 0).toLocaleString('fr-FR')} XOF
                    </div>
                    <Badge variant={quote.status === 'PAID' ? 'primary' : 'secondary'}>
                      {quote.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Logs */}
      {user.activityLogs && user.activityLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {user.activityLogs.map((log: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center border-b border-border pb-3">
                  <div>
                    <div className="font-medium">{log.action}</div>
                    {log.details && (
                      <div className="text-xs text-text-muted mt-1">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-text-muted whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {dialog}
    </div>
  );
}