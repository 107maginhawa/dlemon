/**
 * getHousehold — GET /dental/households/{householdId}
 *
 * P1-27: fetch a household + its members. Branch-scoped authorization.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { HouseholdRepository } from '../repos/household.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function getHousehold(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { householdId } = ctx.req.valid('param') as { householdId: string };
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new HouseholdRepository(db, logger);
  const household = await repo.findOneById(householdId);
  if (!household) throw new NotFoundError('Household not found');

  await assertBranchAccess(db, user.id, household.branchId);

  const members = await repo.findMembers(householdId);
  // Guarantor first for a stable, human-friendly ordering.
  members.sort((a, b) => Number(b.isGuarantor) - Number(a.isGuarantor));

  return ctx.json({ household, members }, 200);
}
