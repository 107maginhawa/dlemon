/**
 * createDentalPatient
 *
 * Dental-specific patient registration endpoint.
 * Staff creates a patient record for a NEW person (not the logged-in user).
 *
 * Path: POST /dental/patients
 * Body: { displayName, dateOfBirth?, gender?, consentGiven?, branchId? }
 *
 * Creates:
 *   1. A new person record (firstName + lastName split from displayName)
 *   2. A patient record linked to that person, with status 'active'
 *
 * FR2.3: Registration requires name; DOB and consent are validated.
 * FR2.20: consentGiven must be true.
 * FR2.9: New patient status is 'active' (Pending status not in schema, maps to active).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError, BusinessLogicError } from '@/core/errors';
import type { User } from '@/types/auth';
import { findDuplicateDentalPatients, createPatientForRegistration } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { createPersonForDentalPatient } from '@/handlers/person/repos/person-dental-patient.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
import type { CreateDentalPatientBody } from '@/generated/openapi/validators';

export async function createDentalPatient(
  ctx: ValidatedContext<CreateDentalPatientBody, never, never>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');

  if (!body.displayName?.trim()) throw new ValidationError('displayName cannot be empty or whitespace');
  if (!body.consentGiven) throw new BusinessLogicError('Patient consent is required', 'CONSENT_REQUIRED');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization — branchId required for all patient registrations
  if (!body.branchId) throw new ValidationError('branchId is required');
  await assertBranchAccess(db, user.id, body.branchId);

  // Split displayName into firstName + lastName
  const parts = body.displayName.trim().split(/\s+/);
  const firstName = parts[0]!;
  const lastName = parts.slice(1).join(' ') || null;

  // FR2.5: Duplicate detection — non-blocking warning
  const potentialDuplicates = await findDuplicateDentalPatients(db, firstName, lastName, body.branchId);
  const duplicateWarning = potentialDuplicates.length > 0
    ? { hasDuplicates: true, count: potentialDuplicates.length, duplicateIds: potentialDuplicates.map(p => p.id) }
    : null;

  // Create a new person record for the patient (distinct from the logged-in user)
  // V-PAT-005: persist the captured registration consent on the person record.
  const newPerson = await createPersonForDentalPatient(db, {
    id: crypto.randomUUID(),
    firstName,
    ...(lastName ? { lastName } : {}),
    ...(body.dateOfBirth ? { dateOfBirth: body.dateOfBirth } : {}),
    ...(body.gender ? { gender: body.gender } : {}),
    consent: { registrationConsent: true, capturedAt: new Date().toISOString() },
  }, user.id);

  // Create patient record linked to the new person
  const patient = await createPatientForRegistration(db, newPerson.id, body.branchId);

  // AL-005 + V-PAT-006 (DE-021 PatientRegistered): per ADR-006 the domain event
  // is an audit-log-only semantic marker — satisfied by writing this row
  // synchronously. No event bus / emit scaffolding.
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: body.branchId,
    branchId: body.branchId,
    action: 'patient.registered',
    resourceType: 'dental_patient',
    resourceId: patient.id,
  });

  const response = {
    ...patient,
    displayName: [firstName, lastName].filter(Boolean).join(' '),
    person: {
      id: newPerson.id,
      firstName,
      lastName,
      dateOfBirth: newPerson.dateOfBirth,
      gender: newPerson.gender,
    },
    ...(duplicateWarning ? { warning: duplicateWarning } : {}),
  };

  logger?.info({ patientId: patient.id, personId: newPerson.id, createdBy: user.id }, 'Dental patient registered');

  return ctx.json(response, 201);
}
