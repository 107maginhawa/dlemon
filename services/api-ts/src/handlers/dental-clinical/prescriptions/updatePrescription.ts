/**
 * updatePrescription handler
 *
 * PATCH /dental/visits/{visitId}/prescriptions/{prescriptionId}
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { PrescriptionRepository } from './repos/prescription.repo';
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

  const updated = await repo.update(prescriptionId, {
    rxNormCode: body.rxNormCode,
    drugName: body.drugName,
    dosage: body.dosage,
    frequency: body.frequency,
    duration: body.duration,
    quantity: body.quantity,
    instructions: body.instructions,
  });
  return ctx.json(updated);
}
