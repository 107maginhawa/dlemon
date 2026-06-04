/**
 * listCasePresentations — GET /dental/patients/:patientId/case-presentations
 *
 * P1-20 (Phase 1, staff bearerAuth): list a patient's case presentations (headers,
 * not the full aggregate).
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { CasePresentationRepository } from '../repos/case-presentation.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listCasePresentations(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new CasePresentationRepository(db, logger);
  const presentations = await repo.findByPatientId(patientId);

  return ctx.json(presentations, 200);
}
