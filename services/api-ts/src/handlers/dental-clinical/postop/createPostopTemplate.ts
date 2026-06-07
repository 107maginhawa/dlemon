/**
 * createPostopTemplate — POST /dental/branches/:branchId/postop-templates
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PostopTemplateRepository } from '../repos/postop-template.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import type { HandlerContext } from '@/types/app';

export async function createPostopTemplate(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param') as { branchId: string };
  const body = ctx.req.valid('json') as { category: 'extraction' | 'implant' | 'root_canal' | 'filling' | 'crown' | 'cleaning' | 'surgery' | 'orthodontic' | 'other'; title: string; content: string };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization (mutation)
  await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'dentist_associate']);

  // Verify branch exists
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  const repo = new PostopTemplateRepository(db, logger);
  const template = await repo.create({
    branchId,
    category: body.category,
    title: body.title,
    content: body.content,
    active: true,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createPostopTemplate', branchId, templateId: template.id }, 'Post-op template created');

  return ctx.json(template, 201);
}
