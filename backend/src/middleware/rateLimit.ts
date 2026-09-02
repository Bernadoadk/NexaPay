import { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
  key?: (req: Request) => string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

// Sur un hôte long-vivant (Render), la Map grossirait indéfiniment : une entrée
// par IP et par adresse e-mail tentée. On purge les fenêtres expirées de temps
// en temps, en profitant d'une requête entrante — pas de timer à nettoyer.
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweepExpired(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Limiteur de débit en mémoire.
 *
 * ⚠️ L'état vit dans le process. Sur un hébergement multi-instances ou
 * serverless (Vercel), chaque instance a son propre compteur : la limite
 * effective est donc `max × nombre d'instances`. C'est une protection contre
 * les abus grossiers, pas contre un attaquant déterminé — pour ça il faut un
 * store partagé (Redis/Upstash) ou le rate limiting de la plateforme.
 */
export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    sweepExpired(now);

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const suffix = options.key ? options.key(req) : ip;
    const key = `${options.keyPrefix}:${suffix}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (current.count >= options.max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        message: options.message || 'Trop de tentatives. Réessayez plus tard.',
        retryAfter,
      });
      return;
    }

    current.count += 1;
    next();
  };
}
