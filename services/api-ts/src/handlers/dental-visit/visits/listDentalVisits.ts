/**
 * listDentalVisits handler
 *
 * GET /dental/visits
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { withTenantTx } from '@/core/tenant-tx';
import { VisitRepository, type VisitFilters } from '../repos/visit.repo';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { DentalVisitStatus } from '../repos/visit.schema';
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
  // RLS P1b activation: the list read — the EM-BIL-002 leak class — runs under
  // app_rls scoped to the caller's authorized branch, so RLS is a second wall
  // behind the `filters.branchId` app filter. Authz stays on `db` (above).
  const visits = await withTenantTx(db, { branchIds: [branchId] }, (tx) =>
    new VisitRepository(tx).findMany(filters),
  );

  const { limit, offset } = parsePagination(ctx.req.query(), { limit: 20 });
  const totalCount = visits.length;
  const page = visits.slice(offset, offset + limit);

  return ctx.json({ data: page, pagination: buildPaginationMeta(page, totalCount, limit, offset) });
}
