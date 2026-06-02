/**
 * updateCoverageAuthorizationStatus —
 *   PATCH /dental/patients/:patientId/authorizations/:authorizationId/status
 *
 * FSM-validated transition. May also update the approved amount / covered
 * procedures alongside an `approved`/`partial` transition.
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { CoverageAuthorizationRepository } from '../repos/coverage-authorization.repo';
import { COVERAGE_AUTH_FSM, type CoverageAuthStatus } from '../repos/coverage-authorization.schema';
import type { DatabaseInstance } from '@/core/database';

export async function updateCoverageAuthorizationStatus(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, authorizationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json') as {
    status: CoverageAuthStatus;
    approvedAmountCents?: number;
    coveredProcedures?: Array<{ cdtCode: string; approvedAmountCents?: number; note?: string }>;
  };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const repo = new CoverageAuthorizationRepository(db, logger);
  const auth = await repo.findOneById(authorizationId, patientId);
  if (!auth) throw new NotFoundError('Coverage authorization not found');

  const current = auth.status as CoverageAuthStatus;
  const allowed = COVERAGE_AUTH_FSM[current];
  if (!allowed.includes(body.status)) {
    throw new BusinessLogicError(
      `Invalid status transition: ${current} → ${body.status}. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none'}`,
      'INVALID_STATUS_TRANSITION',
    );
  }

  const updateFields: Parameters<CoverageAuthorizationRepository['update']>[2] = {
    status: body.status,
    updatedBy: user.id,
  };
  if (body.status === 'approved' || body.status === 'partial') {
    if (body.approvedAmountCents !== undefined) updateFields.approvedAmountCents = body.approvedAmountCents;
    if (body.coveredProcedures !== undefined) updateFields.coveredProcedures = body.coveredProcedures;
    if (!auth.approvedAt) updateFields.approvedAt = new Date().toISOString().slice(0, 10);
  }

  const updated = await repo.update(authorizationId, patientId, updateFields);
  logger?.info({ action: 'updateCoverageAuthorizationStatus', patientId, authorizationId, from: current, to: body.status }, 'Coverage authorization status updated');
  return ctx.json(updated, 200);
}
