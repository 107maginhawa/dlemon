/**
 * listPatientClaims — GET /dental/patients/:patientId/claims
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
import { ClaimDraftRepository } from '../repos/claim-draft.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listPatientClaims(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new ClaimDraftRepository(db, logger);
  const claims = await repo.findByPatientId(patientId);

  // EF-PAT-005: audit READ access to patient claims
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.claims.read',
    resourceType: 'dental_patient_claims',
    resourceId: patientId,
  });

  return ctx.json(claims, 200);
}
