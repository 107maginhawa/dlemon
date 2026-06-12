/**
 * Drizzle schema for PMD documents (Portable Medical Document)
 *
 * PMDs are immutable: generated once from a completed visit, signed, never updated.
 * A new PMD supersedes the previous one via supersedesId.
 */

import { pgTable, uuid, text, timestamp, pgEnum, uniqueIndex, foreignKey, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from '@/core/database.schema';

export const pmdDocumentStatusEnum = pgEnum('pmd_document_status', [
  'generated',
  'signed',
  'superseded',
]);

// V-PMD-002 (§7.2/§20): cross-module refs (visit_id, patient_id, author_member_id,
// branch_id) are stored as plain UUIDs with NO DB foreign key. This keeps the PMD
// aggregate loosely coupled so imports/generation from a defunct facility cannot be
// blocked by a missing FK target. The self-reference (supersedes_id) is intra-aggregate
// and retains its FK.
export const pmdDocuments = pgTable('pmd_document', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  authorMemberId: uuid('author_member_id').notNull(),
  branchId: uuid('branch_id'),
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
}, (table) => ({
  // schema-fix #4: at most one LIVE (generated) PMD per visit. Supersession
  // marks the prior row 'superseded', so a visit has exactly one 'generated'
  // row. This partial unique index makes that a DB invariant and the race
  // backstop for concurrent visit-completion (generatePmdForVisit catches the
  // violation and resolves idempotently). Mirrors dental_visit_active_patient_unique.
  visitGeneratedUnique: uniqueIndex('pmd_document_visit_generated_unique')
    .on(table.visitId, table.status)
    .where(sql`status = 'generated'`),
}));

// V-PMD-002 (§7.2 item 1): imported PMD rows store patient_id as a plain UUID with
// NO DB foreign key. An external record from a defunct facility must be importable
// even if the patient row is later anonymised/erased, so a hard FK would block a
// legitimate ingestion.
export const importedPmds = pgTable('imported_pmd', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull(),
  sourceFacility: text('source_facility').notNull(),
  sourceReference: text('source_reference'),
  /** EF-PMD-005: Originating software system (e.g. "Open Dental v21.1", "Dentrix G7").
   *  Required for audit trail data provenance per MODULE_SPEC §7.2 item 5. */
  sourceDescription: text('source_description').notNull(),
  content: text('content').notNull(),
  importedAt: timestamp('imported_at').notNull().defaultNow(),
  /**
   * V-PMD-012: "Safety Floor merge" flag. The Safety Floor is the dental-patient
   * concept (see dental-patient/identity/getDentalPatientSafetyFloor.ts) — the minimum
   * set of safety-critical info (allergies, conditions, medications) a dentist must see.
   * When an imported PMD's safety-critical items have been surfaced into the patient's
   * Safety Floor, this flag is set 'true'. Merge is add-only and never mutates the
   * imported_pmd content itself. See MODULE_SPEC §7.2.
   */
  safetyFloorMerged: text('safety_floor_merged').notNull().default('false'),
});

/**
 * EF-PMD-003 (mig 0063): append-only "Safety Floor merge" event log for imported PMDs.
 * 0063 created this table as raw SQL with NO Drizzle model, leaving it orphaned (absent
 * from the Drizzle snapshot). This model brings it under the ORM so db:generate tracks it;
 * the reconcile migration syncs the snapshot idempotently against the table 0063 already
 * created on every environment. The append-only MERGE MECHANISM (markSafetyFloorMerged)
 * and its FIX-003 clinical consumer are intentionally DEFERRED (decision #20) — this is the
 * table definition only, so the snapshot stops trying to re-CREATE the orphan.
 *
 * Shape mirrors 0063 exactly: no baseEntityFields (only id/imported_pmd_id/merged_at/
 * merged_by), explicit FK name so the generated constraint matches the 0063 one.
 */
export const importedPmdSafetyFloorEvents = pgTable('imported_pmd_safety_floor_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  importedPmdId: uuid('imported_pmd_id').notNull(),
  mergedAt: timestamp('merged_at').notNull().defaultNow(),
  mergedBy: uuid('merged_by'),
}, (table) => ({
  importedPmdFk: foreignKey({
    columns: [table.importedPmdId],
    foreignColumns: [importedPmds.id],
    name: 'imported_pmd_safety_floor_events_imported_pmd_id_fk',
  }).onDelete('cascade'),
  pmdUniq: uniqueIndex('imported_pmd_safety_floor_events_pmd_uniq').on(table.importedPmdId),
}));

export type PMDDocument = typeof pmdDocuments.$inferSelect;
export type NewPMDDocument = typeof pmdDocuments.$inferInsert;
export type ImportedPMD = typeof importedPmds.$inferSelect;
export type NewImportedPMD = typeof importedPmds.$inferInsert;
export type ImportedPMDSafetyFloorEvent = typeof importedPmdSafetyFloorEvents.$inferSelect;
export type NewImportedPMDSafetyFloorEvent = typeof importedPmdSafetyFloorEvents.$inferInsert;

export const VALID_PMD_STATUSES = ['generated', 'signed', 'superseded'] as const;
export type PMDDocumentStatus = typeof VALID_PMD_STATUSES[number];
