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
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
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
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  const deleted = await repo.softDelete(attachmentId);
  if (!deleted) throw new NotFoundError('Attachment');

  const audit = ctx.get('audit') as any;
  if (audit?.logEvent) {
    await audit.logEvent({
      eventType: 'data-modification',
      category: 'clinical',
      action: 'delete',
      outcome: 'success',
      user: user.id,
      userType: 'client',
      resourceType: 'attachment',
      resource: attachmentId,
      description: 'Clinical attachment soft-deleted',
      details: { visitId: existing.visitId, patientId: existing.patientId },
      ipAddress: ctx.req.header('x-forwarded-for'),
      request: ctx.req.header('x-request-id'),
    }, user.id);
  }

  return ctx.body(null, 204);
}
