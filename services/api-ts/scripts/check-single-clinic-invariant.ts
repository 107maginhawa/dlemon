/**
 * Single-clinic invariant trip-wire (plan 014 S5) — a hard RELEASE gate.
 *
 * RLS is posture-only today (ADR-010): the policies are armed (ENABLE+FORCE) but
 * NOT every handler is routed through `withTenantTx`, so un-routed handlers still
 * read the pooled superuser connection that bypasses RLS. While that is true the
 * product is safe ONLY because there is exactly one `dental_organization` — a
 * single clinic cannot leak across a tenant boundary that does not exist yet.
 *
 * The moment a SECOND organization exists before RLS is fully activated, every
 * un-routed handler becomes a cross-tenant PHI leak (the EM-BIL-002 class). This
 * script makes that failure loud: run it against a target database (e.g. prod,
 * pre-launch, before onboarding a second clinic) and it exits non-zero if more
 * than one organization exists while RLS is not yet fully activated.
 *
 * It is intentionally NOT wired into the unit test suite: per-file test DBs seed
 * many orgs by design, so the invariant only makes sense against a real single-
 * tenant deployment. The pure predicate (now in src/core/single-clinic-invariant.ts)
 * is unit-tested in src/core/single-clinic-invariant.test.ts; a production-scoped
 * boot advisory in src/app.ts logs CRITICAL on the same violation at runtime.
 *
 * Usage:
 *   DATABASE_URL=postgres://… bun scripts/check-single-clinic-invariant.ts
 *
 * Enforced as a hard gate in .github/workflows/release.yml (runs against the
 * PRODUCTION_DATABASE_URL secret on tag release; a violation blocks the release).
 *
 * Exit 0 = invariant holds (≤1 org, or RLS fully activated). Exit 1 = violated.
 *
 * Lifting the gate: when ADR-010 P3b lands and EVERY tenant-scoped handler routes
 * through withTenantTx (RLS is the load-bearing control, not just posture), flip
 * RLS_FULLY_ACTIVATED in src/core/single-clinic-invariant.ts to true — the
 * trip-wire then permits multiple orgs.
 */

import { Client } from 'pg';
import {
  RLS_FULLY_ACTIVATED,
  violatesSingleClinicInvariant,
} from '../src/core/single-clinic-invariant';

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('check-single-clinic-invariant: DATABASE_URL is required');
    process.exit(2);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ n: string }>('SELECT count(*)::int AS n FROM dental_organization');
    const orgCount = Number(rows[0]?.n ?? 0);

    if (violatesSingleClinicInvariant(orgCount, RLS_FULLY_ACTIVATED)) {
      console.error(
        `❌ Single-clinic invariant VIOLATED: ${orgCount} dental_organization rows while RLS is not fully activated (ADR-010).`,
      );
      console.error(
        '   Un-routed handlers bypass RLS via the pooled connection → a second tenant is a cross-tenant PHI leak.',
      );
      console.error(
        '   Do NOT onboard a second clinic until ADR-010 P3b RLS activation lands (then flip RLS_FULLY_ACTIVATED).',
      );
      process.exit(1);
    }

    console.info(
      `✅ Single-clinic invariant holds — ${orgCount} organization(s)${RLS_FULLY_ACTIVATED ? ' (RLS fully activated)' : ''}.`,
    );
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('check-single-clinic-invariant: unexpected error', err);
    process.exit(2);
  });
}
