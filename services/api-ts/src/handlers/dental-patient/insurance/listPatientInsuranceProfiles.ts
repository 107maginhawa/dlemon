/**
 * listPatientInsuranceProfiles — GET /dental/patients/:patientId/insurance-profiles
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
import { InsuranceProfileRepository } from '../repos/insurance-profile.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listPatientInsuranceProfiles(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId);
  }

  const repo = new InsuranceProfileRepository(db, logger);
  const profiles = await repo.findByPatientId(patientId);

  // EF-PAT-005: audit READ access to insurance profiles
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.insurance_profiles.read',
    resourceType: 'dental_patient_insurance_profiles',
    resourceId: patientId,
  });

  return ctx.json(profiles, 200);
}
