/**
 * CephMgmt_deleteCephLandmark
 *
 * DELETE /dental/imaging/images/{imageId}/ceph/landmarks/{landmarkCode}
 *
 * Deletes a landmark. Rejects deletion if the landmark is locked (terminal state).
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
import type { CephMgmt_deleteCephLandmarkParams } from '@/generated/openapi/validators';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';

export async function CephMgmt_deleteCephLandmark(
  ctx: ValidatedContext<never, never, CephMgmt_deleteCephLandmarkParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');

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

  if (landmark.status === 'locked') {
    throw new BusinessLogicError(
      `Landmark '${params.landmarkCode}' is locked and cannot be deleted.`,
      'LANDMARK_LOCKED',
    );
  }

  await cephRepo.deleteByCode(params.imageId, params.landmarkCode);

  logger?.info(
    { imageId: params.imageId, landmarkCode: params.landmarkCode, action: 'ceph_landmark_delete', by: user.id },
    'Ceph landmark deleted',
  );

  return new Response(null, { status: 204 });
}
