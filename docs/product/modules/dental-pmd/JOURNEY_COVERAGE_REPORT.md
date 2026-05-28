<!-- oli-ui-journey: v1.0 | generated: 2026-05-27 | skill: oli-ui-journey | module: dental-pmd -->

# Journey Coverage Report — dental-pmd

**Skill:** oli-ui-journey  
**Module:** dental-pmd  
**Reviewed:** 2026-05-27  
**Depth:** standard  
**Status:** GAPS_FOUND

---

## Executive Summary

The dental-pmd frontend implementation covers the in-workspace PMD viewer sheet and the external PMD import form. Both components are functional at a surface level. However, significant portions of the specified journey are absent: there is no standalone PMD list screen, no Generate PMD dialog, no file-upload-based import (only raw JSON paste), no checksum verification UI, no PDF download flow, and the viewer omits required data fields. Several business-rule invariants (BR-021, BR-022) are untested in the UI layer. The implementation is incomplete for V1 production readiness as defined by MODULE_SPEC §9–§10 and the ui-prototype specification.

---

## Journey Map

### WF-021: Generate PMD

| Step | Specified | Implemented | Status |
|------|-----------|-------------|--------|
| User opens completed visit | Workspace route loads visit | Workspace loads visits | COVERED |
| User triggers "Generate PMD" | `GeneratePMDDialog` with visit eligibility check | `handleSharePMD` in `$patientId.tsx` — calls `useSharePMD` mutation (POST) | PARTIAL |
| Eligibility gate: visit must be completed | Dialog disables CTA when `status !== 'completed'` or SOAP unsigned | `handleSharePMD` has no client-side eligibility check — fires unconditionally when `currentVisitId != null` | GAP |
| In-progress state | Spinner overlay inside dialog | No loading indicator shown; `sharePMDMutation.isPending` is unused in UI | GAP |
| Success state | Dialog shows "Download Now" + "View PMD" | `setPmdShared(true)` sets a boolean; only renders text "✓ PMD shared" | GAP |
| Error state | Inline error in dialog | `console.error` only; no user-visible error | BLOCKER |
| Already-exists guard | "A PMD already exists" state with link | Not implemented | GAP |
| Navigator.share unavailable fallback | `setPmdShared(true)` (no feedback when share fails silently) | Partially covered; no download fallback | GAP |

### WF-022: Import External PMD

| Step | Specified | Implemented | Status |
|------|-----------|-------------|--------|
| Open import dialog | `ImportPMDDialog` (Radix modal) | `PMDImport` bottom sheet | PARTIAL |
| File upload (drag-drop, .json or .pdf, max 25 MB) | File dropzone with type + size validation | Raw JSON textarea — no file upload at all | BLOCKER |
| Checksum verification on upload | Client extracts hash, calls server verify, shows badge | Not implemented; no checksum field in POST body | BLOCKER |
| Checksum mismatch warning + "Import as Unverified" CTA | Orange callout + secondary CTA | Not implemented | GAP |
| Source system field (required per §7.2 item 5) | `source_system` required input | Field named `sourceFacility` (maps OK), but `source_description` field in MODULE_SPEC §7.2 is never sent — only `sourceFacility` alias | WARNING |
| `received_date` / `DatePicker` | Required, default today | Not in form | GAP |
| Preview step | Parsed JSON preview / PDF preview iframe | Safety Floor preview only (conditions, medications, allergies extraction) | PARTIAL |
| Confirm import | POST with validated payload | POST fires but body sends `sourceFacility`/`sourceReference`/`content` — missing `checksum` field (§7.2 item 4: required by server) | BLOCKER |
| Success state | Dialog closes, toast, list refetch | `setStep('done')` inline — no query invalidation, no toast | WARNING |
| Error handling | Inline error inside dialog, step preserved | Sets `errors` state but resets to `form` step, discarding user input | WARNING |
| `onImported(pmdId)` callback with pmdId | `onImported(pmdId: string)` | `PMDImportProps.onImported` has no argument; pmdId never returned from server response | WARNING |

### WF-066 (Inferred): View / Download PMD

| Step | Specified | Implemented | Status |
|------|-----------|-------------|--------|
| PMD list screen per patient | `/patients/:id/pmds` route, two-section table | No such route exists | BLOCKER |
| Generated PMDs section | `PMDListTable` with visit_date, generated_at, generated_by, checksum_status, download | Not implemented | BLOCKER |
| Imported PMDs section | `PMDListTable` with source_system, record_date, checksum_status, download | Not implemented | BLOCKER |
| PMD detail/preview page | `/patients/:id/pmds/:id` full-page read-only doc | Not implemented | BLOCKER |
| View PMD in workspace | `PMDViewerSheet` (Shadcn Sheet) | Implemented — visit-scoped viewer | COVERED |
| Visit date in viewer | `PMDPreviewDocument` includes `visitDate` | `content.visitDate` optional field rendered only if present (no explicit field shown in viewer UI) | GAP |
| Download PMD | `PMDDownloadButton` → GET signed URL | "Download" in viewer sheet — not implemented; `PMDViewerSheet` has no download button | BLOCKER |
| `ImportedReadOnlyBanner` on imported PMDs | Shows "Imported from X on Y. Read-only." | Not shown in viewer | GAP |
| Patient role: download own PMDs only | Role-gated columns in `PMDListTable` | Role-gating not present anywhere in frontend | GAP |
| Checksum verification panel | `PMDVerificationPanel` with Re-verify button | Shows raw checksum hash only (`SHA: {checksum}`); no Re-verify capability | GAP |
| Empty state | Spec text + illustration | `PMDViewerSheet` shows "No PMD document for this visit" text only | PARTIAL |
| Loading skeleton | 5-row shimmer | `usePMD` hook exposes `isLoading` but `PMDViewerSheet` passes `pmd={currentPMD ?? null}` — no loading state rendered in the sheet | GAP |

---

## Blocker Findings

### BL-01: Checksum Missing from Import POST Body

**File:** `apps/dentalemon/src/features/pmd/components/pmd-import.tsx:74`  
**Issue:** The `handleConfirm()` function submits `patientId`, `sourceFacility`, `sourceReference`, and `content` but omits `checksum`. MODULE_SPEC §7.2 item 4 states: "import must provide a checksum field; server verifies it against the uploaded content before creating the row. Missing or mismatched checksum → 422 CHECKSUM_MISMATCH." Every import attempt will receive a 422 response from a compliant server.  
**Fix:** Compute a SHA-256 hash of `content` on the client before submission and include it in the body:
```typescript
// Before fetch call in handleConfirm:
const encoder = new TextEncoder();
const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(content.trim()));
const hashArray = Array.from(new Uint8Array(hashBuffer));
const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

body: JSON.stringify({
  patientId,
  sourceFacility: sourceFacility.trim(),
  sourceReference: sourceReference.trim() || undefined,
  content: content.trim(),
  checksum,  // ADD THIS
}),
```

### BL-02: No File Upload — Import Accepts Only Raw JSON Paste

**File:** `apps/dentalemon/src/features/pmd/components/pmd-import.tsx:162-173`  
**Issue:** The import form renders a `<textarea>` for raw JSON input. The ui-prototype spec (`components.md` §ImportPMDDialog) requires a file dropzone accepting `.json` and `.pdf` files up to 25 MB with type and size validation. A textarea cannot satisfy the PDF import case, cannot enforce file type, and cannot enforce size limits. WF-022 is structurally blocked for real-world PMD files.  
**Fix:** Replace the textarea with a file `<input accept=".json,.pdf">` or a dropzone component. Read file content via `FileReader` for JSON; forward the binary blob to the server for PDF. Add 25 MB size guard before upload.

### BL-03: PMD List Screen Missing

**File:** (no file — route does not exist)  
**Issue:** MODULE_SPEC §9 and §10 specify `GET /dental/pmd/:patientId` (list), and the ui-prototype specifies a `/patients/:id/pmds` route with two-section tables (generated + imported). No such route or page component exists under `apps/dentalemon/src/routes/`. Patients and staff cannot enumerate PMDs, and the download workflow has no entry point outside the workspace sheet.  
**Fix:** Create route `apps/dentalemon/src/routes/_dashboard/patients/$patientId/pmds.tsx` implementing the two-section list with `PMDListTable` components.

### BL-04: No PMD Download Capability

**File:** `apps/dentalemon/src/features/pmd/components/pmd-viewer-sheet.tsx` (no download button present)  
**Issue:** `PMDViewerSheet` renders `PMDViewer` and an "Import External PMD" button but provides no mechanism to download the displayed PMD. MODULE_SPEC §10 specifies `GET /dental/pmd/:id/download` and the spec requires a `PMDDownloadButton`. The viewer shows the checksum and metadata but users cannot retrieve the actual signed document.  
**Fix:** Add a `PMDDownloadButton` to `PMDViewerSheet` that calls `GET /dental/pmd/:id/download` when `pmd` is non-null.

### BL-05: Generate PMD Error is Silent

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:162-185`  
**Issue:** `handleSharePMD` calls `sharePMDMutation.mutate(...)` but provides no `onError` handler. When the server returns an error (e.g., 422 VISIT_NOT_COMPLETED from AC-PMD-001), the user receives no feedback. The error is swallowed silently.  
**Fix:**
```typescript
sharePMDMutation.mutate(
  { visitId: currentVisitId, patientId },
  {
    onSuccess: (pmd) => { /* existing */ },
    onError: (err) => {
      // Show toast or set error state
      console.error('PMD generation failed:', err);
      // setSharePmdError('Failed to generate PMD. The visit may not be completed yet.');
    },
  },
);
```

---

## Warning Findings

### WR-01: PMDViewerSheet Has No Loading State

**File:** `apps/dentalemon/src/features/pmd/components/pmd-viewer-sheet.tsx:33`  
**Issue:** `PMDViewerSheet` receives `pmd: PMDDocument | null` and renders "No PMD document for this visit" when `pmd` is null. However, `usePMD` takes time to resolve — during the loading state `currentPMD` is `undefined`, which collapses to `null` via the `?? null` coercion in `$patientId.tsx:477`. The "no PMD" message is shown prematurely before the fetch resolves, causing a flash of incorrect empty state.  
**Fix:** Pass `isLoading` from `usePMD` through to `PMDViewerSheet` and render a skeleton while loading:
```tsx
// In $patientId.tsx
const { data: currentPMD, isLoading: pmdLoading } = usePMD(currentVisitId);
// In PMDViewerSheet props: add isLoading?: boolean
```

### WR-02: Error on Import Resets to form Step, Discards User Input

**File:** `apps/dentalemon/src/features/pmd/components/pmd-import.tsx:81`  
**Issue:** On a failed import, the handler sets `setErrors(['Failed to import PMD'])` then immediately calls `setStep('form')`. If the user is on the preview step, this discards the validated content and forces re-entry. The server error message is also not surfaced — the generic string "Failed to import PMD" is used regardless of the actual error body (e.g., 422 CHECKSUM_MISMATCH vs. 403 forbidden).  
**Fix:** Preserve the current step on error; parse the server error body to surface the specific reason:
```typescript
const errorBody = await res.json().catch(() => null);
const msg = errorBody?.message ?? 'Failed to import PMD';
setErrors([msg]);
// do NOT call setStep('form') — stay on preview so user can correct without re-entry
```

### WR-03: `onImported` Callback Signature Mismatch

**File:** `apps/dentalemon/src/features/pmd/components/pmd-import.tsx:29` vs. `components.md:ImportPMDDialog` spec  
**Issue:** `PMDImportProps.onImported` is typed as `() => void` (no argument). The ui-prototype spec declares `onImported(pmdId: string): void`. Consumers that need the newly created PMD ID to navigate to it or invalidate the correct query key cannot do so.  
**Fix:** Update the callback type and pass the returned ID:
```typescript
onImported?: (pmdId: string) => void;
// In handleConfirm, after successful response:
const body = await res.json();
setStep('done');
onImported?.(body.id);
```

### WR-04: `PMDStatus` Includes 'signed' and 'superseded' — Not in MODULE_SPEC

**File:** `apps/dentalemon/src/features/pmd/types.ts:6`  
**Issue:** `PMDStatus = 'generated' | 'signed' | 'superseded'`. MODULE_SPEC §8 states: "PMDDocument: generated (terminal — no transitions). ImportedPMD: imported (terminal — read-only)." There is no `signed` or `superseded` state in the spec. The type definition diverges from the domain model, which can confuse consumers and indicates the type was designed against a different version of the spec.  
**Fix:** Align with MODULE_SPEC or file a spec change request if `signed`/`superseded` states are intentional. If they are valid, MODULE_SPEC §8 must be updated to document the full state machine.

### WR-05: WorkspaceTopBar Exposes `onPmd` Prop But Never Wires a PMD Icon Button

**File:** `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx:183-188`  
**Issue:** `WorkspaceTopBarProps` declares `onPmd: () => void` and the parent route passes `() => setPmdViewerOpen(true)` to it. However, inside `WorkspaceTopBar`, `onPmd` is received but never called — there is no PMD icon button in the toolbar. The toolbar renders: Rx, Consent, Notes, Attachments, Treatment Plan, Complete Visit, Fullscreen. The PMD trigger is only accessible via the "Share PMD" text button that appears when `isReadOnly` — making PMD viewing inaccessible for active visits.  
**Fix:** Add a PMD icon button in the toolbar row:
```tsx
<IconButton label="Portable Medical Document" onClick={onPmd}>
  <FileText className="h-4 w-4" />
</IconButton>
```

### WR-06: `PMDImport` Bottom Sheet Accessibility

**File:** `apps/dentalemon/src/features/pmd/components/pmd-import.tsx:100`  
**Issue:** The backdrop `<div>` has an `onClick={handleClose}` but is not keyboard-accessible (no `role`, no `onKeyDown`). The dialog `role="dialog" aria-modal="true"` is set on the bottom sheet container, but there is no `aria-labelledby` linking to the `<h2>` title, violating ARIA dialog authoring practices.  
**Fix:**
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="pmd-import-title"
  ...
>
  <h2 id="pmd-import-title" ...>Import External PMD</h2>
```

### WR-07: `useSharePMD` Uses `as unknown as` Double Cast on Request Body

**File:** `apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts:26`  
**Issue:** `body: { patientId: input.patientId } as Parameters<typeof generatePmd>[0]['body']` uses a type assertion to satisfy the SDK body type. This bypasses type safety — if the SDK's generated type requires additional fields, the cast hides the mismatch at compile time. A type error would surface only at runtime via a 422 from the server.  
**Fix:** Import the correct body type from `@monobase/sdk-ts/generated` and construct the body against it explicitly instead of casting.

---

## Info Findings

### IN-01: Test Types Redeclare PMDDocument Locally (DRY Violation)

**File:** `apps/dentalemon/src/features/pmd/components/pmd-viewer.test.ts:8-21`  
**Issue:** `PMDDocument` and `PMDStatus` are re-declared inline in the test file rather than imported from `../types`. If `types.ts` changes, the test types silently diverge.  
**Fix:** `import type { PMDDocument, PMDStatus } from '../types';`

### IN-02: Safety Floor Preview Shows Duplicate Items on Re-import

**File:** `apps/dentalemon/src/features/pmd/components/pmd-import.tsx:177-225`  
**Issue:** The import success message says "The patient's Safety Floor has been updated with the imported data." If the same PMD is imported twice, the preview step would show the same conditions/medications/allergies both times with no deduplication warning visible to the user.  
**Fix:** Consider showing a warning in the preview step if `sourceFacility` + `checksum` combination already exists in the patient record. This is a backend concern but the UI should surface the response if the server returns a duplicate-import signal.

### IN-03: `pmd.content` Expected as Base64 in Test, JSON String in Component

**File:** `apps/dentalemon/src/features/workspace/hooks/use-pmd.test.ts:22` vs `pmd-viewer.tsx:27`  
**Issue:** The `use-pmd.test.ts` mock sets `content: 'base64encodedpdf'`, but `PMDViewer` calls `JSON.parse(pmd.content)` and silently falls back to `{}` on failure. This means the test mock does not represent a valid PMD content format and the silent catch masks what would be a broken viewer in production if the API returns base64 PDF content rather than a JSON snapshot.  
**Fix:** Clarify in the spec whether `pmd.content` is a JSON snapshot string (for in-workspace viewing) or a base64 PDF blob. If both are possible, the viewer needs a type discriminator. Update the test mock to use valid JSON content consistent with what the real API returns.

### IN-04: Magic `setTimeout(onImportClick, 300)` in PMDViewerSheet

**File:** `apps/dentalemon/src/features/pmd/components/pmd-viewer-sheet.tsx:43`  
**Issue:** A hardcoded 300 ms timeout is used to delay the PMD import open after the Sheet closes, to "avoid overlapping animations." This is fragile — animation duration changes or slower devices will produce visible glitches. It also does not cancel if the component unmounts.  
**Fix:** Use the Sheet's `onAnimationEnd` or `afterLeave` callback (if Shadcn Sheet exposes one) to trigger `onImportClick` after the close animation completes. Alternatively, use CSS `transition-end` events. At minimum, store the timeout ID in a ref and cancel it on unmount via `useEffect`.

### IN-05: No Query Invalidation After Successful Import

**File:** `apps/dentalemon/src/features/pmd/components/pmd-import.tsx:83`  
**Issue:** After a successful import, `onImported?.()` is called with no arguments and there is no `queryClient.invalidateQueries` call. If a PMD list ever exists, it will not reflect the newly imported PMD without a page refresh.  
**Fix:** Either pass a `queryClient` invalidation callback via `onImported`, or use `useMutation` from TanStack Query with an `onSuccess` that invalidates the PMD list query key.

---

## Coverage Summary

| Journey / Workflow | Spec Source | Coverage |
|---|---|---|
| WF-021: Generate PMD | MODULE_SPEC §3, §10 | PARTIAL — no eligibility gate, no error feedback, no dialog |
| WF-022: Import external PMD | MODULE_SPEC §3, §7.2, §10 | PARTIAL — no file upload, no checksum, missing required fields |
| WF-066: View / List / Download PMD | MODULE_SPEC §9–§10, screens.md | MINIMAL — viewer sheet only, no list, no download |
| BR-021: Visit must be completed before generate | MODULE_SPEC §5 | NOT ENFORCED in UI |
| BR-022: Imported PMD read-only (405) | MODULE_SPEC §5 | Not applicable in current UI (no edit controls exist, but no 405 toast if server returns it) |
| AC-PMD-001: Generate on active visit → 422 | MODULE_SPEC §11 | NOT COVERED |
| AC-PMD-003: Checksum mismatch → reject | MODULE_SPEC §11 | NOT COVERED |
| Role gating (patient vs. staff vs. dentist) | MODULE_SPEC §6, screens.md | NOT IMPLEMENTED |
| Empty state (no PMDs) | screens.md | PARTIAL |
| Loading skeleton | screens.md, interaction-states.md | PARTIAL |
| Error state with retry | screens.md | PARTIAL — errors shown but not retryable |
| PDF download | screens.md §PMDDownloadButton | ABSENT |
| Checksum badge + verification panel | components.md | ABSENT |
| Generate PMD dialog | screens.md §Generate PMD Dialog | ABSENT |
| PMD list page | screens.md §PMD List | ABSENT |
| PMD detail page | screens.md §PMD Detail | ABSENT |

---

## Verdict

The PMD frontend is a partial prototype. The PMDViewer and PMDImport components exist but are non-compliant with the MODULE_SPEC import contract (BL-01: missing checksum), structurally incapable of real PMD ingestion (BL-02: no file upload), and lack the primary user entry point (BL-03: no PMD list route). The Generate PMD flow has no user-visible error feedback (BL-05). The `onPmd` prop wired in the workspace top bar is unreachable because no icon button calls it (WR-05).

**Minimum required before V1 ship:** BL-01 through BL-05 must be resolved. The PMD list route and download capability are load-bearing for the module to be usable outside the clinical workspace.

---

_Generated: 2026-05-27_  
_Skill: oli-ui-journey v1.0_  
_Module: dental-pmd_
