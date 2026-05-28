/**
 * AmendmentRepository tests
 *
 * Amendments are additive-only: create is allowed, no updates after creation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { AmendmentRepository } from './amendment.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

let db: NodePgDatabase;

const VISIT_1     = CHAIN_IDS.VISIT_1;
const VISIT_2     = CHAIN_IDS.VISIT_2;
const PATIENT_1   = CHAIN_IDS.PATIENT_1;
const MEMBER_1    = CHAIN_IDS.MEMBERSHIP_1;
const RECORD_ID_1 = 'e6000000-0000-4000-8000-000000000030';

const baseAmendment = {
  visitId: VISIT_1,
  patientId: PATIENT_1,
  authorMemberId: MEMBER_1,
  originalRecordType: 'treatment',
  originalRecordId: RECORD_ID_1,
  reason: 'Correcting documentation error',
  content: 'Treatment was performed on upper left quadrant, not lower left.',
};

describe('AmendmentRepository', () => {
  let repo: AmendmentRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    repo = new AmendmentRepository(db);
    await seedClinicalChain(db, { visits: 2 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  describe('create', () => {
    test('creates an amendment with all required fields', async () => {
      const amend = await repo.createOne(baseAmendment);
      expect(amend.id).toBeTruthy();
      expect(amend.reason).toBe('Correcting documentation error');
      expect(amend.content).toBe('Treatment was performed on upper left quadrant, not lower left.');
      expect(amend.originalRecordType).toBe('treatment');
      expect(amend.originalRecordId).toBe(RECORD_ID_1);
    });

    test('can create multiple amendments for the same original record (additive)', async () => {
      const a1 = await repo.createOne(baseAmendment);
      const a2 = await repo.createOne({ ...baseAmendment, content: 'Additional clarification.' });
      expect(a1.id).not.toBe(a2.id);
    });

    test('can amend different record types', async () => {
      for (const originalRecordType of ['treatment', 'prescription', 'visitNotes']) {
        const amend = await repo.createOne({ ...baseAmendment, originalRecordType });
        expect(amend.originalRecordType).toBe(originalRecordType);
      }
    });
  });

  describe('findMany', () => {
    test('filters by visitId', async () => {
      await repo.createOne(baseAmendment);
      await repo.createOne({ ...baseAmendment, visitId: VISIT_2 });
      const results = await repo.findMany({ visitId: VISIT_1 });
      expect(results).toHaveLength(1);
    });

    test('filters by originalRecordId', async () => {
      await repo.createOne(baseAmendment);
      const other = 'e6000000-0000-4000-8000-000000000031';
      await repo.createOne({ ...baseAmendment, originalRecordId: other });
      const results = await repo.findMany({ originalRecordId: RECORD_ID_1 });
      expect(results).toHaveLength(1);
    });
  });

  describe('findOneById', () => {
    test('returns amendment by id', async () => {
      const amend = await repo.createOne(baseAmendment);
      const found = await repo.findOneById(amend.id);
      expect(found!.id).toBe(amend.id);
    });

    test('returns null for unknown id', async () => {
      const found = await repo.findOneById('00000000-0000-4000-8000-000000000000');
      expect(found).toBeNull();
    });
  });
});
