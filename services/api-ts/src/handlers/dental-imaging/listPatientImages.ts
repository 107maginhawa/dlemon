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

import { and, eq, isNull, inArray } from 'drizzle-orm';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { ImagingRepository } from './repos/imaging.repo';
import { dentalAttachments, type DentalAttachment } from '@/handlers/dental-clinical/repos/attachment.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

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
}

export function mapLegacyAttachment(att: DentalAttachment): PatientImageItem {
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

  // Map imaging rows
  const imagingItems: PatientImageItem[] = imagingRows.map((row) => {
    const meta = row.dicomMetadata as { fileName?: string } | null;
    return {
      id: row.id,
      source: 'imaging',
      modality: row.modality,
      fileName: meta?.fileName ?? (row.fileId ?? ''),
      mimeType: '',
      fileSizeBytes: 0,
      studyId: row.studyId,
      visitId: null,
      toothNumbers: [],
      createdAt: row.createdAt,
    };
  });

  // 2. Fetch legacy dental_attachment rows for patient, filtered by branch via visit join
  const legacyRows = await db
    .select({
      id: dentalAttachments.id,
      patientId: dentalAttachments.patientId,
      visitId: dentalAttachments.visitId,
      imageType: dentalAttachments.imageType,
      fileName: dentalAttachments.fileName,
      mimeType: dentalAttachments.mimeType,
      fileSizeBytes: dentalAttachments.fileSizeBytes,
      toothNumbers: dentalAttachments.toothNumbers,
      createdAt: dentalAttachments.createdAt,
      deletedAt: dentalAttachments.deletedAt,
    })
    .from(dentalAttachments)
    .innerJoin(dentalVisits, eq(dentalAttachments.visitId, dentalVisits.id))
    .where(
      and(
        eq(dentalAttachments.patientId, patientId),
        eq(dentalVisits.branchId, branchId),
        isNull(dentalAttachments.deletedAt),
        inArray(dentalAttachments.imageType, ['xray', 'photo', 'scan']),
      ),
    );

  const legacyItems = legacyRows.map((row) => mapLegacyAttachment(row as DentalAttachment));

  // 3. Combine and sort by createdAt DESC
  const allItems: PatientImageItem[] = [...imagingItems, ...legacyItems].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return ctx.json({ items: allItems, total: allItems.length }, 200);
}
