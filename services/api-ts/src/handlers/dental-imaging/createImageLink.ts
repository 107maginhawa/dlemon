/**
 * createImageLink handler
 *
 * POST /dental/imaging/images/:imageId/links
 *
 * G5b: link an image to a treatment plan / ortho case / ceph report. Loose-coupled —
 * targetId references another module's row id with no DB-level FK. Idempotent: linking
 * the same (image, type, target) twice returns the existing link.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { ImagingRepository } from './repos/imaging.repo';
import type { ImagingLinkType } from './repos/imaging.schema';

const LINK_TYPES = ['treatment_plan', 'ortho_case', 'report'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createImageLink(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };
  const body = (await ctx.req.json().catch(() => ({}))) as { linkType?: unknown; targetId?: unknown };

  if (typeof body.linkType !== 'string' || !(LINK_TYPES as readonly string[]).includes(body.linkType)) {
    throw new ValidationError("linkType must be one of 'treatment_plan', 'ortho_case', 'report'");
  }
  if (typeof body.targetId !== 'string' || !UUID_RE.test(body.targetId)) {
    throw new ValidationError('targetId must be a valid uuid');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const image = await repo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');
  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);

  const link = await repo.createImageLink(imageId, {
    linkType: body.linkType as ImagingLinkType,
    targetId: body.targetId,
    createdBy: user.id,
  });

  return ctx.json(link, 201);
}
