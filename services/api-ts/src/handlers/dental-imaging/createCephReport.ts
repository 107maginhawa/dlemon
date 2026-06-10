/**
 * createCephReport handler
 *
 * POST /dental/imaging/images/{imageId}/ceph/reports
 *
 * D-I: Creates an immutable versioned snapshot. Report landmarks/measurements
 *      are frozen — subsequent landmark edits create a new version.
 * D-L: Blocked (409) unless A, B, Go, and Po are all 'confirmed'.
 * D-4: Snapshot includes study_date, patient_display_id, branch_name.
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getOrgDataForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import {
  computeAnalysis,
  ANALYSIS_TYPES,
  NORM_POPULATIONS,
  DEFAULT_POPULATION,
  NORMS_VERSION,
  FORMULA_VERSION,
} from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';
import { CEPH_REPORT_GATE_LANDMARKS } from './repos/imaging_ceph.schema';

const SOFTWARE_VERSION = '1.4.0';
/** Schema version of the calibration block snapshotted into a report (G2/G6). */
const CALIBRATION_SNAPSHOT_VERSION = 1;
const DEFAULT_ANALYSIS_TYPE = 'steiner_hybrid_sn';
/** G1-B: cap on the free-text re-finalization reason. */
const REVISION_REASON_MAX_LEN = 500;

export async function createCephReport(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };

  // G2: clinician's selected analysis + reference population (back-compat: omitted
  // → steiner_hybrid_sn / default). Clamp to known values so the report never
  // self-labels a fabricated analysis/population.
  const body = (await ctx.req.json().catch(() => ({}))) as {
    analysisType?: unknown;
    normPopulation?: unknown;
    revisionReason?: unknown;
  };
  const analysisType =
    typeof body.analysisType === 'string' && (ANALYSIS_TYPES as readonly string[]).includes(body.analysisType)
      ? body.analysisType
      : DEFAULT_ANALYSIS_TYPE;
  const normPopulation =
    typeof body.normPopulation === 'string' && NORM_POPULATIONS.includes(body.normPopulation)
      ? body.normPopulation
      : DEFAULT_POPULATION;
  // G1-B: optional re-finalization reason; clamp to a sane length. revisionOf is
  // server-derived from the prior latest version (never client-set).
  const revisionReason =
    typeof body.revisionReason === 'string' && body.revisionReason.trim().length > 0
      ? body.revisionReason.trim().slice(0, REVISION_REASON_MAX_LEN)
      : null;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const image = await imagingRepo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  try {
    await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate']);
  } catch {
    throw new NotFoundError('Image not found');
  }

  const orgData = await getOrgDataForBranch(db, study.branchId);
  if (orgData.imagingTier !== 'addon') {
    logger?.warn(
      { event: 'dental-imaging.tier-blocked', userId: user.id, feature: 'ceph_report_create', currentTier: orgData.imagingTier },
      'Tier gate blocked access',
    );
    throw new ForbiddenError(
      'Cephalometric analysis requires an imaging add-on. Upgrade your plan.',
      'IMAGING_TIER_REQUIRED',
    );
  }

  const allLandmarks = await cephRepo.listByImage(imageId);
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));

  // D-L: confirm-gate — A, B, Go, Po must all be 'confirmed'
  const confirmedCodes = new Set(
    allLandmarks.filter((l) => l.status === 'confirmed' || l.status === 'locked').map((l) => l.landmarkCode),
  );
  const unconfirmed = CEPH_REPORT_GATE_LANDMARKS.filter((code) => !confirmedCodes.has(code));
  if (unconfirmed.length > 0) {
    throw new BusinessLogicError(
      `Report blocked: landmark(s) ${unconfirmed.join(', ')} must be confirmed before generating a report.`,
      'REPORT_GATE_UNCONFIRMED',
    );
  }

  const result = computeAnalysis(analysisType, landmarkMap, image.pixelSpacingMm ?? null);

  // D-4: context fields from imaging_study + branch
  const studyDate = study.createdAt.toISOString().split('T')[0] ?? study.createdAt.toISOString();
  const branchName = orgData.branchName ?? study.branchId;

  const pixelSpacingMm = image.pixelSpacingMm ?? null;
  const snapshot: Record<string, unknown> = {
    landmarks: allLandmarks.map((l) => ({
      landmarkCode: l.landmarkCode,
      x: l.x,
      y: l.y,
      source: l.source,
      status: l.status,
      confidence: l.confidence,
    })),
    measurements: result.measurements,
    // G2: pin the analysis ACTUALLY used (was hardcoded 'steiner_hybrid_sn').
    // analysis_label kept for back-compat consumers; analysis_type is canonical.
    analysis_label: analysisType,
    analysis_type: analysisType,
    norm_population: normPopulation,
    norm_version: NORMS_VERSION,
    formula_version: FORMULA_VERSION,
    calibration: {
      value: pixelSpacingMm,
      method: pixelSpacingMm ? 'manual_ruler' : 'not_calibrated',
      // G2: pixels-per-mm + version pinned for reproducibility (versioned ruler
      // points land in G6). pixels_per_mm = 1 / (mm-per-px).
      pixels_per_mm: pixelSpacingMm ? Math.round((1 / pixelSpacingMm) * 10000) / 10000 : null,
      version: CALIBRATION_SNAPSHOT_VERSION,
    },
    // G2: surface analysis completeness so the report renders mm/missing honestly
    // (CephReportView already reads these; they were previously never written).
    missing: result.missing,
    uncalibrated: result.uncalibrated,
    software_version: SOFTWARE_VERSION,
    operator: user.id,
    generated_at: new Date().toISOString(),
    // D-4 context fields
    study_date: studyDate,
    patient_display_id: study.patientId,
    branch_name: branchName,
  };

  // G1-B: link this version to the prior latest one (null for v1) so the chain
  // is an explicit, reasoned lineage.
  const priorReport = await cephRepo.getLatestReport(imageId);
  const revisionOf = priorReport?.id ?? null;

  const report = await cephRepo.createReportVersion(imageId, snapshot, user.id, {
    revisionOf,
    revisionReason,
  });

  logger?.info(
    { imageId, reportVersion: report.version, revisionOf, action: 'ceph_report_create', by: user.id },
    'Ceph report version created',
  );

  return ctx.json(
    {
      id: report.id,
      imageId: report.imageId,
      version: report.version,
      snapshot: report.snapshot,
      revisionOf: report.revisionOf,
      revisionReason: report.revisionReason,
      createdAt: report.createdAt,
    },
    201,
  );
}
