/**
 * listPostopTemplates — GET /dental/branches/:branchId/postop-templates
 * Supports ?category=extraction query filter.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PostopTemplateRepository } from '../repos/postop-template.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import type { PostopCategory } from '../repos/postop-template.schema';
import type { HandlerContext } from '@/types/app';

export async function listPostopTemplates(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param') as { branchId: string };
  const query = ctx.req.query();
  const category = query['category'] as PostopCategory | undefined;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization (read)
  await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'dentist_associate', 'staff_full', 'hygienist']);

  // Verify branch exists
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  const repo = new PostopTemplateRepository(db, logger);
  const templates = await repo.findByBranchId(branchId, category);

  // G10: conform to the platform `{ data, pagination }` envelope (was a bare array).
  const { limit, offset } = parsePagination(ctx.req.query(), { limit: 50 });
  const page = templates.slice(offset, offset + limit);
  return ctx.json({ data: page, pagination: buildPaginationMeta(page, templates.length, limit, offset) });
}
