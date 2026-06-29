/**
 * multipart-upload.facade.ts (G-03)
 *
 * Facade exposing storage multipart stored_file creation to other modules
 * (e.g. dental-imaging) — Phase 10 boundary lint: callers import this facade,
 * never the storage repo/schema directly.
 */

import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { StorageFileRepository } from './file.repo';
import type { NewStoredFile } from './file.schema';

/**
 * Persist the stored_file row backing a multipart upload (status 'uploading',
 * with the S3 multipartUploadId) so completeMultipartUpload / abortMultipartUpload
 * — which look the file up by id — can find it. Mirrors the /storage
 * multipart-initiate handler.
 */
export async function createMultipartUploadFile(
  db: DatabaseInstance,
  logger: Logger | undefined,
  args: { fileId: string; filename: string; mimeType: string; size: number; owner: string; uploadId: string },
): Promise<void> {
  const repo = new StorageFileRepository(db, logger);
  await repo.createOne({
    id: args.fileId,
    filename: args.filename,
    mimeType: args.mimeType,
    size: args.size,
    status: 'uploading',
    owner: args.owner,
  } as NewStoredFile);
  await repo.updateOneById(args.fileId, { multipartUploadId: args.uploadId });
}
