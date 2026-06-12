/**
 * updatePrescription handler
 *
 * PATCH /dental/visits/{visitId}/prescriptions/{prescriptionId}
 *
 * EM-CLI-012: enforces prescription status FSM.
 * If `status` is present in the body, delegates to repo.updateStatus()
 * which guards invalid transitions (→ 422 INVALID_PRESCRIPTION_TRANSITION).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { PrescriptionRepository } from '../repos/prescription.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { UpdatePrescriptionBody, UpdatePrescriptionParams } from '@/generated/openapi/validators';

export async function updatePrescription(
  ctx: ValidatedContext<UpdatePrescriptionBody, never, UpdatePrescriptionParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { prescriptionId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new PrescriptionRepository(db);

  const existing = await repo.findOneById(prescriptionId);
  if (!existing) throw new NotFoundError('Prescription');

  // Branch-level authorization via parent visit
  const visit = await getVisitOrThrow(db, existing.visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // EM-CLI-012: route on `status` when present. `status` is part of the validated
  // UpdatePrescriptionBody (added to UpdatePrescriptionRequest so the contract
  // describes the dispense/cancel transition the FE drives); the generated Zod enum
  // already rejects unknown values (400), so we read the validated field and route
  // straight to the FSM guard — which enforces the legal transitions.
  const statusRaw = body.status;

  if (statusRaw !== undefined) {
    const { prescription, error } = await repo.updateStatus(prescriptionId, statusRaw);
    if (error) {
      throw new BusinessLogicError(error, 'INVALID_PRESCRIPTION_TRANSITION');
    }
    return ctx.json(prescription);
  }

  // BR-003: field edits are blocked once the visit is locked/completed (parity with all
  // five clinical create handlers). Status PROGRESSION above is intentionally exempt —
  // pending→dispensed/cancelled happens externally (pharmacy), like the lab-order §13 carve-out.
  if (visit.status === 'locked' || visit.status === 'completed') {
    throw new BusinessLogicError(
      'Cannot edit prescriptions on a locked or completed visit',
      'VISIT_IMMUTABLE',
    );
  }

  // Non-status field update (existing behaviour unchanged)
  const updated = await repo.update(prescriptionId, {
    rxNormCode: body.rxNormCode,
    drugName: body.drugName,
    dosage: body.dosage,
    frequency: body.frequency,
    duration: body.duration,
    quantity: body.quantity,
    instructions: body.instructions,
    // P2-13: US-context legal Rx fields (record-only). undefined values are
    // skipped by Drizzle .set(), so omitted fields keep their stored value.
    controlledSubstanceSchedule: body.controlledSubstanceSchedule,
    prescriberDea: body.prescriberDea,
    prescriberNpi: body.prescriberNpi,
  });
  return ctx.json(updated);
}
