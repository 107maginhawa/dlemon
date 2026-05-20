/**
 * listFindings handler
 *
 * GET /dental/imaging/images/:imageId/findings
 *
 * Returns all findings for an imaging study image.
 * Validates branch membership before returning data (T-11-03).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { buildPaginationMeta } from '@/utils/query';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingFindingRepository } from './repos/imaging_finding.repo';

export async function listFindings(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const imagingRepo = new ImagingRepository(db);
  const findingRepo = new ImagingFindingRepository(db);

  const image = await imagingRepo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Branch-level authorization (T-11-03)
  try {
    await assertBranchAccess(db, user.id, study.branchId);
  } catch {
    throw new NotFoundError('Image not found');
  }

  const items = await findingRepo.listByImage(imageId, study.branchId);
  const total = items.length;

  return ctx.json({ data: items, pagination: buildPaginationMeta(items, total, total || 1, 0) }, 200);
}
