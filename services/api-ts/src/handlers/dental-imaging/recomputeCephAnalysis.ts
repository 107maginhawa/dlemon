/**
 * recomputeCephAnalysis handler
 *
 * POST /dental/imaging/images/{imageId}/ceph/analysis/recompute
 *
 * Idempotent recompute of ceph analysis from current landmarks + calibration.
 * Does NOT touch existing ceph_report rows (D-I immutability).
 * Returns CephAnalysis (not the full list response).
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { logAuditEvent } from '@/core/audit-logger';
import { computeCephAnalysis } from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';

export async function recomputeCephAnalysis(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };

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

  const imagingTier = await getImagingTierForBranch(db, study.branchId);
  if (imagingTier !== 'addon') {
    logger?.warn(
      { event: 'dental-imaging.tier-blocked', userId: user.id, feature: 'ceph_analysis_recompute', currentTier: imagingTier },
      'Tier gate blocked access',
    );
    throw new ForbiddenError(
      'Cephalometric analysis requires an imaging add-on. Upgrade your plan.',
      'IMAGING_TIER_REQUIRED',
    );
  }

  const allLandmarks = await cephRepo.listByImage(imageId);
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));
  const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);

  // V-IMG-004 / §13 / §15: recompute must enforce preconditions rather than silently
  // returning 200 with an all-null analysis.
  //
  // INSUFFICIENT_LANDMARKS (422): the Steiner-hybrid-SN analysis is anchored on the
  // S–N reference line. Without S and N every angle is uncomputable, so a recompute is
  // meaningless. We surface the list of missing reference landmarks to the client.
  const REQUIRED_REFERENCE_LANDMARKS = ['S', 'N'] as const;
  const placedCodes = new Set(allLandmarks.map((l) => l.landmarkCode));
  const missingReference = REQUIRED_REFERENCE_LANDMARKS.filter((code) => !placedCodes.has(code));
  if (missingReference.length > 0) {
    throw new BusinessLogicError(
      `Cannot recompute analysis: required landmark(s) ${missingReference.join(', ')} not placed.`,
      'INSUFFICIENT_LANDMARKS',
    );
  }

  // NOT_CALIBRATED (422): linear (mm) metrics require valid pixel spacing. Anisotropic or
  // absent calibration corrupts the analysis (D-C) — block recompute so the client runs
  // the calibration workflow first (§13 "Calibration not set before landmark placement").
  if (result.uncalibrated || image.pixelSpacingMm == null) {
    throw new BusinessLogicError(
      'Cannot recompute analysis: image is not calibrated. Set pixel spacing (calibration) first.',
      'NOT_CALIBRATED',
    );
  }

  // upsert analysis — does NOT touch any ceph_report rows (D-I)
  const analysisRow = await cephRepo.upsertAnalysis(imageId, {
    measurements: result.measurements,
    calibrationValue: image.pixelSpacingMm,
    calibrationMethod: image.pixelSpacingMm ? 'manual_ruler' : 'not_calibrated',
  });

  logger?.info(
    { imageId, action: 'ceph_analysis_recompute', by: user.id },
    'Ceph analysis recomputed',
  );

  // V-IMG-005 / DE-020 CephAnalysisComputed: per ADR-006 there is no event bus —
  // this audit row IS the domain-event semantic marker (see MODULE_SPEC §10b).
  // It also satisfies V-IMG-006 (ceph PHI mutation is audited).
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: study.branchId,
    branchId: study.branchId,
    action: 'imaging_ceph_analysis.computed',
    eventType: 'data-modification',
    resourceType: 'imaging_ceph_analysis',
    resourceId: imageId,
    metadata: { patientId: study.patientId, imageId },
  });

  return ctx.json(
    {
      imageId,
      analysisType: analysisRow.analysisType,
      measurements: result.measurements,
      missing: result.missing,
      uncalibrated: result.uncalibrated,
      calibrationValue: analysisRow.calibrationValue,
      calibrationMethod: analysisRow.calibrationMethod,
      calibratedAt: analysisRow.calibratedAt,
      calibratedBy: analysisRow.calibratedBy,
      updatedAt: analysisRow.updatedAt,
    },
    200,
  );
}
