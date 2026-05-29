/**
 * deletePatientContact — DELETE /dental/patients/:patientId/contacts/:contactId
 *
 * AC-004: Soft-deletes a contact. Returns 204 on success, 404 if not found.
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { PatientContactRepository } from '../repos/patient-contact.repo';
import { logAuditEvent } from '@/core/audit-logger';
import type { DatabaseInstance } from '@/core/database';

export async function deletePatientContact(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, contactId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId);
  }

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const contactRepo = new PatientContactRepository(db, logger);
  const deleted = await contactRepo.softDelete(contactId);
  if (!deleted) throw new NotFoundError('Contact not found');

  logger?.info({ action: 'deletePatientContact', patientId, contactId }, 'Patient contact soft-deleted');

  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.contact.delete',
    resourceType: 'dental_patient_contact',
    resourceId: contactId,
  });

  return new Response(null, { status: 204 });
}
