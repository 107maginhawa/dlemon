/**
 * detachTreatmentAppointment —
 *   DELETE /dental/patients/:patientId/treatments/:treatmentId/appointment
 *
 * P1-21: unlink a planned treatment item from its appointment (clear the loose ref).
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function detachTreatmentAppointment(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, treatmentId } = ctx.req.valid('param') as { patientId: string; treatmentId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const repo = new TreatmentPlanRepository(db, logger);
  const unlinked = await repo.detachAppointment(treatmentId, patientId);
  if (!unlinked) throw new NotFoundError('Treatment not found');

  logger?.info(
    { action: 'detachTreatmentAppointment', patientId, treatmentId },
    'Treatment unlinked from appointment',
  );

  return ctx.json(unlinked, 200);
}
