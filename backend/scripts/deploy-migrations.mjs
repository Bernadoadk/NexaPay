import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseline = '20260801121500_baseline';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const binName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';

/**
 * Résout le binaire Prisma sans dépendre du PATH : avec des workspaces npm, il
 * est hissé à la racine et `node_modules/.bin` du workspace peut être absent.
 * Repli sur `npx` si aucun chemin local ne correspond.
 */
function resolvePrismaBin() {
  const candidates = [
    path.resolve(scriptDir, '../node_modules/.bin', binName),
    path.resolve(scriptDir, '../../node_modules/.bin', binName),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found
    ? { command: found, prefix: [] }
    : { command: process.platform === 'win32' ? 'npx.cmd' : 'npx', prefix: ['prisma'] };
}

const { command, prefix } = resolvePrismaBin();

function run(args, { capture = false } = {}) {
  const result = spawnSync(command, [...prefix, ...args], {
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    // Un .cmd Windows ne peut être lancé sans shell. Les arguments sont des
    // constantes internes, jamais des entrées utilisateur.
    shell: command.endsWith('.cmd'),
  });

  if (result.error) throw result.error;
  return result;
}

// Prisma refuses `migrate deploy` on a database created before Prisma Migrate
// (P3005). Mark only our checked-in baseline as applied in that case. This
// writes migration metadata; it never runs the baseline SQL against Neon.
let deployed = run(['migrate', 'deploy'], { capture: true });
let deployOutput = `${deployed.stdout || ''}\n${deployed.stderr || ''}`;

// P3005 is emitted by `migrate deploy` (not `migrate status`). An empty
// database succeeds above and executes the baseline normally. For the existing
// Neon database, record the baseline as applied and retry without running it.
if (deployed.status !== 0 && deployOutput.includes('P3005')) {
  console.log('Existing database detected: recording the Prisma baseline without executing it.');
  const resolved = run(['migrate', 'resolve', '--applied', baseline]);
  if (resolved.status !== 0) process.exit(resolved.status ?? 1);

  deployed = run(['migrate', 'deploy'], { capture: true });
  deployOutput = `${deployed.stdout || ''}\n${deployed.stderr || ''}`;
}

process.stdout.write(deployed.stdout || '');
process.stderr.write(deployed.stderr || '');

// P3009 : une migration est enregistrée comme échouée. On ne « débloque » PAS
// automatiquement — marquer une migration comme appliquée alors qu'elle a
// réellement échoué laisserait la base dans un état incohérent, en silence.
if (deployed.status !== 0 && deployOutput.includes('P3009')) {
  const failed = deployOutput.match(/The `([^`]+)` migration started at/)?.[1];
  console.error(`
──────────────────────────────────────────────────────────────
Migration bloquée : ${failed ?? 'voir le message ci-dessus'}

Prisma refuse d'appliquer de nouvelles migrations tant que celle-ci
est marquée comme échouée. Diagnostiquez d'abord, sans rien modifier :

  npm run db:status --workspace=backend

Ce script indique si le schéma est intact (cas courant : la base
existait avant Prisma Migrate) ou si la migration a réellement laissé
la base à moitié migrée.
──────────────────────────────────────────────────────────────
`);
}

if (deployed.status !== 0) process.exit(deployed.status ?? 1);
