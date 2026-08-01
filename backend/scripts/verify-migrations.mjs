import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(scriptDir, '../prisma/migrations');
const forbiddenSql = [/\bDROP\s+TABLE\b/i, /\bDROP\s+COLUMN\b/i, /\bDROP\s+TYPE\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i];

let entries = [];
try {
  entries = await readdir(migrationsDir, { withFileTypes: true });
} catch (error) {
  if (error?.code === 'ENOENT') process.exit(0);
  throw error;
}

const unsafeMigrations = [];
for (const entry of entries.filter((entry) => entry.isDirectory())) {
  const migrationPath = path.join(migrationsDir, entry.name, 'migration.sql');
  try {
    const sql = await readFile(migrationPath, 'utf8');
    if (forbiddenSql.some((pattern) => pattern.test(sql))) unsafeMigrations.push(entry.name);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (unsafeMigrations.length > 0) {
  console.error(`Deployment cancelled: destructive SQL detected in ${unsafeMigrations.join(', ')}. Create a Neon backup and run any data-removal migration manually after review.`);
  process.exit(1);
}
