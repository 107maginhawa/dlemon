/**
 * MembershipRepository tests
 *
 * Tests CRUD, uniqueness, role validation, PIN hash storage, and deactivation.
 * Written RED (no implementation exists yet).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { MembershipRepository } from './membership.repo';
import { BranchRepository } from './branch.repo';
import { OrganizationRepository } from './organization.repo';
import { dentalMemberships } from './membership.schema';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const ORG_ID = '00000000-0000-0000-0000-111111111111';
const BRANCH_ID = '00000000-0000-0000-0000-222222222222';
const PERSON_ID = '00000000-0000-0000-0000-000000000001';

describe('MembershipRepository', () => {
  let repo: MembershipRepository;

  beforeEach(async () => {
    repo = new MembershipRepository(db);
    // Seed org and branch
    const orgRepo = new OrganizationRepository(db);
    await orgRepo.createOne({
      id: ORG_ID,
      name: 'Test Practice',
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
  });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  describe('create', () => {
    test('creates a membership with required fields', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Dr. Juan Cruz',
        role: 'dentist_owner',
        status: 'active',
        pinFailedAttempts: 0,
      });

      expect(member.id).toBeTruthy();
      expect(member.branchId).toBe(BRANCH_ID);
      expect(member.displayName).toBe('Dr. Juan Cruz');
      expect(member.role).toBe('dentist_owner');
      expect(member.status).toBe('active');
      expect(member.pinHash).toBeNull();
      expect(member.pinFailedAttempts).toBe(0);
    });

    test('stores personId when provided (cloud-linked staff)', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        personId: PERSON_ID,
        displayName: 'Dr. Maria Santos',
        role: 'dentist_associate',
        status: 'active',
        pinFailedAttempts: 0,
      });

      expect(member.personId).toBe(PERSON_ID);
    });

    test('creates PIN-only staff without personId', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Staff Ana',
        role: 'staff_full',
        status: 'active',
        pinFailedAttempts: 0,
      });

      expect(member.personId).toBeNull();
    });

    test('rejects duplicate person+branch combination', async () => {
      await repo.createOne({
        branchId: BRANCH_ID,
        personId: PERSON_ID,
        displayName: 'Dr. Juan Cruz',
        role: 'dentist_owner',
        status: 'active',
        pinFailedAttempts: 0,
      });

      await expect(
        repo.createOne({
          branchId: BRANCH_ID,
          personId: PERSON_ID,
          displayName: 'Dr. Juan Cruz (duplicate)',
          role: 'dentist_associate',
          status: 'active',
          pinFailedAttempts: 0,
        })
      ).rejects.toThrow(/duplicate|unique/i);
    });

    test('rejects invalid role enum', async () => {
      await expect(
        repo.createOne({
          branchId: BRANCH_ID,
          displayName: 'Invalid Role Staff',
          role: 'super_admin' as any,
          status: 'active',
          pinFailedAttempts: 0,
        })
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // PIN HASH STORAGE
  // --------------------------------------------------------------------------

  describe('updatePin', () => {
    test('stores bcrypt PIN hash', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Dr. PIN Test',
        role: 'dentist_owner',
        status: 'active',
        pinFailedAttempts: 0,
      });

      const fakeHash = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';
      const updated = await repo.updatePin(member.id, fakeHash);

      expect(updated!.pinHash).toBe(fakeHash);
    });

    test('returns null when member not found', async () => {
      const result = await repo.updatePin('00000000-0000-0000-0000-000000000099', 'hash');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // DEACTIVATION
  // --------------------------------------------------------------------------

  describe('deactivate', () => {
    test('sets status to inactive', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'To Deactivate',
        role: 'staff_full',
        status: 'active',
        pinFailedAttempts: 0,
      });

      const deactivated = await repo.deactivate(member.id);
      expect(deactivated!.status).toBe('inactive');
    });

    test('returns null when member not found', async () => {
      const result = await repo.deactivate('00000000-0000-0000-0000-000000000099');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // LIST
  // --------------------------------------------------------------------------

  describe('listByBranch', () => {
    test('returns active members for a branch', async () => {
      await repo.createOne({ branchId: BRANCH_ID, displayName: 'Member 1', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0 });
      await repo.createOne({ branchId: BRANCH_ID, displayName: 'Member 2', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });

      const members = await repo.listByBranch(BRANCH_ID);
      expect(members.length).toBe(2);
    });

    test('excludes inactive members by default', async () => {
      await repo.createOne({ branchId: BRANCH_ID, displayName: 'Active Member', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });
      const inactive = await repo.createOne({ branchId: BRANCH_ID, displayName: 'Inactive Member', role: 'staff_scheduling', status: 'inactive', pinFailedAttempts: 0 });
      await repo.deactivate(inactive.id);

      const members = await repo.listByBranch(BRANCH_ID);
      expect(members.every(m => m.status === 'active')).toBe(true);
    });

    test('returns all members when includeInactive is true', async () => {
      await repo.createOne({ branchId: BRANCH_ID, displayName: 'Active', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });
      const m = await repo.createOne({ branchId: BRANCH_ID, displayName: 'Inactive', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });
      await repo.deactivate(m.id);

      const members = await repo.listByBranch(BRANCH_ID, { includeInactive: true });
      expect(members.length).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // PIN FAILED ATTEMPT TRACKING
  // --------------------------------------------------------------------------

  describe('recordFailedPinAttempt', () => {
    test('increments pinFailedAttempts by 1', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Attempt Counter',
        role: 'staff_full',
        status: 'active',
        pinFailedAttempts: 0,
      });

      const updated = await repo.recordFailedPinAttempt(member.id);
      expect(updated!.pinFailedAttempts).toBe(1);
    });

    test('does not lock out before 5 attempts', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Not Yet Locked',
        role: 'staff_full',
        status: 'active',
        pinFailedAttempts: 3,
      });

      const updated = await repo.recordFailedPinAttempt(member.id);
      expect(updated!.pinFailedAttempts).toBe(4);
      expect(updated!.pinLockedUntil).toBeNull();
    });

    test('locks out for 30 seconds at 5 failed attempts', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'About to Lock 5',
        role: 'staff_full',
        status: 'active',
        pinFailedAttempts: 4,
      });

      const before = new Date();
      const updated = await repo.recordFailedPinAttempt(member.id);
      const after = new Date();

      expect(updated!.pinFailedAttempts).toBe(5);
      expect(updated!.pinLockedUntil).not.toBeNull();

      // Lockout should be ~30 seconds from now
      const lockoutMs = updated!.pinLockedUntil!.getTime();
      expect(lockoutMs).toBeGreaterThanOrEqual(before.getTime() + 29_000);
      expect(lockoutMs).toBeLessThanOrEqual(after.getTime() + 31_000);
    });

    test('locks out for 5 minutes at 10 failed attempts', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'About to Lock 10',
        role: 'staff_full',
        status: 'active',
        pinFailedAttempts: 9,
      });

      const before = new Date();
      const updated = await repo.recordFailedPinAttempt(member.id);
      const after = new Date();

      expect(updated!.pinFailedAttempts).toBe(10);
      expect(updated!.pinLockedUntil).not.toBeNull();

      // Lockout should be ~5 minutes (300s) from now
      const lockoutMs = updated!.pinLockedUntil!.getTime();
      expect(lockoutMs).toBeGreaterThanOrEqual(before.getTime() + 299_000);
      expect(lockoutMs).toBeLessThanOrEqual(after.getTime() + 301_000);
    });

    test('returns null when member not found', async () => {
      const result = await repo.recordFailedPinAttempt('00000000-0000-0000-0000-000000000099');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // PIN ATTEMPT RESET
  // --------------------------------------------------------------------------

  describe('resetPinAttempts', () => {
    test('clears failed attempts and lockout on successful login', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Reset Test',
        role: 'staff_full',
        status: 'active',
        pinFailedAttempts: 4,
      });

      // Apply a lockout first
      await repo.recordFailedPinAttempt(member.id);

      const reset = await repo.resetPinAttempts(member.id);
      expect(reset!.pinFailedAttempts).toBe(0);
      expect(reset!.pinLockedUntil).toBeNull();
    });

    test('returns null when member not found', async () => {
      const result = await repo.resetPinAttempts('00000000-0000-0000-0000-000000000099');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // LOCKOUT CHECK
  // --------------------------------------------------------------------------

  describe('isLockedOut', () => {
    test('returns false when pinLockedUntil is null', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Not Locked',
        role: 'staff_full',
        status: 'active',
        pinFailedAttempts: 0,
      });

      const found = await repo.findOneById(member.id);
      expect(repo.isLockedOut(found!)).toBe(false);
    });

    test('returns true when pinLockedUntil is in the future', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Locked',
        role: 'staff_full',
        status: 'active',
        pinFailedAttempts: 4,
      });

      // Record 5th attempt → triggers 30s lockout
      const locked = await repo.recordFailedPinAttempt(member.id);
      expect(repo.isLockedOut(locked!)).toBe(true);
    });

    test('returns false when pinLockedUntil is in the past', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Expired Lock',
        role: 'staff_full',
        status: 'active',
        pinFailedAttempts: 0,
      });

      // Manually set an expired lockout
      const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
      const [updated] = await db
        .update(dentalMemberships)
        .set({ pinLockedUntil: pastDate })
        .where(eq(dentalMemberships.id, member.id))
        .returning();

      expect(repo.isLockedOut(updated!)).toBe(false);
    });
  });
});
