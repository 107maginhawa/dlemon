/**
 * visit-erasure.facade.ts (PR-B / V-DG-002, G3c)
 *
 * Facade exposing dental-visit free-text PHI scrub to the `erasure` module. The
 * erasure engine / its targets import only this facade, never the dental-visit
 * repos/schemas directly (Phase 10 boundary lint).
 *
 * Scrubs the DATA_GOVERNANCE §3.1(a) "likely-scrub" clinical free-text that can
 * embed a patient name/identifier inline (anonymizing the patientId FK does NOT
 * remove a name typed inside a note):
 *   - dental_visit.chief_complaint            → null
 *   - dental_treatment.clinical_notes/dismiss_reason/refusal_reason → null
 *   - dental_treatment.description (NOT NULL)  → '[ERASED]' (coded cdt_code kept)
 *   - visit_notes SOAP (subjective/objective/assessment/plan/notes) → null
 *   - dental_finding.note                      → null (coded condition_code kept)
 *
 * Idempotent. consent_refusal / amendment are medico-legal-immutable (§3.1(b))
 * and are deliberately NOT scrubbed here.
 */

import { eq, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalVisits } from './visit.schema';
import { dentalTreatments, visitNotes } from './treatment.schema';
import { dentalFindings } from './dental-finding.schema';
import { patients } from '../../patient/repos/patient.schema';

/** Marker written over a NOT-NULL free-text column that cannot be nulled. */
export const ERASED_MARKER = '[ERASED]';

export async function anonymizeVisitClinicalFreeTextByPerson(
  db: DatabaseInstance,
  personId: string,
): Promise<number> {
  const pts = await db.select({ id: patients.id }).from(patients).where(eq(patients.person, personId));
  if (pts.length === 0) return 0;
  const patientIds = pts.map((p) => p.id);
  const now = new Date();
  let count = 0;

  // Visits (chief complaint) — returning ALL the subject's visit ids drives the
  // visit_notes scope below (visit_notes is keyed by visitId, not patientId).
  const visitRows = await db
    .update(dentalVisits)
    .set({ chiefComplaint: null, updatedAt: now })
    .where(inArray(dentalVisits.patientId, patientIds))
    .returning({ id: dentalVisits.id });
  count += visitRows.length;
  const visitIds = visitRows.map((v) => v.id);

  const tx = await db
    .update(dentalTreatments)
    .set({ clinicalNotes: null, dismissReason: null, refusalReason: null, description: ERASED_MARKER, updatedAt: now })
    .where(inArray(dentalTreatments.patientId, patientIds))
    .returning({ id: dentalTreatments.id });
  count += tx.length;

  const findings = await db
    .update(dentalFindings)
    .set({ note: null, updatedAt: now })
    .where(inArray(dentalFindings.patientId, patientIds))
    .returning({ id: dentalFindings.id });
  count += findings.length;

  if (visitIds.length > 0) {
    const notes = await db
      .update(visitNotes)
      .set({ subjective: null, objective: null, assessment: null, plan: null, notes: null, updatedAt: now })
      .where(inArray(visitNotes.visitId, visitIds))
      .returning({ id: visitNotes.id });
    count += notes.length;
  }

  return count;
}
