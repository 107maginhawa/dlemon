/**
 * patient-erasure.facade.ts
 *
 * Facade exposing Patient PII anonymization to the `erasure` module (V-DG-002).
 * The erasure engine imports only this facade, never the patient repo/schema
 * directly (Phase 10 boundary lint). Nulls patient-held PII (emergency contact,
 * provider/pharmacy, free-text history, comms prefs) while keeping the clinical
 * row + its codes — per DATA_GOVERNANCE.md §3.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { patients } from './patient.schema';

/**
 * Null the PII fields of the patient profile linked to `personId`. Returns the
 * number of patient rows updated (0 if the person has no patient profile).
 * Idempotent — nulling already-null fields is harmless.
 */
export async function anonymizePatientPiiByPerson(db: DatabaseInstance, personId: string): Promise<number> {
  const res = await db
    .update(patients)
    .set({
      emergencyContact: null,
      primaryProvider: null,
      primaryPharmacy: null,
      dentalHistorySummary: null,
      communicationPreferences: null,
      recallNote: null,
      archiveNote: null,
      updatedAt: new Date(),
    })
    .where(eq(patients.person, personId))
    .returning({ id: patients.id });
  return res.length;
}
