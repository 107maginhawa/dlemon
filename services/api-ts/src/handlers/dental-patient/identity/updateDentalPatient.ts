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
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getDentalPatientRecord, updateDentalPatientRecord } from '../../patient/repos/patient-dental-patient.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
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

  const patient = await getDentalPatientRecord(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  // Branch-level authorization (V-PAT-002): a missing branch must DENY, never
  // bypass the guard — a branchless patient is not editable by any member.
  if (!patient.preferredBranchId) {
    throw new ForbiddenError('Patient has no assigned branch');
  }
  await assertBranchRole(db, user.id, patient.preferredBranchId as string, ['dentist_owner', 'dentist_associate', 'hygienist', 'staff_full']);

  // EM-PAT-004: archiving via PATCH is restricted to dentist_owner
  if (body['status'] === 'archived') {
    await assertBranchRole(db, user.id, patient.preferredBranchId as string, ['dentist_owner']);
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
  const updated = await updateDentalPatientRecord(db, patientId, updates);

  logger?.info({ action: 'updateDentalPatient', patientId, updates }, 'Dental patient updated');

  return ctx.json(updated, 200);
}
