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
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { computeCephAnalysis } from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';

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

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const image = await imagingRepo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  try {
    await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);
  } catch {
    throw new NotFoundError('Image not found');
  }

  const imagingTier = await getImagingTierForBranch(db, study.branchId);
  if (imagingTier === 'free') {
    throw new ForbiddenError('Cephalometric analysis requires an imaging add-on. Upgrade your plan.');
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
