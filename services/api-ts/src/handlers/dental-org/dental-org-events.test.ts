/**
 * dental-org domain-event audit-trace tests
 *
 * Per ADR-006, dental-org domain events are AUDIT-LOG-ONLY semantic markers — there is
 * no event bus. A "publish" is satisfied by the producer writing a synchronous
 * dental_audit_log row via logAuditEvent. A publisher test therefore:
 *   1. triggers the producing HTTP action (via app.request through the real handler), then
 *   2. asserts a dental_audit_log row exists with the expected action / targetType /
 *      targetId / actorId.
 *
 * Events covered (previously untraced — TRACE_REPORT TR-P1-04):
 *   DE-022 MembershipAssigned → action 'membership.create' / target dental_membership
 *
 * Note: membership-audit-regression.test.ts already locks the ROUTED
 * DentalMembershipManagement_create audit write. This suite adds the explicit DE-022
 * event-ID-keyed publisher trace against the canonical createMember handler so the
 * event-layer trace grep (keyed on exact DE-0xx IDs in *-events.test.ts) resolves an owner.
 *
 * Consumer / idempotency tests are out of scope (no bus, per ADR-006).
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, and, eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique IDs (tag oev) to avoid cross-suite membership collisions.
const ORG_ID    = 'a90e0000-0000-1000-8000-0000000be001';
const BRANCH_ID = 'b90e0000-0000-1000-8000-0000000be001';
const PERSON_ID = 'c90e0000-0000-1000-8000-0000000be001';

const owner = { id: PERSON_ID, email: 'owner-oev@clinic.com' };

async function seedOrgAndBranch() {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({ id: ORG_ID, name: 'Org-Events Clinic', tier: 'clinic', ownerPersonId: PERSON_ID, countryCode: 'PH', active: true });
  const branchRepo = new BranchRepository(db);
  await branchRepo.createOne({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', active: true });
  const membershipRepo = new MembershipRepository(db);
  await membershipRepo.createOne({ branchId: BRANCH_ID, personId: PERSON_ID, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0 });
}

async function auditRows(action: string, targetId: string) {
  return db.select().from(dentalAuditLog)
    .where(and(eq(dentalAuditLog.action, action), eq(dentalAuditLog.targetId, targetId)));
}

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_audit_log, dental_membership, dental_branch, dental_organization CASCADE`);
});

// ---------------------------------------------------------------------------
// DE-022 MembershipAssigned
// ---------------------------------------------------------------------------

describe('DE-022 MembershipAssigned — audit-row marker on member create', () => {
  test('writes a dental_audit_log row (membership.create) referencing the new membership', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp({ db, user: owner });

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Staff', role: 'staff_full' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toBeTruthy();

    const rows = await auditRows('membership.create', body.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('dental_membership');
    expect(rows[0]?.actorId).toBe(PERSON_ID);
    expect(rows[0]?.branchId).toBe(BRANCH_ID);
  });

  test('does NOT write a membership.create row when create is forbidden (non-owner)', async () => {
    await seedOrgAndBranch();
    // A staff_full member (not owner) attempts to add a member → EF-ORG-003 403.
    const membershipRepo = new MembershipRepository(db);
    const STAFF_PERSON = 'c90e0000-0000-1000-8000-0000000be002';
    await membershipRepo.createOne({ branchId: BRANCH_ID, personId: STAFF_PERSON, displayName: 'Staff', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });

    const app = buildTestApp({ db, user: { id: STAFF_PERSON, email: 'staff-oev@clinic.com' } });
    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Should Not Exist', role: 'staff_full' }),
    });
    expect(res.status).toBe(403);

    const rows = await db.select().from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'membership.create'), eq(dentalAuditLog.branchId, BRANCH_ID)));
    expect(rows).toHaveLength(0);
  });
});
