import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
  useUnreadNotificationCount,
  getTimeAgo,
  type Notification,
} from '@/hooks/useNotifications';
import { notificationGroup, notificationLink, notificationVisual } from '@/lib/notificationTypes';
import { BellIcon, CheckIcon, TrashIcon, XIcon } from '@/components/ui/Icon';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PREVIEW_LIMIT = 8;

function NotificationRow({
  notification,
  onOpen,
  onDelete,
}: {
  notification: Notification;
  onOpen: (n: Notification) => void;
  onDelete: (id: string) => void;
}) {
  const { Icon, tone, bg } = notificationVisual(notification.type);

  return (
    <div
      className={`group relative flex items-start gap-3 px-4 py-3 transition-colors ${
        notification.isRead ? 'hover:bg-surface-2' : 'bg-primary-soft/40 hover:bg-primary-soft/60'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex items-start gap-3 flex-1 min-w-0 text-left"
      >
        <span className={`mt-0.5 w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${bg}`}>
          <Icon size={15} className={tone} />
        </span>

        <span className="flex-1 min-w-0 block">
          <span className="flex items-start justify-between gap-2">
            <span className={`text-[13px] truncate ${notification.isRead ? 'font-medium text-text' : 'font-semibold text-text'}`}>
              {notification.title}
            </span>
            <span className="text-[11px] text-text-muted flex-shrink-0 mt-0.5">
              {getTimeAgo(notification.createdAt)}
            </span>
          </span>
          {notification.message && (
            <span className="block text-[11.5px] leading-[1.45] text-text-muted mt-0.5 line-clamp-2">
              {notification.message}
            </span>
          )}
        </span>
      </button>

      {/* Pastille « non lu » — remplacée par le bouton supprimer au survol. */}
      {!notification.isRead && (
        <span
          aria-hidden
          className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary group-hover:opacity-0 transition-opacity"
        />
      )}
      <button
        type="button"
        aria-label="Supprimer la notification"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg grid place-items-center text-text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface hover:text-danger transition-opacity"
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );
}

export default function NotificationsDropdown({ open, onClose }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading, error, refetch } = useNotifications({ limit: PREVIEW_LIMIT });
  const { data: unreadCountData } = useUnreadNotificationCount();
  const unreadCount = unreadCountData?.count ?? 0;

  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();

  // Clic extérieur + touche Échap.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

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

  if (!open) return null;

  function openNotification(notification: Notification) {
    if (!notification.isRead) markAsRead.mutate(notification.id);
    navigate(notification.link || notificationLink(notification.type, notification.data));
    onClose();
  }

  const panel = (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      className="
        fixed inset-x-0 bottom-0 z-[9999] max-h-[80vh] rounded-t-2xl
        sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:bottom-auto sm:mt-1
        sm:w-[380px] sm:max-h-none sm:rounded-xl
        bg-surface border border-border shadow-lg overflow-hidden flex flex-col
      "
    >
      {/* Poignée de préhension, mobile uniquement */}
      <div className="sm:hidden pt-2.5 pb-1 grid place-items-center">
        <span className="w-9 h-1 rounded-full bg-border-strong" />
      </div>

      <header className="px-4 py-3 border-b border-border flex items-center gap-2">
        <BellIcon size={15} className="text-text-muted" />
        <h2 className="text-[13.5px] font-semibold flex-1">Notifications</h2>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="flex items-center gap-1 text-[12px] text-primary hover:underline disabled:opacity-50"
          >
            <CheckIcon size={13} /> Tout marquer lu
          </button>
        )}
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="sm:hidden w-7 h-7 rounded-lg grid place-items-center text-text-muted hover:bg-surface-2"
        >
          <XIcon size={15} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin sm:max-h-[400px]">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-surface-2 flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-2.5 w-1/2 rounded bg-surface-2" />
                  <div className="h-2.5 w-4/5 rounded bg-surface-2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-10 px-4 text-center">
            <p className="text-[13px] text-text-muted">Impossible de charger les notifications.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 text-[12.5px] text-primary hover:underline"
            >
              Réessayer
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-11 h-11 rounded-2xl bg-surface-2 grid place-items-center mx-auto mb-3">
              <BellIcon size={18} className="text-text-subtle" />
            </div>
            <p className="text-[13px] font-medium text-text">Aucune notification</p>
            <p className="text-[12px] text-text-muted mt-1">
              Paiements, commandes et alertes apparaîtront ici.
            </p>
          </div>
        ) : (
          grouped.map(([label, items]) => (
            <section key={label}>
              <h3 className="px-4 pt-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-text-subtle">
                {label}
              </h3>
              <div className="divide-y divide-border">
                {items.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onOpen={openNotification}
                    onDelete={(id) => deleteNotification.mutate(id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <footer className="px-4 py-2.5 border-t border-border pb-[max(env(safe-area-inset-bottom),0.625rem)] sm:pb-2.5">
        <button
          type="button"
          onClick={() => {
            navigate('/notifications');
            onClose();
          }}
          className="w-full text-[12.5px] font-medium text-center text-primary hover:underline"
        >
          Voir toutes les notifications
        </button>
      </footer>
    </div>
  );

  // Sur mobile la feuille est ancrée au bas de l'écran : elle doit sortir du
  // flux de l'en-tête, d'où le portail (avec voile). Sur desktop, le panneau
  // reste positionné sous la cloche.
  return (
    <>
      {createPortal(
        <div className="sm:hidden fixed inset-0 z-[9998] bg-black/40" onClick={onClose} aria-hidden />,
        document.body,
      )}
      {panel}
    </>
  );
}
