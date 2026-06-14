#!/usr/bin/env bun
/**
 * dev-doctor — assert the local dev stack is mutually consistent before you trust it.
 *
 * Catches the exact trap that made the live app "unable to add a New Visit" while CI
 * was green: ENVIRONMENT DRIFT. A stale API process (the old `dev` script had no
 * `--watch`) and a dev DB behind on migrations meant RLS writes died with
 * "permission denied" — three mismatched versions masquerading as a code bug. See
 * `src/core/dev-doctor.ts` for the full background and the (pure, unit-tested)
 * diagnosis rules; this file only GATHERS the facts and prints the verdict.
 *
 * Checks: DB reachable → migrations applied == migration files on disk → app_rls has
 * table grants (RLS armed) → API up+ready on :7213 → FE up on :3003. Drift = loud,
 * specific warning + the ONE fix command. Exit 0 = consistent, 1 = drifted.
 *
 * Usage:
 *   bun run dev:doctor
 *   DATABASE_URL=… DEV_DOCTOR_API_URL=… DEV_DOCTOR_FE_URL=… bun scripts/dev-doctor.ts
 */

import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { diagnose, formatReport, type DoctorFacts } from '../src/core/dev-doctor';

const DB_URL = process.env['DATABASE_URL'] || 'postgres://postgres:password@localhost:5432/monobase';
const API_URL = process.env['DEV_DOCTOR_API_URL'] || 'http://localhost:7213';
const FE_URL = process.env['DEV_DOCTOR_FE_URL'] || 'http://localhost:3003';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOURNAL_PATH = path.join(__dirname, '../src/generated/migrations/meta/_journal.json');

/** Count migration files on disk from the drizzle journal (source of truth for "code"). */
function migrationFilesOnDisk(): number {
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8')) as { entries?: unknown[] };
  return Array.isArray(journal.entries) ? journal.entries.length : 0;
}

/** Query DB facts; on any connection failure, report dbReachable=false. */
async function gatherDbFacts(): Promise<{
  dbReachable: boolean;
  migrationsApplied: number | null;
  appRlsGrantTables: number | null;
}> {
  const client = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 2500 });
  try {
    await client.connect();
  } catch {
    return { dbReachable: false, migrationsApplied: null, appRlsGrantTables: null };
  }
  try {
    const applied = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations',
    );
    const grants = await client.query<{ count: string }>(
      `SELECT count(DISTINCT table_name)::text AS count
         FROM information_schema.role_table_grants
        WHERE grantee = 'app_rls'`,
    );
    return {
      dbReachable: true,
      migrationsApplied: Number(applied.rows[0]?.count ?? 0),
      appRlsGrantTables: Number(grants.rows[0]?.count ?? 0),
    };
  } catch {
    // Connected but the drizzle/grants catalog query failed — treat as unreachable
    // for diagnosis purposes (the DB is not in a usable, migrated state).
    return { dbReachable: false, migrationsApplied: null, appRlsGrantTables: null };
  } finally {
    await client.end().catch(() => {});
  }
}

/** GET a URL, return true on a 2xx/3xx response within the timeout. */
async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return res.status < 400;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const [db, apiLivez, apiReadyz, feUp] = await Promise.all([
    gatherDbFacts(),
    reachable(`${API_URL}/livez`),
    reachable(`${API_URL}/readyz`),
    reachable(FE_URL),
  ]);

  const facts: DoctorFacts = {
    dbReachable: db.dbReachable,
    migrationsApplied: db.migrationsApplied,
    migrationFilesOnDisk: migrationFilesOnDisk(),
    appRlsGrantTables: db.appRlsGrantTables,
    apiLivez,
    apiReadyz,
    feUp,
  };

  const report = diagnose(facts);
  console.info(formatReport(report));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('dev-doctor: unexpected error', err);
  process.exit(2);
});
