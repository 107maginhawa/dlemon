/**
 * CephMgmt_createCephReport
 *
 * POST /dental/imaging/images/{imageId}/ceph/reports
 *
 * D-I: Creates an immutable versioned snapshot. Report landmarks/measurements
 *      are frozen — subsequent landmark edits create a new version.
 * D-L: Blocked (409) unless A, B, Go, and Po are all 'confirmed'.
 * D-4: Snapshot includes study_date, patient_display_id, branch_name.
 */

import { eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { resolveImagingTier } from '@/handlers/dental-org/repos/organization.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { computeCephAnalysis } from '@monobase/ceph-math';
import type { CephMgmt_createCephReportParams } from '@/generated/openapi/validators';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';
import { CEPH_REPORT_GATE_LANDMARKS } from './repos/imaging_ceph.schema';

const SOFTWARE_VERSION = '1.4.0';

export async function CephMgmt_createCephReport(
  ctx: ValidatedContext<never, never, CephMgmt_createCephReportParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const image = await imagingRepo.findImageById(params.imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  try {
    await assertBranchAccess(db, user.id, study.branchId);
  } catch {
    throw new NotFoundError('Image not found');
  }

  const [orgRow] = await db
    .select({ imagingTier: dentalOrganizations.imagingTier, branchName: dentalBranches.name })
    .from(dentalBranches)
    .innerJoin(dentalOrganizations, eq(dentalBranches.organizationId, dentalOrganizations.id))
    .where(eq(dentalBranches.id, study.branchId))
    .limit(1);
  if (resolveImagingTier(orgRow?.imagingTier ?? null) === 'free') {
    throw new ForbiddenError('Cephalometric analysis requires an imaging add-on. Upgrade your plan.');
  }

  const allLandmarks = await cephRepo.listByImage(params.imageId);
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
  // study_date: use study.createdAt as fallback (no study_date column yet)
  const studyDate = study.createdAt.toISOString().split('T')[0] ?? study.createdAt.toISOString();
  const branchName = orgRow?.branchName ?? study.branchId;

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

  const report = await cephRepo.createReportVersion(params.imageId, snapshot, user.id);

  logger?.info(
    { imageId: params.imageId, reportVersion: report.version, action: 'ceph_report_create', by: user.id },
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
