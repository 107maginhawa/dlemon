/**
 * Drizzle schema for medical history entries
 *
 * Supports ICD-10 (conditions), RxNorm (medications/allergies), SNOMED CT (procedures)
 */

import { pgTable, uuid, text, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const medicalHistoryEntryTypeEnum = pgEnum('medical_history_entry_type', [
  'condition',
  'medication',
  'allergy',
  'procedure',
  'vaccination',
  'familyHistory',
]);

export const medicalHistoryEntries = pgTable('medical_history_entry', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull(),
  entryType: medicalHistoryEntryTypeEnum('entry_type').notNull(),
  codeSystem: text('code_system'),
  code: text('code'),
  displayName: text('display_name').notNull(),
  notes: text('notes'),
  onsetDate: text('onset_date'),
  resolvedDate: text('resolved_date'),
  active: boolean('active').notNull().default(true),
});

export type MedicalHistoryEntry = typeof medicalHistoryEntries.$inferSelect;
export type NewMedicalHistoryEntry = typeof medicalHistoryEntries.$inferInsert;

export const VALID_ENTRY_TYPES = ['condition', 'medication', 'allergy', 'procedure', 'vaccination', 'familyHistory'] as const;
export type MedicalHistoryEntryType = typeof VALID_ENTRY_TYPES[number];
