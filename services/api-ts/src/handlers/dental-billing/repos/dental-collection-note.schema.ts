/**
 * dental_collection_note — collections outreach log (BR-051, Phase 2.4).
 *
 * Append-only record of a collections contact attempt against an overdue
 * patient (optionally a specific invoice): who logged it, when the patient was
 * contacted, by what channel, and a free-text note. Creation is audited; rows
 * are never updated or deleted (the outreach history is immutable).
 */

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalInvoices } from './dental-invoice.schema';

export const dentalCollectionNotes = pgTable('dental_collection_note', {
  ...baseEntityFields,
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  invoiceId: uuid('invoice_id').references(() => dentalInvoices.id),
  note: text('note').notNull(),
  // phone | email | sms | in-person | other
  contactChannel: text('contact_channel').notNull(),
  contactedAt: timestamp('contacted_at', { withTimezone: true }).notNull(),
  createdByMemberId: uuid('created_by_member_id'),
}, (table) => ({
  patientIdx: index('dental_collection_note_patient_idx').on(table.patientId),
  branchIdx: index('dental_collection_note_branch_idx').on(table.branchId),
}));

export type DentalCollectionNote = typeof dentalCollectionNotes.$inferSelect;
export type NewDentalCollectionNote = typeof dentalCollectionNotes.$inferInsert;
