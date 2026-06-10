/**
 * updateImageCalibration handler
 *
 * PATCH /dental/imaging/images/:imageId/calibration
 *
 * Saves pixel spacing calibration value for an imaging study image.
 * No imaging tier gate — calibration is available at all tiers.
 *
 * G6: when the body carries the 2-point ruler (pointA/pointB/knownDistanceMm),
 * a first-class VERSIONED calibration record is persisted and the image's
 * pixelSpacingMm is set from the value DERIVED server-side (knownDistanceMm /
 * pixelDistance) — the client-sent pixelSpacingMm is ignored for integrity.
 * Pre-G6 callers send only pixelSpacingMm → behaviour is unchanged (no record).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { ImagingRepository } from './repos/imaging.repo';

interface RulerPoint {
  x: number;
  y: number;
}

function asRulerPoint(value: unknown): RulerPoint | null {
  if (typeof value !== 'object' || value === null) return null;
  const { x, y } = value as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  if (typeof y !== 'number' || !Number.isFinite(y)) return null;
  return { x, y };
}

export async function updateImageCalibration(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };
  const body = (await ctx.req.json().catch(() => ({}))) as {
    pixelSpacingMm: unknown;
    pointA?: unknown;
    pointB?: unknown;
    knownDistanceMm?: unknown;
  };

  // Validate pixelSpacingMm is a positive number (T-08-05)
  if (typeof body.pixelSpacingMm !== 'number' || body.pixelSpacingMm <= 0) {
    throw new ValidationError('pixelSpacingMm must be a positive number');
  }

  // G6: a 2-point ruler calibration is all-or-nothing. A partial body (e.g. one
  // point, or points without a distance) is a client error — reject rather than
  // silently downgrade to the scalar-only path.
  const rulerProvided =
    body.pointA !== undefined || body.pointB !== undefined || body.knownDistanceMm !== undefined;
  let ruler: {
    pointA: RulerPoint;
    pointB: RulerPoint;
    knownDistanceMm: number;
    pixelDistance: number;
    pixelSpacingMm: number;
  } | null = null;

  if (rulerProvided) {
    const pointA = asRulerPoint(body.pointA);
    const pointB = asRulerPoint(body.pointB);
    if (!pointA || !pointB) {
      throw new ValidationError('pointA and pointB must both be { x, y } numeric points');
    }
    if (typeof body.knownDistanceMm !== 'number' || !(body.knownDistanceMm > 0)) {
      throw new ValidationError('knownDistanceMm must be a positive number');
    }
    const pixelDistance = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
    if (!(pixelDistance > 0)) {
      throw new ValidationError('pointA and pointB must not be the same point');
    }
    // Authoritative mm/px — never trust the client's arithmetic.
    const pixelSpacingMm = body.knownDistanceMm / pixelDistance;
    ruler = { pointA, pointB, knownDistanceMm: body.knownDistanceMm, pixelDistance, pixelSpacingMm };
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const image = await repo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Role-aware branch authorization — calibration is a clinical write (T-08-01)
  await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);

  if (ruler) {
    await repo.createCalibrationVersion(imageId, {
      pointA: ruler.pointA,
      pointB: ruler.pointB,
      knownDistanceMm: ruler.knownDistanceMm,
      pixelDistance: ruler.pixelDistance,
      pixelSpacingMm: ruler.pixelSpacingMm,
      method: 'manual_ruler',
      createdBy: user.id,
    });
  }

  // Image mirrors the (derived) scalar so every measurement/math consumer that
  // reads pixelSpacingMm directly stays correct.
  const effectivePixelSpacing = ruler ? ruler.pixelSpacingMm : body.pixelSpacingMm;
  const updated = await repo.updateImageCalibration(imageId, effectivePixelSpacing);

  return ctx.json(updated, 200);
}
