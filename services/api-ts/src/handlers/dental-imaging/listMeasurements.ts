/**
 * listMeasurements handler
 *
 * GET /dental/imaging/images/:imageId/measurements
 *
 * Returns every visible overlay for an image — measurements (line/angle/area)
 * AND annotations (label/arrow/freehand/shape/tooth). The frontend renders all
 * overlay types from this single list.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { ImagingRepository } from './repos/imaging.repo';

export async function listMeasurements(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const image = await repo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Branch-level authorization (T-08-04)
  await assertBranchAccess(db, user.id, study.branchId);

  const items = await repo.listMeasurementAnnotations(imageId);

  return ctx.json({ items }, 200);
}
