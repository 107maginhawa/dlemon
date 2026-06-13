/**
 * listCasePresentations — GET /dental/patients/:patientId/case-presentations
 *
 * P1-20 (Phase 1, staff bearerAuth): list a patient's case presentations (headers,
 * not the full aggregate).
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { CasePresentationRepository } from '../repos/case-presentation.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { ListCasePresentationsParams } from '@/generated/openapi/validators';

export async function listCasePresentations(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as ListCasePresentationsParams;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  // E1: reads stay broad — the whole clinical + coordinator + billing surface
  // may view a patient's case presentations. Only schedule-only / read-only-
  // observer roles are excluded (no treatment-presentation need).
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchRole(db, user.id, patient.preferredBranchId, [
    'dentist_owner', 'dentist_associate', 'hygienist', 'treatment_coordinator',
    'staff_full', 'front_desk', 'dental_assistant', 'billing_staff',
  ]);

  const repo = new CasePresentationRepository(db, logger);
  const presentations = await repo.findByPatientId(patientId);

  return ctx.json(presentations, 200);
}
