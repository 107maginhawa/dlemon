/**
 * PrescriptionRepository tests
 *
 * Written RED — implementation follows.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { PrescriptionRepository } from './prescription.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';

const VISIT_1   = CHAIN_IDS.VISIT_1;
const VISIT_2   = CHAIN_IDS.VISIT_2;
const PATIENT_1 = CHAIN_IDS.PATIENT_1;
const MEMBER_1  = CHAIN_IDS.MEMBERSHIP_1;

const basePrescription = {
  visitId: VISIT_1,
  patientId: PATIENT_1,
  prescriberMemberId: MEMBER_1,
  drugName: 'Amoxicillin',
  dosage: '500mg',
  frequency: 'TID',
};

describe('PrescriptionRepository', () => {
  let repo: PrescriptionRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db, rollback } = await openTestTx();
    repo = new PrescriptionRepository(db);
    await seedClinicalChain(db, { visits: 2 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  describe('create', () => {
    test('creates a prescription with required fields', async () => {
      const rx = await repo.createOne(basePrescription);
      expect(rx.id).toBeTruthy();
      expect(rx.drugName).toBe('Amoxicillin');
      expect(rx.dosage).toBe('500mg');
      expect(rx.frequency).toBe('TID');
      expect(rx.dispenseAsWritten).toBe(false);
    });

    test('stores optional rxNormCode', async () => {
      const rx = await repo.createOne({ ...basePrescription, rxNormCode: '723' });
      expect(rx.rxNormCode).toBe('723');
    });

    test('stores optional duration, quantity, instructions', async () => {
      const rx = await repo.createOne({
        ...basePrescription,
        duration: '7 days',
        quantity: '21 tablets',
        instructions: 'Take with food',
      });
      expect(rx.duration).toBe('7 days');
      expect(rx.quantity).toBe('21 tablets');
      expect(rx.instructions).toBe('Take with food');
    });

    test('dispenseAsWritten defaults to false', async () => {
      const rx = await repo.createOne(basePrescription);
      expect(rx.dispenseAsWritten).toBe(false);
    });

    test('dispenseAsWritten can be set to true', async () => {
      const rx = await repo.createOne({ ...basePrescription, dispenseAsWritten: true });
      expect(rx.dispenseAsWritten).toBe(true);
    });
  });

  describe('findMany', () => {
    test('filters by visitId', async () => {
      await repo.createOne({ ...basePrescription, visitId: VISIT_1 });
      await repo.createOne({ ...basePrescription, visitId: VISIT_2 });

      const results = await repo.findMany({ visitId: VISIT_1 });
      expect(results).toHaveLength(1);
      expect(results[0]!.visitId).toBe(VISIT_1);
    });

    test('filters by patientId', async () => {
      await repo.createOne(basePrescription);
      const results = await repo.findMany({ patientId: PATIENT_1 });
      expect(results).toHaveLength(1);
    });

    test('returns empty array when no match', async () => {
      const results = await repo.findMany({ visitId: VISIT_2 });
      expect(results).toHaveLength(0);
    });
  });

  describe('update', () => {
    test('updates allowed fields', async () => {
      const rx = await repo.createOne(basePrescription);
      const updated = await repo.update(rx.id, { drugName: 'Ibuprofen', dosage: '200mg' });
      expect(updated!.drugName).toBe('Ibuprofen');
      expect(updated!.dosage).toBe('200mg');
    });

    test('returns null for unknown id', async () => {
      const updated = await repo.update('00000000-0000-4000-8000-000000000000', { drugName: 'X' });
      expect(updated).toBeNull();
    });

    test('does not mutate prescriberMemberId', async () => {
      const rx = await repo.createOne(basePrescription);
      await repo.update(rx.id, { drugName: 'Metronidazole' });
      const found = await repo.findOneById(rx.id);
      expect(found!.prescriberMemberId).toBe(MEMBER_1);
    });
  });

  describe('findOneById', () => {
    test('returns null for unknown id', async () => {
      const result = await repo.findOneById('00000000-0000-4000-8000-000000000000');
      expect(result).toBeNull();
    });

    test('returns prescription by id', async () => {
      const rx = await repo.createOne(basePrescription);
      const found = await repo.findOneById(rx.id);
      expect(found!.id).toBe(rx.id);
    });
  });
});
