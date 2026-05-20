# Phase 9: P1 Annotation Tools — Context

**Phase:** 09-p1-annotation-tools
**Goal:** Non-measurement annotation overlays (label, arrow, freehand, shape, tooth-specific)
**Requirements:** IMG-11, IMG-12, IMG-13, IMG-14, IMG-15
**Depends on:** Phase 8 (measurement tools infrastructure)

## Phase Boundary

**In scope:**
- Label annotations (text overlays on image)
- Arrow annotations (directional pointer)
- Freehand drawing (free-form path)
- Line/shape annotations (rectangle, ellipse)
- Tooth-specific annotations (linked to tooth number)
- Annotations stored as structured overlay data (BR-023 — never burned into image)
- Last-write-wins via server `updated_at` (BR-035)

**Out of scope:** Measurement tools (Phase 8), comparison/smoke test (Phase 10)

## Implementation Decisions

### Backend

**D1 — No new tables or TypeSpec models needed.**
`imaging_annotation` table already has all 5 types in `imagingAnnotationTypeEnum`: `label`, `arrow`, `freehand`, `shape`, `tooth`. Phase 8 already added the measurement CRUD endpoints. Reuse the same POST/GET/DELETE `/dental/imaging/images/:id/measurements` endpoints — they accept any annotation type.

**D2 — Geometry shapes per annotation type:**
```typescript
const LabelGeometry   = z.object({ type: z.literal('label'),    point: z.object({x: z.number(), y: z.number()}), text: z.string().min(1).max(200) })
const ArrowGeometry   = z.object({ type: z.literal('arrow'),    from: z.object({x: z.number(), y: z.number()}), to: z.object({x: z.number(), y: z.number()}) })
const FreehandGeometry= z.object({ type: z.literal('freehand'), points: z.array(z.object({x: z.number(), y: z.number()})).min(2) })
const ShapeGeometry   = z.object({ type: z.literal('shape'),    shapeType: z.enum(['rect','ellipse']), x: z.number(), y: z.number(), width: z.number(), height: z.number() })
const ToothGeometry   = z.object({ type: z.literal('tooth'),    point: z.object({x: z.number(), y: z.number()}), toothNumber: z.number().int().min(1).max(32) })
```
Add these 5 to the Zod discriminated union in `createMeasurement.ts` (alongside existing distance/angle/area).

**D3 — No tier gate on annotations.**
Annotations are available to all tiers (only measurements are tier-gated per ROADMAP). BR-023 applies regardless of tier.

**D4 — assertBranchAccess on any new handlers** (if any are needed beyond reuse).

### Frontend

**D5 — Extend existing SVG overlay from Phase 8.**
`imaging-workspace.tsx` already has `<svg className="absolute inset-0">`. Add annotation tool modes to the existing `ToolMode` type:
```typescript
type ToolMode = 'none' | 'calibration' | 'distance' | 'angle' | 'area' | 'label' | 'arrow' | 'freehand' | 'shape' | 'tooth'
```

**D6 — AnnotationToolbar** separate component (parallel to MeasurementToolbar). Renders: Label | Arrow | Freehand | Shape | Tooth buttons. Both toolbars render above ImagingWorkspace.

**D7 — SVG rendering per type:**
- `label` → `<text>` element at point
- `arrow` → `<line>` with `marker-end` arrowhead
- `freehand` → `<polyline>` or `<path>` from points array
- `shape` → `<rect>` or `<ellipse>` 
- `tooth` → `<circle>` + `<text>` with tooth number

**D8 — Last-write-wins (BR-035):** Frontend sends full annotation object on save; server `updated_at` is the authority. No optimistic conflict resolution needed — use `invalidateQueries` after mutation settles.

**D9 — Playwright verification** (no human checkpoint, per project preference).

## Existing Code to Reuse

- `imaging-workspace.tsx` SVG overlay — extend toolMode, add annotation rendering
- `use-measurements.ts` — reuse same hook (annotations use same endpoints)
- `measurement-toolbar.tsx` — copy pattern for `annotation-toolbar.tsx`
- `createMeasurement.ts` Zod union — extend with 5 new geometry types
- `imaging.test.ts` — extend with annotation tests

## Canonical Refs

- `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts` — imagingAnnotationTypeEnum
- `services/api-ts/src/handlers/dental-imaging/createMeasurement.ts` — extend Zod union
- `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` — extend SVG + toolMode
- `apps/dentalemon/src/features/imaging/components/measurement-toolbar.tsx` — copy pattern
- `apps/dentalemon/src/features/imaging/hooks/use-measurements.ts` — reuse for annotations

## Deferred

- Annotation versioning / conflict resolution beyond last-write-wins → future
- Collaborative real-time editing → v2.x
