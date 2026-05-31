import { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
  key?: (req: Request) => string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
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
