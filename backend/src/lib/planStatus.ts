import { Plan } from '@prisma/client';
import { prisma } from './prisma';
import { NotificationService } from './notificationService';

const EXPIRY_WARNING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PlanSnapshot {
  plan: Plan;
  planExpiresAt: Date | null;
}

export function isPlanExpired(user: PlanSnapshot, now = new Date()): boolean {
  return user.plan !== 'FREE' && !!user.planExpiresAt && user.planExpiresAt.getTime() <= now.getTime();
}

/**
 * Rétrograde un abonnement arrivé à échéance.
 *
 * `planExpiresAt` était écrit à l'achat mais jamais relu : un plan payé un mois
 * restait actif indéfiniment. La vérification est paresseuse — faite au passage
 * dans `authenticate`, qui charge déjà l'utilisateur — plutôt que via un cron,
 * pour rester compatible avec l'hébergement serverless.
 *
 * Retourne le plan effectif après application.
 */
export async function enforcePlanExpiry(userId: string, user: PlanSnapshot): Promise<Plan> {
  const now = new Date();

  if (isPlanExpired(user, now)) {
    const previousPlan = user.plan;
    // Conditionné sur le plan courant : deux requêtes concurrentes ne
    // produisent qu'un seul downgrade, donc une seule notification.
    const downgraded = await prisma.user.updateMany({
      where: { id: userId, plan: previousPlan },
      data: { plan: 'FREE' },
    });

    if (downgraded.count > 0) {
      await NotificationService.createNotification(
        userId,
        'subscription_expired',
        'Abonnement expiré',
        `Votre plan ${previousPlan} est arrivé à échéance. Vous êtes repassé au plan gratuit.`,
        { previousPlan },
      ).catch((err) => console.error('[PlanExpiry] Notification échouée:', err?.message ?? err));
    }
    return 'FREE';
  }

  await maybeWarnBeforeExpiry(userId, user, now);
  return user.plan;
}

/** Prévient une fois lorsqu'il reste moins de 7 jours d'abonnement. */
async function maybeWarnBeforeExpiry(userId: string, user: PlanSnapshot, now: Date): Promise<void> {
  if (user.plan === 'FREE' || !user.planExpiresAt) return;

  const msLeft = user.planExpiresAt.getTime() - now.getTime();
  if (msLeft <= 0 || msLeft > EXPIRY_WARNING_DAYS * DAY_MS) return;

  const alreadyWarned = await prisma.notification.findFirst({
    where: {
      userId,
      type: 'subscription_expiring',
      createdAt: { gte: new Date(now.getTime() - EXPIRY_WARNING_DAYS * DAY_MS) },
    },
    select: { id: true },
  });
  if (alreadyWarned) return;

  const daysLeft = Math.max(1, Math.ceil(msLeft / DAY_MS));
  await NotificationService.createNotification(
    userId,
    'subscription_expiring',
    'Abonnement bientôt expiré',
    `Votre plan ${user.plan} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}. Renouvelez-le pour conserver vos fonctionnalités.`,
    { plan: user.plan, expiresAt: user.planExpiresAt.toISOString() },
  ).catch((err) => console.error('[PlanExpiry] Notification échouée:', err?.message ?? err));
}
