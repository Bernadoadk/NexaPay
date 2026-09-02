import { Router } from 'express';
import { NotificationService } from '../lib/notificationService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { notificationLink } from '../lib/notificationLinks';
import { getVapidPublicKey, pushEnabled, removeSubscription, saveSubscription } from '../lib/webPush';

const router = Router();

/** Ajoute la destination de clic pour que le client n'ait pas à la recalculer. */
function withLink<T extends { type: string; data: unknown }>(notification: T) {
  return { ...notification, link: notificationLink(notification.type, notification.data) };
}

/** P2025 : Prisma n'a trouvé aucune ligne correspondant au `where` (id + userId). */
function isRecordNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2025';
}

// Protect all notification routes
router.use(authenticate);

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.patch('/mark-all-read', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * GET /api/notifications
 * Fetch notifications for the logged-in user
 */
router.get('/', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!;
        const { limit, offset, unreadOnly } = req.query;
        const parsedLimit = limit ? Math.min(100, Math.max(1, parseInt(limit as string) || 20)) : undefined;
        const parsedOffset = offset ? Math.max(0, parseInt(offset as string) || 0) : undefined;
        const notifications = await NotificationService.getNotifications(userId, {
            limit: parsedLimit,
            offset: parsedOffset,
            unreadOnly: unreadOnly === 'true'
        });
        res.json(notifications.map(withLink));
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for the logged-in user
 */
router.get('/unread-count', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!;
        const count = await NotificationService.getUnreadCount(userId);
        res.json({ count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/:id/read', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!;
        const id = req.params.id as string;
        const notification = await NotificationService.markAsRead(id, userId);
        res.json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        if (isRecordNotFound(error)) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!;
        const id = req.params.id as string;
        await NotificationService.deleteNotification(id, userId);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting notification:', error);
        if (isRecordNotFound(error)) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

/**
 * DELETE /api/notifications
 * Delete all read notifications for the user
 */
router.delete('/', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!;
        await prisma.notification.deleteMany({
            where: {
                userId,
                isRead: true
            }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting read notifications:', error);
        res.status(500).json({ error: 'Failed to delete notifications' });
    }
});

/**
 * GET /api/notifications/push/public-key
 * Clé VAPID à utiliser côté navigateur. `null` si le push n'est pas configuré :
 * le client sait alors ne pas proposer l'activation.
 */
router.get('/push/public-key', (_req, res) => {
    res.json({ publicKey: getVapidPublicKey(), enabled: pushEnabled });
});

/**
 * POST /api/notifications/push/subscribe
 * Body: { endpoint, keys: { p256dh, auth } }
 */
router.post('/push/subscribe', async (req: AuthRequest, res) => {
    const { endpoint, keys } = req.body ?? {};
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'Abonnement push invalide' });
    }
    if (!pushEnabled) {
        return res.status(503).json({ error: 'Notifications système non configurées' });
    }

    try {
        await saveSubscription(
            req.userId!,
            { endpoint, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) } },
            req.headers['user-agent'],
        );
        res.status(201).json({ success: true });
    } catch (error) {
        console.error('[Push] subscribe:', error);
        res.status(500).json({ error: 'Enregistrement impossible' });
    }
});

/** POST /api/notifications/push/unsubscribe — Body: { endpoint } */
router.post('/push/unsubscribe', async (req: AuthRequest, res) => {
    const { endpoint } = req.body ?? {};
    if (typeof endpoint !== 'string') {
        return res.status(400).json({ error: 'Endpoint requis' });
    }
    await removeSubscription(endpoint, req.userId!);
    res.status(204).send();
});

export { router as notificationsRouter };