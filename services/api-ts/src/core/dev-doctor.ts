/**
 * dev-doctor — pure diagnosis of local-dev-stack consistency.
 *
 * Background (the drift this exists to catch): after RLS activation, the live app
 * "couldn't add a New Visit" while CI was green. Root cause was ENVIRONMENT DRIFT,
 * not code — an 8-day-stale API process (the `dev` script ran `bun src/index.ts`
 * with no `--watch`) plus a dev DB four migrations behind. RLS made code-ahead-of-DB
 * FATAL: handlers do `SET LOCAL ROLE app_rls`, and against a DB missing migration
 * 0104's GRANTs every write dies with `permission denied`. Three mismatched
 * versions (stale API ↔ behind DB ↔ current FE) masquerading as a code bug.
 *
 * This module holds the DIAGNOSIS rules only — no I/O. The orchestrator at
 * `scripts/dev-doctor.ts` gathers the facts (queries the DB, pings the API + FE)
 * and feeds them here. Keeping the rules pure makes them unit-testable
 * (`dev-doctor.test.ts`) without a live stack.
 *
 * Honest limit: this proves the stack is *mutually consistent* (DB migrated to the
 * code on disk, app_rls granted, API + FE up). It does NOT prove the running API
 * process is byte-identical to disk — but the migration-drift + app_rls checks ARE
 * the staleness signal for the RLS-fatal class, because the API migrates on boot:
 * a behind DB means the running API booted before the latest migrations existed.
 */

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  /** Stable identifier (also used by tests). */
  name: string;
  status: CheckStatus;
  /** Human-readable, one line; names the gap and its consequence. */
  detail: string;
  /** The single command that resolves this check, when it isn't passing. */
  fix?: string;
}

export interface DoctorReport {
  checks: CheckResult[];
  /** True iff no check is a hard `fail`. Warns do not fail the doctor. */
  ok: boolean;
}

/**
 * Facts gathered from the live dev stack by the orchestrator. `null` means "could
 * not be determined" (e.g. DB unreachable, so migration/grant counts are unknown).
 */
export interface DoctorFacts {
  dbReachable: boolean;
  /** Rows in `drizzle.__drizzle_migrations`. `null` when DB unreachable. */
  migrationsApplied: number | null;
  /** Entries in the drizzle `_journal.json` (migration files on disk). */
  migrationFilesOnDisk: number;
  /** Distinct tables app_rls holds grants on. `null` when DB unreachable. */
  appRlsGrantTables: number | null;
  /** GET :7213/livez returned 200. */
  apiLivez: boolean;
  /** GET :7213/readyz returned 200. */
  apiReadyz: boolean;
  /** GET :3003 (the dentalemon app) returned 2xx/3xx. */
  feUp: boolean;
}

const MIGRATE_FIX = 'cd services/api-ts && bunx drizzle-kit migrate';
const API_FIX = 'cd services/api-ts && bun dev';
const FE_FIX = 'cd apps/dentalemon && bun dev';
const DB_FIX = 'start Postgres (bun run infra:up) and check DATABASE_URL';

/** Classify the gathered facts into an ordered list of checks + an overall verdict. */
export function diagnose(facts: DoctorFacts): DoctorReport {
  const checks: CheckResult[] = [];

  // 1. Can we even reach the database?
  checks.push(
    facts.dbReachable
      ? { name: 'database', status: 'pass', detail: 'Postgres reachable' }
      : {
          name: 'database',
          status: 'fail',
          detail: 'Postgres unreachable — cannot verify migrations or RLS grants',
          fix: DB_FIX,
        },
  );

  // 2. Migration drift — the headline check. A behind DB makes RLS writes fatal.
  if (!facts.dbReachable || facts.migrationsApplied === null) {
    checks.push({
      name: 'migrations',
      status: 'warn',
      detail: 'skipped — database unreachable',
    });
  } else {
    const applied = facts.migrationsApplied;
    const onDisk = facts.migrationFilesOnDisk;
    if (applied === onDisk) {
      checks.push({
        name: 'migrations',
        status: 'pass',
        detail: `${applied}/${onDisk} migrations applied — DB matches the code on disk`,
      });
    } else if (applied < onDisk) {
      checks.push({
        name: 'migrations',
        status: 'fail',
        detail:
          `DB is BEHIND: ${applied}/${onDisk} migrations applied (${onDisk - applied} not yet run). ` +
          `RLS writes will fail with "permission denied" until you migrate.`,
        fix: MIGRATE_FIX,
      });
    } else {
      checks.push({
        name: 'migrations',
        status: 'warn',
        detail:
          `DB is AHEAD of code: ${applied} applied / ${onDisk} on disk — ` +
          `you may be on older code than the database (check your branch).`,
      });
    }
  }

  // 3. app_rls grants — a DB missing migration 0104's GRANTs has zero, and every
  //    `SET LOCAL ROLE app_rls` write 500s with permission denied.
  if (!facts.dbReachable || facts.appRlsGrantTables === null) {
    checks.push({
      name: 'app_rls-grants',
      status: 'warn',
      detail: 'skipped — database unreachable',
    });
  } else if (facts.appRlsGrantTables > 0) {
    checks.push({
      name: 'app_rls-grants',
      status: 'pass',
      detail: `app_rls holds grants on ${facts.appRlsGrantTables} tables`,
    });
  } else {
    checks.push({
      name: 'app_rls-grants',
      status: 'fail',
      detail:
        'app_rls has NO table grants — DB is missing the RLS grant migration (0104). ' +
        'Every withTenantTx write will fail with "permission denied".',
      fix: MIGRATE_FIX,
    });
  }

  // 4. API reachable on the current code (up + ready). Down → hard fail; up but
  //    not ready (DB/storage/jobs) → warn.
  if (!facts.apiLivez) {
    checks.push({
      name: 'api',
      status: 'fail',
      detail: 'API not reachable on :7213 (/livez)',
      fix: API_FIX,
    });
  } else if (!facts.apiReadyz) {
    checks.push({
      name: 'api',
      status: 'warn',
      detail: 'API up on :7213 but /readyz is failing (database, storage, or jobs unhealthy)',
      fix: API_FIX,
    });
  } else {
    checks.push({ name: 'api', status: 'pass', detail: 'API up and ready on :7213' });
  }

  // 5. Frontend — only needed for UI work, so a warn (never fails the doctor).
  checks.push(
    facts.feUp
      ? { name: 'frontend', status: 'pass', detail: 'dentalemon app up on :3003' }
      : {
          name: 'frontend',
          status: 'warn',
          detail: 'dentalemon app not reachable on :3003 (only needed for UI work)',
          fix: FE_FIX,
        },
  );

  return { checks, ok: checks.every((c) => c.status !== 'fail') };
}

const ICON: Record<CheckStatus, string> = { pass: '✅', warn: '⚠️ ', fail: '❌' };

/** Render a report for the terminal: one line per check, then a loud fix block. */
export function formatReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push('dev-doctor — local stack consistency');
  lines.push('─'.repeat(44));
  for (const c of report.checks) {
    lines.push(`${ICON[c.status]} ${c.name.padEnd(16)} ${c.detail}`);
  }
  lines.push('─'.repeat(44));

  // Collect the distinct fixes from anything not passing, fails first.
  const order: CheckStatus[] = ['fail', 'warn'];
  const fixes: string[] = [];
  for (const status of order) {
    for (const c of report.checks) {
      if (c.status === status && c.fix && !fixes.includes(c.fix)) fixes.push(c.fix);
    }
  }

  if (report.ok && fixes.length === 0) {
    lines.push('✅ Stack is consistent — code, DB, API, and FE all agree.');
  } else if (!report.ok) {
    lines.push('❌ Your dev stack is DRIFTED. A green CI will NOT match this box.');
    lines.push('   Run the fix(es) below, then re-run `bun run dev:doctor`:');
    for (const f of fixes) lines.push(`   👉 ${f}`);
  } else {
    lines.push('⚠️  Stack is usable but has warnings:');
    for (const f of fixes) lines.push(`   👉 ${f}`);
  }

  return lines.join('\n');
}
