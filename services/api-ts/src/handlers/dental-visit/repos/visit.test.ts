/**
 * VisitRepository tests
 *
 * Tests visit lifecycle: draft → active → completed → locked
 * EC7: only one active visit per patient at a time.
 *
 * Written RED — no implementation exists yet.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { VisitRepository } from './visit.repo';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const PATIENT_A = 'b0000000-0000-1000-8000-000000000001';
const PATIENT_B = 'b0000000-0000-1000-8000-000000000002';
const BRANCH_1  = 'c0000000-0000-1000-8000-000000000001';
const DENTIST_1 = 'd0000000-0000-1000-8000-000000000001';

describe('VisitRepository', () => {
  let repo: VisitRepository;

  beforeEach(() => {
    repo = new VisitRepository(db);
  });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_treatment, visit_notes, dental_chart, dental_visit CASCADE`);
  });

  // --------------------------------------------------------------------------
  // CREATE — draft
  // --------------------------------------------------------------------------

  describe('create', () => {
    test('creates a visit in draft status by default', async () => {
      const visit = await repo.createOne({
        patientId: PATIENT_A,
        branchId: BRANCH_1,
        dentistMemberId: DENTIST_1,
      });

      expect(visit.id).toBeTruthy();
      expect(visit.status).toBe('draft');
      expect(visit.patientId).toBe(PATIENT_A);
      expect(visit.branchId).toBe(BRANCH_1);
      expect(visit.activatedAt).toBeNull();
      expect(visit.completedAt).toBeNull();
      expect(visit.lockedAt).toBeNull();
    });

    test('stores optional chiefComplaint', async () => {
      const visit = await repo.createOne({
        patientId: PATIENT_A,
        branchId: BRANCH_1,
        dentistMemberId: DENTIST_1,
        chiefComplaint: 'Toothache upper left',
      });
      expect(visit.chiefComplaint).toBe('Toothache upper left');
    });

    test('assigns unique uuid per visit', async () => {
      const v1 = await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      const v2 = await repo.createOne({ patientId: PATIENT_B, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      expect(v1.id).not.toBe(v2.id);
    });
  });

  // --------------------------------------------------------------------------
  // STATUS TRANSITIONS
  // --------------------------------------------------------------------------

  describe('status transitions', () => {
    test('activate sets status to active and records activatedAt', async () => {
      const visit = await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      const activated = await repo.activate(visit.id);

      expect(activated!.status).toBe('active');
      expect(activated!.activatedAt).toBeInstanceOf(Date);
    });

    test('complete sets status to completed and records completedAt', async () => {
      const visit = await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      await repo.activate(visit.id);
      const completed = await repo.complete(visit.id);

      expect(completed!.status).toBe('completed');
      expect(completed!.completedAt).toBeInstanceOf(Date);
    });

    test('lock sets status to locked and records lockedAt', async () => {
      const visit = await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      await repo.activate(visit.id);
      await repo.complete(visit.id);
      const locked = await repo.lock(visit.id);

      expect(locked!.status).toBe('locked');
      expect(locked!.lockedAt).toBeInstanceOf(Date);
    });

    test('updateStatus updates chiefComplaint on patch', async () => {
      const visit = await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      const updated = await repo.updateStatus(visit.id, { chiefComplaint: 'Updated complaint' });
      expect(updated!.chiefComplaint).toBe('Updated complaint');
    });
  });

  // --------------------------------------------------------------------------
  // EC7: ONE ACTIVE VISIT PER PATIENT
  // --------------------------------------------------------------------------

  describe('EC7 — one active visit per patient', () => {
    test('allows two draft visits for same patient', async () => {
      const v1 = await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      const v2 = await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      expect(v1.status).toBe('draft');
      expect(v2.status).toBe('draft');
    });

    test('findActiveByPatient returns the active visit', async () => {
      const visit = await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      await repo.activate(visit.id);

      const active = await repo.findActiveByPatient(PATIENT_A);
      expect(active).not.toBeNull();
      expect(active!.id).toBe(visit.id);
    });

    test('findActiveByPatient returns null when no active visit', async () => {
      const active = await repo.findActiveByPatient(PATIENT_A);
      expect(active).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // QUERIES
  // --------------------------------------------------------------------------

  describe('queries', () => {
    test('findMany filters by patientId', async () => {
      await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      await repo.createOne({ patientId: PATIENT_B, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });

      const results = await repo.findMany({ patientId: PATIENT_A });
      expect(results).toHaveLength(1);
      expect(results[0]!.patientId).toBe(PATIENT_A);
    });

    test('findMany filters by branchId', async () => {
      const BRANCH_2 = 'c0000000-0000-1000-8000-000000000002';
      await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      await repo.createOne({ patientId: PATIENT_B, branchId: BRANCH_2, dentistMemberId: DENTIST_1 });

      const results = await repo.findMany({ branchId: BRANCH_1 });
      expect(results).toHaveLength(1);
      expect(results[0]!.branchId).toBe(BRANCH_1);
    });

    test('findMany filters by status', async () => {
      const v1 = await repo.createOne({ patientId: PATIENT_A, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      const v2 = await repo.createOne({ patientId: PATIENT_B, branchId: BRANCH_1, dentistMemberId: DENTIST_1 });
      await repo.activate(v1.id);

      const active = await repo.findMany({ status: 'active' });
      expect(active).toHaveLength(1);
      expect(active[0]!.id).toBe(v1.id);
    });

    test('findOneById returns null for unknown id', async () => {
      const result = await repo.findOneById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });
});
