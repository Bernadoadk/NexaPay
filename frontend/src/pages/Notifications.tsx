import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
  useDeleteReadNotifications,
  getTimeAgo,
  type Notification,
} from '@/hooks/useNotifications';
import { notificationGroup, notificationLink, notificationVisual } from '@/lib/notificationTypes';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import { BellIcon, CheckIcon, TrashIcon } from '@/components/ui/Icon';

const PAGE_SIZE = 20;

type Filter = 'all' | 'unread';

export default function Notifications() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const { confirm, confirmDialog } = useConfirmDialog();

  const { data: notifications = [], isLoading, error, refetch } = useNotifications({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    unreadOnly: filter === 'unread',
  });
  const { data: unreadCountData } = useUnreadNotificationCount();
  const unreadCount = unreadCountData?.count ?? 0;

  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();
  const deleteRead = useDeleteReadNotifications();

  const grouped = useMemo(() => {
    const groups = new Map<string, Notification[]>();
    for (const notification of notifications) {
      const label = notificationGroup(notification.createdAt);
      const bucket = groups.get(label);
      if (bucket) bucket.push(notification);
      else groups.set(label, [notification]);
    }
    return [...groups.entries()];
  }, [notifications]);

  function openNotification(notification: Notification) {
    if (!notification.isRead) markAsRead.mutate(notification.id);
    navigate(notification.link || notificationLink(notification.type, notification.data));
  }

  async function handleDeleteRead() {
    const ok = await confirm({
      title: 'Effacer les notifications lues',
      description: 'Les notifications déjà lues seront définitivement supprimées. Les non lues sont conservées.',
      confirmLabel: 'Effacer',
      tone: 'danger',
    });
    if (ok) deleteRead.mutate();
  }

  // Une page pleine laisse supposer qu'il en reste — l'API ne renvoie pas de total.
  const hasNextPage = notifications.length === PAGE_SIZE;

  return (
    <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-5 sm:py-7">
      <header className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <h1 className="text-[20px] sm:text-[24px] font-semibold tracking-[-0.02em]">Notifications</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Tout est à jour'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending}>
              <CheckIcon size={15} /> Tout marquer lu
            </Button>
          )}
          <Button variant="secondary" onClick={handleDeleteRead} disabled={deleteRead.isPending}>
            <TrashIcon size={15} /> Effacer les lues
          </Button>
        </div>
      </header>

      {/* Filtres */}
      <div className="flex items-center gap-1.5 mb-4">
        {([
          { key: 'all' as const, label: 'Toutes' },
          { key: 'unread' as const, label: `Non lues${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
        ]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              setPage(0);
            }}
            className={`h-8 px-3 rounded-lg text-[12.5px] font-medium transition-colors ${
              filter === key
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-lg bg-surface-2 flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-1/3 rounded bg-surface-2" />
                  <div className="h-3 w-3/4 rounded bg-surface-2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-14 text-center">
            <p className="text-[13.5px] text-text-muted">Impossible de charger les notifications.</p>
            <Button variant="secondary" className="mt-3" onClick={() => refetch()}>
              Réessayer
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 grid place-items-center mx-auto mb-3">
              <BellIcon size={20} className="text-text-subtle" />
            </div>
            <p className="text-[14px] font-medium">
              {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
            </p>
            <p className="text-[12.5px] text-text-muted mt-1">
              Paiements reçus, commandes, reversements et alertes s'afficheront ici.
            </p>
          </div>
        ) : (
          grouped.map(([label, items]) => (
            <section key={label}>
              <h2 className="px-4 py-2 bg-surface-2 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-text-subtle border-b border-border">
                {label}
              </h2>
              <div className="divide-y divide-border">
                {items.map((notification) => {
                  const { Icon, tone, bg, category } = notificationVisual(notification.type);
                  return (
                    <div
                      key={notification.id}
                      className={`group flex items-start gap-3 px-4 py-3.5 transition-colors ${
                        notification.isRead ? 'hover:bg-surface-2' : 'bg-primary-soft/40 hover:bg-primary-soft/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="flex items-start gap-3 flex-1 min-w-0 text-left"
                      >
                        <span className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${bg}`}>
                          <Icon size={16} className={tone} />
                        </span>
                        <span className="flex-1 min-w-0 block">
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-subtle">
                              {category}
                            </span>
                            {!notification.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-label="Non lue" />
                            )}
                          </span>
                          <span className="block text-[13.5px] font-semibold text-text mt-0.5">
                            {notification.title}
                          </span>
                          {notification.message && (
                            <span className="block text-[12.5px] leading-relaxed text-text-muted mt-0.5">
                              {notification.message}
                            </span>
                          )}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[11.5px] text-text-muted whitespace-nowrap">
                          {getTimeAgo(notification.createdAt)}
                        </span>
                        <button
                          type="button"
                          aria-label="Supprimer"
                          onClick={() => deleteNotification.mutate(notification.id)}
                          className="w-7 h-7 rounded-lg grid place-items-center text-text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface hover:text-danger transition-opacity"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {(page > 0 || hasNextPage) && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Précédent
          </Button>
          <span className="text-[12.5px] text-text-muted">Page {page + 1}</span>
          <Button variant="secondary" disabled={!hasNextPage} onClick={() => setPage((p) => p + 1)}>
            Suivant
          </Button>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
