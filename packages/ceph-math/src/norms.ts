/**
 * Cephalometric population norms, keyed by analysis type.
 *
 * Norms are intentionally keyed by analysis type so that switching analyses (e.g.
 * Steiner → Ricketts) swaps the reference values too — showing Steiner norms against
 * a different analysis would be a patient-safety bug. Metrics without a well-established
 * SN-referenced norm are deliberately OMITTED (getNorm → null → no comparison shown)
 * rather than displaying a fabricated reference range.
 *
 * Values are adult means ± SD from the classic literature; these are reference ranges,
 * not a diagnosis.
 */

export interface CephNorm {
  /** Population mean. */
  mean: number;
  /** Population standard deviation. */
  sd: number;
  /** Citation for the reference range. */
  source: string;
}

export type DeviationSeverity = 'normal' | 'mild' | 'severe';

export interface Deviation {
  /** measured − mean (signed, same units as the metric). */
  delta: number;
  /** Standard deviations away from the mean (signed). 0 when sd is 0. */
  sdAway: number;
  /** normal ≤1 SD · mild 1–2 SD · severe >2 SD. */
  severity: DeviationSeverity;
}

const STEINER = 'Steiner (1953)';
const RIEDEL = 'Riedel / Steiner';

/**
 * Steiner analysis (SN-referenced). Only metrics with a defensible classic norm are
 * included. Omitted on purpose: facial_angle_sn, y_axis_sn (no clean SN-referenced
 * norm — Downs values are Frankfort-referenced and not interchangeable here).
 */
const STEINER_HYBRID_SN: Record<string, CephNorm> = {
  sna: { mean: 82, sd: 2, source: RIEDEL },
  snb: { mean: 80, sd: 2, source: RIEDEL },
  anb: { mean: 2, sd: 2, source: STEINER },
  sn_gome: { mean: 32, sd: 5, source: STEINER },
  u1_sn: { mean: 103, sd: 5, source: STEINER },
  u1_na_angle: { mean: 22, sd: 2, source: STEINER },
  u1_na_mm: { mean: 4, sd: 2, source: STEINER },
  l1_nb_angle: { mean: 25, sd: 2, source: STEINER },
  l1_nb_mm: { mean: 4, sd: 2, source: STEINER },
  impa: { mean: 90, sd: 5, source: 'Tweed' },
  interincisal: { mean: 131, sd: 6, source: STEINER },
  convexity_napog: { mean: 0, sd: 5, source: 'Downs (convexity)' },
  overjet: { mean: 2.5, sd: 2, source: 'Clinical norm' },
  overbite: { mean: 2.5, sd: 2, source: 'Clinical norm' },
};

const RICKETTS = 'Ricketts (1960)';

/**
 * Ricketts analysis (Frankfort-Horizontal referenced). Only the subset of metrics
 * the engine computes from the D-A landmark set is normed; metrics needing
 * Basion/Pterygoid are omitted (the engine does not emit them).
 */
const RICKETTS_NORMS: Record<string, CephNorm> = {
  facial_angle: { mean: 87, sd: 3, source: RICKETTS },
  mandibular_plane_fh: { mean: 26, sd: 4, source: RICKETTS },
  convexity_mm: { mean: 2, sd: 2, source: RICKETTS },
  l1_apog_angle: { mean: 22, sd: 4, source: RICKETTS },
  l1_apog_mm: { mean: 1, sd: 2, source: RICKETTS },
  interincisal: { mean: 130, sd: 6, source: RICKETTS },
};

/** Norm tables keyed by analysis type, then by measurement key. */
export const CEPH_NORMS: Record<string, Record<string, CephNorm>> = {
  steiner_hybrid_sn: STEINER_HYBRID_SN,
  ricketts: RICKETTS_NORMS,
};

/** Look up a norm for a metric within an analysis type. Returns null if none exists. */
export function getNorm(analysisType: string, metric: string): CephNorm | null {
  return CEPH_NORMS[analysisType]?.[metric] ?? null;
}

/**
 * Classify a measured value against a norm. Returns null when the value is missing.
 * Severity: |z| ≤ 1 → normal, 1 < |z| ≤ 2 → mild, |z| > 2 → severe.
 * The signed delta is always reported so the UI never relies on color alone.
 */
export function classifyDeviation(value: number | null | undefined, norm: CephNorm): Deviation | null {
  if (value == null || Number.isNaN(value)) return null;
  const delta = Math.round((value - norm.mean) * 100) / 100;
  const sdAway = norm.sd > 0 ? delta / norm.sd : 0;
  const abs = Math.abs(sdAway);
  const severity: DeviationSeverity = abs <= 1 ? 'normal' : abs <= 2 ? 'mild' : 'severe';
  return { delta, sdAway, severity };
}
