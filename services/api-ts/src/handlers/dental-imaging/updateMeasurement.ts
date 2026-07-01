/**
 * updateMeasurement handler
 *
 * PATCH /dental/imaging/measurements/:measurementId
 *
 * Edits a saved overlay (drag-to-move, resize, re-type/re-number, hide). Partial
 * patch: geometry / measurementValue / measurementUnit / visible are all optional.
 * `type` is IMMUTABLE — a moved line stays a line — so any new geometry is validated
 * against the same per-type union as create (T-08-02) and rejected if it would change
 * the stored kind. Same branch-role gate as create/delete (403). Audited (V-IMG-006).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import { ImagingRepository } from './repos/imaging.repo';
import { MeasurementGeometry, TYPE_MAP } from './createMeasurement';

export async function updateMeasurement(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { measurementId } = ctx.req.param() as { measurementId: string };
  const rawBody = (await ctx.req.json()) as {
    geometry?: unknown;
    measurementValue?: number | null;
    measurementUnit?: string | null;
    visible?: boolean;
  };

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const annotation = await repo.findAnnotationById(measurementId);
  if (!annotation) throw new NotFoundError('Measurement not found');

  const image = await repo.findImageById(annotation.imageId);
  if (!image) throw new NotFoundError('Image not found');
  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Same branch-level gate as create/delete (T-08-01) — let ForbiddenError → 403.
  await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);

  const patch: {
    geometry?: Record<string, unknown>;
    measurementValue?: number | null;
    measurementUnit?: string | null;
    visible?: boolean;
    toothNumber?: number | null;
  } = {};

  if (rawBody.geometry !== undefined) {
    const geomResult = MeasurementGeometry.safeParse(rawBody.geometry);
    if (!geomResult.success) {
      throw new ValidationError(
        `Invalid geometry: ${geomResult.error.issues.map((i) => i.message).join(', ')}`,
      );
    }
    // Type immutability: the new geometry's kind (via TYPE_MAP, e.g. distance→line)
    // must match the stored annotation type. A line can't be re-shaped into a label.
    const mappedType = TYPE_MAP[geomResult.data.type];
    if (mappedType !== annotation.type) {
      throw new ValidationError(
        `geometry type '${geomResult.data.type}' does not match measurement type '${annotation.type}' (type is immutable)`,
      );
    }
    patch.geometry = rawBody.geometry as Record<string, unknown>;
    // Keep the denormalized toothNumber column in sync on a tooth re-number.
    if (geomResult.data.type === 'tooth') {
      patch.toothNumber = (geomResult.data as { toothNumber: number }).toothNumber;
    }
  }

  // ponytail: value/unit are client-computed, exactly as createMeasurement trusts
  // them today (no server-side geometry math). If create ever recomputes, do it here too.
  if (rawBody.measurementValue !== undefined) patch.measurementValue = rawBody.measurementValue;
  if (rawBody.measurementUnit !== undefined) patch.measurementUnit = rawBody.measurementUnit;
  if (rawBody.visible !== undefined) patch.visible = rawBody.visible;

  const updated = await repo.updateAnnotation(measurementId, { ...patch, updatedBy: user.id });
  if (!updated) throw new NotFoundError('Measurement not found');

  // V-IMG-006: clinical PHI overlay mutation — audit it (mirrors create).
  await logAuditEvent(db, ctx.get('logger'), {
    personId: user.id,
    tenantId: study.branchId,
    branchId: study.branchId,
    action: 'imaging_annotation.update',
    eventType: 'data-modification',
    resourceType: 'imaging_annotation',
    resourceId: updated.id,
    metadata: { patientId: study.patientId, imageId: annotation.imageId, type: annotation.type },
  });

  return ctx.json(updated, 200);
}
