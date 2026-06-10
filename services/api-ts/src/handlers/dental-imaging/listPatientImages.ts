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
import { viewerKindFor, type ImagingViewerKind } from './repos/imaging.schema';
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
  // P2-7 CBCT: volume affordance discriminator (legacy/2-D = 'image').
  isVolume: boolean;
  frameCount: number | null;
  viewerKind: ImagingViewerKind;
  // G5 library metadata (legacy attachments default to diagnostic/ok/untagged).
  isDiagnostic: boolean;
  qualityStatus: 'ok' | 'retake';
  retakeReason: string | null;
  tags: string[];
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
    // Legacy attachments are always flat 2-D rasters.
    isVolume: false,
    frameCount: null,
    viewerKind: 'image',
    // Legacy attachments carry no imaging metadata — treat as diagnostic/ok/untagged.
    isDiagnostic: true,
    qualityStatus: 'ok',
    retakeReason: null,
    tags: [],
  };
}

// ---------------------------------------------------------------------------
// G5 library filters (pure, exported for unit tests)
// ---------------------------------------------------------------------------

export interface ImageLibraryFilters {
  isDiagnostic?: boolean;
  qualityStatus?: 'ok' | 'retake';
  tag?: string;
}

/**
 * Apply the optional G5 library filters to a merged image list. Undefined filters
 * are no-ops; tag match is exact (case-insensitive). Legacy attachments carry the
 * defaults set in mapLegacyAttachment, so they filter consistently with imaging rows.
 */
export function applyImageLibraryFilters(
  items: PatientImageItem[],
  filters: ImageLibraryFilters,
): PatientImageItem[] {
  const tagNeedle = filters.tag?.trim().toLowerCase();
  return items.filter((it) => {
    if (filters.isDiagnostic !== undefined && it.isDiagnostic !== filters.isDiagnostic) return false;
    if (filters.qualityStatus !== undefined && it.qualityStatus !== filters.qualityStatus) return false;
    if (tagNeedle) {
      const hasTag = it.tags.some((t) => t.toLowerCase() === tagNeedle);
      if (!hasTag) return false;
    }
    return true;
  });
}

/** Parse the raw `isDiagnostic` query string into a tri-state boolean filter. */
function parseBoolFilter(raw: string | undefined): boolean | undefined {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
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
      const isVolume = row.isVolume === true;
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
        // P2-7 CBCT: surface the volume affordance so the list renders a volume card
        // (never a flat thumbnail) for CBCT / multi-frame objects.
        isVolume,
        frameCount: row.frameCount ?? null,
        viewerKind: viewerKindFor({ isVolume, modality: row.modality }),
        isDiagnostic: row.isDiagnostic ?? true,
        qualityStatus: (row.qualityStatus ?? 'ok') as 'ok' | 'retake',
        retakeReason: row.retakeReason ?? null,
        tags: Array.isArray(row.tags) ? row.tags : [],
      };
    }),
  );

  // 2. Fetch legacy dental_attachment rows for patient, filtered by branch via visit join
  const legacyRows = await getLegacyAttachmentImages(db, patientId, branchId);
  const legacyItems = legacyRows.map(mapLegacyAttachment);

  // 3. Combine and sort by createdAt DESC
  const merged: PatientImageItem[] = [...imagingItems, ...legacyItems].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  // G5: apply optional library filters (diagnostic-only / quality / tag) post-merge
  // so imaging + legacy rows filter uniformly.
  const qualityRaw = ctx.req.query('qualityStatus');
  const allItems = applyImageLibraryFilters(merged, {
    isDiagnostic: parseBoolFilter(ctx.req.query('isDiagnostic')),
    qualityStatus: qualityRaw === 'ok' || qualityRaw === 'retake' ? qualityRaw : undefined,
    tag: ctx.req.query('tag') ?? undefined,
  });

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
