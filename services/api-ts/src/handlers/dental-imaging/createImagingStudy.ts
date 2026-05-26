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
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { ImagingRepository } from './repos/imaging.repo';
import { ALLOWED_IMAGING_MIME_TYPES } from './repos/imaging.schema';

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

  // BR-034: MIME type allowlist check (before any other work)
  if (!ALLOWED_IMAGING_MIME_TYPES.includes(body.mimeType as any)) {
    throw new ValidationError(
      `Unsupported image format. Allowed: ${ALLOWED_IMAGING_MIME_TYPES.join(', ')}`,
    );
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  // Branch-level authorization + role gate (CLINICAL_WRITE)
  await assertBranchRole(db, user.id, body.branchId, ['dentist_owner', 'dentist_associate']);

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
