import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'adikpetobernado@gmail.com' },
    update: {},
    create: {
      email: 'adikpetobernado@gmail.com',
      password,
      name: 'Kévin Aguidi',
      companyName: 'Studio Aguidi',
      phone: '01 97 18 02 33',
      address: 'Cocotomey, Lot 412 — Abomey-Calavi',
      ifu: '3201900923418',
      rccm: 'RB/COT/22 B 4729',
    },
  });

  const clients = await Promise.all([
    prisma.client.upsert({
      where: { id: 'seed-c1' },
      update: {},
      create: {
        id: 'seed-c1', userId: user.id,
        name: 'Maison Tossou SARL', contact: 'Émile Tossou',
        email: 'emile@maisontossou.bj', phone: '01 97 23 14 02',
        city: 'Cotonou', color: '#0F8F65',
      },
    }),
    prisma.client.upsert({
      where: { id: 'seed-c3' },
      update: {},
      create: {
        id: 'seed-c3', userId: user.id,
        name: 'Pharmacie du Lac', contact: 'Dr. Béatrice Akpo',
        email: 'pharmaculac@gmail.com', phone: '01 95 12 67 30',
        city: 'Cotonou', color: '#C2691B',
      },
    }),
    prisma.client.upsert({
      where: { id: 'seed-c6' },
      update: {},
      create: {
        id: 'seed-c6', userId: user.id,
        name: 'TechAfrik Bénin', contact: 'Olivier Adégbola',
        email: 'o.adegbola@techafrik.bj', phone: '01 90 33 71 09',
        city: 'Cotonou', color: '#2563EB',
      },
    }),
  ]);

  console.log('✅ Seed terminé — utilisateur:', user.email);
  console.log('   Clients créés:', clients.map(c => c.name).join(', '));
}

main().catch(console.error).finally(() => prisma.$disconnect());
