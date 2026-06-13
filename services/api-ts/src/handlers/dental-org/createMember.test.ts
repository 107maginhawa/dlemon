/**
 * createMember handler tests
 *
 * Path: POST /dental/org/members?branchId=...
 * Tests: 401 unauthenticated, 400 missing branchId, 400 missing displayName,
 *        400 invalid role, 201 success.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp as buildHarnessApp } from '@/tests/helpers/test-app';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';
import { dentalMemberships } from './repos/membership.schema';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

// Migrated off the bespoke raw-handler mount to the shared validator-mounting
// harness (Track 4): POST /dental/org/members now runs through the real
// generated route table (authMiddleware → query+json zValidator → handler), so
// the 400 missing-branchId / missing-displayName / invalid-role cases exercise
// the exact generated validation production runs (createMember was the handler
// behind the branchId @query contract drift).

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID   = 'a1000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b1000000-0000-1000-8000-000000000001';
const PERSON_ID = 'c1000000-0000-1000-8000-000000000001';

const authedUser = { id: PERSON_ID, email: 'owner@clinic.com' };

function buildTestApp(user?: typeof authedUser) {
  return buildHarnessApp({ db, user: user ?? null });
}

async function seedOrgAndBranch() {
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
  // Seed membership for authedUser so assertBranchAccess passes
  const membershipRepo = new MembershipRepository(db);
  await membershipRepo.createOne({
    branchId: BRANCH_ID,
    personId: PERSON_ID,
    displayName: 'Owner',
    role: 'dentist_owner',
    status: 'active',
  });
}

describe('createMember handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_audit_log, dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Staff Ana', role: 'staff_full' }),
    });

    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Validation errors
  // --------------------------------------------------------------------------

  test('returns 400 when branchId is missing', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request('/dental/org/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Staff Ana', role: 'staff_full' }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when displayName is missing', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'staff_full' }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when role is invalid', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Staff Ana', role: 'superuser' }),
    });

    expect(res.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Success
  // --------------------------------------------------------------------------

  test('returns 201 with created member on valid input', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Staff Ana', role: 'staff_full' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.displayName).toBe('Staff Ana');
    expect(body.role).toBe('staff_full');
    expect(body.branchId).toBe(BRANCH_ID);
    expect(body.status).toBe('active');
    // PIN hash must not be returned
    expect(body.pinHash).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Security: create-time PIN must NOT be honored.
  //
  // The generated CreateMemberBody contract has NO `pin` field, and PIN-setting
  // is owner-gated through the two-call create → resetMemberPin flow (decision
  // #9 — see use-staff-members.ts:148). zValidator is non-strict (no .strict()
  // anywhere in the generated validators), so a request that smuggles `pin` into
  // the create body is NOT rejected — the validated copy just drops it. This
  // pins that the HANDLER drops it too: a raw create-time `pin` must never set a
  // PIN hash, otherwise it bypasses the audited owner-gated resetMemberPin path.
  // --------------------------------------------------------------------------

  test('does NOT honor a create-time pin (smuggled raw pin is ignored — PIN is set only via owner-gated reset)', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Staff Ana', role: 'staff_full', pin: '123456' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;

    // The persisted membership must carry NO pin hash.
    const rows = await db.select().from(dentalMemberships).where(eq(dentalMemberships.id, body.id));
    expect(
      rows[0]!.pinHash,
      'create-time pin must NOT be honored — PIN is set only via the owner-gated resetMemberPin flow',
    ).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Owner bootstrap: the FIRST membership an owner creates IS the owner.
  // It must be linked to the owner's account (personId = user.id) so they
  // actually gain branch access — otherwise set-pin and every subsequent owner
  // operation fails assertBranchAccess(user.id, branch) ("You do not have
  // access to this branch"), which is exactly what breaks the onboarding wizard.
  // --------------------------------------------------------------------------

  test('owner-bootstrap: first membership is linked to the owner account (personId = user.id)', async () => {
    // Seed org + branch but DO NOT seed the owner's membership — this is the
    // genuine first-run state the onboarding wizard hits.
    const orgRepo = new OrganizationRepository(db);
    await orgRepo.createOne({
      id: ORG_ID, name: 'Bootstrap Clinic', tier: 'solo',
      ownerPersonId: PERSON_ID, countryCode: 'PH', active: true,
    });
    const branchRepo = new BranchRepository(db);
    await branchRepo.createOne({
      id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
      timezone: 'Asia/Manila', active: true,
    });

    const app = buildTestApp(authedUser);
    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The wizard sends NO personId for the owner's first member.
      body: JSON.stringify({ displayName: 'Dr. Owner', role: 'dentist_owner' }),
    });

    expect(res.status).toBe(201);

    // The persisted membership must be linked to the owner so they have access.
    const membershipRepo = new MembershipRepository(db);
    const mine = await membershipRepo.findActiveByPersonAndBranch(PERSON_ID, BRANCH_ID);
    expect(mine, 'owner must now hold an active membership in the branch').toBeTruthy();
    expect(mine!.role).toBe('dentist_owner');
  });

  // --------------------------------------------------------------------------
  // EF-ORG-011: dentist_owner role enforcement
  // --------------------------------------------------------------------------

  test('returns 403 when caller is not dentist_owner (staff_full role)', async () => {
    await seedOrgAndBranch();
    // Override the membership seeded in seedOrgAndBranch: re-seed as staff_full
    const membershipRepo = new MembershipRepository(db);
    // Deactivate the dentist_owner seed membership and re-add as staff_full
    await db.execute(sql`UPDATE dental_membership SET role = 'staff_full' WHERE person_id = ${PERSON_ID}`);

    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Staff', role: 'staff_full' }),
    });

    expect(res.status).toBe(403);
  });

  test('returns 403 when caller is dentist_associate (not owner)', async () => {
    await seedOrgAndBranch();
    await db.execute(sql`UPDATE dental_membership SET role = 'dentist_associate' WHERE person_id = ${PERSON_ID}`);

    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Staff', role: 'staff_full' }),
    });

    expect(res.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // AL-003: HIPAA audit trail
  // --------------------------------------------------------------------------

  // EM-AUD-008: audit row must land in dental_audit_log (what the dental audit
  // viewer reads), not only the platform audit_log_entry table.
  test('AL-003: createMembership persists audit record to dental_audit_log', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Audited Staff', role: 'staff_full' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;

    // Verify audit record persisted to the viewer table (not just logger.info)
    const rows = await db
      .select()
      .from(dentalAuditLog)
      .where(eq(dentalAuditLog.targetId, body.id));

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0]!;
    expect(row.action).toBe('membership.create');
    expect(row.targetType).toBe('dental_membership');
    expect(row.actorId).toBe(PERSON_ID);
    expect(row.branchId).toBe(BRANCH_ID);
    expect(row.eventType).toBe('data-modification');
  });
});
