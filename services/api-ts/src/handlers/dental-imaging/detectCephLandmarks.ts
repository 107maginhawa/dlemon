/**
 * detectCephLandmarks handler  (P1-10 Phase 0)
 *
 * POST /dental/imaging/images/{imageId}/ceph/landmarks/detect
 *
 * Runs the configured CephLandmarkDetector (Phase 0: FakeDetector) and persists
 * the predictions through the EXISTING batch-upsert path as source='ai',
 * status='placed', confidence=<model> — reusing the recompute-on-write FSM with
 * zero new write logic.
 *
 * GATES (in order):
 *   1. auth (401)
 *   2. dental_imaging_auto_landmark flag OFF → 403 FEATURE_DISABLED (kill-switch)
 *   3. image / study existence + branch membership → 404 (no info leak)
 *   4. addon imaging tier → 403 IMAGING_TIER_REQUIRED
 *   5. modality must be cephalometric → 422 INVALID_MODALITY
 *
 * SAFETY (plan §4): predictions ALWAYS enter at status='placed'. AI NEVER
 * auto-confirms / auto-finalizes — the report gate (A/B/Go/Po human-'confirmed')
 * is the human-review primitive.
 *
 * PHI: the detection-run audit logs counts / modelVersion / provider only — never
 * pixel data or coordinates.
 */

import type { BaseContext } from '@/types/app';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import type { Config } from '@/core/config';
import type { StorageProvider } from '@/core/storage';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BusinessLogicError,
} from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getImagingTierForBranch } from '@/handlers/dental-org/repos/org-imaging.facade';
import { logAuditEvent } from '@/core/audit-logger';
import { computeCephAnalysis } from '@monobase/ceph-math';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';
import {
  fakeDetector,
  CEPH_LOW_CONFIDENCE_THRESHOLD,
  type CephLandmarkDetector,
} from './repos/ceph-landmark-detector';

export interface DetectCephLandmarksDeps {
  detector?: CephLandmarkDetector;
}

export async function detectCephLandmarks(
  ctx: BaseContext,
  deps: DetectCephLandmarksDeps = {},
): Promise<Response> {
  const detector = deps.detector ?? fakeDetector;

  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { imageId } = ctx.req.param() as { imageId: string };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const config = ctx.get('config') as Config | undefined;

  // KILL-SWITCH (plan §4): flag OFF hard-disables the endpoint without a deploy.
  if (!config?.features?.dentalImagingAutoLandmark) {
    logger?.warn(
      { event: 'dental-imaging.feature-disabled', userId: user.id, feature: 'auto_landmark' },
      'Auto-landmark detection is disabled',
    );
    throw new ForbiddenError(
      'Automatic landmark detection is currently disabled.',
      'FEATURE_DISABLED',
    );
  }

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
      { event: 'dental-imaging.tier-blocked', userId: user.id, feature: 'ceph_auto_landmark', currentTier: imagingTier },
      'Tier gate blocked access',
    );
    throw new ForbiddenError(
      'Cephalometric analysis requires an imaging add-on. Upgrade your plan.',
      'IMAGING_TIER_REQUIRED',
    );
  }

  // Auto-detection only applies to lateral cephalometric radiographs.
  if (image.modality !== 'cephalometric') {
    throw new BusinessLogicError(
      `Automatic landmark detection requires a cephalometric image (got '${image.modality}').`,
      'INVALID_MODALITY',
    );
  }

  // Resolve a presigned URL for the detector (it would fetch the bytes the same
  // way the canvas does). Never logged. FakeDetector ignores it.
  const storage = ctx.get('storage') as StorageProvider | undefined;
  let imageUrl: string | null = null;
  if (storage && image.fileId) {
    try {
      imageUrl = await storage.generateDownloadUrl(image.fileId);
    } catch {
      imageUrl = null;
    }
  }

  // Run the detector. A provider failure surfaces as a 'failed' result, never a 500.
  let detection;
  try {
    detection = await detector.detect({ imageId, imageUrl });
  } catch (err) {
    logger?.error(
      { imageId, provider: detector.provider, modelVersion: detector.modelVersion },
      'Ceph landmark detection failed',
    );
    return ctx.json(
      {
        jobId: crypto.randomUUID(),
        status: 'failed' as const,
        modelVersion: detector.modelVersion,
        provider: detector.provider,
        predictions: [],
        items: await cephRepo.listByImage(imageId),
        analysis: null,
        error: err instanceof Error ? err.message : 'detection failed',
      },
      200,
    );
  }

  // Persist predictions through the EXISTING ingest path: source='ai',
  // status='placed' (NEVER confirmed/locked — safety §4), confidence set.
  await cephRepo.batchUpsert(
    detection.landmarks.map((p) => ({
      imageId,
      landmarkCode: p.code,
      x: p.x,
      y: p.y,
      source: 'ai' as const,
      confidence: p.confidence,
      status: 'placed' as const,
    })),
  );

  const allLandmarks = await cephRepo.listByImage(imageId);
  const landmarkMap = Object.fromEntries(allLandmarks.map((l) => [l.landmarkCode, { x: l.x, y: l.y }]));
  const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);
  const analysisRow = await cephRepo.upsertAnalysis(imageId, {
    measurements: result.measurements,
    calibrationValue: image.pixelSpacingMm,
    calibrationMethod: image.pixelSpacingMm ? 'manual_ruler' : 'not_calibrated',
  });

  const lowConfidenceCount = detection.landmarks.filter(
    (p) => p.confidence < CEPH_LOW_CONFIDENCE_THRESHOLD,
  ).length;

  // PHI-safe audit: counts / modelVersion / provider only — no pixels, no coords.
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: study.branchId,
    branchId: study.branchId,
    action: 'imaging_ceph_landmark.auto_detected',
    eventType: 'data-modification',
    resourceType: 'imaging_ceph_landmark',
    resourceId: imageId,
    metadata: {
      imageId,
      patientId: study.patientId,
      provider: detection.provider,
      modelVersion: detection.modelVersion,
      detectedCount: detection.landmarks.length,
      lowConfidenceCount,
    },
  });

  const jobId = crypto.randomUUID();
  logger?.info(
    {
      imageId,
      action: 'ceph_landmarks_auto_detect',
      by: user.id,
      provider: detection.provider,
      modelVersion: detection.modelVersion,
      count: detection.landmarks.length,
    },
    'Ceph landmarks auto-detected',
  );

  return ctx.json(
    {
      jobId,
      status: 'succeeded' as const,
      modelVersion: detection.modelVersion,
      provider: detection.provider,
      predictions: detection.landmarks.map((p) => ({
        landmarkCode: p.code,
        x: p.x,
        y: p.y,
        confidence: p.confidence,
      })),
      items: allLandmarks,
      analysis: {
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
    },
    200,
  );
}
