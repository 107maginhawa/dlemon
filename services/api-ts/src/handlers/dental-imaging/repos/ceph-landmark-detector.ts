/**
 * CephLandmarkDetector — provider seam for AI / auto cephalometric landmarking.
 *
 * P1-10 Phase 0 (plan §3/§6): this is the SEAM only. The production detector
 * (self-hosted CNN sidecar — Option B — or a BAA-gated vendor adapter — Option A)
 * is Phase 1 and lands behind this same interface with zero handler/schema/FE
 * change. Phase 0 ships a deterministic `FakeDetector` so the entire
 * provenance / safety / UX skeleton is testable and demoable without a model.
 *
 * Coordinate contract (D-C): predictions are returned in IMAGE-SPACE PIXELS to
 * match `imaging_ceph_landmark.x/y`. A vendor adapter MUST map its own space back.
 *
 * PHI: a detector receives a presigned image URL; it MUST NOT log pixel data or
 * coordinates. Detection-run audit logs counts / modelVersion / provider only.
 */

import { LANDMARK_CODES } from '@monobase/ceph-math';

export type CephLandmarkCode = (typeof LANDMARK_CODES)[number];

export interface CephLandmarkDetectorInput {
  /** Presigned download URL the detector would fetch bytes from (PHI). */
  imageUrl: string | null;
  imageId: string;
  /** Optional image dimensions so predictions can be sanity-bound. */
  width?: number | null;
  height?: number | null;
}

export interface CephLandmarkDetectorPrediction {
  code: CephLandmarkCode;
  /** Image-space pixels (D-C). */
  x: number;
  y: number;
  /** Model confidence in [0, 1]. */
  confidence: number;
}

export interface CephLandmarkDetectorResult {
  modelVersion: string;
  provider: string;
  landmarks: CephLandmarkDetectorPrediction[];
}

export interface CephLandmarkDetector {
  readonly provider: string;
  readonly modelVersion: string;
  detect(input: CephLandmarkDetectorInput): Promise<CephLandmarkDetectorResult>;
}

/**
 * FakeDetector — deterministic fixture detector for Phase 0.
 *
 * Returns a fixed set of skeletal-landmark predictions in a plausible lateral-ceph
 * arrangement with per-point confidence. Output is DETERMINISTIC for a given image
 * (no randomness) so contract / E2E tests are stable. NOT a clinical detector — it
 * never claims accuracy; it exists to exercise the seam + safety + provenance + UX.
 *
 * Confidences are deliberately mixed (one < 0.6) so the low-confidence flag path is
 * exercised end-to-end. Soft-tissue points are intentionally absent (our landmark
 * set is hard-tissue only — plan §2 — which sidesteps the weakest detection case).
 */
export const FAKE_DETECTOR_MODEL_VERSION = 'fake-detector-v0';
export const FAKE_DETECTOR_PROVIDER = 'fake';

// Deterministic fixture predictions (image-space px). Includes the 4 report-gate
// landmarks (A/B/Go/Po) plus the S–N reference line, so the full review→confirm
// →report flow is demoable. `Go` carries low confidence to exercise the flag.
const FIXTURE_PREDICTIONS: ReadonlyArray<CephLandmarkDetectorPrediction> = [
  { code: 'S', x: 320, y: 130, confidence: 0.94 },
  { code: 'N', x: 300, y: 150, confidence: 0.92 },
  { code: 'A', x: 280, y: 300, confidence: 0.81 },
  { code: 'B', x: 270, y: 350, confidence: 0.78 },
  { code: 'Go', x: 200, y: 400, confidence: 0.52 }, // low confidence → flagged
  { code: 'Po', x: 350, y: 100, confidence: 0.88 },
  { code: 'Or', x: 330, y: 180, confidence: 0.83 },
  { code: 'Me', x: 260, y: 420, confidence: 0.86 },
];

export class FakeDetector implements CephLandmarkDetector {
  readonly provider = FAKE_DETECTOR_PROVIDER;
  readonly modelVersion = FAKE_DETECTOR_MODEL_VERSION;

  async detect(input: CephLandmarkDetectorInput): Promise<CephLandmarkDetectorResult> {
    // Sanity-bound predictions to image dimensions when known (plan §8 mitigation
    // for coordinate-space drift). No-op when dimensions are unknown.
    const clamp = (v: number, max: number | null | undefined): number =>
      max != null && max > 0 ? Math.min(Math.max(v, 0), max) : Math.max(v, 0);

    const landmarks = FIXTURE_PREDICTIONS.map((p) => ({
      code: p.code,
      x: clamp(p.x, input.width),
      y: clamp(p.y, input.height),
      confidence: p.confidence,
    }));

    return { modelVersion: this.modelVersion, provider: this.provider, landmarks };
  }
}

/** Default Phase-0 detector singleton. Swapped for the real detector in Phase 1. */
export const fakeDetector = new FakeDetector();

/**
 * Low-confidence threshold — predictions below this are flagged for clinician
 * attention (plan §4: "flag points below a configurable threshold"). Kept here as
 * the single source of truth so backend audit + FE rendering agree.
 */
export const CEPH_LOW_CONFIDENCE_THRESHOLD = 0.6;
