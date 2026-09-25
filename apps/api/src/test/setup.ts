import { beforeAll, beforeEach, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../db.js';

const apiRoot = resolve(import.meta.dirname, '../..');
const databasePath = resolve(apiRoot, 'prisma/test.db');
const prismaCli = resolve(apiRoot, '../../node_modules/prisma/build/index.js');

beforeAll(async () => {
  await prisma.$disconnect();
  if (existsSync(databasePath)) unlinkSync(databasePath);
  execFileSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', '--force-reset'], {
    cwd: apiRoot,
    env: { ...process.env },
    stdio: 'pipe',
  });
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'",
  );
  for (const { name } of tables) {
    const safeName = name.replaceAll('"', '""');
    await prisma.$executeRawUnsafe(`DELETE FROM "${safeName}"`);
  }
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
});

afterAll(async () => {
  await prisma.$disconnect();
  if (existsSync(databasePath)) unlinkSync(databasePath);
});
