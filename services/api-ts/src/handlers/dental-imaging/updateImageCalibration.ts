/**
 * updateImageCalibration handler
 *
 * PATCH /dental/imaging/images/:imageId/calibration
 *
 * Saves pixel spacing calibration value for an imaging study image.
 * No imaging tier gate — calibration is available at all tiers.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { ImagingRepository } from './repos/imaging.repo';

export async function updateImageCalibration(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };
  const body = (await ctx.req.json()) as { pixelSpacingMm: unknown };

  // Validate pixelSpacingMm is a positive number (T-08-05)
  if (typeof body.pixelSpacingMm !== 'number' || body.pixelSpacingMm <= 0) {
    throw new ValidationError('pixelSpacingMm must be a positive number');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const image = await repo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Role-aware branch authorization — calibration is a clinical write (T-08-01)
  await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);

  const updated = await repo.updateImageCalibration(imageId, body.pixelSpacingMm);

  return ctx.json(updated, 200);
}
