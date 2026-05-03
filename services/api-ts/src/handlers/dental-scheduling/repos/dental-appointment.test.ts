/**
 * DentalAppointmentRepository tests
 *
 * Key behaviors:
 * - Appointments default to 'scheduled' status
 * - checkIn: scheduled -> checkedIn + records checkInTime
 * - cancel: any -> cancelled + records cancelledAt + optional reason
 * - markNoShow: any -> noShow + records noShowAt
 * - revertNoShow: noShow -> completed (reversible per PRD)
 * - linkVisit: sets visitId on appointment
 * - findMany: filters by branchId, dentistMemberId, date, status
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { DentalAppointmentRepository } from './dental-appointment.repo';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const PATIENT_1  = 'a1000000-0000-4000-8000-000000000001';
const PATIENT_2  = 'a1000000-0000-4000-8000-000000000002';
const DENTIST_1  = 'a2000000-0000-4000-8000-000000000001';
const DENTIST_2  = 'a2000000-0000-4000-8000-000000000002';
const BRANCH_1   = 'a3000000-0000-4000-8000-000000000001';
const BRANCH_2   = 'a3000000-0000-4000-8000-000000000002';
const VISIT_1    = 'a4000000-0000-4000-8000-000000000001';

const baseAppointment = {
  patientId: PATIENT_1,
  dentistMemberId: DENTIST_1,
  branchId: BRANCH_1,
  scheduledAt: new Date('2025-06-01T09:00:00Z'),
  durationMinutes: 60,
  procedureType: 'Cleaning',
};

describe('DentalAppointmentRepository', () => {
  let repo: DentalAppointmentRepository;

  beforeEach(() => { repo = new DentalAppointmentRepository(db); });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_appointment CASCADE`);
  });

  // ===== CRUD =====

  describe('create', () => {
    test('creates appointment with scheduled status', async () => {
      const appt = await repo.createOne(baseAppointment);
      expect(appt.id).toBeTruthy();
      expect(appt.status).toBe('scheduled');
      expect(appt.walkIn).toBe(false);
      expect(appt.checkInTime).toBeNull();
      expect(appt.visitId).toBeNull();
      expect(appt.cancelledAt).toBeNull();
      expect(appt.noShowAt).toBeNull();
    });

    test('walk-in appointments have walkIn=true', async () => {
      const appt = await repo.createOne({ ...baseAppointment, walkIn: true });
      expect(appt.walkIn).toBe(true);
    });

    test('stores procedureType and durationMinutes', async () => {
      const appt = await repo.createOne(baseAppointment);
      expect(appt.procedureType).toBe('Cleaning');
      expect(appt.durationMinutes).toBe(60);
    });

    test('stores optional notes', async () => {
      const appt = await repo.createOne({ ...baseAppointment, notes: 'First visit' });
      expect(appt.notes).toBe('First visit');
    });

    test('stores optional operatoryId', async () => {
      const opId = 'a5000000-0000-4000-8000-000000000001';
      const appt = await repo.createOne({ ...baseAppointment, operatoryId: opId });
      expect(appt.operatoryId).toBe(opId);
    });
  });

  // ===== FIND =====

  describe('findMany', () => {
    test('returns all when no filters', async () => {
      await repo.createOne(baseAppointment);
      await repo.createOne({ ...baseAppointment, patientId: PATIENT_2 });
      const results = await repo.findMany();
      expect(results).toHaveLength(2);
    });

    test('finds appointments by branchId', async () => {
      await repo.createOne(baseAppointment);
      await repo.createOne({ ...baseAppointment, branchId: BRANCH_2 });
      const results = await repo.findMany({ branchId: BRANCH_1 });
      expect(results).toHaveLength(1);
      expect(results[0]!.branchId).toBe(BRANCH_1);
    });

    test('finds appointments by dentistMemberId', async () => {
      await repo.createOne(baseAppointment);
      await repo.createOne({ ...baseAppointment, dentistMemberId: DENTIST_2 });
      const results = await repo.findMany({ dentistMemberId: DENTIST_1 });
      expect(results).toHaveLength(1);
      expect(results[0]!.dentistMemberId).toBe(DENTIST_1);
    });

    test('finds appointments by date range', async () => {
      await repo.createOne(baseAppointment); // June 1
      await repo.createOne({ ...baseAppointment, scheduledAt: new Date('2025-06-02T14:00:00Z') });
      const results = await repo.findMany({ date: '2025-06-01' });
      expect(results).toHaveLength(1);
    });

    test('finds appointments by status', async () => {
      const appt = await repo.createOne(baseAppointment);
      await repo.checkIn(appt.id);
      await repo.createOne({ ...baseAppointment, patientId: PATIENT_2 });
      const results = await repo.findMany({ status: 'checkedIn' });
      expect(results).toHaveLength(1);
      expect(results[0]!.status).toBe('checkedIn');
    });
  });

  describe('findOneById', () => {
    test('returns appointment by id', async () => {
      const appt = await repo.createOne(baseAppointment);
      const found = await repo.findOneById(appt.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(appt.id);
    });

    test('returns null for missing appointment', async () => {
      const found = await repo.findOneById('00000000-0000-4000-8000-000000000000');
      expect(found).toBeNull();
    });
  });

  // ===== UPDATE =====

  describe('updateOneById', () => {
    test('updates appointment fields', async () => {
      const appt = await repo.createOne(baseAppointment);
      const updated = await repo.updateOneById(appt.id, {
        notes: 'Updated notes',
        procedureType: 'Extraction',
        durationMinutes: 90,
      });
      expect(updated.notes).toBe('Updated notes');
      expect(updated.procedureType).toBe('Extraction');
      expect(updated.durationMinutes).toBe(90);
    });
  });

  // ===== STATUS TRANSITIONS =====

  describe('checkIn', () => {
    test('sets status to checkedIn and records checkInTime', async () => {
      const appt = await repo.createOne(baseAppointment);
      const checkedIn = await repo.checkIn(appt.id);
      expect(checkedIn).not.toBeNull();
      expect(checkedIn!.status).toBe('checkedIn');
      expect(checkedIn!.checkInTime).toBeInstanceOf(Date);
    });

    test('returns null if appointment is not in scheduled status', async () => {
      const appt = await repo.createOne(baseAppointment);
      await repo.checkIn(appt.id); // now checkedIn
      const result = await repo.checkIn(appt.id); // try again
      expect(result).toBeNull();
    });
  });

  describe('cancel', () => {
    test('sets status to cancelled and records cancelledAt', async () => {
      const appt = await repo.createOne(baseAppointment);
      const cancelled = await repo.cancel(appt.id);
      expect(cancelled).not.toBeNull();
      expect(cancelled!.status).toBe('cancelled');
      expect(cancelled!.cancelledAt).toBeInstanceOf(Date);
    });

    test('cancel with reason stores cancellation reason', async () => {
      const appt = await repo.createOne(baseAppointment);
      const cancelled = await repo.cancel(appt.id, 'Patient requested');
      expect(cancelled!.cancellationReason).toBe('Patient requested');
    });
  });

  describe('markNoShow', () => {
    test('sets status to noShow and records noShowAt', async () => {
      const appt = await repo.createOne(baseAppointment);
      const noShow = await repo.markNoShow(appt.id);
      expect(noShow).not.toBeNull();
      expect(noShow!.status).toBe('noShow');
      expect(noShow!.noShowAt).toBeInstanceOf(Date);
    });
  });

  describe('revertNoShow', () => {
    test('sets status to completed from noShow', async () => {
      const appt = await repo.createOne(baseAppointment);
      await repo.markNoShow(appt.id);
      const reverted = await repo.revertNoShow(appt.id);
      expect(reverted).not.toBeNull();
      expect(reverted!.status).toBe('completed');
      expect(reverted!.noShowAt).toBeNull();
    });

    test('returns null if not in noShow status', async () => {
      const appt = await repo.createOne(baseAppointment);
      const result = await repo.revertNoShow(appt.id);
      expect(result).toBeNull();
    });
  });

  describe('linkVisit', () => {
    test('sets visitId on appointment', async () => {
      const appt = await repo.createOne(baseAppointment);
      const linked = await repo.linkVisit(appt.id, VISIT_1);
      expect(linked).not.toBeNull();
      expect(linked!.visitId).toBe(VISIT_1);
    });
  });

  // ===== STATUS GUARDS =====

  describe('cancel status guard', () => {
    test('returns null when cancelling a completed appointment', async () => {
      const appt = await repo.createOne(baseAppointment);
      // Force to completed via raw SQL (no handler path for this in test)
      await db.execute(sql`UPDATE dental_appointment SET status = 'completed' WHERE id = ${appt.id}`);
      const result = await repo.cancel(appt.id);
      expect(result).toBeNull();

      // Verify status unchanged
      const current = await repo.findOneById(appt.id);
      expect(current!.status).toBe('completed');
    });

    test('allows cancelling a scheduled appointment', async () => {
      const appt = await repo.createOne(baseAppointment);
      const result = await repo.cancel(appt.id);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('cancelled');
    });

    test('allows cancelling a checkedIn appointment', async () => {
      const appt = await repo.createOne(baseAppointment);
      await repo.checkIn(appt.id);
      const result = await repo.cancel(appt.id);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('cancelled');
    });
  });

  describe('markNoShow status guard', () => {
    test('returns null when marking a cancelled appointment as noShow', async () => {
      const appt = await repo.createOne(baseAppointment);
      await repo.cancel(appt.id);
      const result = await repo.markNoShow(appt.id);
      expect(result).toBeNull();

      // Verify still cancelled
      const current = await repo.findOneById(appt.id);
      expect(current!.status).toBe('cancelled');
    });

    test('allows markNoShow on a scheduled appointment', async () => {
      const appt = await repo.createOne(baseAppointment);
      const result = await repo.markNoShow(appt.id);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('noShow');
    });
  });

  // ===== OVERLAP DETECTION =====

  describe('findOverlapping', () => {
    test('detects overlap for appointments 15 minutes apart (same dentist/branch)', async () => {
      // Appointment 1: 09:00 - 09:30 (30 min)
      const appt1Start = new Date('2025-07-01T09:00:00Z');
      await repo.createOne({ ...baseAppointment, scheduledAt: appt1Start, durationMinutes: 30 });

      // Appointment 2: 09:15 - 09:45 — overlaps with appt1
      const appt2Start = new Date('2025-07-01T09:15:00Z');
      const overlaps = await repo.findOverlapping(DENTIST_1, BRANCH_1, appt2Start, 30);
      expect(overlaps.length).toBeGreaterThan(0);
    });

    test('no overlap for appointments 2.5 hours apart', async () => {
      // Appointment 1: 09:00 - 09:30
      const appt1Start = new Date('2025-07-01T09:00:00Z');
      await repo.createOne({ ...baseAppointment, scheduledAt: appt1Start, durationMinutes: 30 });

      // Appointment 2: 11:31 - 12:01 — no overlap
      const appt2Start = new Date('2025-07-01T11:31:00Z');
      const overlaps = await repo.findOverlapping(DENTIST_1, BRANCH_1, appt2Start, 30);
      expect(overlaps.length).toBe(0);
    });

    test('detects overlap for long appointments that would have been missed by 2h heuristic', async () => {
      // Appointment 1: 09:00 - 11:30 (150 min)
      const appt1Start = new Date('2025-07-01T09:00:00Z');
      await repo.createOne({ ...baseAppointment, scheduledAt: appt1Start, durationMinutes: 150 });

      // Appointment 2: 11:00 - 11:30 — within the 150min window, was missed by 2h heuristic
      const appt2Start = new Date('2025-07-01T11:00:00Z');
      const overlaps = await repo.findOverlapping(DENTIST_1, BRANCH_1, appt2Start, 30);
      expect(overlaps.length).toBeGreaterThan(0);
    });

    test('no overlap when different dentist', async () => {
      const appt1Start = new Date('2025-07-01T09:00:00Z');
      await repo.createOne({ ...baseAppointment, scheduledAt: appt1Start, durationMinutes: 30 });

      const overlaps = await repo.findOverlapping(DENTIST_2, BRANCH_1, appt1Start, 30);
      expect(overlaps.length).toBe(0);
    });
  });
});
