/**
 * État des comptes administrateur. LECTURE SEULE.
 *
 *   npm run admin:status --workspace=backend
 *
 * Répond à « pourquoi la connexion au back-office échoue » : mauvais mot de
 * passe, compte lié à Google/Apple (donc sans mot de passe utilisable), compte
 * bloqué, ou rôle non accordé. N'affiche évidemment aucun secret.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const admins = await prisma.user.findMany({
  where: { role: 'ADMIN' },
  select: {
    email: true,
    name: true,
    password: true,
    authProvider: true,
    isEmailVerified: true,
    blocked: true,
    createdAt: true,
  },
});

if (admins.length === 0) {
  console.log('\n❌ Aucun compte ADMIN. Lancez : npm run db:seed --workspace=backend\n');
} else {
  console.log(`\n${admins.length} compte(s) administrateur :\n`);
  for (const admin of admins) {
    const hasPassword = Boolean(admin.password);
    console.log(`• ${admin.email}  (${admin.name})`);
    console.log(`  fournisseur      : ${admin.authProvider}`);
    console.log(`  mot de passe     : ${hasPassword ? 'défini' : 'AUCUN'}`);
    console.log(`  e-mail vérifié   : ${admin.isEmailVerified ? 'oui' : 'non'}`);
    console.log(`  bloqué           : ${admin.blocked ? 'OUI' : 'non'}`);
    console.log(`  créé le          : ${admin.createdAt.toLocaleDateString('fr-FR')}`);

    // `/auth/login` refuse tout compte dont authProvider n'est pas 'email'.
    if (admin.authProvider !== 'email') {
      console.log(
        `\n  ⚠️  Ce compte se connecte via ${admin.authProvider}. La console\n` +
        '     d\'administration n\'ayant qu\'un formulaire e-mail / mot de passe,\n' +
        '     la connexion échouera tant qu\'un mot de passe ne sera pas défini.',
      );
    } else if (!hasPassword) {
      console.log('\n  ⚠️  Aucun mot de passe enregistré : connexion impossible.');
    }
    console.log('');
  }

  console.log(
    'Pour (re)définir le mot de passe d\'un administrateur :\n' +
    '  ADMIN_RESET_PASSWORD=yes ADMIN_PASSWORD="..." npm run db:seed --workspace=backend\n' +
    '  (PowerShell : $env:ADMIN_RESET_PASSWORD="yes"; $env:ADMIN_PASSWORD="..."; npm run db:seed --workspace=backend)\n',
  );
}

await prisma.$disconnect();
