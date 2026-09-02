import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Crée (ou promeut) le compte administrateur du back-office.
 *
 * Volontairement non destructif : sur un compte déjà existant, seul le rôle est
 * accordé. Le mot de passe n'est écrit qu'à la création, sinon un seed lancé par
 * erreur sur la base de production réinitialiserait les identifiants du
 * propriétaire.
 *
 * Variables : ADMIN_EMAIL, ADMIN_PASSWORD (obligatoire à la création),
 * ADMIN_NAME (optionnel).
 */
async function main() {
  const email = (process.env.ADMIN_EMAIL || 'adikpetobernado@gmail.com').toLowerCase();
  const name = process.env.ADMIN_NAME || 'Bernado';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role === 'ADMIN') {
      console.log(`ℹ️  ${email} est déjà administrateur — rien à faire.`);
      return;
    }
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    console.log(`✅ ${email} promu administrateur (mot de passe inchangé).`);
    return;
  }

  const plainPassword = process.env.ADMIN_PASSWORD;
  if (!plainPassword || plainPassword.length < 8) {
    console.error(
      'ADMIN_PASSWORD manquant (8 caractères minimum). Exemple :\n' +
      '  ADMIN_PASSWORD="…" npm run db:seed --workspace=backend',
    );
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(plainPassword, 10),
      name,
      companyName: 'NexaPay',
      isEmailVerified: true,
      authProvider: 'email',
      role: 'ADMIN',
    },
  });

  console.log('✅ Compte administrateur créé — email:', user.email);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
