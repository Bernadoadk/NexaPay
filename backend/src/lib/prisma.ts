import { PrismaClient } from '@prisma/client';

// Une seule instance Prisma (obligatoire sur Vercel serverless + Neon pooled)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Conservé sur le global dans tous les environnements : en développement pour
// survivre au hot-reload de tsx, en serverless pour être réutilisé d'une
// invocation à l'autre sur la même instance.
globalForPrisma.prisma = prisma;
