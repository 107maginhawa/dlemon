/**
 * createFinding handler
 *
 * POST /dental/imaging/images/:imageId/findings
 *
 * Creates a structured imaging finding linked to an imaging study image.
 * Validates branch membership before inserting (T-11-01).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { z } from 'zod';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingFindingRepository } from './repos/imaging_finding.repo';
import { FINDING_STATUSES, FINDING_INITIAL_STATUS } from './repos/imaging_finding.schema';

// V-IMG-007: SM-01 finding states are draft → confirmed → resolved (spec §8).
const CreateFindingSchema = z.object({
  type: z.enum([
    'caries', 'secondary_caries', 'bone_loss', 'furcation_involvement',
    'periapical_lesion', 'root_resorption', 'calculus', 'crown_fracture',
    'root_fracture', 'impacted_tooth', 'over_eruption', 'open_contact',
    'overhang', 'crown_needed', 'implant_needed',
  ]),
  status: z.enum(FINDING_STATUSES).optional(),
  toothNumber: z.number().int().min(1).max(48).optional(),
  surfaces: z.array(z.string().max(20)).max(5).optional(),
  note: z.string().max(5000).optional(),
  annotationId: z.string().optional(),
  treatmentId: z.string().optional(),
});

export async function createFinding(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };
  const rawBody = await ctx.req.json();

  const db = ctx.get('database') as DatabaseInstance;
  const imagingRepo = new ImagingRepository(db);
  const findingRepo = new ImagingFindingRepository(db);

  const image = await imagingRepo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Branch-level authorization (T-11-01)
  try {
    await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);
  } catch {
    throw new NotFoundError('Image not found');
  }

  const parsed = CreateFindingSchema.parse(rawBody);

  // Validate annotationId belongs to this image
  if (parsed.annotationId) {
    const annotation = await imagingRepo.findAnnotationById(parsed.annotationId);
    if (!annotation || annotation.imageId !== imageId) {
      throw new NotFoundError('Annotation not found');
    }
  }

  const finding = await findingRepo.create({
    imageId,
    annotationId: parsed.annotationId ?? null,
    treatmentId: parsed.treatmentId ?? null,
    visitId: study.visitId ?? null,
    patientId: study.patientId,
    branchId: study.branchId,
    type: parsed.type,
    status: parsed.status ?? FINDING_INITIAL_STATUS,
    toothNumber: parsed.toothNumber ?? null,
    surfaces: parsed.surfaces ?? null,
    note: parsed.note ?? null,
  });

  // V-IMG-006: findings are clinical PHI — record the mutation in the audit log.
  // V-IMG-005 / DE-019 ImagingFindingConfirmed: if the finding is created directly in
  // `confirmed` state, this audit row is also the domain-event semantic marker
  // (no event bus — see MODULE_SPEC §10b).
  const logger = ctx.get('logger');
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: study.branchId,
    branchId: study.branchId,
    action: finding.status === 'confirmed' ? 'imaging_finding.confirmed' : 'imaging_finding.create',
    eventType: 'data-modification',
    resourceType: 'imaging_finding',
    resourceId: finding.id,
    metadata: {
      patientId: study.patientId,
      imageId,
      type: finding.type,
      status: finding.status,
      toothNumber: finding.toothNumber ?? undefined,
    },
  });

  return ctx.json(finding, 201);
}
