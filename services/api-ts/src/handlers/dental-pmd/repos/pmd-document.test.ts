/**
 * PMDDocumentRepository tests
 *
 * Key behaviors:
 * - PMDs are immutable after creation (no arbitrary updates)
 * - sign() transitions generated → signed
 * - supersede() marks old as superseded, creates new with supersedesId
 * - Only completedvisits should generate PMDs (enforced at handler level)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { PMDDocumentRepository } from './pmd-document.repo';
import { ImportedPMDRepository } from './imported-pmd.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';

const VISIT_1   = CHAIN_IDS.VISIT_1;
const VISIT_2   = CHAIN_IDS.VISIT_2;
const PATIENT_1 = CHAIN_IDS.PATIENT_1;
const MEMBER_1  = CHAIN_IDS.MEMBERSHIP_1;
const BRANCH_1  = CHAIN_IDS.BRANCH_1;

const basePMD = {
  visitId: VISIT_1,
  patientId: PATIENT_1,
  authorMemberId: MEMBER_1,
  branchId: BRANCH_1,
  content: JSON.stringify({ teeth: [], treatments: [], prescriptions: [] }),
  checksum: 'abc123checksum',
};

describe('PMDDocumentRepository', () => {
  let repo: PMDDocumentRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db, rollback } = await openTestTx();
    repo = new PMDDocumentRepository(db);
    await seedClinicalChain(db, { patients: 3, visits: 2 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  describe('create', () => {
    test('creates a PMD in generated status', async () => {
      const pmd = await repo.createOne(basePMD);
      expect(pmd.id).toBeTruthy();
      expect(pmd.status).toBe('generated');
      expect(pmd.signature).toBeNull();
      expect(pmd.signedAt).toBeNull();
    });

    test('stores content JSON and checksum', async () => {
      const pmd = await repo.createOne(basePMD);
      expect(pmd.content).toBe(basePMD.content);
      expect(pmd.checksum).toBe('abc123checksum');
    });

    test('supersedesId is null by default', async () => {
      const pmd = await repo.createOne(basePMD);
      expect(pmd.supersedesId).toBeNull();
    });
  });

  describe('sign', () => {
    test('transitions generated → signed and records signedAt', async () => {
      const pmd = await repo.createOne(basePMD);
      const signed = await repo.sign(pmd.id, 'base64signaturedata==');
      expect(signed!.status).toBe('signed');
      expect(signed!.signature).toBe('base64signaturedata==');
      expect(signed!.signedAt).toBeInstanceOf(Date);
    });

    test('cannot sign an already-signed PMD (returns null)', async () => {
      const pmd = await repo.createOne(basePMD);
      await repo.sign(pmd.id, 'first-sig');
      const reSigned = await repo.sign(pmd.id, 'second-sig');
      expect(reSigned).toBeNull();
    });

    test('original signature preserved after failed re-sign', async () => {
      const pmd = await repo.createOne(basePMD);
      await repo.sign(pmd.id, 'original-sig');
      await repo.sign(pmd.id, 'new-sig');
      const found = await repo.findOneById(pmd.id);
      expect(found!.signature).toBe('original-sig');
    });
  });

  describe('supersede', () => {
    test('marks old PMD as superseded and creates new with supersedesId', async () => {
      const old = await repo.createOne(basePMD);
      const newPMD = await repo.supersede(old.id, {
        ...basePMD,
        visitId: VISIT_2,
        content: JSON.stringify({ teeth: [{ toothNumber: 21 }], treatments: [], prescriptions: [] }),
        checksum: 'newchecksum',
      });

      // Old should be superseded
      const foundOld = await repo.findOneById(old.id);
      expect(foundOld!.status).toBe('superseded');

      // New should link to old
      expect(newPMD.supersedesId).toBe(old.id);
      expect(newPMD.status).toBe('generated');
    });
  });

  describe('findByVisit', () => {
    test('returns the generated PMD for a visit', async () => {
      const pmd = await repo.createOne(basePMD);
      const found = await repo.findByVisit(VISIT_1);
      expect(found!.id).toBe(pmd.id);
    });

    test('returns null if no PMD for visit', async () => {
      const found = await repo.findByVisit('00000000-0000-4000-8000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findMany', () => {
    test('filters by patientId', async () => {
      await repo.createOne(basePMD);
      await repo.createOne({ ...basePMD, patientId: CHAIN_IDS.PATIENT_3, visitId: VISIT_2 });
      const results = await repo.findMany({ patientId: PATIENT_1 });
      expect(results).toHaveLength(1);
    });

    test('filters by status', async () => {
      const pmd = await repo.createOne(basePMD);
      await repo.sign(pmd.id, 'sig');
      const signed = await repo.findMany({ status: 'signed' });
      expect(signed.length).toBeGreaterThan(0);
    });
  });
});

describe('ImportedPMDRepository', () => {
  let repo: ImportedPMDRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db, rollback } = await openTestTx();
    repo = new ImportedPMDRepository(db);
    await seedClinicalChain(db, { patients: 3, visits: 0, memberships: 0, branches: 1 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  const baseImport = {
    patientId: PATIENT_1,
    sourceFacility: 'City Dental Clinic',
    content: JSON.stringify({ conditions: ['I10'], medications: ['Amoxicillin'] }),
  };

  describe('create', () => {
    test('creates an imported PMD', async () => {
      const rec = await repo.createOne(baseImport);
      expect(rec.id).toBeTruthy();
      expect(rec.sourceFacility).toBe('City Dental Clinic');
      expect(rec.safetyFloorMerged).toBe('false');
      expect(rec.importedAt).toBeInstanceOf(Date);
    });

    test('stores optional sourceReference', async () => {
      const rec = await repo.createOne({ ...baseImport, sourceReference: 'REF-2025-001' });
      expect(rec.sourceReference).toBe('REF-2025-001');
    });
  });

  describe('markSafetyFloorMerged', () => {
    test('marks safety floor as merged', async () => {
      const rec = await repo.createOne(baseImport);
      const updated = await repo.markSafetyFloorMerged(rec.id);
      expect(updated!.safetyFloorMerged).toBe('true');
    });

    test('returns null for unknown id', async () => {
      const result = await repo.markSafetyFloorMerged('00000000-0000-4000-8000-000000000000');
      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    test('filters by patientId', async () => {
      await repo.createOne(baseImport);
      await repo.createOne({ ...baseImport, patientId: CHAIN_IDS.PATIENT_3 });
      const results = await repo.findMany({ patientId: PATIENT_1 });
      expect(results).toHaveLength(1);
    });

    test('filters unmerged safety floor records', async () => {
      const r1 = await repo.createOne(baseImport);
      const r2 = await repo.createOne(baseImport);
      await repo.markSafetyFloorMerged(r1.id);
      const unmerged = await repo.findMany({ patientId: PATIENT_1, safetyFloorMerged: false });
      expect(unmerged).toHaveLength(1);
      expect(unmerged[0]!.id).toBe(r2.id);
    });
  });
});
