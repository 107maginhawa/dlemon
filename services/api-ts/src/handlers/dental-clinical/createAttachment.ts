/**
 * createAttachment handler
 *
 * POST /dental/visits/{visitId}/attachments
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError, NotFoundError } from '@/core/errors';
import { AttachmentRepository } from './repos/attachment.repo';
import { VALID_IMAGE_TYPES } from './repos/attachment.schema';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';

export async function createAttachment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!body['imageType'] || !VALID_IMAGE_TYPES.includes(body['imageType'] as any)) {
    throw new ValidationError(`imageType must be one of: ${VALID_IMAGE_TYPES.join(', ')}`);
  }
  if (!body['fileName'] || typeof body['fileName'] !== 'string') throw new ValidationError('fileName is required');
  if (!body['filePath'] || typeof body['filePath'] !== 'string') throw new ValidationError('filePath is required');
  if (typeof body['fileSizeBytes'] !== 'number') throw new ValidationError('fileSizeBytes is required');
  if (!body['mimeType'] || typeof body['mimeType'] !== 'string') throw new ValidationError('mimeType is required');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new AttachmentRepository(db);

  const attachment = await repo.createOne({
    visitId,
    patientId: body['patientId'] as string,
    imageType: body['imageType'] as any,
    toothNumbers: Array.isArray(body['toothNumbers']) ? body['toothNumbers'] as number[] : undefined,
    fileName: body['fileName'] as string,
    filePath: body['filePath'] as string,
    fileSizeBytes: body['fileSizeBytes'] as number,
    mimeType: body['mimeType'] as string,
    note: typeof body['note'] === 'string' ? body['note'] : undefined,
  });

  return ctx.json(attachment, 201);
}
