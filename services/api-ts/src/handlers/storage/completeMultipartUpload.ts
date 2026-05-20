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
import type { CompleteMultipartUploadBody, CompleteMultipartUploadParams } from '@/generated/openapi/validators';

/**
 * completeMultipartUpload
 *
 * Path: POST /storage/multipart/{file}/complete
 * OperationId: completeMultipartUpload
 *
 * Submits part ETags to S3 to assemble the final object.
 * File status moves from 'uploading' to 'available'.
 */
export async function completeMultipartUpload(
  ctx: ValidatedContext<CompleteMultipartUploadBody, never, CompleteMultipartUploadParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }
  const user = ctx.get('user') as User | undefined;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
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
      suggestions: ['Check file ID', 'Verify file exists'],
    });
  }

  if (file.status !== 'uploading') {
    throw new ValidationError(`File is in ${file.status} status, cannot complete upload`);
  }

  if (!file.multipartUploadId) {
    throw new ValidationError('No active multipart upload for this file');
  }

  if (user && file.owner !== user.id) {
    throw new ForbiddenError('Access denied: You can only complete your own uploads');
  }

  if (!body.parts || body.parts.length === 0) {
    throw new ValidationError('At least one part is required to complete multipart upload');
  }

  // Tell S3 to assemble the parts
  await storage.completeMultipartUpload(fileId, file.multipartUploadId, body.parts);

  // Mark available and clear the upload ID
  const finalFile = await repo.updateOneStatusById(fileId, 'available');
  await repo.updateOneById(fileId, { multipartUploadId: null });

  logger?.info({ fileId, filename: file.filename, partCount: body.parts.length }, 'Multipart file upload completed');

  return ctx.json(finalFile, 200);
}
