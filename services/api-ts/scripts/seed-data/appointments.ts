/**
 * Seed: Dental appointments — past completed, 1 cancelled, 5 upcoming
 */
import type { DatabaseInstance } from './types';
import { dentalAppointments } from '@/handlers/dental-scheduling/repos/dental-appointment.schema';
import {
  BRANCH_ID, DR_REYES_MEMBERSHIP_ID,
  PATIENT_JUAN_ID, PATIENT_ROSA_ID, PATIENT_CARLOS_ID, PATIENT_LIZA_ID, PATIENT_BEN_ID,
  VISIT_01, VISIT_02, VISIT_03, VISIT_04, VISIT_05, VISIT_06, VISIT_07,
  VISIT_08, VISIT_09, VISIT_10,
  APPT_01, APPT_02, APPT_03, APPT_04, APPT_05, APPT_06, APPT_07,
  APPT_08, APPT_09, APPT_10, APPT_11, APPT_12, APPT_13, APPT_14, APPT_15, APPT_16,
} from './ids';

/** Manila timezone offset helper — timestamps stored as UTC */
function manilaDate(isoDate: string, hour = 9): Date {
  // Manila is UTC+8; store as UTC
  return new Date(`${isoDate}T${String(hour).padStart(2, '0')}:00:00+08:00`);
}

export async function seedAppointments(db: DatabaseInstance): Promise<void> {
  console.log('   Seeding appointments...');

  await db.insert(dentalAppointments).values([
    // ── Past completed (tied to visits) ──────────────────────────────
    // Juan V1: 2026-03-10 cleaning
    {
      id: APPT_01,
      patientId: PATIENT_JUAN_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-03-10', 9),
      durationMinutes: 45,
      serviceType: 'Oral Prophylaxis',
      status: 'completed',
      visitId: VISIT_01,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Juan V2: 2026-04-21 filling
    {
      id: APPT_02,
      patientId: PATIENT_JUAN_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-04-21', 10),
      durationMinutes: 60,
      serviceType: 'Composite Filling',
      status: 'completed',
      visitId: VISIT_02,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa V1: 2026-02-28 exam
    {
      id: APPT_03,
      patientId: PATIENT_ROSA_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-02-28', 14),
      durationMinutes: 60,
      serviceType: 'Comprehensive Exam + Panoramic',
      status: 'completed',
      visitId: VISIT_03,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa V2: 2026-03-31 root canal
    {
      id: APPT_04,
      patientId: PATIENT_ROSA_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-03-31', 9),
      durationMinutes: 90,
      serviceType: 'Root Canal (Molar)',
      status: 'completed',
      visitId: VISIT_04,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Carlos V1: 2026-03-05 exam + cleaning
    {
      id: APPT_05,
      patientId: PATIENT_CARLOS_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-03-05', 11),
      durationMinutes: 60,
      serviceType: 'Exam + Oral Prophylaxis',
      status: 'completed',
      visitId: VISIT_05,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Carlos V2: 2026-04-07 crown prep
    {
      id: APPT_06,
      patientId: PATIENT_CARLOS_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-04-07', 9),
      durationMinutes: 90,
      serviceType: 'Crown Preparation',
      status: 'completed',
      visitId: VISIT_06,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Liza V1: 2026-04-14 cleaning
    {
      id: APPT_07,
      patientId: PATIENT_LIZA_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-04-14', 15),
      durationMinutes: 45,
      serviceType: 'Oral Prophylaxis',
      status: 'completed',
      visitId: VISIT_07,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben V1: 2026-03-03 exam
    {
      id: APPT_08,
      patientId: PATIENT_BEN_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-03-03', 10),
      durationMinutes: 60,
      serviceType: 'Comprehensive Exam + Panoramic',
      status: 'completed',
      visitId: VISIT_08,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben V2: 2026-04-21 extraction
    {
      id: APPT_09,
      patientId: PATIENT_BEN_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-04-21', 14),
      durationMinutes: 60,
      serviceType: 'Surgical Extraction',
      status: 'completed',
      visitId: VISIT_09,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben V3: 2026-05-05 denture impression
    {
      id: APPT_10,
      patientId: PATIENT_BEN_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-05-05', 9),
      durationMinutes: 60,
      serviceType: 'Denture Impression',
      status: 'completed',
      visitId: VISIT_10,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },

    // ── Cancelled (no-show) ──────────────────────────────────────────
    // Rosa no-show 2026-03-15
    {
      id: APPT_11,
      patientId: PATIENT_ROSA_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-03-15', 10),
      durationMinutes: 30,
      serviceType: 'Follow-up',
      status: 'no_show',
      noShowAt: manilaDate('2026-03-15', 10),
      notes: 'Patient did not show up for scheduled follow-up.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },

    // ── Upcoming scheduled ───────────────────────────────────────────
    // Juan — follow-up 2026-05-14
    {
      id: APPT_12,
      patientId: PATIENT_JUAN_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-05-14', 9),
      durationMinutes: 30,
      serviceType: 'Follow-up',
      status: 'scheduled',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa — root canal continuation 2026-05-15
    {
      id: APPT_13,
      patientId: PATIENT_ROSA_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-05-15', 9),
      durationMinutes: 90,
      serviceType: 'Root Canal — continuation',
      status: 'scheduled',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Carlos — crown fitting 2026-05-16
    {
      id: APPT_14,
      patientId: PATIENT_CARLOS_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-05-16', 10),
      durationMinutes: 60,
      serviceType: 'Crown Fitting',
      status: 'scheduled',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Liza — 6-month recall 2026-05-20
    {
      id: APPT_15,
      patientId: PATIENT_LIZA_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-05-20', 14),
      durationMinutes: 45,
      serviceType: 'Oral Prophylaxis',
      status: 'scheduled',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben — denture fitting 2026-05-22
    {
      id: APPT_16,
      patientId: PATIENT_BEN_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      branchId: BRANCH_ID,
      scheduledAt: manilaDate('2026-05-22', 9),
      durationMinutes: 60,
      serviceType: 'Denture Fitting',
      status: 'scheduled',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
  ]).onConflictDoNothing();

  console.log('   ✅ 16 appointments (10 completed, 1 no-show, 5 upcoming)');
}
