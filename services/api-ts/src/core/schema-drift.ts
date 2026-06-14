/**
 * schema-drift — pure diagnostics for the code↔DB drift class (no I/O).
 *
 * Background: after RLS activation, the live app "couldn't add a New Visit" while
 * CI was green. Root cause was a DB behind on migrations — handlers do
 * `SET LOCAL ROLE app_rls`, and against a DB missing migration 0104's GRANTs every
 * withTenantTx write dies with `permission denied for table …`. Plan D makes that
 * drift visible at runtime (`/readyz`) and loud at the point of failure
 * (`withTenantTx`), and gates the self-heal path in CI.
 *
 * This module holds the PURE rules so they are unit-testable without a live DB:
 *   - `evaluateSchemaDrift` turns migration/grant counts into a readiness verdict.
 *   - `describeRlsPermissionError` rewrites a cryptic "permission denied for table"
 *     into a "your DB is behind on migrations" hint — but ONLY for the grant-drift
 *     case, never for a legitimate RLS-policy tenant-isolation block.
 *
 * The I/O (querying the counts, wiring into `/readyz`) lives in `health.ts`; the
 * error wrap lives in `tenant-tx.ts`. Both reuse these rules.
 */

export interface SchemaDriftFacts {
  /** Rows in `drizzle.__drizzle_migrations` (migrations actually applied). */
  migrationsApplied: number;
  /** Entries in the drizzle `_journal.json` (migration files the code ships). */
  migrationFilesOnDisk: number;
  /** Distinct tables `app_rls` holds grants on (0 ⇒ the grant migration never ran). */
  appRlsGrantTables: number;
}

export type SchemaDriftStatus = 'current' | 'behind' | 'ahead' | 'rls-ungranted';

export interface SchemaDriftResult extends SchemaDriftFacts {
  status: SchemaDriftStatus;
  /** True iff the DB can serve RLS writes: migrated up-to (or past) the code AND granted. */
  healthy: boolean;
  /** One human-readable line naming the drift and its consequence. */
  detail: string;
}

const MIGRATE_FIX = 'run migrations (cd services/api-ts && bunx drizzle-kit migrate)';

/** Classify migration/grant counts into a readiness verdict. */
export function evaluateSchemaDrift(facts: SchemaDriftFacts): SchemaDriftResult {
  const { migrationsApplied: applied, migrationFilesOnDisk: onDisk, appRlsGrantTables: grants } = facts;

  // Behind is the actionable root — it implies (and outranks) missing grants.
  if (applied < onDisk) {
    return {
      ...facts,
      status: 'behind',
      healthy: false,
      detail:
        `DB is BEHIND: ${applied}/${onDisk} migrations applied (${onDisk - applied} not yet run). ` +
        `RLS writes will fail with "permission denied" until you ${MIGRATE_FIX}.`,
    };
  }

  if (grants <= 0) {
    return {
      ...facts,
      status: 'rls-ungranted',
      healthy: false,
      detail:
        'app_rls holds NO table grants — the RLS grant migration has not run; ' +
        `every withTenantTx write will fail with "permission denied". ${MIGRATE_FIX}.`,
    };
  }

  if (applied > onDisk) {
    return {
      ...facts,
      status: 'ahead',
      healthy: true,
      detail:
        `DB is AHEAD: ${applied} applied / ${onDisk} on disk — the API is older than the ` +
        'database (it can still serve; check you are on the intended code).',
    };
  }

  return {
    ...facts,
    status: 'current',
    healthy: true,
    detail: `schema current: ${applied}/${onDisk} migrations applied, app_rls grants on ${grants} tables.`,
  };
}

/**
 * If `err` is a missing-grant "permission denied for …" (the behind-DB drift),
 * return a clear hint that the DB is likely behind on migrations. Otherwise return
 * null — including for a legitimate RLS-policy write violation, which is ALSO
 * SQLSTATE 42501 but carries "new row violates row-level security policy", a real
 * tenant-isolation block that must surface unchanged.
 */
export function describeRlsPermissionError(err: unknown): string | null {
  const e = err as { message?: unknown; cause?: { message?: unknown } } | null | undefined;
  // The pg error may arrive directly or wrapped by drizzle (on `.cause`); check both.
  const candidates = [e?.message, e?.cause?.message].filter(
    (m): m is string => typeof m === 'string',
  );
  // "permission denied for table/relation/sequence/schema …" is the GRANT-drift
  // signature. The RLS-policy violation message does not contain this phrase.
  const match = candidates.find((m) => /permission denied for /i.test(m));
  if (match) {
    return (
      'RLS denied: app_rls lacks the required table grants — the database is likely ' +
      `BEHIND on migrations. ${MIGRATE_FIX}. Original error: ${match}`
    );
  }
  return null;
}
