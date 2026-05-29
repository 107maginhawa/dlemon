/**
 * Periodontal validation helpers.
 *
 * BR-P03: depth fields must be 0-20mm (inclusive).
 * BR-P04: tooth number must be valid FDI — adult (11-18,21-28,31-38,41-48)
 *         or primary (51-55,61-65,71-75,81-85).
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
