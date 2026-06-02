/**
 * Cephalometric superimposition handlers (P1-11, v1: cranial-base S–N only).
 *
 * POST /dental/imaging/ceph/superimpositions/preview  — compute-on-the-fly
 * POST /dental/imaging/ceph/superimpositions          — compute + persist
 * GET  /dental/imaging/ceph/superimpositions/{id}      — fetch one
 * GET  /dental/imaging/patients/{patientId}/ceph/superimpositions — list
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  CLINICAL HONESTY (plan §2/§8 — biggest risk): v1 is a TWO-POINT (S–N)
 *  similarity registration on the cranial base — a SIMPLIFIED superimposition,
 *  NOT ABO-grade structural superimposition. Output is a measurement of change,
 *  never a diagnosis. mm deltas are gated on calibration of BOTH timepoints.
 *  Maxillary / mandibular structural registrations are v2 (rejected: 422
 *  SUPERIMPOSITION_NOT_IMPLEMENTED).
 * ──────────────────────────────────────────────────────────────────────────
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BusinessLogicError,
} from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { logAuditEvent } from '@/core/audit-logger';
import {
  computeSuperimposition,
  SUPERIMPOSITION_V1_REFERENCES,
  DegenerateRegistrationError,
  InsufficientRegistrationLandmarksError,
  ReferenceNotImplementedError,
  type SuperimpositionReference,
  type LandmarkMap,
} from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';
import type { ImagingCephReport } from './repos/imaging_ceph.schema';

// v1 disclosure label — consumers MUST surface this verbatim (plan §8).
export const SUPERIMPOSITION_V1_LABEL =
  'Cranial-base (S–N) point registration — a simplified superimposition, not ' +
  'ABO-grade structural superimposition. Informational measurement of change, ' +
  'not a diagnosis. Ceph magnification (~7–13%) applies.';

type SnapshotLandmark = { landmarkCode: string; x: number; y: number };
type ReportSnapshot = {
  landmarks?: SnapshotLandmark[];
  measurements?: Record<string, number | null>;
  calibration?: { value?: number | null; method?: string | null };
  patient_display_id?: string;
};

function snapshotLandmarkMap(snap: ReportSnapshot): LandmarkMap {
  const map: LandmarkMap = {};
  for (const l of snap.landmarks ?? []) {
    map[l.landmarkCode] = { x: l.x, y: l.y };
  }
  return map;
}

function snapshotPixelSpacing(snap: ReportSnapshot): number | null {
  const v = snap.calibration?.value;
  return typeof v === 'number' ? v : null;
}

/** Shape the engine result + provenance into the wire model. */
function toWire(
  args: {
    id: string | null;
    patientId: string;
    reportFromId: string;
    reportToId: string;
    createdAt: Date | null;
  },
  result: ReturnType<typeof computeSuperimposition>,
  calibrationBasis: Record<string, unknown>,
) {
  return {
    id: args.id,
    patientId: args.patientId,
    reportFromId: args.reportFromId,
    reportToId: args.reportToId,
    reference: result.reference,
    transform: result.transform,
    landmarkDeltas: result.landmarkDeltas,
    metricDeltas: result.metricDeltas,
    uncalibrated: result.uncalibrated,
    calibrationBasis,
    label: SUPERIMPOSITION_V1_LABEL,
    createdAt: args.createdAt ? args.createdAt.toISOString() : null,
  };
}

/**
 * Load two reports, authorize against their branch + imaging tier, and compute
 * the engine result. Shared by preview + create. Throws the standard error
 * surface (404 unknown report, 403 tier, 422 reference/landmarks).
 */
async function loadAndCompute(
  ctx: BaseContext,
  user: User,
  body: { reportFromId: string; reportToId: string; reference: SuperimpositionReference },
): Promise<{
  result: ReturnType<typeof computeSuperimposition>;
  patientId: string;
  branchId: string;
  reportFrom: ImagingCephReport;
  reportTo: ImagingCephReport;
  calibrationBasis: Record<string, unknown>;
}> {
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  // Reject non-v1 reference early with a stable 422 (mirrors engine error).
  if (!SUPERIMPOSITION_V1_REFERENCES.includes(body.reference)) {
    throw new BusinessLogicError(
      `Registration reference "${body.reference}" is not implemented in v1 (cranial_base only).`,
      'SUPERIMPOSITION_NOT_IMPLEMENTED',
    );
  }

  const reportFrom = await cephRepo.getReportById(body.reportFromId);
  const reportTo = await cephRepo.getReportById(body.reportToId);
  if (!reportFrom || !reportTo) throw new NotFoundError('Ceph report not found');

  // Resolve patient/branch via the report's image → study, and authorize on the
  // TO image's branch (later timepoint is the base frame).
  const imageTo = await imagingRepo.findImageById(reportTo.imageId);
  const imageFrom = await imagingRepo.findImageById(reportFrom.imageId);
  if (!imageTo || !imageFrom) throw new NotFoundError('Ceph report not found');
  const studyTo = await imagingRepo.findStudyById(imageTo.studyId);
  const studyFrom = await imagingRepo.findStudyById(imageFrom.studyId);
  if (!studyTo || !studyFrom) throw new NotFoundError('Ceph report not found');

  // Both timepoints must belong to the SAME patient — never superimpose across
  // patients (PII / clinical-safety).
  if (studyTo.patientId !== studyFrom.patientId) {
    throw new BusinessLogicError(
      'Both report snapshots must belong to the same patient.',
      'SUPERIMPOSITION_PATIENT_MISMATCH',
    );
  }

  try {
    await assertBranchRole(db, user.id, studyTo.branchId, [
      'dentist_owner',
      'dentist_associate',
    ]);
  } catch {
    throw new NotFoundError('Ceph report not found');
  }

  const imagingTier = await getImagingTierForBranch(db, studyTo.branchId);
  if (imagingTier !== 'addon') {
    logger?.warn(
      {
        event: 'dental-imaging.tier-blocked',
        userId: user.id,
        feature: 'ceph_superimposition',
        currentTier: imagingTier,
      },
      'Tier gate blocked access',
    );
    throw new ForbiddenError(
      'Cephalometric superimposition requires an imaging add-on. Upgrade your plan.',
      'IMAGING_TIER_REQUIRED',
    );
  }

  const fromSnap = (reportFrom.snapshot ?? {}) as ReportSnapshot;
  const toSnap = (reportTo.snapshot ?? {}) as ReportSnapshot;
  const fromSpacing = snapshotPixelSpacing(fromSnap);
  const toSpacing = snapshotPixelSpacing(toSnap);

  const calibrationBasis = {
    from: { method: fromSnap.calibration?.method ?? 'not_calibrated', value: fromSpacing },
    to: { method: toSnap.calibration?.method ?? 'not_calibrated', value: toSpacing },
  };

  let result: ReturnType<typeof computeSuperimposition>;
  try {
    result = computeSuperimposition({
      reference: body.reference,
      fromLandmarks: snapshotLandmarkMap(fromSnap),
      toLandmarks: snapshotLandmarkMap(toSnap),
      fromMeasurements: fromSnap.measurements ?? {},
      toMeasurements: toSnap.measurements ?? {},
      fromPixelSpacingMm: fromSpacing,
      toPixelSpacingMm: toSpacing,
    });
  } catch (err) {
    if (err instanceof ReferenceNotImplementedError) {
      throw new BusinessLogicError(err.message, 'SUPERIMPOSITION_NOT_IMPLEMENTED');
    }
    if (err instanceof InsufficientRegistrationLandmarksError) {
      throw new BusinessLogicError(
        `Cannot superimpose: registration landmark(s) ${err.missing.join(', ')} not confirmed on both timepoints.`,
        'INSUFFICIENT_LANDMARKS',
      );
    }
    if (err instanceof DegenerateRegistrationError) {
      throw new BusinessLogicError(
        'Cannot superimpose: registration landmarks are degenerate (coincident).',
        'DEGENERATE_REGISTRATION',
      );
    }
    throw err;
  }

  return {
    result,
    patientId: studyTo.patientId,
    branchId: studyTo.branchId,
    reportFrom,
    reportTo,
    calibrationBasis,
  };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function previewCephSuperimposition(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = (await ctx.req.json()) as {
    reportFromId: string;
    reportToId: string;
    reference: SuperimpositionReference;
  };

  const { result, patientId, reportFrom, reportTo, calibrationBasis } =
    await loadAndCompute(ctx, user, body);

  return ctx.json(
    toWire(
      { id: null, patientId, reportFromId: reportFrom.id, reportToId: reportTo.id, createdAt: null },
      result,
      calibrationBasis,
    ),
    200,
  );
}

export async function createCephSuperimposition(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const cephRepo = new ImagingCephRepository(db);

  const body = (await ctx.req.json()) as {
    reportFromId: string;
    reportToId: string;
    reference: SuperimpositionReference;
  };

  const { result, patientId, branchId, reportFrom, reportTo, calibrationBasis } =
    await loadAndCompute(ctx, user, body);

  const deltas = {
    landmarkDeltas: result.landmarkDeltas,
    metricDeltas: result.metricDeltas,
    uncalibrated: result.uncalibrated,
  };

  const row = await cephRepo.createSuperimposition({
    patientId,
    reportFromId: reportFrom.id,
    reportToId: reportTo.id,
    referenceType: result.reference,
    transform: result.transform as unknown as Record<string, unknown>,
    deltas,
    calibrationBasis,
    userId: user.id,
  });

  // Domain-event marker (no event bus — audit row IS the marker, per ADR-006).
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchId,
    branchId,
    action: 'imaging_ceph_superimposition.created',
    eventType: 'data-modification',
    resourceType: 'imaging_ceph_superimposition',
    resourceId: row.id,
    metadata: { patientId, reference: result.reference, reportFromId: reportFrom.id, reportToId: reportTo.id },
  });

  return ctx.json(
    toWire(
      {
        id: row.id,
        patientId,
        reportFromId: reportFrom.id,
        reportToId: reportTo.id,
        createdAt: row.createdAt,
      },
      result,
      calibrationBasis,
    ),
    201,
  );
}

export async function getCephSuperimposition(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { superimpositionId } = ctx.req.param() as { superimpositionId: string };
  const db = ctx.get('database') as DatabaseInstance;
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const row = await cephRepo.getSuperimpositionById(superimpositionId);
  if (!row) throw new NotFoundError('Superimposition not found');

  // Authorize via the TO report's branch (tenant isolation).
  const reportTo = await cephRepo.getReportById(row.reportToId);
  if (!reportTo) throw new NotFoundError('Superimposition not found');
  const imageTo = await imagingRepo.findImageById(reportTo.imageId);
  if (!imageTo) throw new NotFoundError('Superimposition not found');
  const studyTo = await imagingRepo.findStudyById(imageTo.studyId);
  if (!studyTo) throw new NotFoundError('Superimposition not found');
  try {
    await assertBranchRole(db, user.id, studyTo.branchId, ['dentist_owner', 'dentist_associate']);
  } catch {
    throw new NotFoundError('Superimposition not found');
  }

  const deltas = (row.deltas ?? {}) as {
    landmarkDeltas?: unknown[];
    metricDeltas?: unknown[];
    uncalibrated?: boolean;
  };

  return ctx.json(
    {
      id: row.id,
      patientId: row.patientId,
      reportFromId: row.reportFromId,
      reportToId: row.reportToId,
      reference: row.referenceType,
      transform: row.transform,
      landmarkDeltas: deltas.landmarkDeltas ?? [],
      metricDeltas: deltas.metricDeltas ?? [],
      uncalibrated: deltas.uncalibrated ?? false,
      calibrationBasis: row.calibrationBasis,
      label: SUPERIMPOSITION_V1_LABEL,
      createdAt: row.createdAt.toISOString(),
    },
    200,
  );
}

export async function listCephSuperimpositions(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.param() as { patientId: string };
  const db = ctx.get('database') as DatabaseInstance;
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const rows = await cephRepo.listSuperimpositionsByPatient(patientId);

  // Tenant isolation: filter to superimpositions whose TO report's branch the
  // user can access. (No rows → empty list, never a leak.)
  const items: unknown[] = [];
  for (const row of rows) {
    const reportTo = await cephRepo.getReportById(row.reportToId);
    if (!reportTo) continue;
    const imageTo = await imagingRepo.findImageById(reportTo.imageId);
    if (!imageTo) continue;
    const studyTo = await imagingRepo.findStudyById(imageTo.studyId);
    if (!studyTo) continue;
    try {
      await assertBranchRole(db, user.id, studyTo.branchId, [
        'dentist_owner',
        'dentist_associate',
      ]);
    } catch {
      continue;
    }
    const deltas = (row.deltas ?? {}) as {
      landmarkDeltas?: unknown[];
      metricDeltas?: unknown[];
      uncalibrated?: boolean;
    };
    items.push({
      id: row.id,
      patientId: row.patientId,
      reportFromId: row.reportFromId,
      reportToId: row.reportToId,
      reference: row.referenceType,
      transform: row.transform,
      landmarkDeltas: deltas.landmarkDeltas ?? [],
      metricDeltas: deltas.metricDeltas ?? [],
      uncalibrated: deltas.uncalibrated ?? false,
      calibrationBasis: row.calibrationBasis,
      label: SUPERIMPOSITION_V1_LABEL,
      createdAt: row.createdAt.toISOString(),
    });
  }

  return ctx.json({ items }, 200);
}
