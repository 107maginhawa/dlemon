/**
 * getPatientHousehold — GET /dental/patients/{patientId}/household
 *
 * P1-27: fetch the household a patient belongs to (+ members), for the patient
 * profile surface. 204 if the patient is not in any household (404 only if the
 * patient itself does not exist).
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { HouseholdRepository } from '../repos/household.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function getPatientHousehold(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as { patientId: string };
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new HouseholdRepository(db, logger);
  const household = await repo.findByPatientId(patientId);
  // Absent optional sub-resource → 204 (matches getVisitPerioChart). The patient
  // exists (404 above otherwise); they're just in no household, so the client
  // reads "none" without a console-noise 404.
  if (!household) return new Response(null, { status: 204 });

  const members = await repo.findMembers(household.id);
  members.sort((a, b) => Number(b.isGuarantor) - Number(a.isGuarantor));

  return ctx.json({ household, members }, 200);
}
