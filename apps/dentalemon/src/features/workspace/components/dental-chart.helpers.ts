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

/**
 * Dentition types:
 *  - 'permanent' — adult 32-tooth arch (age 12+)
 *  - 'primary'   — pediatric 20-tooth deciduous arch (age 0–5)
 *  - 'mixed'     — transitional arch (ages 6–11): deciduous + erupted permanent
 */
export type DentitionType = 'permanent' | 'primary' | 'mixed';

/**
 * Returns the dentition type based on age:
 *  - < 6  → 'primary'   (pure deciduous)
 *  - 6–11 → 'mixed'     (transitional — deciduous + erupted permanents)
 *  - ≥ 12 → 'permanent' (full adult arch)
 *  - null DOB → 'permanent' (safe default)
 */
export function getDentitionType(dateOfBirth: string | null): DentitionType {
  if (!dateOfBirth) return 'permanent';
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  if (age >= 12) return 'permanent';
  if (age >= 6)  return 'mixed';
  return 'primary';
}

/**
 * Mixed dentition tooth set (P1-17).
 *
 * Clinically, during mixed dentition (ages ~6–12) children have both remaining
 * primary (deciduous) teeth AND erupted permanent teeth. The typical eruption
 * sequence places the following permanent teeth first:
 *   - First molars (16, 26, 36, 46) — "6-year molars", erupt ~age 6
 *   - Central incisors (11, 21, 31, 41) — erupt ~age 6–7
 *   - Lateral incisors (12, 22, 32, 42) — erupt ~age 7–8
 *
 * Remaining primary teeth fill the rest of the arch:
 *   - Canines (53, 63, 73, 83), first molars (54, 64, 74, 84),
 *     second molars (55, 65, 75, 85)
 *
 * This set represents the canonical mid-mixed-dentition (age ~8) snapshot.
 * The frontend renders permanent teeth in their standard positions and primary
 * teeth interleaved (canine + molar regions), making the dual-arch legible.
 *
 * Returns: sorted array of FDI tooth numbers (primary + permanent mixed set).
 */
export function getMixedDentitionTeeth(): number[] {
  // Erupted permanent teeth (first wave: molars + incisors)
  const permanentErupted = [
    // Central incisors
    11, 21, 31, 41,
    // Lateral incisors
    12, 22, 32, 42,
    // First molars ("6-year molars")
    16, 26, 36, 46,
  ];

  // Remaining primary teeth (canines + primary molars) — NOT yet replaced
  const primaryRemaining = [
    // Upper right: canine, first molar, second molar
    53, 54, 55,
    // Upper left: canine, first molar, second molar
    63, 64, 65,
    // Lower left: canine, first molar, second molar
    73, 74, 75,
    // Lower right: canine, first molar, second molar
    83, 84, 85,
  ];

  return [...permanentErupted, ...primaryRemaining].sort((a, b) => a - b);
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
 * Chart layers for baseline/proposed/completed/declined separation
 * (CR-03, CHART-BR-001/002/006, CHART-XV).
 * - declined: a recommended treatment the patient refused — rendered as a
 *   desaturated gray hatch (a stroke/pattern, not a 4th saturated fill).
 */
export type ChartLayer = 'baseline' | 'proposed' | 'completed' | 'declined';

/**
 * Default set of visible layers (P1-15): all layers shown simultaneously.
 * This is the sensible starting state — clinicians see existing + planned +
 * completed + declined. The Declined toggle chip is only surfaced when declined
 * teeth actually exist, but declined teeth are visible by default when present.
 */
export const DEFAULT_VISIBLE_LAYERS: ReadonlySet<ChartLayer> = new Set<ChartLayer>([
  'baseline',
  'proposed',
  'completed',
  'declined',
]);

/**
 * Returns true if a tooth on `toothLayer` should be visible given the current
 * set of active (visible) layers. Used by DentalChart for multi-select layer
 * visibility (P1-15: combinable layers — replaces the single activeLayer model).
 *
 * A tooth is visible when its layer is in the visibleLayers set.
 * An empty visibleLayers set hides all teeth.
 */
export function isToothVisible(toothLayer: ChartLayer, visibleLayers: ReadonlySet<ChartLayer>): boolean {
  return visibleLayers.has(toothLayer);
}

/**
 * Map a tooth's entryClassification to its chart-NATIVE layer (the fallback when
 * no cumulative treatment record drives the tooth).
 * - condition → proposed (a finding charted without a treatment record yet)
 * - existing / existing_other / treatment_plan / undefined → baseline
 *
 * CHART-XV: `treatment_plan` is intentionally NOT proposed here. Whether a tooth
 * is proposed/completed lives on the cumulative treatment record (status), which
 * the chart resolves at render time from its proposed/completed tooth-number
 * props. Deriving "proposed" from the frozen chart classification resurrected
 * stale red after a treatment was dismissed (two sources of truth disagreeing).
 * Only `condition` remains chart-native, since a finding can legitimately exist
 * before any treatment is recorded.
 *
 * NOTE: 'completed' and 'declined' are never derived from entryClassification —
 * they come from treatment status via the chart's tooth-number props.
 */
export function getToothLayer(
  entryClassification?: ChartEntryClassification,
): Exclude<ChartLayer, 'completed' | 'declined'> {
  switch (entryClassification) {
    case 'condition':
      return 'proposed';
    case 'existing':
    case 'existing_other':
    case 'treatment_plan':
    default:
      return 'baseline';
  }
}

/**
 * The six treatment lifecycle statuses (matches the backend DentalTreatmentStatus).
 * `diagnosed`/`planned` = pending; `performed`/`verified` = done; `declined` =
 * patient refused; `dismissed` = struck from the plan (no longer on the chart).
 */
export type TreatmentLayerStatus =
  | 'diagnosed'
  | 'planned'
  | 'performed'
  | 'verified'
  | 'declined'
  | 'dismissed';

/**
 * P0-2 — SINGLE SOURCE OF TRUTH for the status→layer fold.
 *
 * The chart fill/edge AND the treatment list's group/badge derive from THIS one
 * projection, so the two can differ in resolution (the list shows the raw 6
 * statuses; the chart shows 4 layers) but can never contradict. Invariant: if the
 * list shows a tooth has a Planned item, the chart paints that tooth Planned.
 *
 * Panel-locked fold:
 *   diagnosed | planned   → 'proposed'   (pending — Planned)
 *   performed | verified  → 'completed'  (done by us — billable/warranted)
 *   declined              → 'declined'   (patient refused)
 *   dismissed             → null         (off-chart; struck from the plan)
 *
 * A tooth with NO treatment record is 'baseline' (Existing) — handled by the
 * absence of any status, not here. `deriveChartLayerSets` and the table list both
 * consume this fold.
 */
export function statusToLayer(status: TreatmentLayerStatus): ChartLayer | null {
  switch (status) {
    case 'performed':
    case 'verified':
      return 'completed';
    case 'diagnosed':
    case 'planned':
      return 'proposed';
    case 'declined':
      return 'declined';
    case 'dismissed':
      return null;
    default:
      return null;
  }
}

/**
 * Resolve a tooth's effective chart layer from CUMULATIVE treatment status
 * (cross-visit sets fed by the patient treatment-plan aggregate), falling back to
 * the tooth's chart-native classification when no treatment record drives it.
 *
 * Precedence (item 6 flip): proposed > completed > declined > entryClassification.
 * Outstanding planned/diagnosed work wins so a tooth with NEW pending work is shown
 * Planned even when it also carries a performed treatment — clinical safety: the
 * dentist must never see a green Treated ring hiding work still to be done. A fresh
 * proposal also supersedes a prior declination.
 */
/**
 * Terminal tooth states (missing/extracted) have no actionable lifecycle — mirrors
 * the BE resolveTerminalTeeth. A gone tooth is painted by its fill, never by a
 * Planned/Treated/Declined edge.
 */
const TERMINAL_TOOTH_STATES: ReadonlySet<ToothState> = new Set<ToothState>(['missing', 'extracted']);

export function resolveToothLayer(
  toothNumber: number,
  entryClassification: ChartEntryClassification | undefined,
  sets?: { completed?: ReadonlySet<number>; proposed?: ReadonlySet<number>; declined?: ReadonlySet<number> },
  state?: ToothState,
): ChartLayer {
  // Terminal precedence (LOCKED, mirror BE): missing/extracted outrank every
  // actionable layer. The fill owns a gone tooth → 'baseline' (no edge ring).
  if (state && TERMINAL_TOOTH_STATES.has(state)) return 'baseline';
  if (sets?.proposed?.has(toothNumber)) return 'proposed';
  if (sets?.completed?.has(toothNumber)) return 'completed';
  if (sets?.declined?.has(toothNumber)) return 'declined';
  return getToothLayer(entryClassification);
}

/**
 * P1-2 — the user-facing label for a chart layer (the demoted, renamed filter
 * tabs). "Existing"/"Planned" replace the internal "Baseline"/"Proposed" to end
 * the time/status double-encoding; "Treated" (item 2 — was "Completed") names the
 * performed-work layer without colliding with the visit/card "Completed" status
 * shown on the same screen; "Declined" stays. The ChartLayer KEY stays 'completed'
 * — only the displayed label changed.
 */
const LAYER_LABELS: Record<ChartLayer, string> = {
  baseline: 'Existing',
  proposed: 'Planned',
  completed: 'Treated',
  declined: 'Declined',
};
export function getLayerLabel(layer: ChartLayer): string {
  return LAYER_LABELS[layer];
}

/**
 * P1-1 — colour de-overload. The layer is encoded on the tooth EDGE
 * (solid / dashed / none) in a NEUTRAL colour, so the fill stays the sole owner of
 * clinical-state hue and lemon (`--primary`) is reserved for interaction
 * (selection ring, active filter, CTA). Returns a CSS `outline` shorthand, or
 * undefined when the fill alone carries the tooth (completed / baseline / existing).
 *
 *   proposed (this visit) → neutral dotted  (intended work, no competing hue)
 *   proposed (carried)    → amber dotted     (the one hue exception — aging pending)
 *   completed             → green solid       (realized-work cue; "done = green")
 *   declined              → gray solid        (pairs with the diagonal hatch texture)
 *   baseline              → undefined         (fill owns it; existing dentition)
 *
 * Why completed gets its OWN edge (not "fill owns it"): the standard odontogram
 * cue for done work is colour (paper convention: red = to-do, blue = done), but
 * this chart's FILL already encodes clinical state (caries-red, filled-blue …), so
 * a completed tooth with no recorded condition rendered blank — indistinguishable
 * from untreated. Green is the one "done" hue that doesn't collide with any state
 * fill (or with lemon, reserved for interaction). It rides the edge so it coexists
 * with a restored fill instead of overpainting it.
 */
const PROPOSED_EDGE_NEUTRAL = '#475569'; // slate-600 — legible on white AND in grayscale
const COMPLETED_EDGE_GREEN = '#059669'; // emerald-600 — "done", CVD-distinct from gray/amber/red/orange
export function getLayerOutline(
  layer: ChartLayer,
  opts: { carriedOver: boolean },
): string | undefined {
  if (layer === 'proposed') {
    // Item 1: dotted + heavier weight makes "planned" obvious and pattern-distinct
    // from the solid completed (green) and declined (gray) edges. Fill still owns
    // red (caries), so the planned edge stays neutral slate to avoid collision.
    return opts.carriedOver
      ? '2.5px dotted #B8860A' // amber — carried over from a prior visit (salient)
      : `2px dotted ${PROPOSED_EDGE_NEUTRAL}`;
  }
  if (layer === 'completed') {
    return `2px solid ${COMPLETED_EDGE_GREEN}`; // green — realized/performed work
  }
  if (layer === 'declined') {
    return '1.5px solid #9CA3AF'; // gray — declined (with hatch texture)
  }
  return undefined; // baseline — fill carries the tooth
}

/**
 * Item 4 — the per-layer cue swatch shown on each multi-select filter chip (and
 * the inline legend), so the filter doubles as the legend. The swatch mirrors the
 * tooth-EDGE cue from getLayerOutline: Planned = dotted slate, Treated = solid
 * green, Declined = solid gray. Existing (baseline) carries no competing edge —
 * the fill owns it — so it shows a plain neutral square (no borderColor).
 * Returns Tailwind border classes + an optional inline borderColor.
 */
export function getLayerCueSwatch(layer: ChartLayer): { className: string; borderColor?: string } {
  switch (layer) {
    case 'proposed':
      return { className: 'border-2 border-dotted', borderColor: PROPOSED_EDGE_NEUTRAL };
    case 'completed':
      return { className: 'border-2 border-solid', borderColor: COMPLETED_EDGE_GREEN };
    case 'declined':
      return { className: 'border-2 border-solid', borderColor: '#9CA3AF' };
    case 'baseline':
    default:
      return { className: 'border border-black/20' }; // fill owns it — no edge hue
  }
}

/**
 * Item 9 / bug-b — per-tooth timeline status badge (slideout Treatment Breakdown).
 * The old `treatmentStatus === 'performed' ? 'Done' : 'Pending'` mislabelled
 * `verified` work as Pending and slapped a false "Pending" badge on snapshot rows
 * with NO treatment (undefined status). Map every status to a truthful label, and
 * return `null` when there is no treatment that visit so the cell shows nothing.
 */
export function getToothHistoryStatusBadge(
  status: string | undefined,
): { label: string; className: string } | null {
  switch (status) {
    case 'performed':
    case 'verified':
      return { label: 'Done', className: 'bg-green-100 text-green-700' };
    case 'diagnosed':
    case 'planned':
      return { label: 'Planned', className: 'bg-amber-100 text-amber-700' };
    case 'declined':
      return { label: 'Declined', className: 'bg-orange-100 text-orange-700' };
    case 'dismissed':
      return { label: 'Dismissed', className: 'bg-gray-100 text-gray-400' };
    default:
      return null; // no treatment recorded that visit — no badge, not a false "Pending"
  }
}

/**
 * P1-3 — colour-vision safety. caries-red (#FF3B30) and fractured-orange
 * (#FF9500) collapse under protanopia (caries misread as fracture — a clinical
 * miss). These states need a redundant NON-colour mark (stipple) so they stay
 * distinguishable in grayscale / for CVD users. `missing` (dashed) and `declined`
 * (hatch) already encode redundantly; this extends that discipline.
 */
export function stateNeedsCvdMark(state: ToothState): boolean {
  return state === 'caries' || state === 'fractured';
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
 * Item 5 / Option B: true when a tooth carries ≥2 DISTINCT surface conditions,
 * so the grid's single dominant-colour fill can't represent it (e.g. occlusal
 * caries + mesial filling). Same condition on multiple surfaces stays false —
 * one fill colour is still faithful. The grid uses this to show a corner pip
 * that routes to the slideout's per-surface view.
 */
export function hasMultipleSurfaceConditions(
  surfaceConditionMap?: Record<string, ToothState>,
): boolean {
  if (!surfaceConditionMap) return false;
  return new Set(Object.values(surfaceConditionMap)).size >= 2;
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

// ─── Chart diff / compare (P1-14: odontogram compare) ────────────────────

/**
 * A single tooth delta entry in a chart diff.
 *
 * - `added`:    tooth has a new or worsened condition in the focus snapshot
 * - `resolved`: tooth condition improved/treated vs the base snapshot
 * - `unchanged`: tooth state is the same in both snapshots
 */
export interface ChartDiffEntry {
  toothNumber: number;
  baseState: ToothState | undefined;
  focusState: ToothState | undefined;
}

export interface ChartDiffResult {
  /** Teeth that have a new or changed-to-worse condition in the focus snapshot. */
  added: ChartDiffEntry[];
  /** Teeth whose condition improved or was resolved (treated) vs the base. */
  resolved: ChartDiffEntry[];
  /** Teeth with identical state in both snapshots. */
  unchanged: ChartDiffEntry[];
}

/**
 * Compare two tooth snapshots (base = prior visit, focus = current/selected visit).
 *
 * Classification logic (client-side, P1-14):
 *   - tooth absent in base, present in focus → `added`  (new finding)
 *   - tooth present in base, absent in focus → `resolved` (condition gone)
 *   - state changed healthy → anything        → `added`  (new condition)
 *   - state changed anything → healthy/filled/crown → `resolved` (treated)
 *   - any other change in state               → `added`  (worsening / reclassification)
 *   - same state in both                      → `unchanged`
 *
 * The diff is purely client-side; it never touches the backend.
 */
export function computeChartDiff(
  baseTeeth: Array<{ toothNumber: number; state: ToothState }>,
  focusTeeth: Array<{ toothNumber: number; state: ToothState }>,
): ChartDiffResult {
  const IMPROVED_STATES: ReadonlySet<ToothState> = new Set<ToothState>([
    'healthy', 'filled', 'crown', 'implant',
  ]);

  const baseMap = new Map(baseTeeth.map(t => [t.toothNumber, t.state]));
  const focusMap = new Map(focusTeeth.map(t => [t.toothNumber, t.state]));

  const added: ChartDiffEntry[] = [];
  const resolved: ChartDiffEntry[] = [];
  const unchanged: ChartDiffEntry[] = [];

  const allTeeth = new Set([...baseMap.keys(), ...focusMap.keys()]);

  for (const toothNumber of allTeeth) {
    const baseState = baseMap.get(toothNumber);
    const focusState = focusMap.get(toothNumber);
    const entry: ChartDiffEntry = { toothNumber, baseState, focusState };

    if (baseState === undefined && focusState !== undefined) {
      // New tooth in focus → added
      added.push(entry);
    } else if (baseState !== undefined && focusState === undefined) {
      // Tooth gone in focus → resolved
      resolved.push(entry);
    } else if (baseState === focusState) {
      unchanged.push(entry);
    } else {
      // State changed — determine direction
      const isImprovement = focusState !== undefined && IMPROVED_STATES.has(focusState);
      if (isImprovement) {
        resolved.push(entry);
      } else {
        added.push(entry);
      }
    }
  }

  return { added, resolved, unchanged };
}
