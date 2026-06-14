#!/usr/bin/env bun
/**
 * migrate-to-n-minus-1 — put the DB one migration BEHIND the code on disk.
 *
 * Used by the Plan D "code↔DB drift gate" (.github/workflows/quality.yml). It
 * migrates the database to N-1 by running drizzle's migrator against a temporary
 * copy of the migrations folder with the LAST journal entry withheld. The gate
 * then boots the current api-ts (which carries all N migrations) and asserts it
 * auto-migrates the withheld one on boot AND that a withTenantTx write then
 * succeeds — locking the self-heal path the live incident exposed.
 *
 * Usage:
 *   DATABASE_URL=… bun scripts/migrate-to-n-minus-1.ts
 *
 * Exit 0 = DB is now exactly N-1; 1 = could not reach that state.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(__dirname, '../src/generated/migrations');
const DB_URL = process.env['DATABASE_URL'] || 'postgres://postgres:password@localhost:5432/monobase';

async function main(): Promise<void> {
  const journalPath = path.join(MIGRATIONS, 'meta/_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  const entries = journal.entries;
  if (entries.length < 2) {
    throw new Error(`need >= 2 migrations to withhold one, have ${entries.length}`);
  }
  const withheld = entries[entries.length - 1]!;
  const target = entries.length - 1;

  // Temp migrations folder = full copy MINUS the last journal entry. The .sql files
  // are copied verbatim so their hashes match — the real boot-time migrate() then
  // recognises N-1 as already applied and applies only the withheld one.
  const tmp = mkdtempSync(path.join(tmpdir(), 'mig-n-1-'));
  cpSync(MIGRATIONS, tmp, { recursive: true });
  writeFileSync(
    path.join(tmp, 'meta/_journal.json'),
    JSON.stringify({ ...journal, entries: entries.slice(0, -1) }, null, 2),
  );

  const pool = new Pool({ connectionString: DB_URL });
  const db = drizzle(pool);
  console.log(`Migrating to N-1 = ${target} (withholding ${withheld.tag})…`);
  await migrate(db, { migrationsFolder: tmp });

  const { rows } = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations',
  );
  const applied = Number(rows[0]?.count ?? 0);
  await pool.end();
  rmSync(tmp, { recursive: true, force: true });

  if (applied !== target) {
    console.error(`✗ expected ${target} migrations applied, got ${applied}`);
    process.exit(1);
  }
  console.log(`✓ DB is now one migration BEHIND the code (applied ${applied}, withheld ${withheld.tag}).`);
}

main().catch((err) => {
  console.error('migrate-to-n-minus-1 failed:', err);
  process.exit(1);
});
