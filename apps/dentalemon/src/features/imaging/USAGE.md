# Imaging viewer — tool usage guide (grounded in code)

Scope: the radiograph viewer in `apps/dentalemon/src/features/imaging`. Every claim cites `file:line`.
The one reducer that turns a canvas click into an action is `processToolClick` in
`components/imaging-workspace.handlers.ts:82`. **All tools use discrete clicks on the SVG overlay —
there is NO drag-to-draw anywhere.** The overlay wires only `onClick` (`imaging-workspace.tsx:480`),
so a click-drag fires one click and draws nothing. That is the source of "how do I draw a line?".

## Annotation tools (`components/annotation-toolbar.tsx`)

| Tool | Gesture | Produces |
|------|---------|----------|
| **Label** | **Single click** → text dialog opens; type ≤200 chars, confirm | Gold `<text>` at the point; measurement `type:'label'`. `handlers.ts:149`, `annotation-input-dialog.tsx`, `buildLabelMeasurement handlers.ts:199` |
| **Arrow** | **Two clicks** — click start, click end (not a drag) | Solid line + arrowhead (`<line marker-end="url(#arrowhead)">`); `type:'arrow'` `{from,to}`. `handlers.ts:152-160`, render `canvas-overlays.tsx:167` |
| **Freehand** | **Click each vertex, then DOUBLE-CLICK to finish** (needs ≥2 pts; double-click detected via `e.detail===2` `imaging-workspace.tsx:271`) | Open polyline; `type:'freehand'`. Duplicated final point is dropped. `handlers.ts:163-174`, render `canvas-overlays.tsx:195` |
| **Shape** | **Two clicks** — corner, opposite corner | Axis-aligned rectangle (`shapeType` hard-coded `'rect'` `handlers.ts:186`; ellipse renderer exists `canvas-overlays.tsx:257` but is unreachable from the UI). `type:'shape'` |
| **Tooth** | **Single click** → number dialog; enter integer 1–32 | Circle badge with the tooth number; `type:'tooth'`. `handlers.ts:150,208`. **Note:** this is a numbered annotation only — it does **not** create/link an imaging *Finding* record (that is the separate Findings sidebar). |

There is **no plain "Line" tool** — a line without an arrowhead only exists as the **Distance** measurement.

## Calibrate → Distance / Angle / Area (`components/measurement-toolbar.tsx`)

- **Calibrate** — **two clicks** across a known-length object → dialog asks the real length in mm.
  Stores `pixelSpacingMm = actualMm / pixelDistance` (mm-per-pixel), PATCHed and kept only on success.
  `handlers.ts:33-50,93-100`, `calibration-dialog.tsx`, `imaging-workspace.tsx:343-364`.
- **Distance** — two clicks → straight line; value = `dist_px × pixelSpacingMm` (mm) or raw px. `handlers.ts:102-115`.
- **Angle** — **three clicks**, vertex is the 2nd; value = `computeAngleDeg` (`geometry.ts:12`), always **deg**. `handlers.ts:117-129`.
- **Area** — click polygon vertices, **double-click to close** (≥3 pts); shoelace area × `pixelSpacingMm²`. `handlers.ts:131-147`.

**Why Distance & Area are disabled until calibrated:** they emit physical `mm`/`mm²`. `CALIBRATION_REQUIRED_TOOLS`
= distance + area (`measurement-toolbar.tsx:9`); the button is `disabled`/`aria-disabled` and the handler returns
early when `!isCalibrated` (`measurement-toolbar.tsx:36,48-59`) so it "never silently falls back to px" for a clinical
value. `isCalibrated = Boolean(pixelSpacingMm)` (`imaging-workspace.tsx:418`). **Angle is exempt** — degrees need no scale.

## Findings panel (`components/FindingsSidebar.tsx`, hook `hooks/use-imaging-findings.ts`)

Right-side sidebar attached to one image (`imageId`). Create form: 5 quick-select type chips
(Caries/Bone Loss/Periapical/Calculus/Root Fracture `FindingsSidebar.tsx:38-44`), 15-entry type dropdown,
status (draft/confirmed/resolved), **optional** Tooth # input (min 1/max 32), surfaces, note. CRUD hits
`/dental/imaging/images/{imageId}/findings` (`use-imaging-findings.ts:88-196`). Status cycles forward-only
draft→confirmed→resolved (`FindingsSidebar.tsx:49-53`).

**Finding → tooth linkage:** the imaging finding's tooth number is an **optional, manually typed** attribute
(`toothNumber: number | null`, sent only when non-null, shown as `#N` when present — `FindingsSidebar.tsx:108,310`).
A second, distinct **workspace** Findings panel (`features/workspace/components/findings-panel.tsx`) is bound to a
specific tooth via a **required** `toothNumber` prop and filters the visit's findings to that tooth
(`use-findings.ts:68`) — that one is intrinsically tooth-scoped and supports finding→treatment conversion.

## Cephalometric tracing — does it exist? **YES, fully.**

Not a stub. Complete, wired end-to-end and backed by `@monobase/ceph-math`:
landmark placement/drag/commit/batch/delete/AI-detect (`hooks/use-ceph-landmarks.ts`), 16-landmark palette,
tracing overlay + angle arcs (`components/CephTracingOverlay.tsx`, `CephAngleArcLayer.tsx`, `lib/ceph-geometry.ts`),
6-protocol analysis (`hooks/use-ceph-analysis.ts`, `CephMeasurementsPanel.tsx`), report gate + immutable snapshot
(`CephWorkspacePanel.tsx`, `CephReportView.tsx`), and S–N v1 superimposition (`hooks/use-ceph-superimposition.ts`).
**Gated OFF by default** behind the `workspace.ceph` build-time feature flag (`lib/feature-flags.ts:31,43`); the
single UI gate is `isCeph` at `imaging-workspace.tsx:110`. Runtime also enforces addon-tier (403 `IMAGING_TIER_REQUIRED`).
Honest v1 scope limits: superimposition is cranial-base-only (`use-ceph-superimposition.ts:8`); some report items marked
deferred v1.5/v2 (`CephReportView.tsx:330`). **Nothing to build here.**
