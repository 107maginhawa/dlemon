/**
 * addHouseholdMember — POST /dental/households/{householdId}/members
 *
 * P1-27: add a patient to an existing household. The added patient must belong to
 * the household's branch, not be archived, and not already be in a household.
 */

import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { HouseholdRepository } from '../repos/household.repo';
import type { DatabaseInstance } from '@/core/database';

export async function addHouseholdMember(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { householdId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new HouseholdRepository(db, logger);
  const household = await repo.findOneById(householdId);
  if (!household) throw new NotFoundError('Household not found');

  await assertBranchAccess(db, user.id, household.branchId);

  const patient = await getPatientForDentalPatient(db, body.patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  if (patient.preferredBranchId !== household.branchId) {
    throw new BusinessLogicError('Member must belong to the household branch', 'MEMBER_BRANCH_MISMATCH');
  }
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot add an archived patient to a household', 'PATIENT_ARCHIVED');
  }

  const existing = await repo.findMembership(body.patientId);
  if (existing) {
    throw new BusinessLogicError('Patient already belongs to a household', 'ALREADY_IN_HOUSEHOLD');
  }

  const member = await repo.addMember({
    householdId,
    patientId: body.patientId,
    relationship: body.relationship ?? 'dependent',
    isGuarantor: false,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'addHouseholdMember', householdId, patientId: body.patientId }, 'Household member added');

  return ctx.json(member, 201);
}
