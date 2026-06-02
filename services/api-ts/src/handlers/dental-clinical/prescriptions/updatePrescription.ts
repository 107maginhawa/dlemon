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
import { VALID_PRESCRIPTION_STATUSES, type PrescriptionStatus } from '../repos/prescription.schema';
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

  // EM-CLI-012: parse `status` from raw JSON body.
  // The generated UpdatePrescriptionBody schema does not include `status` (Zod strips it).
  // We call ctx.req.json() which returns the full parsed JSON from Hono's cached body.
  const rawJson = await ctx.req.json() as Record<string, unknown>;
  const statusRaw = rawJson['status'];

  if (statusRaw !== undefined) {
    // Validate it is a known enum value before passing to FSM
    if (!VALID_PRESCRIPTION_STATUSES.includes(statusRaw as PrescriptionStatus)) {
      throw new BusinessLogicError(
        `Invalid prescription status '${String(statusRaw)}'. Must be one of: ${VALID_PRESCRIPTION_STATUSES.join(', ')}`,
        'INVALID_PRESCRIPTION_STATUS',
      );
    }

    const { prescription, error } = await repo.updateStatus(prescriptionId, statusRaw as PrescriptionStatus);
    if (error) {
      throw new BusinessLogicError(error, 'INVALID_PRESCRIPTION_TRANSITION');
    }
    return ctx.json(prescription);
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
