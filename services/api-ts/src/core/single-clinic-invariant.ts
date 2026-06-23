/**
 * Single-clinic invariant — the load-bearing tenant-isolation trip-wire while RLS
 * is posture-only (ADR-010).
 *
 * RLS policies are armed (ENABLE+FORCE) but not every handler routes through
 * `withTenantTx`, so un-routed handlers still read the pooled superuser connection
 * that bypasses RLS. The product is safe ONLY while exactly one
 * `dental_organization` exists — a single clinic cannot leak across a tenant
 * boundary that does not exist yet. A SECOND organization before RLS is fully
 * activated turns every un-routed handler into a cross-tenant PHI leak.
 *
 * This module is the single source of truth for the invariant. It is consumed by:
 *   - scripts/check-single-clinic-invariant.ts — the DEPLOY/release hard gate
 *     (queries a target DB, exits 1 on violation).
 *   - src/app.ts initializeApp — a PRODUCTION-SCOPED boot advisory that LOGS
 *     CRITICAL on violation but never hard-fails boot (dev/test seed many orgs by
 *     design, so an unconditional boot fail would brick them).
 */

import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';

/**
 * Whether RLS is the load-bearing tenant-isolation control (every handler routed
 * through withTenantTx), NOT just armed posture. Currently false (ADR-010 P3b
 * deferred). Flip to true only when activation is complete + cross-tenant tests
 * cover every module — a deliberate, reviewed event.
 */
export const RLS_FULLY_ACTIVATED = false;

/**
 * The single-clinic invariant: while RLS is not fully activated, more than one
 * organization is a cross-tenant exposure. Pure — unit-tested separately.
 */
export function violatesSingleClinicInvariant(orgCount: number, rlsFullyActivated: boolean): boolean {
  return !rlsFullyActivated && orgCount > 1;
}

/**
 * Production-scoped boot advisory. Queries the live org count and logs CRITICAL
 * when the invariant is violated, so a misconfigured prod deployment screams in
 * the logs. NEVER throws and NEVER exits — dev/test DBs seed many orgs by design
 * (the caveat in plan 015 S1), so this can only ADVISE, not brick boot. The hard
 * gate lives in the deploy pipeline (scripts/check-single-clinic-invariant.ts).
 *
 * Returns `true` when a violation was logged, `false` otherwise (including when
 * skipped because not in production, or when the count query failed) — for tests.
 */
export async function checkSingleClinicInvariantAdvisory(opts: {
  database: DatabaseInstance;
  logger: Logger;
  isProduction: boolean;
}): Promise<boolean> {
  const { database, logger, isProduction } = opts;
  // Advisory is production-only: dev/test seed many orgs by design.
  if (!isProduction) return false;

  let orgCount: number;
  try {
    const res = await database.execute('SELECT count(*)::int AS n FROM dental_organization');
    const rows = (res as { rows?: Array<{ n?: number }> }).rows ?? [];
    orgCount = Number(rows[0]?.n ?? 0);
  } catch (error) {
    // Never let an advisory query break boot (e.g. table not yet migrated).
    logger.warn({ error }, 'single-clinic invariant advisory: org-count query failed; skipping');
    return false;
  }

  if (violatesSingleClinicInvariant(orgCount, RLS_FULLY_ACTIVATED)) {
    logger.fatal(
      { orgCount, rlsFullyActivated: RLS_FULLY_ACTIVATED },
      `CRITICAL: single-clinic invariant VIOLATED — ${orgCount} dental_organization rows while ` +
        'RLS is not fully activated (ADR-010). Un-routed handlers bypass RLS via the pooled ' +
        'connection → a second tenant is a cross-tenant PHI leak. Do NOT serve traffic until ' +
        'ADR-010 P3b RLS activation lands (then flip RLS_FULLY_ACTIVATED).',
    );
    return true;
  }
  return false;
}
