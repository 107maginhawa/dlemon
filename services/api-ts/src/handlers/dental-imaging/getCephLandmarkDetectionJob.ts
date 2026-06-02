/**
 * getCephLandmarkDetectionJob handler  (P1-10 Phase 0)
 *
 * GET /dental/imaging/images/{imageId}/ceph/landmarks/detect/{jobId}
 *
 * Job-status poll for the detect op. Phase 0 detection resolves synchronously, so
 * this reports the current persisted state: 'succeeded' once AI-sourced landmarks
 * exist for the image, else 'pending'. The async-job shape is preserved so a Phase-1
 * self-hosted/vendor detector (slow inference) can populate real job rows behind the
 * same contract with no handler/route change.
 *
 * Inherits the same gates as detect: kill-switch flag, addon tier, branch membership.
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import type { Config } from '@/core/config';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { computeCephAnalysis } from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';
import { FAKE_DETECTOR_MODEL_VERSION, FAKE_DETECTOR_PROVIDER } from './repos/ceph-landmark-detector';

export async function getCephLandmarkDetectionJob(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId, jobId } = ctx.req.param() as { imageId: string; jobId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const config = ctx.get('config') as Config | undefined;

  if (!config?.features?.dentalImagingAutoLandmark) {
    throw new ForbiddenError(
      'Automatic landmark detection is currently disabled.',
      'FEATURE_DISABLED',
    );
  }

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
  if (imagingTier !== 'addon') {
    throw new ForbiddenError(
      'Cephalometric analysis requires an imaging add-on. Upgrade your plan.',
      'IMAGING_TIER_REQUIRED',
    );
  }

  const allLandmarks = await cephRepo.listByImage(imageId);
  const aiLandmarks = allLandmarks.filter(
    (l) => l.source === 'ai' || l.source === 'ai_corrected',
  );
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));
  const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);
  const analysisRow = await cephRepo.upsertAnalysis(imageId, {
    measurements: result.measurements,
    calibrationValue: image.pixelSpacingMm,
    calibrationMethod: image.pixelSpacingMm ? 'manual_ruler' : 'not_calibrated',
  });

  const status = aiLandmarks.length > 0 ? 'succeeded' : 'pending';

  return ctx.json(
    {
      jobId,
      status,
      modelVersion: FAKE_DETECTOR_MODEL_VERSION,
      provider: FAKE_DETECTOR_PROVIDER,
      predictions: aiLandmarks.map((l) => ({
        landmarkCode: l.landmarkCode,
        x: l.x,
        y: l.y,
        confidence: l.confidence ?? 0,
      })),
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
