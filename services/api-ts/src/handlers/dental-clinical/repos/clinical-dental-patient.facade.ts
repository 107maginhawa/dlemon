/**
 * clinical-dental-patient.facade.ts
 *
 * Facade exposing a patient's active medical-history entries to dental-patient
 * profile + safety-floor handlers (allergy/medication/condition aggregation).
 * dental-patient imports only this facade, never the dental-clinical schema
 * directly (Phase 10 boundary lint). Query is byte-identical to the former
 * inline read.
 */

import { and, eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { medicalHistoryEntries } from './medical-history.schema';

/** Active (non-archived) medical-history entries for a patient. */
export async function getActiveMedicalHistoryByPatientId(
  db: DatabaseInstance,
  patientId: string,
) {
  return db
    .select()
    .from(medicalHistoryEntries)
    .where(
      and(
        eq(medicalHistoryEntries.patientId, patientId),
        eq(medicalHistoryEntries.active, true),
      ),
    );
}
