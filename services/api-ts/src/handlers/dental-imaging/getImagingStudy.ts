/**
 * getImagingStudy handler
 *
 * GET /dental/imaging/studies/:studyId
 *
 * Returns study with images and tooth links.
 * assertBranchAccess enforced using study.branchId.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { ImagingRepository } from './repos/imaging.repo';
import { logAuditEvent } from '@/core/audit-logger';

export async function getImagingStudy(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { studyId } = ctx.req.param() as { studyId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const study = await repo.findStudyById(studyId);
  if (!study) throw new NotFoundError('Imaging study not found');

  // Branch-level authorization via the study's branchId
  await assertBranchAccess(db, user.id, study.branchId);

  const images = await repo.listImagesByStudy(studyId);

  // Attach tooth numbers to each image
  const imagesWithTeeth = await Promise.all(
    images.map(async (image) => {
      const toothNumbers = await repo.listTeethByImage(image.id);
      return { ...image, toothNumbers };
    }),
  );

  const logger = ctx.get('logger');
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: study.branchId,
    action: 'imaging_study.read',
    resourceType: 'imaging_study',
    resourceId: study.id,
    metadata: { patientId: study.patientId, branchId: study.branchId },
  });

  return ctx.json({ ...study, images: imagesWithTeeth }, 200);
}
