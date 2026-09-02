import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, any> | null;
  /** Destination du clic, calculée par le back-end. */
  link?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

const POLL_MS = 30_000;

export const useNotifications = (options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}) => {
  return useQuery<Notification[], Error>({
    queryKey: ['notifications', options],
    queryFn: () => notificationsApi.list(options).then(res => res.data),
    staleTime: POLL_MS,
    // Le WebSocket n'est pas garanti (serverless) : le polling reste la
    // source de vérité, la socket ne fait qu'accélérer le rafraîchissement.
    refetchInterval: POLL_MS,
  });
};

export const useUnreadNotificationCount = () => {
  return useQuery<{ count: number }, Error>({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.unreadCount().then(res => res.data),
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
  });
};

/** Invalide les deux listes après toute mutation. */
function useNotificationMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

// `void` en paramètre : permet d'appeler `.mutate()` sans argument.
export const useMarkAllNotificationsAsRead = () =>
  useNotificationMutation<void>(() => notificationsApi.markAllAsRead());

export const useMarkNotificationAsRead = () =>
  useNotificationMutation((id: string) => notificationsApi.markAsRead(id));

export const useDeleteNotification = () =>
  useNotificationMutation((id: string) => notificationsApi.delete(id));

export const useDeleteReadNotifications = () =>
  useNotificationMutation<void>(() => notificationsApi.deleteRead());

/** Horodatage relatif court, en français. */
export const getTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "à l'instant";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} h`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} j`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};
