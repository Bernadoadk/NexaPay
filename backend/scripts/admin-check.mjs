/**
 * Vérifie qu'un mot de passe ouvre bien un compte administrateur, sur la base
 * réellement ciblée. LECTURE SEULE.
 *
 *   $env:ADMIN_PASSWORD="..."; npm run admin:check --workspace=backend
 *
 * Rejoue exactement ce que fait /auth/login : compte trouvé, fournisseur
 * accepté, mot de passe comparé au hash. Aucun secret n'est affiché — seulement
 * le verdict et l'empreinte de la base interrogée, pour lever toute ambiguïté
 * sur « quelle base ai-je modifiée ».
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

let target = 'inconnue';
try {
  const url = new URL(process.env.DATABASE_URL ?? '');
  target = `${url.hostname}${url.pathname}`;
} catch { /* URL absente ou malformée */ }

console.log(`\nBase interrogée : ${target}\n`);

const email = (process.env.ADMIN_EMAIL || 'adikpetobernado@gmail.com').toLowerCase();
const candidate = process.env.ADMIN_PASSWORD;

if (!candidate) {
  console.error('ADMIN_PASSWORD requis pour la vérification.');
  console.error('PowerShell : $env:ADMIN_PASSWORD="..."; npm run admin:check --workspace=backend\n');
  process.exitCode = 1;
} else {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, name: true, password: true, role: true,
      authProvider: true, blocked: true, isEmailVerified: true, createdAt: true,
    },
  });

  if (!user) {
    console.log(`❌ Aucun compte « ${email} » dans CETTE base.`);
    console.log('   C\'est le signe que le .env ne vise pas la base attendue.\n');
    process.exitCode = 1;
  } else {
    console.log(`Compte : ${email} (${user.name})`);
    console.log(`  identifiant interne : ${user.id}`);
    console.log(`  créé le             : ${user.createdAt.toLocaleDateString('fr-FR')}`);
    console.log(`  rôle                : ${user.role}`);
    console.log(`  fournisseur         : ${user.authProvider}`);
    console.log(`  bloqué              : ${user.blocked ? 'OUI' : 'non'}\n`);

    // Les trois refus possibles de /auth/login, dans l'ordre.
    if (user.authProvider !== 'email') {
      console.log(`❌ /auth/login refuse : compte lié à ${user.authProvider}.`);
      process.exitCode = 1;
    } else if (!user.password) {
      console.log('❌ /auth/login refuse : aucun mot de passe enregistré.');
      process.exitCode = 1;
    } else {
      const matches = await bcrypt.compare(candidate, user.password);
      if (matches) {
        console.log('✅ Le mot de passe correspond sur cette base.');
        if (user.role !== 'ADMIN') {
          console.log('⚠️  Mais le rôle n\'est pas ADMIN : le back-office refusera l\'accès.');
          process.exitCode = 1;
        }
      } else {
        console.log('❌ Le mot de passe NE correspond PAS sur cette base.');
        console.log('   Soit la réinitialisation a visé une autre base, soit');
        console.log('   le mot de passe saisi diffère de celui enregistré.');
        process.exitCode = 1;
      }
    }
  }
}

console.log('');
await prisma.$disconnect();
