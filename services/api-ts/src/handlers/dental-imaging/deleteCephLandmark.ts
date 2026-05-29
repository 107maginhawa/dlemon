/**
 * deleteCephLandmark handler
 *
 * DELETE /dental/imaging/images/{imageId}/ceph/landmarks/{landmarkCode}
 *
 * Deletes a landmark. Rejects deletion if the landmark is locked (terminal state).
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';

export async function deleteCephLandmark(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId, landmarkCode } = ctx.req.param() as { imageId: string; landmarkCode: string };

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
      { event: 'dental-imaging.tier-blocked', userId: user.id, feature: 'ceph_landmark_delete', currentTier: imagingTier },
      'Tier gate blocked access',
    );
    throw new ForbiddenError('Cephalometric analysis requires an imaging add-on. Upgrade your plan.');
  }

  const landmark = await cephRepo.findByCode(imageId, landmarkCode);
  if (!landmark) throw new NotFoundError('Landmark not found');

  if (landmark.status === 'locked') {
    throw new BusinessLogicError(
      `Landmark '${landmarkCode}' is locked and cannot be deleted.`,
      'LANDMARK_LOCKED',
    );
  }

  await cephRepo.deleteByCode(imageId, landmarkCode);

  logger?.info(
    { imageId, landmarkCode, action: 'ceph_landmark_delete', by: user.id },
    'Ceph landmark deleted',
  );

  return new Response(null, { status: 204 });
}
