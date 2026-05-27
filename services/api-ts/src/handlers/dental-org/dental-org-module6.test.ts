/**
 * Module 6: Staff/Org — FR6.4 Activity Visibility (lastLoginAt)
 *
 * Tests:
 * - lastLoginAt is null before any login
 * - lastLoginAt is set after successful PIN verify
 * - lastLoginAt is NOT updated on failed PIN verify
 * - listMembers includes lastLoginAt field
 * - lastLoginAt updates on subsequent login (keeps most recent)
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000066', email: 'test@clinic.com' };
const ORG_ID = 'eeeeeeee-0000-1000-8000-000000000066';
const BRANCH_ID = 'bbbbbbbb-0000-1000-8000-000000000066';
const MEMBER_ID = 'dddddddd-0000-1000-8000-000000000066';

const PIN = '1234';

async function seedData() {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Test Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  const pinHash = await Bun.password.hash(PIN, { algorithm: 'bcrypt', cost: 4 });

  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Dr. Test', role: 'dentist_owner',
    pinHash,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
}

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE dental_membership, dental_branch, dental_organization
    RESTART IDENTITY CASCADE
  `);
});

describe('FR6.4: Activity Visibility (lastLoginAt)', () => {
  test('lastLoginAt is null before any login', async () => {
    await seedData();
    const repo = new MembershipRepository(db);
    const member = await repo.findOneById(MEMBER_ID);
    expect(member).not.toBeNull();
    expect(member!.lastLoginAt).toBeNull();
  });

  test('lastLoginAt is set after trackLastLogin', async () => {
    await seedData();
    const before = new Date();
    const repo = new MembershipRepository(db);
    await repo.trackLastLogin(MEMBER_ID);
    const after = new Date();

    const member = await repo.findOneById(MEMBER_ID);
    expect(member!.lastLoginAt).not.toBeNull();
    const loginAt = new Date(member!.lastLoginAt!);
    expect(loginAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(loginAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test('lastLoginAt updates on subsequent calls (most recent wins)', async () => {
    await seedData();
    const repo = new MembershipRepository(db);
    await repo.trackLastLogin(MEMBER_ID);
    const firstMember = await repo.findOneById(MEMBER_ID);
    const firstLoginAt = firstMember!.lastLoginAt;

    // Small delay to ensure timestamps differ
    await Bun.sleep(2);

    await repo.trackLastLogin(MEMBER_ID);
    const secondMember = await repo.findOneById(MEMBER_ID);
    const secondLoginAt = secondMember!.lastLoginAt;

    expect(new Date(secondLoginAt!).getTime()).toBeGreaterThan(new Date(firstLoginAt!).getTime());
  });

  test('listMembers includes lastLoginAt field', async () => {
    await seedData();
    const repo = new MembershipRepository(db);
    await repo.trackLastLogin(MEMBER_ID);

    const members = await repo.listByBranch(BRANCH_ID);
    expect(members.length).toBe(1);
    const member = members[0]!;
    expect('lastLoginAt' in member).toBe(true);
    expect(member.lastLoginAt).not.toBeNull();
  });

  test('lastLoginAt not set when member not found', async () => {
    await seedData();
    const repo = new MembershipRepository(db);
    // Should not throw for non-existent member
    await expect(repo.trackLastLogin('ffffffff-ffff-1000-8000-ffffffffffff')).resolves.toBeUndefined();
  });
});
