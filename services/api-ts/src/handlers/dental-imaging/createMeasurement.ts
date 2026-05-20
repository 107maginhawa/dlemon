/**
 * createMeasurement handler
 *
 * POST /dental/imaging/images/:imageId/measurements
 *
 * Creates a measurement or annotation overlay on an imaging study image.
 * Measurement types (distance, angle, area) require imaging tier != 'free' (T-08-03).
 * Annotation types (label, arrow, freehand, shape, tooth) are available to all tiers (D3).
 * Validates geometry via Zod discriminated union (T-08-02).
 * Geometry is stored as JSON — never burned into the image (BR-023).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { resolveImagingTier } from '@/handlers/dental-org/repos/organization.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { ImagingRepository } from './repos/imaging.repo';

// ---------------------------------------------------------------------------
// Geometry Zod schemas (D3)
// ---------------------------------------------------------------------------

const Point = z.object({ x: z.number(), y: z.number() });

const DistanceGeometry = z.object({
  type: z.literal('distance'),
  points: z.tuple([Point, Point]),
});

const AngleGeometry = z.object({
  type: z.literal('angle'),
  points: z.tuple([Point, Point, Point]),
});

const AreaGeometry = z.object({
  type: z.literal('area'),
  points: z.array(Point).min(3),
});

// ---------------------------------------------------------------------------
// Annotation geometry schemas (Phase 9 — D2)
// ---------------------------------------------------------------------------

const LabelGeometry = z.object({
  type: z.literal('label'),
  point: Point,
  text: z.string().min(1).max(200),
});

const ArrowGeometry = z.object({
  type: z.literal('arrow'),
  from: Point,
  to: Point,
});

const FreehandGeometry = z.object({
  type: z.literal('freehand'),
  points: z.array(Point).min(2),
});

const ShapeGeometry = z.object({
  type: z.literal('shape'),
  shapeType: z.enum(['rect', 'ellipse']),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const ToothGeometry = z.object({
  type: z.literal('tooth'),
  point: Point,
  toothNumber: z.number().int().min(1).max(32),
});

const MeasurementGeometry = z.discriminatedUnion('type', [
  DistanceGeometry,
  AngleGeometry,
  AreaGeometry,
  LabelGeometry,
  ArrowGeometry,
  FreehandGeometry,
  ShapeGeometry,
  ToothGeometry,
]);

// Measurement types (tier-gated)
const MEASUREMENT_TYPES = new Set(['distance', 'angle', 'area'] as const);

// Annotation types (no tier gate — D3)
const ANNOTATION_TYPES = new Set(['label', 'arrow', 'freehand', 'shape', 'tooth'] as const);

// Map API type to imagingAnnotationTypeEnum value
type AnnotationType = 'line' | 'angle' | 'area' | 'label' | 'arrow' | 'freehand' | 'shape' | 'tooth';

const TYPE_MAP: Record<string, AnnotationType> = {
  distance: 'line',
  angle: 'angle',
  area: 'area',
  label: 'label',
  arrow: 'arrow',
  freehand: 'freehand',
  shape: 'shape',
  tooth: 'tooth',
};

export async function createMeasurement(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };
  const rawBody = (await ctx.req.json()) as {
    type: string;
    geometry: unknown;
    measurementValue?: number;
    measurementUnit?: string;
  };

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImagingRepository(db);

  const image = await repo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await repo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  // Branch-level authorization (T-08-01)
  await assertBranchAccess(db, user.id, study.branchId);

  const isMeasurementType = MEASUREMENT_TYPES.has(rawBody.type as any);
  const isAnnotationType = ANNOTATION_TYPES.has(rawBody.type as any);

  if (!isMeasurementType && !isAnnotationType) {
    throw new ValidationError(
      'type must be one of: distance, angle, area, label, arrow, freehand, shape, tooth',
    );
  }

  // Tier gate applies only to measurement types (T-08-03); annotations are unrestricted (D3)
  if (isMeasurementType) {
    const [orgRow] = await db
      .select({ imagingTier: dentalOrganizations.imagingTier })
      .from(dentalBranches)
      .innerJoin(dentalOrganizations, eq(dentalBranches.organizationId, dentalOrganizations.id))
      .where(eq(dentalBranches.id, study.branchId))
      .limit(1);

    const tier = resolveImagingTier(orgRow?.imagingTier ?? null);
    if (tier === 'free') {
      throw new ForbiddenError('Measurements require an imaging add-on. Upgrade your plan.');
    }
  }

  // Validate geometry (T-08-02)
  const geomResult = MeasurementGeometry.safeParse(rawBody.geometry);
  if (!geomResult.success) {
    throw new ValidationError(
      `Invalid geometry: ${geomResult.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  const annotationType = TYPE_MAP[rawBody.type];
  if (!annotationType) {
    throw new ValidationError(
      'type must be one of: distance, angle, area, label, arrow, freehand, shape, tooth',
    );
  }

  // Extract toothNumber from geometry for tooth annotations
  const toothNumber =
    rawBody.type === 'tooth' && geomResult.success
      ? ((geomResult.data as { toothNumber?: number }).toothNumber ?? null)
      : null;

  const annotation = await repo.createAnnotation({
    imageId,
    type: annotationType,
    geometry: rawBody.geometry as Record<string, unknown>,
    measurementValue: rawBody.measurementValue ?? null,
    measurementUnit: rawBody.measurementUnit ?? null,
    toothNumber,
    visible: true,
  });

  return ctx.json(annotation, 201);
}
