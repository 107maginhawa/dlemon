/**
 * attachTreatmentAppointment —
 *   POST /dental/patients/:patientId/treatments/:treatmentId/appointment
 *
 * P1-21: link a planned treatment item to a scheduled appointment so the plan can
 * flow to the calendar (proposed → scheduled → done). The appointment must exist
 * and belong to the same patient. Loose ref — no hard FK.
 */

import { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import { appointmentExistsForPatient } from '../repos/appointment-link.facade';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function attachTreatmentAppointment(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, treatmentId } = ctx.req.valid('param') as { patientId: string; treatmentId: string };
  const body = ctx.req.valid('json') as { appointmentId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const exists = await appointmentExistsForPatient(db, body.appointmentId, patientId);
  if (!exists) {
    throw new ValidationError('Appointment not found for this patient');
  }

  const repo = new TreatmentPlanRepository(db, logger);
  const linked = await repo.attachAppointment(treatmentId, patientId, body.appointmentId);
  if (!linked) throw new NotFoundError('Treatment not found');

  logger?.info(
    { action: 'attachTreatmentAppointment', patientId, treatmentId, appointmentId: body.appointmentId },
    'Treatment linked to appointment',
  );

  return ctx.json(linked, 200);
}
