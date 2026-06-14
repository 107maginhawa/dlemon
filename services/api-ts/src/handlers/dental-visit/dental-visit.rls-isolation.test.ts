/**
 * RLS Stage-0 validation — dental_visit (ADR-010 pre-GA gate, phase 0).
 *
 * Proves the Row-Level-Security MECHANISM end-to-end on one Tier-1 table before
 * the policy set is scaled out. Without this, naive RLS tests false-green: the
 * test harness connects as the postgres superuser, which BYPASSES RLS — so the
 * isolation only means anything when the query runs under the app_rls role (via
 * withTenantTx). This file asserts:
 *
 *   1. Baseline / zero-runtime-change: a plain (postgres) query still sees ALL
 *      branches' visits — enabling RLS did not change the superuser path.
 *   2. Isolation: withTenantTx([A]) sees only branch A; [B] sees only branch B.
 *   3. Set-valued context (ADR-010 D1): withTenantTx([A, B]) sees BOTH — the
 *      multi-branch read the EM-BIL-002 reports depend on.
 *   4. Fail-closed: an empty branch set, and an unset GUC, each see ZERO rows.
 *   5. WITH CHECK: a write that would place a row in an out-of-scope branch is
 *      rejected.
 *
 * Runs against its own cloned DB (scripts/test-with-db.ts), which carries
 * migration 0104 (app_rls + app_current_branches() + the dental_visit policy).
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { withTenantTx } from '@/core/tenant-tx';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from './repos/visit.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// File-unique UUIDs (own clone, but distinct to avoid any cross-suite confusion).
const OWNER_A = 'd0000000-0000-4000-8000-0000000000a1';
const OWNER_B = 'd0000000-0000-4000-8000-0000000000b1';

const ORG_A = 'd1000000-0000-4000-8000-0000000000a0';
const ORG_B = 'd1000000-0000-4000-8000-0000000000b0';
const BRANCH_A = 'd2000000-0000-4000-8000-0000000000a0';
const BRANCH_B = 'd2000000-0000-4000-8000-0000000000b0';
const MEMBER_A = 'd3000000-0000-4000-8000-0000000000a1';
const MEMBER_B = 'd3000000-0000-4000-8000-0000000000b1';
const PERSON_PA = 'd5000000-0000-4000-8000-0000000000a0';
const PERSON_PB = 'd5000000-0000-4000-8000-0000000000b0';
const PATIENT_A = 'd4000000-0000-4000-8000-0000000000a0';
const PATIENT_B = 'd4000000-0000-4000-8000-0000000000b0';
const VISIT_A = 'd6000000-0000-4000-8000-0000000000a0';
const VISIT_B = 'd6000000-0000-4000-8000-0000000000b0';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: 'RLS Clinic A', tier: 'solo', ownerPersonId: OWNER_A, countryCode: 'PH', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: ORG_B, name: 'RLS Clinic B', tier: 'solo', ownerPersonId: OWNER_B, countryCode: 'PH', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'A Main', timezone: 'Asia/Manila', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: BRANCH_B, organizationId: ORG_B, name: 'B Main', timezone: 'Asia/Manila', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: MEMBER_A, branchId: BRANCH_A, personId: OWNER_A, displayName: 'Owner A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: MEMBER_B, branchId: BRANCH_B, personId: OWNER_B, displayName: 'Owner B', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  await db.insert(persons).values([
    { id: PERSON_PA, firstName: 'Pat', lastName: 'A', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: PERSON_PB, firstName: 'Pat', lastName: 'B', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: PATIENT_A, person: PERSON_PA, preferredBranchId: BRANCH_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: PATIENT_B, person: PERSON_PB, preferredBranchId: BRANCH_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  // Seed one visit per branch AS POSTGRES (superuser bypasses RLS, so the writes
  // are unaffected — exactly the production write path today).
  await db.insert(dentalVisits).values([
    { id: VISIT_A, patientId: PATIENT_A, branchId: BRANCH_A, dentistMemberId: MEMBER_A, status: 'draft', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: VISIT_B, patientId: PATIENT_B, branchId: BRANCH_B, dentistMemberId: MEMBER_B, status: 'draft', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
});

const idsOf = (rows: { id: string }[]) => rows.map((r) => r.id);

describe('dental_visit RLS — Stage-0 mechanism validation', () => {
  test('baseline: a plain (postgres superuser) query still sees ALL branches — RLS did not change the bypass path', async () => {
    const rows = await db.select().from(dentalVisits);
    const ids = idsOf(rows);
    expect(ids).toContain(VISIT_A);
    expect(ids).toContain(VISIT_B);
  });

  test('isolation: withTenantTx([A]) sees only branch A', async () => {
    const rows = await withTenantTx(db, { branchIds: [BRANCH_A] }, (tx) => tx.select().from(dentalVisits));
    const ids = idsOf(rows);
    expect(ids).toContain(VISIT_A);
    expect(ids).not.toContain(VISIT_B);
    expect(rows.every((r) => r.branchId === BRANCH_A)).toBe(true);
  });

  test('isolation: withTenantTx([B]) sees only branch B (symmetric)', async () => {
    const rows = await withTenantTx(db, { branchIds: [BRANCH_B] }, (tx) => tx.select().from(dentalVisits));
    const ids = idsOf(rows);
    expect(ids).toContain(VISIT_B);
    expect(ids).not.toContain(VISIT_A);
  });

  test('set-valued context (D1): withTenantTx([A, B]) sees BOTH branches', async () => {
    const rows = await withTenantTx(db, { branchIds: [BRANCH_A, BRANCH_B] }, (tx) => tx.select().from(dentalVisits));
    const ids = idsOf(rows);
    expect(ids).toContain(VISIT_A);
    expect(ids).toContain(VISIT_B);
  });

  test('fail-closed: an EMPTY branch set sees ZERO rows', async () => {
    const rows = await withTenantTx(db, { branchIds: [] }, (tx) => tx.select().from(dentalVisits));
    expect(rows.length).toBe(0);
  });

  test('fail-closed: app_rls with the GUC UNSET (never published) sees ZERO rows', async () => {
    // Bypass withTenantTx to exercise the truly-unset path: SET ROLE but no set_config.
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE app_rls`);
      return tx.select().from(dentalVisits);
    });
    expect(rows.length).toBe(0);
  });

  test('WITH CHECK: a write into an out-of-scope branch is rejected', async () => {
    await expect(
      withTenantTx(db, { branchIds: [BRANCH_A] }, async (tx) => {
        await tx.insert(dentalVisits).values({
          id: crypto.randomUUID(),
          patientId: PATIENT_B,
          branchId: BRANCH_B, // not in the [A] scope → policy WITH CHECK must reject
          dentistMemberId: MEMBER_B,
          status: 'draft',
          createdBy: OWNER_B,
          updatedBy: OWNER_B,
        });
      }),
    ).rejects.toThrow();
  });
});
