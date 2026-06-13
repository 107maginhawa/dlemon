/**
 * listImageLinks handler
 *
 * GET /dental/imaging/images/:imageId/links
 *
 * G5b: list an image's context links (treatment plan / ortho case / report).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { ImagingRepository } from './repos/imaging.repo';

export async function listImageLinks(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const image = await repo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');
  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  await assertBranchAccess(db, user.id, study.branchId);

  const items = await repo.listLinksByImage(imageId);
  return ctx.json({ items }, 200);
}
