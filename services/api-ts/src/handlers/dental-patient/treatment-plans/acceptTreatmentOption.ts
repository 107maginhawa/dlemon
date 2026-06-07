/**
 * acceptTreatmentOption —
 *   POST /dental/patients/:patientId/treatment-options/:optionGroupId/accept
 *
 * P1-19: accept ONE alternate-case option (e.g. implant over bridge). The chosen
 * treatment moves to `planned`; its non-terminal siblings in the same option group
 * are `declined`. Mirrors the existing informed-refusal (decline) path.
 */

import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function acceptTreatmentOption(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, optionGroupId } = ctx.req.valid('param') as { patientId: string; optionGroupId: string };
  const body = ctx.req.valid('json') as { chosenTreatmentId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const repo = new TreatmentPlanRepository(db, logger);
  const group = await repo.findOptionGroup(optionGroupId, patientId);
  if (group.length === 0) throw new NotFoundError('Treatment option group not found');

  const chosen = group.find((o) => o.id === body.chosenTreatmentId);
  if (!chosen) {
    throw new BusinessLogicError(
      'Chosen treatment does not belong to this option group',
      'OPTION_NOT_IN_GROUP',
    );
  }

  const options = await repo.acceptOption(optionGroupId, body.chosenTreatmentId, patientId);

  logger?.info(
    { action: 'acceptTreatmentOption', patientId, optionGroupId, chosenTreatmentId: body.chosenTreatmentId },
    'Alternate treatment option accepted',
  );

  return ctx.json({ optionGroupId, chosenTreatmentId: body.chosenTreatmentId, options }, 200);
}
