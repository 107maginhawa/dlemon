/**
 * Perio charting shared types + pure helpers.
 *
 * The backend (services/api-ts/src/handlers/dental-perio) owns the data shape;
 * we mirror the generated SDK types (`PerioChart`, `PerioToothReading`) here and
 * add FE-only concerns the backend does not model:
 *   - the keyboard auto-advance sequence (a pure generator, test #1),
 *   - the BOP% → bucket label mapping (test #4),
 *   - the single-rooted furcation soft-gate (test #8),
 *   - the red-line depth threshold helper (test #3).
 *
 * All values here are clinical conventions, NOT recomputations of server data.
 * CAL in particular is read strictly from the API and never derived here.
 */

import type { PerioToothReading } from '@monobase/sdk-ts/generated';

// ---------------------------------------------------------------------------
// Sites — six points per tooth, three buccal then three lingual.
// Naming matches the backend reading fields: depthBM/BC/BD/LM/LC/LD, bop*, gm*, cal*.
// ---------------------------------------------------------------------------

export type PerioArchRow = 'B' | 'L'; // Buccal / Lingual
export type PerioSitePos = 'M' | 'C' | 'D'; // Mesial / Central / Distal
export type PerioSite = `${PerioArchRow}${PerioSitePos}`; // 'BM' | 'BC' | ... | 'LD'

/** The six probing sites in display order: buccal mesial→distal, then lingual. */
export const PERIO_SITES: readonly PerioSite[] = ['BM', 'BC', 'BD', 'LM', 'LC', 'LD'] as const;

export const PERIO_SITE_LABEL: Record<PerioSite, string> = {
  BM: 'mesiobuccal',
  BC: 'buccal',
  BD: 'distobuccal',
  LM: 'mesiolingual',
  LC: 'lingual',
  LD: 'distolingual',
};

/** Field-name builders so components never hand-concatenate `depth${site}` etc. */
export function depthField(site: PerioSite) {
  return `depth${site}` as const;
}
export function bopField(site: PerioSite) {
  return `bop${site}` as const;
}
export function gmField(site: PerioSite) {
  return `gm${site}` as const;
}
export function calField(site: PerioSite) {
  return `cal${site}` as const;
}

// ---------------------------------------------------------------------------
// Tooth sets — FDI numbering. Adult permanent dentition and primary dentition.
// ---------------------------------------------------------------------------

/**
 * Adult permanent teeth in maxillary-first, then mandibular order.
 * Maxillary right→left (18→11, 21→28), then mandibular left→right (38→31, 41→48),
 * which is the standard full-mouth probing path (Open Dental sequencing).
 */
export const ADULT_FDI_TEETH: readonly number[] = [
  // Maxillary: UR 18→11, UL 21→28
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
  // Mandibular: LL 38→31, LR 41→48
  38, 37, 36, 35, 34, 33, 32, 31, 41, 42, 43, 44, 45, 46, 47, 48,
] as const;

/** Primary dentition FDI (51–55, 61–65 maxillary; 71–75, 81–85 mandibular). */
export const PRIMARY_FDI_TEETH: readonly number[] = [
  55, 54, 53, 52, 51, 61, 62, 63, 64, 65,
  75, 74, 73, 72, 71, 81, 82, 83, 84, 85,
] as const;

export type Dentition = 'adult' | 'primary';

export function teethForDentition(dentition: Dentition): readonly number[] {
  return dentition === 'primary' ? PRIMARY_FDI_TEETH : ADULT_FDI_TEETH;
}

// ---------------------------------------------------------------------------
// Single-rooted soft-gate (furcation only applies to multi-rooted teeth).
// Furcation grading is meaningless on single-rooted teeth (incisors, canines,
// most premolars). The backend does NOT gate this, so the FE soft-gates.
// ---------------------------------------------------------------------------

/** True when the FDI tooth is single-rooted (furcation control disabled). */
export function isSingleRooted(fdiTooth: number): boolean {
  const positionInQuadrant = fdiTooth % 10; // 1=central incisor … 8=third molar
  // Incisors (1,2) + canines (3) are single-rooted.
  if (positionInQuadrant >= 1 && positionInQuadrant <= 3) return true;
  // Maxillary first premolar (x4) is commonly two-rooted; treat all other
  // premolars (x4 mandibular, x5) as single-rooted for the soft-gate.
  if (positionInQuadrant === 5) return true;
  if (positionInQuadrant === 4) {
    // Maxillary quadrants are 1 (UR) and 2 (UL).
    const quadrant = Math.floor(fdiTooth / 10);
    const isMaxillary = quadrant === 1 || quadrant === 2 || quadrant === 5 || quadrant === 6;
    return !isMaxillary; // mandibular x4 = single-rooted
  }
  // Molars (6,7,8) are multi-rooted.
  return false;
}

// ---------------------------------------------------------------------------
// BOP% bucketing (FE-only — backend returns the raw percentage).
// Healthy <10 / Localized 10–30 / Generalized >30 (perio-review §2).
// ---------------------------------------------------------------------------

export type BopBucket = 'healthy' | 'localized' | 'generalized';

export const BOP_BUCKET_LABEL: Record<BopBucket, string> = {
  healthy: 'Healthy',
  localized: 'Localized',
  generalized: 'Generalized',
};

/** Map a raw BOP percentage to a clinical bucket. Boundaries: <10, 10–30, >30. */
export function bopBucket(percent: number): BopBucket {
  if (percent < 10) return 'healthy';
  if (percent <= 30) return 'localized';
  return 'generalized';
}

// ---------------------------------------------------------------------------
// Red-line depth threshold (FE-only). Default 5mm matches the backend
// deep-pocket definition (depth ≥5mm).
// ---------------------------------------------------------------------------

export const DEFAULT_DEPTH_THRESHOLD = 5;

/** True when a probing depth is at/above the red-line threshold. */
export function isOverThreshold(depth: number | null | undefined, threshold: number): boolean {
  return typeof depth === 'number' && depth >= threshold;
}

/** Count probing-depth sites across all readings that are ≥ threshold. */
export function countOverThreshold(
  readings: readonly Pick<PerioToothReading, 'depthBM' | 'depthBC' | 'depthBD' | 'depthLM' | 'depthLC' | 'depthLD'>[],
  threshold: number,
): number {
  let count = 0;
  for (const r of readings) {
    for (const site of PERIO_SITES) {
      if (isOverThreshold(r[depthField(site)], threshold)) count += 1;
    }
  }
  return count;
}

/**
 * Deep-pocket clinical constant for the summary count. MUST stay in sync with
 * `DEEP_POCKET_THRESHOLD_MM` in services/api-ts/.../completePerioChart.ts. This is a
 * fixed clinical cutoff, distinct from the user-adjustable red-line threshold.
 */
export const DEEP_POCKET_THRESHOLD_MM = 5;

export interface PerioLiveSummary {
  bopPercent: number | null;
  meanDepth: number | null;
  deepPocketCount: number | null;
}

/**
 * Live draft preview of the perio summary, computed from the SAME readings and SAME
 * formula the backend applies at completion (completePerioChart.ts §"Summary
 * computation"), so the draft numbers equal the eventual finalized ones — no drift.
 * Returns nulls until there is data, so the summary bar shows "–" on an empty chart.
 */
export function computeLivePerioSummary(
  readings: readonly PerioToothReading[],
): PerioLiveSummary {
  let depthSum = 0;
  let depthCount = 0;
  let deepPocketCount = 0;
  let bopTrue = 0;
  let bopTotal = 0;
  for (const reading of readings) {
    for (const site of PERIO_SITES) {
      const depth = reading[depthField(site)];
      if (typeof depth === 'number') {
        depthSum += depth;
        depthCount += 1;
        if (depth >= DEEP_POCKET_THRESHOLD_MM) deepPocketCount += 1;
      }
      const bop = reading[bopField(site)];
      if (typeof bop === 'boolean') {
        bopTotal += 1;
        if (bop) bopTrue += 1;
      }
    }
  }
  return {
    bopPercent: bopTotal > 0 ? (bopTrue / bopTotal) * 100 : null,
    meanDepth: depthCount > 0 ? depthSum / depthCount : null,
    deepPocketCount: depthCount > 0 ? deepPocketCount : null,
  };
}

// ---------------------------------------------------------------------------
// Auto-advance entry sequence (the core UX bet — test #1).
// A flat, ordered list of {tooth, site} steps: for each tooth in the dentition
// order, walk its six sites (buccal pass, then lingual pass). The generator is
// pure so it can be exhaustively tested in isolation.
// ---------------------------------------------------------------------------

export interface PerioSequenceStep {
  tooth: number;
  site: PerioSite;
}

export function buildPerioSequence(dentition: Dentition = 'adult'): PerioSequenceStep[] {
  const teeth = teethForDentition(dentition);
  const steps: PerioSequenceStep[] = [];
  for (const tooth of teeth) {
    for (const site of PERIO_SITES) {
      steps.push({ tooth, site });
    }
  }
  return steps;
}

/**
 * Index of the next step after the given (tooth, site), or null if it is the
 * last step. Used by depth/Tab to auto-advance focus.
 */
export function nextStepIndex(
  steps: readonly PerioSequenceStep[],
  current: { tooth: number; site: PerioSite },
): number | null {
  const idx = steps.findIndex((s) => s.tooth === current.tooth && s.site === current.site);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return idx + 1;
}

/** Index of the previous step (Shift+Tab back-navigation), or null at the start. */
export function prevStepIndex(
  steps: readonly PerioSequenceStep[],
  current: { tooth: number; site: PerioSite },
): number | null {
  const idx = steps.findIndex((s) => s.tooth === current.tooth && s.site === current.site);
  if (idx <= 0) return null;
  return idx - 1;
}

/** First step of the tooth that follows `tooth` in sequence (Enter = next tooth). */
export function nextToothFirstStepIndex(
  steps: readonly PerioSequenceStep[],
  tooth: number,
): number | null {
  const lastSiteOfTooth = PERIO_SITES[PERIO_SITES.length - 1];
  const idx = steps.findIndex((s) => s.tooth === tooth && s.site === lastSiteOfTooth);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return idx + 1;
}

// ---------------------------------------------------------------------------
// Depth clamping (entry validation mirrors backend 0–20mm, BR-P03).
// ---------------------------------------------------------------------------

export const DEPTH_MIN = 0;
export const DEPTH_MAX = 20;

/** Clamp a raw numeric depth into the valid 0–20mm range. */
export function clampDepth(value: number): number {
  if (Number.isNaN(value)) return DEPTH_MIN;
  return Math.min(DEPTH_MAX, Math.max(DEPTH_MIN, Math.round(value)));
}
