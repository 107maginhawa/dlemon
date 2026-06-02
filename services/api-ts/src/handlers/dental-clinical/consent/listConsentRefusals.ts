/**
 * listConsentRefusals handler (P1-3)
 *
 * GET /dental/visits/{visitId}/consent-refusals
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { ConsentRefusalRepository } from '../repos/consent-refusal.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { ListConsentRefusalsParams } from '@/generated/openapi/validators';

export async function listConsentRefusals(
  ctx: ValidatedContext<never, never, ListConsentRefusalsParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;

  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'staff_full', 'hygienist']);

  const repo = new ConsentRefusalRepository(db);
  const refusals = await repo.findMany({ visitId });

  return ctx.json({
    data: refusals,
    pagination: { totalCount: refusals.length, page: 1, pageSize: refusals.length },
  });
}
