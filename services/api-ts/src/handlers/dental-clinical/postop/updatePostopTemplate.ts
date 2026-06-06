/**
 * updatePostopTemplate — PATCH /dental/branches/:branchId/postop-templates/:templateId
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PostopTemplateRepository } from '../repos/postop-template.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { PostopCategory, DentalPostopTemplate } from '../repos/postop-template.schema';

export async function updatePostopTemplate(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId, templateId } = ctx.req.valid('param') as { branchId: string; templateId: string };
  const body = ctx.req.valid('json') as Partial<Pick<DentalPostopTemplate, 'category' | 'title' | 'content' | 'active'>>;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization (mutation)
  await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'dentist_associate']);

  const repo = new PostopTemplateRepository(db, logger);
  const updated = await repo.update(templateId, branchId, body);
  if (!updated) throw new NotFoundError('Post-op template not found');

  logger?.info({ action: 'updatePostopTemplate', branchId, templateId }, 'Post-op template updated');

  return ctx.json(updated);
}
