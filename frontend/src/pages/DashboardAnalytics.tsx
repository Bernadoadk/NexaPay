import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import CardHeader from '@/components/ui/CardHeader';
import CardTitle from '@/components/ui/CardTitle';
import CardContent from '@/components/ui/CardContent';
import Table from '@/components/ui/Table';
import TableHeader from '@/components/ui/TableHeader';
import TableBody from '@/components/ui/TableBody';
import TableRow from '@/components/ui/TableRow';
import TableCell from '@/components/ui/TableCell';
import { RefreshCw, UserPlus, ClipboardList, BarChart3, PieChart, MessageCircle } from 'lucide-react';

interface UserItem {
  id: string;
  name: string;
  email: string;
  plan: 'FREE' | 'PRO' | 'BUSINESS';
  aiCredits: number;
  blocked: boolean;
  isEmailVerified: boolean;
}

export default function DashboardAnalytics() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: () => analyticsApi.stats().then(res => res.data),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['analytics-users'],
    queryFn: () => analyticsApi.users({ limit: 100 }).then(res => res.data),
  });
  const users: UserItem[] = Array.isArray(usersData) ? usersData : usersData?.users || [];

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['analytics-activity'],
    queryFn: () =>
      analyticsApi.activity({
        limit: 1000,
      }).then(res => res.data),
  });
  const activityLogs: any[] = Array.isArray(activityData) ? activityData : activityData?.logs || [];

  // Mutations
  const blockUserMutation = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      analyticsApi.blockUser(id, blocked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-users'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: 'FREE' | 'PRO' | 'BUSINESS' }) =>
      analyticsApi.updateUserPlan(id, plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-users'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
    },
  });

  const updateCreditsMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      analyticsApi.updateUserCredits(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-users'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
    },
  });

  // Process activity logs for chart (daily active users last 7 days)
  const getStartOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const sevenDaysAgo = getStartOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const dailyActiveMap = new Map<string, number>();

  activityLogs.forEach((log: any) => {
    const logDate = getStartOfDay(new Date(log.createdAt));
    if (logDate >= sevenDaysAgo) {
      const key = logDate.toISOString().split('T')[0];
      const count = dailyActiveMap.get(key) || 0;
      dailyActiveMap.set(key, count + 1);
    }
  });

  // Ensure all 7 days present
  const chartData: { day: string; active: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dayStr = getStartOfDay(day).toISOString().split('T')[0];
    chartData.push({
      day: day.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' }),
      active: dailyActiveMap.get(dayStr) || 0,
    });
  }

  if (statsLoading || usersLoading || activityLoading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-text-muted">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tableau de bord analytique</h1>
        <div className="flex space-x-3">
          <Button variant="secondary" onClick={() => queryClient.invalidateQueries()}>
            <RefreshCw size={18} /> Actualiser
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserPlus size={20} />
              <span>Utilisateurs</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-3xl font-bold">{stats?.users?.total ?? 0}</p>
            <p className="text-sm text-text-muted">
              {stats?.users?.newToday ?? 0} nouveaux aujourd'hui · {stats?.users?.activeToday ?? 0} actifs aujourd'hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ClipboardList size={20} />
              <span>Devis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-3xl font-bold">{stats?.quotes?.total ?? 0}</p>
            <p className="text-sm text-text-muted">
              {stats?.quotes?.today ?? 0} aujourd'hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 size={20} />
              <span>Paiements</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-3xl font-bold">
              {stats?.payments?.total ?? 0}
            </p>
            <p className="text-sm text-text-muted">
              {stats?.payments?.revenue?.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' }) ?? '0 XOF'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart size={20} />
              <span>Répartition plans</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries((stats?.plans ?? {}) as Record<string, number>).map(([plan, count]) => (
              <div key={plan} className="flex justify-between mb-2">
                <span>{plan === 'FREE' ? 'Gratuit' : plan === 'PRO' ? 'Pro' : 'Business'}</span>
                <Badge variant={plan === 'FREE' ? 'secondary' : plan === 'PRO' ? 'primary' : 'destructive'}>
                  {String(count)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 size={20} />
            <span>Utilisateurs actifs quotidiens (7 derniers jours)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 relative">
            {chartData.map((day, idx) => {
              const maxActive = Math.max(...chartData.map(d => d.active), 1);
              const height = (day.active / maxActive) * 100;
              return (
                <div
                  key={idx}
                  className="absolute bottom-0"
                  style={{
                    left: `${(idx / chartData.length) * 100}%`,
                    width: `${100 / chartData.length}%`,
                    height: '100%',
                  }}
                >
                  <div
                    className="h-full w-full flex flex-col justify-end items-center px-1"
                  >
                    <div
                      className="w-full bg-primary rounded-t"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    ></div>
                    <div className="text-xs text-text-muted text-center w-full mt-1">
                      {day.day}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle size={20} />
            <span>Utilisateurs récents</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Nom / Email</TableCell>
                <TableCell className="text-center">Plan</TableCell>
                <TableCell className="text-center">Crédits IA</TableCell>
                <TableCell className="text-center">Statut</TableCell>
                <TableCell className="text-center">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="flex items-center space-x-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-text-muted">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        user.plan === 'FREE'
                          ? 'secondary'
                          : user.plan === 'PRO'
                          ? 'primary'
                          : 'destructive'
                      }
                    >
                      {user.plan === 'FREE' ? 'Gratuit' : user.plan === 'PRO' ? 'Pro' : 'Business'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{user.aiCredits}</TableCell>
                  <TableCell className="text-center">
                    {user.blocked ? (
                      <Badge variant="destructive">Bloqué</Badge>
                    ) : user.isEmailVerified ? (
                      <Badge variant="primary">Vérifié</Badge>
                    ) : (
                      <Badge variant="warning">Non vérifié</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const blocked = !user.blocked;
                        if (window.confirm(`${blocked ? 'Bloquer' : 'Débloquer'} l'utilisateur ${user.name} ?`)) {
                          blockUserMutation.mutate({ id: user.id, blocked });
                        }
                      }}
                    >
                      {user.blocked ? 'Débloquer' : 'Bloquer'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-2"
                      onClick={() => {
                        const plans = ['FREE', 'PRO', 'BUSINESS'] as const;
                        const currentIdx = plans.indexOf(user.plan);
                        const nextPlan = plans[(currentIdx + 1) % plans.length];
                        const amount =
                          nextPlan === 'PRO'
                            ? 80
                            : nextPlan === 'BUSINESS'
                            ? 200
                            : 0;
                        if (
                          window.confirm(
                            `Changer le plan de ${user.name} vers ${nextPlan} (${amount} crédits) ?`
                          )
                        ) {
                          updatePlanMutation.mutate({ id: user.id, plan: nextPlan });
                          if (amount > 0) {
                            updateCreditsMutation.mutate({ id: user.id, amount });
                          }
                        }
                      }}
                    >
                      Changer plan
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}