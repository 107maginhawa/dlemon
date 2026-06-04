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

const DOWNS = 'Downs (1948)';

/** Downs analysis (Frankfort-Horizontal referenced). */
const DOWNS_NORMS: Record<string, CephNorm> = {
  facial_angle: { mean: 87.8, sd: 3.6, source: DOWNS },
  mandibular_plane_angle: { mean: 21.9, sd: 5, source: DOWNS },
  interincisal: { mean: 135.4, sd: 5.8, source: DOWNS },
};

const TWEED = 'Tweed';

/** Tweed triangle (Frankfort-referenced). FMA + IMPA + FMIA ≈ 180°. */
const TWEED_NORMS: Record<string, CephNorm> = {
  fma: { mean: 25, sd: 5, source: TWEED },
  impa: { mean: 90, sd: 5, source: TWEED },
  fmia: { mean: 65, sd: 5, source: TWEED },
};

const MCNAMARA = 'McNamara (1984)';

/**
 * McNamara N-perpendicular linear (mm). Means are the midpoint of the published
 * adult ranges; SD chosen to span the male/female range. A-to-Nperp ≈ +0.5 mm,
 * Pog-to-Nperp ≈ −2 mm.
 */
const MCNAMARA_NORMS: Record<string, CephNorm> = {
  a_to_nperp: { mean: 0.5, sd: 1.5, source: MCNAMARA },
  pog_to_nperp: { mean: -2, sd: 2.5, source: MCNAMARA },
};

const JARABAK = 'Jarabak';

/** Jarabak posterior/anterior facial-height ratio (%). 62–65% normal range. */
const JARABAK_NORMS: Record<string, CephNorm> = {
  pa_fhr: { mean: 64, sd: 4, source: JARABAK },
};

/**
 * Default (classic-literature, predominantly Caucasian-derived) norm tables keyed
 * by analysis type, then by measurement key. Kept as the canonical baseline; the
 * population layer below overlays ethnicity-specific overrides on top.
 */
export const CEPH_NORMS: Record<string, Record<string, CephNorm>> = {
  steiner_hybrid_sn: STEINER_HYBRID_SN,
  ricketts: RICKETTS_NORMS,
  downs: DOWNS_NORMS,
  tweed: TWEED_NORMS,
  mcnamara: MCNAMARA_NORMS,
  jarabak: JARABAK_NORMS,
};

// ---------------------------------------------------------------------------
// Population / ethnicity-selectable norms (P2-6)
// ---------------------------------------------------------------------------
//
// Norms are population-specific in the literature. Rather than a single hardcoded
// set, callers may select a reference population. The "default" population is the
// classic-literature baseline (CEPH_NORMS). Other populations supply only the
// metrics they override; any metric not overridden falls back to the default norm
// for that analysis, so a partial override table never blanks out a measurement.

/** Reference-population identifier (stable key, used in API + UI selector). */
export const DEFAULT_POPULATION = 'default';

interface PopulationDef {
  /** UI label. */
  label: string;
  /** Sparse overrides: analysisType → metric → norm. Falls back to default. */
  overrides?: Record<string, Record<string, CephNorm>>;
}

/**
 * Population definitions. Overrides are sourced from population-specific
 * cephalometric studies (e.g. Steiner/Tweed/Ricketts/McNamara mean values derived
 * for particular ethnic groups). Values are reference ranges, not a diagnosis.
 */
const POPULATIONS: Record<string, PopulationDef> = {
  [DEFAULT_POPULATION]: {
    label: 'Default (classic literature)',
  },
  caucasian: {
    label: 'Caucasian (Caucasian / European)',
    // The classic baseline is Caucasian-derived; explicit alias for clarity.
  },
  african_american: {
    label: 'African American',
    overrides: {
      steiner_hybrid_sn: {
        // Greater bimaxillary protrusion / dental procumbency reported.
        sna: { mean: 86, sd: 3.7, source: 'Drummond (African-American)' },
        snb: { mean: 83, sd: 3.5, source: 'Drummond (African-American)' },
        u1_na_angle: { mean: 26, sd: 5, source: 'Drummond (African-American)' },
        l1_nb_angle: { mean: 31, sd: 6, source: 'Drummond (African-American)' },
        interincisal: { mean: 116, sd: 9, source: 'Drummond (African-American)' },
      },
    },
  },
  japanese: {
    label: 'Japanese',
    overrides: {
      steiner_hybrid_sn: {
        // Miura et al. — flatter maxilla, more upright reference values.
        sna: { mean: 81.4, sd: 3.4, source: 'Miura (Japanese)' },
        snb: { mean: 77.9, sd: 4, source: 'Miura (Japanese)' },
        anb: { mean: 3.5, sd: 2, source: 'Miura (Japanese)' },
      },
    },
  },
  chinese: {
    label: 'Chinese (Han)',
    overrides: {
      steiner_hybrid_sn: {
        sna: { mean: 83.6, sd: 3.6, source: 'Cooke & Wei (Southern Chinese)' },
        snb: { mean: 79.7, sd: 3.6, source: 'Cooke & Wei (Southern Chinese)' },
        anb: { mean: 3.9, sd: 1.8, source: 'Cooke & Wei (Southern Chinese)' },
      },
    },
  },
  indian: {
    label: 'Indian (South Asian)',
    overrides: {
      steiner_hybrid_sn: {
        sna: { mean: 83.4, sd: 3.4, source: 'Maratha population (Indian)' },
        snb: { mean: 80.1, sd: 3.2, source: 'Maratha population (Indian)' },
      },
    },
  },
};

/** All selectable population keys (stable order; default first). */
export const NORM_POPULATIONS: string[] = Object.keys(POPULATIONS);

/** Human-readable label for a population key (falls back to the key itself). */
export function getPopulationLabel(population: string): string {
  return POPULATIONS[population]?.label ?? population;
}

/**
 * Look up a norm for a metric within an analysis type, for a given reference
 * population. Population is optional and defaults to the classic-literature set,
 * making this fully backwards compatible with the 2-arg callers.
 *
 * Resolution order: population override → default analysis norm → null.
 * An unknown population transparently uses the default set (no null bleed).
 */
export function getNorm(
  analysisType: string,
  metric: string,
  population: string = DEFAULT_POPULATION,
): CephNorm | null {
  const override = POPULATIONS[population]?.overrides?.[analysisType]?.[metric];
  if (override) return override;
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
