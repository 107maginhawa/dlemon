/**
 * treatment-plan.facade.ts
 *
 * Narrow surface exposing dental-patient treatment-plan recomputation to other
 * modules (e.g. dental-visit's updateDentalTreatment), so callers don't import the
 * full repo across the module boundary. Mirrors clinical-visit / org-billing facades.
 */
import type { DatabaseInstance } from '@/core/database';
import { TreatmentPlanRepository } from './treatment-plan.repo';

/**
 * TR-P1-08 / TP-BR-005: after a treatment's status changes, recompute the status of
 * the plan it belongs to (no-op when the treatment is not linked to a plan).
 */
export async function recomputePlanForTreatment(
  db: DatabaseInstance,
  treatmentId: string,
): Promise<void> {
  await new TreatmentPlanRepository(db).recomputeForTreatment(treatmentId);
}

/**
 * G6.2: does treatment plan `planId` exist AND belong to `patientId`? Used by
 * dental-imaging's createImageLink to reject orphan / cross-patient (cross-tenant)
 * link targets. `findOneById` already scopes by patientId, so a plan owned by a
 * different patient resolves to null — no cross-tenant existence is revealed.
 */
export async function treatmentPlanExistsForPatient(
  db: DatabaseInstance,
  planId: string,
  patientId: string,
): Promise<boolean> {
  const plan = await new TreatmentPlanRepository(db).findOneById(planId, patientId);
  return plan !== null;
}
