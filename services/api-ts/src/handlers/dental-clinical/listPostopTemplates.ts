/**
 * listPostopTemplates — GET /dental/branches/:branchId/postop-templates
 * Supports ?category=extraction query filter.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PostopTemplateRepository } from './repos/postop-template.repo';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import type { PostopCategory } from './repos/postop-template.schema';

export async function listPostopTemplates(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param');
  const query = ctx.req.query();
  const category = query.category as PostopCategory | undefined;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Verify branch exists
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  const repo = new PostopTemplateRepository(db, logger);
  const templates = await repo.findByBranchId(branchId, category);

  return ctx.json(templates);
}
