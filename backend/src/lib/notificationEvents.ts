import { prisma } from './prisma';
import { NotificationService } from './notificationService';

/**
 * Émetteurs de notifications métier.
 *
 * Centralisés ici pour que les types restent alignés avec ce que sait afficher
 * le front (icône, couleur, lien de destination). Toute nouvelle notification
 * doit être déclarée dans NOTIFICATION_TYPES ci-dessous.
 */
export const NOTIFICATION_TYPES = [
  'payment_received',
  'payout_completed',
  'payout_failed',
  'quote_sent',
  'quote_expiring',
  'order_received',
  'stock_out',
  'new_client',
  'credits_low',
  'credits_empty',
  'subscription_expiring',
  'subscription_expired',
  'subscription_updated',
  'credits_updated',
  'account_blocked',
  'feedback_received',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Seuil sous lequel on prévient l'utilisateur que ses crédits s'épuisent. */
const LOW_CREDITS_THRESHOLD = 5;
/** Fenêtre anti-répétition : une même alerte n'est pas renvoyée avant ce délai. */
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatXof(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

/** Ne notifie que si aucune notification du même type n'a été émise récemment. */
async function notifyOnce(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data: Record<string, unknown> = {},
  windowMs = DEDUPE_WINDOW_MS,
): Promise<void> {
  const recent = await prisma.notification.findFirst({
    where: { userId, type, createdAt: { gte: new Date(Date.now() - windowMs) } },
    select: { id: true },
  });
  if (recent) return;
  await NotificationService.createNotification(userId, type, title, message, data);
}

/** Reversement Mobile Money effectué. */
export async function notifyPayoutCompleted(
  userId: string,
  netAmount: number,
  reference: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  await NotificationService.createNotification(
    userId,
    'payout_completed',
    'Reversement effectué',
    `${formatXof(netAmount)} ont été envoyés sur votre numéro Mobile Money (${reference}).`,
    data,
  );
}

/**
 * Reversement en échec — l'utilisateur doit agir (numéro MoMo invalide,
 * opérateur indisponible). Sans cette alerte, l'argent reste bloqué en silence.
 */
export async function notifyPayoutFailed(
  userId: string,
  netAmount: number,
  reference: string,
  reason: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  await NotificationService.createNotification(
    userId,
    'payout_failed',
    'Reversement échoué',
    `Le versement de ${formatXof(netAmount)} (${reference}) n'a pas abouti : ${reason}. Vérifiez votre numéro Mobile Money puis relancez le reversement.`,
    { ...data, reason },
  );
}

/** Solde de crédits IA bas ou épuisé, au plus une fois par jour et par palier. */
export async function notifyCreditsThreshold(userId: string, remaining: number): Promise<void> {
  if (remaining === 0) {
    await notifyOnce(
      userId,
      'credits_empty',
      'Crédits IA épuisés',
      "Vous n'avez plus de crédits IA. Rechargez pour continuer à utiliser l'assistant.",
      { remaining },
    );
    return;
  }
  if (remaining <= LOW_CREDITS_THRESHOLD) {
    await notifyOnce(
      userId,
      'credits_low',
      'Crédits IA bientôt épuisés',
      `Il vous reste ${remaining} crédit${remaining > 1 ? 's' : ''} IA.`,
      { remaining },
    );
  }
}

/** Nouveau client ajouté au carnet d'adresses. */
export async function notifyNewClient(userId: string, clientId: string, name: string): Promise<void> {
  await NotificationService.createNotification(
    userId,
    'new_client',
    'Nouveau client',
    `${name} a été ajouté à vos clients.`,
    { clientId },
  );
}

/** Produit boutique tombé à zéro. */
export async function notifyStockOut(userId: string, productId: string, name: string): Promise<void> {
  await NotificationService.createNotification(
    userId,
    'stock_out',
    'Stock épuisé',
    `Le produit « ${name} » n'a plus de stock disponible.`,
    { productId },
  );
}

/** Accusé de réception d'un message envoyé au support. */
export async function notifyFeedbackReceived(userId: string, subject: string): Promise<void> {
  await NotificationService.createNotification(
    userId,
    'feedback_received',
    'Message bien reçu',
    `Votre message « ${subject} » a été transmis à l'équipe NexaPay.`,
    {},
  );
}

/**
 * Devis envoyés dont la validité expire bientôt.
 *
 * Vérification paresseuse : appelée au chargement de la liste des devis, elle
 * évite un cron tout en restant peu coûteuse (une requête, throttlée par
 * utilisateur). La notification n'est émise qu'une fois par devis.
 */
const lastExpiryScan = new Map<string, number>();
const EXPIRY_SCAN_THROTTLE_MS = 60 * 60 * 1000;
const EXPIRY_WARNING_DAYS = 3;

export async function scanExpiringQuotes(userId: string): Promise<void> {
  const last = lastExpiryScan.get(userId) ?? 0;
  if (Date.now() - last < EXPIRY_SCAN_THROTTLE_MS) return;
  lastExpiryScan.set(userId, Date.now());

  const quotes = await prisma.quote.findMany({
    where: { userId, status: 'SENT' },
    select: { id: true, number: true, issuedAt: true, validDays: true, total: true },
  });

  const now = Date.now();
  for (const quote of quotes) {
    if (!quote.validDays) continue;
    const expiresAt = quote.issuedAt.getTime() + quote.validDays * 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
    if (daysLeft > EXPIRY_WARNING_DAYS || daysLeft < 0) continue;

    const already = await prisma.notification.findFirst({
      where: { userId, type: 'quote_expiring', data: { path: ['quoteId'], equals: quote.id } },
      select: { id: true },
    });
    if (already) continue;

    await NotificationService.createNotification(
      userId,
      'quote_expiring',
      'Devis bientôt expiré',
      daysLeft <= 0
        ? `Le devis ${quote.number} arrive à échéance aujourd'hui.`
        : `Le devis ${quote.number} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}. Pensez à relancer votre client.`,
      { quoteId: quote.id, daysLeft },
    );
  }
}
