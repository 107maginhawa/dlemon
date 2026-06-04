/**
 * getPatientHousehold — GET /dental/patients/{patientId}/household
 *
 * P1-27: fetch the household a patient belongs to (+ members), for the patient
 * profile surface. 404 if the patient is not in any household.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { HouseholdRepository } from '../repos/household.repo';
import type { DatabaseInstance } from '@/core/database';

export async function getPatientHousehold(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new HouseholdRepository(db, logger);
  const household = await repo.findByPatientId(patientId);
  if (!household) throw new NotFoundError('Patient does not belong to a household');

  const members = await repo.findMembers(household.id);
  members.sort((a, b) => Number(b.isGuarantor) - Number(a.isGuarantor));

  return ctx.json({ household, members }, 200);
}
