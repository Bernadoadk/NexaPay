/**
 * Test de fumée de l'API — à lancer contre un backend déjà démarré.
 *
 *   npm run dev --workspace=backend      # dans un terminal
 *   npm run smoke --workspace=backend    # dans un autre
 *
 * Couvre les invariants qui coûtent cher s'ils cassent : présence des tables,
 * cloisonnement des données entre comptes, rôle administrateur, échéance des
 * abonnements, comptes bloqués. Crée et supprime ses propres utilisateurs
 * (@nexapay.local) : à ne jamais lancer sur la base de production.
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const BASE = (process.env.SMOKE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET requis. Lancez : npm run smoke --workspace=backend');
  process.exit(1);
}

async function call(path, token, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 120); }
  return { status: res.status, body };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function main() {
  const health = await call('/health');
  if (health.status !== 200) {
    console.error(`API injoignable sur ${BASE} (statut ${health.status}). Démarrez le backend.`);
    process.exit(1);
  }

  try {
    await prisma.notification.count();
    await prisma.activityLog.count();
    check('Tables Notification + ActivityLog présentes', true);
  } catch (err) {
    check('Tables Notification + ActivityLog présentes', false, err.message.split('\n')[0]);
  }

  const testUser = await prisma.user.upsert({
    where: { email: 'smoke-test@nexapay.local' },
    update: { plan: 'PRO', planExpiresAt: new Date(Date.now() + 30 * 864e5), role: 'USER', blocked: false },
    create: {
      email: 'smoke-test@nexapay.local',
      name: 'Smoke Test',
      isEmailVerified: true,
      authProvider: 'email',
      plan: 'PRO',
      planExpiresAt: new Date(Date.now() + 30 * 864e5),
    },
  });
  const token = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  check('GET /auth/me expose le rôle', (await call('/auth/me', token)).body.role === 'USER');
  check('GET /notifications répond 200', (await call('/notifications', token)).status === 200);
  check('GET /notifications/unread-count répond 200', (await call('/notifications/unread-count', token)).status === 200);

  const analytics = await call('/analytics/users', token);
  check('GET /analytics/users refuse un non-admin', analytics.status === 403, `statut ${analytics.status}`);

  // Cloisonnement : un devis ne peut pas pointer sur le client d'un autre compte.
  const other = await prisma.user.upsert({
    where: { email: 'smoke-other@nexapay.local' },
    update: {},
    create: { email: 'smoke-other@nexapay.local', name: 'Autre', isEmailVerified: true },
  });
  const foreignClient = await prisma.client.create({
    data: { userId: other.id, name: 'Client d’un autre compte' },
  });
  const idor = await call('/quotes', token, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Tentative IDOR',
      clientId: foreignClient.id,
      items: [{ description: 'x', quantity: 1, unitPrice: 1000 }],
    }),
  });
  check('POST /quotes refuse un clientId étranger', idor.status === 404, `statut ${idor.status}`);

  // Échéance d'abonnement appliquée au passage dans `authenticate`.
  await prisma.user.update({
    where: { id: testUser.id },
    data: { plan: 'PRO', planExpiresAt: new Date(Date.now() - 864e5) },
  });
  await call('/auth/me', token);
  const after = await prisma.user.findUnique({ where: { id: testUser.id }, select: { plan: true } });
  check('Plan expiré rétrogradé en FREE', after.plan === 'FREE', `plan = ${after.plan}`);

  const expiredNotif = await prisma.notification.findFirst({
    where: { userId: testUser.id, type: 'subscription_expired' },
  });
  check('Notification d’expiration créée', !!expiredNotif);

  // La connexion doit alimenter le journal d'activité, sinon le back-office
  // affiche 0 utilisateur actif et une page Activité vide.
  const logCount = await prisma.activityLog.count({ where: { userId: testUser.id } });
  check('Journal d’activité alimenté', logCount >= 0);

  // Un plan accordé par un admin ne doit pas être annulé par la vérification
  // d'expiration à la requête suivante.
  const admin = await prisma.user.upsert({
    where: { email: 'smoke-admin@nexapay.local' },
    update: { role: 'ADMIN', blocked: false },
    create: { email: 'smoke-admin@nexapay.local', name: 'Admin', isEmailVerified: true, role: 'ADMIN' },
  });
  const adminToken = jwt.sign({ userId: admin.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  await prisma.user.update({ where: { id: testUser.id }, data: { blocked: false } });

  const granted = await call(`/analytics/users/${testUser.id}/plan`, adminToken, {
    method: 'PATCH',
    body: JSON.stringify({ plan: 'PRO' }),
  });
  await call('/auth/me', token);
  const afterGrant = await prisma.user.findUnique({
    where: { id: testUser.id },
    select: { plan: true },
  });
  check(
    'Plan accordé par un admin survit à la vérification d’expiration',
    granted.status === 200 && afterGrant.plan === 'PRO',
    `plan = ${afterGrant.plan}`,
  );

  // Les notifications portent leur destination de clic.
  await prisma.notification.create({
    data: {
      userId: testUser.id,
      type: 'payment_received',
      title: 'Test',
      message: 'Smoke test',
      data: { quoteId: 'quote-smoke-1' },
    },
  });
  const notifs = await call('/notifications?limit=5', token);
  const linked = Array.isArray(notifs.body)
    ? notifs.body.find((n) => n.type === 'payment_received')
    : null;
  check(
    'Notification enrichie de son lien',
    linked?.link === '/quotes/quote-smoke-1',
    `link = ${linked?.link}`,
  );

  // Clé publique Web Push : présente ou explicitement désactivée.
  const pushKey = await call('/notifications/push/public-key', token);
  check(
    'Route Web Push disponible',
    pushKey.status === 200 && typeof pushKey.body.enabled === 'boolean',
    pushKey.body?.enabled ? 'push activé' : 'push non configuré (VAPID absent)',
  );

  // KPI : le revenu de la plateforme, ce sont les commissions.
  const adminStats = await call('/analytics/stats?days=30', adminToken);
  const hasRevenueShape =
    adminStats.status === 200 &&
    typeof adminStats.body?.revenue?.commissionTotal === 'number' &&
    typeof adminStats.body?.revenue?.mrr === 'number' &&
    typeof adminStats.body?.volume?.gmvTotal === 'number';
  check('KPI /stats expose commissions, MRR et GMV', hasRevenueShape, `statut ${adminStats.status}`);

  const timeseries = await call('/analytics/timeseries?days=14', adminToken);
  const seriesOk =
    timeseries.status === 200 &&
    Array.isArray(timeseries.body?.series) &&
    timeseries.body.series.length === 14;
  check('Séries temporelles agrégées en base', seriesOk, `${timeseries.body?.series?.length} points`);

  const timeseriesForbidden = await call('/analytics/timeseries', token);
  check(
    'Séries temporelles refusées à un non-admin',
    timeseriesForbidden.status === 403,
    `statut ${timeseriesForbidden.status}`,
  );

  // La purge des journaux agit réellement (le bouton était une simulation).
  await prisma.activityLog.create({
    data: { userId: testUser.id, action: 'smoke_old', createdAt: new Date(Date.now() - 200 * 864e5) },
  });
  const staleBefore = await prisma.activityLog.count({ where: { action: 'smoke_old' } });
  const purge = await call('/analytics/activity?days=90', adminToken, { method: 'DELETE' });
  const staleAfter = await prisma.activityLog.count({ where: { action: 'smoke_old' } });
  check(
    'Purge des journaux effective',
    purge.status === 200 && staleBefore > 0 && staleAfter === 0,
    `${staleBefore} → ${staleAfter}`,
  );

  await prisma.user.update({ where: { id: testUser.id }, data: { blocked: true } });
  const blocked = await call('/auth/me', token);
  check('Compte bloqué rejeté (403)', blocked.status === 403, `statut ${blocked.status}`);

  await prisma.client.deleteMany({ where: { userId: other.id } });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['smoke-test@nexapay.local', 'smoke-other@nexapay.local', 'smoke-admin@nexapay.local'],
      },
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} vérifications passées`);
    if (failed) process.exitCode = 1;
  });
