/**
 * Drizzle schema for prescriptions (RxNorm coded)
 *
 * Status FSM (EM-CLI-012):
 *   pending → dispensed (terminal)
 *   pending → cancelled (terminal)
 */

import { pgTable, uuid, text, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';

export const prescriptionStatusEnum = pgEnum('prescription_status', [
  'pending',
  'dispensed',
  'cancelled',
]);

/**
 * P2-13: DEA controlled-substance schedule (21 CFR 1308).
 * `none` is the default for non-controlled drugs (incl. the ₱/PH flow).
 * II–V follow the US DEA classification. Record-only; EPCS is out of scope.
 */
export const controlledSubstanceScheduleEnum = pgEnum('controlled_substance_schedule', [
  'none',
  'II',
  'III',
  'IV',
  'V',
]);

export const prescriptions = pgTable('prescription', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  prescriberMemberId: uuid('prescriber_member_id').notNull().references(() => dentalMemberships.id),
  rxNormCode: text('rx_norm_code'),
  drugName: text('drug_name').notNull(),
  dosage: text('dosage').notNull(),
  frequency: text('frequency').notNull(),
  duration: text('duration'),
  quantity: text('quantity'),
  instructions: text('instructions'),
  dispenseAsWritten: boolean('dispense_as_written').notNull().default(false),
  status: prescriptionStatusEnum('status').notNull().default('pending'),
  // P2-13: US-context legal Rx fields (record-only; EPCS out of scope).
  // Additive + nullable/defaulted so the non-controlled ₱/PH flow is unaffected.
  controlledSubstanceSchedule: controlledSubstanceScheduleEnum('controlled_substance_schedule')
    .notNull()
    .default('none'),
  prescriberDea: text('prescriber_dea'),
  prescriberNpi: text('prescriber_npi'),
});

export type Prescription = typeof prescriptions.$inferSelect;
export type NewPrescription = typeof prescriptions.$inferInsert;

export const VALID_PRESCRIPTION_STATUSES = ['pending', 'dispensed', 'cancelled'] as const;
export type PrescriptionStatus = typeof VALID_PRESCRIPTION_STATUSES[number];

export const CONTROLLED_SUBSTANCE_SCHEDULES = ['none', 'II', 'III', 'IV', 'V'] as const;
export type ControlledSubstanceSchedule = typeof CONTROLLED_SUBSTANCE_SCHEDULES[number];

/** Valid forward-only transitions. dispensed and cancelled are terminal. */
export const PRESCRIPTION_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  pending: ['dispensed', 'cancelled'],
  dispensed: [],  // terminal
  cancelled: [],  // terminal
};
