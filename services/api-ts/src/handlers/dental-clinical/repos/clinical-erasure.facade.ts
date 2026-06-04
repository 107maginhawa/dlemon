/**
 * clinical-erasure.facade.ts
 *
 * Facade exposing dental-clinical PII anonymization to the `erasure` module
 * (V-DG-002). The erasure engine / its targets import only this facade, never
 * the dental-clinical repos/schemas directly (Phase 10 boundary lint).
 *
 * Per DATA_GOVERNANCE.md §3 (Erasure Behavior table, rows 68-74):
 *
 *   - Treatment   → "Anonymize patient reference; CDT codes retain." The
 *                   dental_treatment row stores ONLY the patientId FK and
 *                   clinical content (cdt_code, description, clinical_notes,
 *                   price). No denormalized patient name/DOB/contact. The
 *                   patient reference is anonymized at the Patient row (handled
 *                   by patient-erasure.facade) — there is NOTHING to redact on
 *                   the treatment row itself. → NO-OP, no function exported.
 *
 *   - Prescription → "Drug name retains; patient identity gone." The
 *                   prescription row stores ONLY the patientId / prescriber FKs
 *                   plus clinical content (rxNormCode, drugName, dosage,
 *                   frequency, instructions). No denormalized patient PII.
 *                   → NO-OP, no function exported.
 *
 *   - ConsentForm → "No — keep state; Mark as [ERASED]; consent record
 *                   anonymized." The consent_form row carries real signer-
 *                   identity PII: `signatureData` (captured signature blob) and
 *                   `templateName` (human-readable label shown to/with the
 *                   patient). State (`signed`, `revoked`, `signedAt`) and the
 *                   FKs (patientId/visitId) are KEPT so downstream consent
 *                   checks still resolve. → BUILT below.
 */

import { eq, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { consentForms } from './consent-form.schema';
import { patients } from '../../patient/repos/patient.schema';

/** Marker written over identifying free-text on an erased consent form. */
export const ERASED_MARKER = '[ERASED]';

/**
 * Anonymize the signer-identity PII of every consent form belonging to the
 * patient profile linked to `personId`, per DATA_GOVERNANCE.md §3:
 *
 *   - `signatureData`  → null   (captured signature is identifying biometric PII)
 *   - `templateName`   → '[ERASED]'
 *   - `revokedBy`      → null   (a person id — identity of the revoker)
 *
 * KEPT (compliance / downstream consent checks): `signed`, `revoked`,
 * `signedAt`, `revokedAt`, `templateId`, and the `patientId` / `visitId` FKs.
 *
 * Returns the number of consent_form rows updated (0 when the person has no
 * patient profile or no consent forms). Idempotent — re-running over already
 * anonymized rows still matches and re-writes the same markers.
 */
export async function anonymizeConsentFormsByPerson(
  db: DatabaseInstance,
  personId: string,
): Promise<number> {
  // Resolve the patient profile(s) for this person (1:1 in practice).
  const pts = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.person, personId));
  if (pts.length === 0) return 0;
  const patientIds = pts.map((p) => p.id);

  const res = await db
    .update(consentForms)
    .set({
      signatureData: null,
      templateName: ERASED_MARKER,
      revokedBy: null,
      updatedAt: new Date(),
    })
    .where(inArray(consentForms.patientId, patientIds))
    .returning({ id: consentForms.id });
  return res.length;
}
