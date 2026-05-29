/**
 * updatePatientContact — PATCH /dental/patients/:patientId/contacts/:contactId
 *
 * AC-003 / AC-010: Update contact fields. Returns 404 when contact not found.
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { PatientContactRepository } from '../repos/patient-contact.repo';
import { logAuditEvent } from '@/core/audit-logger';
import type { DatabaseInstance } from '@/core/database';

export async function updatePatientContact(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, contactId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const contactRepo = new PatientContactRepository(db, logger);
  const updated = await contactRepo.update(contactId, body);
  if (!updated) throw new NotFoundError('Contact not found');

  logger?.info({ action: 'updatePatientContact', patientId, contactId }, 'Patient contact updated');

  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.contact.update',
    resourceType: 'dental_patient_contact',
    resourceId: contactId,
  });

  return ctx.json(updated, 200);
}
