/**
 * finalizeCbctStudy handler (P2-7 CBCT Phase 1 / A1).
 *
 * POST /dental/imaging/studies/:studyId/cbct/finalize
 *
 * Called AFTER the storage multipart `completeMultipartUpload` for a CBCT upload.
 * Parses the DICOM bytes server-side (P1-9 parser), populates the volume metadata
 * columns (spacing, slice thickness, frame count, UIDs), sets is_volume=true, and
 * emits the imaging-study audit row (ADR-006 domain-event marker).
 *
 * Clinical-safety (§8): a malformed / non-DICOM payload clean-fails with a 422 and
 * leaves NO half-written volume state — the image row keeps its pre-finalize values.
 * Role-gated to clinical writers; branch-scoped via the study's branchId.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { ImagingRepository } from './repos/imaging.repo';
import { parseDicomBuffer, DicomParseError } from './repos/dicom-parse';
import type { DicomMetadata } from './repos/imaging.schema';
import { logAuditEvent } from '@/core/audit-logger';

export async function finalizeCbctStudy(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { studyId } = ctx.req.param() as { studyId: string };
  const body = (await ctx.req.json()) as { imageId: string; dicomBase64: string };

  if (!body.imageId || !body.dicomBase64) {
    throw new BusinessLogicError('imageId and dicomBase64 are required', 'VALIDATION_ERROR');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const study = await repo.findStudyById(studyId);
  if (!study) throw new NotFoundError('Imaging study not found');

  // Branch-level authorization + clinical-write role gate (same set as create).
  await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);

  const image = await repo.findImageById(body.imageId);
  if (!image || image.studyId !== studyId) {
    throw new NotFoundError('Imaging study image not found');
  }

  // Decode + defensively parse. A bad payload throws DicomParseError → 422, with
  // NO write to the image row (the volume columns stay at their pre-finalize state).
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(body.dicomBase64, 'base64'));
  } catch {
    throw new BusinessLogicError('dicomBase64 is not valid base64', 'INVALID_DICOM');
  }

  let parsed;
  try {
    parsed = parseDicomBuffer(bytes, (image.dicomMetadata as DicomMetadata | null)?.fileName);
  } catch (err) {
    if (err instanceof DicomParseError) {
      throw new BusinessLogicError(`Malformed DICOM: ${err.message}`, 'INVALID_DICOM');
    }
    throw err;
  }

  // Merge parsed metadata onto any existing stub (preserve fileName/mimeType).
  const existingMeta = (image.dicomMetadata as DicomMetadata | null) ?? {};
  const mergedMeta: DicomMetadata = { ...existingMeta, ...parsed.metadata };

  const updated = await repo.updateVolumeMetadata(body.imageId, {
    isVolume: parsed.isVolume,
    pixelSpacingMm: parsed.pixelSpacingMm ?? image.pixelSpacingMm ?? null,
    sliceThicknessMm: parsed.sliceThicknessMm,
    frameCount: parsed.frameCount,
    seriesInstanceUid: parsed.seriesInstanceUid,
    studyInstanceUid: parsed.studyInstanceUid,
    // CBCT/CT volumes are persisted as modality='cbct' (DICOM encodes CBCT as CT).
    modality: parsed.isVolume && (study.modality === 'cbct' || parsed.modality === 'CT') ? 'cbct' : undefined,
    dicomMetadata: mergedMeta,
  });

  // ADR-006: audit row IS the domain-event marker for the finalized volume.
  const logger = ctx.get('logger');
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: study.branchId,
    branchId: study.branchId,
    action: 'imaging_study.cbct_finalize',
    eventType: 'data-modification',
    resourceType: 'imaging_study',
    resourceId: study.id,
    metadata: {
      patientId: study.patientId,
      branchId: study.branchId,
      imageId: body.imageId,
      isVolume: parsed.isVolume,
      frameCount: parsed.frameCount,
    },
  });

  return ctx.json({ image: updated }, 200);
}
