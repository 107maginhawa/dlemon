/**
 * listCoverageAuthorizations — GET /dental/patients/:patientId/authorizations
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { CoverageAuthorizationRepository } from '../repos/coverage-authorization.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listCoverageAuthorizations(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new CoverageAuthorizationRepository(db, logger);
  const rows = await repo.findByPatientId(patientId);
  return ctx.json(rows, 200);
}
