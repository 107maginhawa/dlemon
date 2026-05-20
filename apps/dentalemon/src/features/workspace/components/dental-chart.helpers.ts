/**
 * DentalChart — helper utilities
 *
 * Pure logic extracted for unit testing.
 * The React component (dental-chart.tsx) renders the SVG.
 */

import type { ToothSurface } from '@/features/workspace/components/five-surface-selector.helpers';

export type ToothState = 'healthy' | 'caries' | 'fractured' | 'filled' | 'crown' | 'missing' | 'implant' | 'extracted' | 'watchlist';

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
