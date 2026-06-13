/**
 * resetMemberPin handler tests
 *
 * Path: POST /dental/org/members/:memberId/reset-pin
 * Tests: 401 unauthenticated, 400 invalid PIN format, 404 not found, 200 success.
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID    = 'a4000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b4000000-0000-1000-8000-000000000001';
const PERSON_ID = 'c4000000-0000-1000-8000-000000000001';
const NONEXISTENT_ID = 'd4000000-0000-1000-8000-000000000099';

const authedUser = { id: PERSON_ID, email: 'owner@clinic.com' };

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
  // Seed caller as dentist_owner so the P0 auth check passes
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

describe('resetMemberPin handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp({ db });

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}/reset-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPin: '123456' }),
    });

    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Validation errors
  // --------------------------------------------------------------------------

  test('returns 400 when PIN is not 6 digits', async () => {
    await seedAll();
    const app = buildTestApp({ db, user: authedUser });

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}/reset-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPin: '123' }), // 3 digits — too short
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when PIN contains non-digits', async () => {
    await seedAll();
    const app = buildTestApp({ db, user: authedUser });

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}/reset-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPin: '12345a' }),
    });

    expect(res.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Not found
  // --------------------------------------------------------------------------

  test('returns 404 when member does not exist', async () => {
    await seedAll();
    const app = buildTestApp({ db, user: authedUser });

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}/reset-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPin: '123456' }),
    });

    expect(res.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // Success
  // --------------------------------------------------------------------------

  test('returns 200 with success:true and resets failed attempts', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Carol',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });

    // Record some failed attempts
    await membershipRepo.recordFailedPinAttempt(member.id);
    await membershipRepo.recordFailedPinAttempt(member.id);

    const app = buildTestApp({ db, user: authedUser });

    const res = await app.request(`/dental/org/members/${member.id}/reset-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPin: '999888' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);

    // Verify PIN was set and attempts were reset
    const updated = await membershipRepo.findOneById(member.id);
    expect(updated?.pinFailedAttempts).toBe(0);
    expect(updated?.pinLockedUntil).toBeNull();

    // Verify the new PIN can actually be verified
    const pinCorrect = await Bun.password.verify('999888', updated!.pinHash!);
    expect(pinCorrect).toBe(true);
  });
});
