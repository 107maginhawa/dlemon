/**
 * createPatientContact — POST /dental/patients/:patientId/contacts
 *
 * AC-001 / AC-008 / AC-009: Create a contact (guardian or emergency) for a patient.
 * PAT-BR-002: Supports guardian linkage for minor patients.
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { PatientContactRepository } from '../repos/patient-contact.repo';
import { logAuditEvent } from '@/core/audit-logger';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { CreatePatientContactParams, CreatePatientContactBody } from '@/generated/openapi/validators';

export async function createPatientContact(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as CreatePatientContactParams;
  const body = ctx.req.valid('json') as CreatePatientContactBody;

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
  const contact = await contactRepo.create({
    patientId,
    name: body.name,
    relationship: body.relationship ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    isGuardian: body.isGuardian ?? false,
    isEmergencyContact: body.isEmergencyContact ?? false,
    notes: body.notes ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createPatientContact', patientId, contactId: contact.id }, 'Patient contact created');

  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.contact.create',
    resourceType: 'dental_patient_contact',
    resourceId: contact.id,
  });

  return ctx.json(contact, 201);
}
