/**
 * deleteMeasurement handler
 *
 * DELETE /dental/imaging/measurements/:measurementId
 *
 * Deletes a measurement annotation. Verifies branch membership before delete (T-08-06).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { ImagingRepository } from './repos/imaging.repo';

export async function deleteMeasurement(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { measurementId } = ctx.req.param() as { measurementId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const annotation = await repo.findAnnotationById(measurementId);
  if (!annotation) throw new NotFoundError('Measurement not found');

  // Resolve branch for ownership check (T-08-06)
  const image = await repo.findImageById(annotation.imageId);
  if (!image) throw new NotFoundError('Parent image not found');

  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Branch-level authorization
  await assertBranchAccess(db, user.id, study.branchId);

  await repo.deleteAnnotation(measurementId);

  return new Response(null, { status: 204 });
}
