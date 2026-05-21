/**
 * deleteImage handler
 *
 * DELETE /dental/imaging/images/:imageId
 *
 * Soft-delete: sets status='archived' on imaging_study_image.
 * Role-gated (BR-026, BR-027):
 *   - dentist    → can archive any image in their branch
 *   - associate  → can only archive images they acquired (acquiredBy === user.id, BR-027)
 *   - hygienist  → forbidden (403)
 *   - front_desk → forbidden (403)
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { ImagingRepository } from './repos/imaging.repo';

export async function deleteImage(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const image = await repo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  // Fetch parent study for branchId and acquiredBy context
  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Branch-level authorization + role gate (CLINICAL_WRITE)
  await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);

  // BR-027: associates may only delete images they acquired
  const role = await repo.getMemberRole(user.id, study.branchId);
  if (role === 'dentist_associate' && study.acquiredBy !== user.id) {
    throw new ForbiddenError('Associates may only delete images they acquired');
  }

  // Soft-delete
  await repo.archiveImage(imageId);

  return ctx.json({ success: true }, 200);
}
