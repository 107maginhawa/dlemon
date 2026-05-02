import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  NotFoundError,
  BusinessLogicError,
} from '@/core/errors';
import { PatientRepository } from './repos/patient.repo';
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
