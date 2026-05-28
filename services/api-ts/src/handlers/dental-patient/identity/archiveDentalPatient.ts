/**
 * archiveDentalPatient — POST /dental/patients/:id/archive
 *
 * FR2.7: Archive patient with EC1 guard (block if active payment plan).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { PatientRepository } from '../../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { ArchiveDentalPatientParams } from '@/generated/openapi/validators';

export async function archiveDentalPatient(
  ctx: ValidatedContext<never, never, ArchiveDentalPatientParams>
) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');
  const patientId = params.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);

  // Branch-level authorization
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId as string);
  }

  const result = await repo.archivePatient(patientId);

  if (!result.success) {
    if (result.reason === 'Patient not found') {
      throw new NotFoundError(result.reason);
    }
    throw new BusinessLogicError(result.reason ?? 'Cannot archive patient', 'ARCHIVE_BLOCKED');
  }

  logger?.info({ action: 'archiveDentalPatient', patientId, actorId: user.id }, 'Patient archived');

  const updated = await repo.findOneById(patientId);
  return ctx.json(updated, 200);
}
