/**
 * Physical S3 radiograph deletion for right-to-erasure (V-DG-002 / WFG-006).
 *
 * DATA_GOVERNANCE.md §3 requires the radiograph's S3 object to be PHYSICALLY
 * deleted on erasure — not just the DB metadata anonymized. The anonymize engine
 * runs at the repo layer and has no storage client, so it only SURFACES the
 * storage `file` ids (`fileIdsPendingS3Delete`). This step runs at HANDLER scope
 * (where `ctx.get('storage')` lives) AFTER the anonymization has committed +
 * been audited, and performs the two physical deletes:
 *
 *   1. S3 object  — via the request-scoped StorageProvider.deleteFile.
 *   2. storage `file` row — via the storage module's facade.
 *
 * FAIL-OPEN: anonymization (the GDPR-material redaction) is already committed and
 * audited before this runs. A storage hiccup must therefore NOT fail the whole
 * erasure. `StorageProvider.deleteFile` RE-THROWS on S3 error (see core/storage),
 * so we catch per-file: a file whose S3 delete throws is left PENDING (its row is
 * kept so the handle survives) and reported. The operation is idempotent — the
 * engine recomputes `fileIdsPendingS3Delete` from current rows each run, so a
 * later retry re-deletes the still-pending objects.
 *
 * Every run APPENDS an `erasure.s3_deleted` audit event (engine invariant 5).
 */

import type { DatabaseInstance } from '@/core/database';
import type { StorageProvider } from '@/core/storage';
import { logAuditEvent } from '@/core/audit-logger';
import { deleteStoredFileRowsByIds } from '@/handlers/storage/repos/storage-imaging.facade';
import { ERASURE_SYSTEM_ACTOR } from './erasure-engine';

export interface PhysicalDeleteContext {
  tenantId: string;
  branchId?: string | null;
  subjectPersonId: string;
  /** Actor who approved the erasure (recorded as the audit personId). */
  actorId?: string;
}

export interface PhysicalDeleteResult {
  /** file ids whose S3 object + storage row were physically removed. */
  deletedFileIds: string[];
  /** file ids whose S3 delete threw — left for a later (idempotent) retry. */
  pendingFileIds: string[];
}

/**
 * Physically delete the S3 objects + storage rows for the given file ids,
 * fail-open per file, then audit. Safe to call with an empty list (no-op, no
 * audit). `db`, `storage`, `logger` are handler-scoped.
 */
export async function physicalDeleteErasedFiles(
  db: DatabaseInstance,
  storage: StorageProvider,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  ctx: PhysicalDeleteContext,
  fileIds: string[],
  // Injectable audit writer (defaults to the append-only sink).
  audit: typeof logAuditEvent = logAuditEvent,
): Promise<PhysicalDeleteResult> {
  const deletedFileIds: string[] = [];
  const pendingFileIds: string[] = [];

  if (fileIds.length === 0) {
    return { deletedFileIds, pendingFileIds };
  }

  // 1. S3 object delete — per-file fail-open (deleteFile re-throws on S3 error).
  for (const fileId of fileIds) {
    try {
      await storage.deleteFile(fileId);
      deletedFileIds.push(fileId);
    } catch (error) {
      // Anonymization already committed; do not fail the erasure. Leave the
      // file pending — a retry recomputes the list and re-deletes.
      pendingFileIds.push(fileId);
      logger?.warn(
        { error, fileId, subjectPersonId: ctx.subjectPersonId },
        'erasure: S3 object delete failed — left pending for retry',
      );
    }
  }

  // 2. Remove the storage `file` rows only for objects actually deleted from S3,
  //    so a pending object keeps its handle for the next run.
  if (deletedFileIds.length > 0) {
    await deleteStoredFileRowsByIds(db, deletedFileIds);
  }

  // 3. Audit the physical delete (engine invariant 5: every step is audited).
  await audit(db, logger, {
    personId: ctx.actorId ?? ERASURE_SYSTEM_ACTOR,
    tenantId: ctx.tenantId,
    branchId: ctx.branchId ?? undefined,
    action: 'erasure.s3_deleted',
    resourceType: 'erasure_request',
    resourceId: ctx.subjectPersonId,
    eventType: 'security',
    metadata: {
      subjectPersonId: ctx.subjectPersonId,
      requested: fileIds.length,
      deleted: deletedFileIds.length,
      pending: pendingFileIds.length,
      pendingFileIds,
    },
  });

  return { deletedFileIds, pendingFileIds };
}
