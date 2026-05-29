/**
 * listCephLandmarks handler
 *
 * GET /dental/imaging/images/{imageId}/ceph/landmarks
 *
 * Returns all landmarks for a ceph image plus the current analysis.
 * Empty state (no landmarks) returns items:[] with all codes in missing[].
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { computeCephAnalysis } from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';

export async function listCephLandmarks(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const image = await imagingRepo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  try {
    await assertBranchAccess(db, user.id, study.branchId);
  } catch {
    throw new NotFoundError('Image not found');
  }

  const imagingTier = await getImagingTierForBranch(db, study.branchId);
  if (imagingTier !== 'addon') {
    ctx.get('logger')?.warn(
      { event: 'dental-imaging.tier-blocked', userId: user.id, feature: 'ceph_landmarks_list', currentTier: imagingTier },
      'Tier gate blocked access',
    );
    throw new ForbiddenError('Cephalometric analysis requires an imaging add-on. Upgrade your plan.');
  }

  const allLandmarks = await cephRepo.listByImage(imageId);
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));
  const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);
  const analysisRow = await cephRepo.findAnalysis(imageId);

  return ctx.json(
    {
      items: allLandmarks,
      analysis: {
        imageId,
        analysisType: 'steiner_hybrid_sn',
        measurements: result.measurements,
        missing: result.missing,
        uncalibrated: result.uncalibrated,
        calibrationValue: analysisRow?.calibrationValue ?? null,
        calibrationMethod: analysisRow?.calibrationMethod ?? null,
        calibratedAt: analysisRow?.calibratedAt ?? null,
        calibratedBy: analysisRow?.calibratedBy ?? null,
        updatedAt: analysisRow?.updatedAt ?? new Date(),
      },
    },
    200,
  );
}
