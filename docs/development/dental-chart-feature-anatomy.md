# MYCURE Dental Chart Feature — Anatomy & Architecture

> **Scope:** EMR → Encounter Workspace → Records → Dental tab
> **Route:** `/emr/encounters/workspace/records/dental`
> **App:** `apps/mycure`
> **Repo:** [`mycurelabs/monobase-mycure`](https://github.com/mycurelabs/monobase-mycure)
>
> This document explains how the dental chart works end-to-end: where the page lives, how teeth are rendered as SVGs, how surface coloring is computed from records, how the data flows from API to UI, and how to extend it. It is meant to give a new engineer enough context to recreate the feature.

---

## 1. Big-picture overview

The dental chart is a **Vue 3 + TypeScript** feature that shows an anatomical view of the patient's teeth, color-coded with the patient's dental conditions and treatments. It is rendered inside the EMR encounter workspace as the **"Dental"** tab.

Three structural concepts to keep in mind:

| Concept | What it is | Where it lives |
|---|---|---|
| **Page** (route handler) | The dental tab UI: stage tabs, chart grid, notes table, dialogs | `apps/mycure` |
| **Components** (reusable UI) | `DentalChartGrid`, `UniversalTooth`, dialogs, stepper wizard | `packages/ui` (shared `@lfh/ui` library) |
| **Composables** (data + logic) | `useDentalStatus`, `useToothColoring`, `useDentalEncounterWorkspace`, `useToothPreview` | Mixed: app-level in `apps/mycure`, component-level in `packages/ui` |

Most components are **shared with `dentalemon`** (the dental-focused fork) via `packages/ui`. The mycure-specific glue lives in `apps/mycure/src/composables/`.

### High-level data flow

```
Hapihub records service
    │  (type: "dental-note/baseline" | "/order" | "/result")
    ▼
useRecords() → propagated via inject('encounter-workspace')
    │
    ▼
EncounterRecordsDental.vue
    │  filters records by stage tab → recordsForDentalChart
    ▼
DentalChartGrid (chart-type="adult"|"child")
    │  for each tooth → getToothSurfaceStatuses()
    ▼
UniversalTooth (SVG with surface IDs)
    │  applySurfaceColors() → DOMParser + element.style.fill
    ▼
Visible colored tooth in the browser
```

---

## 2. Route & entry point

The dental tab is mounted under the EMR encounter workspace router section. Two routes hit the same page component:

| Route | Name | Source |
|---|---|---|
| `/emr/encounters/workspace/records/dental?encounter=:id` | `emr-encounter-workspace-records-dental` | [03.emr.ts:266-269](https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/router/03.emr.ts) |
| `/emr/encounters/create-wizard/:id/records/dental` | `emr-encounter-create-wizard-records-dental` | [03.emr.ts:158-161](https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/router/03.emr.ts) |

Both render `apps/mycure/src/pages/emr/EncounterRecordsDental.vue`.

> There is also a **newer dental-focused encounter** at `/emr/encounters/:id` which uses `DentalEncounterPage.vue` and `DentalEncounterWorkspace.vue` layout. It is the dental-specific replacement for the generic encounter workspace and uses the same chart components.

---

## 3. Component anatomy (with GitHub links)

### 3.1 Index of every component & file

| Item | Type | GitHub link |
|---|---|---|
| **Route definitions** | route file | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/router/03.emr.ts |
| **EncounterRecordsDental.vue** | page (mycure app) | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/pages/emr/EncounterRecordsDental.vue |
| **DentalEncounterPage.vue** | dental-focused page (newer) | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/pages/emr/DentalEncounterPage.vue |
| **DentalEncounterWorkspace.vue** | layout (newer) | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/layouts/DentalEncounterWorkspace.vue |
| **DentalChartGrid.vue** | full chart | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/DentalChartGrid.vue |
| **UniversalTooth.vue** | individual SVG tooth | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/UniversalTooth.vue |
| **Tooth.vue** | legacy tooth (deprecated for chart use) | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/Tooth.vue |
| **ToothAdvanced.vue** | legacy advanced tooth | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/ToothAdvanced.vue |
| **PeriodontalChart.vue** | periodontal charting | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/PeriodontalChart.vue |
| **ToothPreviewDialog.vue** | dialog: existing statuses for a tooth | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/ToothPreviewDialog.vue |
| **ToothPreviewDrawer.vue** | drawer variant of preview | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/ToothPreviewDrawer.vue |
| **CustomDentalStatusCreateForm.vue** | create custom status | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/CustomDentalStatusCreateForm.vue |
| **CustomDentalStatusEditForm.vue** | edit custom status | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/CustomDentalStatusEditForm.vue |
| **types.ts** (dental) | tooth maps + SVG ID transforms | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/types.ts |
| **base-types.ts** | layout/shape types | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/base-types.ts |
| **constants.ts** (dental) | layouts, surfaces, status colors | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/constants.ts |
| **overlay-helpers.ts** | overlay SVG discovery | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/overlay-helpers.ts |
| **index.ts** (dental) | barrel exports | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/index.ts |
| **SURFACE_MAPPING.md** | surface mapping reference | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/SURFACE_MAPPING.md |
| **assets/teeth/** | 64 SVGs (32 adult + 20 pediatric × 2 variants) | https://github.com/mycurelabs/monobase-mycure/tree/main/packages/ui/src/components/emr/dental/assets/teeth |
| **assets/overlays/** | overlay SVGs (missing, impacted, etc.) | https://github.com/mycurelabs/monobase-mycure/tree/main/packages/ui/src/components/emr/dental/assets/overlays |
| **note-modal/** (subdir) | iPad-optimized dental note modal | https://github.com/mycurelabs/monobase-mycure/tree/main/packages/ui/src/components/emr/dental/note-modal |
| ↳ DentalNoteModal.vue | modal wrapper | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-modal/DentalNoteModal.vue |
| ↳ ToothSurfaceSelector.vue | interactive surface picker | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-modal/ToothSurfaceSelector.vue |
| ↳ ToothSurfaceSelectorField.vue | form-field wrapper | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-modal/ToothSurfaceSelectorField.vue |
| ↳ ICDASSelector.vue | ICDAS score (0-6) selector | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-modal/ICDASSelector.vue |
| ↳ CASTSelector.vue | CAST score (0-9) selector | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-modal/CASTSelector.vue |
| ↳ BaselineStatusGrid.vue | baseline status grid | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-modal/BaselineStatusGrid.vue |
| ↳ field-config.ts | modal form field config | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-modal/field-config.ts |
| ↳ types.ts | modal types | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-modal/types.ts |
| **note-stepper/** (subdir) | multi-step wizard for creating notes | https://github.com/mycurelabs/monobase-mycure/tree/main/packages/ui/src/components/emr/dental/note-stepper |
| ↳ DentalNoteStepper.vue | 3-step wizard | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-stepper/DentalNoteStepper.vue |
| ↳ ToothVisualization.vue | tooth in stepper context | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-stepper/ToothVisualization.vue |
| ↳ ExistingRecordsList.vue | list of records for tooth | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-stepper/ExistingRecordsList.vue |
| ↳ StepRequiredFields.vue | step 1 (required fields) | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-stepper/StepRequiredFields.vue |
| ↳ StepStatusSurfaces.vue | step: status & surfaces | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-stepper/StepStatusSurfaces.vue |
| ↳ StepOptionalFields.vue | step: optional fields | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-stepper/StepOptionalFields.vue |
| ↳ StepAdditionalInfo.vue | step: additional info | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-stepper/StepAdditionalInfo.vue |
| ↳ types.ts | stepper types | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/note-stepper/types.ts |
| **composables/** (in `packages/ui`) | shared component-level composables | https://github.com/mycurelabs/monobase-mycure/tree/main/packages/ui/src/components/emr/dental/composables |
| ↳ useToothPreview.ts | shared preview state logic | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/composables/useToothPreview.ts |
| **dental-note records** | dental-note record type widgets | https://github.com/mycurelabs/monobase-mycure/tree/main/packages/ui/src/components/emr/records/dental-note |
| ↳ DentalNoteForm.vue | classic single-step form | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/records/dental-note/DentalNoteForm.vue |
| ↳ DentalNotePreview.vue | record preview (in tables) | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/records/dental-note/DentalNotePreview.vue |
| ↳ ToothSurfaceSelector.vue | classic surface selector | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/records/dental-note/ToothSurfaceSelector.vue |
| ↳ SurfaceIcdasDialog.vue | ICDAS+CAST surface dialog | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/records/dental-note/SurfaceIcdasDialog.vue |
| ↳ types.ts | dental-note record types | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/records/dental-note/types.ts |
| ↳ constants.ts | record constants | https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/records/dental-note/constants.ts |
| **Composables (mycure app)** | data composables | — |
| ↳ dental.ts | `useDentalStatus`, `fromRawDentalStatus` | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/composables/dental.ts |
| ↳ dental.tooth-coloring.ts | `useToothColoring` (programmatic surface coloring) | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/composables/dental.tooth-coloring.ts |
| ↳ emr.dental-encounter-workspace.ts | `useDentalEncounterWorkspace` | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/composables/emr.dental-encounter-workspace.ts |
| ↳ emr.encounter.workspace.ts | parent encounter workspace (provides `encounter-workspace` injection) | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/composables/emr.encounter.workspace.ts |
| ↳ emr.records.ts | `useRecords` (generic encounter records) | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/composables/emr.records.ts |
| **Utils (mycure app)** | dental utility helpers | — |
| ↳ dental-surface-mapping.ts | tooth metadata + surface lookup | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/utils/dental-surface-mapping.ts |
| ↳ dental-svg-ids.ts | element-ID ↔ surface-name | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/utils/dental-svg-ids.ts |
| ↳ dental-view-correlation.ts | cross-view ID correlation | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/utils/dental-view-correlation.ts |
| **Types (mycure app)** | dental TS types | — |
| ↳ dental-surfaces.ts | surface/correlation types | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/types/dental-surfaces.ts |
| ↳ dental-encounter.ts | dental encounter types | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/types/dental-encounter.ts |
| **Settings page** | dental statuses CRUD (custom statuses per org) | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/pages/settings/DentalStatusesSetup.vue |
| **Migration PRD** | source-of-truth for the dentalemon → mycure port | https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/docs/dental-chart-migration-prd.md |

---

## 4. The page (`EncounterRecordsDental.vue`)

This is the screen the user sees at `/emr/encounters/workspace/records/dental`.

### 4.1 What it does

1. **Inherits state via `inject('encounter-workspace')`** from the parent `EncounterWorkspace` layout. It receives `patient`, `encounter`, `records`, `propsByRecordType`, and the CRUD handlers (`onRecordCreate`, `onRecordUpdate`, `onRecordDelete`).
2. **Auto-detects child vs adult chart** based on the patient's age (cutoff: 12 years). The user can override via a Switch.
3. **Three stage tabs**: `baseline` (initial assessment) → `order` ("Work Proposed" — treatment plan) → `result` ("Work Done"). Each tab corresponds to a record type: `dental-note/baseline`, `dental-note/order`, `dental-note/result`.
4. **Filters records** for the current stage tab and renders the chart.
5. **Supports past-encounter overlays** — user can click "Past Encounters" to load and overlay dental records from previous encounters.
6. **Renders a `DataTable` of all dental notes** below the chart with edit/delete and "copy to next stage" actions.
7. **Opens the `DentalNoteStepper` wizard** when a tooth or table row is clicked.

### 4.2 Key code excerpts

**Stage tabs and chart-type derivation:**

```ts
// EncounterRecordsDental.vue
type DentalStageTab = 'baseline' | 'order' | 'result';
const stageTab = ref<DentalStageTab>('baseline');

const patientAge = computed(() => {
  const dob = patient.value?.dateOfBirth || patient.value?.birthDate;
  return dob ? differenceInYears(new Date(), new Date(dob)) : null;
});
const autoChartType = computed(() => (patientAge.value ?? 99) < 12 ? 'child' : 'adult');
const chartType = computed(() => chartTypeOverride.value ?? autoChartType.value);
```

**Filter records by stage:**

```ts
const dentalRecords = computed(() =>
  (records?.value?.data || []).filter((r: any) => r.type?.startsWith('dental-note'))
);
const stageFilteredRecords = computed(() =>
  combinedDentalRecords.value.filter(r => r.type === `dental-note/${stageTab.value}`)
);
```

**Pass records → chart:**

```vue
<DentalChartGrid
  :chart-type="chartType"
  :records="recordsForDentalChart"
  :show-inline-preview="inlinePreviewOpen"
  :preview-tooth="inlinePreviewTooth"
  :preview-stage="stageTab"
  @tooth-click="handleToothClick"
  @preview="handlePreview"
/>
```

**Open stepper on tooth click:**

```ts
const handleToothClick = (data: { tooth: string; toothType: string }) => {
  previewTooth.value = data;
  stepperInitialData.value = null;
  stepperOpen.value = true;
};
```

---

## 5. The chart (`DentalChartGrid`)

### 5.1 Structure

`DentalChartGrid` is an **HTML table** where each cell holds either a `UniversalTooth` SVG or (legacy fallback) a numbered placeholder. The layout comes from one of two constants:

- `UNIVERSAL_DENTAL_LAYOUT` — Universal Numbering System (1–32 + A–T) — **default**
- `DENTAL_LAYOUT` — FDI/ISO numbering (11–48 + A–T) — legacy

Both are 4-row layouts (pediatric upper / adult upper / adult lower / pediatric lower). The `chartType` prop filters rows: `adult` keeps rows 2 + 3; `child` keeps rows 1 + 4.

```
Row 1 (pediatric upper):   _ _ _ A B C D E | F G H I J _ _ _
Row 2 (adult    upper):    1 2 3 4 5 6 7 8 | 9 10 11 12 13 14 15 16
Row 3 (adult    lower):   32 31 30 29 28 27 26 25 | 24 23 22 21 20 19 18 17
Row 4 (pediatric lower):   _ _ _ T S R Q P | O N M L K _ _ _
```

The vertical bar marks the midline (right border of position 8 / left border of position 9). The **patient's right** appears on the **left side of the chart**.

### 5.2 How a tooth gets its color (the heart of the feature)

Inside `DentalChartGrid.vue`, for every tooth on the chart it computes two arrays:

1. **`getToothSurfaceStatuses(toothNumber): SurfaceStatus[]`** — the per-surface colors.
2. **`getToothOverlayStatuses(toothNumber): string[]`** — overlay-image status types (e.g. `missing-caries`, `impacted`).

Both feed `<UniversalTooth>` props (`surfacesStatus` and `overlayStatuses`). The algorithm:

```ts
// DentalChartGrid.getToothSurfaceStatuses (simplified)
const sortedRecords = records
  .filter(r => r.teeth?.includes(toothNumber) && r.status)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first

const surfaceMap = new Map<string, SurfaceStatus>();

for (const record of sortedRecords) {
  if (!record.status?.colorCoding) continue;

  // Skip overlay-only statuses (rendered separately as images)
  if (hasStatusOverlay(record.status.statusType)) continue;

  if (record.status.forAll === true) {
    // Whole-tooth: color all surfaces of this tooth
    for (const surfaceName of getAllToothSurfaces(toothNumber)) {
      if (!surfaceMap.has(surfaceName)) {
        surfaceMap.set(surfaceName, { surface, colorCoding, statusDesc, surfaceName });
      }
    }
  } else if (record.surfaces?.length) {
    // Per-surface
    for (const surface of record.surfaces) {
      if (!surfaceMap.has(surface.name)) {
        surfaceMap.set(surface.name, { /* ... */ });
      }
    }
  }
}
```

Two important rules embedded here:

1. **First-write-wins** (the latest record for a given surface keeps its color — older records do not overwrite). Sorting newest-first guarantees the latest record colors a surface.
2. **`forAll: true` paints the whole tooth.** This lets statuses like "Missing", "Crown", "Implant" cover all surfaces from a single record.
3. **Overlay statuses do not paint surfaces.** They render as a separate SVG image on top of the tooth (e.g., the "X" graphic for `extraction-caries`).

`SurfaceStatus[]` then flows into `UniversalTooth.surfacesStatus`, which actually paints the SVG (see §6).

### 5.3 Extra UX features

- A small **Eye button** in each tooth cell opens an inline preview (mobile-friendly) or the `ToothPreviewDialog` / `ToothPreviewDrawer`.
- For **pediatric (A–T)** teeth, the same `UniversalTooth` is used (with `pediatricTooth` prop).
- For unsupported teeth (missing SVG), a **hex-color fallback** placeholder shows the number.

---

## 6. The tooth (`UniversalTooth`)

`UniversalTooth.vue` renders a single tooth and is responsible for the **actual SVG coloring**. The component:

1. **Lazy-loads the right SVG** via `import.meta.glob` based on `toothNumber` (1–32) or `pediatricTooth` (A–T) and `variant` (`column` for chart, `surfacemap` for selector).
2. **Transforms the SVG IDs** (positional → anatomical) using `transformSvgIds` / `transformPediatricSvgIds`.
3. **Applies surface coloring** by parsing the SVG with `DOMParser`, querying elements by their anatomical IDs, and setting `element.style.fill = colorCoding`.
4. **Re-serializes the SVG** with `XMLSerializer` and renders it via `v-html`.
5. **Stacks overlay SVGs** (if `overlayStatuses` is non-empty) absolutely positioned over the tooth.

### 6.1 SVG file structure

```
packages/ui/src/components/emr/dental/assets/
├── teeth/
│   ├── tooth-1-column.svg      ← chart view (multi-angle)
│   ├── tooth-1-surfacemap.svg  ← surface picker view
│   ├── tooth-2-column.svg
│   ├── ...
│   ├── tooth-32-column.svg
│   ├── tooth-child-A-column.svg ← pediatric A
│   ├── tooth-child-A-surfacemap.svg
│   ├── ...
│   └── tooth-child-T-surfacemap.svg
└── overlays/
    ├── missing-caries.svg
    ├── missing-congenital.svg
    ├── extraction-caries.svg
    ├── extraction-indicated.svg
    ├── extraction-other.svg
    ├── impacted.svg
    ├── root-fragment.svg
    ├── denture.svg
    └── supernumerary.svg
```

**Total:** 104 tooth SVGs (32 adult column + 32 adult surfacemap + 20 pediatric column + 20 pediatric surfacemap) + 10 overlays.

> A **complete file-by-file inventory** with GitHub links for every SVG asset is in [§14](#14-complete-svg--asset-inventory).

### 6.2 SVG ID transformation (`transformSvgIds` / `transformPediatricSvgIds`)

Source SVGs use **positional IDs** (front-left, back-top, tooth1-top-center, etc.). Those don't carry anatomical meaning until they are mapped to `mesial / distal / buccal / labial / palatal / lingual / occlusal / incisal / cervicalbuccal / cervicallabial / cervicalpalatal / cervicallingual` based on the tooth's quadrant and type.

The mapping is computed by `getSurfaceMapping(toothNumber)` in [`packages/ui/src/components/emr/dental/types.ts`](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/types.ts), using these rules:

| Position | Anterior tooth (canine/incisor) | Posterior tooth (molar/premolar) |
|---|---|---|
| **center** | `incisal` | `occlusal` |
| **top** (facial) | `labial` (lip side) | `buccal` (cheek side) |
| **bottom** (interior) | `palatal` (upper) / `lingual` (lower) | `palatal` (upper) / `lingual` (lower) |
| **left/right** | `mesial` / `distal` based on **quadrant** | same |

For **mesial/distal**, the rule is: surfaces toward the midline are **mesial**, away are **distal**. So tooth #1 (upper-right molar, far from midline) has `right=mesial` and `left=distal`, while tooth #16 has the opposite.

After transformation, an SVG path that was `<path id="front-left">` becomes `<path id="tooth-1_distal">`. That ID is what `applySurfaceColors()` matches against.

> Lower teeth (17–32) have an SVG quirk: the front/back top-bottom positions are flipped relative to upper teeth (because the SVG was modeled with the crown pointing up). The transform handles this with an `isLower` branch.

### 6.3 `applySurfaceColors()` — the actual paint

```ts
// UniversalTooth.vue
const applySurfaceColors = () => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent.value, 'image/svg+xml');

  if (props.fillColor) {
    // Whole-tooth fill (not used by the chart but exposed for storybook/picker)
    doc.querySelectorAll('path, polygon, rect, circle, ellipse').forEach(el => {
      if (hasFill(el)) el.style.fill = props.fillColor!;
    });
  } else if (props.surfacesStatus?.length) {
    for (const status of props.surfacesStatus) {
      const idPrefix = isPediatric.value
        ? `tooth-child-${props.pediatricTooth}`
        : `tooth-${props.toothNumber}`;

      // SVGs may have duplicate IDs across views — try suffixes 0..5
      for (let i = 0; i <= 5; i++) {
        const suffix = i === 0 ? '' : String(i);
        const selector = `[id="${idPrefix}_${status.surface.toLowerCase()}${suffix}"]`;
        doc.querySelectorAll(selector).forEach(el => {
          (el as SVGElement).style.fill = status.colorCoding;
        });
      }
    }
  }

  svgContent.value = new XMLSerializer().serializeToString(doc);
};
```

The numbered-suffix loop is because the SVGs have multiple paths for the same anatomical surface across views (front, back, top). All of them get colored together so the visual is consistent.

---

## 7. Status types & color rules

The catalog of **22 status types** is hard-coded in [`packages/ui/src/components/emr/dental/constants.ts`](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/constants.ts).

### 7.1 Application-type matrix

| Status type | Default application | Color | Has overlay image? |
|---|---|---|---|
| `default` | per-surface | `#f87171` (light coral) | — |
| `icdas` | per-surface | `#fdba74` (light peach) | — |
| `surfaces` | per-surface | `#7dd3fc` (sky blue) | — |
| `rct` | whole-tooth | `#5eead4` (light teal) | — |
| `implant` | whole-tooth | `#d6d3d1` (light stone) | — |
| `prosthetic` | whole-tooth | `#c4b5fd` (light lavender) | — |
| `extraction` | whole-tooth | `#d1d5db` (light gray) | — |
| `periodontal` | whole-tooth | `#f9a8d4` (light pink) | — |
| `orthodontic` | whole-tooth | `#a5b4fc` (light indigo) | — |
| `anomaly` | whole-tooth | `#fde047` (light yellow) | — |
| `endodontic` | whole-tooth | `#86efac` (light green) | — |
| `trauma` | whole-tooth | `#fca5a5` (salmon) | — |
| `missing-congenital` | whole-tooth | `#fde047` | ✅ `missing-congenital.svg` |
| `missing-caries` | whole-tooth | `#f87171` | ✅ `missing-caries.svg` |
| `missing-other` | whole-tooth | `#d1d5db` | ✅ `missing-other.svg` |
| `extraction-indicated` | whole-tooth | `#fcd34d` | ✅ `extraction-indicated.svg` |
| `extraction-caries` | whole-tooth | `#93c5fd` | ✅ `extraction-caries.svg` |
| `extraction-other` | whole-tooth | `#d1d5db` | ✅ `extraction-other.svg` |
| `impacted` | whole-tooth | `#c084fc` | ✅ `impacted.svg` |
| `root-fragment` | whole-tooth | `#fdba74` | ✅ `root-fragment.svg` |
| `denture` | whole-tooth | `#a5b4fc` | ✅ `denture.svg` |
| `supernumerary` | whole-tooth | `#f87171` | ✅ `supernumerary.svg` |

**Resolution order of "what color?":**

1. Each `DentalNoteStatus` row in the database has its own `colorCoding` field (admins can pick custom colors per organization).
2. If `colorCoding` is set on the status record → that wins.
3. If a status type has an overlay image → the surface paint is **skipped** (overlay renders instead).
4. Application: `forAll === true` → whole-tooth; otherwise the record's `surfaces[]` list.

### 7.2 Per-organization custom statuses

In addition to the global fixtures, organizations can define their own dental statuses via the settings page (`/settings/emr/dental-statuses`). Custom statuses are stored as `fixtures` records with `type: 'dental-status'` and either `account` or `organization` scoping (see `useDentalStatus` in [`apps/mycure/src/composables/dental.ts`](https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/composables/dental.ts)).

---

## 8. Composables — what each one does

### 8.1 `useDentalStatus(filter, opts)` — fetch dental statuses

[`apps/mycure/src/composables/dental.ts`](https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/composables/dental.ts)

Wraps `useServiceItems('fixtures', ...)` to fetch dental status records for the current organization (and optionally global account-level fixtures).

```ts
const { data: baselineStatuses } = useDentalStatus({ stages: 'baseline' });
const { data: allBaseline }      = useDentalStatus({ stages: 'baseline' }, { fixtures: true });
```

Returns rows shaped by `fromRawDentalStatus`:

```ts
{
  id, type, createdAt, createdBy, stages, group,
  statusType, abbreviation, colorCoding, category,
  suggestedRemarks, suggestedForNextStage, forAll, description
}
```

`suggestedForNextStage` is auto-populated via `$populate` so a baseline "Caries" can suggest order "Filling".

### 8.2 `useDentalEncounterWorkspace({ encounterId })` — encounter-level state

[`apps/mycure/src/composables/emr.dental-encounter-workspace.ts`](https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/composables/emr.dental-encounter-workspace.ts)

Used by the **newer dental-focused page** (`DentalEncounterPage.vue`). It composes `useEncounter`, `usePatient`, `useEncounters`, `useRecords`, and `useDentalStatus` into a single API surface. Notable bits:

- Splits records into `dentalRecords` (anything starting with `dental-note`) and `nonDentalRecords`.
- Provides previous / next encounter for arrow navigation.
- Integrates with `usePatientCentric` so patient edits in the sidebar reflect immediately in the workspace header.
- Pre-builds `propsByRecordType['dental-note/baseline']`, `'dental-note/order'`, `'dental-note/result'` with the relevant `statusOptions`, `customStatuses`, `diagnosisOptions`, `servicesOptions`, and `onGotoSettings`.

> The **older route** (`/emr/encounters/workspace/records/dental`) does not use this composable directly — it inherits state from `useEncounterWorkspace` via `inject('encounter-workspace')`.

### 8.3 `useToothColoring(toothNumber)` — programmatic SVG coloring

[`apps/mycure/src/composables/dental.tooth-coloring.ts`](https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/composables/dental.tooth-coloring.ts)

Imperative API for live-coloring teeth (used by the surface selector / Storybook playgrounds, **not by the chart itself** — the chart uses the declarative `surfacesStatus` prop on `UniversalTooth`).

```ts
const { colorSurface, clearSurface, applicableSurfaces, getElementsForSurface }
  = useToothColoring(14);

colorSurface('mesial', '#ff0000');      // direct DOM mutation
colorPosition('top', '#00ff00');         // by SVG position
clearAllSurfaces();
```

It relies on `apps/mycure/src/utils/dental-surface-mapping.ts` and `dental-view-correlation.ts` to know which DOM IDs belong to a surface (they may span multiple SVG views).

### 8.4 `useToothPreview(opts)` — shared preview logic

[`packages/ui/src/components/emr/dental/composables/useToothPreview.ts`](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/composables/useToothPreview.ts)

Shared between `DentalNoteStepper` and `ToothPreviewDrawer`. Takes `(tooth, records, stage, excludeId?)` refs and returns:

- `toothRecords` / `sortedToothRecords` — filtered + sorted records for that tooth + stage
- `hoveredRecord` / `handleRecordHover` / `handleRecordSelect` / `handleSelectAll` — hover-and-lock state for "preview a single record" mode
- `previewSurfacesStatus` / `previewOverlayStatuses` — what to feed into `UniversalTooth` (the hovered record's colors **or** the union of all records when no record is hovered)
- `allToothSurfaces`, `formatSurfaceName`, `pediatricToothLetter` — small helpers

This composable is what makes the preview UX feel responsive: hovering a row in the records list shows just that record's coloring; un-hovering shows the cumulative chart.

### 8.5 Helper composables in the parent encounter

The dental tab consumes `useEncounterWorkspace` from [`apps/mycure/src/composables/emr.encounter.workspace.ts`](https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/src/composables/emr.encounter.workspace.ts) which provides `records`, `propsByRecordType`, etc., via Vue `provide('encounter-workspace', ...)`. The dental tab calls `inject('encounter-workspace')` to read it. This is why the "Dental" tab can co-exist with "SOAP", "Classic", etc., without re-fetching records.

---

## 9. The dental-note record (the data model)

A dental record stored on hapihub has these key fields (see [`packages/ui/src/components/emr/records/dental-note/types.ts`](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/records/dental-note/types.ts)):

```ts
interface DentalNoteModel {
  id?: string;
  type?: 'dental-note' | 'dental-note/baseline' | 'dental-note/order' | 'dental-note/result';
  teeth?: string[];               // ['1','2'] or ['A','B']
  status?: DentalNoteStatus;      // shape of the picked dental status
  surfaces?: DentalNoteSurface[]; // [{ name: 'mesial', icdas?, cast? }, …]
  icd10?: string;
  notes?: string;
  diagnosisCode?: string;
  diagnosisText?: string;
  service?: Service;
  metadata?: any;
  createdAt?: string | number | Date;
}

interface DentalNoteStatus {
  id?: string;
  statusType?: string;        // one of the 22 categories
  abbreviation?: string;
  colorCoding?: string;       // hex color used on the chart
  category?: string;          // human-readable label
  forAll?: boolean;           // whole-tooth vs per-surface override
  stages?: ('baseline' | 'order' | 'result')[];
  suggestedForNextStage?: DentalNoteStatus[];
  suggestedRemarks?: string;
}
```

### Stage workflow

```
baseline (initial)  →  order (treatment plan)  →  result (work done)
```

The page exposes "Copy to Treatment Plan", "Copy to Work Done", "Copy to Both" actions on each baseline record so you can promote a finding into a planned treatment without re-typing.

### ICDAS / CAST scoring

Per surface, you can attach an **ICDAS score (0–6)** and/or **CAST score (0–9)**. These are entered via `ICDASSelector` / `CASTSelector` in the note modal. They drive epidemiology reporting but do not affect the tooth coloring directly — color comes from `status.colorCoding`.

---

## 10. The note creation UX

Two parallel UIs exist for creating a dental note:

### 10.1 `DentalNoteStepper` (default)

A 3-step `Dialog`:

1. **Preview** — shows the tooth with existing records, plus a list. (Skipped in edit mode.)
2. **Status & Surfaces** — pick a status, then either toggle `forAll` or select specific surfaces.
3. **Additional Info** — diagnosis (ICD), service, notes, suggested next-stage statuses.

This is the modern flow used by `EncounterRecordsDental.vue`.

### 10.2 `DentalNoteForm` / `DentalNoteModal` (legacy single-step)

Single-form variant. Still rendered for record-type widgets in non-dental contexts (e.g., the generic `EncounterRecords` viewer). Drag-and-drop selection on a `ToothSurfaceSelector` SVG (the `surfacemap` variant).

---

## 11. Summary of the SVG → screen pipeline

```
          ┌──────────────────────────────────────────────┐
          │  hapihub records service                     │
          │  GET /records?encounter=:id&type=dental-note*│
          └─────────────────┬────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────────────────────┐
          │  useRecords()  →  TanStack Vue Query cache   │
          │  → provide('encounter-workspace')            │
          └─────────────────┬────────────────────────────┘
                            │ inject('encounter-workspace')
                            ▼
          ┌──────────────────────────────────────────────┐
          │  EncounterRecordsDental.vue                  │
          │  - filter by stage tab                       │
          │  - auto-detect adult/child by patient age    │
          │  - bind records → DentalChartGrid            │
          └─────────────────┬────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────────────────────┐
          │  DentalChartGrid                             │
          │  - filter records by tooth                   │
          │  - sort by createdAt desc (newest first)     │
          │  - for each tooth: build SurfaceStatus[]     │
          │    + overlayStatuses[]                       │
          │  - render <UniversalTooth>                   │
          └─────────────────┬────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────────────────────┐
          │  UniversalTooth                              │
          │  1. import.meta.glob → load tooth-N-column.svg│
          │  2. transformSvgIds()  positional → anatomical│
          │  3. applySurfaceColors() via DOMParser       │
          │  4. v-html the colored SVG                   │
          │  5. stack overlay SVGs absolutely positioned │
          └──────────────────────────────────────────────┘
```

---

## 12. How to recreate this feature in a new app

If you are porting this to a new codebase (e.g., the original `dentalemon → mycure` migration documented in [`apps/mycure/docs/dental-chart-migration-prd.md`](https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/docs/dental-chart-migration-prd.md)), the minimum set you need is:

### 12.1 Required UI files (copy as-is from `packages/ui`)

```
packages/ui/src/components/emr/dental/
├── UniversalTooth.vue
├── DentalChartGrid.vue
├── ToothPreviewDialog.vue
├── ToothPreviewDrawer.vue
├── CustomDentalStatusCreateForm.vue
├── CustomDentalStatusEditForm.vue
├── PeriodontalChart.vue
├── types.ts
├── base-types.ts
├── constants.ts
├── overlay-helpers.ts
├── index.ts
├── SURFACE_MAPPING.md
├── assets/
│   ├── teeth/    (64 SVGs)
│   └── overlays/ (~10 SVGs)
├── composables/useToothPreview.ts
├── note-modal/   (whole subdir)
└── note-stepper/ (whole subdir)

packages/ui/src/components/emr/records/dental-note/
├── DentalNoteForm.vue
├── DentalNotePreview.vue
├── ToothSurfaceSelector.vue
├── SurfaceIcdasDialog.vue
├── types.ts
├── constants.ts
└── assets/  (32 surfacemap SVGs)
```

### 12.2 Required app-level files

```
apps/<app>/src/
├── composables/
│   ├── dental.ts                       # useDentalStatus
│   ├── dental.tooth-coloring.ts        # useToothColoring
│   └── emr.dental-encounter-workspace.ts # useDentalEncounterWorkspace
├── utils/
│   ├── dental-surface-mapping.ts
│   ├── dental-svg-ids.ts
│   └── dental-view-correlation.ts
├── types/
│   ├── dental-encounter.ts
│   └── dental-surfaces.ts
└── pages/emr/EncounterRecordsDental.vue
```

### 12.3 Backend contract assumed

The frontend talks to two hapihub services:

| Service | Used for |
|---|---|
| `medical-records` (`useRecords`) | CRUD of `dental-note`, `dental-note/baseline`, `dental-note/order`, `dental-note/result` records |
| `fixtures` (`useDentalStatus`) | List of `type: 'dental-status'` rows scoped by `organization` and/or `account` |

Both are plain CRUD; no custom endpoints required.

### 12.4 Wiring it up

1. Register the route at `/emr/encounters/workspace/records/dental`.
2. The page must be a child of an `EncounterWorkspace` layout that does `provide('encounter-workspace', useEncounterWorkspace(…))`.
3. Add `dental-note/{baseline,order,result}` entries to the layout's `propsByRecordType` so the stepper gets `statusOptions`, `customStatuses`, `diagnosisOptions`, `servicesOptions`.
4. Make sure the SVG modules are processed by Vite (the `import.meta.glob('?raw')` pattern requires Vite — for Webpack you'd need a different loader).
5. Tailwind must process `packages/ui` so the dental component classes are picked up.

---

## 13. Quick reference

### 13.1 Tooth-numbering systems

- **Universal (US, default in this app):** 1–32 for permanent, A–T for deciduous.
- **FDI/ISO (international):** 11–48 for permanent, 51–85 for deciduous. Available via `DENTAL_LAYOUT` but not the chart's default.

### 13.2 Surface vocabulary

| Code | Meaning | Applies to |
|---|---|---|
| `mesial` | toward the midline | all teeth |
| `distal` | away from the midline | all teeth |
| `occlusal` | chewing surface | molars + premolars |
| `incisal` | biting edge | incisors + canines |
| `buccal` | cheek side | posterior teeth |
| `labial` | lip side | anterior teeth |
| `palatal` | palate side | upper teeth |
| `lingual` | tongue side | lower teeth |
| `cervicalbuccal` | gumline cheek | posterior |
| `cervicallabial` | gumline lip | anterior |
| `cervicalpalatal` | gumline palate | upper |
| `cervicallingual` | gumline tongue | lower |

### 13.3 Storybook

Every dental component has a `*.stories.ts` next to it. Run `cd packages/ui && bun run sb:dev` to open Storybook and inspect components in isolation.

---

## 14. Complete SVG / asset inventory

Every SVG in the dental chart feature, with a GitHub link. All paths are under [`packages/ui/src/components/emr/`](https://github.com/mycurelabs/monobase-mycure/tree/main/packages/ui/src/components/emr) unless noted.

### 14.1 Adult tooth SVGs — `column` variant (chart view, 32 files)

Used by `UniversalTooth` when rendered inside `DentalChartGrid`. Multi-angle (front + back + top) anatomical drawing of each tooth. Path: `dental/assets/teeth/tooth-{N}-column.svg`.

| # | File | Tooth (Universal) |
|---|---|---|
| 1 | [tooth-1-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-1-column.svg) | Upper Right 3rd Molar |
| 2 | [tooth-2-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-2-column.svg) | Upper Right 2nd Molar |
| 3 | [tooth-3-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-3-column.svg) | Upper Right 1st Molar |
| 4 | [tooth-4-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-4-column.svg) | Upper Right 2nd Premolar |
| 5 | [tooth-5-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-5-column.svg) | Upper Right 1st Premolar |
| 6 | [tooth-6-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-6-column.svg) | Upper Right Canine |
| 7 | [tooth-7-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-7-column.svg) | Upper Right Lateral Incisor |
| 8 | [tooth-8-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-8-column.svg) | Upper Right Central Incisor |
| 9 | [tooth-9-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-9-column.svg) | Upper Left Central Incisor |
| 10 | [tooth-10-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-10-column.svg) | Upper Left Lateral Incisor |
| 11 | [tooth-11-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-11-column.svg) | Upper Left Canine |
| 12 | [tooth-12-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-12-column.svg) | Upper Left 1st Premolar |
| 13 | [tooth-13-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-13-column.svg) | Upper Left 2nd Premolar |
| 14 | [tooth-14-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-14-column.svg) | Upper Left 1st Molar |
| 15 | [tooth-15-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-15-column.svg) | Upper Left 2nd Molar |
| 16 | [tooth-16-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-16-column.svg) | Upper Left 3rd Molar |
| 17 | [tooth-17-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-17-column.svg) | Lower Left 3rd Molar |
| 18 | [tooth-18-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-18-column.svg) | Lower Left 2nd Molar |
| 19 | [tooth-19-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-19-column.svg) | Lower Left 1st Molar |
| 20 | [tooth-20-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-20-column.svg) | Lower Left 2nd Premolar |
| 21 | [tooth-21-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-21-column.svg) | Lower Left 1st Premolar |
| 22 | [tooth-22-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-22-column.svg) | Lower Left Canine |
| 23 | [tooth-23-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-23-column.svg) | Lower Left Lateral Incisor |
| 24 | [tooth-24-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-24-column.svg) | Lower Left Central Incisor |
| 25 | [tooth-25-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-25-column.svg) | Lower Right Central Incisor |
| 26 | [tooth-26-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-26-column.svg) | Lower Right Lateral Incisor |
| 27 | [tooth-27-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-27-column.svg) | Lower Right Canine |
| 28 | [tooth-28-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-28-column.svg) | Lower Right 1st Premolar |
| 29 | [tooth-29-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-29-column.svg) | Lower Right 2nd Premolar |
| 30 | [tooth-30-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-30-column.svg) | Lower Right 1st Molar |
| 31 | [tooth-31-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-31-column.svg) | Lower Right 2nd Molar |
| 32 | [tooth-32-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-32-column.svg) | Lower Right 3rd Molar |

### 14.2 Adult tooth SVGs — `surfacemap` variant (surface picker, 32 files)

Used by `UniversalTooth` and `ToothSurfaceSelector` when picking surfaces inside the note modal/stepper. Single-angle simplified picker view. Path: `dental/assets/teeth/tooth-{N}-surfacemap.svg`.

| # | File |
|---|---|
| 1 | [tooth-1-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-1-surfacemap.svg) |
| 2 | [tooth-2-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-2-surfacemap.svg) |
| 3 | [tooth-3-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-3-surfacemap.svg) |
| 4 | [tooth-4-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-4-surfacemap.svg) |
| 5 | [tooth-5-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-5-surfacemap.svg) |
| 6 | [tooth-6-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-6-surfacemap.svg) |
| 7 | [tooth-7-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-7-surfacemap.svg) |
| 8 | [tooth-8-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-8-surfacemap.svg) |
| 9 | [tooth-9-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-9-surfacemap.svg) |
| 10 | [tooth-10-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-10-surfacemap.svg) |
| 11 | [tooth-11-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-11-surfacemap.svg) |
| 12 | [tooth-12-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-12-surfacemap.svg) |
| 13 | [tooth-13-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-13-surfacemap.svg) |
| 14 | [tooth-14-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-14-surfacemap.svg) |
| 15 | [tooth-15-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-15-surfacemap.svg) |
| 16 | [tooth-16-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-16-surfacemap.svg) |
| 17 | [tooth-17-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-17-surfacemap.svg) |
| 18 | [tooth-18-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-18-surfacemap.svg) |
| 19 | [tooth-19-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-19-surfacemap.svg) |
| 20 | [tooth-20-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-20-surfacemap.svg) |
| 21 | [tooth-21-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-21-surfacemap.svg) |
| 22 | [tooth-22-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-22-surfacemap.svg) |
| 23 | [tooth-23-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-23-surfacemap.svg) |
| 24 | [tooth-24-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-24-surfacemap.svg) |
| 25 | [tooth-25-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-25-surfacemap.svg) |
| 26 | [tooth-26-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-26-surfacemap.svg) |
| 27 | [tooth-27-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-27-surfacemap.svg) |
| 28 | [tooth-28-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-28-surfacemap.svg) |
| 29 | [tooth-29-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-29-surfacemap.svg) |
| 30 | [tooth-30-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-30-surfacemap.svg) |
| 31 | [tooth-31-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-31-surfacemap.svg) |
| 32 | [tooth-32-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-32-surfacemap.svg) |

### 14.3 Pediatric (deciduous) tooth SVGs — `column` variant (20 files)

Used in the child chart layout. Path: `dental/assets/teeth/tooth-child-{Letter}-column.svg`.

| Letter | File | Tooth |
|---|---|---|
| A | [tooth-child-A-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-A-column.svg) | Upper Right 2nd Deciduous Molar |
| B | [tooth-child-B-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-B-column.svg) | Upper Right 1st Deciduous Molar |
| C | [tooth-child-C-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-C-column.svg) | Upper Right Deciduous Canine |
| D | [tooth-child-D-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-D-column.svg) | Upper Right Deciduous Lateral Incisor |
| E | [tooth-child-E-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-E-column.svg) | Upper Right Deciduous Central Incisor |
| F | [tooth-child-F-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-F-column.svg) | Upper Left Deciduous Central Incisor |
| G | [tooth-child-G-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-G-column.svg) | Upper Left Deciduous Lateral Incisor |
| H | [tooth-child-H-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-H-column.svg) | Upper Left Deciduous Canine |
| I | [tooth-child-I-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-I-column.svg) | Upper Left 1st Deciduous Molar |
| J | [tooth-child-J-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-J-column.svg) | Upper Left 2nd Deciduous Molar |
| K | [tooth-child-K-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-K-column.svg) | Lower Left 2nd Deciduous Molar |
| L | [tooth-child-L-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-L-column.svg) | Lower Left 1st Deciduous Molar |
| M | [tooth-child-M-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-M-column.svg) | Lower Left Deciduous Canine |
| N | [tooth-child-N-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-N-column.svg) | Lower Left Deciduous Lateral Incisor |
| O | [tooth-child-O-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-O-column.svg) | Lower Left Deciduous Central Incisor |
| P | [tooth-child-P-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-P-column.svg) | Lower Right Deciduous Central Incisor |
| Q | [tooth-child-Q-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-Q-column.svg) | Lower Right Deciduous Lateral Incisor |
| R | [tooth-child-R-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-R-column.svg) | Lower Right Deciduous Canine |
| S | [tooth-child-S-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-S-column.svg) | Lower Right 1st Deciduous Molar |
| T | [tooth-child-T-column.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-T-column.svg) | Lower Right 2nd Deciduous Molar |

### 14.4 Pediatric tooth SVGs — `surfacemap` variant (20 files)

Path: `dental/assets/teeth/tooth-child-{Letter}-surfacemap.svg`.

| Letter | File |
|---|---|
| A | [tooth-child-A-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-A-surfacemap.svg) |
| B | [tooth-child-B-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-B-surfacemap.svg) |
| C | [tooth-child-C-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-C-surfacemap.svg) |
| D | [tooth-child-D-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-D-surfacemap.svg) |
| E | [tooth-child-E-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-E-surfacemap.svg) |
| F | [tooth-child-F-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-F-surfacemap.svg) |
| G | [tooth-child-G-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-G-surfacemap.svg) |
| H | [tooth-child-H-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-H-surfacemap.svg) |
| I | [tooth-child-I-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-I-surfacemap.svg) |
| J | [tooth-child-J-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-J-surfacemap.svg) |
| K | [tooth-child-K-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-K-surfacemap.svg) |
| L | [tooth-child-L-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-L-surfacemap.svg) |
| M | [tooth-child-M-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-M-surfacemap.svg) |
| N | [tooth-child-N-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-N-surfacemap.svg) |
| O | [tooth-child-O-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-O-surfacemap.svg) |
| P | [tooth-child-P-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-P-surfacemap.svg) |
| Q | [tooth-child-Q-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-Q-surfacemap.svg) |
| R | [tooth-child-R-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-R-surfacemap.svg) |
| S | [tooth-child-S-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-S-surfacemap.svg) |
| T | [tooth-child-T-surfacemap.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/teeth/tooth-child-T-surfacemap.svg) |

### 14.5 Overlay SVGs (10 files)

Drawn on top of `UniversalTooth` for whole-tooth statuses that have a glyph (X for extracted, slash for missing, etc.). Loaded via `import.meta.glob('?raw', eager: true)` in `overlay-helpers.ts`. Path: `dental/assets/overlays/{statusType}.svg`.

| Status type | File |
|---|---|
| `denture` | [denture.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/overlays/denture.svg) |
| `extraction-caries` | [extraction-caries.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/overlays/extraction-caries.svg) |
| `extraction-indicated` | [extraction-indicated.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/overlays/extraction-indicated.svg) |
| `extraction-other` | [extraction-other.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/overlays/extraction-other.svg) |
| `impacted` | [impacted.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/overlays/impacted.svg) |
| `missing-caries` | [missing-caries.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/overlays/missing-caries.svg) |
| `missing-congenital` | [missing-congenital.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/overlays/missing-congenital.svg) |
| `missing-other` | [missing-other.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/overlays/missing-other.svg) |
| `root-fragment` | [root-fragment.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/overlays/root-fragment.svg) |
| `supernumerary` | [supernumerary.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/dental/assets/overlays/supernumerary.svg) |

### 14.6 Dental-note record assets — surface picker (33 files)

A *separate* set of surfacemap SVGs lives next to the legacy `DentalNoteForm` / `ToothSurfaceSelector` (the classic single-step form, distinct from the new note-modal/note-stepper flow). Path: `records/dental-note/assets/`.

| File | Purpose |
|---|---|
| [tooth-surfaces.svg](https://github.com/mycurelabs/monobase-mycure/blob/main/packages/ui/src/components/emr/records/dental-note/assets/tooth-surfaces.svg) | Generic surface map (used as fallback) |
| tooth-{1..32}-surfacemap.svg (32 files) | Per-tooth surface map — see [folder](https://github.com/mycurelabs/monobase-mycure/tree/main/packages/ui/src/components/emr/records/dental-note/assets) |

> These are similar in purpose to §14.2 but are anchored to the legacy `DentalNoteForm`. The newer note-modal/note-stepper flow uses §14.2 SVGs.

### 14.7 Legacy parent assets (used by `Tooth.vue` / `ToothAdvanced.vue`)

`packages/ui/src/components/emr/dental/assets/` (parent folder, before the `teeth/` subfolder) holds **107 legacy SVGs** consumed by the deprecated `Tooth.vue` and `ToothAdvanced.vue` components. They are kept for backward-compat with screens that still use the old chart. Naming uses the **FDI/ISO numbering** (11–48 + 51–85), not Universal.

| Pattern | Count | Purpose |
|---|---|---|
| `inner_{FDI}.svg` | ~52 | Lingual/palatal view of each tooth |
| `outer_{FDI}.svg` | ~52 | Buccal/labial view of each tooth |
| `incisor.svg`, `molar.svg` | 2 | Generic shapes for fallback |

Folder: [`packages/ui/src/components/emr/dental/assets`](https://github.com/mycurelabs/monobase-mycure/tree/main/packages/ui/src/components/emr/dental/assets).

> **The active dental chart does NOT use these.** They can be omitted when porting to a new app unless you need the old `Tooth.vue` component.

### 14.8 Asset summary

| Set | Count | Used by | Required? |
|---|---|---|---|
| Adult `column` | 32 | `UniversalTooth` (chart) | ✅ required |
| Adult `surfacemap` | 32 | `UniversalTooth` (picker) + `ToothSurfaceSelector` | ✅ required |
| Pediatric `column` | 20 | `UniversalTooth` (child chart) | ✅ required |
| Pediatric `surfacemap` | 20 | `UniversalTooth` (child picker) | ✅ required |
| Overlays | 10 | `UniversalTooth` (overlay layer) | ✅ required |
| dental-note records assets | 33 | Legacy `DentalNoteForm` | ⚠️ only for legacy form |
| Legacy `inner_*` / `outer_*` | ~107 | Legacy `Tooth.vue` / `ToothAdvanced.vue` | ⚠️ deprecated |
| **Total active assets** | **114** | | |
| **Total in repo (incl. legacy)** | **~254** | | |

---

## 15. Appendix — file size reference

| File | Size | Purpose |
|---|---|---|
| `EncounterRecordsDental.vue` | ~13 KB | Page shell |
| `DentalChartGrid.vue` | ~17 KB | Grid + coloring orchestration |
| `UniversalTooth.vue` | ~12 KB | Per-tooth SVG renderer |
| `DentalNoteStepper.vue` | ~19 KB | 3-step wizard |
| `types.ts` (dental) | ~28 KB | Tooth maps + SVG ID transforms |
| `constants.ts` (dental) | ~22 KB | Status types, colors, layouts |
| `emr.dental-encounter-workspace.ts` | ~14 KB | Encounter composable |
| `dental.tooth-coloring.ts` | ~7 KB | Programmatic coloring |
| Each tooth SVG | 8–40 KB | Anatomical paths |

---

**Maintainer notes**

- The components in `packages/ui/src/components/emr/dental/` are **kept byte-identical with `dentalemon`** wherever possible. If you change them, sync the changes (or document the divergence).
- The migration source-of-truth is the dentalemon repo's `packages/ui-mobile/src/components/emr/dental/`. See [`docs/dental-chart-migration-prd.md`](https://github.com/mycurelabs/monobase-mycure/blob/main/apps/mycure/docs/dental-chart-migration-prd.md).
- Tailwind classes appear inside both the page and the chart components — make sure the package's source path is in your Tailwind `content` glob.
