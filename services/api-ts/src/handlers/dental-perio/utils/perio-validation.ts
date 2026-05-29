/**
 * Periodontal validation helpers.
 *
 * BR-P03: depth fields must be 0-20mm (inclusive).
 * BR-P04: tooth number must be valid FDI — adult (11-18,21-28,31-38,41-48)
 *         or primary (51-55,61-65,71-75,81-85).
 *
 * Additional persisted-value bounds (V-PER-004 / V-PER-009):
 * - mobility, furcation: grade 0-3 (Miller mobility / Hamp furcation classes).
 * - recession: -5..20 mm. Negative values model coronal soft-tissue overgrowth
 *   (pseudo-pocket / gingival enlargement) measured above the CEJ; positive
 *   values are apical recession. The -5 lower bound is a clinical sanity floor —
 *   recession beyond a few mm coronal to the CEJ is not physiologically meaningful.
 */

import { BusinessLogicError } from '@/core/errors';

const ADULT_QUADRANTS: Array<[number, number]> = [[11, 18], [21, 28], [31, 38], [41, 48]];
const PRIMARY_QUADRANTS: Array<[number, number]> = [[51, 55], [61, 65], [71, 75], [81, 85]];

export function isValidFdiToothNumber(n: number): boolean {
  if (!Number.isInteger(n)) return false;
  for (const [lo, hi] of [...ADULT_QUADRANTS, ...PRIMARY_QUADRANTS]) {
    if (n >= lo && n <= hi) return true;
  }
  return false;
}

/**
 * BR-P07 dentition detection. Primary (deciduous) teeth occupy FDI quadrants
 * 5–8 (tooth numbers 51–85); adult teeth occupy quadrants 1–4 (11–48). There is
 * no dentition-type column on the chart, so dentition is inferred from the
 * tooth numbers actually charted.
 */
export function isPrimaryToothNumber(n: number): boolean {
  if (!Number.isInteger(n)) return false;
  for (const [lo, hi] of PRIMARY_QUADRANTS) {
    if (n >= lo && n <= hi) return true;
  }
  return false;
}

export function assertValidToothNumber(n: number): void {
  if (!isValidFdiToothNumber(n)) {
    throw new BusinessLogicError(`Invalid tooth number: ${n}`, 'INVALID_TOOTH_NUMBER');
  }
}

const DEPTH_FIELDS = ['depthBM', 'depthBC', 'depthBD', 'depthLM', 'depthLC', 'depthLD'] as const;

export function assertValidDepths(body: Record<string, unknown>): void {
  for (const f of DEPTH_FIELDS) {
    const v = body[f];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 20) {
      throw new BusinessLogicError(`Invalid depth value: ${f} must be an integer 0-20mm`, 'INVALID_DEPTH');
    }
  }
  const rec = body['recession'];
  if (rec !== undefined && rec !== null) {
    if (typeof rec !== 'number' || !Number.isInteger(rec) || rec < -5 || rec > 20) {
      throw new BusinessLogicError('Invalid depth value: recession must be an integer between -5 and 20mm', 'INVALID_DEPTH');
    }
  }
}

const GRADE_FIELDS = ['mobility', 'furcation'] as const;

/**
 * V-PER-004: mobility and furcation are clinical grades 0-3. Reject anything
 * outside that range (or non-integers) before persisting — previously any int
 * was accepted, so out-of-range grades silently persisted.
 */
export function assertValidGrades(body: Record<string, unknown>): void {
  for (const f of GRADE_FIELDS) {
    const v = body[f];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 3) {
      throw new BusinessLogicError(`Invalid grade value: ${f} must be an integer 0-3`, 'INVALID_GRADE');
    }
  }
}
