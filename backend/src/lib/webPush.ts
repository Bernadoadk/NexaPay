import webpush from 'web-push';
import { prisma } from './prisma';

/**
 * Notifications système (Web Push).
 *
 * Complète le temps réel WebSocket : celui-ci ne fonctionne que si l'onglet est
 * ouvert, alors qu'un encaissement doit pouvoir réveiller l'utilisateur
 * application fermée. Silencieusement désactivé si les clés VAPID sont absentes.
 *
 * Générer les clés une fois :  npx web-push generate-vapid-keys
 */
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:support@nexapay.app';

export const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
} else {
  console.warn('[Push] VAPID non configuré — notifications système désactivées.');
}

export function getVapidPublicKey(): string | null {
  return pushEnabled ? publicKey! : null;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(
  userId: string,
  subscription: PushSubscriptionInput,
  userAgent?: string,
): Promise<void> {
  // L'endpoint identifie le navigateur : on réassigne au dernier utilisateur
  // connecté sur cet appareil plutôt que de créer un doublon.
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 500) ?? null,
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 500) ?? null,
    },
  });
}

export async function removeSubscription(endpoint: string, userId: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
}

export interface PushPayload {
  title: string;
  body?: string | null;
  url?: string;
  tag?: string;
  notificationId?: string;
}

/**
 * Envoie une notification système à tous les appareils d'un utilisateur.
 * Les abonnements expirés (404/410) sont purgés au passage.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!pushEnabled) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const expired: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          expired.push(sub.endpoint);
        } else {
          console.error('[Push] Envoi échoué:', status, err?.message);
        }
      }
    }),
  );

  if (expired.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { endpoint: { in: expired } } })
      .catch(() => {});
  }
}
