/**
 * Drizzle schema for PMD documents (Patient Medical Data)
 *
 * PMDs are immutable: generated once from a completed visit, signed, never updated.
 * A new PMD supersedes the previous one via supersedesId.
 */

import { pgTable, uuid, text, timestamp, pgEnum, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';

export const pmdDocumentStatusEnum = pgEnum('pmd_document_status', [
  'generated',
  'signed',
  'superseded',
]);

export const pmdDocuments = pgTable('pmd_document', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  authorMemberId: uuid('author_member_id').notNull().references(() => dentalMemberships.id),
  branchId: uuid('branch_id').references(() => dentalBranches.id),
  status: pmdDocumentStatusEnum('status').notNull().default('generated'),
  /** JSON snapshot of the visit at generation time */
  content: text('content').notNull(),
  /** Base64 digital signature */
  signature: text('signature'),
  signedAt: timestamp('signed_at'),
  /** ID of the older PMD this supersedes */
  supersedesId: uuid('supersedes_id').references((): AnyPgColumn => pmdDocuments.id, { onDelete: 'set null' }),
  /** SHA-256 checksum of content */
  checksum: text('checksum').notNull(),
});

export const importedPmds = pgTable('imported_pmd', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  sourceFacility: text('source_facility').notNull(),
  sourceReference: text('source_reference'),
  /** EF-PMD-005: Originating software system (e.g. "Open Dental v21.1", "Dentrix G7").
   *  Required for audit trail data provenance per MODULE_SPEC §7.2 item 5. */
  sourceDescription: text('source_description').notNull(),
  content: text('content').notNull(),
  importedAt: timestamp('imported_at').notNull().defaultNow(),
  safetyFloorMerged: text('safety_floor_merged').notNull().default('false'),
});

export type PMDDocument = typeof pmdDocuments.$inferSelect;
export type NewPMDDocument = typeof pmdDocuments.$inferInsert;
export type ImportedPMD = typeof importedPmds.$inferSelect;
export type NewImportedPMD = typeof importedPmds.$inferInsert;

export const VALID_PMD_STATUSES = ['generated', 'signed', 'superseded'] as const;
export type PMDDocumentStatus = typeof VALID_PMD_STATUSES[number];
