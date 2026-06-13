/**
 * Migration-safety regression for 0069 (imported_pmd.source_description).
 *
 * THE HAZARD: migration 0069 originally did
 *   ALTER TABLE "imported_pmd" ADD COLUMN "source_description" text NOT NULL;
 * — a NOT NULL column with NO DEFAULT, added to a table created 63 migrations
 * earlier (0006). Postgres rejects that ALTER on a *populated* table (existing
 * rows cannot satisfy NOT NULL without a default), so any environment that had
 * recorded an imported_pmd row before upgrading would FAIL TO BOOT. The migrator
 * (drizzle-orm/node-postgres) runs the whole pending chain in one transaction, so
 * a failure here halts every later migration too — a forward-only fix can't rescue
 * it. Fresh installs seed post-migration against an empty table, which is why CI
 * stayed green and the gap shipped.
 *
 * THE FIX: 0069 was rewritten to the safe 3-step (add nullable -> backfill ->
 * SET NOT NULL), which is correct on both empty and populated tables and ends in
 * the identical schema (source_description NOT NULL).
 *
 * THIS TEST applies the REAL 0069 SQL (read from disk) to a throwaway schema that
 * holds the pre-0069 imported_pmd shape with a row already in it. It is RED against
 * the original single-statement 0069 (the ALTER throws) and GREEN against the safe
 * rewrite. Because it reads the file, it also guards against a future regression
 * that reintroduces an unsafe NOT NULL add to this column.
 *
 * Harness note: this needs real DDL on a disposable target, so it does NOT use
 * openTestTx (a nested tx would commit). It builds an isolated sub-schema inside the
 * per-file clone DB via createDatabase's ?schema= search_path support, and tears it
 * down after. Mirrors the non-transactional pattern in audit-immutability-db.test.ts.
 */

import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createDatabase, closeDatabaseConnection } from '@/core/database';

const TEST_SCHEMA = 'migsafe_pmd_0069';

// Point Drizzle at the per-file clone, isolated to a throwaway schema. createDatabase
// installs a pool `connect` hook that runs `SET search_path TO "<schema>", public` on
// every connection, so unqualified CREATE/ALTER/INSERT below resolve to the sub-schema
// and never touch the clone's already-migrated public.imported_pmd.
const baseUrl =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test';
const schemaUrl = (() => {
  const u = new URL(baseUrl);
  u.searchParams.set('schema', TEST_SCHEMA);
  return u.toString();
})();
const db = createDatabase({ url: schemaUrl });

// Second handle on the clone's real public schema (default search_path), for the 0103
// reconcile idempotency check — 0103 references public.imported_pmd and operates on the
// public objects migration 0063 already created.
const dbPublic = createDatabase({ url: baseUrl });

const MIGRATION_0069 = join(
  import.meta.dir,
  '../../generated/migrations/0069_kind_triton.sql',
);
const MIGRATION_0103 = join(
  import.meta.dir,
  '../../generated/migrations/0103_fat_miek.sql',
);

/**
 * Split a Drizzle migration file into executable statements: break on Drizzle's
 * `--> statement-breakpoint` markers, drop `--` comment lines, and keep non-empty
 * SQL. Works for both the original single-statement 0069 and the multi-statement
 * safe rewrite.
 */
function migrationStatements(sqlText: string): string[] {
  return sqlText
    .split('--> statement-breakpoint')
    .map((chunk) =>
      chunk
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((s) => s.length > 0);
}

async function applyMigration0069(): Promise<void> {
  const statements = migrationStatements(readFileSync(MIGRATION_0069, 'utf8'));
  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

beforeEach(async () => {
  // Fresh throwaway schema each test, holding the pre-0069 imported_pmd shape
  // (exactly the 0006 CREATE TABLE — no migration between 0006 and 0069 touched
  // imported_pmd; 0063 added a *separate* events table) with a row already present.
  await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`));
  await db.execute(sql.raw(`CREATE SCHEMA "${TEST_SCHEMA}"`));
  await db.execute(
    sql.raw(`
      CREATE TABLE "imported_pmd" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "version" integer DEFAULT 1 NOT NULL,
        "created_by" uuid,
        "updated_by" uuid,
        "patient_id" uuid NOT NULL,
        "source_facility" text NOT NULL,
        "source_reference" text,
        "content" text NOT NULL,
        "imported_at" timestamp DEFAULT now() NOT NULL,
        "safety_floor_merged" text DEFAULT 'false' NOT NULL
      )
    `),
  );
  await db.execute(
    sql.raw(`
      INSERT INTO "imported_pmd" ("patient_id", "source_facility", "content")
      VALUES (gen_random_uuid(), 'Legacy Facility', '{"legacy":true}')
    `),
  );
});

afterAll(async () => {
  await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`));
  await closeDatabaseConnection(db);
  await closeDatabaseConnection(dbPublic);
});

describe('migration 0069 — imported_pmd.source_description is populated-DB safe', () => {
  test('applies cleanly to a populated imported_pmd (no boot-blocking failure)', async () => {
    // RED on the original single-statement `ADD COLUMN ... NOT NULL` (throws because
    // the pre-existing row has no value). GREEN on the safe add->backfill->SET NOT NULL.
    await applyMigration0069();

    const res = await db.execute(sql`SELECT source_description FROM imported_pmd`);
    const rows = (res as unknown as { rows: Array<{ source_description: string | null }> }).rows;
    expect(rows.length).toBe(1);
    // The pre-existing row must have been backfilled (not left NULL, not dropped).
    expect(rows[0]?.source_description).toBeTruthy();
  });

  test('still enforces the NOT NULL invariant after upgrade', async () => {
    await applyMigration0069();

    // End state must be unchanged from the original intent: source_description NOT NULL.
    let raised = false;
    try {
      await db.execute(
        sql.raw(`
          INSERT INTO "imported_pmd" ("patient_id", "source_facility", "content", "source_description")
          VALUES (gen_random_uuid(), 'X', 'Y', NULL)
        `),
      );
    } catch {
      raised = true;
    }
    expect(raised).toBe(true);
  });
});

describe('migration 0103 — imported_pmd_safety_floor_events reconcile is idempotent', () => {
  test('re-applying the reconcile against the existing 0063 table is a clean no-op', async () => {
    // The clone's public schema already holds the table/FK/index from migration 0063.
    // Applying the reconcile twice must not error (CREATE TABLE IF NOT EXISTS, FK DO-guard,
    // CREATE UNIQUE INDEX IF NOT EXISTS) and must leave exactly one FK + one unique index.
    const statements = migrationStatements(readFileSync(MIGRATION_0103, 'utf8'));
    for (const statement of statements) await dbPublic.execute(sql.raw(statement));
    for (const statement of statements) await dbPublic.execute(sql.raw(statement));

    const idx = await dbPublic.execute(
      sql`SELECT indexname FROM pg_indexes WHERE indexname = 'imported_pmd_safety_floor_events_pmd_uniq'`,
    );
    expect((idx as unknown as { rows: unknown[] }).rows.length).toBe(1);

    const fk = await dbPublic.execute(
      sql`SELECT 1 FROM pg_constraint WHERE conname = 'imported_pmd_safety_floor_events_imported_pmd_id_fk'`,
    );
    expect((fk as unknown as { rows: unknown[] }).rows.length).toBe(1);
  });
});
