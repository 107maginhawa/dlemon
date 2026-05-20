# Phase 8: P0 Measurement Tools — Context

**Phase:** 08-p0-measurement-tools
**Goal:** Clinical measurement tools with calibration (distance, angle, area)
**Requirements:** IMG-07, IMG-08, IMG-09, IMG-10, IMG-16
**Depends on:** Phase 7 (Core Imaging Workspace)

## Phase Boundary

**In scope:**
- Distance, angle, and area measurement tools on the canvas
- Per-image calibration (px → mm conversion via pixelSpacingMm)
- Calibration persistence via PATCH endpoint
- Panoramic accuracy warning (BR-024)
- Tier gate: Free orgs → 403 on all measurement endpoints
- Measurements saved as `imaging_annotation` rows with geometry JSONB

**Out of scope (defer to Phase 9):**
- Label, arrow, freehand, shape, tooth-specific annotations
- Concurrent editing / last-write-wins

## Implementation Decisions

### Backend

**D1 — Reuse existing schema, no new tables.**
`imaging_annotation` already has `geometry JSONB`, `measurementValue REAL`, `measurementUnit TEXT`.
`imaging_study_image.pixelSpacingMm` stores the calibration ratio.
No migrations needed beyond adding 3 TypeSpec ops + codegen.

**D2 — TypeSpec additions to `dental-imaging.tsp`:**
Add 4 operations to `DentalImagingModule`:
```
PATCH /dental/imaging/images/{imageId}/calibration   → UpdateCalibrationBody → ImagingStudyImage
POST  /dental/imaging/images/{imageId}/measurements  → CreateMeasurementBody → ImagingAnnotation
GET   /dental/imaging/images/{imageId}/measurements  → MeasurementListResponse
DELETE /dental/imaging/measurements/{measurementId}  → 204
```

**D3 — Geometry JSONB shape (Zod-validated at handler level):**
```typescript
const DistanceGeometry = z.object({ type: z.literal('distance'), points: z.tuple([z.object({x: z.number(), y: z.number()}), z.object({x: z.number(), y: z.number()})]) })
const AngleGeometry    = z.object({ type: z.literal('angle'),    points: z.tuple([z.object({x: z.number(), y: z.number()}), z.object({x: z.number(), y: z.number()}), z.object({x: z.number(), y: z.number()})]) })
const AreaGeometry     = z.object({ type: z.literal('area'),     points: z.array(z.object({x: z.number(), y: z.number()})).min(3) })
const MeasurementGeometry = z.discriminatedUnion('type', [DistanceGeometry, AngleGeometry, AreaGeometry])
```
`measurementValue` = computed value (px or mm); `measurementUnit` = `'px'` or `'mm'`.

**D4 — Tier gate pattern (reuse from imagingTier stub):**
```typescript
import { resolveImagingTier } from '@/handlers/dental-org/repos/organization.schema'
// In each measurement handler:
const tier = await getOrgImagingTier(db, ctx.branchId)
if (tier === 'free') return ctx.json({ error: 'Upgrade required' }, 403)
```
`getOrgImagingTier` helper: look up org by branchId, coerce null → 'free'.

**D5 — assertBranchAccess on all measurement handlers** (same as Phase 7 pattern).

### Frontend

**D6 — SVG overlay for measurement interaction (not second canvas).**
Rationale: SVG gives precise hit-testing on drawn shapes, no RAF loop needed for tool drawing.
Implementation: Transparent `<svg>` positioned `absolute inset-0` over the canvas element.
Canvas handles image rendering; SVG handles tool cursors + drawn measurements.

**D7 — Tool mode state:**
```typescript
type ToolMode = 'none' | 'calibration' | 'distance' | 'angle' | 'area'
const [toolMode, setToolMode] = useState<ToolMode>('none')
```
Add `toolMode` and `onMeasurementSaved` props to `ImagingWorkspace`.

**D8 — Measurement toolbar** lives in a new `MeasurementToolbar` component, rendered above the workspace. Shows: Calibrate | Distance | Angle | Area buttons. Active tool highlighted.

**D9 — Panoramic warning (BR-024):**
When `modality === 'panoramic'` AND a measurement tool is active, show yellow `<Badge>` below toolbar:
`"Measurements on panoramic images may be less accurate due to distortion."`

**D10 — Calibration UX:**
1. User clicks "Calibrate" → enters calibration mode
2. Draws a line on known-length object → dialog asks "Enter actual length (mm)"
3. PATCH saves `pixelSpacingMm = actualLengthMm / pixelDistance` to backend immediately
4. UI shows "Calibrated" badge; subsequent measurements auto-convert to mm

## Existing Code Insights

- **Canvas pattern:** `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` — offscreen canvas, RAF, refs for scale/offset/rotation/flip
- **imagingTier:** `services/api-ts/src/handlers/dental-org/repos/organization.schema.ts` — `imagingTierEnum` + coercion comment
- **assertBranchAccess:** `services/api-ts/src/handlers/shared/assert-branch-access.ts`
- **Phase 7 handler pattern:** `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts`
- **imaging_annotation table:** already has `geometry JSONB`, `measurementValue REAL`, `measurementUnit TEXT`, type enum `['line','angle','area','label','arrow','freehand','shape','tooth']`

## Canonical Refs

- `specs/api/src/modules/dental-imaging.tsp` — extend with measurement ops
- `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts` — reuse imaging_annotation
- `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts` — handler pattern
- `services/api-ts/src/handlers/dental-org/repos/organization.schema.ts` — imagingTier
- `services/api-ts/src/handlers/shared/assert-branch-access.ts` — branch isolation
- `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` — extend with SVG overlay + toolMode
- `.planning/phases/07-core-imaging-workspace/07-CONTEXT.md` — prior decisions

## Specific Ideas

- `MeasurementToolbar` renders above `ImagingWorkspace` inside the patient workspace imaging panel
- `use-measurements.ts` hook: TanStack Query for fetch + optimistic mutations for create/delete
- Calibration dialog: `<Dialog>` from shadcn (same as existing sheets pattern)

## Deferred

- Annotation tools (labels, arrows, freehand) → Phase 9
- DICOM pixel spacing auto-import → future (v1.4 Clinical Imaging)
