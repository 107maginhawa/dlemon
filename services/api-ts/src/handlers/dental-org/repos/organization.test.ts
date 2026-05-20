/**
 * OrganizationRepository tests
 *
 * Tests CRUD, validation, and business rules for dental organizations.
 * Written RED (no implementation exists yet).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { OrganizationRepository } from './organization.repo';
import { openTestTx } from '@/core/test-tx';

describe('OrganizationRepository', () => {
  let repo: OrganizationRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db, rollback } = await openTestTx();
    repo = new OrganizationRepository(db);
    teardown = rollback;
  });

  afterEach(() => teardown());

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  describe('create', () => {
    test('creates an organization with required fields', async () => {
      const org = await repo.createOne({
        name: 'Bright Smiles Dental',
        tier: 'solo',
        ownerPersonId: '00000000-0000-0000-0000-000000000001',
        countryCode: 'PH',
        active: true,
      });

      expect(org.id).toBeTruthy();
      expect(org.name).toBe('Bright Smiles Dental');
      expect(org.tier).toBe('solo');
      expect(org.countryCode).toBe('PH');
      expect(org.active).toBe(true);
      expect(org.createdAt).toBeInstanceOf(Date);
    });

    test('assigns a unique UUID id on creation', async () => {
      const a = await repo.createOne({
        name: 'Clinic A',
        tier: 'solo',
        ownerPersonId: '00000000-0000-0000-0000-000000000001',
        countryCode: 'PH',
        active: true,
      });
      const b = await repo.createOne({
        name: 'Clinic B',
        tier: 'solo',
        ownerPersonId: '00000000-0000-0000-0000-000000000002',
        countryCode: 'PH',
        active: true,
      });

      expect(a.id).not.toBe(b.id);
    });

    test('rejects duplicate organization names for the same owner', async () => {
      await repo.createOne({
        name: 'Duplicate Clinic',
        tier: 'solo',
        ownerPersonId: '00000000-0000-0000-0000-000000000001',
        countryCode: 'PH',
        active: true,
      });

      await expect(
        repo.createOne({
          name: 'Duplicate Clinic',
          tier: 'solo',
          ownerPersonId: '00000000-0000-0000-0000-000000000001',
          countryCode: 'PH',
          active: true,
        })
      ).rejects.toThrow(/duplicate|unique/i);
    });

    test('rejects invalid tier enum value', async () => {
      await expect(
        repo.createOne({
          name: 'Bad Tier Clinic',
          tier: 'unknown_tier' as any,
          ownerPersonId: '00000000-0000-0000-0000-000000000001',
          countryCode: 'PH',
          active: true,
        })
      ).rejects.toThrow();
    });

    test('rejects empty name', async () => {
      await expect(
        repo.createOne({
          name: '',
          tier: 'solo',
          ownerPersonId: '00000000-0000-0000-0000-000000000001',
          countryCode: 'PH',
          active: true,
        })
      ).rejects.toThrow(/name/i);
    });
  });

  // --------------------------------------------------------------------------
  // READ
  // --------------------------------------------------------------------------

  describe('findOneById', () => {
    test('returns organization by id', async () => {
      const created = await repo.createOne({
        name: 'Findable Clinic',
        tier: 'clinic',
        ownerPersonId: '00000000-0000-0000-0000-000000000001',
        countryCode: 'US',
        active: true,
      });

      const found = await repo.findOneById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Findable Clinic');
    });

    test('returns null for non-existent id', async () => {
      const found = await repo.findOneById('00000000-0000-0000-0000-000000000099');
      expect(found).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // UPDATE
  // --------------------------------------------------------------------------

  describe('updateOne', () => {
    test('updates name and tier', async () => {
      const created = await repo.createOne({
        name: 'Old Name',
        tier: 'solo',
        ownerPersonId: '00000000-0000-0000-0000-000000000001',
        countryCode: 'PH',
        active: true,
      });

      const updated = await repo.updateOne(created.id, { name: 'New Name', tier: 'clinic' });
      expect(updated!.name).toBe('New Name');
      expect(updated!.tier).toBe('clinic');
    });

    test('returns null when updating non-existent org', async () => {
      const result = await repo.updateOne('00000000-0000-0000-0000-000000000099', { name: 'Ghost' });
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // VALIDATION HELPERS
  // --------------------------------------------------------------------------

  describe('validateTier', () => {
    test('accepts all valid tier values', () => {
      const validTiers = ['solo', 'clinic', 'group', 'enterprise'];
      for (const tier of validTiers) {
        expect(() => repo.validateTier(tier)).not.toThrow();
      }
    });

    test('throws for invalid tier', () => {
      expect(() => repo.validateTier('premium')).toThrow(/tier/i);
    });
  });
});
