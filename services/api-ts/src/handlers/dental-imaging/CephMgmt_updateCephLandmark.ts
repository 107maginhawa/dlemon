/**
 * CephMgmt_updateCephLandmark
 *
 * PATCH /dental/imaging/images/{imageId}/ceph/landmarks/{landmarkCode}
 *
 * Single landmark update (pointer-up commit). Transition guard applies.
 * Rejects x/y changes on locked landmarks. Recomputes analysis in-place.
 * Returns {items, analysis}.
 */

import { eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { resolveImagingTier } from '@/handlers/dental-org/repos/organization.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { computeCephAnalysis } from '@monobase/ceph-math';
import type { CephMgmt_updateCephLandmarkBody, CephMgmt_updateCephLandmarkParams } from '@/generated/openapi/validators';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';
import {
  CEPH_LANDMARK_TRANSITIONS,
  type CephLandmarkStatus,
  type ImagingCephLandmark,
} from './repos/imaging_ceph.schema';

export async function CephMgmt_updateCephLandmark(
  ctx: ValidatedContext<CephMgmt_updateCephLandmarkBody, never, CephMgmt_updateCephLandmarkParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const image = await imagingRepo.findImageById(params.imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  try {
    await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);
  } catch {
    throw new NotFoundError('Image not found');
  }

  const [orgRow] = await db
    .select({ imagingTier: dentalOrganizations.imagingTier })
    .from(dentalBranches)
    .innerJoin(dentalOrganizations, eq(dentalBranches.organizationId, dentalOrganizations.id))
    .where(eq(dentalBranches.id, study.branchId))
    .limit(1);
  if (resolveImagingTier(orgRow?.imagingTier ?? null) === 'free') {
    throw new ForbiddenError('Cephalometric analysis requires an imaging add-on. Upgrade your plan.');
  }

  const landmark = await cephRepo.findByCode(params.imageId, params.landmarkCode);
  if (!landmark) throw new NotFoundError('Landmark not found');

  // Reject coordinate changes on locked landmarks
  if (landmark.status === 'locked' && (body.x !== undefined || body.y !== undefined)) {
    throw new BusinessLogicError(
      `Landmark '${params.landmarkCode}' is locked. Coordinates cannot be changed.`,
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

  const allLandmarks = await cephRepo.listByImage(params.imageId);
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));
  const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);
  const analysisRow = await cephRepo.upsertAnalysis(params.imageId, {
    measurements: result.measurements,
    calibrationValue: image.pixelSpacingMm,
    calibrationMethod: image.pixelSpacingMm ? 'manual_ruler' : 'not_calibrated',
  });

  logger?.info(
    { imageId: params.imageId, landmarkCode: params.landmarkCode, action: 'ceph_landmark_update', by: user.id },
    'Ceph landmark updated',
  );

  return ctx.json(
    {
      items: allLandmarks,
      analysis: {
        imageId: params.imageId,
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
