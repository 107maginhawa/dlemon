/**
 * updateFinding handler
 *
 * PATCH /dental/imaging/findings/:findingId
 *
 * Updates mutable fields on an imaging finding.
 * Only fields in UpdateFindingBody accepted; Zod strips extras (T-11-02).
 * Re-verifies ownership via finding→image→study→branchId chain (T-11-03).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { z } from 'zod';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingFindingRepository, type UpdateFindingPayload } from './repos/imaging_finding.repo';
import { FINDING_TRANSITIONS, type ImagingFindingStatus } from './repos/imaging_finding.schema';

const UpdateFindingSchema = z.object({
  type: z.enum([
    'caries', 'secondary_caries', 'bone_loss', 'furcation_involvement',
    'periapical_lesion', 'root_resorption', 'calculus', 'crown_fracture',
    'root_fracture', 'impacted_tooth', 'over_eruption', 'open_contact',
    'overhang', 'crown_needed', 'implant_needed',
  ]).optional(),
  status: z.enum(['suspected', 'confirmed', 'monitoring', 'resolved']).optional(),
  toothNumber: z.number().int().min(1).max(48).nullable().optional(),
  surfaces: z.array(z.string().max(20)).max(5).nullable().optional(),
  note: z.string().max(5000).nullable().optional(),
  treatmentId: z.string().nullable().optional(),
});

export async function updateFinding(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { findingId } = ctx.req.param() as { findingId: string };
  const rawBody = await ctx.req.json();

  const db = ctx.get('database') as DatabaseInstance;
  const imagingRepo = new ImagingRepository(db);
  const findingRepo = new ImagingFindingRepository(db);

  const finding = await findingRepo.findById(findingId);
  if (!finding) throw new NotFoundError('Finding not found');

  // Re-verify ownership via image→study→branchId chain (T-11-03)
  const image = await imagingRepo.findImageById(finding.imageId);
  if (!image) throw new NotFoundError('Parent image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  try {
    await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);
  } catch {
    throw new NotFoundError('Finding not found');
  }

  const parsed = UpdateFindingSchema.parse(rawBody);

  // Validate status transition (SM-01)
  if (parsed.status !== undefined && parsed.status !== finding.status) {
    const allowedTransitions = FINDING_TRANSITIONS[finding.status as ImagingFindingStatus];
    if (!allowedTransitions?.includes(parsed.status as ImagingFindingStatus)) {
      throw new BusinessLogicError(
        `Cannot transition finding from '${finding.status}' to '${parsed.status}'. Allowed: ${allowedTransitions?.join(', ') || 'none'}`
      );
    }
  }

  // Build update payload — only include defined keys (Zod strips extras T-11-02)
  const updateData: UpdateFindingPayload = {};
  if (parsed.type !== undefined) updateData.type = parsed.type;
  if (parsed.status !== undefined) updateData.status = parsed.status;
  if (parsed.toothNumber !== undefined) updateData.toothNumber = parsed.toothNumber;
  if (parsed.surfaces !== undefined) updateData.surfaces = parsed.surfaces;
  if (parsed.note !== undefined) updateData.note = parsed.note;
  if (parsed.treatmentId !== undefined) updateData.treatmentId = parsed.treatmentId;

  const updated = await findingRepo.update(findingId, updateData);
  if (!updated) throw new NotFoundError('Finding not found after update');

  return ctx.json(updated, 200);
}
