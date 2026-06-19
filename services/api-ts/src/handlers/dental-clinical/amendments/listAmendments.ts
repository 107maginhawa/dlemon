/**
 * listAmendments handler
 *
 * GET /dental/visits/{visitId}/amendments
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { AmendmentRepository } from '../repos/amendment.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { User } from '@/types/auth';

export async function listAmendments(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new AmendmentRepository(db);

  const { limit, offset } = parsePagination(ctx.req.query(), { limit: 50 });
  const totalCount = await repo.count({ visitId });
  const page = await repo.findMany({ visitId }, { pagination: { limit, offset } });

  const audit = ctx.get('audit');
  if (audit?.logEvent) {
    await audit.logEvent({ eventType: 'data-access', category: 'clinical', action: 'read', outcome: 'success', user: user.id, userType: 'client', resourceType: 'amendment', resource: visitId, description: 'Amendments listed for visit', details: { resultCount: totalCount }, ipAddress: ctx.req.header('x-forwarded-for'), userAgent: ctx.req.header('user-agent'), request: ctx.req.header('x-request-id') }, user.id);
  }

  return ctx.json({ data: page, pagination: buildPaginationMeta(page, totalCount, limit, offset) });
}
