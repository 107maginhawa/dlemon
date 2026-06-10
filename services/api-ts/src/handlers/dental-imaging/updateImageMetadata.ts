/**
 * updateImageMetadata handler
 *
 * PATCH /dental/imaging/images/:imageId/metadata
 *
 * G5: partial update of an image's library metadata (diagnostic flag, acquisition
 * quality / retake reason, organizational tags). Only the supplied fields change.
 * No imaging tier gate — metadata is available at all tiers.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { ImagingRepository } from './repos/imaging.repo';

const QUALITY_STATUSES = ['ok', 'retake'] as const;
type QualityStatus = (typeof QUALITY_STATUSES)[number];
const TAG_MAX_LEN = 50;
const MAX_TAGS = 30;
const RETAKE_REASON_MAX_LEN = 500;

export interface ImageMetadataPatch {
  isDiagnostic?: boolean;
  qualityStatus?: QualityStatus;
  retakeReason?: string | null;
  tags?: string[];
}

export async function updateImageMetadata(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };
  const body = (await ctx.req.json().catch(() => ({}))) as {
    isDiagnostic?: unknown;
    qualityStatus?: unknown;
    retakeReason?: unknown;
    tags?: unknown;
  };

  const patch: ImageMetadataPatch = {};

  if (body.isDiagnostic !== undefined) {
    if (typeof body.isDiagnostic !== 'boolean') {
      throw new ValidationError('isDiagnostic must be a boolean');
    }
    patch.isDiagnostic = body.isDiagnostic;
  }

  if (body.qualityStatus !== undefined) {
    if (typeof body.qualityStatus !== 'string' || !(QUALITY_STATUSES as readonly string[]).includes(body.qualityStatus)) {
      throw new ValidationError("qualityStatus must be 'ok' or 'retake'");
    }
    patch.qualityStatus = body.qualityStatus as QualityStatus;
  }

  if (body.retakeReason !== undefined) {
    if (body.retakeReason === null) {
      patch.retakeReason = null;
    } else if (typeof body.retakeReason === 'string') {
      const trimmed = body.retakeReason.trim();
      patch.retakeReason = trimmed.length > 0 ? trimmed.slice(0, RETAKE_REASON_MAX_LEN) : null;
    } else {
      throw new ValidationError('retakeReason must be a string or null');
    }
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== 'string')) {
      throw new ValidationError('tags must be an array of strings');
    }
    // Normalize: trim, drop blanks, clamp length, de-dupe, cap count.
    const normalized = [
      ...new Set(
        (body.tags as string[])
          .map((t) => t.trim().slice(0, TAG_MAX_LEN))
          .filter((t) => t.length > 0),
      ),
    ].slice(0, MAX_TAGS);
    patch.tags = normalized;
  }

  if (Object.keys(patch).length === 0) {
    throw new ValidationError('No metadata fields supplied');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const image = await repo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Role-aware branch authorization — metadata is a clinical write.
  await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);

  const updated = await repo.updateImageMetadata(imageId, patch);

  return ctx.json(updated, 200);
}
