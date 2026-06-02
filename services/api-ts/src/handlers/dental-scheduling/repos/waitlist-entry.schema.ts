/**
 * Drizzle schema for the scheduling waitlist (ASAP fill).
 *
 * A waitlist entry records a patient who wants an earlier / short-notice slot
 * at a branch (optionally with a preferred provider and visit type). When a
 * short-notice cancellation opens a slot, an `active` entry can be promoted —
 * which links the resulting appointment and marks the entry `scheduled`.
 *
 * Lifecycle: active → scheduled | cancelled  (both terminal).
 */

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';
import { dentalAppointments } from './dental-appointment.schema';

export const WAITLIST_ENTRY_STATUSES = ['active', 'scheduled', 'cancelled'] as const;
export type WaitlistEntryStatus = typeof WAITLIST_ENTRY_STATUSES[number];

/**
 * Valid transitions for a waitlist entry.
 * active     → scheduled | cancelled
 * scheduled  → [] (terminal — promotion booked an appointment)
 * cancelled  → [] (terminal)
 */
export const WAITLIST_ENTRY_FSM: Record<WaitlistEntryStatus, WaitlistEntryStatus[]> = {
  active: ['scheduled', 'cancelled'],
  scheduled: [],
  cancelled: [],
};

export const WAITLIST_URGENCIES = ['routine', 'soon', 'asap'] as const;
export type WaitlistUrgency = typeof WAITLIST_URGENCIES[number];

export const dentalWaitlistEntries = pgTable('dental_waitlist_entry', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  // Optional preferred provider; null = any provider.
  preferredProviderId: uuid('preferred_provider_id').references(() => dentalMemberships.id, { onDelete: 'set null' }),
  visitType: text('visit_type'),
  urgency: text('urgency').notNull().default('routine').$type<WaitlistUrgency>(),
  status: text('status').notNull().default('active').$type<WaitlistEntryStatus>(),
  notes: text('notes'),
  // Set when the entry is promoted into a concrete appointment.
  promotedAppointmentId: uuid('promoted_appointment_id').references(() => dentalAppointments.id, { onDelete: 'set null' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (table) => ({
  branchIdx: index('dental_waitlist_entry_branch_id_idx').on(table.branchId),
  statusIdx: index('dental_waitlist_entry_status_idx').on(table.status),
  patientIdx: index('dental_waitlist_entry_patient_id_idx').on(table.patientId),
}));

export type DentalWaitlistEntry = typeof dentalWaitlistEntries.$inferSelect;
export type NewDentalWaitlistEntry = typeof dentalWaitlistEntries.$inferInsert;
