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
import { treatmentPlanExistsForPatient } from '@/handlers/dental-patient/repos/treatment-plan.facade';
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

  // G6.2: targetId is a cross-module soft-FK (no DB constraint). Validate the target
  // EXISTS and belongs to the SAME patient as the image — otherwise a well-formed but
  // bogus uuid creates an orphan link, or one image can be linked across patients/orgs
  // (cross-tenant leak). The same-patient lookups reveal nothing about other tenants.
  if (body.linkType === 'treatment_plan') {
    if (!(await treatmentPlanExistsForPatient(db, body.targetId, study.patientId))) {
      throw new NotFoundError('Treatment plan not found for this patient');
    }
  } else if (body.linkType === 'report') {
    if (!(await repo.cephReportExistsForPatient(body.targetId, study.patientId))) {
      throw new NotFoundError('Ceph report not found for this patient');
    }
  }
  // ortho_case: there is no ortho module/table to validate against, so its target
  // is left unvalidated (unchanged from before — an ortho_case link only ever
  // points at a not-yet-built feature, never real patient data). ponytail: don't
  // half-remove a dead feature here — the clean fix is to drop the ortho_case
  // affordance entirely (FE dropdown + TypeSpec + enum) in a focused cleanup, or
  // add real validation when the ortho module ships. Tracked as a follow-up.

  const link = await repo.createImageLink(imageId, {
    linkType: body.linkType as ImagingLinkType,
    targetId: body.targetId,
    createdBy: user.id,
  });

  return ctx.json(link, 201);
}
