/**
 * deleteFinding handler
 *
 * DELETE /dental/imaging/findings/:findingId
 *
 * Deletes an imaging finding after verifying branch membership.
 * Re-fetches finding→image→study→assertBranchAccess before delete (T-11-04).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingFindingRepository } from './repos/imaging_finding.repo';

export async function deleteFinding(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { findingId } = ctx.req.param() as { findingId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const imagingRepo = new ImagingRepository(db);
  const findingRepo = new ImagingFindingRepository(db);

  const finding = await findingRepo.findById(findingId);
  if (!finding) throw new NotFoundError('Finding not found');

  // Re-fetch image→study→assertBranchAccess before delete (T-11-04)
  const image = await imagingRepo.findImageById(finding.imageId);
  if (!image) throw new NotFoundError('Parent image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  try {
    await assertBranchAccess(db, user.id, study.branchId);
  } catch {
    throw new NotFoundError('Finding not found');
  }

  await findingRepo.delete(findingId, study.branchId);

  return new Response(null, { status: 204 });
}
