/**
 * Cephalometric superimposition / change-over-time engine — pure, isomorphic
 * (Bun + QuickJS/Tauri). No DB imports. No side effects. No DOM.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  CLINICAL HONESTY (plan §2, §8 — the biggest risk):
 *
 *  v1 ships a TWO-POINT SIMILARITY registration on the cranial base (S–N).
 *  This is NOT ABO-grade structural superimposition (which registers on
 *  remodelling-stable *outlines*, not two points). It is a simplified,
 *  reproducible, auditable alignment whose output is a *measurement of change*,
 *  never a diagnosis. The maxillary / mandibular structural registrations
 *  (ABO-complete) are v2 and intentionally NOT implemented here.
 *
 *  Consumers MUST label v1 output as "Cranial-base (S–N) point registration —
 *  a simplified superimposition; structural registration in v2" and MUST gate
 *  mm displacement on calibration of *both* timepoints (never px-as-mm).
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Coordinate system: image-space, +y downward (matches the rest of the engine
 * and coords.ts). The similarity transform maps timepoint-B image-space onto
 * timepoint-A image-space so the registration landmarks coincide.
 */

import type { Point, LandmarkMap } from './index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Registration reference frame. v1 supports `cranial_base` only. */
export const SUPERIMPOSITION_REFERENCES = ['cranial_base', 'maxillary', 'mandibular'] as const;
export type SuperimpositionReference = (typeof SUPERIMPOSITION_REFERENCES)[number];

/** Reference frames implemented in v1. Others are visible-but-deferred (v2). */
export const SUPERIMPOSITION_V1_REFERENCES: readonly SuperimpositionReference[] = ['cranial_base'];

/**
 * The stable-landmark basis for each registration reference (plan §3.1).
 * v1 registers cranial base on the S–N two-point set (the existing reference
 * frame, CEPH_LINES `sn`). Maxillary / mandibular bases are declared so the
 * clinical model is legible from day one, but their math is v2.
 */
export const REGISTRATION_BASIS: Record<SuperimpositionReference, readonly string[]> = {
  cranial_base: ['S', 'N'],
  maxillary: ['ANS', 'PNS'], // v2
  mandibular: ['Go', 'Me'], // v2
};

/**
 * Similarity (rigid + uniform scale) transform mapping B → A image-space.
 *   A = scale · R(rotationRad) · B + (tx, ty)
 */
export interface SimilarityTransform {
  scale: number;
  rotationRad: number;
  tx: number;
  ty: number;
  /** landmark codes used as the registration basis (audit/provenance). */
  basis: string[];
}

export interface LandmarkDelta {
  landmarkCode: string;
  /** displacement in the registered frame, image-space px (B mapped into A − A). */
  dxPx: number;
  dyPx: number;
  magnitudePx: number;
  /** mm values — null when either timepoint is uncalibrated (never px-as-mm). */
  dxMm: number | null;
  dyMm: number | null;
  magnitudeMm: number | null;
  /** direction of displacement in degrees, atan2(dy, dx), +y-down. */
  directionDeg: number;
}

export interface MetricDelta {
  metric: string;
  from: number | null;
  to: number | null;
  /** signed (to − from); null when either side is missing (no fabricated Δ). */
  delta: number | null;
}

export interface SuperimpositionResult {
  reference: SuperimpositionReference;
  transform: SimilarityTransform;
  landmarkDeltas: LandmarkDelta[];
  metricDeltas: MetricDelta[];
  /** true when mm deltas are unavailable (either timepoint uncalibrated). */
  uncalibrated: boolean;
}

/** Thrown when registration points are degenerate (coincident). */
export class DegenerateRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DegenerateRegistrationError';
  }
}

// ---------------------------------------------------------------------------
// Helpers (cross-runtime determinism: round to 4 dp for transform, 2 dp deltas)
// ---------------------------------------------------------------------------

function r4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

const COINCIDENT_EPS = 1e-9;

// ---------------------------------------------------------------------------
// Similarity registration (Umeyama / Procrustes, uniform scale)
// ---------------------------------------------------------------------------

/**
 * Least-squares similarity transform that maps `fromPts` (timepoint B) onto
 * `toPts` (timepoint A): finds scale s, rotation θ, translation t minimising
 * Σ‖ s·R·from_i + t − to_i ‖².
 *
 * For the 2-point case (v1 cranial base S–N) this is exact. For n>2 it is the
 * closed-form least-squares solution (Umeyama 1991). The math is deliberately
 * dependency-free and isomorphic so it runs identically under Bun and QuickJS.
 *
 * @throws {DegenerateRegistrationError} if either point set is coincident
 *         (zero spread) — scale/rotation are undefined; never returns NaN.
 */
export function registerSimilarity(
  fromPts: Point[],
  toPts: Point[],
  basis: string[] = [],
): SimilarityTransform {
  if (fromPts.length !== toPts.length) {
    throw new DegenerateRegistrationError('registration point sets differ in length');
  }
  const n = fromPts.length;
  if (n < 2) {
    throw new DegenerateRegistrationError('similarity registration needs at least 2 points');
  }

  // Centroids
  const fc = centroid(fromPts);
  const tc = centroid(toPts);

  // Centred coords + variance of `from`
  let varFrom = 0;
  // Cross-covariance terms (2x2). a = Σ f·t (aligned), b = Σ cross.
  let sxx = 0; // Σ fx·tx + fy·ty  → rotation cos component
  let sxy = 0; // Σ fx·ty − fy·tx  → rotation sin component
  for (let i = 0; i < n; i++) {
    const fx = fromPts[i]!.x - fc.x;
    const fy = fromPts[i]!.y - fc.y;
    const tx = toPts[i]!.x - tc.x;
    const ty = toPts[i]!.y - tc.y;
    varFrom += fx * fx + fy * fy;
    sxx += fx * tx + fy * ty;
    sxy += fx * ty - fy * tx;
  }

  if (varFrom < COINCIDENT_EPS) {
    throw new DegenerateRegistrationError(
      'registration source points are coincident (zero spread)',
    );
  }

  const rotationRad = Math.atan2(sxy, sxx);
  // scale = |cross-covariance| / varFrom  (Umeyama uniform-scale)
  const scale = Math.hypot(sxx, sxy) / varFrom;

  if (!Number.isFinite(scale) || scale < COINCIDENT_EPS) {
    throw new DegenerateRegistrationError(
      'registration target points are coincident (degenerate scale)',
    );
  }

  // translation: t = tc − s·R·fc
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const rFcx = scale * (cos * fc.x - sin * fc.y);
  const rFcy = scale * (sin * fc.x + cos * fc.y);
  const tx = tc.x - rFcx;
  const ty = tc.y - rFcy;

  return {
    scale: r4(scale),
    rotationRad: r4(rotationRad),
    tx: r4(tx),
    ty: r4(ty),
    basis: [...basis],
  };
}

function centroid(pts: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

/** Apply a similarity transform to a point: A = s·R·p + t. */
export function applyTransform(p: Point, t: SimilarityTransform): Point {
  const cos = Math.cos(t.rotationRad);
  const sin = Math.sin(t.rotationRad);
  return {
    x: t.scale * (cos * p.x - sin * p.y) + t.tx,
    y: t.scale * (sin * p.x + cos * p.y) + t.ty,
  };
}

/** Invert a similarity transform (exact inverse of applyTransform). */
export function invertTransform(t: SimilarityTransform): SimilarityTransform {
  const invScale = 1 / t.scale;
  const invRot = -t.rotationRad;
  const cos = Math.cos(invRot);
  const sin = Math.sin(invRot);
  // p = (1/s)·R^T·(A − t)  →  expressed as similarity: scale=1/s, rot=-θ,
  // translation = −(1/s)·R^T·t
  const tx = -invScale * (cos * t.tx - sin * t.ty);
  const ty = -invScale * (sin * t.tx + cos * t.ty);
  return {
    scale: invScale,
    rotationRad: invRot,
    tx,
    ty,
    basis: [...t.basis],
  };
}

// ---------------------------------------------------------------------------
// Deltas
// ---------------------------------------------------------------------------

/**
 * Per-landmark displacement between two timepoints in the registered frame.
 * For each code present in BOTH maps, map the B point through the registration
 * transform and measure its offset from the A point.
 *
 * mm values are emitted ONLY when both timepoints are calibrated and pass the
 * mm-gate (uses the A-frame pixel spacing, since B is registered into A-space).
 * Never returns px values as mm (plan §3.3, §8).
 */
export function computeLandmarkDeltas(
  fromLandmarks: LandmarkMap,
  toLandmarks: LandmarkMap,
  transform: SimilarityTransform,
  opts: { fromPixelSpacingMm: number | null; toPixelSpacingMm: number | null },
): { deltas: LandmarkDelta[]; uncalibrated: boolean } {
  const mmGate = mmGateSpacing(opts.fromPixelSpacingMm, opts.toPixelSpacingMm);
  const uncalibrated = mmGate === null;
  const deltas: LandmarkDelta[] = [];

  const codes = Object.keys(fromLandmarks).filter((c) => toLandmarks[c] != null);
  codes.sort();
  for (const code of codes) {
    const a = toLandmarks[code]!; // timepoint A (base frame)
    const bMapped = applyTransform(fromLandmarks[code]!, transform);
    const dxPx = a.x - bMapped.x;
    const dyPx = a.y - bMapped.y;
    const magnitudePx = Math.hypot(dxPx, dyPx);
    const directionDeg = (Math.atan2(dyPx, dxPx) * 180) / Math.PI;
    deltas.push({
      landmarkCode: code,
      dxPx: r2(dxPx),
      dyPx: r2(dyPx),
      magnitudePx: r2(magnitudePx),
      dxMm: mmGate !== null ? r2(dxPx * mmGate) : null,
      dyMm: mmGate !== null ? r2(dyPx * mmGate) : null,
      magnitudeMm: mmGate !== null ? r2(magnitudePx * mmGate) : null,
      directionDeg: r2(directionDeg),
    });
  }
  return { deltas, uncalibrated };
}

/**
 * mm-gate: both timepoints must be calibrated and within the same valid range
 * the rest of the engine enforces (MM_PX_MIN..MAX, mirrors validateCalibration).
 * Returns the A-frame spacing to use for mm conversion, or null if uncalibrated.
 */
const MM_PX_MIN = 0.05;
const MM_PX_MAX = 0.5;
function mmGateSpacing(
  fromSpacing: number | null,
  toSpacing: number | null,
): number | null {
  if (fromSpacing == null || toSpacing == null) return null;
  for (const s of [fromSpacing, toSpacing]) {
    if (!Number.isFinite(s) || s < MM_PX_MIN || s > MM_PX_MAX) return null;
  }
  // B is registered into A-space (transform absorbs uniform magnification), so
  // displacement is expressed in A-frame pixels → convert with A spacing.
  return toSpacing;
}

/**
 * Signed per-metric Δ between two `measurements` JSONB payloads (plan §3.3).
 * Δ = to − from. Missing key on either side → delta null (no fabricated Δ).
 */
export function computeMetricDeltas(
  fromMeasurements: Record<string, number | null>,
  toMeasurements: Record<string, number | null>,
): MetricDelta[] {
  const metrics = new Set<string>([
    ...Object.keys(fromMeasurements),
    ...Object.keys(toMeasurements),
  ]);
  const out: MetricDelta[] = [];
  for (const metric of [...metrics].sort()) {
    const from = fromMeasurements[metric] ?? null;
    const to = toMeasurements[metric] ?? null;
    const delta = from != null && to != null ? r2(to - from) : null;
    out.push({ metric, from, to, delta });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Orchestration: full superimposition from two landmark/measurement snapshots
// ---------------------------------------------------------------------------

export interface SuperimpositionInput {
  reference: SuperimpositionReference;
  fromLandmarks: LandmarkMap;
  toLandmarks: LandmarkMap;
  fromMeasurements: Record<string, number | null>;
  toMeasurements: Record<string, number | null>;
  fromPixelSpacingMm: number | null;
  toPixelSpacingMm: number | null;
}

export class InsufficientRegistrationLandmarksError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`registration basis landmark(s) missing on both timepoints: ${missing.join(', ')}`);
    this.name = 'InsufficientRegistrationLandmarksError';
    this.missing = missing;
  }
}

export class ReferenceNotImplementedError extends Error {
  constructor(reference: string) {
    super(`registration reference "${reference}" is not implemented in v1 (cranial_base only)`);
    this.name = 'ReferenceNotImplementedError';
  }
}

/**
 * Compute a full superimposition (transform + deltas) from two snapshots.
 * Pure — callers (handler/FE) decide persistence and labelling.
 *
 * @throws {ReferenceNotImplementedError} for non-cranial_base in v1
 * @throws {InsufficientRegistrationLandmarksError} when the basis isn't on both
 * @throws {DegenerateRegistrationError} for coincident basis points
 */
export function computeSuperimposition(input: SuperimpositionInput): SuperimpositionResult {
  if (!SUPERIMPOSITION_V1_REFERENCES.includes(input.reference)) {
    throw new ReferenceNotImplementedError(input.reference);
  }

  const basis = REGISTRATION_BASIS[input.reference];
  const missing = basis.filter(
    (code) => input.fromLandmarks[code] == null || input.toLandmarks[code] == null,
  );
  if (missing.length > 0) {
    throw new InsufficientRegistrationLandmarksError(missing);
  }

  const fromPts = basis.map((code) => input.fromLandmarks[code]!);
  const toPts = basis.map((code) => input.toLandmarks[code]!);
  const transform = registerSimilarity(fromPts, toPts, [...basis]);

  const { deltas, uncalibrated } = computeLandmarkDeltas(
    input.fromLandmarks,
    input.toLandmarks,
    transform,
    {
      fromPixelSpacingMm: input.fromPixelSpacingMm,
      toPixelSpacingMm: input.toPixelSpacingMm,
    },
  );
  const metricDeltas = computeMetricDeltas(input.fromMeasurements, input.toMeasurements);

  return {
    reference: input.reference,
    transform,
    landmarkDeltas: deltas,
    metricDeltas,
    uncalibrated,
  };
}
