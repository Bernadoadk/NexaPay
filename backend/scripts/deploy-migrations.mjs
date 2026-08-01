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
if (deployed.status !== 0) process.exit(deployed.status ?? 1);
