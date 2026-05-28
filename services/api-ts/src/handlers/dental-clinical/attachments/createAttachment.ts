/**
 * createAttachment handler
 *
 * POST /dental/visits/{visitId}/attachments
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { AttachmentRepository } from './repos/attachment.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { CreateAttachmentBody, CreateAttachmentParams } from '@/generated/openapi/validators';

export async function createAttachment(
  ctx: ValidatedContext<CreateAttachmentBody, never, CreateAttachmentParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);

  const repo = new AttachmentRepository(db);

  const attachment = await repo.createOne({
    visitId,
    patientId: body.patientId,
    imageType: body.imageType,
    toothNumbers: body.toothNumbers,
    fileName: body.fileName,
    filePath: body.filePath,
    fileSizeBytes: body.fileSizeBytes,
    mimeType: body.mimeType,
    note: body.note,
  });

  return ctx.json(attachment, 201);
}
