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
 * FIX-001 (erasure tenancy): resolve the patient backing an erasure subject so the
 * server can derive tenancy from the subject instead of trusting the caller. Looks
 * up by patientId when supplied, else by personId (patient.person is unique). Returns
 * null when the subject has no patient row (a bare-person subject).
 */
export async function getErasureSubjectPatient(
  db: DatabaseInstance,
  subject: { personId: string; patientId?: string | null },
): Promise<{ id: string; personId: string; preferredBranchId: string | null } | null> {
  const cols = { id: patients.id, personId: patients.person, preferredBranchId: patients.preferredBranchId };
  const [row] = subject.patientId
    ? await db.select(cols).from(patients).where(eq(patients.id, subject.patientId)).limit(1)
    : await db.select(cols).from(patients).where(eq(patients.person, subject.personId)).limit(1);
  return row ?? null;
}

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
