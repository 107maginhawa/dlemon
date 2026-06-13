/**
 * createImagingStudy handler
 *
 * POST /dental/imaging/studies
 *
 * Creates an imaging study and returns a presigned upload URL for the image file.
 * Validates MIME type against the allowed list (BR-034).
 * Role-gated: dentist_owner, dentist_associate, hygienist, and dental_assistant
 * may capture/upload imaging (assistant works under dentist supervision).
 * NOTE: CBCT *finalize* (finalizeCbctStudy) remains dentist-only.
 */

import { v4 as uuidv4 } from 'uuid';
import { addMinutes } from 'date-fns';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import type { StorageProvider } from '@/core/storage';
import { maxUploadSizeForMime, formatByteCeiling } from '@/core/storage';
import type { Config } from '@/core/config';
import { UnauthorizedError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { ImagingRepository } from './repos/imaging.repo';
import { ALLOWED_IMAGING_MIME_TYPES, type AllowedImagingMimeType, type ImagingModality } from './repos/imaging.schema';
import { logAuditEvent } from '@/core/audit-logger';

// P1-9: route large DICOM/CBCT payloads (~50 MB pano) through the S3 multipart
// path. Files at or below this stay on a single presigned PUT (behaviour unchanged
// for ordinary X-ray/photo uploads). 5 MB part size = S3 minimum non-final part.
const DICOM_MIME_TYPE = 'application/dicom';
const MULTIPART_PART_SIZE_BYTES = 5 * 1024 * 1024;
const MULTIPART_THRESHOLD_BYTES = MULTIPART_PART_SIZE_BYTES;
// Plausible mm-per-pixel window for a DICOM-tag-derived calibration value.
const DICOM_SPACING_MIN = 0.01;
const DICOM_SPACING_MAX = 2.0;

export async function createImagingStudy(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = (await ctx.req.json()) as {
    patientId: string;
    visitId?: string;
    branchId: string;
    modality?: string;
    filename: string;
    mimeType: string;
    size: number;
    toothNumbers?: number[];
    sequenceNumber?: number;
    // P1-9: PixelSpacing (mm/px) parsed client-side from the DICOM (0028,0030) tag.
    pixelSpacingMm?: number;
  };

  // V-IMG-003 / §15: unsupported MIME → 422 UNSUPPORTED_MIME_TYPE (not 400 VALIDATION_ERROR).
  // BR-034: MIME type allowlist check (before any other work)
  if (!ALLOWED_IMAGING_MIME_TYPES.includes(body.mimeType as AllowedImagingMimeType)) {
    throw new BusinessLogicError(
      `Unsupported image format. Allowed: ${ALLOWED_IMAGING_MIME_TYPES.join(', ')}`,
      'UNSUPPORTED_MIME_TYPE',
    );
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  // Branch-level authorization + role gate (CLINICAL_WRITE).
  // E2: hygienist + dental_assistant may capture imaging under dentist supervision.
  // (Reconciles the prior doc-vs-code drift: doc said hygienist could upload but
  // the code denied it.) CBCT *finalize* stays dentist-only — see finalizeCbctStudy.
  await assertBranchRole(db, user.id, body.branchId, [
    'dentist_owner',
    'dentist_associate',
    'hygienist',
    'dental_assistant',
  ]);

  const requestedModality = (body.modality ?? 'other') as string;
  const isDicom = body.mimeType === DICOM_MIME_TYPE;
  // P2-7: CBCT is treated as a volume modality (3-D cone-beam). A DICOM upload
  // tagged as cbct routes through the volume path on finalize.
  const isCbct = requestedModality === 'cbct';

  // V-IMG-001 / AC-IMG-001 / BR-016c: cephalometric studies are addon-tier only.
  // P2-7 / AC: CBCT joins the same addon gate (cone-beam is a premium modality).
  // Gate at study create — not just on downstream endpoints — so a free/basic
  // org cannot create the record at all. Uses the same tier helper the ceph
  // handlers use; throws the dedicated IMAGING_TIER_REQUIRED code (§9 upgrade UI).
  if (requestedModality === 'cephalometric' || isCbct) {
    const logger = ctx.get('logger');
    const imagingTier = await getImagingTierForBranch(db, body.branchId);
    if (imagingTier !== 'addon') {
      logger?.warn(
        { event: 'dental-imaging.tier-blocked', userId: user.id, feature: `${requestedModality}_study_create`, currentTier: imagingTier },
        'Tier gate blocked access',
      );
      throw new ForbiddenError(
        isCbct
          ? 'CBCT imaging requires an imaging add-on. Upgrade your plan.'
          : 'Cephalometric imaging requires an imaging add-on. Upgrade your plan.',
        'IMAGING_TIER_REQUIRED',
      );
    }
  }

  // P2-7: per-class upload size ceiling. Images stay at 100 MB; application/dicom
  // (CBCT volumes are 100 MB – several GB) gets the higher DICOM cap, clamped to the
  // absolute hard cap. Reject oversized payloads BEFORE issuing any upload URL.
  const config = ctx.get('config') as Config | undefined;
  const maxFileSize = config
    ? maxUploadSizeForMime(config.storage, body.mimeType)
    : isDicom
      ? 2 * 1024 * 1024 * 1024
      : 100 * 1024 * 1024;
  if (typeof body.size === 'number' && body.size > maxFileSize) {
    // 422 (mirrors the UNSUPPORTED_MIME_TYPE gate in this handler — a semantic
    // rejection of the payload, per plan §5 "> hard-cap → 422/validation").
    throw new BusinessLogicError(
      `File size exceeds maximum limit of ${formatByteCeiling(maxFileSize)}`,
      'FILE_TOO_LARGE',
    );
  }

  const storage = ctx.get('storage') as StorageProvider;

  // Create the study record
  const study = await repo.createStudy({
    patientId: body.patientId,
    visitId: body.visitId ?? null,
    branchId: body.branchId,
    acquiredBy: user.id,
    modality: (body.modality ?? 'other') as ImagingModality,
  });

  const fileId = uuidv4();
  const expiresAt = addMinutes(new Date(), 5);

  // P1-9: DICOM-tag calibration. When the client parsed a plausible PixelSpacing
  // from the DICOM (0028,0030) tag, persist it as the calibration value so mm
  // measurements work without a manual ruler (provenance recorded in dicomMetadata).
  const dicomSpacing =
    isDicom &&
    typeof body.pixelSpacingMm === 'number' &&
    body.pixelSpacingMm >= DICOM_SPACING_MIN &&
    body.pixelSpacingMm <= DICOM_SPACING_MAX
      ? body.pixelSpacingMm
      : null;

  const dicomMetadata = body.filename
    ? {
        fileName: body.filename,
        ...(isDicom ? { isDicom: true } : {}),
        ...(dicomSpacing != null
          ? { pixelSpacingMm: dicomSpacing, calibrationMethod: 'dicom_tag' as const }
          : {}),
      }
    : null;

  // P1-9: large DICOM/CBCT payloads use S3 multipart; everything else a single PUT.
  const useMultipart = isDicom && body.size > MULTIPART_THRESHOLD_BYTES;

  let uploadUrl = '';
  let uploadMethod: 'PUT' | 'MULTIPART' = 'PUT';
  let uploadId: string | undefined;
  let partSize: number | undefined;
  let partCount: number | undefined;
  let partUrls: string[] | undefined;

  if (useMultipart) {
    uploadMethod = 'MULTIPART';
    uploadId = await storage.initiateMultipartUpload(fileId, body.filename, body.mimeType);
    partSize = MULTIPART_PART_SIZE_BYTES;
    partCount = Math.ceil(body.size / MULTIPART_PART_SIZE_BYTES);
    partUrls = [];
    for (let part = 1; part <= partCount; part++) {
      partUrls.push(await storage.generatePartUploadUrl(fileId, uploadId, part));
    }
  } else {
    uploadUrl = await storage.generateUploadUrl(fileId, body.mimeType);
  }

  // Persist the imaging_study_image row immediately so the image is queryable
  // after the client completes the upload (BR-025)
  const image = await repo.createImage({
    studyId: study.id,
    fileId,
    modality: (body.modality ?? 'other') as ImagingModality,
    pixelSpacingMm: dicomSpacing,
    dicomMetadata,
    sequenceNumber: body.sequenceNumber ?? 0,
  });

  // Link to tooth numbers if provided
  if (body.toothNumbers?.length) {
    for (const toothNumber of body.toothNumbers) {
      await repo.addToothLink(image.id, toothNumber);
    }
  }

  // V-IMG-005 / DE-018 ImagingStudyUploaded: per ADR-006 there is no event bus —
  // this audit row IS the domain-event semantic marker (see MODULE_SPEC §10b).
  const logger = ctx.get('logger');
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: body.branchId,
    branchId: body.branchId,
    action: 'imaging_study.create',
    eventType: 'data-modification',
    resourceType: 'imaging_study',
    resourceId: study.id,
    metadata: { patientId: body.patientId, branchId: body.branchId, modality: body.modality ?? 'other' },
  });

  return ctx.json(
    {
      study,
      image,
      uploadUrl,
      uploadMethod,
      fileId,
      expiresAt,
      ...(uploadId ? { uploadId, partSize, partCount, partUrls } : {}),
    },
    201,
  );
}
