import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { enforcePlanExpiry } from '../lib/planStatus';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'Token manquant' });
    return;
  }
  if (!process.env.JWT_SECRET) {
    console.error('[Auth] JWT_SECRET non configuré');
    res.status(500).json({ message: 'Configuration serveur incomplète' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true, blocked: true, plan: true, planExpiresAt: true },
    });

    if (!user) {
      res.status(401).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    if (user.blocked) {
      // `code` permet au client de distinguer ce cas d'un 403 métier
      // (plan insuffisant, modèle réservé…) et de déconnecter l'utilisateur.
      res.status(403).json({ message: 'Compte bloqué', code: 'ACCOUNT_BLOCKED' });
      return;
    }

    // Applique l'échéance de l'abonnement au passage : pas de cron à maintenir,
    // et aucune requête supplémentaire dans le cas courant (plan à jour).
    // Un échec ici ne doit pas se transformer en 401 : on laisse passer.
    await enforcePlanExpiry(payload.userId, user).catch((err) =>
      console.error('[Auth] Vérification du plan échouée:', err?.message ?? err),
    );

    req.userId = payload.userId;
    req.userRole = user.role;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalide' });
  }
}
