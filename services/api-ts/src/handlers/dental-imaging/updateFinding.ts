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
import { logAuditEvent } from '@/core/audit-logger';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingFindingRepository, type UpdateFindingPayload } from './repos/imaging_finding.repo';
import { FINDING_TRANSITIONS, FINDING_STATUSES, type FindingStatus } from './repos/imaging_finding.schema';

// V-IMG-007: SM-01 finding states are draft → confirmed → resolved (spec §8).
const UpdateFindingSchema = z.object({
  type: z.enum([
    'caries', 'secondary_caries', 'bone_loss', 'furcation_involvement',
    'periapical_lesion', 'root_resorption', 'calculus', 'crown_fracture',
    'root_fracture', 'impacted_tooth', 'over_eruption', 'open_contact',
    'overhang', 'crown_needed', 'implant_needed',
  ]).optional(),
  status: z.enum(FINDING_STATUSES).optional(),
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

  // Validate status transition (SM-01: draft → confirmed → resolved). V-IMG-007:
  // legacy rows still in `suspected`/`monitoring` have no spec transitions, so any
  // status change from them is rejected (they can only be left untouched).
  if (parsed.status !== undefined && parsed.status !== finding.status) {
    const allowedTransitions = FINDING_TRANSITIONS[finding.status as FindingStatus];
    if (!allowedTransitions?.includes(parsed.status as FindingStatus)) {
      throw new BusinessLogicError(
        `Cannot transition finding from '${finding.status}' to '${parsed.status}'. Allowed: ${allowedTransitions?.join(', ') || 'none'}`,
        'INVALID_STATUS_TRANSITION',
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

  // V-IMG-006: findings are clinical PHI — record the mutation in the audit log.
  // V-IMG-005 / DE-019 ImagingFindingConfirmed: a draft → confirmed transition is the
  // domain-event semantic marker (no event bus — see MODULE_SPEC §10b).
  const becameConfirmed = parsed.status === 'confirmed' && finding.status !== 'confirmed';
  const logger = ctx.get('logger');
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: study.branchId,
    branchId: study.branchId,
    action: becameConfirmed ? 'imaging_finding.confirmed' : 'imaging_finding.update',
    eventType: 'data-modification',
    resourceType: 'imaging_finding',
    resourceId: updated.id,
    metadata: {
      patientId: study.patientId,
      imageId: updated.imageId,
      status: updated.status,
      previousStatus: finding.status,
    },
  });

  return ctx.json(updated, 200);
}
