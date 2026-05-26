/**
 * createMedicalHistoryEntry handler
 *
 * POST /dental/clinical/medical-history
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { MedicalHistoryRepository } from './repos/medical-history.repo';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { CreateMedicalHistoryEntryBody } from '@/generated/openapi/validators';

export async function createMedicalHistoryEntry(
  ctx: ValidatedContext<CreateMedicalHistoryEntryBody>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via patient's preferred branch
  const patientRepo = new PatientRepository(db);
  const patient = await patientRepo.findOneById(body.patientId);
  if (!patient) throw new NotFoundError('Patient');
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchRole(db, user.id, patient.preferredBranchId, ['dentist_owner', 'dentist_associate', 'hygienist', 'staff_full']);

  const repo = new MedicalHistoryRepository(db);

  const entry = await repo.createOne({
    patientId: body.patientId,
    entryType: body.entryType,
    displayName: body.displayName,
    codeSystem: body.codeSystem,
    code: body.code,
    notes: body.notes,
    onsetDate: body.onsetDate,
    resolvedDate: body.resolvedDate,
  });

  return ctx.json(entry, 201);
}
