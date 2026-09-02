/**
 * Contrôle avant mise en ligne.
 *
 *   npm run preflight --workspace=backend
 *
 * À lancer avec le DATABASE_URL de PRODUCTION (lecture seule : ce script
 * n'écrit rien). Il vérifie la configuration et signale les comptes que la
 * vérification d'échéance des abonnements va rétrograder au premier appel.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const problems = [];
const warnings = [];

function required(name, hint) {
  if (!process.env[name]) problems.push(`${name} manquante — ${hint}`);
}

function recommended(name, hint) {
  if (!process.env[name]) warnings.push(`${name} absente — ${hint}`);
}

console.log('\n── Variables d\'environnement ──────────────────────────\n');

required('DATABASE_URL', 'la base est inaccessible sans elle');
required('JWT_SECRET', 'toute route authentifiée répondra 500');
required('FRONTEND_URL', 'CORS refusera le front et les liens de paiement seront faux');

// Depuis le durcissement, ces deux-là ne sont plus optionnelles en production.
required(
  'FEDAPAY_WEBHOOK_SHARED_SECRET',
  'les webhooks FedaPay seront REJETÉS en 401 (signature non vérifiable)',
);
required('FEDAPAY_SECRET_KEY', 'aucun encaissement ni reversement possible');
required(
  'GOOGLE_CLIENT_ID',
  'la connexion Google échouera (le repli non sécurisé a été supprimé)',
);

recommended('VAPID_PUBLIC_KEY', 'notifications système désactivées (npx web-push generate-vapid-keys)');
recommended('VAPID_PRIVATE_KEY', 'notifications système désactivées');
recommended('SMTP_HOST', 'aucun e-mail (OTP, devis) ne partira');
recommended('CLOUDINARY_CLOUD_NAME', 'les envois de logos échoueront');
recommended('OPENAI_API_KEY', 'les fonctions IA répondront « bientôt disponible »');

if (problems.length === 0) console.log('✅ Toutes les variables obligatoires sont présentes.');
problems.forEach((p) => console.log(`❌ ${p}`));
warnings.forEach((w) => console.log(`⚠️  ${w}`));

console.log('\n── Base de données ────────────────────────────────────\n');

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log('✅ Connexion établie.');

  // Les tables ajoutées récemment doivent exister, sinon les routes 500.
  for (const [label, check] of [
    ['Notification', () => prisma.notification.count()],
    ['ActivityLog', () => prisma.activityLog.count()],
    ['PushSubscription', () => prisma.pushSubscription.count()],
  ]) {
    try {
      const count = await check();
      console.log(`✅ Table ${label} présente (${count} lignes).`);
    } catch {
      console.log(`❌ Table ${label} ABSENTE — lancez « npm run db:deploy --workspace=backend ».`);
      problems.push(`table ${label} manquante`);
    }
  }

  // `role` n'existe qu'après la migration : son absence ne doit pas être
  // rapportée comme une panne de connexion.
  try {
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (admins === 0) {
      console.log('❌ Aucun compte ADMIN — le back-office sera inaccessible (npm run db:seed).');
      problems.push('aucun administrateur');
    } else {
      console.log(`✅ ${admins} compte(s) administrateur.`);
    }
  } catch {
    console.log('❌ Colonne User.role absente — migration non appliquée.');
    problems.push('colonne role manquante');
  }

  console.log('\n── Impact de l\'échéance des abonnements ───────────────\n');

  // `planExpiresAt` n'était jamais relu : des comptes ont pu dépasser leur
  // échéance tout en gardant leurs droits. Ils seront rétrogradés au premier
  // appel authentifié après la mise en ligne.
  let expiring = [];
  try {
    expiring = await prisma.user.findMany({
      where: {
        plan: { not: 'FREE' },
        planExpiresAt: { lt: new Date() },
      },
      select: { email: true, plan: true, planExpiresAt: true },
      orderBy: { planExpiresAt: 'desc' },
    });
  } catch {
    console.log('⚠️  Lecture impossible (schéma incomplet) — relancez après la migration.');
  }

  if (expiring.length === 0) {
    console.log('✅ Aucun compte payant à échéance dépassée.');
  } else {
    console.log(`⚠️  ${expiring.length} compte(s) vont repasser en FREE dès leur prochaine requête :`);
    expiring.slice(0, 20).forEach((user) => {
      console.log(
        `   • ${user.email} — ${user.plan}, expiré le ${user.planExpiresAt.toLocaleDateString('fr-FR')}`,
      );
    });
    if (expiring.length > 20) console.log(`   … et ${expiring.length - 20} autre(s).`);
    console.log('\n   Si certains doivent conserver leur accès, prolongez-les depuis le');
    console.log('   back-office (Utilisateurs → Plan) AVANT la mise en ligne.');
  }

  const noExpiry = await prisma.user
    .count({ where: { plan: { not: 'FREE' }, planExpiresAt: null } })
    .catch(() => 0);
  if (noExpiry > 0) {
    console.log(`\nℹ️  ${noExpiry} compte(s) payant(s) sans date d'échéance : ils ne seront pas touchés.`);
  }
} catch (err) {
  console.log(`❌ Connexion impossible : ${err.message.split('\n')[0]}`);
  problems.push('base inaccessible');
}

await prisma.$disconnect();

console.log('\n───────────────────────────────────────────────────────');
if (problems.length > 0) {
  console.log(`❌ ${problems.length} problème(s) bloquant(s). Corrigez avant de déployer.\n`);
  process.exitCode = 1;
} else {
  console.log('✅ Prêt pour la mise en ligne.\n');
}
