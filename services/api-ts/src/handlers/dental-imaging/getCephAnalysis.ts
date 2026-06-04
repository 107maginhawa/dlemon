/**
 * getCephAnalysis handler
 *
 * GET /dental/imaging/images/{imageId}/ceph/analysis
 *
 * Returns current analysis for a ceph image. Never 404 — returns empty state
 * with all landmark codes in missing[] when no landmarks have been placed.
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { logAuditEvent } from '@/core/audit-logger';
import { computeAnalysis, ANALYSIS_TYPES } from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';

export async function getCephAnalysis(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };

  // #15: analysisType selects the protocol. Unknown values are rejected rather
  // than silently falling back — showing the wrong analysis is a safety bug.
  const analysisType = ctx.req.query('analysisType') ?? 'steiner_hybrid_sn';
  if (!(ANALYSIS_TYPES as readonly string[]).includes(analysisType)) {
    throw new BusinessLogicError(
      `Unsupported analysis type "${analysisType}". Supported: ${ANALYSIS_TYPES.join(', ')}.`,
      'UNSUPPORTED_ANALYSIS_TYPE',
    );
  }

  const db = ctx.get('database') as DatabaseInstance;
  const imagingRepo = new ImagingRepository(db);
  const cephRepo = new ImagingCephRepository(db);

  const image = await imagingRepo.findImageById(imageId);
  if (!image) throw new NotFoundError('Image not found');

  const study = await imagingRepo.findStudyById(image.studyId);
  if (!study) throw new NotFoundError('Parent imaging study not found');

  try {
    await assertBranchAccess(db, user.id, study.branchId);
  } catch {
    throw new NotFoundError('Image not found');
  }

  const imagingTier = await getImagingTierForBranch(db, study.branchId);
  if (imagingTier !== 'addon') {
    ctx.get('logger')?.warn(
      { event: 'dental-imaging.tier-blocked', userId: user.id, feature: 'ceph_analysis', currentTier: imagingTier },
      'Tier gate blocked access',
    );
    throw new ForbiddenError(
      'Cephalometric analysis requires an imaging add-on. Upgrade your plan.',
      'IMAGING_TIER_REQUIRED',
    );
  }

  const allLandmarks = await cephRepo.listByImage(imageId);
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));
  const result = computeAnalysis(analysisType, landmarkMap, image.pixelSpacingMm ?? null);
  const analysisRow = await cephRepo.findAnalysis(imageId);

  // V-IMG-006: ceph analysis exposes patient radiograph PHI — audit the read.
  await logAuditEvent(db, ctx.get('logger'), {
    personId: user.id,
    tenantId: study.branchId,
    branchId: study.branchId,
    action: 'imaging_ceph_analysis.read',
    eventType: 'data-access',
    resourceType: 'imaging_ceph_analysis',
    resourceId: imageId,
    metadata: { patientId: study.patientId, imageId },
  });

  // Returns {items, analysis} — never 404 (empty state has items:[], all codes in missing[])
  return ctx.json(
    {
      items: allLandmarks,
      analysis: {
        imageId,
        analysisType,
        measurements: result.measurements,
        missing: result.missing,
        uncalibrated: result.uncalibrated,
        calibrationValue: analysisRow?.calibrationValue ?? null,
        calibrationMethod: analysisRow?.calibrationMethod ?? null,
        calibratedAt: analysisRow?.calibratedAt ?? null,
        calibratedBy: analysisRow?.calibratedBy ?? null,
        updatedAt: analysisRow?.updatedAt ?? new Date(),
      },
    },
    200,
  );
}
