# Phase 3: DentalChartThumbnail + Component Polish - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode — decisions derived from codebase analysis)

<domain>
## Phase Boundary

Build the missing `DentalChartThumbnail` component (4×16 tooth grid with condition pip colors) and wire it into `PatientFolderCard`. Also add the colored top tab strip to `PatientFolderCard` based on patient status (Gold=active, Gray=archived, Teal=in-session).

**In scope:**
- CREATE `dental-chart-thumbnail.tsx` — 4×16 pip grid
- Extend `PatientCardData` with `status?` and `latestChartTeeth?`
- Update `toPatientCard` in `use-patients.ts` to map `status` and chart data
- Update `patient-folder-card.tsx` — tab strip + thumbnail wiring

**Out of scope:**
- Per-card API fetch for chart data — data comes from patient list API response or not shown
- Full-chart colors: thumbnail uses its own pip-specific colors
- CSS dental vars (undefined in codebase) — use Tailwind directly

</domain>

<decisions>
## Implementation Decisions

### Thumbnail Rendering (COMP-01)
- **Approach:** CSS grid with small colored `div` pips — Tailwind-first, no SVG
- **Grid:** `grid grid-cols-16 gap-px` with 4px×4px pips (`w-1 h-1` in Tailwind)
- **Color function:** New `getThumbnailPipClass(state: ToothState): string` — separate from `getToothColorClass` to avoid coupling thumbnail colors to full-chart colors
- **Pip colors (per COMP-01 spec):**
  - `healthy` → `bg-muted` (gray, no visual noise)
  - `caries` → `bg-red-500/40` (red at ~40% — "caries=red/35%")
  - `fractured` → `bg-amber-400` (amber — mapped as "decayed=amber")
  - `filled` → `bg-green-500` (green — "filling=green")
  - `crown` → `bg-blue-400` (blue — thumbnail spec, differs from full chart's lemon)
  - `extracted` → `border border-dashed border-red-500 bg-transparent` ("extract=red+dashed")
  - `missing` → `bg-muted/50`
  - `implant` → `bg-blue-300`
  - `watchlist` → `bg-amber-300`
- **Layout:** Teeth 11-18 and 21-28 top row (upper jaw, 16 teeth), teeth 31-38 and 41-48 bottom row (lower jaw, 16 teeth) — 2 rows × 16 columns

### Patient Status + Tab Colors (COMP-03)
- **Extend `PatientCardData`:** Add `status?: 'active' | 'archived' | 'in-session'`
- **Extend `RawPatient` in `use-patients.ts`:** Add `status?: string` field
- **Map in `toPatientCard`:** `status: (p.status as 'active' | 'archived' | 'in-session') ?? undefined`
- **Tab strip colors:**
  - `active` → `bg-lemon` (Gold — matches existing brand token, replaces hardcoded `bg-[#FFE97D]`)
  - `archived` → `bg-muted` (Gray)
  - `in-session` → `bg-teal-500` (Teal — use default Tailwind teal)
  - `undefined` → `bg-lemon` (fallback to gold, same as current behavior)
- **Replace** the hardcoded `h-2 w-full bg-[#FFE97D]` tab with status-driven color

### Chart Data Source (COMP-02)
- **Extend `PatientCardData`:** Add `latestChartTeeth?: Array<{toothNumber: number; state: ToothState}>`
- **Extend `RawPatient`:** Add `latestChartTeeth?: Array<{toothNumber: number; state: string}>`
- **Map in `toPatientCard`:** Map raw teeth array (cast state to `ToothState`) if present
- **Show thumbnail:** Only when `latestChartTeeth` is non-empty — empty state = no thumbnail rendered (no placeholder)
- **Import `ToothState`** from `@/features/workspace/components/dental-chart.helpers` in `use-patients.ts`

### Empty State (COMP-01 criterion 4)
- If `latestChartTeeth` is undefined or empty: render nothing in the thumbnail area (no placeholder box)
- `DentalChartThumbnail` receives `teeth: Array<{toothNumber: number; state: ToothState}>` and renders the grid regardless — the caller (`PatientFolderCard`) guards with `{patient.latestChartTeeth?.length ? <DentalChartThumbnail ... /> : null}`

</decisions>

<specifics>
## Specific Ideas

- Keep the thumbnail compact — 4 rows might be read as 4 instead of 2 if the upper/lower jaw split isn't obvious. Use `gap-0.5` between rows and `gap-px` between teeth within a row for visual grouping.
- `PatientFolderCard` already uses `w-48` width — thumbnail should fill the card width (`w-full`) with small pips.
- `getThumbnailPipClass` should live in `dental-chart-thumbnail.tsx` (colocation), not in `dental-chart.helpers.ts` (different semantic — pip colors vs full chart colors).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Component Files to Modify
- `apps/dentalemon/src/features/patients/components/patient-folder-card.tsx` — current card, tab strip, `PatientCardData` interface
- `apps/dentalemon/src/features/patients/hooks/use-patients.ts` — `RawPatient`, `toPatientCard`, `PatientCardData` import
- `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts` — `ToothState`, `ToothData` types to import

### File to Create
- `apps/dentalemon/src/features/patients/components/dental-chart-thumbnail.tsx` — new component

### Configuration
- `apps/dentalemon/tailwind.config.ts` — `lemon`, `dental.*` tokens, `teal-*` availability

### No external specs
Requirements are fully captured in decisions above and ROADMAP.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ToothState` type from `dental-chart.helpers.ts`: `'healthy' | 'caries' | 'fractured' | 'filled' | 'crown' | 'missing' | 'implant' | 'extracted' | 'watchlist'`
- `bg-lemon` token: `#FFE97D` — already in tailwind config, use for active tab
- `PatientFolderCard` existing tab div: `<div className="h-2 w-full bg-[#FFE97D]">` — replace with status-driven class

### Established Patterns
- Tailwind-only styling (no CSS modules, no styled-components)
- Native `fetch` + TanStack Query for data
- Props-down data flow: route → list → card (no per-card fetches)
- `data-testid` on key elements for Phase 4 tests

### Integration Points
- `patient-folder-card.tsx` exports `PatientCardData` — `use-patients.ts` imports it. Extending `PatientCardData` requires updating both.
- `PatientList` passes `PatientCardData[]` to cards — no change needed there
- `patients.tsx` route calls `usePatients` → `toPatientCard` — the mapping layer is where `latestChartTeeth` and `status` are populated from the API

</code_context>

<deferred>
## Deferred Ideas

- Replacing all 30 remaining `bg-[#FFE97D]` hardcoded instances across the app — separate cleanup phase
- Fetching per-patient chart data on-demand (lazy) — requires API pagination design
- Animated thumbnail pips (hover reveal conditions) — future polish

</deferred>
