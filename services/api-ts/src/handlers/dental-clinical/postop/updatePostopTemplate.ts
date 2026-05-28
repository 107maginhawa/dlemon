/**
 * updatePostopTemplate — PATCH /dental/branches/:branchId/postop-templates/:templateId
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PostopTemplateRepository } from '../repos/postop-template.repo';
import type { DatabaseInstance } from '@/core/database';

export async function updatePostopTemplate(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { branchId, templateId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PostopTemplateRepository(db, logger);
  const updated = await repo.update(templateId, branchId, body);
  if (!updated) throw new NotFoundError('Post-op template not found');

  logger?.info({ action: 'updatePostopTemplate', branchId, templateId }, 'Post-op template updated');

  return ctx.json(updated);
}
