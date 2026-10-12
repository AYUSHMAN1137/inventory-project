#!/usr/bin/env node
/**
 * Prepares a dedicated E2E database (prisma/e2e.db): resets the schema, seeds it,
 * and then starts the API server against it. Used as the Playwright webServer
 * command for the API so browser tests never touch the developer's dev.db.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(import.meta.url), '..');
const root = resolve(here, '..');
const apiDir = resolve(root, 'apps/api');
const dbPath = resolve(apiDir, 'prisma/e2e.db');
const prismaCli = resolve(root, 'node_modules/prisma/build/index.js');
const tsxCli = resolve(root, 'node_modules/tsx/dist/cli.mjs');

if (existsSync(dbPath)) unlinkSync(dbPath);

const env = { ...process.env, DATABASE_URL: 'file:./e2e.db', NODE_ENV: 'test', PORT: '4000' };

execFileSync(process.execPath, [prismaCli, 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate', '--force-reset'], {
  cwd: apiDir,
  env,
  stdio: 'inherit',
});

execFileSync(process.execPath, [tsxCli, 'prisma/seed.ts'], { cwd: apiDir, env, stdio: 'inherit' });

console.log('[e2e] e2e.db prepared — starting API…');

const api = spawn(process.execPath, [tsxCli, 'src/server.ts'], { cwd: apiDir, env, stdio: 'inherit' });
api.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => api.kill(sig));
}
