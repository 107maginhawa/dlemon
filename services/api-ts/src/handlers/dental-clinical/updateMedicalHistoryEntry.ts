/**
 * updateMedicalHistoryEntry handler
 *
 * PATCH /dental/clinical/medical-history/{entryId}
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { MedicalHistoryRepository } from './repos/medical-history.repo';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';
import type { UpdateMedicalHistoryEntryBody, UpdateMedicalHistoryEntryParams } from '@/generated/openapi/validators';

export async function updateMedicalHistoryEntry(
  ctx: ValidatedContext<UpdateMedicalHistoryEntryBody, never, UpdateMedicalHistoryEntryParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { entryId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MedicalHistoryRepository(db);

  const existing = await repo.findOneById(entryId);
  if (!existing) throw new NotFoundError('Medical history entry');

  // Branch-level authorization via patient's preferred branch
  const patientRepo = new PatientRepository(db);
  const patient = await patientRepo.findOneById(existing.patientId);
  if (!patient) throw new NotFoundError('Patient');
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchAccess(db, user.id, patient.preferredBranchId);

  const updated = await repo.update(entryId, {
    displayName: body.displayName,
    notes: body.notes,
    resolvedDate: body.resolvedDate,
    active: body.active,
  });
  return ctx.json(updated);
}
