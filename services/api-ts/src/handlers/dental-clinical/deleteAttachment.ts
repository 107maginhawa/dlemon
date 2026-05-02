/**
 * deleteAttachment handler
 *
 * DELETE /dental/visits/{visitId}/attachments/{attachmentId}
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { AttachmentRepository } from './repos/attachment.repo';
import type { User } from '@/types/auth';

export async function deleteAttachment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const attachmentId = ctx.req.param('attachmentId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new AttachmentRepository(db);

  const deleted = await repo.deleteById(attachmentId);
  if (!deleted) throw new NotFoundError('Attachment');

  return ctx.body(null, 204);
}
