/**
 * updatePrescription handler
 *
 * PATCH /dental/visits/{visitId}/prescriptions/{prescriptionId}
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PrescriptionRepository } from './repos/prescription.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
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
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(existing.visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchAccess(db, user.id, visit.branchId);

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
