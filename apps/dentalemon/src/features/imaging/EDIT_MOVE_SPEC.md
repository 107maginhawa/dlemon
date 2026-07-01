# Spec — annotation edit / move, and capture-date (design only, NOT built)

Companion to the shipped select/remove/save UX. This documents the next tracks and the
backend they require. Nothing here is implemented.

## 1. In-place edit & move

Builds on the shipped **Select** mode. Once an annotation is selected, add:

### Interactions
- **Move (all types):** drag the selected annotation's body to reposition. Pointer/touch
  drag updates geometry live; commit on pointer-up. Mirrors the existing ceph-landmark
  drag (`use-ceph-landmarks.ts` `dragLandmark`/`commitLandmark`: local-optimistic during
  drag, PATCH once on release) — reuse that pattern, don't invent a new one.
- **Resize (shape):** drag corner handles on the selected rect (2–4 handles ≥44px).
- **Re-type (label):** an "Edit text" button in the action bar (pencil) reopens
  `AnnotationInputDialog` prefilled; confirm PATCHes the new text.
- **Re-number (tooth):** same dialog in tooth mode, prefilled.
- Keyboard: arrow keys nudge the selected annotation 1px (again mirrors ceph landmark
  `arrowDelta`).

### Action-bar additions
Add a **Pencil** (edit) button beside Delete for `label`/`tooth`. Move/resize are direct
drag, no button.

### Required backend — `updateMeasurement` PATCH (does not exist)
```
PATCH /dental/imaging/measurements/{measurementId}
body: { geometry?, measurementValue?, measurementUnit?, visible? }   // all optional
→ 200 ImagingAnnotation | 404 | 403 (branch role, same as create/delete) | 422 (geometry)
```
- Reuse `createMeasurement`'s Zod geometry union + `TYPE_MAP` for validation; type is
  immutable (a label stays a label) — only geometry/value/unit/visible change.
- Repo: `updateAnnotation(id, patch)` next to the existing `createAnnotation` /
  `deleteAnnotation` in `imaging.repo.ts`; audit it like create (`imaging_annotation.update`).
- Recompute `measurementValue` server-side for distance/angle/area on geometry change so a
  moved ruler stays truthful (or require the client to send the recomputed value + unit).
- SDK regenerates from TypeSpec (`dental-imaging.tsp`) → adds `imagingMgmtUpdateMeasurement`.
- Frontend hook: add `updateMeasurement` mutation to `use-measurements.ts` with the same
  optimistic `{ items }` cache pattern as create/delete.

### Tests to add (Vertical TDD)
- Backend: `updateMeasurement` handler + repo (real-DB integration): geometry patch, value
  recompute, 403/404/422, audit row.
- Frontend unit: optimistic move/resize reducer + rollback.
- E2E: select → drag to move → persists; select label → edit text → persists.

### Effort
Small–medium. One endpoint + repo method + SDK regen + one hook mutation + drag handlers.
The drag/keyboard interaction is the larger half; the API is a thin PATCH.

## 2. Capture-date vs timeline (separate data track)

Today `imaging_study` has **no acquisition-date field** — only `createdAt` (upload time).
So an X-ray placed on the patient timeline sits at *upload* time unless the study is linked
to a visit (`visitId`, nullable) whose date it then follows. Annotating never changes this.

**Gap:** a radiograph taken weeks before it's uploaded shows at the wrong point on the
timeline. **Data need (decide before building):**
- Add `capturedAt timestamp` (nullable) to `imaging_study`; default to `createdAt` when
  absent; let the upload form + metadata editor set it.
- Timeline reads `capturedAt ?? visit.date ?? createdAt`.
- Migration + backfill (existing rows: `capturedAt = createdAt`).

Out of scope for the annotation UX; flagged for a product/data decision. Do NOT build
without sign-off (schema change).
