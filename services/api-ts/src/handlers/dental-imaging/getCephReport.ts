/**
 * getCephReport handler
 *
 * GET /dental/imaging/images/{imageId}/ceph/reports
 *
 * Returns a frozen report snapshot. ?version=N selects a specific version;
 * omitting version returns the latest. Read-only — no mutations.
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';

export async function getCephReport(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };
  const versionStr = ctx.req.query('version');
  const version = versionStr !== undefined ? Number(versionStr) : undefined;

  const db = ctx.get('database') as DatabaseInstance;
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const image = await imagingRepo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  try {
    await assertBranchAccess(db, user.id, study.branchId);
  } catch {
    throw new NotFoundError('Image not found');
  }

  const imagingTier = await getImagingTierForBranch(db, study.branchId);
  if (imagingTier !== 'addon') {
    throw new ForbiddenError('Cephalometric analysis requires an imaging add-on. Upgrade your plan.');
  }

  const report =
    version !== undefined
      ? await cephRepo.getReportByVersion(imageId, version)
      : await cephRepo.getLatestReport(imageId);

  if (!report) throw new NotFoundError('Ceph report not found');

  return ctx.json(
    {
      id: report.id,
      imageId: report.imageId,
      version: report.version,
      snapshot: report.snapshot,
      createdAt: report.createdAt,
    },
    200,
  );
}
