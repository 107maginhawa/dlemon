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
