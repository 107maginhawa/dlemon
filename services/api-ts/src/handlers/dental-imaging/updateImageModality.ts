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
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { ImagingRepository } from './repos/imaging.repo';

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

  // Branch-level authorization + role gate (CLINICAL_WRITE)
  await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);

  const updated = await repo.updateModality(imageId, body.modality);

  return ctx.json(updated, 200);
}
