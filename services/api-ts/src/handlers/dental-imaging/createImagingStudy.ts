/**
 * createImagingStudy handler
 *
 * POST /dental/imaging/studies
 *
 * Creates an imaging study and returns a presigned upload URL for the image file.
 * Validates MIME type against the allowed list (BR-034).
 * Role-gated: dentist, associate, hygienist may upload.
 */

import { v4 as uuidv4 } from 'uuid';
import { addMinutes } from 'date-fns';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import type { StorageProvider } from '@/core/storage';
import { UnauthorizedError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { ImagingRepository } from './repos/imaging.repo';
import { ALLOWED_IMAGING_MIME_TYPES } from './repos/imaging.schema';
import { logAuditEvent } from '@/core/audit-logger';

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
  };

  // V-IMG-003 / §15: unsupported MIME → 422 UNSUPPORTED_MIME_TYPE (not 400 VALIDATION_ERROR).
  // BR-034: MIME type allowlist check (before any other work)
  if (!ALLOWED_IMAGING_MIME_TYPES.includes(body.mimeType as any)) {
    throw new BusinessLogicError(
      `Unsupported image format. Allowed: ${ALLOWED_IMAGING_MIME_TYPES.join(', ')}`,
      'UNSUPPORTED_MIME_TYPE',
    );
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  // Branch-level authorization + role gate (CLINICAL_WRITE)
  await assertBranchRole(db, user.id, body.branchId, ['dentist_owner', 'dentist_associate']);

  // V-IMG-001 / AC-IMG-001 / BR-016c: cephalometric studies are addon-tier only.
  // Gate at study create — not just on downstream ceph endpoints — so a free/basic
  // org cannot create the ceph study record at all. Uses the same tier helper the
  // ceph handlers use; throws the dedicated IMAGING_TIER_REQUIRED code (§9 upgrade UI).
  if ((body.modality ?? 'other') === 'cephalometric') {
    const logger = ctx.get('logger');
    const imagingTier = await getImagingTierForBranch(db, body.branchId);
    if (imagingTier !== 'addon') {
      logger?.warn(
        { event: 'dental-imaging.tier-blocked', userId: user.id, feature: 'cephalometric_study_create', currentTier: imagingTier },
        'Tier gate blocked access',
      );
      throw new ForbiddenError(
        'Cephalometric imaging requires an imaging add-on. Upgrade your plan.',
        'IMAGING_TIER_REQUIRED',
      );
    }
  }

  const storage = ctx.get('storage') as StorageProvider;

  // Create the study record
  const study = await repo.createStudy({
    patientId: body.patientId,
    visitId: body.visitId ?? null,
    branchId: body.branchId,
    acquiredBy: user.id,
    modality: (body.modality ?? 'other') as any,
  });

  // Generate presigned upload URL for the image file
  const fileId = uuidv4();
  const uploadUrl = await storage.generateUploadUrl(fileId, body.mimeType);
  const expiresAt = addMinutes(new Date(), 5);

  // Persist the imaging_study_image row immediately so the image is queryable
  // after the client completes the PUT to the presigned URL (BR-025)
  const image = await repo.createImage({
    studyId: study.id,
    fileId,
    modality: (body.modality ?? 'other') as any,
    dicomMetadata: body.filename ? { fileName: body.filename } : null,
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
      uploadMethod: 'PUT',
      fileId,
      expiresAt,
    },
    201,
  );
}
