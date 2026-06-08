/**
 * perio-classify-chart.ts — derive 2017 AAP/EFP staging/grading inputs from a
 * chart's tooth readings, then classify (P1-6).
 *
 * Bridges the persisted reading rows to the pure classification engine in
 * perio-staging.ts. The chart captures the periodontal measurements (CAL via
 * perio-cal.ts, probing depth, furcation, mobility); the grading risk factors
 * (smoking, HbA1c) and tooth-loss/bite-collapse context are NOT captured on the
 * chart and are passed in as optional inputs (sourced from medical history at
 * the call site). Sensible clinical defaults apply when absent: non-smoker,
 * non-diabetic, zero tooth loss.
 *
 * Tooth "involvement" (for the extent descriptor) is defined as a worst-site
 * CAL ≥ 1mm OR any probing depth ≥ 4mm — i.e. detectable attachment loss or a
 * pathologic pocket at that tooth.
 */

import { maxReadingCal, computeReadingCal } from './perio-cal';
import {
  classifyPerio,
  type PerioClassification,
  type StagingInputs,
  type GradingInputs,
  type ExtentInputs,
} from './perio-staging';

/** Subset of a reading row needed for classification. */
export interface ClassifiableReading {
  toothNumber: number;
  depthBM?: number | null;
  depthBC?: number | null;
  depthBD?: number | null;
  depthLM?: number | null;
  depthLC?: number | null;
  depthLD?: number | null;
  gmBM?: number | null;
  gmBC?: number | null;
  gmBD?: number | null;
  gmLM?: number | null;
  gmLC?: number | null;
  gmLD?: number | null;
  furcation?: number | null;
  mobility?: number | null;
}

/** Risk factors + context that the chart does not capture (from medical history). */
export interface PerioRiskFactors {
  toothLossCount?: number;
  remainingTeeth?: number;
  biteCollapse?: boolean;
  bonelossPercent?: number | null;
  ageYears?: number | null;
  fiveYearProgressionMm?: number | null;
  cigarettesPerDay?: number | null;
  hasDiabetes?: boolean;
  hba1cPercent?: number | null;
  molarIncisorPattern?: boolean;
}

const DEPTH_FIELDS = ['depthBM', 'depthBC', 'depthBD', 'depthLM', 'depthLC', 'depthLD'] as const;
const TOOTH_INVOLVEMENT_CAL_MM = 1;
const TOOTH_INVOLVEMENT_PD_MM = 4;

function maxDepth(r: ClassifiableReading): number | null {
  let max: number | null = null;
  for (const f of DEPTH_FIELDS) {
    const v = r[f];
    if (typeof v === 'number' && (max === null || v > max)) max = v;
  }
  return max;
}

function toothInvolved(r: ClassifiableReading): boolean {
  const cal = maxReadingCal(r);
  if (cal !== null && cal >= TOOTH_INVOLVEMENT_CAL_MM) return true;
  const pd = maxDepth(r);
  return pd !== null && pd >= TOOTH_INVOLVEMENT_PD_MM;
}

/**
 * Derive staging/grading/extent from a chart's readings + optional risk factors,
 * then classify.
 *
 * IDEAL-§343 / audit §8.B: `remainingTeeth` is NOT defaulted to the charted-tooth
 * count. The number of teeth *charted* on a (possibly partial) perio exam is not
 * the number of teeth *remaining* in the mouth — a 15-tooth partial chart of a
 * fully-dentate patient must not be read as "<20 teeth remaining". Defaulting to
 * the reading count let that absence-of-evidence trip the Stage-IV `<20 teeth`
 * complexity factor and over-stage an advanced-but-localized case to IV. When
 * `remainingTeeth` is omitted the factor simply does not apply (the clinician can
 * still supply it explicitly from the medical history when the dentition is in
 * fact reduced). Over-staging drives over-treatment, so absence is conservative.
 */
export function classifyChart(
  readings: ClassifiableReading[],
  risk: PerioRiskFactors = {},
): PerioClassification {
  let worstInterdentalCal: number | null = null;
  let maxPd: number | null = null;
  let maxFurcation = 0;
  let maxMobility = 0;
  let involvedTeeth = 0;

  for (const r of readings) {
    // Interdental sites are the mesial/distal sites (BM/BD/LM/LD); the worst-site
    // interdental CAL is the 2017 staging primary determinant. Mid-buccal/lingual
    // (BC/LC) recession is excluded to avoid non-interdental CAL inflating the stage.
    const cal = computeReadingCal(r);
    for (const v of [cal.calBM, cal.calBD, cal.calLM, cal.calLD]) {
      if (v !== null && (worstInterdentalCal === null || v > worstInterdentalCal)) {
        worstInterdentalCal = v;
      }
    }
    const pd = maxDepth(r);
    if (pd !== null && (maxPd === null || pd > maxPd)) maxPd = pd;
    if (typeof r.furcation === 'number' && r.furcation > maxFurcation) maxFurcation = r.furcation;
    if (typeof r.mobility === 'number' && r.mobility > maxMobility) maxMobility = r.mobility;
    if (toothInvolved(r)) involvedTeeth += 1;
  }

  const staging: StagingInputs = {
    worstInterdentalCalMm: worstInterdentalCal,
    maxProbingDepthMm: maxPd,
    toothLossCount: risk.toothLossCount,
    maxFurcationGrade: maxFurcation,
    maxMobilityGrade: maxMobility,
    // IDEAL-§343: pass through only when explicitly supplied — never infer
    // "<20 teeth remaining" from the count of teeth charted on a partial exam.
    remainingTeeth: risk.remainingTeeth,
    biteCollapse: risk.biteCollapse,
  };

  const grading: GradingInputs = {
    bonelossPercent: risk.bonelossPercent,
    ageYears: risk.ageYears,
    fiveYearProgressionMm: risk.fiveYearProgressionMm,
    cigarettesPerDay: risk.cigarettesPerDay,
    hasDiabetes: risk.hasDiabetes,
    hba1cPercent: risk.hba1cPercent,
  };

  const extent: ExtentInputs = {
    involvedTeeth,
    totalTeeth: readings.length,
    molarIncisorPattern: risk.molarIncisorPattern,
  };

  return classifyPerio(staging, grading, extent);
}
