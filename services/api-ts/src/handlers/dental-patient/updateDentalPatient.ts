/**
 * updateDentalPatient — PATCH /dental/patients/:id
 *
 * FR2.9:  Status management (active/archived)
 * FR2.16: Emergency contact fields
 * FR2.17: Communication preferences fields
 * FR2.18: Recall / next visit tracking
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { UpdateDentalPatientBody, UpdateDentalPatientParams } from '@/generated/openapi/validators';

export async function updateDentalPatient(
  ctx: ValidatedContext<UpdateDentalPatientBody, never, UpdateDentalPatientParams>
) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');
  const patientId = params.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const body = ctx.req.valid('json');

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId as string);
  }

  const updates: Record<string, any> = {};

  if (body['needsFollowUp'] !== undefined) updates['needsFollowUp'] = body['needsFollowUp'];
  if (body['dentalHistorySummary'] !== undefined) updates['dentalHistorySummary'] = body['dentalHistorySummary'];
  if (body['preferredBranchId'] !== undefined) updates['preferredBranchId'] = body['preferredBranchId'];

  // FR2.9: Status management
  if (body['status'] !== undefined) {
    updates['status'] = body['status'];
    if (body['status'] === 'archived') updates['archivedAt'] = new Date();
    if (body['status'] === 'active') updates['archivedAt'] = null;
  }

  // FR2.16: Emergency contact
  if (body['emergencyContact'] !== undefined) {
    updates['emergencyContact'] = body['emergencyContact'];
  }

  // FR2.17: Communication preferences
  if (body['communicationPreferences'] !== undefined) {
    updates['communicationPreferences'] = body['communicationPreferences'];
  }

  // FR2.18: Recall date + note
  if (body['recallDate'] !== undefined) updates['recallDate'] = body['recallDate'];
  if (body['recallNote'] !== undefined) updates['recallNote'] = body['recallNote'];

  updates['updatedBy'] = user.id;
  const updated = await repo.updateOneById(patientId, updates);

  logger?.info({ action: 'updateDentalPatient', patientId, updates }, 'Dental patient updated');

  return ctx.json(updated, 200);
}
