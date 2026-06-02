/**
 * createCoverageAuthorization — POST /dental/patients/:patientId/authorizations
 *
 * P1-26: capture an HMO Letter of Authorization (LOA) / approval record before
 * treatment. Created in 'requested' (or 'approved' when an approval code +
 * approved amount are supplied up front).
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { InsuranceProfileRepository } from '../repos/insurance-profile.repo';
import { CoverageAuthorizationRepository } from '../repos/coverage-authorization.repo';
import type { CoverageAuthStatus } from '../repos/coverage-authorization.schema';
import type { DatabaseInstance } from '@/core/database';

export async function createCoverageAuthorization(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  // Verify insuranceProfileId belongs to this patient
  const profileRepo = new InsuranceProfileRepository(db, logger);
  const profile = await profileRepo.findOneById(body.insuranceProfileId, patientId);
  if (!profile) throw new BusinessLogicError('Insurance profile not found for this patient');

  const status: CoverageAuthStatus = body.status ?? 'requested';

  const repo = new CoverageAuthorizationRepository(db, logger);
  const auth = await repo.create({
    patientId,
    insuranceProfileId: body.insuranceProfileId,
    branchId: patient.preferredBranchId!,
    visitId: body.visitId ?? null,
    treatmentPlanId: body.treatmentPlanId ?? null,
    loaNumber: body.loaNumber ?? null,
    status,
    approvedAt: body.approvedAt ?? null,
    validUntil: body.validUntil ?? null,
    approvedAmountCents: body.approvedAmountCents ?? null,
    coveredProcedures: body.coveredProcedures ?? null,
    attachmentFileId: body.attachmentFileId ?? null,
    notes: body.notes ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createCoverageAuthorization', patientId, authorizationId: auth.id }, 'Coverage authorization created');

  return ctx.json(auth, 201);
}
