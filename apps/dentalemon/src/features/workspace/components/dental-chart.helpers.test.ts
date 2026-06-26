/**
 * dental-chart.helpers — exhaustive unit tests
 *
 * Covers:
 *  - isValidFdiNumber / isValidUniversalNumber
 *  - fdiToUniversal / universalToFdi — all 32 teeth
 *  - Round-trip identity
 *  - buildToothMap
 */
import { describe, test, expect } from 'bun:test';
import {
  TOOTH_NUMBERS,
  isValidFdiNumber,
  isValidUniversalNumber,
  fdiToUniversal,
  universalToFdi,
  buildToothMap,
  getToothFillColor,
  statusToLayer,
  getLayerOutline,
  stateNeedsCvdMark,
  getLayerLabel,
  hasMultipleSurfaceConditions,
  type ToothState,
} from './dental-chart.helpers';

// ─── hasMultipleSurfaceConditions (item 5 / Option B) ──────────────────────
// The 32-tooth grid paints ONE dominant colour per tooth. When a tooth carries
// two or more DISTINCT surface conditions (e.g. occlusal caries + mesial
// filling), one fill colour can't tell the truth — the grid flags it with a
// corner pip that routes to the slideout's per-surface view. The predicate is
// "≥2 distinct condition VALUES" (same condition on two surfaces is still
// faithfully represented by the single fill).
describe('hasMultipleSurfaceConditions', () => {
  test('undefined / empty map → false', () => {
    expect(hasMultipleSurfaceConditions(undefined)).toBe(false);
    expect(hasMultipleSurfaceConditions({})).toBe(false);
  });

  test('single surface condition → false', () => {
    expect(hasMultipleSurfaceConditions({ occlusal: 'caries' })).toBe(false);
  });

  test('two surfaces, SAME condition → false (one fill is faithful)', () => {
    expect(hasMultipleSurfaceConditions({ occlusal: 'caries', mesial: 'caries' })).toBe(false);
  });

  test('two surfaces, DISTINCT conditions → true (the lie case)', () => {
    expect(hasMultipleSurfaceConditions({ occlusal: 'caries', mesial: 'filled' })).toBe(true);
  });
});

// ─── getLayerLabel (P1-2: rename tabs → neutral filters) ───────────────────
// The status tabs are demoted to neutral show/hide filters and renamed to the
// clinical-provenance vocabulary. "Existing" (was Baseline) and "Planned" (was
// Proposed) end the time/status double-encoding; "Treated" (item 2: was
// "Completed" — renamed so the tooth LAYER never reads as the visit/card
// "Completed" status) and "Declined" stay.

describe('getLayerLabel', () => {
  test('baseline reads as "Existing" (provenance, not the internal "Baseline")', () => {
    expect(getLayerLabel('baseline')).toBe('Existing');
  });
  test('proposed reads as "Planned" (ends the time/status double-encoding)', () => {
    expect(getLayerLabel('proposed')).toBe('Planned');
  });
  test('completed layer reads as "Treated" (item 2 — never collides with the visit/card "Completed" status)', () => {
    expect(getLayerLabel('completed')).toBe('Treated');
  });
  test('declined stays "Declined"', () => {
    expect(getLayerLabel('declined')).toBe('Declined');
  });
});

// ─── getLayerOutline (P1-1: colour de-overload) ────────────────────────────
// State owns the fill HUE; the layer is encoded on the EDGE (solid/dashed/hatch)
// in a NEUTRAL colour — never lemon. Lemon (--primary) is reserved for
// interaction (selection ring, active filter, CTA), so the proposed edge must not
// borrow it. Carried-over keeps its salient amber dash (the one hue exception);
// declined stays gray.

describe('getLayerOutline', () => {
  test('proposed (this-visit) is an obvious DOTTED edge in a NEUTRAL colour — never lemon/--primary (item 1)', () => {
    const outline = getLayerOutline('proposed', { carriedOver: false });
    // Item 1: dotted (not dashed) + heavier weight reads "provisional/planned"
    // and is pattern-distinct from completed (solid green) and declined (solid gray).
    expect(outline).toContain('dotted');
    expect(outline).toContain('2px');
    // The lemon-overload bug: proposed used var(--primary) which resolves to lemon.
    expect(outline).not.toContain('--primary');
    expect(outline?.toLowerCase()).not.toContain('ffe97d'); // lemon hex
  });

  test('carried-over proposed keeps the salient amber DOTTED edge (the one hue exception, item 1)', () => {
    const outline = getLayerOutline('proposed', { carriedOver: true });
    expect(outline).toContain('dotted');
    expect(outline?.toUpperCase()).toContain('B8860A'); // amber
  });

  test('declined is a solid gray edge (pairs with the hatch texture)', () => {
    const outline = getLayerOutline('declined', { carriedOver: false });
    expect(outline).toContain('solid');
  });

  test('completed is a solid GREEN edge — the realized-work cue (done = green), distinct from declined gray and never lemon', () => {
    const outline = getLayerOutline('completed', { carriedOver: false });
    expect(outline).toContain('solid');
    expect(outline?.toUpperCase()).toContain('059669'); // emerald — "done"
    expect(outline?.toLowerCase()).not.toContain('ffe97d'); // lemon reserved for interaction
  });

  test('baseline carries no competing edge — fill owns it', () => {
    expect(getLayerOutline('baseline', { carriedOver: false })).toBeUndefined();
  });
});

// ─── getLayerCueSwatch (item 4: the chip/legend cue glyph) ──────────────────
// Each multi-select filter chip carries the layer's cue swatch so the filter
// doubles as the legend. The swatch MUST mirror the tooth-edge cues: Planned =
// dotted slate, Treated = solid green, Declined = solid gray, Existing = plain
// neutral (fill owns it, no competing edge).

import { getLayerCueSwatch } from './dental-chart.helpers';

describe('getLayerCueSwatch (item 4 chip/legend cue)', () => {
  test('proposed (Planned) → dotted slate, matching the tooth edge', () => {
    const cue = getLayerCueSwatch('proposed');
    expect(cue.className).toContain('dotted');
    expect(cue.borderColor?.toUpperCase()).toBe('#475569');
  });

  test('completed (Treated) → solid green, matching the tooth edge', () => {
    const cue = getLayerCueSwatch('completed');
    expect(cue.className).toContain('solid');
    expect(cue.borderColor?.toUpperCase()).toBe('#059669');
  });

  test('declined → solid gray', () => {
    const cue = getLayerCueSwatch('declined');
    expect(cue.className).toContain('solid');
    expect(cue.borderColor).toBeTruthy();
  });

  test('baseline (Existing) carries no competing edge colour — fill owns it', () => {
    const cue = getLayerCueSwatch('baseline');
    expect(cue.borderColor).toBeUndefined();
  });
});

// ─── getToothHistoryStatusBadge (item 9 / bug-b: timeline badge) ────────────
// The old ternary mislabelled `verified` as Pending and slapped a false "Pending"
// badge on snapshot rows with NO treatment. The badge must tell the truth.

import { getToothHistoryStatusBadge, getToothHistoryEventBadge, getLayerLabel } from './dental-chart.helpers';
import { explainToothLayer } from './tooth-layer-explanation';

// The LOCKED 6-word patient-facing tooth vocabulary. Identical on tooth, legend,
// chips, panel, and PDF export. No "Proposed"/"Completed"/"Baseline"/"Pending"/"Done".
const TOOTH_VOCAB = new Set(['Existing', 'Flagged', 'Planned', 'Treated', 'Declined', 'Missing']);

describe('locked 6-word tooth vocabulary', () => {
  test('every chart layer label (chips/legend) is one of the six words', () => {
    for (const layer of ['baseline', 'proposed', 'completed', 'declined'] as const) {
      expect(TOOTH_VOCAB.has(getLayerLabel(layer))).toBe(true);
    }
  });

  test('the per-tooth layer explanation labels use the six words (no Baseline/Proposed drift)', () => {
    const labels = [
      explainToothLayer(11, 'existing', {}).label,
      explainToothLayer(11, undefined, { proposed: new Set([11]) }).label,
      explainToothLayer(11, undefined, { completed: new Set([11]) }).label,
      explainToothLayer(11, undefined, { declined: new Set([11]) }).label,
    ];
    for (const label of labels) expect(TOOTH_VOCAB.has(label)).toBe(true);
    expect(labels).not.toContain('Baseline');
    expect(labels).not.toContain('Proposed');
  });

  test('the panel status badge reads "Treated" (not "Done") for performed work', () => {
    expect(getToothHistoryStatusBadge('performed')?.label).toBe('Treated');
    expect(getToothHistoryEventBadge({ eventKind: 'treatment', treatmentStatus: 'verified' })?.label).toBe('Treated');
  });

  test('"Flagged" is surfaced for finding events', () => {
    expect(getToothHistoryEventBadge({ eventKind: 'finding' })?.label).toBe('Flagged');
  });
});

describe('getToothHistoryEventBadge (two-axis ledger: finding vs treatment)', () => {
  test('a finding event reads "Flagged" — never a blank row', () => {
    expect(getToothHistoryEventBadge({ eventKind: 'finding' })?.label).toBe('Flagged');
    // even with a stray status, a finding stays Flagged (it rides the condition axis)
    expect(getToothHistoryEventBadge({ eventKind: 'finding', treatmentStatus: 'planned' })?.label).toBe('Flagged');
  });

  test('a treatment event reads its lifecycle status badge', () => {
    expect(getToothHistoryEventBadge({ eventKind: 'treatment', treatmentStatus: 'performed' })?.label).toBe('Treated');
    expect(getToothHistoryEventBadge({ eventKind: 'treatment', treatmentStatus: 'planned' })?.label).toBe('Planned');
    expect(getToothHistoryEventBadge({ eventKind: 'treatment', treatmentStatus: 'declined' })?.label).toBe('Declined');
  });
});

describe('getToothHistoryStatusBadge (item 9 / bug-b)', () => {
  test('performed and verified both read "Treated" (locked vocab)', () => {
    expect(getToothHistoryStatusBadge('performed')?.label).toBe('Treated');
    expect(getToothHistoryStatusBadge('verified')?.label).toBe('Treated');
  });

  test('diagnosed and planned read "Planned"', () => {
    expect(getToothHistoryStatusBadge('diagnosed')?.label).toBe('Planned');
    expect(getToothHistoryStatusBadge('planned')?.label).toBe('Planned');
  });

  test('declined reads "Declined", not "Pending"', () => {
    expect(getToothHistoryStatusBadge('declined')?.label).toBe('Declined');
  });

  test('no treatment (undefined) → no badge (not a false "Pending")', () => {
    expect(getToothHistoryStatusBadge(undefined)).toBeNull();
  });
});

// ─── stateNeedsCvdMark (P1-3: colour-vision-safety redundancy) ──────────────
// caries-red (#FF3B30) and fractured-orange (#FF9500) collapse under protanopia —
// a clinical miss (caries read as fracture). These states need a redundant
// non-colour mark (stipple) so they stay distinguishable in grayscale/CVD.

describe('stateNeedsCvdMark', () => {
  test('caries and fractured need a redundant non-colour mark', () => {
    expect(stateNeedsCvdMark('caries')).toBe(true);
    expect(stateNeedsCvdMark('fractured')).toBe(true);
  });

  test('states that are already colour-safe do not', () => {
    expect(stateNeedsCvdMark('healthy')).toBe(false);
    expect(stateNeedsCvdMark('filled')).toBe(false);
    expect(stateNeedsCvdMark('crown')).toBe(false);
  });
});

// ─── statusToLayer (P0-2: single source of truth) ──────────────────────────
// The chart layer and the treatment-list group/badge derive from the SAME fold
// of treatment status, so they can differ in resolution but never contradict.
// Mapping (panel-locked): performed|verified → completed, diagnosed|planned →
// proposed, declined → declined, dismissed → off-chart (null).

describe('statusToLayer', () => {
  test('performed and verified fold to the completed layer', () => {
    expect(statusToLayer('performed')).toBe('completed');
    expect(statusToLayer('verified')).toBe('completed');
  });

  test('diagnosed and planned fold to the proposed layer', () => {
    expect(statusToLayer('diagnosed')).toBe('proposed');
    expect(statusToLayer('planned')).toBe('proposed');
  });

  test('declined folds to the declined layer', () => {
    expect(statusToLayer('declined')).toBe('declined');
  });

  test('dismissed is off-chart (null) — it never paints a tooth', () => {
    expect(statusToLayer('dismissed')).toBeNull();
  });
});

// ─── isValidFdiNumber ──────────────────────────────────────────────────────

describe('isValidFdiNumber', () => {
  test('returns true for all 32 FDI numbers', () => {
    for (const n of TOOTH_NUMBERS) {
      expect(isValidFdiNumber(n)).toBe(true);
    }
  });

  test('returns false for common invalid inputs', () => {
    for (const bad of [0, 1, 9, 10, 19, 20, 29, 30, 39, 40, 49, 50, 99, -1]) {
      expect(isValidFdiNumber(bad)).toBe(false);
    }
  });

  test('boundaries: 11 and 48 are valid', () => {
    expect(isValidFdiNumber(11)).toBe(true);
    expect(isValidFdiNumber(48)).toBe(true);
  });
});

// ─── isValidUniversalNumber ────────────────────────────────────────────────

describe('isValidUniversalNumber', () => {
  test('returns true for 1–32', () => {
    for (let i = 1; i <= 32; i++) {
      expect(isValidUniversalNumber(i)).toBe(true);
    }
  });

  test('returns false for 0 and 33', () => {
    expect(isValidUniversalNumber(0)).toBe(false);
    expect(isValidUniversalNumber(33)).toBe(false);
  });

  test('returns false for non-integer', () => {
    expect(isValidUniversalNumber(1.5)).toBe(false);
  });
});

// ─── fdiToUniversal — all 32 mappings ─────────────────────────────────────

const EXPECTED_FDI_TO_UNIVERSAL: [number, number][] = [
  // Upper right
  [11, 8], [12, 7], [13, 6], [14, 5], [15, 4], [16, 3], [17, 2], [18, 1],
  // Upper left
  [21, 9], [22, 10], [23, 11], [24, 12], [25, 13], [26, 14], [27, 15], [28, 16],
  // Lower left
  [31, 24], [32, 23], [33, 22], [34, 21], [35, 20], [36, 19], [37, 18], [38, 17],
  // Lower right
  [41, 25], [42, 26], [43, 27], [44, 28], [45, 29], [46, 30], [47, 31], [48, 32],
];

describe('fdiToUniversal', () => {
  test.each(EXPECTED_FDI_TO_UNIVERSAL)('FDI %i → Universal %i', (fdi, uni) => {
    expect(fdiToUniversal(fdi)).toBe(uni);
  });

  test('returns NaN for invalid FDI number', () => {
    expect(fdiToUniversal(0)).toBeNaN();
    expect(fdiToUniversal(10)).toBeNaN();
    expect(fdiToUniversal(19)).toBeNaN();
    expect(fdiToUniversal(99)).toBeNaN();
  });

  test('all 32 valid FDI numbers produce valid Universal numbers (1–32)', () => {
    for (const fdi of TOOTH_NUMBERS) {
      const uni = fdiToUniversal(fdi);
      expect(isValidUniversalNumber(uni)).toBe(true);
    }
  });
});

// ─── universalToFdi — all 32 mappings ─────────────────────────────────────

describe('universalToFdi', () => {
  test.each(EXPECTED_FDI_TO_UNIVERSAL)('Universal %i → FDI %i (reverse)', (fdi, uni) => {
    expect(universalToFdi(uni)).toBe(fdi);
  });

  test('returns NaN for invalid Universal number', () => {
    expect(universalToFdi(0)).toBeNaN();
    expect(universalToFdi(33)).toBeNaN();
  });

  test('all 32 Universal numbers produce valid FDI numbers', () => {
    for (let uni = 1; uni <= 32; uni++) {
      const fdi = universalToFdi(uni);
      expect(isValidFdiNumber(fdi)).toBe(true);
    }
  });
});

// ─── Round-trip identity ───────────────────────────────────────────────────

describe('round-trip identity', () => {
  test('fdiToUniversal → universalToFdi returns original FDI number (all 32)', () => {
    for (const fdi of TOOTH_NUMBERS) {
      expect(universalToFdi(fdiToUniversal(fdi))).toBe(fdi);
    }
  });

  test('universalToFdi → fdiToUniversal returns original Universal number (all 32)', () => {
    for (let uni = 1; uni <= 32; uni++) {
      expect(fdiToUniversal(universalToFdi(uni))).toBe(uni);
    }
  });
});

// ─── buildToothMap ─────────────────────────────────────────────────────────

describe('buildToothMap', () => {
  test('builds a map from tooth array', () => {
    const map = buildToothMap([
      { toothNumber: 11, state: 'healthy' },
      { toothNumber: 21, state: 'caries' },
    ]);
    expect(map.get(11)).toBe('healthy');
    expect(map.get(21)).toBe('caries');
  });

  test('later entry overwrites earlier for same toothNumber', () => {
    const map = buildToothMap([
      { toothNumber: 11, state: 'healthy' },
      { toothNumber: 11, state: 'caries' },
    ]);
    expect(map.get(11)).toBe('caries');
  });

  test('empty array returns empty map', () => {
    expect(buildToothMap([])).toEqual(new Map());
  });

  test('all 32 teeth can be stored and retrieved', () => {
    const teeth = TOOTH_NUMBERS.map((n) => ({ toothNumber: n, state: 'healthy' as const }));
    const map = buildToothMap(teeth);
    expect(map.size).toBe(32);
    for (const n of TOOTH_NUMBERS) {
      expect(map.get(n)).toBe('healthy');
    }
  });
});

// ─── getToothInfo ──────────────────────────────────────────────────────────

import { getToothInfo } from './dental-chart.helpers';

describe('getToothInfo', () => {
  test('upper right central incisor (FDI 11)', () => {
    const info = getToothInfo(11);
    expect(info.name).toBe('Upper Right Central Incisor');
    expect(info.type).toBe('anterior');
  });

  test('upper left canine (FDI 23)', () => {
    const info = getToothInfo(23);
    expect(info.name).toBe('Upper Left Canine');
    expect(info.type).toBe('anterior');
  });

  test('lower left first molar (FDI 36)', () => {
    const info = getToothInfo(36);
    expect(info.name).toBe('Lower Left First Molar');
    expect(info.type).toBe('posterior');
  });

  test('lower right third molar (FDI 48)', () => {
    const info = getToothInfo(48);
    expect(info.name).toBe('Lower Right Third Molar');
    expect(info.type).toBe('posterior');
  });

  test('all 8 positions of upper right quadrant', () => {
    const expected = [
      'Central Incisor', 'Lateral Incisor', 'Canine',
      'First Premolar', 'Second Premolar', 'First Molar', 'Second Molar', 'Third Molar',
    ];
    for (let pos = 1; pos <= 8; pos++) {
      expect(getToothInfo(10 + pos).name).toBe(`Upper Right ${expected[pos - 1]}`);
    }
  });

  test('anterior teeth are positions 1-3 across all quadrants', () => {
    const anteriorFdi = [11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43];
    for (const fdi of anteriorFdi) {
      expect(getToothInfo(fdi).type).toBe('anterior');
    }
  });

  test('posterior teeth are positions 4-8 across all quadrants', () => {
    const posteriorFdi = [14, 15, 16, 17, 18, 24, 25, 26, 27, 28, 34, 35, 36, 37, 38, 44, 45, 46, 47, 48];
    for (const fdi of posteriorFdi) {
      expect(getToothInfo(fdi).type).toBe('posterior');
    }
  });

  test('invalid FDI returns unknown', () => {
    const info = getToothInfo(99);
    expect(info.name).toBe('Tooth 99');
    expect(info.type).toBe('posterior');
  });
});

// ─── getDentitionType (AC-DENT-01, P2-002) ────────────────────────────────

import { getDentitionType } from './dental-chart.helpers';

describe('getDentitionType (P2-002)', () => {
  function dobYearsAgo(years: number): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    return d.toISOString().slice(0, 10);
  }

  // Updated for P1-17 three-tier model: primary (< 6) | mixed (6–11) | permanent (≥ 12)

  test('returns "primary" for a 2-year-old (pure deciduous, age < 6)', () => {
    expect(getDentitionType(dobYearsAgo(2))).toBe('primary');
  });

  test('returns "primary" for a 5-year-old (age < 6)', () => {
    expect(getDentitionType(dobYearsAgo(5))).toBe('primary');
  });

  test('returns "mixed" for a 6-year-old (mixed dentition begins)', () => {
    expect(getDentitionType(dobYearsAgo(6))).toBe('mixed');
  });

  test('returns "mixed" for an 11-year-old (still in mixed phase)', () => {
    expect(getDentitionType(dobYearsAgo(11))).toBe('mixed');
  });

  test('returns "permanent" for a 12-year-old (age === 12)', () => {
    expect(getDentitionType(dobYearsAgo(12))).toBe('permanent');
  });

  test('returns "permanent" for a 13-year-old (age > 12)', () => {
    expect(getDentitionType(dobYearsAgo(13))).toBe('permanent');
  });

  test('returns "permanent" for null DOB (defaults to adult)', () => {
    expect(getDentitionType(null)).toBe('permanent');
  });

  test('returns "permanent" for adult (35 years)', () => {
    expect(getDentitionType(dobYearsAgo(35))).toBe('permanent');
  });
});

// ─── fdiPrimaryToUniversal (P2-002) ───────────────────────────────────────

import { fdiPrimaryToUniversal, PEDIATRIC_TOOTH_NUMBERS } from './dental-chart.helpers';

describe('fdiPrimaryToUniversal (P2-002)', () => {
  test('maps all 20 primary FDI numbers to unique Universal positions 1–20', () => {
    const universalNums = PEDIATRIC_TOOTH_NUMBERS.map(fdiPrimaryToUniversal);
    const unique = new Set(universalNums);
    expect(universalNums.every(n => n >= 1 && n <= 20)).toBe(true);
    expect(unique.size).toBe(20);
  });

  test('FDI 51 (upper-right central) maps to Universal 5', () => {
    expect(fdiPrimaryToUniversal(51)).toBe(5);
  });

  test('FDI 55 (upper-right molar) maps to Universal 1', () => {
    expect(fdiPrimaryToUniversal(55)).toBe(1);
  });

  test('FDI 61 (upper-left central) maps to Universal 6', () => {
    expect(fdiPrimaryToUniversal(61)).toBe(6);
  });

  test('FDI 65 (upper-left molar) maps to Universal 10', () => {
    expect(fdiPrimaryToUniversal(65)).toBe(10);
  });

  test('FDI 71 (lower-left central) maps to Universal 11', () => {
    expect(fdiPrimaryToUniversal(71)).toBe(11);
  });

  test('FDI 81 (lower-right central) maps to Universal 20', () => {
    expect(fdiPrimaryToUniversal(81)).toBe(20);
  });

  test('returns NaN for a permanent FDI number', () => {
    expect(fdiPrimaryToUniversal(11)).toBeNaN();
  });
});

// ─── getToothFillColor ─────────────────────────────────────────────────────

describe('getToothFillColor', () => {
  test('returns empty string for healthy (no fill — preserves SVG strokes)', () => {
    expect(getToothFillColor('healthy')).toBe('');
  });

  test('returns hex string for caries', () => {
    expect(getToothFillColor('caries')).toBe('#FF3B30');
  });

  test('returns hex string for crown', () => {
    expect(getToothFillColor('crown')).toBe('#FFD60A');
  });

  test('returns #ffffff for unknown state', () => {
    expect(getToothFillColor('unknown_state' as any)).toBe('#ffffff');
  });

  test('covers all 9 ToothState values — returns string (empty or hex)', () => {
    const states: ToothState[] = ['healthy', 'caries', 'fractured', 'filled', 'crown', 'missing', 'implant', 'extracted', 'watchlist'];
    for (const s of states) {
      const color = getToothFillColor(s);
      // healthy returns '' (no fill); all others return a hex color
      expect(typeof color).toBe('string');
      if (s !== 'healthy') {
        expect(color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      }
    }
  });
});

// ─── getToothDisplayLabel / fdiToPalmer (QW-5 notation toggle) ────────────

import { getToothDisplayLabel, fdiToPalmer } from './dental-chart.helpers';

describe('fdiToPalmer', () => {
  test('FDI 11 (UR central) → "1|"', () => {
    expect(fdiToPalmer(11)).toBe('1|');
  });

  test('FDI 18 (UR wisdom) → "8|"', () => {
    expect(fdiToPalmer(18)).toBe('8|');
  });

  test('FDI 21 (UL central) → "|1"', () => {
    expect(fdiToPalmer(21)).toBe('|1');
  });

  test('FDI 28 (UL wisdom) → "|8"', () => {
    expect(fdiToPalmer(28)).toBe('|8');
  });

  test('FDI 31 (LL central) → "|1"', () => {
    expect(fdiToPalmer(31)).toBe('|1');
  });

  test('FDI 38 (LL wisdom) → "|8"', () => {
    expect(fdiToPalmer(38)).toBe('|8');
  });

  test('FDI 41 (LR central) → "1|"', () => {
    expect(fdiToPalmer(41)).toBe('1|');
  });

  test('FDI 48 (LR wisdom) → "8|"', () => {
    expect(fdiToPalmer(48)).toBe('8|');
  });

  test('all 32 FDI numbers return a non-empty string', () => {
    for (const n of TOOTH_NUMBERS) {
      const label = fdiToPalmer(n);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  test('returns empty string for invalid FDI number', () => {
    expect(fdiToPalmer(99)).toBe('');
  });
});

describe('getToothDisplayLabel (QW-5 notation toggle)', () => {
  test('FDI notation: returns FDI number as string for tooth 11', () => {
    expect(getToothDisplayLabel(11, 'FDI')).toBe('11');
  });

  test('FDI notation: returns FDI number as string for all permanent teeth', () => {
    for (const n of TOOTH_NUMBERS) {
      expect(getToothDisplayLabel(n, 'FDI')).toBe(String(n));
    }
  });

  test('Universal notation: FDI 11 (UR central) → "8"', () => {
    expect(getToothDisplayLabel(11, 'Universal')).toBe('8');
  });

  test('Universal notation: FDI 18 (UR wisdom) → "1"', () => {
    expect(getToothDisplayLabel(18, 'Universal')).toBe('1');
  });

  test('Universal notation: FDI 21 (UL central) → "9"', () => {
    expect(getToothDisplayLabel(21, 'Universal')).toBe('9');
  });

  test('Universal notation: FDI 48 (LR wisdom) → "32"', () => {
    expect(getToothDisplayLabel(48, 'Universal')).toBe('32');
  });

  test('Universal notation: all 32 FDI numbers produce valid Universal labels 1–32', () => {
    for (const n of TOOTH_NUMBERS) {
      const label = getToothDisplayLabel(n, 'Universal');
      const num = Number(label);
      expect(num >= 1 && num <= 32).toBe(true);
    }
  });

  test('Palmer notation: FDI 11 returns a non-empty string', () => {
    const label = getToothDisplayLabel(11, 'Palmer');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  test('Palmer notation: FDI 21 produces a different label from FDI 11 (different quadrant)', () => {
    expect(getToothDisplayLabel(11, 'Palmer')).not.toBe(getToothDisplayLabel(21, 'Palmer'));
  });

  test('unknown notation falls back to FDI string', () => {
    expect(getToothDisplayLabel(11, 'unknown' as any)).toBe('11');
  });

  test('primary tooth FDI 51 with FDI notation returns "51"', () => {
    expect(getToothDisplayLabel(51, 'FDI')).toBe('51');
  });

  test('primary tooth FDI 51 with Universal notation returns "5"', () => {
    expect(getToothDisplayLabel(51, 'Universal')).toBe('5');
  });
});

// ─── getToothLayer (CR-03 chart layer separation) ─────────────────────────

import { getToothLayer } from './dental-chart.helpers';

describe('getToothLayer (CR-03)', () => {
  test('existing → baseline', () => {
    expect(getToothLayer('existing')).toBe('baseline');
  });

  test('existing_other → baseline', () => {
    expect(getToothLayer('existing_other')).toBe('baseline');
  });

  // CHART-XV: treatment_plan is NO LONGER a chart-native proposed source. Whether
  // a tooth is proposed lives on the treatment record (status diagnosed/planned),
  // fed cumulatively into the chart. Deriving proposed from the frozen chart
  // classification resurrected stale red when the treatment was later dismissed.
  // Only `condition` (a finding with no treatment record yet) stays chart-native.
  test('treatment_plan → baseline (proposed-ness now lives on the treatment record)', () => {
    expect(getToothLayer('treatment_plan')).toBe('baseline');
  });

  test('condition → proposed (finding charted without a treatment record)', () => {
    expect(getToothLayer('condition')).toBe('proposed');
  });

  test('undefined (unclassified/legacy) → baseline', () => {
    expect(getToothLayer(undefined)).toBe('baseline');
  });
});

// ─── resolveToothLayer (CHART-XV: cumulative status precedence) ────────────

import { resolveToothLayer } from './dental-chart.helpers';

describe('resolveToothLayer (CHART-XV)', () => {
  const sets = (over: Partial<Record<'completed' | 'proposed' | 'declined', number[]>> = {}) => ({
    completed: new Set(over.completed ?? []),
    proposed: new Set(over.proposed ?? []),
    declined: new Set(over.declined ?? []),
  });

  test('proposed wins over everything — outstanding work is never hidden behind a Treated ring (item 6 flip)', () => {
    // Clinical safety: a tooth with BOTH a performed treatment AND new pending
    // work must read as Planned so the dentist sees the outstanding work.
    expect(
      resolveToothLayer(26, 'treatment_plan', sets({ completed: [26], proposed: [26], declined: [26] })),
    ).toBe('proposed');
  });

  test('completed beats declined and entryClassification', () => {
    expect(resolveToothLayer(11, 'existing', sets({ completed: [11], declined: [11] }))).toBe('completed');
  });

  test('declined set beats entryClassification', () => {
    expect(resolveToothLayer(21, 'existing', sets({ declined: [21] }))).toBe('declined');
  });

  test('falls back to entryClassification when no set matches', () => {
    expect(resolveToothLayer(31, 'condition', sets())).toBe('proposed'); // finding
    expect(resolveToothLayer(16, 'treatment_plan', sets())).toBe('baseline'); // no record → baseline
    expect(resolveToothLayer(46, 'existing', sets())).toBe('baseline');
  });

  test('undefined sets are treated as empty', () => {
    expect(resolveToothLayer(41, 'existing', undefined)).toBe('baseline');
  });

  // Cumulative-timeline terminal precedence (mirror BE resolveTerminalTeeth):
  // missing/extracted > proposed > completed > declined. A gone tooth has no
  // actionable lifecycle, so it never gets a Planned/Treated/Declined ring — the
  // fill (missing/extracted) owns it. resolved to 'baseline' (no edge).
  test('terminal state (missing/extracted) overrides proposed/completed/declined', () => {
    expect(resolveToothLayer(36, 'existing', sets({ proposed: [36] }), 'extracted')).toBe('baseline');
    expect(resolveToothLayer(18, 'existing', sets({ completed: [18] }), 'missing')).toBe('baseline');
    expect(resolveToothLayer(21, 'existing', sets({ declined: [21] }), 'extracted')).toBe('baseline');
  });

  test('a non-terminal state still resolves through the normal precedence', () => {
    expect(resolveToothLayer(26, 'existing', sets({ proposed: [26] }), 'caries')).toBe('proposed');
    expect(resolveToothLayer(27, 'existing', sets({ completed: [27] }), 'filled')).toBe('completed');
  });
});

// ─── isToothVisible (P1-15: combinable layers) ────────────────────────────
// RED: this function does not yet exist — tests will fail until implemented.

import { isToothVisible } from './dental-chart.helpers';

describe('isToothVisible (P1-15 combinable layers)', () => {
  const ALL_LAYERS = new Set<import('./dental-chart.helpers').ChartLayer>(['baseline', 'proposed', 'completed']);
  const BASELINE_ONLY = new Set<import('./dental-chart.helpers').ChartLayer>(['baseline']);
  const PROPOSED_ONLY = new Set<import('./dental-chart.helpers').ChartLayer>(['proposed']);
  const COMPLETED_ONLY = new Set<import('./dental-chart.helpers').ChartLayer>(['completed']);
  const BASELINE_AND_PROPOSED = new Set<import('./dental-chart.helpers').ChartLayer>(['baseline', 'proposed']);
  const EMPTY = new Set<import('./dental-chart.helpers').ChartLayer>();

  test('baseline tooth is visible when all layers are active', () => {
    expect(isToothVisible('baseline', ALL_LAYERS)).toBe(true);
  });

  test('proposed tooth is visible when all layers are active', () => {
    expect(isToothVisible('proposed', ALL_LAYERS)).toBe(true);
  });

  test('completed tooth is visible when all layers are active', () => {
    expect(isToothVisible('completed', ALL_LAYERS)).toBe(true);
  });

  test('baseline tooth is visible when only baseline is active', () => {
    expect(isToothVisible('baseline', BASELINE_ONLY)).toBe(true);
  });

  test('proposed tooth is NOT visible when only baseline is active', () => {
    expect(isToothVisible('proposed', BASELINE_ONLY)).toBe(false);
  });

  test('completed tooth is NOT visible when only baseline is active', () => {
    expect(isToothVisible('completed', BASELINE_ONLY)).toBe(false);
  });

  test('proposed tooth is visible when baseline+proposed are active', () => {
    expect(isToothVisible('proposed', BASELINE_AND_PROPOSED)).toBe(true);
  });

  test('completed tooth is NOT visible when baseline+proposed are active', () => {
    expect(isToothVisible('completed', BASELINE_AND_PROPOSED)).toBe(false);
  });

  test('baseline tooth is visible when only proposed is active (layer mismatch → not dimmed by layer)', () => {
    // When only proposed is active, baseline teeth are NOT in the set → hidden
    expect(isToothVisible('baseline', PROPOSED_ONLY)).toBe(false);
  });

  test('completed tooth is visible when only completed is active', () => {
    expect(isToothVisible('completed', COMPLETED_ONLY)).toBe(true);
  });

  test('all teeth are hidden when visibleLayers is empty', () => {
    expect(isToothVisible('baseline', EMPTY)).toBe(false);
    expect(isToothVisible('proposed', EMPTY)).toBe(false);
    expect(isToothVisible('completed', EMPTY)).toBe(false);
  });
});

// ─── DEFAULT_VISIBLE_LAYERS (P1-15: sensible default) ─────────────────────

import { DEFAULT_VISIBLE_LAYERS } from './dental-chart.helpers';

describe('DEFAULT_VISIBLE_LAYERS (P1-15 / CHART-XV)', () => {
  test('includes baseline, proposed, completed, declined by default', () => {
    expect(DEFAULT_VISIBLE_LAYERS.has('baseline')).toBe(true);
    expect(DEFAULT_VISIBLE_LAYERS.has('proposed')).toBe(true);
    expect(DEFAULT_VISIBLE_LAYERS.has('completed')).toBe(true);
    expect(DEFAULT_VISIBLE_LAYERS.has('declined')).toBe(true);
  });

  test('has exactly 4 members', () => {
    expect(DEFAULT_VISIBLE_LAYERS.size).toBe(4);
  });
});

// ─── getDentitionType mixed (P1-17) ────────────────────────────────────────
// RED: 'mixed' return value does not yet exist — these tests will fail.

describe('getDentitionType mixed dentition (P1-17)', () => {
  function dobYearsAgo(years: number, offsetDays = 0): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().slice(0, 10);
  }

  test('returns "mixed" for a 6-year-old (mixed dentition begins ~age 6)', () => {
    expect(getDentitionType(dobYearsAgo(6))).toBe('mixed');
  });

  test('returns "mixed" for a 7-year-old', () => {
    expect(getDentitionType(dobYearsAgo(7))).toBe('mixed');
  });

  test('returns "mixed" for an 11-year-old (still in mixed phase)', () => {
    expect(getDentitionType(dobYearsAgo(11))).toBe('mixed');
  });

  test('returns "primary" for a 5-year-old (pure primary)', () => {
    expect(getDentitionType(dobYearsAgo(5))).toBe('primary');
  });

  test('returns "primary" for a 2-year-old', () => {
    expect(getDentitionType(dobYearsAgo(2))).toBe('primary');
  });

  test('returns "permanent" for a 12-year-old (permanent dentition)', () => {
    expect(getDentitionType(dobYearsAgo(12))).toBe('permanent');
  });

  test('returns "permanent" for null DOB', () => {
    expect(getDentitionType(null)).toBe('permanent');
  });
});

// ─── getMixedDentitionTeeth (P1-17) ────────────────────────────────────────
// Returns the set of tooth numbers for a mixed dentition arch.
// Primary teeth coexist with erupted permanent teeth (typically 1s, 2s, 6s).
// RED: function does not yet exist.

import { getMixedDentitionTeeth } from './dental-chart.helpers';

describe('getMixedDentitionTeeth (P1-17)', () => {
  test('returns an array of tooth numbers', () => {
    const teeth = getMixedDentitionTeeth();
    expect(Array.isArray(teeth)).toBe(true);
  });

  test('includes primary teeth (51–85)', () => {
    const teeth = getMixedDentitionTeeth();
    const hasPrimary = teeth.some(n => n >= 51 && n <= 85);
    expect(hasPrimary).toBe(true);
  });

  test('includes some permanent teeth (erupted incisors 11–18, 21–28, 31–38, 41–48)', () => {
    const teeth = getMixedDentitionTeeth();
    const hasPermanent = teeth.some(n => n >= 11 && n <= 48);
    expect(hasPermanent).toBe(true);
  });

  test('permanent incisors (11,21,31,41) are in the mixed set (first to erupt)', () => {
    const teeth = new Set(getMixedDentitionTeeth());
    // Central incisors erupt first (~age 6–7)
    expect(teeth.has(11)).toBe(true); // UR central
    expect(teeth.has(21)).toBe(true); // UL central
    expect(teeth.has(31)).toBe(true); // LL central
    expect(teeth.has(41)).toBe(true); // LR central
  });

  test('permanent first molars (16,26,36,46) are in the mixed set (6-year molars)', () => {
    const teeth = new Set(getMixedDentitionTeeth());
    expect(teeth.has(16)).toBe(true);
    expect(teeth.has(26)).toBe(true);
    expect(teeth.has(36)).toBe(true);
    expect(teeth.has(46)).toBe(true);
  });

  test('total tooth count is between 24 and 52 (some primary + some permanent)', () => {
    const teeth = getMixedDentitionTeeth();
    expect(teeth.length).toBeGreaterThanOrEqual(24);
    expect(teeth.length).toBeLessThanOrEqual(52);
  });

  test('no duplicate tooth numbers', () => {
    const teeth = getMixedDentitionTeeth();
    const unique = new Set(teeth);
    expect(unique.size).toBe(teeth.length);
  });
});

// ─── computeChartDiff (P1-14: odontogram compare) ─────────────────────────
// RED: function does not yet exist.

import { computeChartDiff, type ChartDiffResult } from './dental-chart.helpers';

describe('computeChartDiff (P1-14 odontogram compare)', () => {
  const baseTeeth = [
    { toothNumber: 11, state: 'healthy' as const },
    { toothNumber: 21, state: 'caries' as const },
    { toothNumber: 36, state: 'filled' as const },
    { toothNumber: 46, state: 'missing' as const },
  ];

  test('returns an object with added, resolved, and unchanged arrays', () => {
    const diff = computeChartDiff(baseTeeth, baseTeeth);
    expect(Array.isArray(diff.added)).toBe(true);
    expect(Array.isArray(diff.resolved)).toBe(true);
    expect(Array.isArray(diff.unchanged)).toBe(true);
  });

  test('identical snapshots produce no added or resolved entries', () => {
    const diff = computeChartDiff(baseTeeth, baseTeeth);
    expect(diff.added).toHaveLength(0);
    expect(diff.resolved).toHaveLength(0);
  });

  test('identical snapshots put all teeth in unchanged', () => {
    const diff = computeChartDiff(baseTeeth, baseTeeth);
    expect(diff.unchanged).toHaveLength(baseTeeth.length);
  });

  test('a tooth that changed from healthy to caries appears in added', () => {
    const focusTeeth = [
      { toothNumber: 11, state: 'caries' as const },  // was healthy → new condition
      { toothNumber: 21, state: 'caries' as const },  // unchanged
      { toothNumber: 36, state: 'filled' as const },  // unchanged
      { toothNumber: 46, state: 'missing' as const },  // unchanged
    ];
    const diff = computeChartDiff(baseTeeth, focusTeeth);
    expect(diff.added.some(d => d.toothNumber === 11)).toBe(true);
  });

  test('a tooth that changed from caries to filled appears in resolved', () => {
    const focusTeeth = [
      { toothNumber: 11, state: 'healthy' as const },
      { toothNumber: 21, state: 'filled' as const },  // caries → filled (treated)
      { toothNumber: 36, state: 'filled' as const },
      { toothNumber: 46, state: 'missing' as const },
    ];
    const diff = computeChartDiff(baseTeeth, focusTeeth);
    expect(diff.resolved.some(d => d.toothNumber === 21)).toBe(true);
  });

  test('a tooth present in focus but absent in base appears as added (new finding)', () => {
    const focusTeeth = [
      ...baseTeeth,
      { toothNumber: 48, state: 'caries' as const }, // new tooth not in base
    ];
    const diff = computeChartDiff(baseTeeth, focusTeeth);
    expect(diff.added.some(d => d.toothNumber === 48)).toBe(true);
  });

  test('a tooth present in base but absent in focus appears as resolved (condition gone)', () => {
    const focusTeeth = baseTeeth.filter(t => t.toothNumber !== 21); // tooth 21 removed
    const diff = computeChartDiff(baseTeeth, focusTeeth);
    expect(diff.resolved.some(d => d.toothNumber === 21)).toBe(true);
  });

  test('added entries carry the focus state', () => {
    const focusTeeth = [
      { toothNumber: 11, state: 'caries' as const },
    ];
    const diff = computeChartDiff([{ toothNumber: 11, state: 'healthy' as const }], focusTeeth);
    const entry = diff.added.find(d => d.toothNumber === 11);
    expect(entry?.focusState).toBe('caries');
  });

  test('resolved entries carry the base state', () => {
    const baseLine = [{ toothNumber: 21, state: 'caries' as const }];
    const focusTeeth = [{ toothNumber: 21, state: 'healthy' as const }];
    const diff = computeChartDiff(baseLine, focusTeeth);
    const entry = diff.resolved.find(d => d.toothNumber === 21);
    expect(entry?.baseState).toBe('caries');
  });

  test('healthy→healthy is unchanged (no false positives)', () => {
    const diff = computeChartDiff(
      [{ toothNumber: 11, state: 'healthy' as const }],
      [{ toothNumber: 11, state: 'healthy' as const }],
    );
    expect(diff.unchanged.some(d => d.toothNumber === 11)).toBe(true);
    expect(diff.added).toHaveLength(0);
    expect(diff.resolved).toHaveLength(0);
  });

  test('empty base + non-empty focus → all focus teeth are added', () => {
    const diff = computeChartDiff([], baseTeeth);
    expect(diff.added).toHaveLength(baseTeeth.length);
    expect(diff.resolved).toHaveLength(0);
  });

  test('non-empty base + empty focus → all base teeth are resolved', () => {
    const diff = computeChartDiff(baseTeeth, []);
    expect(diff.resolved).toHaveLength(baseTeeth.length);
    expect(diff.added).toHaveLength(0);
  });
});
