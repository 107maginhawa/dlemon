/**
 * deleteAttachment handler
 *
 * DELETE /dental/visits/{visitId}/attachments/{attachmentId}
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { AttachmentRepository } from './repos/attachment.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';

export async function deleteAttachment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const attachmentId = ctx.req.param('attachmentId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new AttachmentRepository(db);

  // Look up attachment to find parent visit for branch authorization
  const existing = await repo.findOneById(attachmentId);
  if (!existing) throw new NotFoundError('Attachment');

  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(existing.visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const deleted = await repo.deleteById(attachmentId);
  if (!deleted) throw new NotFoundError('Attachment');

  return ctx.body(null, 204);
}
