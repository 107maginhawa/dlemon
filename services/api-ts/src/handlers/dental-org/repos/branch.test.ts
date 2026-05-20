/**
 * BranchRepository tests
 *
 * Tests CRUD and business rules for dental branches (clinic locations).
 * Written RED (no implementation exists yet).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { BranchRepository } from './branch.repo';
import { OrganizationRepository } from './organization.repo';
import { openTestTx } from '@/core/test-tx';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const ORG_ID = '00000000-0000-0000-0000-111111111111';

describe('BranchRepository', () => {
  let repo: BranchRepository;
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    repo = new BranchRepository(db);
    // Seed a parent org
    const orgRepo = new OrganizationRepository(db);
    await orgRepo.createOne({
      id: ORG_ID,
      name: 'Test Practice',
      tier: 'clinic',
      ownerPersonId: '00000000-0000-0000-0000-000000000001',
      countryCode: 'PH',
      active: true,
    });
    teardown = rollback;
  });

  afterEach(() => teardown());

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  describe('create', () => {
    test('creates a branch with required fields', async () => {
      const branch = await repo.createOne({
        organizationId: ORG_ID,
        name: 'Main Branch',
        timezone: 'Asia/Manila',
        active: true,
      });

      expect(branch.id).toBeTruthy();
      expect(branch.organizationId).toBe(ORG_ID);
      expect(branch.name).toBe('Main Branch');
      expect(branch.timezone).toBe('Asia/Manila');
      expect(branch.active).toBe(true);
    });

    test('creates branch with optional address and phone', async () => {
      const branch = await repo.createOne({
        organizationId: ORG_ID,
        name: 'Satellite Branch',
        timezone: 'Asia/Manila',
        address: '123 Rizal Ave',
        city: 'Manila',
        phone: '+639171234567',
        active: true,
      });

      expect(branch.address).toBe('123 Rizal Ave');
      expect(branch.city).toBe('Manila');
      expect(branch.phone).toBe('+639171234567');
    });

    test('stores working hours as JSON string', async () => {
      const hours = JSON.stringify({
        mon: { open: '08:00', close: '17:00' },
        tue: { open: '08:00', close: '17:00' },
        sat: { open: '08:00', close: '12:00' },
        sun: null,
      });

      const branch = await repo.createOne({
        organizationId: ORG_ID,
        name: 'Branch With Hours',
        timezone: 'Asia/Manila',
        workingHours: hours,
        active: true,
      });

      expect(branch.workingHours).toBe(hours);
    });

    test('rejects branch without a valid timezone', async () => {
      await expect(
        repo.createOne({
          organizationId: ORG_ID,
          name: 'No Timezone Branch',
          timezone: '',
          active: true,
        })
      ).rejects.toThrow(/timezone/i);
    });

    test('rejects branch with non-existent organizationId (FK violation)', async () => {
      await expect(
        repo.createOne({
          organizationId: '00000000-0000-0000-0000-999999999999',
          name: 'Orphan Branch',
          timezone: 'Asia/Manila',
          active: true,
        })
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // LIST
  // --------------------------------------------------------------------------

  describe('listByOrg', () => {
    test('returns all branches for an organization', async () => {
      await repo.createOne({ organizationId: ORG_ID, name: 'Branch 1', timezone: 'Asia/Manila', active: true });
      await repo.createOne({ organizationId: ORG_ID, name: 'Branch 2', timezone: 'Asia/Manila', active: true });

      const branches = await repo.listByOrg(ORG_ID);
      expect(branches.length).toBe(2);
    });

    test('returns empty array for org with no branches', async () => {
      const branches = await repo.listByOrg('00000000-0000-0000-0000-222222222222');
      expect(branches).toEqual([]);
    });

    test('does not return branches from other orgs', async () => {
      // Different org
      const orgRepo = new OrganizationRepository(db);
      const otherOrg = await orgRepo.createOne({
        name: 'Other Practice',
        tier: 'solo',
        ownerPersonId: '00000000-0000-0000-0000-000000000002',
        countryCode: 'PH',
        active: true,
      });

      await repo.createOne({ organizationId: ORG_ID, name: 'My Branch', timezone: 'Asia/Manila', active: true });
      await repo.createOne({ organizationId: otherOrg.id, name: 'Their Branch', timezone: 'Asia/Manila', active: true });

      const branches = await repo.listByOrg(ORG_ID);
      expect(branches.length).toBe(1);
      expect(branches[0]!.name).toBe('My Branch');
    });
  });

  // --------------------------------------------------------------------------
  // GET
  // --------------------------------------------------------------------------

  describe('findOneById', () => {
    test('returns branch by id', async () => {
      const created = await repo.createOne({
        organizationId: ORG_ID,
        name: 'Target Branch',
        timezone: 'Asia/Manila',
        active: true,
      });

      const found = await repo.findOneById(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Target Branch');
    });

    test('returns null for non-existent id', async () => {
      expect(await repo.findOneById('00000000-0000-0000-0000-000000000099')).toBeNull();
    });
  });
});
