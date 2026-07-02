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
import { UnauthorizedError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import { ImagingRepository } from './repos/imaging.repo';

const QUALITY_STATUSES = ['ok', 'retake'] as const;
type QualityStatus = (typeof QUALITY_STATUSES)[number];
const TAG_MAX_LEN = 50;
const MAX_TAGS = 30;
const RETAKE_REASON_MAX_LEN = 500;
// §capture-date: a "today" date entered in a timezone ahead of the server's UTC
// clock can legitimately read up to ~a day ahead — tolerate that, reject beyond.
const FUTURE_CAPTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export interface ImageMetadataPatch {
  isDiagnostic?: boolean;
  qualityStatus?: QualityStatus;
  retakeReason?: string | null;
  tags?: string[];
  // §capture-date: a user correction always stamps source=manual (server-set).
  capturedAt?: Date;
  capturedAtSource?: 'manual';
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
    capturedAt?: unknown;
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

  // §capture-date: a user correction to the acquisition date. Stamps source=manual
  // and is audited (below) so the old→new change is on the append-only record.
  if (body.capturedAt !== undefined) {
    if (typeof body.capturedAt !== 'string') {
      throw new ValidationError('capturedAt must be an ISO date string');
    }
    const parsed = new Date(body.capturedAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError('capturedAt must be a valid date');
    }
    if (parsed.getTime() > Date.now() + FUTURE_CAPTURE_SKEW_MS) {
      throw new BusinessLogicError('Capture date cannot be in the future', 'INVALID_CAPTURE_DATE');
    }
    patch.capturedAt = parsed;
    patch.capturedAtSource = 'manual';
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

  // §capture-date: dental images are legal records — a capture-date correction is
  // an operator override of the record's clinical date, so it goes on the
  // append-only audit trail with the old→new value. Other metadata edits (quality
  // flags/tags) are not date-of-record and stay unaudited as before.
  if (patch.capturedAt) {
    await logAuditEvent(db, ctx.get('logger'), {
      personId: user.id,
      tenantId: study.branchId,
      branchId: study.branchId,
      action: 'imaging_image.capture_date_update',
      eventType: 'data-modification',
      resourceType: 'imaging_study_image',
      resourceId: imageId,
      metadata: {
        previous: image.capturedAt ? new Date(image.capturedAt).toISOString() : null,
        previousSource: image.capturedAtSource ?? null,
        next: patch.capturedAt.toISOString(),
        source: 'manual',
      },
    });
  }

  return ctx.json(updated, 200);
}
