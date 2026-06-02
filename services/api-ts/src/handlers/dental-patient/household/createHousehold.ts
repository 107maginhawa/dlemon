/**
 * createHousehold — POST /dental/households
 *
 * P1-27: create a family file under one guarantor. The guarantor patient becomes
 * the household's first member (relationship 'self', isGuarantor=true).
 */

import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { HouseholdRepository } from '../repos/household.repo';
import { logAuditEvent } from '@/core/audit-logger';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import type { DatabaseInstance } from '@/core/database';

export async function createHousehold(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization — must be a member of the household's branch.
  await assertBranchAccess(db, user.id, body.branchId);

  // The guarantor must be a real patient in this branch.
  const guarantor = await getPatientForDentalPatient(db, body.guarantorPatientId);
  if (!guarantor) throw new NotFoundError('Guarantor patient not found');
  if (guarantor.preferredBranchId !== body.branchId) {
    throw new BusinessLogicError('Guarantor must belong to the household branch', 'GUARANTOR_BRANCH_MISMATCH');
  }
  if (guarantor.status === 'archived') {
    throw new ForbiddenError('Cannot make an archived patient a guarantor', 'PATIENT_ARCHIVED');
  }

  const repo = new HouseholdRepository(db, logger);

  // A patient belongs to at most one household.
  const existing = await repo.findMembership(body.guarantorPatientId);
  if (existing) {
    throw new BusinessLogicError('Patient already belongs to a household', 'ALREADY_IN_HOUSEHOLD');
  }

  const { household, members } = await repo.createWithGuarantor(
    {
      branchId: body.branchId,
      name: body.name,
      guarantorPatientId: body.guarantorPatientId,
      notes: body.notes ?? null,
      createdBy: user.id,
      updatedBy: user.id,
    },
    user.id,
  );

  const branchForAudit = await getBranchOrgId(db, body.branchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? body.branchId,
    branchId: body.branchId,
    action: 'household.created',
    resourceType: 'dental_household',
    resourceId: household.id,
    metadata: { guarantorPatientId: body.guarantorPatientId },
  });

  logger?.info({ action: 'createHousehold', householdId: household.id }, 'Household created');

  return ctx.json({ household, members }, 201);
}
