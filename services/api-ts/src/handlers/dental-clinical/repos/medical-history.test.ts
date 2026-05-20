/**
 * MedicalHistoryRepository tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { MedicalHistoryRepository } from './medical-history.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';

const PATIENT_1 = CHAIN_IDS.PATIENT_1;
const PATIENT_2 = CHAIN_IDS.PATIENT_2;

const baseEntry = {
  patientId: PATIENT_1,
  entryType: 'condition' as const,
  displayName: 'Hypertension',
};

describe('MedicalHistoryRepository', () => {
  let repo: MedicalHistoryRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db, rollback } = await openTestTx();
    repo = new MedicalHistoryRepository(db);
    await seedClinicalChain(db, { branches: 1, memberships: 0, visits: 0 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  describe('create', () => {
    test('creates an active entry by default', async () => {
      const entry = await repo.createOne(baseEntry);
      expect(entry.id).toBeTruthy();
      expect(entry.active).toBe(true);
      expect(entry.entryType).toBe('condition');
      expect(entry.displayName).toBe('Hypertension');
    });

    test('stores optional ICD-10 coded fields', async () => {
      const entry = await repo.createOne({
        ...baseEntry,
        codeSystem: 'ICD-10',
        code: 'I10',
      });
      expect(entry.codeSystem).toBe('ICD-10');
      expect(entry.code).toBe('I10');
    });

    test('stores optional RxNorm coded medication', async () => {
      const entry = await repo.createOne({
        patientId: PATIENT_1,
        entryType: 'medication',
        displayName: 'Metformin',
        codeSystem: 'RxNorm',
        code: '860975',
      });
      expect(entry.entryType).toBe('medication');
      expect(entry.code).toBe('860975');
    });

    test('stores optional SNOMED CT procedure', async () => {
      const entry = await repo.createOne({
        patientId: PATIENT_1,
        entryType: 'procedure',
        displayName: 'Tooth extraction',
        codeSystem: 'SNOMED CT',
        code: '180523007',
      });
      expect(entry.codeSystem).toBe('SNOMED CT');
    });

    test('stores optional onset and resolved dates', async () => {
      const entry = await repo.createOne({
        ...baseEntry,
        onsetDate: '2020-01-01',
        resolvedDate: '2021-06-01',
      });
      expect(entry.onsetDate).toBe('2020-01-01');
      expect(entry.resolvedDate).toBe('2021-06-01');
    });

    test('accepts all entry types', async () => {
      const types = ['condition', 'medication', 'allergy', 'procedure', 'vaccination', 'family_history'] as const;
      for (const entryType of types) {
        const entry = await repo.createOne({ patientId: PATIENT_1, entryType, displayName: `Test ${entryType}` });
        expect(entry.entryType).toBe(entryType);
      }
    });
  });

  describe('update', () => {
    test('can mark an entry as resolved', async () => {
      const entry = await repo.createOne(baseEntry);
      const updated = await repo.update(entry.id, { resolvedDate: '2025-01-01', active: false });
      expect(updated!.resolvedDate).toBe('2025-01-01');
      expect(updated!.active).toBe(false);
    });

    test('can update displayName and notes', async () => {
      const entry = await repo.createOne(baseEntry);
      const updated = await repo.update(entry.id, { displayName: 'Essential Hypertension', notes: 'BP controlled' });
      expect(updated!.displayName).toBe('Essential Hypertension');
      expect(updated!.notes).toBe('BP controlled');
    });

    test('returns null for unknown id', async () => {
      const updated = await repo.update('00000000-0000-4000-8000-000000000000', { active: false });
      expect(updated).toBeNull();
    });
  });

  describe('findMany', () => {
    test('filters by patientId', async () => {
      await repo.createOne(baseEntry);
      await repo.createOne({ ...baseEntry, patientId: PATIENT_2 });
      const results = await repo.findMany({ patientId: PATIENT_1 });
      expect(results).toHaveLength(1);
    });

    test('filters active entries', async () => {
      const e1 = await repo.createOne(baseEntry);
      await repo.createOne({ ...baseEntry, displayName: 'Old condition' });
      await repo.update(e1.id, { active: false });

      const activeResults = await repo.findMany({ patientId: PATIENT_1, active: true });
      expect(activeResults).toHaveLength(1);
      expect(activeResults[0]!.displayName).toBe('Old condition');
    });

    test('filters by entryType', async () => {
      await repo.createOne(baseEntry); // condition
      await repo.createOne({ patientId: PATIENT_1, entryType: 'allergy', displayName: 'Penicillin allergy' });
      const allergies = await repo.findMany({ patientId: PATIENT_1, entryType: 'allergy' });
      expect(allergies).toHaveLength(1);
      expect(allergies[0]!.displayName).toBe('Penicillin allergy');
    });
  });
});
