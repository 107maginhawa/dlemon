/**
 * updateMember handler tests
 *
 * Path: PATCH /dental/org/members/:memberId
 * Tests: 401 unauthenticated, 400 no valid fields, 400 invalid role,
 *        404 not found, 200 success with changed fields.
 */

import { describe, test, expect, afterEach, spyOn } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp as buildHarnessApp } from '@/tests/helpers/test-app';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';
import { AuditLogRepository } from '@/handlers/dental-audit/repos/audit-log.repo';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

// Migrated off the bespoke raw-handler mount to the shared validator-mounting
// harness (Track 4): PATCH /dental/org/members/:memberId now runs through the
// real generated route table (authMiddleware → param+json zValidator → handler),
// so the 400 no-valid-fields / invalid-role / bad-NPI cases and the fail-closed
// 5xx audit-sink case exercise the exact validation + error envelope production
// runs.

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID    = 'a5000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b5000000-0000-1000-8000-000000000001';
const PERSON_ID = 'c5000000-0000-1000-8000-000000000001';
const NONEXISTENT_ID = 'd5000000-0000-1000-8000-000000000099';

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
  });
  return membershipRepo;
}

describe('updateMember handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Name' }),
    });

    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Validation errors
  // --------------------------------------------------------------------------

  test('returns 400 when no valid fields are provided', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when role is invalid', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'superadmin' }),
    });

    expect(res.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Not found
  // --------------------------------------------------------------------------

  test('returns 404 when member does not exist', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ghost' }),
    });

    expect(res.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // Success
  // --------------------------------------------------------------------------

  test('returns 200 with updated displayName', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Original Name',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Updated Name' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(member.id);
    expect(body.displayName).toBe('Updated Name');
    expect(body.pinHash).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // P2-17: Provider credentials
  // --------------------------------------------------------------------------

  test('returns 200 and persists provider credentials', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Dr. Provider',
      role: 'dentist_associate',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseNumber: 'LIC-12345',
        npi: '1234567890',
        credentialType: 'DDS',
        licenseExpiry: '2030-12-31T00:00:00Z',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.licenseNumber).toBe('LIC-12345');
    expect(body.npi).toBe('1234567890');
    expect(body.credentialType).toBe('DDS');
    expect(new Date(body.licenseExpiry).getUTCFullYear()).toBe(2030);
  });

  test('returns 400 when NPI is not 10 digits', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Dr. Bad NPI',
      role: 'dentist_associate',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi: '123' }),
    });

    expect(res.status).toBe(400);
  });

  test('allows clearing credentials with null', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Dr. Clearable',
      role: 'dentist_associate',
      status: 'active',
      pinFailedAttempts: 0,
      licenseNumber: 'LIC-OLD',
      npi: '9999999999',
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseNumber: null, npi: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.licenseNumber).toBeNull();
    expect(body.npi).toBeNull();
  });

  test('returns 200 with updated role', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Dave',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'staff_scheduling' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.role).toBe('staff_scheduling');
  });

  // --------------------------------------------------------------------------
  // G7-S3: Role-change privilege escalation guard (adversarial)
  //   assertBranchAccess alone would let any active member change roles —
  //   including self-promotion. Only dentist_owner may change a member's role.
  // --------------------------------------------------------------------------

  const NON_OWNER_ID = 'c5000000-0000-1000-8000-0000000000aa';

  test('returns 403 when a non-owner (staff_full) attempts a role change [G7-S3]', async () => {
    const membershipRepo = await seedAll();
    // Caller: an active, non-owner member of the branch (so assertBranchAccess PASSES)
    await membershipRepo.createOne({
      branchId: BRANCH_ID,
      personId: NON_OWNER_ID,
      displayName: 'Staff Non-Owner',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    // Target member the non-owner tries to escalate to dentist_owner
    const target = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Target Member',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp({ id: NON_OWNER_ID, email: 'staff@clinic.com' });

    const res = await app.request(`/dental/org/members/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'dentist_owner' }),
    });

    expect(res.status).toBe(403);
    // Role must NOT have changed
    const reloaded = await membershipRepo.findOneById(target.id);
    expect(reloaded!.role).toBe('staff_full');
  });

  test('allows a non-owner to update their own displayName (non-role field) [G7-S3]', async () => {
    // Guard is scoped to role changes only — non-role updates remain allowed
    // for any active branch member.
    const membershipRepo = await seedAll();
    const self = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      personId: NON_OWNER_ID,
      displayName: 'Staff Non-Owner',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp({ id: NON_OWNER_ID, email: 'staff@clinic.com' });

    const res = await app.request(`/dental/org/members/${self.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Renamed Self' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.displayName).toBe('Renamed Self');
    expect(body.role).toBe('staff_full');
  });

  // --------------------------------------------------------------------------
  // dental-audit P1-B / P2-A: a member role change is a sensitive permission
  // transition and MUST be written to the audit log with before/after role.
  // --------------------------------------------------------------------------

  test('[P1-B] role change writes a membership.role_change audit row with before/after role', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Roley',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'staff_scheduling' }),
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select()
      .from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.targetId, member.id), eq(dentalAuditLog.action, 'membership.role_change')));

    expect(row).toBeTruthy();
    expect(row!.actorId).toBe(PERSON_ID);
    expect(row!.targetType).toBe('dental_membership');
    expect((row!.beforeSnapshot as any)?.role).toBe('staff_full');
    expect((row!.afterSnapshot as any)?.role).toBe('staff_scheduling');
  });

  test('[P1-B] a non-role update (displayName only) writes NO role_change audit row', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Norole',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Renamed Only' }),
    });

    const rows = await db
      .select()
      .from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.targetId, member.id), eq(dentalAuditLog.action, 'membership.role_change')));
    expect(rows.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // dental-audit P1-C: a role change must NOT report success when its audit row
  // cannot be persisted (fail-closed — no silent permission-change gap).
  // --------------------------------------------------------------------------

  test('[P1-C] role change returns 5xx when the audit sink is unavailable', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Failclosed',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const spy = spyOn(AuditLogRepository.prototype, 'insert').mockImplementation(async () => {
      throw new Error('audit sink unavailable');
    });
    try {
      const res = await app.request(`/dental/org/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'staff_scheduling' }),
      });
      expect(res.status).toBeGreaterThanOrEqual(500);
    } finally {
      spy.mockRestore();
    }
  });
});
