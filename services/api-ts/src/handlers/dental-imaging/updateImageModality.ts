/**
 * updateImageModality handler
 *
 * PATCH /dental/imaging/images/:imageId/modality
 *
 * Reclassifies the modality of an imaging study image.
 * Allowed roles: dentist, associate, hygienist.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { ImagingRepository } from './repos/imaging.repo';

const ROLES_ALLOWED_TO_RECLASSIFY = ['dentist', 'associate', 'hygienist'];

export async function updateImageModality(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };
  const body = (await ctx.req.json()) as { modality: string };

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const image = await repo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Branch-level authorization
  await assertBranchAccess(db, user.id, study.branchId);

  // Derive role from branch membership (no middleware sets memberRole)
  const role = await repo.getMemberRole(user.id, study.branchId);
  if (!role || !ROLES_ALLOWED_TO_RECLASSIFY.includes(role)) {
    throw new ForbiddenError('Only dentist, associate, or hygienist may reclassify modality');
  }

  const updated = await repo.updateModality(imageId, body.modality);

  return ctx.json(updated, 200);
}
