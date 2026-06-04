/**
 * getCbctViewerLink handler (P2-7 CBCT Phase 1 / A1).
 *
 * GET /dental/imaging/studies/:studyId/cbct/viewer-link
 *
 * Returns a presigned GET download URL for the CBCT DICOM object so the clinician
 * opens it in their own DICOM viewer (RadiAnt / Horos / vendor viewer). This is the
 * v1 "Open in viewer" handoff — NO in-app 3-D rendering (Phase 3). Reuses the same
 * generateDownloadUrl presign pattern as listPatientImages.
 *
 * Branch-scoped (read access via the study's branchId) + audited (PHI read).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { StorageProvider } from '@/core/storage';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { addMinutes } from 'date-fns';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { ImagingRepository } from './repos/imaging.repo';
import { logAuditEvent } from '@/core/audit-logger';

export async function getCbctViewerLink(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { studyId } = ctx.req.param() as { studyId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const study = await repo.findStudyById(studyId);
  if (!study) throw new NotFoundError('Imaging study not found');

  await assertBranchAccess(db, user.id, study.branchId);

  const images = await repo.listImagesByStudy(studyId);
  // The CBCT volume is the (single, per D-CBCT-1) volume image in the study.
  const volume = images.find((img) => img.isVolume) ?? images[0];
  if (!volume) throw new NotFoundError('No image found for this study');

  if (!volume.isVolume) {
    // Honesty guard: this endpoint is for volumes only. A flat study should use
    // the ordinary download path (listPatientImages downloadUrl).
    throw new BusinessLogicError(
      'This study is not a CBCT volume; use the standard image download instead.',
      'NOT_A_VOLUME',
    );
  }

  const storage = ctx.get('storage') as StorageProvider;
  const downloadUrl = await storage.generateDownloadUrl(volume.fileId);
  // Mirror the storage downloadUrlExpiry default (15 min) for the surfaced expiry.
  const config = ctx.get('config') as { storage?: { downloadUrlExpiry?: number } } | undefined;
  const expirySeconds = config?.storage?.downloadUrlExpiry ?? 900;
  const expiresAt = addMinutes(new Date(), Math.round(expirySeconds / 60));

  const logger = ctx.get('logger');
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: study.branchId,
    branchId: study.branchId,
    action: 'imaging_study.cbct_viewer_link',
    eventType: 'data-access',
    resourceType: 'imaging_study',
    resourceId: study.id,
    metadata: { patientId: study.patientId, branchId: study.branchId, imageId: volume.id },
  });

  return ctx.json(
    {
      viewerKind: 'download' as const,
      downloadUrl,
      expiresAt,
      isVolume: true,
      frameCount: volume.frameCount ?? null,
    },
    200,
  );
}
