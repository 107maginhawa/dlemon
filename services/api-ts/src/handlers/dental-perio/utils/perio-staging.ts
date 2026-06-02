/**
 * perio-staging.ts — 2017 AAP/EFP periodontitis staging & grading (P1-6).
 *
 * Implements the multidimensional classification from the 2017 World Workshop
 * (AAP + EFP). Thresholds are taken verbatim from
 * docs/reviews/research/perio.md §"2017 AAP/EFP classification":
 *
 * STAGING — primary determinant is interdental CAL at the worst site; tooth
 * loss and complexity factors can only shift the stage UPWARD (never down):
 *   Stage I   : interdental CAL 1–2mm ; max PD ≤4mm, mostly horizontal
 *   Stage II  : interdental CAL 3–4mm ; max PD ≤5mm, mostly horizontal
 *   Stage III : interdental CAL ≥5mm  ; PD ≥6mm, vertical bone loss ≥3mm,
 *               furcation II/III ; tooth loss ≤4
 *   Stage IV  : as III + masticatory dysfunction, mobility ≥2 (secondary
 *               occlusal trauma), bite collapse, <20 teeth ; tooth loss ≥5
 *
 * GRADING — start by assuming Grade B, then shift to A or C:
 *   Indirect %bone-loss ÷ age : <0.25 → A ; 0.25–1.0 → B ; >1.0 → C
 *   Smoking modifier          : non-smoker → keep ; <10 cig/day → ≥B ; ≥10 → C
 *   Diabetes modifier         : normoglycemic → keep ; HbA1c <7.0 → ≥B ; ≥7.0 → C
 *   (Direct 5-yr CAL/RBL progression, when available, overrides the indirect ratio.)
 *
 * EXTENT — localized (<30% of teeth involved), generalized (≥30%), or
 * molar/incisor pattern.
 *
 * Pure functions only — no DB, no I/O. Inputs are derived from the charted
 * readings (CAL via perio-cal.ts) plus optional risk-factor inputs sourced from
 * medical history (smoking, HbA1c) which the chart itself does not capture.
 */

export type PerioStage = 'I' | 'II' | 'III' | 'IV';
export type PerioGrade = 'A' | 'B' | 'C';
export type PerioExtent = 'localized' | 'generalized' | 'molar_incisor';

// ─── Staging ────────────────────────────────────────────────────────────────

export interface StagingInputs {
  /** Worst-site interdental CAL in mm (primary determinant). */
  worstInterdentalCalMm: number | null;
  /** Greatest probing depth recorded across the mouth (mm). */
  maxProbingDepthMm?: number | null;
  /** Teeth lost due to periodontitis. */
  toothLossCount?: number;
  /** Worst furcation grade (Glickman/Hamp 0–3); ≥2 is a complexity factor. */
  maxFurcationGrade?: number;
  /** Worst mobility grade (Miller 0–3); ≥2 is a Stage-IV complexity factor. */
  maxMobilityGrade?: number;
  /** Remaining teeth; <20 (i.e. <10 opposing pairs) is a Stage-IV factor. */
  remainingTeeth?: number;
  /** Explicit bite collapse / masticatory dysfunction (Stage-IV factor). */
  biteCollapse?: boolean;
}

/**
 * Compute the 2017 stage. Returns null when there is no CAL evidence (CAL is the
 * primary determinant and periodontitis cannot be staged without it).
 */
export function computeStage(inputs: StagingInputs): PerioStage | null {
  const cal = inputs.worstInterdentalCalMm;
  if (cal === null || cal === undefined) return null;

  // Base severity from interdental CAL.
  let stageOrdinal: number;
  if (cal <= 2) stageOrdinal = 1; // Stage I  (1–2mm; ≤0 is sub-clinical → still I floor)
  else if (cal <= 4) stageOrdinal = 2; // Stage II (3–4mm)
  else stageOrdinal = 3; // Stage III (≥5mm)

  // Complexity factors can only raise the stage (never lower it).
  const maxPd = inputs.maxProbingDepthMm ?? 0;
  const furc = inputs.maxFurcationGrade ?? 0;
  // PD ≥6mm, furcation II/III → at least Stage III.
  if (maxPd >= 6 || furc >= 2) stageOrdinal = Math.max(stageOrdinal, 3);

  // Tooth loss due to perio: ≤4 → ≥III; ≥5 → IV.
  const toothLoss = inputs.toothLossCount ?? 0;
  if (toothLoss >= 1 && toothLoss <= 4) stageOrdinal = Math.max(stageOrdinal, 3);
  if (toothLoss >= 5) stageOrdinal = Math.max(stageOrdinal, 4);

  // Stage-IV complexity: mobility ≥2 (secondary occlusal trauma), bite collapse,
  // or <20 remaining teeth. Only applies once the case is already advanced (≥III).
  const mob = inputs.maxMobilityGrade ?? 0;
  const fewTeeth = inputs.remainingTeeth !== undefined && inputs.remainingTeeth < 20;
  if (stageOrdinal >= 3 && (mob >= 2 || inputs.biteCollapse === true || fewTeeth)) {
    stageOrdinal = 4;
  }

  return (['I', 'II', 'III', 'IV'] as const)[stageOrdinal - 1]!;
}

// ─── Grading ──────────────────────────────────────────────────────────────────

export interface GradingInputs {
  /** Indirect: radiographic %bone-loss at the worst site (0–100). */
  bonelossPercent?: number | null;
  /** Patient age in years (denominator for the bone-loss÷age ratio). */
  ageYears?: number | null;
  /**
   * Direct 5-yr progression in mm (RBL or CAL). When provided it overrides the
   * indirect ratio: no loss → A, <2mm → B, ≥2mm → C.
   */
  fiveYearProgressionMm?: number | null;
  /** Cigarettes per day (smoking modifier). */
  cigarettesPerDay?: number | null;
  /** Whether the patient has diabetes. */
  hasDiabetes?: boolean;
  /** Most recent HbA1c % (diabetes modifier). */
  hba1cPercent?: number | null;
}

const GRADE_ORDINAL: Record<PerioGrade, number> = { A: 1, B: 2, C: 3 };
const ORDINAL_GRADE: PerioGrade[] = ['A', 'B', 'C'];

/**
 * Compute the 2017 grade. Starts at Grade B (the default assumption) and shifts:
 * direct 5-yr progression overrides the indirect %bone-loss÷age ratio; smoking
 * and diabetes modifiers can only raise the grade, never lower it.
 */
export function computeGrade(inputs: GradingInputs): PerioGrade {
  let grade: PerioGrade = 'B'; // default assumption per the workshop algorithm

  // Primary evidence: direct progression overrides indirect ratio.
  if (inputs.fiveYearProgressionMm !== null && inputs.fiveYearProgressionMm !== undefined) {
    const p = inputs.fiveYearProgressionMm;
    grade = p <= 0 ? 'A' : p < 2 ? 'B' : 'C';
  } else if (
    inputs.bonelossPercent !== null &&
    inputs.bonelossPercent !== undefined &&
    inputs.ageYears !== null &&
    inputs.ageYears !== undefined &&
    inputs.ageYears > 0
  ) {
    const ratio = inputs.bonelossPercent / inputs.ageYears;
    grade = ratio < 0.25 ? 'A' : ratio <= 1.0 ? 'B' : 'C';
  }

  // Modifiers raise the grade only (max with current).
  const cigs = inputs.cigarettesPerDay ?? 0;
  if (cigs >= 10) grade = maxGrade(grade, 'C');
  else if (cigs > 0) grade = maxGrade(grade, 'B');

  if (inputs.hasDiabetes) {
    const a1c = inputs.hba1cPercent;
    if (a1c !== null && a1c !== undefined && a1c >= 7.0) grade = maxGrade(grade, 'C');
    else grade = maxGrade(grade, 'B');
  }

  return grade;
}

function maxGrade(a: PerioGrade, b: PerioGrade): PerioGrade {
  return GRADE_ORDINAL[a] >= GRADE_ORDINAL[b] ? a : b;
}

export { maxGrade as _maxGrade };
export { ORDINAL_GRADE as _ORDINAL_GRADE };

// ─── Extent ─────────────────────────────────────────────────────────────────

export interface ExtentInputs {
  /** Teeth with periodontitis involvement (CAL/PD beyond health thresholds). */
  involvedTeeth: number;
  /** Total teeth examined (charted). */
  totalTeeth: number;
  /** Whether involvement follows a molar/incisor pattern. */
  molarIncisorPattern?: boolean;
}

/**
 * Extent descriptor: molar/incisor pattern takes precedence when flagged;
 * otherwise localized (<30% of teeth involved) vs generalized (≥30%).
 * Returns null when no teeth were examined.
 */
export function computeExtent(inputs: ExtentInputs): PerioExtent | null {
  if (inputs.totalTeeth <= 0) return null;
  if (inputs.molarIncisorPattern) return 'molar_incisor';
  const fraction = inputs.involvedTeeth / inputs.totalTeeth;
  return fraction >= 0.3 ? 'generalized' : 'localized';
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

export interface PerioClassification {
  stage: PerioStage | null;
  grade: PerioGrade;
  extent: PerioExtent | null;
}

export function classifyPerio(
  staging: StagingInputs,
  grading: GradingInputs,
  extent: ExtentInputs,
): PerioClassification {
  return {
    stage: computeStage(staging),
    grade: computeGrade(grading),
    extent: computeExtent(extent),
  };
}
