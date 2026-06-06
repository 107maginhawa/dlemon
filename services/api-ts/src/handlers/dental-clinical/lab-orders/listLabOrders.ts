/**
 * listLabOrders handler
 *
 * GET /dental/visits/{visitId}/lab-orders
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { LabOrderRepository } from '../repos/lab-order.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { User } from '@/types/auth';

export async function listLabOrders(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new LabOrderRepository(db);

  const items = await repo.findMany({ visitId });
  const { limit, offset } = parsePagination(ctx.req.query(), { limit: 50 });
  const totalCount = items.length;
  const page = items.slice(offset, offset + limit);

  const audit = ctx.get('audit');
  if (audit?.logEvent) {
    await audit.logEvent({ eventType: 'data-access', category: 'clinical', action: 'read', outcome: 'success', user: user.id, userType: 'client', resourceType: 'lab-order', resource: visitId, description: 'Lab orders listed for visit', details: { resultCount: items.length }, ipAddress: ctx.req.header('x-forwarded-for'), userAgent: ctx.req.header('user-agent'), request: ctx.req.header('x-request-id') }, user.id);
  }

  return ctx.json({ data: page, pagination: buildPaginationMeta(page, totalCount, limit, offset) });
}
