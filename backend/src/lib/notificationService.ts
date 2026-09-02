import { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { prisma } from './prisma';
import jwt from 'jsonwebtoken';
import { sendPushToUser } from './webPush';
import { notificationLink } from './notificationLinks';

// Sous-protocole utilisé pour transporter le JWT sans le mettre dans l'URL
// (une query string finit dans les logs d'accès et l'historique).
// Le client envoie ['nexapay-jwt', '<token>'].
const WS_PROTOCOL = 'nexapay-jwt';
const HEARTBEAT_MS = 30_000;

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

/**
 * Service for creating and managing notifications.
 *
 * Le temps réel est un bonus : le serveur WebSocket n'existe que sur un hôte
 * long-vivant (Render, dev local). Sur Vercel serverless `wss` reste nul et
 * `sendToUser` ne fait rien — le front retombe alors sur son polling
 * React Query, qui reste la source de vérité.
 */
export class NotificationService {
    static wss: WebSocketServer | null = null;
    private static heartbeat: NodeJS.Timeout | null = null;

    /**
     * Initialize WebSocket server
     * @param server HTTP server to attach WebSocket server to
     */
    static initializeWebSocketServer(server: Server) {
        if (!process.env.JWT_SECRET) {
            console.warn('[WS] JWT_SECRET absent — serveur WebSocket non démarré.');
            return;
        }

        this.wss = new WebSocketServer({
            server,
            // Sans cette confirmation, le navigateur ferme la connexion dès qu'il
            // a proposé un sous-protocole que le serveur n'a pas repris.
            handleProtocols: (protocols) => (protocols.has(WS_PROTOCOL) ? WS_PROTOCOL : false),
        });

        this.wss.on('connection', (ws: AuthenticatedSocket, req) => {
            // Ordre de lecture : sous-protocole (navigateur), puis Authorization
            // (clients natifs). Le token n'est jamais accepté depuis l'URL.
            const protocolHeader = req.headers['sec-websocket-protocol'] ?? '';
            const protocolToken = protocolHeader
                .split(',')
                .map((part) => part.trim())
                .find((part) => part && part !== WS_PROTOCOL);
            const token = protocolToken || req.headers['authorization']?.replace('Bearer ', '');

            if (!token) {
                ws.close(4001, 'Unauthorized');
                return;
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId?: string };
                if (!decoded.userId) throw new Error('userId manquant');
                ws.userId = decoded.userId;
            } catch {
                ws.close(4001, 'Unauthorized');
                return;
            }

            ws.isAlive = true;
            ws.on('pong', () => { ws.isAlive = true; });
        });

        // Ferme les sockets qui ne répondent plus (mobile en veille, réseau coupé),
        // sinon `wss.clients` grossit indéfiniment.
        this.heartbeat = setInterval(() => {
            this.wss?.clients.forEach((client) => {
                const socket = client as AuthenticatedSocket;
                if (socket.isAlive === false) {
                    socket.terminate();
                    return;
                }
                socket.isAlive = false;
                socket.ping();
            });
        }, HEARTBEAT_MS);

        this.wss.on('close', () => {
            if (this.heartbeat) clearInterval(this.heartbeat);
            this.heartbeat = null;
        });

        console.log('WebSocket server initialized');
    }

    /**
     * Send notification to a specific user via WebSocket
     * @param userId User ID to send notification to
     * @param notification Notification object to send
     */
    static sendToUser(userId: string, notification: any) {
        if (!this.wss)
            return;
        this.wss.clients.forEach((client) => {
            const socket = client as AuthenticatedSocket;
            if (socket.userId === userId && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'notification',
                    payload: notification
                }));
            }
        });
    }

    /**
     * Create a new notification and send it via WebSocket
     * @param userId User ID to create notification for
     * @param type Notification type
     * @param title Notification title
     * @param message Notification message (optional)
     * @param data Additional data (optional)
     * @returns Created notification
     */
    static async createNotification(userId: string, type: string, title: string, message: string | null = null, data: any = {}) {
        // Save to database
        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                data: data ?? {},
                isRead: false
            }
        });
        // Send via WebSocket (onglet ouvert)
        this.sendToUser(userId, {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            isRead: notification.isRead,
            createdAt: notification.createdAt
        });

        // Send via Web Push (application fermée)
        void sendPushToUser(userId, {
            title,
            body: message,
            url: notificationLink(type, data),
            tag: type,
            notificationId: notification.id,
        }).catch((err) => console.error('[Push]', err?.message ?? err));

        void this.pruneOldNotifications(userId);

        return notification;
    }

    /**
     * Mark notification as read
     * @param notificationId Notification ID
     * @param userId User ID (for authorization)
     * @returns Updated notification
     */
    static async markAsRead(notificationId: string, userId: string) {
        const notification = await prisma.notification.update({
            where: {
                id: notificationId,
                userId
            },
            data: {
                isRead: true
            }
        });
        // Send update via WebSocket
        this.sendToUser(userId, {
            id: notification.id,
            isRead: notification.isRead
        });
        return notification;
    }

    /**
     * Delete notification
     * @param notificationId Notification ID
     * @param userId User ID (for authorization)
     */
    static async deleteNotification(notificationId: string, userId: string) {
        await prisma.notification.delete({
            where: {
                id: notificationId,
                userId
            }
        });
        // Send deletion via WebSocket
        this.sendToUser(userId, {
            id: notificationId,
            deleted: true
        });
    }

    /**
     * Get notifications for a user
     * @param userId User ID
     * @param options Filter options
     * @returns Array of notifications
     */
    static async getNotifications(userId: string, options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}) {
        const { limit = 50, offset = 0, unreadOnly = false } = options;
        return await prisma.notification.findMany({
            where: {
                userId,
                ...(unreadOnly && { isRead: false })
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: limit,
            skip: offset
        });
    }

    /**
     * Supprime les notifications lues de plus de RETENTION_DAYS jours.
     *
     * Sans ça la table grossit indéfiniment : un compte actif accumule des
     * milliers de lignes que personne ne relira. Opportuniste et throttlé —
     * pas de tâche planifiée à maintenir.
     */
    private static lastPrune = new Map<string, number>();

    static async pruneOldNotifications(userId: string): Promise<void> {
        const RETENTION_DAYS = 60;
        const PRUNE_THROTTLE_MS = 24 * 60 * 60 * 1000;

        const last = this.lastPrune.get(userId) ?? 0;
        if (Date.now() - last < PRUNE_THROTTLE_MS) return;
        this.lastPrune.set(userId, Date.now());

        const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
        await prisma.notification
            .deleteMany({ where: { userId, isRead: true, createdAt: { lt: cutoff } } })
            .catch((err) => console.error('[Notifications] Purge échouée:', err?.message ?? err));
    }

    /**
     * Get unread notification count for a user
     * @param userId User ID
     * @returns Count of unread notifications
     */
    static async getUnreadCount(userId: string) {
        return await prisma.notification.count({
            where: {
                userId,
                isRead: false
            }
        });
    }
}
