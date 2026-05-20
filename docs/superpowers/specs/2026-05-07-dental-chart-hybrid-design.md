# Dental Chart Hybrid Improvement — Design Spec

**Date:** 2026-05-07
**Status:** Draft

## Problem

The dental chart has 5 bugs/quality issues in its SVG path data layer:

1. **12 teeth have empty center (occlusal) zones** — all molars render with no clickable occlusal surface in the grid
2. **Invalid SVG in tooth-svg.tsx** — percentage-based coordinates in `<path d="M 50% 85%...">` and `<line x1="15%"...>` silently fail (SVG path `d` does not support percentages; `<line>` does via `lengthPercentage` but behavior varies)
3. **Duplicated zone-to-surface mapping** — `getZoneSurfaceMap()` in tooth-surface-map.tsx and `ZONE_TO_SURFACE` in five-surface-selector.tsx implement the same quadrant-aware logic independently
4. **834 lines for 3 unique shapes** — tooth-surface-paths.ts has 32 entries that are just X/Y offset copies of 3 templates (molar ring, premolar ring+circle, anterior oval+rect)
5. **Crown paths are flat auto-extractions** — single-color fills with no anatomical detail

## Solution

**Hybrid approach:** Replace crown SVG paths with anatomically rich ones from react-odontogram (MIT), replace surface zone data with 3 normalized templates, fix all bugs.

### What changes

| File | Action |
|------|--------|
| `tooth-paths.ts` | **Replace** — 16 anatomical crown paths from react-odontogram (8 types × upper/lower) mapped to Universal numbers |
| `tooth-surface-paths.ts` | **Replace** — 3 normalized templates (molar, premolar, anterior) with complete center zones, mapped by tooth type |
| `tooth-svg.tsx` | **Fix** — convert percentage coordinates to absolute values using viewBox dimensions |
| `tooth-surface-map.tsx` | **Refactor** — import shared zone-to-surface mapping instead of local `getZoneSurfaceMap()` |
| `five-surface-selector.tsx` | **Refactor** — import shared zone-to-surface mapping instead of local `ZONE_TO_SURFACE` |
| `five-surface-selector.helpers.ts` | **Extend** — add shared `getZoneToSurfaceMap(fdiNumber)` function |

### What stays the same

- `dental-chart.tsx` — grid layout, row structure, component composition
- `dental-chart.helpers.ts` — status types, FDI↔Universal conversion, color mapping
- `ToothSurfaceMap` component API and rendering logic
- `FiveSurfaceSelector` component API, interaction patterns, pill buttons
- `ToothSvg` component API (props interface unchanged)

---

## 1. Crown Paths — tooth-paths.ts

### Source

react-odontogram `src/data.ts` (MIT license). Contains 16 tooth type entries with:
- `outlinePath` — crown outline (cubic bezier curves)
- `shadowPath` — depth/shadow detail
- `lineHighlightPath` — surface highlights

### Mapping: 8 types × 2 (upper/lower) → 32 Universal numbers

| Type | Universal (upper) | Universal (lower) |
|------|-------------------|-------------------|
| Third Molar | 1, 16 | 17, 32 |
| Second Molar | 2, 15 | 18, 31 |
| First Molar | 3, 14 | 19, 30 |
| Second Premolar | 4, 13 | 20, 29 |
| First Premolar | 5, 12 | 21, 28 |
| Canine | 6, 11 | 22, 27 |
| Lateral Incisor | 7, 10 | 23, 26 |
| Central Incisor | 8, 9 | 24, 25 |

### Data structure (same interface, richer data)

```typescript
export interface ToothPathData {
  viewBox: string;
  basePaths: Array<{ d: string; fill: string }>;  // outline + shadow
  accentPaths: string[];                            // highlight lines
}
// Note: statusZones removed — they were unused overlays at 0.3 opacity
// that added visual noise. Status is already conveyed by the fill color.
```

### Integration with ToothSvg

No props changes. The `basePaths` rendering loop stays the same. The fill color override logic (line 80-82) maps `#fff`/white fills to the status color. react-odontogram uses white fills for the enamel area, so this mapping works directly.

The `accentPaths` (shadow + highlight) render at 0.4 opacity with the stroke color, giving anatomical depth without overwhelming the status color.

---

## 2. Surface Zone Templates — tooth-surface-paths.ts

### Current problem

- 834 lines, 32 entries, only 3 unique shapes
- 12 entries have `center.d: ""` (empty occlusal zone for molars)
- All coordinates are in arbitrary spaces with varying viewBox offsets

### New approach: 3 templates, normalized viewBox

```typescript
type ToothType = 'molar' | 'premolar' | 'anterior';

interface SurfaceTemplate {
  viewBox: string;  // normalized, e.g., "0 0 200 200"
  zones: Record<ZoneKey, { d: string }>;
}

const SURFACE_TEMPLATES: Record<ToothType, SurfaceTemplate> = {
  molar: { /* ring shape with filled center circle for occlusal */ },
  premolar: { /* smaller ring with center circle */ },
  anterior: { /* oval/stadium with rectangular center for incisal */ },
};
```

**Key fix:** The molar template gets a **proper center zone path** (filled circle/ellipse) instead of an empty string. This is what the current data is missing.

### Tooth type lookup

```typescript
function getToothType(universalNumber: number): ToothType {
  // Map by tooth position in quadrant (same logic as isAnteriorTooth but 3-way)
  const fdi = universalToFdi(universalNumber);
  const position = fdi % 10;
  if (position <= 3) return 'anterior';   // incisors + canine
  if (position <= 5) return 'premolar';   // first + second premolar
  return 'molar';                          // first/second/third molar
}
```

### Backward compatibility

`TOOTH_SURFACE_PATHS[universalNumber]` still works — we just build it from templates:

```typescript
export const TOOTH_SURFACE_PATHS: Record<number, ToothSurfacePathData> =
  Object.fromEntries(
    Array.from({ length: 32 }, (_, i) => {
      const u = i + 1;
      const template = SURFACE_TEMPLATES[getToothType(u)];
      return [u, { viewBox: template.viewBox, zones: template.zones }];
    })
  );
```

This drops 834 lines → ~60 lines while fixing the empty center zones.

---

## 3. Bug Fixes

### 3a. Invalid SVG percentages in tooth-svg.tsx

**Lines 111-113** (missing X overlay):
```tsx
// BEFORE (percentages work in <line> but behavior varies)
<line x1="15%" y1="15%" x2="85%" y2="85%" ... />

// AFTER — compute from viewBox
const [, , vbW, vbH] = data.viewBox.split(' ').map(Number);
<line x1={vbW * 0.15} y1={vbH * 0.15} x2={vbW * 0.85} y2={vbH * 0.85} ... />
```

**Lines 117-118** (impacted arrow):
```tsx
// BEFORE (percentages are INVALID in <path d>)
<path d="M 50% 85% L 35% 65% L 65% 65% Z" ... />

// AFTER
const cx = vbW * 0.5, cy = vbH * 0.85;
<path d={`M ${cx} ${cy} L ${vbW * 0.35} ${vbH * 0.65} L ${vbW * 0.65} ${vbH * 0.65} Z`} ... />
```

### 3b. Consolidate zone-to-surface mapping

Move to `five-surface-selector.helpers.ts`:

```typescript
export function getZoneToSurfaceMap(fdiNumber: number): Record<ZoneKey, ToothSurface> {
  const isAnterior = isAnteriorTooth(fdiNumber);
  const centerSurface: ToothSurface = isAnterior ? 'incisal' : 'occlusal';
  const isUpperArch = fdiNumber >= 11 && fdiNumber <= 28;
  const isQ1orQ3 = (fdiNumber >= 11 && fdiNumber <= 18) || (fdiNumber >= 31 && fdiNumber <= 38);

  return {
    center: centerSurface,
    top:    isUpperArch ? 'buccal' : 'lingual',
    bottom: isUpperArch ? 'lingual' : 'buccal',
    left:   isQ1orQ3 ? 'distal' : 'mesial',
    right:  isQ1orQ3 ? 'mesial' : 'distal',
  };
}
```

Both `tooth-surface-map.tsx` and `five-surface-selector.tsx` import this instead of maintaining their own copies.

---

## 4. Attribution

Add MIT license attribution for react-odontogram in the tooth-paths.ts header:

```typescript
/**
 * Crown SVG paths adapted from react-odontogram by biomathcode
 * https://github.com/biomathcode/react-odontogram
 * Licensed under MIT
 */
```

---

## Files Modified (summary)

1. `tooth-paths.ts` — full rewrite (auto-generated → 16 anatomical types)
2. `tooth-surface-paths.ts` — full rewrite (834 lines → ~60 lines, 3 templates)
3. `tooth-svg.tsx` — fix percentage coordinates (~10 lines changed)
4. `five-surface-selector.helpers.ts` — add `getZoneToSurfaceMap()` (~15 lines)
5. `tooth-surface-map.tsx` — replace local `getZoneSurfaceMap()` with import (~3 lines)
6. `five-surface-selector.tsx` — replace local `ZONE_TO_SURFACE` with import (~5 lines)

## Verification

1. `bun run typecheck` — passes
2. `bun test` — existing dental-chart.helpers.test.ts passes
3. Visual check: open dental chart in browser, verify:
   - All 32 teeth render crown shapes (no fallback rects)
   - Molars show clickable occlusal (center) zone in grid
   - Surface selection works in both grid and slideout
   - Missing tooth X overlay renders correctly
   - Status colors apply to crown fills
4. Check the FiveSurfaceSelector in tooth slideout — zone clicks map to correct surfaces for each quadrant
