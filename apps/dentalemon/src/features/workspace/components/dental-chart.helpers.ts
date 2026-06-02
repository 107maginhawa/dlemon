/**
 * DentalChart — helper utilities
 *
 * Pure logic extracted for unit testing.
 * The React component (dental-chart.tsx) renders the SVG.
 */

import type { ToothSurface } from '@/features/workspace/components/five-surface-selector.helpers';
import type { ToothState } from '@/lib/dental-chart-types';

// ToothState now lives in the neutral lib layer (shared with the patients
// feature). Re-exported here so existing workspace consumers keep their import.
export type { ToothState };
export type DentitionType = 'permanent' | 'primary';

/**
 * Returns 'primary' if the patient is younger than 12 years old based on their
 * date of birth, otherwise 'permanent'. Returns 'permanent' when DOB is null.
 */
export function getDentitionType(dateOfBirth: string | null): DentitionType {
  if (!dateOfBirth) return 'permanent';
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age < 12 ? 'primary' : 'permanent';
}

export type ChartEntryClassification = 'existing' | 'existing_other' | 'treatment_plan' | 'condition';

export interface ToothData {
  toothNumber: number;
  state: ToothState;
  surfaces?: ToothSurface[];
  conditionCode?: string;
  note?: string;
  surfaceConditionMap?: Record<string, ToothState>;
  entryClassification?: ChartEntryClassification;
}

/**
 * Chart layers for baseline/proposed/completed separation (CR-03, CHART-BR-001/002/006).
 */
export type ChartLayer = 'baseline' | 'proposed' | 'completed';

/**
 * Map a tooth's entryClassification to its chart layer.
 * - existing / existing_other → baseline (pre-existing conditions)
 * - treatment_plan / condition → proposed (planned/diagnosed work)
 * - undefined (legacy/unclassified) → baseline
 *
 * NOTE: 'completed' is NOT derived from entryClassification — completion lives on
 * the treatment record (status 'performed'), so the chart determines it at render
 * time from its `completedToothNumbers` prop, not from this function.
 */
export function getToothLayer(
  entryClassification?: ChartEntryClassification,
): Exclude<ChartLayer, 'completed'> {
  switch (entryClassification) {
    case 'treatment_plan':
    case 'condition':
      return 'proposed';
    case 'existing':
    case 'existing_other':
    default:
      return 'baseline';
  }
}

/**
 * FDI tooth numbering — all 32 permanent teeth:
 * Upper right: 18–11, Upper left: 21–28
 * Lower left: 31–38, Lower right: 41–48
 */
export const TOOTH_NUMBERS: number[] = [
  // Upper right (from midline out)
  11, 12, 13, 14, 15, 16, 17, 18,
  // Upper left (from midline out)
  21, 22, 23, 24, 25, 26, 27, 28,
  // Lower left (from midline out)
  31, 32, 33, 34, 35, 36, 37, 38,
  // Lower right (from midline out)
  41, 42, 43, 44, 45, 46, 47, 48,
];

/**
 * FDI primary (deciduous/pediatric) tooth numbering — 20 teeth:
 * Upper right: 51–55, Upper left: 61–65
 * Lower left: 71–75, Lower right: 81–85
 */
export const PEDIATRIC_TOOTH_NUMBERS: number[] = [
  51, 52, 53, 54, 55,
  61, 62, 63, 64, 65,
  71, 72, 73, 74, 75,
  81, 82, 83, 84, 85,
];

/**
 * Returns true if n is a valid FDI permanent tooth number (11–18, 21–28, 31–38, 41–48).
 */
export function isValidFdiNumber(n: number): boolean {
  return TOOTH_NUMBERS.includes(n);
}

/**
 * Returns true if n is a valid Universal tooth number (1–32).
 */
export function isValidUniversalNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 32;
}

/**
 * Build a Map<toothNumber, state> from an array of tooth chart states.
 */
export function buildToothMap(teeth: Array<{ toothNumber: number; state: ToothState }>): Map<number, ToothState> {
  const map = new Map<number, ToothState>();
  for (const tooth of teeth) {
    map.set(tooth.toothNumber, tooth.state);
  }
  return map;
}

/**
 * Map tooth state to Tailwind CSS color class.
 *
 * healthy → green
 * caries → red
 * fractured → orange
 * filled → teal (tooth-filled)
 * crown → lemon/yellow (tooth-crown)
 * missing → gray-dashed (tooth-missing)
 * implant → blue
 * extracted → tooth-extracted
 * watchlist → yellow
 */
// ─── FDI ↔ Universal (American) numbering adapters ─────────────────────────
//
// FDI (international, used by backend + this app):
//   Upper right: 11–18  Upper left: 21–28
//   Lower left:  31–38  Lower right: 41–48
//
// Universal (American, 1–32, used by some reference libraries):
//   Upper right: 1–8    Upper left: 9–16
//   Lower left:  17–24  Lower right: 25–32

const FDI_TO_UNIVERSAL: Record<number, number> = {
  // Upper right (FDI 11=UR central=U8, FDI 18=UR wisdom=U1)
  11: 8, 12: 7, 13: 6, 14: 5, 15: 4, 16: 3, 17: 2, 18: 1,
  // Upper left (FDI 21=UL central=U9, FDI 28=UL wisdom=U16)
  21: 9, 22: 10, 23: 11, 24: 12, 25: 13, 26: 14, 27: 15, 28: 16,
  // Lower left (FDI 31=LL central=U24, FDI 38=LL wisdom=U17)
  31: 24, 32: 23, 33: 22, 34: 21, 35: 20, 36: 19, 37: 18, 38: 17,
  // Lower right (FDI 41=LR central=U25, FDI 48=LR wisdom=U32)
  41: 25, 42: 26, 43: 27, 44: 28, 45: 29, 46: 30, 47: 31, 48: 32,
};

const UNIVERSAL_TO_FDI: Record<number, number> = Object.fromEntries(
  Object.entries(FDI_TO_UNIVERSAL).map(([fdi, uni]) => [uni, Number(fdi)]),
);

/**
 * Convert an FDI tooth number (11–48) to the Universal (American) number (1–32).
 * Returns NaN for invalid input.
 */
export function fdiToUniversal(fdiNumber: number): number {
  return FDI_TO_UNIVERSAL[fdiNumber] ?? NaN;
}

/**
 * Convert a Universal (American) tooth number (1–32) to FDI (11–48).
 * Returns NaN for invalid input.
 */
export function universalToFdi(universalNumber: number): number {
  return UNIVERSAL_TO_FDI[universalNumber] ?? NaN;
}

/**
 * Primary (deciduous) FDI → Universal (1–20) mapping.
 * Upper right: 55→1 … 51→5 | Upper left: 61→6 … 65→10
 * Lower left: 71→11 … 75→15 | Lower right: 85→16 … 81→20
 */
const PRIMARY_FDI_TO_UNIVERSAL: Record<number, number> = {
  55: 1, 54: 2, 53: 3, 52: 4, 51: 5,
  61: 6, 62: 7, 63: 8, 64: 9, 65: 10,
  71: 11, 72: 12, 73: 13, 74: 14, 75: 15,
  85: 16, 84: 17, 83: 18, 82: 19, 81: 20,
};

/**
 * Convert a primary (deciduous) FDI tooth number (51–85) to Universal 1–20.
 * Returns NaN for non-primary FDI input.
 */
export function fdiPrimaryToUniversal(fdiNumber: number): number {
  return PRIMARY_FDI_TO_UNIVERSAL[fdiNumber] ?? NaN;
}

// ─── Color class map ────────────────────────────────────────────────────────

export function getToothColorClass(state: ToothState): string {
  switch (state) {
    case 'healthy':   return 'tooth-healthy text-green-700 bg-green-50';
    case 'caries':    return 'tooth-caries text-[#FF3B30] bg-red-50';
    case 'fractured': return 'tooth-fractured text-[#FF9500] bg-orange-50';
    case 'filled':    return 'tooth-filled text-[#5AC8FA] bg-cyan-50';
    case 'crown':     return 'tooth-crown text-[#B8960A] bg-yellow-50';
    case 'missing':   return 'tooth-missing text-[#C7C7CC] bg-gray-50';
    case 'implant':   return 'tooth-implant text-[#007AFF] bg-blue-50';
    case 'extracted': return 'tooth-extracted text-gray-600 bg-gray-100';
    case 'watchlist': return 'tooth-watchlist text-yellow-700 bg-yellow-50';
    default:          return 'tooth-unknown text-gray-400 bg-white';
  }
}

/**
 * Map tooth state to a hex fill color for use with UniversalTooth's fillColor prop.
 * These match the visual intent of getToothColorClass but as hex strings.
 */
// ─── FDI tooth naming ────────────────────────────────────────────────────────

const QUADRANT_LABELS: Record<number, string> = {
  1: 'Upper Right',
  2: 'Upper Left',
  3: 'Lower Left',
  4: 'Lower Right',
};

const POSITION_NAMES = [
  'Central Incisor',
  'Lateral Incisor',
  'Canine',
  'First Premolar',
  'Second Premolar',
  'First Molar',
  'Second Molar',
  'Third Molar',
];

/**
 * Convert an FDI tooth number to a human-readable name and anterior/posterior type.
 * Quadrant: tens digit (1=Upper Right, 2=Upper Left, 3=Lower Left, 4=Lower Right)
 * Position: units digit (1=Central Incisor … 8=Third Molar)
 * Anterior = positions 1–3, Posterior = positions 4–8.
 */
export function getToothInfo(fdi: number): { name: string; type: 'anterior' | 'posterior' } {
  const quadrant = Math.floor(fdi / 10);
  const position = fdi % 10;
  const quadrantLabel = QUADRANT_LABELS[quadrant];
  const positionName = POSITION_NAMES[position - 1];

  if (!quadrantLabel || !positionName) {
    return { name: `Tooth ${fdi}`, type: 'posterior' };
  }

  return {
    name: `${quadrantLabel} ${positionName}`,
    type: position <= 3 ? 'anterior' : 'posterior',
  };
}

export function getToothFillColor(state: ToothState): string {
  const colors: Record<ToothState, string> = {
    healthy:   '', // empty — no fill applied, preserves SVG strokes
    caries:    '#FF3B30', // Apple systemRed — matches --dental-caries
    fractured: '#FF9500', // Apple systemOrange — matches --dental-fractured
    filled:    '#5AC8FA', // Apple systemTeal — matches --dental-filled
    crown:     '#FFD60A', // Apple systemYellow (≠ primary #FFE97D, avoids collision)
    missing:   '#C7C7CC', // Apple systemGray4 — matches --dental-missing
    implant:   '#007AFF', // Apple systemBlue
    extracted: '#757575', // spec §4.2 dark grey (was #111111 — near-black, invisible in dark mode)
    watchlist: '#fef9c3', // light yellow
  };
  return colors[state] ?? '#ffffff';
}

// ─── Tooth notation display (QW-5) ───────────────────────────────────────────
//
// The canonical key for every tooth is its FDI number (11–48 permanent,
// 51–85 primary). Only the *displayed label* changes per notation preference.
// Tooth identity (clicks, data, API) always uses the FDI number.
//
// Supported notations:
//   FDI      — ISO 3950 (international standard, used by backend)
//   Universal — American numbering (1–32 adult, 1–20 primary)
//   Palmer    — Quadrant symbol + position digit, e.g. "1|" = UR central
//
// Palmer encoding (text-safe approximation):
//   Upper right (Q1): position|   e.g. "1|", "8|"
//   Upper left  (Q2): |position   e.g. "|1", "|8"
//   Lower left  (Q3): |position   e.g. "|1", "|8"  (lower quadrant implicit from row)
//   Lower right (Q4): position|   e.g. "1|", "8|"
//
// In the original Palmer system the quadrant is conveyed by a bracket/grid,
// not the digit alone. Our text-safe labels mirror that: UR/LR use "n|"
// (digit left of bar) and UL/LL use "|n" (digit right of bar). The chart
// renders upper/lower teeth in separate rows, so row position disambiguates
// upper vs lower — exactly as a paper Palmer chart does.

export type ToothNotation = 'FDI' | 'Universal' | 'Palmer';

/**
 * Convert an FDI tooth number to a Palmer text-safe label.
 *
 * Upper right (Q1) and Lower right (Q4): "position|"  e.g. FDI 11 → "1|"
 * Upper left  (Q2) and Lower left  (Q3): "|position"  e.g. FDI 21 → "|1"
 *
 * Returns '' for invalid FDI numbers.
 */
export function fdiToPalmer(fdiNumber: number): string {
  const quadrant = Math.floor(fdiNumber / 10);
  const position = fdiNumber % 10;
  if (position < 1 || position > 8) return '';
  switch (quadrant) {
    case 1: // Upper right
    case 4: // Lower right
      return `${position}|`;
    case 2: // Upper left
    case 3: // Lower left
      return `|${position}`;
    default:
      return '';
  }
}

/**
 * Return the display label for a tooth given a notation preference.
 *
 * - FDI:       returns the FDI number as a string (unchanged)
 * - Universal: converts via fdiToUniversal / fdiPrimaryToUniversal
 * - Palmer:    converts via fdiToPalmer; falls back to FDI string if conversion fails
 * - unknown:   falls back to FDI string
 *
 * Tooth identity (clicks, API calls) must always use the original FDI number —
 * this function only affects what is *displayed* to the user.
 */
export function getToothDisplayLabel(fdiNumber: number, notation: ToothNotation | string): string {
  switch (notation) {
    case 'Universal': {
      const isPrimary = fdiNumber >= 51 && fdiNumber <= 85;
      const uni = isPrimary ? fdiPrimaryToUniversal(fdiNumber) : fdiToUniversal(fdiNumber);
      return isNaN(uni) ? String(fdiNumber) : String(uni);
    }
    case 'Palmer': {
      const palmer = fdiToPalmer(fdiNumber);
      return palmer || String(fdiNumber);
    }
    case 'FDI':
    default:
      return String(fdiNumber);
  }
}
