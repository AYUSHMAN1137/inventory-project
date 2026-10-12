import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Resets and reseeds the E2E database while the API is running. Called before
 * each spec file so tests are order-independent and one file's writes (new
 * items, receipts, issues) can't break another file's assertions.
 *
 * The API holds an open handle on the SQLite file, so we cannot delete it.
 * Instead we clear every table and re-run the seed script.
 *
 * NOTE: no `import.meta` here — Playwright transpiles specs to CommonJS.
 */
const root = process.cwd();
const apiDir = resolve(root, 'apps/api');
const tsxCli = resolve(root, 'node_modules/tsx/dist/cli.mjs');
const prismaCli = resolve(root, 'node_modules/prisma/build/index.js');

const TABLES = [
  'AuditEvent',
  'StockMovement',
  'StockReceipt',
  'StockBalance',
  'ReturnLineUnit',
  'ReturnLine',
  'Return',
  'IssueLineUnit',
  'IssueLine',
  'Issue',
  'RequestLine',
  'Request',
  'KitItem',
  'Kit',
  'InventoryUnit',
  'Item',
  'Category',
  'ProjectMember',
  'Project',
  'Session',
  'User',
];

export function resetDatabase() {
  const dbPath = resolve(apiDir, 'prisma/e2e.db');
  if (!existsSync(dbPath)) {
    throw new Error(`E2E database not found at ${dbPath} — did the API webServer run?`);
  }

  const sql = [
    'PRAGMA foreign_keys=OFF;',
    ...TABLES.map((t) => `DELETE FROM "${t}";`),
    'PRAGMA foreign_keys=ON;',
  ].join('\n');

  execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: 'file:./e2e.db' },
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  execFileSync(process.execPath, [tsxCli, 'prisma/seed.ts'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: 'file:./e2e.db', NODE_ENV: 'test' },
    stdio: 'pipe',
  });
}
