import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function generateQuoteNumber(userId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DV-${year}-`;
  const last = await prisma.quote.findFirst({
    where: { userId, number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const next = last ? parseInt(last.number.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}
