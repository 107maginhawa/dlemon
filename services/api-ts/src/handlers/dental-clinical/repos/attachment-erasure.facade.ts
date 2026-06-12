/**
 * attachment-erasure.facade.ts
 *
 * Facade exposing dental_attachment PII anonymization to the `erasure` module
 * (V-DG-002 / decision #7 / schema-fix #2). The erasure engine's targets import
 * ONLY this facade, never the dental-clinical repos/schemas directly (Phase 10
 * boundary lint). Mirrors {@link ../../dental-imaging/repos/imaging-erasure.facade.ts}.
 *
 * Per DATA_GOVERNANCE.md §3 (dental_attachment row): a visit-tagged x-ray/photo
 * attachment carries real PHI in two free-text columns — `fileName` (often the
 * patient name, e.g. "maria-santos-periapical.jpg") and `note` (clinical
 * free-text). The backing S3 object must also be physically deleted (parity with
 * ImagingStudy). Erasure-via-anonymization (the engine never hard-deletes the row):
 *
 *   ANONYMIZE (this facade, in-DB, idempotent):
 *     - fileName  → '[ERASED]'  (the column is NOT NULL; redact to the marker)
 *     - note      → null        (clinical free-text may embed identifiers)
 *     - filePath  → '[ERASED]'  (UNVALIDATED client string with no FK: the FE
 *                                happy-path stores the object-store key, but
 *                                legacy/seed rows store a free-form path like
 *                                `/uploads/maria-santos/x.jpg` that ITSELF embeds
 *                                PHI. Redact it — the deletion handle is captured
 *                                in-memory before redaction, so the S3 delete is
 *                                unaffected. NOT retained as imaging retains its
 *                                opaque-uuid `fileId`, precisely because filePath
 *                                is not a guaranteed-opaque value.)
 *     - deletedAt → now()       (erasure marker; COALESCE-preserved so a re-run
 *                                keeps the FIRST erasure time.)
 *
 *   RETAIN (non-PII clinical metadata):
 *     - imageType, toothNumbers, fileSizeBytes, mimeType  (file-category metadata)
 *
 *   S3 OBJECT DELETION — NOT performed here. The physical S3 delete requires the
 *   request-scoped storage client, unavailable to a repo-layer DB facade. This
 *   facade RETURNS only the filePaths that are CONFIRMED object-store `stored_file`
 *   keys (resolved via the storage facade) so the orchestrator
 *   (approveErasureHandler → physicalDeleteErasedFiles) never issues a
 *   silently-succeeding S3 delete against a legacy free-form path. Legacy
 *   non-object-store attachments have no resolvable object-store object — their DB
 *   PHI is fully erased here; any true filesystem object is a documented residual
 *   (the unvalidated-filePath data-model gap → roadmap: validate filePath at write
 *   time / migrate legacy rows).
 */

import { eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAttachments } from './attachment.schema';
import { patients } from '../../patient/repos/patient.schema';
import { filterExistingStoredFileIds } from '@/handlers/storage/repos/storage-imaging.facade';
import { ERASED_MARKER } from './clinical-erasure.facade';

/** Storage file ids whose S3 objects the storage service must physically delete. */
export interface AttachmentErasureResult {
  /** Count of dental_attachment rows anonymized. */
  rowsAnonymized: number;
  /**
   * Storage `file` ids (== the attachment `filePath`, == the S3 key) backing the
   * erased attachments. The caller MUST hand these to the storage service for
   * physical S3 object + storage-row deletion (this DB facade cannot reach S3).
   * Empty when the person has no attachments.
   */
  fileIdsPendingS3Delete: string[];
}

/**
 * Anonymize the PII of every clinical attachment belonging to the patient
 * profile(s) linked to `subjectPersonId`, and return the storage file ids whose
 * S3 objects still require physical deletion. Covers already soft-deleted rows
 * too (their PHI + S3 object persist until erased). Idempotent: re-running
 * re-writes the same markers, preserves the original `deletedAt`, and recomputes
 * the file-id list from current rows.
 */
export async function anonymizeAttachmentsByPersonDetailed(
  db: DatabaseInstance,
  subjectPersonId: string,
): Promise<AttachmentErasureResult> {
  // Resolve the patient profile(s) for this person (1:1 in practice).
  const pts = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.person, subjectPersonId));
  if (pts.length === 0) return { rowsAnonymized: 0, fileIdsPendingS3Delete: [] };
  const patientIds = pts.map((p) => p.id);

  // Capture filePaths BEFORE redaction so the S3-delete handles survive the
  // UPDATE that scrubs them. Covers already soft-deleted rows too (their PHI +
  // any object persist until erased).
  const rows = await db
    .select({ filePath: dentalAttachments.filePath })
    .from(dentalAttachments)
    .where(inArray(dentalAttachments.patientId, patientIds));
  if (rows.length === 0) return { rowsAnonymized: 0, fileIdsPendingS3Delete: [] };

  // Surface ONLY confirmed object-store keys for physical S3 deletion — a legacy
  // free-form path (e.g. `/uploads/x.jpg`) is never handed to the storage client
  // (its idempotent DeleteObject would "succeed" against a bogus key → a false
  // erasure). filePath order/dedup is preserved against the confirmed set.
  const candidatePaths = rows
    .map((r) => r.filePath)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
  const confirmed = new Set(await filterExistingStoredFileIds(db, candidatePaths));
  const fileIdsPendingS3Delete = candidatePaths.filter((p) => confirmed.has(p));

  const res = await db
    .update(dentalAttachments)
    .set({
      fileName: ERASED_MARKER,
      note: null,
      filePath: ERASED_MARKER, // redact: the path itself can carry PHI (legacy rows)
      // Erasure marker; COALESCE preserves the first erasure/delete time on re-run.
      deletedAt: sql`COALESCE(${dentalAttachments.deletedAt}, now())`,
      updatedAt: new Date(),
    })
    .where(inArray(dentalAttachments.patientId, patientIds))
    .returning({ id: dentalAttachments.id });

  return { rowsAnonymized: res.length, fileIdsPendingS3Delete };
}

/**
 * ErasureTarget-compatible entry point. Returns the count of attachment rows
 * anonymized. The storage file ids requiring physical S3 deletion are available
 * via {@link anonymizeAttachmentsByPersonDetailed} for callers that wire the
 * storage-service follow-up.
 */
export async function anonymizeAttachmentsByPerson(
  db: DatabaseInstance,
  subjectPersonId: string,
): Promise<number> {
  const { rowsAnonymized } = await anonymizeAttachmentsByPersonDetailed(db, subjectPersonId);
  return rowsAnonymized;
}
