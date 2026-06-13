/**
 * batchUpsertCephLandmarks handler
 *
 * POST /dental/imaging/images/{imageId}/ceph/landmarks
 *
 * Upserts landmarks for a ceph image. Skips locked landmarks silently.
 * Recomputes analysis after write. Returns {items, analysis}.
 * Ceph is Addon-tier only (resolveImagingTier free → 403).
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { getBranchRole } from '@/handlers/shared/assert-branch-role';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { computeCephAnalysis } from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';
import { isCephDraftRole, isCephSignoffRole } from './repos/imaging_ceph.schema';

type LandmarkInput = {
  landmarkCode: string;
  x: number;
  y: number;
  source?: string;
  confidence?: number;
  status?: string;
};

export async function batchUpsertCephLandmarks(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };
  const body = (await ctx.req.json()) as { landmarks: LandmarkInput[] };

  // P1-10 SAFETY (plan §4): an AI write must NOT be able to confirm/lock in the
  // same write. AI output is a DRAFT — only a human may drive placed → confirmed
  // → locked via updateCephLandmark. No code path auto-confirms an AI landmark.
  const illegalAiWrite = (body.landmarks ?? []).find(
    (lm) =>
      (lm.source === 'ai' || lm.source === 'ai_corrected') &&
      (lm.status === 'confirmed' || lm.status === 'locked'),
  );
  if (illegalAiWrite) {
    throw new BusinessLogicError(
      `AI-sourced landmark '${illegalAiWrite.landmarkCode}' cannot be written as ` +
        `'${illegalAiWrite.status}'. AI predictions must enter at 'placed' and be ` +
        `confirmed by a human.`,
      'AI_LANDMARK_CANNOT_AUTOCONFIRM',
    );
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const image = await imagingRepo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // G4-B sign-off split: DRAFT roles (incl. dental_assistant) may place/edit
  // landmarks; non-members/non-clinical roles → 404 (anti-enumeration). An
  // assistant (draft-but-not-signoff) may NOT write 'confirmed'/'locked' — that
  // is the clinician's sign-off (403, explicit because they ARE a member).
  const role = await getBranchRole(db, user.id, study.branchId);
  if (!isCephDraftRole(role)) {
    throw new NotFoundError('Image not found');
  }
  if (!isCephSignoffRole(role)) {
    const finalizeAttempt = (body.landmarks ?? []).find(
      (lm) => lm.status === 'confirmed' || lm.status === 'locked',
    );
    if (finalizeAttempt) {
      throw new ForbiddenError(
        `Landmark '${finalizeAttempt.landmarkCode}' cannot be set to '${finalizeAttempt.status}'. ` +
          `Assistants may prepare drafts ('placed') only; a dentist must confirm or lock.`,
        'ASSISTANT_CANNOT_FINALIZE',
      );
    }
  }

  const imagingTier = await getImagingTierForBranch(db, study.branchId);
  if (imagingTier !== 'addon') {
    logger?.warn(
      { event: 'dental-imaging.tier-blocked', userId: user.id, feature: 'ceph_landmarks_upsert', currentTier: imagingTier },
      'Tier gate blocked access',
    );
    throw new ForbiddenError(
      'Cephalometric analysis requires an imaging add-on. Upgrade your plan.',
      'IMAGING_TIER_REQUIRED',
    );
  }

  await cephRepo.batchUpsert(
    body.landmarks.map((lm) => ({
      imageId,
      landmarkCode: lm.landmarkCode,
      x: lm.x,
      y: lm.y,
      source: lm.source as 'manual' | 'ai' | 'ai_corrected' | undefined,
      confidence: lm.confidence,
      status: lm.status as 'placed' | 'confirmed' | 'locked' | undefined,
    })),
    user.id,
  );

  const allLandmarks = await cephRepo.listByImage(imageId);
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));
  const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);
  const analysisRow = await cephRepo.upsertAnalysis(imageId, {
    measurements: result.measurements,
    calibrationValue: image.pixelSpacingMm,
    calibrationMethod: image.pixelSpacingMm ? 'manual_ruler' : 'not_calibrated',
  });

  logger?.info(
    { imageId, count: body.landmarks.length, action: 'ceph_landmarks_batch_upsert', by: user.id },
    'Ceph landmarks batch upserted',
  );

  return ctx.json(
    {
      items: allLandmarks,
      analysis: {
        imageId,
        analysisType: analysisRow.analysisType,
        measurements: result.measurements,
        missing: result.missing,
        uncalibrated: result.uncalibrated,
        calibrationValue: analysisRow.calibrationValue,
        calibrationMethod: analysisRow.calibrationMethod,
        calibratedAt: analysisRow.calibratedAt,
        calibratedBy: analysisRow.calibratedBy,
        updatedAt: analysisRow.updatedAt,
      },
    },
    200,
  );
}
