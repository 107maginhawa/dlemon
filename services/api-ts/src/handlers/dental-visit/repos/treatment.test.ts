/**
 * TreatmentRepository tests
 *
 * Tests treatment lifecycle: diagnosed → planned → performed → verified → dismissed
 * EC2: extracted tooth auto-dismisses open treatments
 * EC4: price locked at recording time
 *
 * Written RED — no implementation exists yet.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { TreatmentRepository } from './treatment.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';

const VISIT_1   = CHAIN_IDS.VISIT_1;
const VISIT_2   = CHAIN_IDS.VISIT_2;
const PATIENT_1 = CHAIN_IDS.PATIENT_1;

describe('TreatmentRepository', () => {
  let repo: TreatmentRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db, rollback } = await openTestTx();
    repo = new TreatmentRepository(db);
    await seedClinicalChain(db, { visits: 2 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  describe('create', () => {
    test('creates treatment with diagnosed status by default', async () => {
      const treatment = await repo.createOne({
        visitId: VISIT_1,
        patientId: PATIENT_1,
        cdtCode: 'D0150',
        description: 'Comprehensive oral evaluation',
        priceCents: 8500,
        carriedOver: false,
      });

      expect(treatment.id).toBeTruthy();
      expect(treatment.status).toBe('diagnosed');
      expect(treatment.cdtCode).toBe('D0150');
      expect(treatment.priceCents).toBe(8500);
      expect(treatment.carriedOver).toBe(false);
    });

    test('stores optional toothNumber and surfaces', async () => {
      const treatment = await repo.createOne({
        visitId: VISIT_1,
        patientId: PATIENT_1,
        cdtCode: 'D2391',
        description: 'Resin composite, one surface',
        toothNumber: 36,
        surfaces: ['occlusal'],
        priceCents: 15000,
        carriedOver: false,
      });

      expect(treatment.toothNumber).toBe(36);
      expect(treatment.surfaces).toEqual(['occlusal']);
    });

    test('EC4: price is stored and not altered after creation', async () => {
      const treatment = await repo.createOne({
        visitId: VISIT_1,
        patientId: PATIENT_1,
        cdtCode: 'D2740',
        description: 'Crown, porcelain',
        priceCents: 120000,
        carriedOver: false,
      });

      expect(treatment.priceCents).toBe(120000);
      // Price is not recalculated from any external source after creation
    });
  });

  // --------------------------------------------------------------------------
  // STATUS TRANSITIONS
  // --------------------------------------------------------------------------

  describe('status transitions', () => {
    test('transitions diagnosed → planned', async () => {
      const t = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1,
        cdtCode: 'D2391', description: 'Resin', priceCents: 10000, carriedOver: false,
      });

      const updated = await repo.updateStatus(t.id, 'planned');
      expect(updated!.status).toBe('planned');
    });

    test('transitions planned → performed', async () => {
      const t = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1,
        cdtCode: 'D2391', description: 'Resin', priceCents: 10000, carriedOver: false,
      });
      await repo.updateStatus(t.id, 'planned');
      const updated = await repo.updateStatus(t.id, 'performed');
      expect(updated!.status).toBe('performed');
    });

    test('transitions performed → verified', async () => {
      const t = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1,
        cdtCode: 'D2391', description: 'Resin', priceCents: 10000, carriedOver: false,
      });
      await repo.updateStatus(t.id, 'planned');
      await repo.updateStatus(t.id, 'performed');
      const updated = await repo.updateStatus(t.id, 'verified');
      expect(updated!.status).toBe('verified');
    });

    test('dismisses with reason', async () => {
      const t = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1,
        cdtCode: 'D2391', description: 'Resin', priceCents: 10000, carriedOver: false,
      });

      const dismissed = await repo.dismiss(t.id, 'Patient declined treatment');
      expect(dismissed!.status).toBe('dismissed');
      expect(dismissed!.dismissReason).toBe('Patient declined treatment');
    });
  });

  // --------------------------------------------------------------------------
  // EC2: EXTRACTED TOOTH AUTO-DISMISS
  // --------------------------------------------------------------------------

  describe('EC2 — extracted tooth auto-dismisses open treatments', () => {
    test('autoDismissByTooth marks non-verified treatments as dismissed', async () => {
      const t1 = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1,
        cdtCode: 'D2391', description: 'Resin on #36', toothNumber: 36,
        priceCents: 10000, carriedOver: false,
      });
      const t2 = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1,
        cdtCode: 'D2740', description: 'Crown on #36', toothNumber: 36,
        priceCents: 120000, carriedOver: false,
      });
      // t2 is planned
      await repo.updateStatus(t2.id, 'planned');

      await repo.autoDismissByTooth(PATIENT_1, 36);

      const result1 = await repo.findOneById(t1.id);
      const result2 = await repo.findOneById(t2.id);

      expect(result1!.status).toBe('dismissed');
      expect(result1!.autoDismissed).toBe(true);
      expect(result2!.status).toBe('dismissed');
      expect(result2!.autoDismissed).toBe(true);
    });

    test('autoDismissByTooth does not affect verified treatments', async () => {
      const t = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1,
        cdtCode: 'D2391', description: 'Resin', toothNumber: 36,
        priceCents: 10000, carriedOver: false,
      });
      await repo.updateStatus(t.id, 'planned');
      await repo.updateStatus(t.id, 'performed');
      await repo.updateStatus(t.id, 'verified');

      await repo.autoDismissByTooth(PATIENT_1, 36);

      const result = await repo.findOneById(t.id);
      expect(result!.status).toBe('verified');
      expect(result!.autoDismissed).toBe(false);
    });

    test('autoDismissByTooth does not affect treatments on other teeth', async () => {
      const t = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1,
        cdtCode: 'D2391', description: 'Resin on #11', toothNumber: 11,
        priceCents: 10000, carriedOver: false,
      });

      await repo.autoDismissByTooth(PATIENT_1, 36);

      const result = await repo.findOneById(t.id);
      expect(result!.status).toBe('diagnosed');
    });
  });

  // --------------------------------------------------------------------------
  // CARRY-OVER
  // --------------------------------------------------------------------------

  describe('carry-over from past visits', () => {
    test('createCarryOver creates treatment with carriedOver=true and sourceVisitId', async () => {
      const carried = await repo.createCarryOver({
        sourceVisitId: VISIT_1,
        targetVisitId: VISIT_2,
        patientId: PATIENT_1,
        cdtCode: 'D2740',
        description: 'Crown planned',
        toothNumber: 36,
        priceCents: 120000,
      });

      expect(carried.carriedOver).toBe(true);
      expect(carried.sourceVisitId).toBe(VISIT_1);
      expect(carried.visitId).toBe(VISIT_2);
      expect(carried.status).toBe('planned');
    });
  });

  // --------------------------------------------------------------------------
  // QUERIES
  // --------------------------------------------------------------------------

  describe('queries', () => {
    test('findByVisit returns all treatments for a visit', async () => {
      await repo.createOne({ visitId: VISIT_1, patientId: PATIENT_1, cdtCode: 'D0150', description: 'Eval', priceCents: 8500, carriedOver: false });
      await repo.createOne({ visitId: VISIT_1, patientId: PATIENT_1, cdtCode: 'D2391', description: 'Resin', priceCents: 10000, carriedOver: false });
      await repo.createOne({ visitId: VISIT_2, patientId: PATIENT_1, cdtCode: 'D2740', description: 'Crown', priceCents: 120000, carriedOver: false });

      const treatments = await repo.findByVisit(VISIT_1);
      expect(treatments).toHaveLength(2);
      for (const t of treatments) {
        expect(t.visitId).toBe(VISIT_1);
      }
    });

    test('findOneById returns null for unknown id', async () => {
      const result = await repo.findOneById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });
});
