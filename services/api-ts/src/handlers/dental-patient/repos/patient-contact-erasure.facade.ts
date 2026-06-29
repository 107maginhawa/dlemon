/**
 * patient-contact-erasure.facade.ts (G-04 / V-DG-002)
 *
 * Facade exposing dental-patient *contact* PII scrub to the `erasure` module
 * (Phase 10 boundary lint). Guardian/emergency contacts live in their own
 * dental_patient_contact table — separate from patients.emergencyContact — and
 * hold name/phone/email/notes PII (DATA_GOVERNANCE.md §3). Right-to-erasure must
 * scrub them:
 *   - name  → '[ERASED]' (column is NOT NULL → pseudonym, mirrors person name)
 *   - phone → null
 *   - email → null
 *   - notes → null
 * Structural / non-PII fields (relationship, isGuardian, isEmergencyContact) are
 * KEPT so the row still resolves. Idempotent.
 */

import { eq, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalPatientContacts } from './patient-contact.schema';
import { patients } from '../../patient/repos/patient.schema';

/** Pseudonym written into the NOT-NULL contact name on erasure. */
const ERASED_CONTACT_NAME = '[ERASED]';

export async function anonymizePatientContactsByPerson(
  db: DatabaseInstance,
  personId: string,
): Promise<number> {
  const pts = await db.select({ id: patients.id }).from(patients).where(eq(patients.person, personId));
  if (pts.length === 0) return 0;
  const patientIds = pts.map((p) => p.id);

  const res = await db
    .update(dentalPatientContacts)
    .set({ name: ERASED_CONTACT_NAME, phone: null, email: null, notes: null, updatedAt: new Date() })
    .where(inArray(dentalPatientContacts.patientId, patientIds))
    .returning({ id: dentalPatientContacts.id });
  return res.length;
}
