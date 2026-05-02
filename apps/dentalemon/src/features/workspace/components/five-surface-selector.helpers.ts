/**
 * FiveSurfaceSelector — helper utilities
 *
 * Determines which 5 surfaces apply to a given tooth (anterior vs posterior).
 * Anterior teeth (canines, incisors) have "incisal" instead of "occlusal".
 */

export type ToothSurface = 'mesial' | 'distal' | 'buccal' | 'lingual' | 'occlusal' | 'incisal' | 'cervical';

/**
 * FDI anterior teeth: 1-digit suffix 1, 2, 3 in any quadrant
 * Quadrants 1-4, teeth 1,2,3 = incisors and canines
 */
export function isAnteriorTooth(toothNumber: number | null | undefined): boolean {
  if (!toothNumber) return false;
  const suffix = toothNumber % 10;
  return suffix >= 1 && suffix <= 3;
}

/**
 * Returns the 5 applicable surfaces for the given tooth.
 * Anterior: mesial, distal, buccal, lingual, incisal
 * Posterior: mesial, distal, buccal, lingual, occlusal
 */
export function getSurfacesForTooth(toothNumber: number): ToothSurface[] {
  const fifthSurface: ToothSurface = isAnteriorTooth(toothNumber) ? 'incisal' : 'occlusal';
  return ['mesial', 'distal', 'buccal', 'lingual', fifthSurface];
}
