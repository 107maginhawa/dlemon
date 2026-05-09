/**
 * listDentalVisits handler
 *
 * GET /dental/visits
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { VisitRepository, type VisitFilters } from './repos/visit.repo';
import type { DentalVisitStatus } from './repos/visit.schema';
import type { User } from '@/types/auth';

export async function listDentalVisits(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.query('patientId');
  const branchId = ctx.req.query('branchId');
  const status = ctx.req.query('status') as DentalVisitStatus | undefined;

  if (!branchId) throw new ValidationError('branchId query parameter is required');

  const db = ctx.get('database') as DatabaseInstance;
  await assertBranchAccess(db, user.id, branchId);

  const filters: VisitFilters = {};
  if (patientId) filters.patientId = patientId;
  filters.branchId = branchId;
  if (status) filters.status = status;
  const repo = new VisitRepository(db);
  const visits = await repo.findMany(filters);

  const limit = parseInt(ctx.req.query('limit') ?? '20');
  const offset = parseInt(ctx.req.query('offset') ?? '0');
  const page = visits.slice(offset, offset + limit);

  return ctx.json({ items: page, total: visits.length, limit, offset });
}
