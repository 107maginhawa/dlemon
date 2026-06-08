/**
 * removeHouseholdMember — DELETE /dental/households/{householdId}/members/{patientId}
 *
 * P1-27: remove a non-guarantor patient from a household. The guarantor cannot be
 * removed (reassign the guarantor or delete the household instead).
 */

import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { HouseholdRepository } from '../repos/household.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function removeHouseholdMember(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { householdId, patientId } = ctx.req.valid('param') as { householdId: string; patientId: string };
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new HouseholdRepository(db, logger);
  const household = await repo.findOneById(householdId);
  if (!household) throw new NotFoundError('Household not found');

  await assertBranchAccess(db, user.id, household.branchId);

  if (household.guarantorPatientId === patientId) {
    throw new BusinessLogicError('Cannot remove the guarantor from the household', 'GUARANTOR_NOT_REMOVABLE');
  }

  // EF-PAT-001 symmetry: addHouseholdMember blocks archived patients, so removal must too —
  // an archived patient's household associations are frozen (reassign/delete the household instead).
  const patient = await getPatientForDentalPatient(db, patientId);
  if (patient?.status === 'archived') {
    throw new ForbiddenError('Cannot remove an archived patient from a household', 'PATIENT_ARCHIVED');
  }

  const removed = await repo.removeMember(householdId, patientId);
  if (!removed) throw new NotFoundError('Household member not found');

  logger?.info({ action: 'removeHouseholdMember', householdId, patientId }, 'Household member removed');

  return ctx.json(removed, 200);
}
