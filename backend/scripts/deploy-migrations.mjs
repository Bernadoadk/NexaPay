import { spawnSync } from 'node:child_process';

const baseline = '20260801121500_baseline';
const prisma = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';

function run(args, { capture = false } = {}) {
  const result = spawnSync(prisma, args, {
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });

  if (result.error) throw result.error;
  return result;
}

// Prisma refuses `migrate deploy` on a database created before Prisma Migrate
// (P3005). Mark only our checked-in baseline as applied in that case. This
// writes migration metadata; it never runs the baseline SQL against Neon.
const status = run(['migrate', 'status'], { capture: true });
const statusOutput = `${status.stdout || ''}\n${status.stderr || ''}`;

if (statusOutput.includes('P3005')) {
  console.log('Existing database detected: recording the Prisma baseline without executing it.');
  const resolved = run(['migrate', 'resolve', '--applied', baseline]);
  if (resolved.status !== 0) process.exit(resolved.status ?? 1);
} else if (status.status !== 0) {
  process.stdout.write(status.stdout || '');
  process.stderr.write(status.stderr || '');
  console.warn('Migration status needs attention; attempting the safe deploy command.');
}

const deployed = run(['migrate', 'deploy']);
if (deployed.status !== 0) process.exit(deployed.status ?? 1);
