# Components — dental-imaging
<!-- oli: v3-dentalemon | dental-imaging | ui-prototype -->

Reusable components for the dental-imaging module. Built on Radix UI primitives from `apps/dentalemon/src/components/` (Dialog, Select, Combobox, Tabs, Accordion, Toast, AlertDialog). Image viewer uses a custom canvas/SVG overlay layer; no external DICOM viewer dependency for v1 (DICOM .dcm files are stored and previewable via server-side rasterization; full DICOM windowing is a stretch goal). Lemon `#FFE97D` for selection/active accents; dark `#0B0B0F` canvas for radiograph legibility.

---

## StudyListTimeline
**Props:**
- `studies: ImagingStudy[]`
- `onSelect(studyId)`
- `isLoading?: boolean`

**Behavior:** Renders studies as cards sorted by `study_date` desc, grouped by month header on iPad (`May 2026`, `April 2026`, …). Each card surfaces the first image as a thumbnail (square aspect, `object-cover`), key metadata, findings count, and a `ceph` badge when a `dental_ceph_analysis` row exists. Whole card is the tap target; satisfies 44px minimum. Skeleton mode renders 5 shimmer cards.

---

## StudyTypeBadge
**Props:**
- `type: 'PA' | 'BW' | 'OPG' | 'Photo' | 'CBCT' | 'Ceph'`
- `size?: 'sm' | 'md'`

**Behavior:** Pill chip with an icon and short label. Color palette per type: PA / BW = neutral, OPG = blue, Photo = green, CBCT = purple, Ceph = lemon-accent. Used in list cards, viewer header, and as a link chip in findings summary.

---

## ImageViewer
**Props:**
- `imageUrl: string`
- `annotations: Annotation[]`
- `activeTool: 'zoom' | 'pan' | 'measure' | 'point' | 'line' | 'polygon' | 'arrow' | 'text' | null`
- `brightness: number` / `contrast: number`
- `onPan(dx, dy)` / `onZoom(factor, origin)` / `onShapeComplete(shape)`
- `editable: boolean`

**Behavior:** Canvas-backed image rendering with hardware-accelerated pan/zoom (CSS transform on parent `<img>` / `<canvas>`). Mouse wheel zooms toward cursor; pinch-zoom on touch. Pan tool drags image. Measure tool creates two-point line and reports pixel-or-mm distance in footer overlay (mm derived from `image.pixel_spacing` if available). Annotation tools (point/line/polygon/arrow/text) capture clicks and emit `onShapeComplete` once the gesture finishes (Enter or double-click for polygon close). Brightness/contrast applied as CSS filter. ESC cancels in-progress shape. Keyboard shortcuts: `+`/`-` zoom, `0` fit, `1`–`5` tool selection.

---

## ThumbnailStrip
**Props:**
- `images: ImagingImage[]`
- `activeImageId: string`
- `onSelect(imageId)`
- `orientation?: 'vertical' | 'horizontal'` (default vertical on iPad)

**Behavior:** Renders thumbnails in a scrollable strip. Active thumbnail wrapped in a 2px lemon ring. Keyboard ←/→ (horizontal) or ↑/↓ (vertical) cycles selection. Each thumbnail is a 44×44 minimum tap target.

---

## AnnotationToolbar
**Props:**
- `activeTool`
- `onToolChange(tool)`
- `brightness` / `contrast`
- `onBrightnessChange` / `onContrastChange`
- `onZoomIn()` / `onZoomOut()` / `onFit()` / `onReset()` / `onFullscreen()`
- `editable: boolean`

**Behavior:** Horizontal toolbar above canvas. Tool buttons are toggle group (Radix ToggleGroup) with the active tool highlighted lemon. Brightness/contrast sliders surfaced as a popover (mobile) or inline (iPad landscape). When `!editable`, annotation tool buttons are hidden; zoom/pan/brightness remain.

---

## AnnotationOverlay
**Props:**
- `annotations: Annotation[]`
- `pendingShape?: PartialShape`
- `imageDimensions: { width, height }`
- `viewport: { offsetX, offsetY, scale }`
- `onSelect(id)`

**Behavior:** SVG layered absolutely over the image. Translates annotation coordinates (stored in image-space pixels) into viewport space using `viewport`. Renders shapes by type. Click on a shape selects it (lemon glow + emits `onSelect`). Pending shape is rendered with a dashed stroke while the user is mid-gesture.

---

## FindingsPanel
**Props:**
- `findings: Finding[]`
- `mode: 'study' | 'aggregate'`
- `onSelect(findingId)` / `onAdd()` / `onEdit(id)` / `onDelete(id)`
- `editable: boolean`

**Behavior:** Accordion list. Each entry renders `FindingSeverityBadge`, type label, tooth/region, truncated description. In `study` mode, clicking an entry highlights its linked annotation on canvas. In `aggregate` mode, renders a `StudyTypeBadge`+date link chip to navigate to source study. Add CTA visible when `editable && mode === 'study'`.

---

## FindingSeverityBadge
**Props:**
- `severity: 'low' | 'moderate' | 'high' | 'critical'`

**Behavior:** Pill with color coding: low = neutral, moderate = amber, high = orange `#FF9F0A`, critical = red `#FF453A`. Icon prefix scales with severity (dot → triangle → octagon).

---

## UploadStudyDialog
**Props:**
- `open: boolean`
- `onOpenChange(open)`
- `patientId: string`
- `onSubmit(study, files): Promise<{ studyId: string }>`

**Behavior:** Radix Dialog (becomes Sheet on phone). Validates that at least one file is queued before enabling Upload. Detects DICOM by magic bytes and infers modality from DICOM `Modality` tag when present; otherwise modality is derived from the user-selected study type. Per-file progress via fetch + ReadableStream. On full success, navigates parent to `/patients/:id/imaging/:sid`. Partial-failure mode keeps the dialog open with a retry CTA only for failed files.

---

## AddAnnotationDialog
**Props:**
- `open: boolean`
- `onOpenChange(open)`
- `defaultType: AnnotationType`
- `onSubmit(payload): Promise<void>`
- `onDiscard()`

**Behavior:** Compact Radix Dialog opened after a shape gesture completes. Color picker uses preset palette (lemon, red, blue, green, white) plus contrast-aware halo for visibility on dark canvas. Cancel triggers `onDiscard` which removes the pending shape.

---

## AddFindingDialog
**Props:**
- `open: boolean`
- `onOpenChange(open)`
- `studyId: string`
- `availableAnnotations: Annotation[]`
- `onSubmit(payload): Promise<void>`

**Behavior:** Standard Radix Dialog. Linked annotation Combobox previews the selected annotation as a mini thumbnail crop (50×50). Severity segmented control mirrors `FindingSeverityBadge` colors. Description required (min 4 chars).

---

## CephLandmarkCanvas
**Props:**
- `imageUrl: string`
- `landmarks: CephLandmark[]` (each `{ id, code, name, x, y, placed, required }`)
- `activeLandmarkId: string | null`
- `onPlace(landmarkId, x, y)`
- `onMove(landmarkId, x, y)`
- `editable: boolean`

**Behavior:** Dark canvas viewer optimized for ceph radiographs. Click-to-place mode: with `activeLandmarkId` set, the next canvas click places that landmark at image-space coordinates. Placed landmarks render as lemon dots (8px) with a small label tag (code). Drag to reposition (snaps to integer pixels). Pending landmarks are shown only via the sidebar (not on canvas) until placed. Supports pan/zoom identical to `ImageViewer`.

---

## CephResultsTable
**Props:**
- `measurements: CephMeasurement[]` (each `{ name, value, unit, normal_low, normal_high }`)
- `isRecomputing?: boolean`

**Behavior:** Static table with columns Measurement / Value / Normal range / Deviation. Deviation indicator: within range = green check, mild (within 20% of range) = amber, severe (outside range >20%) = red. Skeleton rows during `isRecomputing`. Export PDF action is owned by the parent screen, not this component.

---

## CephLandmarkList
**Props:**
- `landmarks: CephLandmark[]`
- `activeLandmarkId: string | null`
- `onActivate(landmarkId)`
- `onClear(landmarkId)`

**Behavior:** Sidebar list. Each row: status dot (placed lemon / unplaced gray), code, full name, required indicator (asterisk). Clicking activates the landmark for canvas placement. Long-press / context action `Clear` removes a placed landmark. Progress chip at top: `{placed}/{total}`.
