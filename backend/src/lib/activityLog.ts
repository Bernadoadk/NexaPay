import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Journal d'activité alimentant le back-office (utilisateurs actifs du jour,
 * page Activité, compteur par compte).
 *
 * Volontairement « fire-and-forget » : une écriture de journal ne doit jamais
 * faire échouer l'action métier qu'elle décrit, ni la ralentir.
 */
export function logActivity(
  userId: string,
  action: string,
  details?: Prisma.InputJsonValue,
  req?: Request,
): void {
  const forwarded = req?.headers['x-forwarded-for'];
  const ipAddress = req
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) || req.ip || null
    : null;

  void prisma.activityLog
    .create({
      data: {
        userId,
        action,
        details: details ?? undefined,
        ipAddress,
        userAgent: req?.headers['user-agent']?.slice(0, 500) ?? null,
      },
    })
    .catch((err) => console.error('[ActivityLog]', action, err?.message ?? err));
}
