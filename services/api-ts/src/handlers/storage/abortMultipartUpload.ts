import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/core/errors';
import type { StorageProvider } from '@/core/storage';
import { StorageFileRepository } from './repos/file.repo';
import type { AbortMultipartUploadParams } from '@/generated/openapi/validators';

/**
 * abortMultipartUpload
 *
 * Path: DELETE /storage/multipart/{file}/abort
 * OperationId: abortMultipartUpload
 *
 * CRITICAL: Must clean up S3 resources to prevent orphaned parts
 * accumulating storage charges.
 */
export async function abortMultipartUpload(
  ctx: ValidatedContext<never, never, AbortMultipartUploadParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }
  const user = ctx.get('user') as User | undefined;

  const params = ctx.req.valid('param');
  const fileId = params.file;

  const storage = ctx.get('storage') as StorageProvider;
  const logger = ctx.get('logger');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new StorageFileRepository(db, logger);

  const file = await repo.findOneById(fileId);
  if (!file) {
    throw new NotFoundError('File not found', {
      resourceType: 'file',
      resource: fileId,
      suggestions: ['Check file ID'],
    });
  }

  if (!file.multipartUploadId) {
    throw new ValidationError('No active multipart upload for this file');
  }

  if (user && file.owner !== user.id) {
    throw new ForbiddenError('Access denied: You can only abort your own uploads');
  }

  // Clean up S3 resources — this is critical for cost/compliance
  await storage.abortMultipartUpload(fileId, file.multipartUploadId);

  // Mark file as failed and clear the upload ID
  await repo.updateOneStatusById(fileId, 'failed');
  await repo.updateOneById(fileId, { multipartUploadId: null });

  logger?.info({ fileId }, 'Multipart upload aborted');

  return new Response(null, { status: 204 });
}
