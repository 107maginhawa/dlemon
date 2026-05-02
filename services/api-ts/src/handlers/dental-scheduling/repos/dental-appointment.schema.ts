/**
 * Drizzle schema for dental appointments
 *
 * Appointment lifecycle: scheduled -> checkedIn -> completed | cancelled | noShow
 * No-show is reversible (can revert to completed).
 */

import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'checkedIn',
  'completed',
  'cancelled',
  'noShow',
]);

export const dentalAppointments = pgTable('dental_appointment', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull(),
  dentistMemberId: uuid('dentist_member_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  procedureType: text('procedure_type').notNull(),
  operatoryId: uuid('operatory_id'),
  walkIn: boolean('walk_in').notNull().default(false),
  status: appointmentStatusEnum('status').notNull().default('scheduled'),
  checkInTime: timestamp('check_in_time', { withTimezone: true }),
  visitId: uuid('visit_id'),
  notes: text('notes'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
  noShowAt: timestamp('no_show_at', { withTimezone: true }),
}, (table) => ({
  branchIdx: index('dental_appointment_branch_id_idx').on(table.branchId),
  dentistIdx: index('dental_appointment_dentist_member_id_idx').on(table.dentistMemberId),
  patientIdx: index('dental_appointment_patient_id_idx').on(table.patientId),
  scheduledAtIdx: index('dental_appointment_scheduled_at_idx').on(table.scheduledAt),
}));

export type DentalAppointment = typeof dentalAppointments.$inferSelect;
export type NewDentalAppointment = typeof dentalAppointments.$inferInsert;

export const VALID_APPOINTMENT_STATUSES = ['scheduled', 'checkedIn', 'completed', 'cancelled', 'noShow'] as const;
export type AppointmentStatus = typeof VALID_APPOINTMENT_STATUSES[number];
