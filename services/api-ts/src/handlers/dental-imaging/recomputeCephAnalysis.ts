/**
 * recomputeCephAnalysis handler
 *
 * POST /dental/imaging/images/{imageId}/ceph/analysis/recompute
 *
 * Idempotent recompute of ceph analysis from current landmarks + calibration.
 * Does NOT touch existing ceph_report rows (D-I immutability).
 * Returns CephAnalysis (not the full list response).
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

export async function recomputeCephAnalysis(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };

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
  if (imagingTier !== 'addon') {
    logger?.warn(
      { event: 'dental-imaging.tier-blocked', userId: user.id, feature: 'ceph_analysis_recompute', currentTier: imagingTier },
      'Tier gate blocked access',
    );
    throw new ForbiddenError('Cephalometric analysis requires an imaging add-on. Upgrade your plan.');
  }

  const allLandmarks = await cephRepo.listByImage(imageId);
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));
  const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);

  // upsert analysis — does NOT touch any ceph_report rows (D-I)
  const analysisRow = await cephRepo.upsertAnalysis(imageId, {
    measurements: result.measurements,
    calibrationValue: image.pixelSpacingMm,
    calibrationMethod: image.pixelSpacingMm ? 'manual_ruler' : 'not_calibrated',
  });

  logger?.info(
    { imageId, action: 'ceph_analysis_recompute', by: user.id },
    'Ceph analysis recomputed',
  );

  return ctx.json(
    {
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
    200,
  );
}
