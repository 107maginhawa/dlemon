/**
 * deactivateMember handler tests
 *
 * Path: DELETE /dental/org/members/:memberId
 * Tests: 401 unauthenticated, 404 not found, 204 success.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp as buildHarnessApp } from '@/tests/helpers/test-app';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

// Migrated off the bespoke raw-handler mount to the shared validator-mounting
// harness (Track 4): DELETE /dental/org/members/:memberId now runs through the
// real generated route table (authMiddleware → param zValidator → handler),
// the same chain production runs.

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID    = 'a2000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b2000000-0000-1000-8000-000000000001';
const PERSON_ID = 'c2000000-0000-1000-8000-000000000001';
const NONEXISTENT_ID = 'd2000000-0000-1000-8000-000000000099';

const authedUser = { id: PERSON_ID, email: 'owner@clinic.com' };

function buildTestApp(user?: typeof authedUser) {
  return buildHarnessApp({ db, user: user ?? null });
}

async function seedAll() {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({
    id: ORG_ID,
    name: 'Test Clinic',
    tier: 'solo',
    ownerPersonId: PERSON_ID,
    countryCode: 'PH',
    active: true,
  });
  const branchRepo = new BranchRepository(db);
  await branchRepo.createOne({
    id: BRANCH_ID,
    organizationId: ORG_ID,
    name: 'Main Branch',
    timezone: 'Asia/Manila',
    active: true,
  });
  const membershipRepo = new MembershipRepository(db);
  // Seed membership for authedUser so assertBranchAccess passes
  await membershipRepo.createOne({
    branchId: BRANCH_ID,
    personId: PERSON_ID,
    displayName: 'Owner',
    role: 'dentist_owner',
    status: 'active',
    pinFailedAttempts: 0,
  });
  return membershipRepo;
}

describe('deactivateMember handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_audit_log, dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Not found
  // --------------------------------------------------------------------------

  test('returns 404 when member does not exist', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // EF-ORG-013: Non-owner deactivation must be rejected
  // --------------------------------------------------------------------------

  test('returns 403 when caller is not dentist_owner (staff_full role)', async () => {
    const membershipRepo = await seedAll();
    // Create target member
    const target = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Target Member',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    // Downgrade caller to staff_full
    await db.execute(sql`UPDATE dental_membership SET role = 'staff_full' WHERE person_id = ${PERSON_ID}`);

    const app = buildTestApp(authedUser);
    const res = await app.request(`/dental/org/members/${target.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(403);
  });

  test('returns 403 when caller has no membership in the branch', async () => {
    const membershipRepo = await seedAll();
    const target = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Target Member',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });

    // Use a user with no membership at all
    const strangerUser = { id: 'd2000000-0000-1000-8000-000000000010', email: 'stranger@clinic.com' };
    const app = buildTestApp(strangerUser);
    const res = await app.request(`/dental/org/members/${target.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // Success
  // --------------------------------------------------------------------------

  test('returns 204 and deactivates the member', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Bob',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);

    // Verify member is now inactive
    const updated = await membershipRepo.findOneById(member.id);
    expect(updated?.status).toBe('inactive');
  });

  // --------------------------------------------------------------------------
  // AL-004: HIPAA audit trail
  // --------------------------------------------------------------------------

  // EM-AUD-008: audit row must land in dental_audit_log (viewer source of truth).
  test('AL-004: revokeMembership persists audit record to dental_audit_log', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Eve',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);

    // Verify audit record persisted to the viewer table (not just logger.info)
    const rows = await db
      .select()
      .from(dentalAuditLog)
      .where(eq(dentalAuditLog.targetId, member.id));

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0]!;
    expect(row.action).toBe('membership.deactivate');
    expect(row.targetType).toBe('dental_membership');
    expect(row.actorId).toBe(PERSON_ID);
    expect(row.branchId).toBe(BRANCH_ID);
  });
});
