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
import type { GenerateMultipartPartUrlQuery, GenerateMultipartPartUrlParams } from '@/generated/openapi/validators';

/**
 * generateMultipartPartUrl
 *
 * Path: GET /storage/multipart/{file}/part-url?partNumber=N
 * OperationId: generateMultipartPartUrl
 */
export async function generateMultipartPartUrl(
  ctx: ValidatedContext<never, GenerateMultipartPartUrlQuery, GenerateMultipartPartUrlParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }
  const user = ctx.get('user') as User | undefined;

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');

  const partNumber = query.partNumber;
  if (!partNumber || partNumber < 1) {
    throw new ValidationError('partNumber must be a positive integer (1-based)');
  }

  const storage = ctx.get('storage') as StorageProvider;
  const logger = ctx.get('logger');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new StorageFileRepository(db, logger);

  const fileId = params.file;
  const file = await repo.findOneById(fileId);
  if (!file) {
    throw new NotFoundError('File not found', {
      resourceType: 'file',
      resource: fileId,
      suggestions: ['Check file ID', 'Initiate multipart upload first'],
    });
  }

  if (!file.multipartUploadId) {
    throw new ValidationError('No active multipart upload for this file');
  }

  if (user && file.owner !== user.id) {
    throw new ForbiddenError('Access denied: You can only upload parts to your own files');
  }

  const partUrl = await storage.generatePartUploadUrl(fileId, file.multipartUploadId, partNumber);

  logger?.debug({ fileId, partNumber }, 'Generated multipart part URL');

  return ctx.json({ partUrl, partNumber }, 200);
}
