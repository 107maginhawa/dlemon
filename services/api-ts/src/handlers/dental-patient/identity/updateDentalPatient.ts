/**
 * updateDentalPatient — PATCH /dental/patients/:id
 *
 * FR2.4:  Demographics correction (name / DOB / gender — on linked person)
 * FR2.9:  Status management (active/archived)
 * FR2.16: Emergency contact fields
 * FR2.17: Communication preferences fields
 * FR2.18: Recall / next visit tracking
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from '@/core/errors';
import { getDentalPatientRecord, updateDentalPatientRecord } from '../../patient/repos/patient-dental-patient.facade';
import type { Patient, EmergencyContact, CommunicationPreferences } from '../../patient/repos/patient-dental-patient.facade';
import { updatePatientDemographics } from '../../person/repos/person-dental-patient.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import { validateDateOfBirth } from '@/utils/date';
import type { UpdateDentalPatientBody, UpdateDentalPatientParams } from '@/generated/openapi/validators';

// FR2.4 demographics edit — gender allow-list mirrors the person genderEnum
// (person.schema.ts). Kept inline to avoid importing the person pg enum across
// the module boundary (matches createDentalPatient, which casts a free string).
const ALLOWED_GENDERS = ['male', 'female', 'non-binary', 'other', 'prefer-not-to-say'];

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

  const updates: Partial<Patient> = {};

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
    updates['emergencyContact'] = body['emergencyContact'] as unknown as EmergencyContact | null | undefined;
  }

  // FR2.17: Communication preferences
  if (body['communicationPreferences'] !== undefined) {
    updates['communicationPreferences'] = body['communicationPreferences'] as CommunicationPreferences | null | undefined;
  }

  // FR2.18: Recall date + note
  if (body['recallDate'] !== undefined) updates['recallDate'] = body['recallDate'];
  if (body['recallNote'] !== undefined) updates['recallNote'] = body['recallNote'];

  // FR2.4: demographics correction — name / DOB / gender live on the linked
  // PERSON record. Validate here (handler owns validation; the facade is pure
  // persistence), then apply through the person facade.
  const demographics: { firstName?: string; lastName?: string | null; dateOfBirth?: string | null; gender?: string | null; contactInfo?: { email?: string; phone?: string } } = {};
  let hasDemographics = false;
  // #14: track whether contact info specifically changed, to drive the audit.
  let contactChanged = false;

  if (body['firstName'] !== undefined) {
    const firstName = body['firstName'].trim();
    if (!firstName) throw new ValidationError('firstName cannot be empty');
    demographics.firstName = firstName;
    hasDemographics = true;
  }
  if (body['lastName'] !== undefined) {
    // Empty string clears the last name (mononym patients).
    const lastName = body['lastName'].trim();
    demographics.lastName = lastName === '' ? null : lastName;
    hasDemographics = true;
  }
  if (body['dateOfBirth'] !== undefined) {
    if (body['dateOfBirth'] === null || body['dateOfBirth'] === '') {
      demographics.dateOfBirth = null;
    } else {
      validateDateOfBirth(new Date(body['dateOfBirth']));
      demographics.dateOfBirth = body['dateOfBirth'];
    }
    hasDemographics = true;
  }
  if (body['gender'] !== undefined) {
    if (body['gender'] === null || body['gender'] === '') {
      demographics.gender = null;
    } else {
      if (!ALLOWED_GENDERS.includes(body['gender'])) {
        throw new ValidationError(`Invalid gender: must be one of ${ALLOWED_GENDERS.join(', ')}`);
      }
      demographics.gender = body['gender'];
    }
    hasDemographics = true;
  }
  // #14 (V-PAT-014): contact info (phone/email) edit. Partial — the facade merges
  // provided sub-fields over the stored contactInfo, so omitted ones are kept.
  if (body['contactInfo'] !== undefined) {
    const ci = body['contactInfo'] as { email?: string; phone?: string };
    demographics.contactInfo = ci;
    hasDemographics = true;
    contactChanged = true;
  }

  updates['updatedBy'] = user.id;
  const updated = await updateDentalPatientRecord(db, patientId, updates);

  // Apply demographics to the linked person and surface the updated subset on
  // the response. Per #14 (V-PAT-014) the subset now includes contactInfo.
  let person: { id: string; firstName: string; lastName: string | null; dateOfBirth: string | null; gender: string | null; contactInfo: { email?: string; phone?: string } | null } | null = null;
  if (hasDemographics) {
    person = await updatePatientDemographics(db, patientId, demographics, user.id);
  }

  // #14: contact-info edits are audited on write (PHI surface). The audit row
  // records only that contact info changed for this patient + the actor — never
  // the email/phone values (audit log is append-only / never-deleted).
  if (contactChanged) {
    const branchId = patient.preferredBranchId as string | undefined;
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: branchId ?? patientId,
      branchId,
      action: 'patient.contact.update',
      resourceType: 'dental_patient',
      resourceId: patientId,
    });
  }

  // Log only the changed field NAMES — never the values. `updates` can carry
  // emergencyContact / communicationPreferences / contactInfo PII (next-of-kin
  // name, phone, email) as JSONB; the logger's recursive redactor now descends
  // JSONB and redacts PHI keys at any depth, but logging keys-not-values keeps
  // the audit trail clean and is defence-in-depth against unkeyed PHI.
  logger?.info(
    {
      action: 'updateDentalPatient',
      patientId,
      updatedFields: Object.keys(updates).filter((k) => k !== 'updatedBy'),
      demographicFields: Object.keys(demographics),
    },
    'Dental patient updated',
  );

  if (person) {
    const displayName = [person.firstName, person.lastName].filter(Boolean).join(' ');
    // V-PAT-014 declared subset (mirrors getDentalPatient): id/name/DOB/gender,
    // plus contactInfo per #14 — but only when set, so a contactless patient
    // reports no contactInfo (absent, not null). Other person PII stays excluded.
    const personSubset = {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      dateOfBirth: person.dateOfBirth,
      gender: person.gender,
      ...(person.contactInfo ? { contactInfo: person.contactInfo } : {}),
    };
    // Return the V-PAT-014 declared subset (mirrors getDentalPatient) — never
    // spread the raw patient row, which carries actor UUIDs (createdBy/updatedBy),
    // version, archiveNote, and undeclared jsonb (primaryPharmacy/primaryProvider).
    return ctx.json(
      {
        id: updated.id,
        status: updated.status,
        needsFollowUp: updated.needsFollowUp,
        hasActivePaymentPlan: updated.hasActivePaymentPlan,
        preferredBranchId: updated.preferredBranchId ?? null,
        dentalHistorySummary: updated.dentalHistorySummary ?? null,
        recallDate: updated.recallDate ?? null,
        recallNote: updated.recallNote ?? null,
        emergencyContact: updated.emergencyContact ?? null,
        communicationPreferences: updated.communicationPreferences ?? null,
        displayName,
        person: personSubset,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      200,
    );
  }

  return ctx.json(updated, 200);
}
