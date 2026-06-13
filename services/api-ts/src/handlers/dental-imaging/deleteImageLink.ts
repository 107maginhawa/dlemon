/**
 * deleteImageLink handler
 *
 * DELETE /dental/imaging/links/:linkId
 *
 * G5b: remove a context link. Authorized against the linked image's branch.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { ImagingRepository } from './repos/imaging.repo';

export async function deleteImageLink(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { linkId } = ctx.req.param() as { linkId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const link = await repo.getLinkById(linkId);
  if (!link) throw new NotFoundError('Link not found');

  const image = await repo.findImageById(link.imageId);
  if (!image) throw new NotFoundError('Image not found');
  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);

  await repo.deleteLink(linkId);
  return ctx.body(null, 204);
}
