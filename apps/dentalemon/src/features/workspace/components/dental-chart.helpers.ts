/**
 * DentalChart — helper utilities
 *
 * Pure logic extracted for unit testing.
 * The React component (dental-chart.tsx) renders the SVG.
 */

export type ToothState = 'healthy' | 'caries' | 'fractured' | 'filled' | 'crown' | 'missing' | 'implant' | 'extracted' | 'watchlist';

export interface ToothData {
  toothNumber: number;
  state: ToothState | string;
  surfaces?: string[];
  conditionCode?: string;
  note?: string;
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
 * Build a Map<toothNumber, state> from an array of tooth chart states.
 */
export function buildToothMap(teeth: Array<{ toothNumber: number; state: string }>): Map<number, string> {
  const map = new Map<number, string>();
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
export function getToothColorClass(state: ToothState | string): string {
  switch (state) {
    case 'healthy':   return 'tooth-healthy text-green-600 fill-green-100';
    case 'caries':    return 'tooth-caries text-red-600 fill-red-200';
    case 'fractured': return 'tooth-fractured text-orange-600 fill-orange-200';
    case 'filled':    return 'tooth-filled fill-teal-300 text-teal-800';
    case 'crown':     return 'tooth-crown fill-[#FFE97D] text-[#4A4018]';
    case 'missing':   return 'tooth-missing fill-gray-100 stroke-gray-400 stroke-dashed';
    case 'implant':   return 'tooth-implant fill-blue-200 text-blue-800';
    case 'extracted': return 'tooth-extracted fill-gray-300 text-gray-600';
    case 'watchlist': return 'tooth-watchlist fill-yellow-100 text-yellow-700';
    default:          return 'tooth-unknown fill-white text-gray-400';
  }
}
