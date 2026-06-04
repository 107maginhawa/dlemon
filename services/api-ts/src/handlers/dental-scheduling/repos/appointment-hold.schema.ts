/**
 * Drizzle schema for dental appointment holds (P1-25 online booking).
 *
 * A hold is a short-TTL soft reservation of a provider/time window created when
 * a patient selects a slot in the self-service flow. Availability treats active
 * (non-expired) holds as occupied so two patients cannot both reach the commit
 * step for the same slot. A cleanup job sweeps expired holds; the final
 * transactional overlap re-check at commit time is the authoritative guard.
 *
 * This is intentionally a lean side-table (not the appointment row) so an
 * abandoned hold never pollutes the staff calendar.
 */

import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';

export const dentalAppointmentHolds = pgTable('dental_appointment_hold', {
  ...baseEntityFields,
  branchId: uuid('branch_id')
    .notNull()
    .references(() => dentalBranches.id, { onDelete: 'cascade' }),
  providerId: uuid('provider_id')
    .notNull()
    .references(() => dentalMemberships.id, { onDelete: 'cascade' }),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  // Opaque token returned to the client so it can reference its own hold at
  // commit time without exposing the hold id space.
  sessionToken: text('session_token').notNull(),
}, (table) => ({
  lookupIdx: index('dental_appointment_hold_lookup_idx').on(table.branchId, table.providerId, table.startAt),
  expiresIdx: index('dental_appointment_hold_expires_idx').on(table.expiresAt),
}));

export type DentalAppointmentHold = typeof dentalAppointmentHolds.$inferSelect;
export type NewDentalAppointmentHold = typeof dentalAppointmentHolds.$inferInsert;
