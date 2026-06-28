/**
 * MembershipRepository tests
 *
 * Tests CRUD, uniqueness, role validation, PIN hash storage, and deactivation.
 * Written RED (no implementation exists yet).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { MembershipRepository } from './membership.repo';
import { BranchRepository } from './branch.repo';
import { OrganizationRepository } from './organization.repo';
import { dentalMemberships } from './membership.schema';
import { openTestTx } from '@/core/test-tx';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const ORG_ID = '00000000-0000-0000-0000-111111111111';
const BRANCH_ID = '00000000-0000-0000-0000-222222222222';
const PERSON_ID = '00000000-0000-0000-0000-000000000001';

describe('MembershipRepository', () => {
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
    teardown = rollback;
  });

  afterEach(() => teardown());

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
  // PIN LOCKOUT — recordFailedPinAttempt
  // --------------------------------------------------------------------------

  describe('recordFailedPinAttempt lockout', () => {
    test('escalates: 5th consecutive fail locks for ~30s', async () => {
      const m = await repo.createOne({ branchId: BRANCH_ID, displayName: 'Locky', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });
      let updated;
      for (let i = 0; i < 5; i++) updated = await repo.recordFailedPinAttempt(m.id);
      expect(updated!.pinFailedAttempts).toBe(5);
      expect(updated!.pinLockedUntil).not.toBeNull();
      expect(repo.isLockedOut(updated!)).toBe(true);
    });

    test('after an EXPIRED lockout, a new fail starts a fresh count (no instant re-lock)', async () => {
      // Reproduces the staff PIN bug: once a member hit the threshold, every later
      // single mistake re-locked them because the counter never decayed.
      const m = await repo.createOne({ branchId: BRANCH_ID, displayName: 'Stuck', role: 'staff_full', status: 'active', pinFailedAttempts: 0 });
      // Simulate a member who was locked out, but the window has fully elapsed.
      await db.update(dentalMemberships)
        .set({ pinFailedAttempts: 10, pinLockedUntil: new Date(Date.now() - 60_000) })
        .where(eq(dentalMemberships.id, m.id));

      const updated = await repo.recordFailedPinAttempt(m.id);

      expect(updated!.pinFailedAttempts).toBe(1);       // fresh cycle, not 11
      expect(updated!.pinLockedUntil).toBeNull();        // not re-locked on a single fail
      expect(repo.isLockedOut(updated!)).toBe(false);
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
  // STATE MACHINE — transitionStatus (V-ORG-001, MODULE_SPEC §8)
  //   Legal: invited→active, active→inactive, inactive→active
  //   Illegal jumps throw an IllegalStateTransitionError (handler maps to 422).
  // --------------------------------------------------------------------------

  describe('transitionStatus', () => {
    async function seedMember(status: 'invited' | 'active' | 'inactive') {
      return repo.createOne({
        branchId: BRANCH_ID,
        displayName: `Member ${status}`,
        role: 'staff_full',
        status,
        pinFailedAttempts: 0,
      });
    }

    test('invited → active (first login) is allowed', async () => {
      const m = await seedMember('invited');
      const updated = await repo.transitionStatus(m.id, 'invited', 'active');
      expect(updated!.status).toBe('active');
    });

    test('active → inactive (owner deactivates) is allowed', async () => {
      const m = await seedMember('active');
      const updated = await repo.transitionStatus(m.id, 'active', 'inactive');
      expect(updated!.status).toBe('inactive');
    });

    test('inactive → active (owner reactivates) is allowed', async () => {
      const m = await seedMember('inactive');
      const updated = await repo.transitionStatus(m.id, 'inactive', 'active');
      expect(updated!.status).toBe('active');
    });

    test('rejects invited → inactive (illegal jump)', async () => {
      const m = await seedMember('invited');
      await expect(repo.transitionStatus(m.id, 'invited', 'inactive')).rejects.toThrow(
        /illegal|transition/i,
      );
    });

    test('rejects active → invited (illegal backward jump)', async () => {
      const m = await seedMember('active');
      await expect(repo.transitionStatus(m.id, 'active', 'invited')).rejects.toThrow(
        /illegal|transition/i,
      );
    });

    test('rejects inactive → inactive (no-op illegal)', async () => {
      const m = await seedMember('inactive');
      await expect(repo.transitionStatus(m.id, 'inactive', 'inactive')).rejects.toThrow(
        /illegal|transition/i,
      );
    });

    test('rejects when the actual current status does not match `from` (concurrent change)', async () => {
      const m = await seedMember('active');
      // Claiming to transition from `invited` but the row is actually `active`.
      await expect(repo.transitionStatus(m.id, 'invited', 'active')).rejects.toThrow(
        /illegal|transition|current/i,
      );
    });

    test('returns null when member not found', async () => {
      const result = await repo.transitionStatus(
        '00000000-0000-0000-0000-000000000099',
        'active',
        'inactive',
      );
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
      // V-ORG-001: deactivate now guards the §8 state machine, so transition an
      // active member to inactive rather than seeding+re-deactivating inactive.
      const toDeactivate = await repo.createOne({ branchId: BRANCH_ID, displayName: 'Inactive Member', role: 'staff_scheduling', status: 'active', pinFailedAttempts: 0 });
      await repo.deactivate(toDeactivate.id);

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
  // PAGINATION & COUNT — V-ORG-004 (perf §16): scoped LIMIT/OFFSET + count(*)
  // --------------------------------------------------------------------------

  describe('listByBranchPaginated / countByBranch', () => {
    async function seedN(n: number, status: 'active' | 'inactive' = 'active') {
      for (let i = 0; i < n; i++) {
        await repo.createOne({ branchId: BRANCH_ID, displayName: `Member ${status} ${i}`, role: 'staff_full', status, pinFailedAttempts: 0 });
      }
    }

    test('bounds the result set by limit/offset', async () => {
      await seedN(5);
      const firstPage = await repo.listByBranchPaginated(BRANCH_ID, { limit: 2, offset: 0 });
      const secondPage = await repo.listByBranchPaginated(BRANCH_ID, { limit: 2, offset: 2 });
      expect(firstPage.length).toBe(2);
      expect(secondPage.length).toBe(2);
      // No overlap between pages
      const ids = new Set(firstPage.map((m) => m.id));
      expect(secondPage.every((m) => !ids.has(m.id))).toBe(true);
    });

    test('countByBranch returns active count by default and total with includeInactive', async () => {
      await seedN(3, 'active');
      await seedN(2, 'inactive');
      expect(await repo.countByBranch(BRANCH_ID)).toBe(3);
      expect(await repo.countByBranch(BRANCH_ID, { includeInactive: true })).toBe(5);
    });

    test('paginated listing excludes inactive by default', async () => {
      await seedN(2, 'active');
      await seedN(2, 'inactive');
      const page = await repo.listByBranchPaginated(BRANCH_ID, { limit: 50, offset: 0 });
      expect(page.every((m) => m.status === 'active')).toBe(true);
      expect(page.length).toBe(2);
    });
  });

  describe('findActiveByPersonAndBranch', () => {
    test('returns the active membership for a person in a branch', async () => {
      const m = await repo.createOne({ branchId: BRANCH_ID, personId: PERSON_ID, displayName: 'Linked', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0 });
      const found = await repo.findActiveByPersonAndBranch(PERSON_ID, BRANCH_ID);
      expect(found!.id).toBe(m.id);
    });

    test('returns null for a non-member', async () => {
      const found = await repo.findActiveByPersonAndBranch('00000000-0000-0000-0000-0000000000aa', BRANCH_ID);
      expect(found).toBeNull();
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

  // --------------------------------------------------------------------------
  // ROLE GRANULARITY — T9: dental_assistant, front_desk, billing_staff
  // --------------------------------------------------------------------------

  describe('role granularity — extended roles', () => {
    test('VALID_MEMBER_ROLES includes dental_assistant', async () => {
      const { VALID_MEMBER_ROLES } = await import('./membership.schema');
      expect(VALID_MEMBER_ROLES).toContain('dental_assistant');
    });

    test('VALID_MEMBER_ROLES includes front_desk', async () => {
      const { VALID_MEMBER_ROLES } = await import('./membership.schema');
      expect(VALID_MEMBER_ROLES).toContain('front_desk');
    });

    test('VALID_MEMBER_ROLES includes billing_staff', async () => {
      const { VALID_MEMBER_ROLES } = await import('./membership.schema');
      expect(VALID_MEMBER_ROLES).toContain('billing_staff');
    });

    test('creates a member with dental_assistant role', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Maria Dental Assistant',
        role: 'dental_assistant',
        status: 'active',
        pinFailedAttempts: 0,
      });
      expect(member.role).toBe('dental_assistant');
    });

    test('creates a member with front_desk role', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Ana Front Desk',
        role: 'front_desk',
        status: 'active',
        pinFailedAttempts: 0,
      });
      expect(member.role).toBe('front_desk');
    });

    test('creates a member with billing_staff role', async () => {
      const member = await repo.createOne({
        branchId: BRANCH_ID,
        displayName: 'Bea Billing',
        role: 'billing_staff',
        status: 'active',
        pinFailedAttempts: 0,
      });
      expect(member.role).toBe('billing_staff');
    });
  });
});
