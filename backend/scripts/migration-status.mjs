/**
 * Diagnostic de l'état des migrations. LECTURE SEULE — n'écrit rien.
 *
 *   npm run db:status --workspace=backend
 *
 * À lancer quand `migrate deploy` refuse d'avancer (P3009 : une migration est
 * enregistrée comme échouée). Affiche le journal `_prisma_migrations` et
 * vérifie quelles tables existent réellement, pour décider en connaissance de
 * cause plutôt que de « débloquer » à l'aveugle.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function fmt(date) {
  return date ? new Date(date).toISOString().replace('T', ' ').slice(0, 19) : '—';
}

try {
  const url = new URL(process.env.DATABASE_URL ?? '');
  console.log(`\nBase : ${url.hostname}${url.pathname}\n`);
} catch {
  console.log('\nDATABASE_URL illisible\n');
}

// ── Journal des migrations ────────────────────────────────────────────
let rows = [];
try {
  rows = await prisma.$queryRaw`
    SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, logs
    FROM "_prisma_migrations"
    ORDER BY started_at`;
} catch {
  console.log('Table _prisma_migrations absente : aucune migration Prisma n\'a jamais été appliquée.');
}

if (rows.length > 0) {
  console.log('── Journal des migrations ────────────────────────────────\n');
  for (const row of rows) {
    let state = '✅ appliquée';
    if (row.rolled_back_at) state = '↩️  annulée';
    else if (!row.finished_at) state = '❌ ÉCHOUÉE (bloquante)';

    console.log(`${state}  ${row.migration_name}`);
    console.log(`   démarrée ${fmt(row.started_at)} · terminée ${fmt(row.finished_at)} · étapes ${row.applied_steps_count}`);
    if (!row.finished_at && row.logs) {
      const firstLine = String(row.logs).split('\n').find((l) => l.trim());
      console.log(`   cause : ${firstLine?.slice(0, 160)}`);
    }
    console.log('');
  }
}

// ── Tables réellement présentes ───────────────────────────────────────
console.log('── Schéma réel ───────────────────────────────────────────\n');

const expected = [
  'User', 'Client', 'Quote', 'QuoteItem', 'Product', 'Payment',
  'Store', 'StoreProduct', 'StoreOrder', 'StoreOrderItem', 'StorePayment',
  'QuoteTemplate', 'QuoteTemplateItem', 'OtpCode', 'CreditTransaction',
  'PlanPayment', 'CreditPayment', 'FeedbackReview',
  'Notification', 'ActivityLog', 'PushSubscription',
];

const present = await prisma.$queryRaw`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'`;
const names = new Set(present.map((t) => t.table_name));

const missing = expected.filter((t) => !names.has(t));
const found = expected.filter((t) => names.has(t));

console.log(`Tables attendues présentes : ${found.length}/${expected.length}`);
if (missing.length > 0) console.log(`Manquantes : ${missing.join(', ')}`);

// Colonnes ajoutées par la migration « notifications_activity_roles »
const userColumns = await prisma.$queryRaw`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'User'`;
const columnNames = new Set(userColumns.map((c) => c.column_name));
console.log(`Colonne User.role : ${columnNames.has('role') ? '✅ présente' : '❌ absente'}`);
console.log(`Colonne User.blocked : ${columnNames.has('blocked') ? '✅ présente' : '❌ absente'}`);

// ── Verdict ───────────────────────────────────────────────────────────
console.log('\n── Verdict ───────────────────────────────────────────────\n');

const failed = rows.filter((r) => !r.finished_at && !r.rolled_back_at);
const baseTablesPresent = names.has('User') && names.has('Quote');

if (failed.length === 0) {
  console.log('Aucune migration bloquée.');
} else {
  for (const row of failed) {
    console.log(`Migration bloquante : ${row.migration_name}`);
  }
  if (baseTablesPresent) {
    console.log(
      '\nLes tables de base existent déjà : cette migration a échoué parce que\n' +
      "le schéma était antérieur à Prisma Migrate (créé par « db push »).\n" +
      'PostgreSQL exécute chaque migration dans une transaction, donc rien\n' +
      "n'a été modifié — la base est intacte.\n\n" +
      'Réparation (voir la procédure fournie) :\n' +
      `  npx prisma migrate resolve --rolled-back ${failed[0].migration_name}\n` +
      `  npx prisma migrate resolve --applied ${failed[0].migration_name}\n` +
      '  npm run db:deploy --workspace=backend',
    );
  } else {
    console.log(
      '\n⚠️  Les tables de base sont absentes : la migration a réellement\n' +
      'échoué en cours de route. Restaurez une sauvegarde Neon avant toute\n' +
      'autre action.',
    );
  }
}

console.log('');
await prisma.$disconnect();
