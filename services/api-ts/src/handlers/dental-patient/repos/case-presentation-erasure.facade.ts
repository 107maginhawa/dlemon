/**
 * case-presentation-erasure.facade.ts (PR-B / V-DG-002, G3c)
 *
 * Facade exposing dental-patient case-presentation PHI scrub to the `erasure`
 * module (Phase 10 boundary lint). Per DATA_GOVERNANCE §3.1(a):
 *   - dental_case_presentation.signer_name     → null (patient/guardian name)
 *   - dental_case_presentation.signature_data  → null (captured e-sig payload)
 * State (status/decision/decisionAt) and the FKs are KEPT so the plan record
 * still resolves. Idempotent.
 */

import { eq, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalCasePresentations } from './case-presentation.schema';
import { patients } from '../../patient/repos/patient.schema';

export async function anonymizeCasePresentationsByPerson(
  db: DatabaseInstance,
  personId: string,
): Promise<number> {
  const pts = await db.select({ id: patients.id }).from(patients).where(eq(patients.person, personId));
  if (pts.length === 0) return 0;
  const patientIds = pts.map((p) => p.id);

  const res = await db
    .update(dentalCasePresentations)
    .set({ signerName: null, signatureData: null, updatedAt: new Date() })
    .where(inArray(dentalCasePresentations.patientId, patientIds))
    .returning({ id: dentalCasePresentations.id });
  return res.length;
}
