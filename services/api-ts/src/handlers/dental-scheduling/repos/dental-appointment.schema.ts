/**
 * Drizzle schema for dental appointments
 *
 * Appointment lifecycle: scheduled -> confirmed -> checked_in -> completed | cancelled | no_show
 * `confirmed` is an optional acknowledgement step (patient confirmed they will attend);
 * scheduled can still go straight to checked_in. No-show is reversible (can revert to completed).
 */

import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { dentalOperatories } from './operatory.schema';

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
]);

export const dentalAppointments = pgTable('dental_appointment', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  dentistMemberId: uuid('dentist_member_id').notNull().references(() => dentalMemberships.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  serviceType: text('service_type').notNull(),
  operatoryId: uuid('operatory_id').references(() => dentalOperatories.id, { onDelete: 'set null' }),
  walkIn: boolean('walk_in').notNull().default(false),
  status: appointmentStatusEnum('status').notNull().default('scheduled'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  checkInTime: timestamp('check_in_time', { withTimezone: true }),
  visitId: uuid('visit_id').references(() => dentalVisits.id),
  notes: text('notes'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
  noShowAt: timestamp('no_show_at', { withTimezone: true }),
  // Soft-archive marker for data-retention enforcement (V-DG-003). The retention
  // engine's archive action stamps this; it is NOT part of the status state
  // machine (a completed/cancelled appointment can still be archived). NULL = live.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  branchIdx: index('dental_appointment_branch_id_idx').on(table.branchId),
  dentistIdx: index('dental_appointment_dentist_member_id_idx').on(table.dentistMemberId),
  patientIdx: index('dental_appointment_patient_id_idx').on(table.patientId),
  scheduledAtIdx: index('dental_appointment_scheduled_at_idx').on(table.scheduledAt),
}));

export type DentalAppointment = typeof dentalAppointments.$inferSelect;
export type NewDentalAppointment = typeof dentalAppointments.$inferInsert;

export const VALID_APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'] as const;
export type AppointmentStatus = typeof VALID_APPOINTMENT_STATUSES[number];

/**
 * Valid state-machine transitions for appointments.
 * scheduled  → confirmed | checked_in | cancelled | no_show
 * confirmed  → checked_in | cancelled | no_show
 * checked_in → completed | cancelled | no_show
 * completed  → [] (terminal)
 * cancelled  → [] (terminal)
 * no_show    → completed (reversible)
 */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: ['completed'],
};
