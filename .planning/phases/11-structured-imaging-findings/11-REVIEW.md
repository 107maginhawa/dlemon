---
phase: 11-structured-imaging-findings
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts
  - services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.repo.ts
  - services/api-ts/src/handlers/dental-imaging/createFinding.ts
  - services/api-ts/src/handlers/dental-imaging/listFindings.ts
  - services/api-ts/src/handlers/dental-imaging/updateFinding.ts
  - services/api-ts/src/handlers/dental-imaging/deleteFinding.ts
  - apps/dentalemon/src/features/imaging/hooks/use-imaging-findings.ts
  - apps/dentalemon/src/features/imaging/components/FindingsSidebar.tsx
  - apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx
findings:
  critical: 5
  warning: 5
  info: 3
  total: 13
status: issues_found
---

# Phase 11: Structured Imaging Findings — Code Review Report

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The backend auth chain is structurally sound — every mutating handler walks finding→image→study→assertBranchAccess before acting. However, there are five critical-severity defects: two authorization bypasses (IDOR on create, unvalidated patient/visit/branch IDs from client), one complete missing security check on calibration PATCH, one missing index that makes patient-scoped queries impossible, and one type enum mismatch between frontend and backend that will produce runtime 422 errors. Five additional warnings cover quality issues including a no-op `as any` cast, missing error handling, and a dangerous `window.prompt()` UX anti-pattern in a clinical tool.

---

## Critical Issues

### CR-01: IDOR — createFinding accepts caller-supplied patientId/visitId/branchId without validation

**File:** `services/api-ts/src/handlers/dental-imaging/createFinding.ts:59-71`

**Issue:** The handler verifies the caller has access to `study.branchId`, then overwrites `branchId` with the study's authoritative value (correct). However, `patientId` and `visitId` are taken **directly from the request body** (`parsed.visitId`, `parsed.patientId`) with zero cross-check against the image/study chain. A user with access to branch A can create a finding that `patientId`-references any arbitrary patient UUID, including patients in other branches. Downstream queries filtering by `patient_id` will surface those findings to the wrong patient's record.

**Fix:**
```typescript
// After resolving study, derive patientId and visitId from the study record,
// not from the request body.
const finding = await findingRepo.create({
  imageId,
  annotationId: parsed.annotationId ?? null,
  treatmentId: parsed.treatmentId ?? null,
  visitId: study.visitId,        // authoritative — not parsed.visitId
  patientId: study.patientId,    // authoritative — not parsed.patientId
  branchId: study.branchId,
  type: parsed.type,
  status: parsed.status ?? 'suspected',
  toothNumber: parsed.toothNumber ?? null,
  surfaces: parsed.surfaces ?? null,
  note: parsed.note ?? null,
});
```
If `visitId`/`patientId` don't exist on the study model, add them there; they are already denormalized on the finding schema, so the source of truth must be a trusted server-side lookup, not client input.

---

### CR-02: Missing auth on calibration PATCH in imaging-workspace

**File:** `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx:800-804`

**Issue:** `handleCalibrationConfirm` issues `PATCH /dental/imaging/images/:imageId/calibration` directly from the frontend with no auth token and no error handling. This endpoint is presumably auth-guarded on the server, but the client never surfaces failures — `await fetch(...)` result is silently discarded. If the request fails (unauthorized, network error, server error), `setInternalPixelSpacingMm` is still called, leading the UI to display pixel spacing values that were never persisted. Clinical measurements derived from a stale/wrong calibration are a patient safety issue.

**Fix:**
```typescript
const handleCalibrationConfirm = useCallback(
  async (actualMm: number) => {
    if (calibrationPixelDist <= 0 || actualMm <= 0) return
    const pxMm = actualMm / calibrationPixelDist
    const res = await fetch(`/dental/imaging/images/${imageId}/calibration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pixelSpacingMm: pxMm }),
    })
    if (!res.ok) {
      // surface error to user — do NOT update local state
      console.error('Calibration save failed', res.status)
      return
    }
    setInternalPixelSpacingMm(pxMm)
    onCalibrationSaved?.(pxMm)
    setCalibrationOpen(false)
    setDrawPoints([])
    setToolMode('none')
  },
  [calibrationPixelDist, imageId, onCalibrationSaved],
)
```

---

### CR-03: Frontend type enum diverges from backend — runtime 422 on valid UI selections

**File:** `apps/dentalemon/src/features/imaging/hooks/use-imaging-findings.ts:3-18`

**Issue:** `ImagingFindingType` in the hook contains values that do **not exist** in the backend `imagingFindingTypeEnum`, and is **missing** values the backend accepts. Mismatches:

| Frontend only (will 422) | Backend only (unreachable from UI) |
|---|---|
| `impaction` | `impacted_tooth` |
| `resorption` | `root_resorption` |
| `open_margin` | `open_contact` |
| `perforation` | `over_eruption` |
| `pulp_calcification` | `crown_needed` |
| `other` | `implant_needed` |

Any user selecting `impaction`, `resorption`, `open_margin`, `perforation`, `pulp_calcification`, or `other` in the UI will receive a server validation error. The `FINDING_TYPE_LABELS` map in `FindingsSidebar.tsx` (line 18-34) uses the frontend enum, so the mismatch is doubled.

**Fix:** Derive the frontend enum from the generated OpenAPI types (`@monobase/api-spec`) per the project's API-first contract, or at minimum align manually:

```typescript
export type ImagingFindingType =
  | 'caries'
  | 'secondary_caries'
  | 'bone_loss'
  | 'furcation_involvement'
  | 'periapical_lesion'
  | 'root_resorption'
  | 'calculus'
  | 'crown_fracture'
  | 'root_fracture'
  | 'impacted_tooth'
  | 'over_eruption'
  | 'open_contact'
  | 'overhang'
  | 'crown_needed'
  | 'implant_needed'
```

Update `FINDING_TYPE_LABELS` in `FindingsSidebar.tsx` to match.

---

### CR-04: Missing patient/branch index — patient-scoped finding queries do full table scan and return wrong data

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:61-63`

**Issue:** The only index is `(image_id, status)`. The `patient_id` and `branch_id` columns are denormalized onto every row (by design for cross-module lookup), but there is no index on either. Any future handler or report query filtering findings by patient (a standard clinical workflow: "show all findings for patient X") will do a sequential scan. More critically, `listByImage` in the repo does not filter by `branchId` or `patientId`, so **any caller who can supply an `imageId` gets all findings for that image regardless of patient context**. At minimum an index on `patient_id` is required for correctness of future patient-timeline queries, and `listByImage` should be gated by branch.

**Fix:**
```typescript
(table) => ({
  imageStatusIdx: index('imaging_finding_image_status_idx').on(table.imageId, table.status),
  patientIdx: index('imaging_finding_patient_idx').on(table.patientId, table.branchId),
})
```

---

### CR-05: `window.prompt()` used for clinical data entry — blocks thread and has no XSS-safe path

**File:** `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx:704, 721`

**Issue:** Label text and tooth number are collected via `window.prompt()`. This is a BLOCKER for two reasons:

1. **Security**: The `text` returned by `window.prompt()` is sliced at 200 chars and sent to the server, but the slice does not strip HTML or script content. The server stores it in a `text` column and it will be rendered by `FindingsSidebar` inside a React text node (safe), but if any other consumer renders `annotation.geometry.text` as `innerHTML` the stored prompt value is an injection vector. More practically, `window.prompt()` is blocked by browsers in many embedded/fullscreen contexts and cannot be unit-tested or themed.

2. **Clinical UX**: Modal browser dialogs block the entire JS thread. In a clinical imaging context where the canvas is processing, this is unacceptable and was flagged as a pattern to avoid in project memory.

**Fix:** Replace both `window.prompt()` calls with an inline popover or modal form using Radix `Dialog` or a floating input, matching the existing `CalibrationDialog` pattern already used in this component.

---

## Warnings

### WR-01: `updateFinding` repo uses `as any` cast, bypassing type safety

**File:** `services/api-ts/src/handlers/dental-imaging/updateFinding.ts:68`

**Issue:** `findingRepo.update(findingId, updateData as any)` casts `Record<string, unknown>` to `any` to satisfy `Partial<NewImagingFinding>`. This is a workaround for manually building the update payload and means the compiler cannot catch typos in field names (e.g., `treatmentId` vs `treatment_id`).

**Fix:** Build the update payload as typed `Partial<NewImagingFinding>` directly:
```typescript
const updateData: Partial<NewImagingFinding> = {}
if (parsed.type !== undefined) updateData.type = parsed.type
if (parsed.status !== undefined) updateData.status = parsed.status
if (parsed.toothNumber !== undefined) updateData.toothNumber = parsed.toothNumber
if (parsed.surfaces !== undefined) updateData.surfaces = parsed.surfaces
if (parsed.note !== undefined) updateData.note = parsed.note
if (parsed.treatmentId !== undefined) updateData.treatmentId = parsed.treatmentId
const updated = await findingRepo.update(findingId, updateData)
```

---

### WR-02: `ImagingFindingRepository.delete` gives no signal if row was not found

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.repo.ts:47-49`

**Issue:** `delete` issues a `DELETE WHERE id = ?` and returns `void` regardless of whether any row was matched. The handler calls `findById` first (two round trips), but between the `findById` and the `delete` there is a TOCTOU window — another request could delete the same finding. The second delete silently succeeds returning 204, masking the race. Drizzle supports `.returning()` on delete.

**Fix:**
```typescript
async delete(id: string): Promise<boolean> {
  const result = await this.db
    .delete(imagingFindings)
    .where(eq(imagingFindings.id, id))
    .returning({ id: imagingFindings.id })
  return result.length > 0
}
```
Handler should check the return value and throw `NotFoundError` if false.

---

### WR-03: `listByImage` has no branch-scope guard — cross-branch image ID leak

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.repo.ts:31-35`

**Issue:** `listByImage` filters only on `imageId`. If a caller somehow supplies an image ID from another branch (possible if image IDs are sequential or guessable), the handler's `assertBranchAccess` check in `listFindings.ts` is the only guard. The repo itself should enforce branch scope as a defense-in-depth measure.

**Fix:**
```typescript
async listByImage(imageId: string, branchId: string): Promise<ImagingFinding[]> {
  return this.db
    .select()
    .from(imagingFindings)
    .where(and(eq(imagingFindings.imageId, imageId), eq(imagingFindings.branchId, branchId)))
}
```

---

### WR-04: `selectedAnnotationId` is not reset when findings panel closes

**File:** `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx:510, 957-960`

**Issue:** When an annotation is clicked, `selectedAnnotationId` is set and the findings panel opens. When the panel is closed and then reopened via the toolbar button (not via annotation click), `selectedAnnotationId` still holds the previous annotation ID and is passed as `initialAnnotationId` to `FindingsSidebar`. This means a new finding will be pre-linked to a stale annotation the user did not intend to select.

**Fix:**
```typescript
onClose={() => {
  setFindingsPanelOpen(false)
  setSelectedAnnotationId(null)  // clear stale association
}}
```
Also reset `selectedAnnotationId` when the toolbar Findings button opens the panel without annotation context.

---

### WR-05: `CreateFindingSchema` does not validate UUID format for relational IDs

**File:** `services/api-ts/src/handlers/dental-imaging/createFinding.ts:19-35`

**Issue:** `annotationId`, `treatmentId`, `visitId`, `patientId`, `branchId` are validated as `z.string()` only. Invalid non-UUID strings will be written into UUID columns, causing a Postgres error that will surface as an unhandled 500 rather than a clean 422.

**Fix:**
```typescript
annotationId: z.string().uuid().optional(),
treatmentId: z.string().uuid().optional(),
visitId: z.string().uuid(),
patientId: z.string().uuid(),
branchId: z.string().uuid(),
```
Apply same fix to `UpdateFindingSchema.treatmentId`.

---

## Info

### IN-01: `toothNumber` has no range validation on the backend

**File:** `services/api-ts/src/handlers/dental-imaging/createFinding.ts:27`

**Issue:** Frontend enforces `min=1 max=32` on the input element (line 227 of `FindingsSidebar.tsx`), but the server schema accepts any integer. A client sending `toothNumber: 9999` will persist invalid data.

**Fix:**
```typescript
toothNumber: z.number().int().min(1).max(32).optional(),
```

---

### IN-02: `staleTime: 30_000` may show stale findings after another user's mutation

**File:** `apps/dentalemon/src/features/imaging/hooks/use-imaging-findings.ts:74`

**Issue:** Findings are clinical records. A 30-second stale window means two clinicians reviewing the same image in different tabs won't see each other's findings for up to 30 seconds. Consider `staleTime: 0` or a shorter value for clinical data, or add a WebSocket/polling invalidation strategy.

---

### IN-03: `surfaces` field accepts arbitrary strings — no controlled vocabulary

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:58`

**Issue:** `surfaces` is stored as `jsonb string[]` with no validation of allowed surface names (e.g., `occlusal`, `mesial`, `distal`, `buccal`, `lingual`). The frontend uses a free-text comma-separated input. Without an enum or allowlist, data quality for surfaces will degrade over time (e.g., `"oc"`, `"Occlusal"`, `"occlusal "` all treated as distinct values).

**Fix:** Define a `surfaceEnum` in the schema and validate in the Zod schema:
```typescript
const TOOTH_SURFACES = ['occlusal', 'mesial', 'distal', 'buccal', 'lingual', 'incisal', 'palatal'] as const
// In Zod:
surfaces: z.array(z.enum(TOOTH_SURFACES)).optional()
```

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
