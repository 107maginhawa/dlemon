/**
 * updateCephLandmark handler
 *
 * PATCH /dental/imaging/images/{imageId}/ceph/landmarks/{landmarkCode}
 *
 * Single landmark update (pointer-up commit). Transition guard applies.
 * Rejects x/y changes on locked landmarks. Recomputes analysis in-place.
 * Returns {items, analysis}.
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { computeCephAnalysis } from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';
import {
  CEPH_LANDMARK_TRANSITIONS,
  type CephLandmarkStatus,
  type ImagingCephLandmark,
} from './repos/imaging_ceph.schema';

export async function updateCephLandmark(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId, landmarkCode } = ctx.req.param() as { imageId: string; landmarkCode: string };
  const body = (await ctx.req.json()) as { x?: number; y?: number; status?: string };

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
      { event: 'dental-imaging.tier-blocked', userId: user.id, feature: 'ceph_landmark_update', currentTier: imagingTier },
      'Tier gate blocked access',
    );
    throw new ForbiddenError('Cephalometric analysis requires an imaging add-on. Upgrade your plan.');
  }

  const landmark = await cephRepo.findByCode(imageId, landmarkCode);
  if (!landmark) throw new NotFoundError('Landmark not found');

  // Reject coordinate changes on locked landmarks
  if (landmark.status === 'locked' && (body.x !== undefined || body.y !== undefined)) {
    throw new BusinessLogicError(
      `Landmark '${landmarkCode}' is locked. Coordinates cannot be changed.`,
      'LANDMARK_LOCKED',
    );
  }

  // Validate status transition
  if (body.status !== undefined && body.status !== landmark.status) {
    const allowed = CEPH_LANDMARK_TRANSITIONS[landmark.status as CephLandmarkStatus];
    if (!allowed?.includes(body.status as CephLandmarkStatus)) {
      throw new BusinessLogicError(
        `Cannot transition landmark from '${landmark.status}' to '${body.status}'. Allowed: ${allowed?.join(', ') || 'none'}`,
        'INVALID_STATUS_TRANSITION',
      );
    }
  }

  const updatePayload: Parameters<typeof cephRepo.update>[1] = {};
  if (body['x'] !== undefined) updatePayload['x'] = body['x'];
  if (body['y'] !== undefined) updatePayload['y'] = body['y'];
  if (body['status'] !== undefined) updatePayload['status'] = body['status'] as ImagingCephLandmark['status'];

  await cephRepo.update(landmark.id, updatePayload);

  const allLandmarks = await cephRepo.listByImage(imageId);
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));
  const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);
  const analysisRow = await cephRepo.upsertAnalysis(imageId, {
    measurements: result.measurements,
    calibrationValue: image.pixelSpacingMm,
    calibrationMethod: image.pixelSpacingMm ? 'manual_ruler' : 'not_calibrated',
  });

  logger?.info(
    { imageId, landmarkCode, action: 'ceph_landmark_update', by: user.id },
    'Ceph landmark updated',
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
