/**
 * CephMgmt_getCephAnalysis
 *
 * GET /dental/imaging/images/{imageId}/ceph/analysis
 *
 * Returns current analysis for a ceph image. Never 404 — returns empty state
 * with all landmark codes in missing[] when no landmarks have been placed.
 */

import type { ValidatedContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { computeCephAnalysis } from '@monobase/ceph-math';
import type { CephMgmt_getCephAnalysisParams } from '@/generated/openapi/validators';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';

export async function CephMgmt_getCephAnalysis(
  ctx: ValidatedContext<never, never, CephMgmt_getCephAnalysisParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const image = await imagingRepo.findImageById(params.imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  try {
    await assertBranchAccess(db, user.id, study.branchId);
  } catch {
    throw new NotFoundError('Image not found');
  }

  const imagingTier = await getImagingTierForBranch(db, study.branchId);
  if (imagingTier === 'free') {
    throw new ForbiddenError('Cephalometric analysis requires an imaging add-on. Upgrade your plan.');
  }

  const allLandmarks = await cephRepo.listByImage(params.imageId);
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));
  const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);
  const analysisRow = await cephRepo.findAnalysis(params.imageId);

  // Returns {items, analysis} — never 404 (empty state has items:[], all codes in missing[])
  return ctx.json(
    {
      items: allLandmarks,
      analysis: {
        imageId: params.imageId,
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
