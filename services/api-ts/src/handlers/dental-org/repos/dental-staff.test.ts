/**
 * Staff Management via MembershipRepo tests
 *
 * Tests list, filter, deactivate, and role-based creation operations
 * against the existing MembershipRepository.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { MembershipRepository } from './membership.repo';
import { BranchRepository } from './branch.repo';
import { OrganizationRepository } from './organization.repo';
import { openTestTx } from '@/core/test-tx';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const ORG_ID = '00000000-0000-0000-0000-aaaaaaaaaaaa';
const BRANCH_ID = '00000000-0000-0000-0000-bbbbbbbbbbbb';
const BRANCH_ID_2 = '00000000-0000-0000-0000-cccccccccccc';
const PERSON_ID = '00000000-0000-0000-0000-000000000001';

describe('Staff Management via MembershipRepo', () => {
  let repo: MembershipRepository;
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    repo = new MembershipRepository(db);
    // Seed org and branch
    const orgRepo = new OrganizationRepository(db);
    await orgRepo.createOne({
      id: ORG_ID,
      name: 'Staff Test Practice',
      tier: 'clinic',
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
    await branchRepo.createOne({
      id: BRANCH_ID_2,
      organizationId: ORG_ID,
      name: 'Second Branch',
      timezone: 'Asia/Manila',
      active: true,
    });
    teardown = rollback;
  });

  afterEach(() => teardown());

  // --------------------------------------------------------------------------
  // LIST BY BRANCH
  // --------------------------------------------------------------------------

  test('listByBranch returns active members', async () => {
    await repo.createOne({ branchId: BRANCH_ID, displayName: 'Dr. Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0 });
    await repo.createOne({ branchId: BRANCH_ID, displayName: 'Staff Ana', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });

    const members = await repo.listByBranch(BRANCH_ID);
    expect(members.length).toBe(2);
    expect(members.every(m => m.status === 'active')).toBe(true);
  });

  test('listByBranch filters to specific branch', async () => {
    await repo.createOne({ branchId: BRANCH_ID, displayName: 'Branch 1 Staff', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });
    await repo.createOne({ branchId: BRANCH_ID_2, displayName: 'Branch 2 Staff', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });

    const branch1Members = await repo.listByBranch(BRANCH_ID);
    expect(branch1Members.length).toBe(1);
    expect(branch1Members[0]!.displayName).toBe('Branch 1 Staff');

    const branch2Members = await repo.listByBranch(BRANCH_ID_2);
    expect(branch2Members.length).toBe(1);
    expect(branch2Members[0]!.displayName).toBe('Branch 2 Staff');
  });

  test('listByBranch excludes inactive members by default', async () => {
    await repo.createOne({ branchId: BRANCH_ID, displayName: 'Active Staff', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });
    const inactive = await repo.createOne({ branchId: BRANCH_ID, displayName: 'Inactive Staff', role: 'staff_scheduling', status: 'active', pinFailedAttempts: 0 });
    await repo.deactivate(inactive.id);

    const members = await repo.listByBranch(BRANCH_ID);
    expect(members.length).toBe(1);
    expect(members[0]!.displayName).toBe('Active Staff');
  });

  test('listByBranch can include inactive with option', async () => {
    await repo.createOne({ branchId: BRANCH_ID, displayName: 'Active Staff', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });
    const m = await repo.createOne({ branchId: BRANCH_ID, displayName: 'Inactive Staff', role: 'staff_scheduling', status: 'active', pinFailedAttempts: 0 });
    await repo.deactivate(m.id);

    const members = await repo.listByBranch(BRANCH_ID, { includeInactive: true });
    expect(members.length).toBe(2);
  });

  // --------------------------------------------------------------------------
  // DEACTIVATION
  // --------------------------------------------------------------------------

  test('deactivate sets status to inactive', async () => {
    const member = await repo.createOne({ branchId: BRANCH_ID, displayName: 'To Deactivate', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });

    const deactivated = await repo.deactivate(member.id);
    expect(deactivated!.status).toBe('inactive');
  });

  test('deactivated member no longer appears in default list', async () => {
    const member = await repo.createOne({ branchId: BRANCH_ID, displayName: 'Will Be Gone', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });
    await repo.createOne({ branchId: BRANCH_ID, displayName: 'Still Here', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0 });

    await repo.deactivate(member.id);

    const members = await repo.listByBranch(BRANCH_ID);
    expect(members.length).toBe(1);
    expect(members[0]!.displayName).toBe('Still Here');
  });

  // --------------------------------------------------------------------------
  // ROLE-BASED CREATION
  // --------------------------------------------------------------------------

  test('create membership with role dentist_associate', async () => {
    const member = await repo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Dr. Associate',
      role: 'dentist_associate',
      status: 'active',
      pinFailedAttempts: 0,
    });

    expect(member.role).toBe('dentist_associate');
    expect(member.status).toBe('active');
  });

  test('create membership with role staff_full', async () => {
    const member = await repo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Full Ops Staff',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });

    expect(member.role).toBe('staff_full');
    expect(member.status).toBe('active');
  });

  test('create membership with role staff_scheduling', async () => {
    const member = await repo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Scheduler',
      role: 'staff_scheduling',
      status: 'active',
      pinFailedAttempts: 0,
    });

    expect(member.role).toBe('staff_scheduling');
    expect(member.status).toBe('active');
  });
});
