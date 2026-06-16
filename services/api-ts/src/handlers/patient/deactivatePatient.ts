import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  NotFoundError,
  BusinessLogicError,
} from '@/core/errors';
import { PatientRepository } from './repos/patient.repo';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';

/**
 * deactivatePatient
 *
 * Path: DELETE /patients/{id}
 * OperationId: deactivatePatient
 *
 * Soft-archives a patient record.
 * EC1: blocked if patient has an active payment plan.
 */
export async function deactivatePatient(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user') as User;
  const patientId = (ctx.req.param('id') || ctx.req.param('patient')) as string;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);

  // P1-3: this handler previously had ZERO authz — any authenticated user could
  // soft-archive any patient (the route admits the bare `user` role). Resolve the
  // patient and require the caller to be a member of its branch before archiving.
  const existing = await repo.findOneById(patientId);
  if (!existing) {
    throw new NotFoundError('Patient not found', {
      resourceType: 'patient',
      resource: patientId,
      suggestions: ['Check patient ID format', 'Verify patient exists'],
    });
  }
  await assertPatientBranchAccess(db, user.id, existing.preferredBranchId);

  const result = await repo.archivePatient(patientId);

  if (!result.success) {
    if (result.reason?.toLowerCase().includes('not found')) {
      throw new NotFoundError('Patient not found', {
        resourceType: 'patient',
        resource: patientId,
        suggestions: ['Check patient ID format', 'Verify patient exists'],
      });
    }
    // EC1: active payment plan
    throw new BusinessLogicError(result.reason ?? 'Cannot archive patient', 'PATIENT_ARCHIVE_BLOCKED');
  }

  logger?.info({ patientId, archivedBy: user.id }, 'Patient archived');

  return ctx.body(null, 204);
}
