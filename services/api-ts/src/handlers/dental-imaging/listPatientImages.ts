/**
 * listPatientImages handler
 *
 * GET /dental/patients/:patientId/images
 *
 * Returns a union of:
 *   - imaging_study_image rows (source: 'imaging')
 *   - dental_attachment rows with imageType IN ('xray','photo','scan') (source: 'legacy')
 *
 * Sorted by createdAt DESC.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { StorageProvider } from '@/core/storage';
import type { User } from '@/types/auth';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
import { ImagingRepository } from './repos/imaging.repo';
import { getLegacyAttachmentImages, type LegacyAttachmentImage } from '@/handlers/dental-clinical/repos/clinical-imaging.facade';

// ---------------------------------------------------------------------------
// Legacy attachment mapping (exported for unit tests)
// ---------------------------------------------------------------------------

const LEGACY_MODALITY_MAP: Record<string, string> = {
  xray: 'other',
  photo: 'intraoral_photo',
  scan: 'other',
};

export interface PatientImageItem {
  id: string;
  source: 'imaging' | 'legacy';
  modality: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  studyId: string | null;
  visitId: string | null;
  toothNumbers: number[];
  createdAt: Date;
  downloadUrl: string | null;
}

export function mapLegacyAttachment(att: LegacyAttachmentImage): PatientImageItem {
  return {
    id: att.id,
    source: 'legacy',
    modality: LEGACY_MODALITY_MAP[att.imageType] ?? 'other',
    fileName: att.fileName,
    mimeType: att.mimeType,
    fileSizeBytes: att.fileSizeBytes,
    studyId: null,
    visitId: att.visitId ?? null,
    toothNumbers: Array.isArray(att.toothNumbers) ? (att.toothNumbers as number[]) : [],
    createdAt: att.createdAt,
    // Legacy attachments are stored by filePath, not object-store fileId — no presigned URL.
    downloadUrl: null,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function listPatientImages(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.param() as { patientId: string };
  const branchId = ctx.req.query('branchId');
  if (!branchId) {
    return ctx.json({ error: 'branchId query parameter is required', code: 'VALIDATION_ERROR' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  // Always enforce branch access before returning any patient data (PHI protection)
  await assertBranchAccess(db, user.id, branchId);

  // 1. Fetch new imaging images filtered by branch
  const imagingRows = await repo.listImagingImagesForPatient(patientId, branchId);

  // Presigned GET URL per imaging object so the viewer can load the bytes directly.
  // generateDownloadUrl signs the object key (= fileId) and does NOT require a
  // stored_file row, so it works for seeded images written straight to the bucket.
  const storage = ctx.get('storage') as StorageProvider | undefined;
  async function downloadUrlFor(fileId: string | null): Promise<string | null> {
    if (!fileId || !storage) return null;
    try {
      return await storage.generateDownloadUrl(fileId);
    } catch {
      return null;
    }
  }

  // Map imaging rows
  const imagingItems: PatientImageItem[] = await Promise.all(
    imagingRows.map(async (row) => {
      const meta = row.dicomMetadata as { fileName?: string; mimeType?: string } | null;
      return {
        id: row.id,
        source: 'imaging' as const,
        modality: row.modality,
        fileName: meta?.fileName ?? (row.fileId ?? ''),
        mimeType: meta?.mimeType ?? '',
        fileSizeBytes: row.fileSizeBytes,
        studyId: row.studyId,
        visitId: null,
        toothNumbers: [],
        createdAt: row.createdAt,
        downloadUrl: await downloadUrlFor(row.fileId),
      };
    }),
  );

  // 2. Fetch legacy dental_attachment rows for patient, filtered by branch via visit join
  const legacyRows = await getLegacyAttachmentImages(db, patientId, branchId);
  const legacyItems = legacyRows.map(mapLegacyAttachment);

  // 3. Combine and sort by createdAt DESC
  const allItems: PatientImageItem[] = [...imagingItems, ...legacyItems].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  // V-IMG-006: patient image list exposes radiograph PHI — audit the read.
  await logAuditEvent(db, ctx.get('logger'), {
    personId: user.id,
    tenantId: branchId,
    branchId,
    action: 'imaging_patient_images.read',
    eventType: 'data-access',
    resourceType: 'imaging_patient_images',
    resourceId: patientId,
    metadata: { patientId, branchId, count: allItems.length },
  });

  return ctx.json({ items: allItems, total: allItems.length }, 200);
}
