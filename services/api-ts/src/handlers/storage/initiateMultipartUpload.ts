import type { ValidatedContext } from '@/types/app';
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  UnauthorizedError,
  ValidationError,
} from '@/core/errors';
import type { NewStoredFile } from './repos/file.schema';
import type { StorageProvider } from '@/core/storage';
import { StorageFileRepository } from './repos/file.repo';
import type { InitiateMultipartUploadBody } from '@/generated/openapi/validators';

/**
 * initiateMultipartUpload
 *
 * Path: POST /storage/multipart/initiate
 * OperationId: initiateMultipartUpload
 */
export async function initiateMultipartUpload(
  ctx: ValidatedContext<InitiateMultipartUploadBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const body = ctx.req.valid('json');

  const storage = ctx.get('storage') as StorageProvider;
  const logger = ctx.get('logger');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new StorageFileRepository(db, logger);

  // 100MB cap
  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  if (body.size > MAX_FILE_SIZE) {
    throw new ValidationError('File size exceeds maximum limit of 100MB');
  }

  const user = ctx.get('user') as User;
  if (!user?.id) {
    throw new ValidationError('Valid user ID required');
  }

  const fileId = uuidv4();
  let fileCreated = false;

  try {
    await repo.createOne({
      id: fileId,
      filename: body.filename,
      mimeType: body.mimeType,
      size: body.size,
      status: 'uploading',
      owner: user.id,
    } as NewStoredFile);
    fileCreated = true;

    const uploadId = await storage.initiateMultipartUpload(fileId, body.filename, body.mimeType);

    // Persist the S3 uploadId so we can validate it on complete/abort
    await repo.updateOneById(fileId, { multipartUploadId: uploadId });

    logger?.info({ fileId, filename: body.filename, size: body.size }, 'Multipart upload initiated');

    return ctx.json({ fileId, uploadId }, 201);
  } catch (error) {
    if (fileCreated) {
      try {
        await repo.deleteOneById(fileId);
      } catch (cleanupError) {
        logger?.error({ error: cleanupError, fileId }, 'Failed to clean up DB record after multipart init error');
      }
    }
    throw error;
  }
}
