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
import { computeCephAnalysis } from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';
import { CEPH_REPORT_GATE_LANDMARKS } from './repos/imaging_ceph.schema';

const SOFTWARE_VERSION = '1.4.0';

export async function createCephReport(ctx: BaseContext): Promise<Response> {
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

  const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);

  // D-4: context fields from imaging_study + branch
  const studyDate = study.createdAt.toISOString().split('T')[0] ?? study.createdAt.toISOString();
  const branchName = orgData.branchName ?? study.branchId;

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
    analysis_label: 'steiner_hybrid_sn',
    calibration: {
      value: image.pixelSpacingMm,
      method: image.pixelSpacingMm ? 'manual_ruler' : 'not_calibrated',
    },
    software_version: SOFTWARE_VERSION,
    operator: user.id,
    generated_at: new Date().toISOString(),
    // D-4 context fields
    study_date: studyDate,
    patient_display_id: study.patientId,
    branch_name: branchName,
  };

  const report = await cephRepo.createReportVersion(imageId, snapshot, user.id);

  logger?.info(
    { imageId, reportVersion: report.version, action: 'ceph_report_create', by: user.id },
    'Ceph report version created',
  );

  return ctx.json(
    {
      id: report.id,
      imageId: report.imageId,
      version: report.version,
      snapshot: report.snapshot,
      createdAt: report.createdAt,
    },
    201,
  );
}
