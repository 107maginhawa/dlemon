/**
 * listPatientContacts — GET /dental/patients/:patientId/contacts
 *
 * AC-002 / BR-003: Returns active (non-soft-deleted) contacts for a patient.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
import { PatientContactRepository } from '../repos/patient-contact.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { ListPatientContactsParams } from '@/generated/openapi/validators';

export async function listPatientContacts(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as ListPatientContactsParams;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const contactRepo = new PatientContactRepository(db, logger);
  const contacts = await contactRepo.findByPatientId(patientId);

  // EF-PAT-005: audit READ access to patient contacts
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.contacts.read',
    resourceType: 'dental_patient_contacts',
    resourceId: patientId,
  });

  return ctx.json(contacts, 200);
}
