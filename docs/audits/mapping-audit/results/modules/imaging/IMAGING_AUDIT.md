# Dental Imaging — Studies, Ceph Analysis: Module Audit

**Module:** Dental Imaging (ImagingStudy, Image, Finding, Measurement, CephLandmark, CephReport)
**Audit Date:** 2026-05-26
**Auditor:** Read-only audit — no code changes made
**Scope:** Backend handlers, frontend components, hooks, routes, E2E specs, contract tests
**Module Number:** 8 of 18

---

## Findings Summary

| ID | Severity | Gate | Title |
|----|----------|------|-------|
| IMG-01 | P1 | G2 | `ImagingWorkspace` accepts no role prop — staff_full/staff_scheduling can upload images and manage findings |
| IMG-02 | P1 | G3 | `/imaging-ceph-report/$imageId` route has no `beforeLoad` auth guard — unauthenticated GET leaks PHI |
| IMG-03 | P1 | G3 | CephReportView opened via `window.open()` — breaks within same-window security context, no back navigation |
| IMG-04 | P1 | G8 | `imaging-coverage.test.ts` tests wrapper delegation only with mocked DB — zero error-code assertions across 30 tests |
| IMG-05 | P2 | G2 | Backend: `assertBranchAccess` (all roles) used for read-only ceph endpoints; write/mutate ceph endpoints correctly use `assertBranchRole(['dentist_owner','dentist_associate'])` — read/write role asymmetry is intentional but undocumented |
| IMG-06 | P2 | G4 | Upload hook (`useImagingUpload`) does not pass `credentials: 'include'` on the presigned PUT step — `useImagingStudies` does; inconsistency may cause auth failures against same-origin storage proxy |
| IMG-07 | P2 | G5 | Upload modal lacks file size or MIME-type client-side validation; backend enforces BR-033/BR-034 but UI shows no pre-validation feedback |
| IMG-08 | P2 | G8 | All E2E specs for ceph and imaging use `page.route()` mock interception — none hit the real server; tier-gate journey is the only near-real-backend test |
| IMG-09 | P3 | G6 | `PatientImageMgmt_listPatientImages` wrapper handler has no auth guard in the wrapper file itself — auth is delegated to impl `listPatientImages.ts`; same pattern as all other wrappers but not obvious from handler file alone |
| IMG-10 | P3 | G5 | No deletion confirmation dialog for image delete — destructive action fires on single click |

---

## Gate 2 — Role and Permission Map

### Backend RBAC per Endpoint

Every imaging endpoint in the OpenAPI spec carries `bearerAuth` security. The route layer enforces authentication. Individual handler files (the wrappers) are thin pass-throughs to impl files that carry the actual authorization checks.

**Ceph handlers — all protected:**

| Handler | Guard Type | Roles Allowed |
|---------|-----------|---------------|
| `CephMgmt_batchUpsertCephLandmarks` | `assertBranchRole` | dentist_owner, dentist_associate |
| `CephMgmt_createCephReport` | `assertBranchRole` | dentist_owner, dentist_associate |
| `CephMgmt_deleteCephLandmark` | `assertBranchRole` | dentist_owner, dentist_associate |
| `CephMgmt_recomputeCephAnalysis` | `assertBranchRole` | dentist_owner, dentist_associate |
| `CephMgmt_updateCephLandmark` | `assertBranchRole` | dentist_owner, dentist_associate |
| `CephMgmt_getCephAnalysis` | `assertBranchAccess` | all roles (any branch member) |
| `CephMgmt_getCephReport` | `assertBranchAccess` | all roles (any branch member) |
| `CephMgmt_listCephLandmarks` | `assertBranchAccess` | all roles (any branch member) |

All 8 ceph handlers also enforce `resolveImagingTier` → 403 if org is on free tier.

**Imaging handlers — all protected via delegation chain:**

| Impl File | Guard Type | Roles Allowed |
|-----------|-----------|---------------|
| `createImagingStudy.ts` | `assertBranchRole` | dentist_owner, dentist_associate |
| `deleteImage.ts` | `assertBranchRole` | dentist_owner, dentist_associate |
| `updateImageModality.ts` | `assertBranchRole` | dentist_owner, dentist_associate |
| `createMeasurement.ts` | `assertBranchRole` | dentist_owner, dentist_associate |
| `deleteMeasurement.ts` | `assertBranchRole` | dentist_owner, dentist_associate |
| `createFinding.ts` | `assertBranchRole` | dentist_owner, dentist_associate |
| `deleteFinding.ts` | `assertBranchRole` | dentist_owner, dentist_associate |
| `updateFinding.ts` | `assertBranchRole` | dentist_owner, dentist_associate |
| `getImagingStudy.ts` | `assertBranchAccess` | all roles |
| `listFindings.ts` | `assertBranchAccess` | all roles |
| `listMeasurements.ts` | `assertBranchAccess` | all roles |
| `listPatientImages.ts` | `assertBranchAccess` | all roles |
| `updateImageCalibration.ts` | `assertBranchAccess` | all roles |

**Backend verdict: PASS.** All 21 endpoints are auth-gated. Write operations restrict to dentist roles. Read operations allow any branch member.

**Finding IMG-05 (P2):** The read/write role split for ceph is correct by design but `assertBranchAccess` on `getCephReport` means a `staff_full` or `staff_scheduling` user who happens to have branch membership can read a ceph report. This may be intentional (front desk prints reports) but is undocumented; no spec comment exists.

### Frontend RBAC

**Finding IMG-01 (P1):** `ImagingWorkspace` component interface has no `role` or `canEdit` prop:

```typescript
// apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx
interface ImagingWorkspaceProps {
  imageId: string
  imageUrl: string
  className?: string
  toolMode?: ToolMode
  onToolModeChange?: (mode: ToolMode) => void
  onMeasurementSaved?: () => void
  modality?: string
  pixelSpacingMm?: number | null
  onCalibrationSaved?: (pxMm: number) => void
  visitId?: string
  patientId?: string
  branchId?: string
}
```

No `role`, `canEdit`, `readOnly`, or `permission` prop exists. Upload Image button, FindingsSidebar, measurement tools, and calibration controls are all visible regardless of the caller's role. The workspace is rendered from `apps/dentalemon/src/routes/_workspace/$patientId.tsx` which checks `branchId` and `dentistMemberId` from the org context store, but passes no role restriction into `ImagingWorkspace`. A `staff_scheduling` user who navigates the workspace tab will see and can interact with all imaging write operations. The API will correctly reject the calls with 403, but the UI presents false affordance and will confuse clinical staff.

This is a known gap documented in the prior stabilization plan (CF-07 category) but not yet fixed for the imaging module specifically.

---

## Gate 3 — Route and Navigation

### Routes Mapped

| Route | File | Auth Guard | Notes |
|-------|------|-----------|-------|
| Workspace imaging tab | `routes/_workspace/$patientId.tsx` | Inherits `_workspace` beforeLoad (`requireRole`) | Opens imaging overlay via `imagingOpen` state |
| `/imaging-ceph-report/$imageId` | `routes/imaging-ceph-report.$imageId.tsx` | **NONE** | Print/report route, no beforeLoad |

**Finding IMG-02 (P1 — Security):** The ceph report route has no `beforeLoad` auth guard:

```typescript
// apps/dentalemon/src/routes/imaging-ceph-report.$imageId.tsx
export const Route = createFileRoute('/imaging-ceph-report/$imageId')({
  validateSearch: (search: Record<string, unknown>) => ({
    version: typeof search.version === 'number' ? search.version : undefined,
  }),
  component: CephReportPage,
})
```

No `beforeLoad: requireRole(...)` or `beforeLoad: requireAuthenticated(...)` is present. The component does call `fetch(url)` which hits the backend — the backend will correctly return 401/403 for unauthenticated requests. However, the route itself renders without any session check. In a print context (new tab opened via `window.open`), the browser may not carry the same session cookie depending on the storage mechanism (e.g., if Better-Auth uses `SameSite=Strict` cookies, cross-tab POST-redirect flows may not have the session available on initial page load). The rendered UI will show "Error: [401 response text]" rather than redirecting to login — PHI field names in the error are minimal, but the UX is broken and the lack of explicit auth check is a security smell.

Additionally, the route is accessible to anyone who knows a valid `imageId` if the session cookie is present — there is no frontend check that the current user has rights to that specific image.

**Finding IMG-03 (P1):** The ceph report opens via `window.open(...)` in a new tab from `CephWorkspacePanel.tsx` (line 173–174). The report route has no "close" or "back" button (`CephReportView.tsx` grep for button/back/navigate returned empty). Users who navigate to a ceph report cannot return to the workspace without using the browser back button. No explicit back navigation or close affordance exists in the report view.

### Navigation Flow

```
workspace/_patientId.tsx → (imaging tab click) → imagingOpen=true overlay
  → PatientImageList (thumbnail grid) → ImagingWorkspace (canvas viewer)
    → CephWorkspacePanel (ceph panel) → window.open('/imaging-ceph-report/...')
      → NEW TAB: imaging-ceph-report.$imageId.tsx [no back nav]
```

---

## Gate 4 — Frontend Interaction Integrity

### Upload Flow

`useImagingUpload` → `POST /dental/imaging/studies` (initiate) → `PUT {presigned URL}` (storage upload) → returns `studyId`.

The initiate call uses `fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } })` — no explicit `credentials` option. The presigned PUT step also omits `credentials`. By comparison, `useImagingStudies` explicitly sets `credentials: 'include'`. This inconsistency (IMG-06) means the initiate call relies on the browser default (`credentials: 'same-origin'`), which is fine for same-origin but fragile if the API is ever served from a different subdomain.

Upload error handling: the hook catches initiate failure, propagates as `Error`, and the component renders it. Storage failure triggers a cleanup call to delete the dangling image record. Error user feedback depends on the caller component surfacing the error — `image-upload.tsx` receives the error but the audit did not find explicit toast or error message display in the upload component for the error state.

### Create Finding Flow

`FindingsSidebar` → form submit → `useImagingFindings.createFinding()` → `POST /dental/imaging/images/{imageId}/findings`. On success, the hook invalidates the findings query key. The E2E spec (`imaging-findings.spec.ts`) verifies list refresh via `page.route()` mock interception.

### Ceph Analysis Flow

Canvas click → `useCephLandmarks.upsert()` → `POST /dental/imaging/images/{imageId}/ceph/landmarks` → returns `{items, analysis}`. The hook updates both local landmark state and the analysis display. Confirm gate: A/B/Go/Po must be in `confirmed` or `locked` status before `POST /ceph/reports` is allowed (backend enforces 422 `REPORT_GATE_UNCONFIRMED`). Frontend `CephWorkspacePanel` shows a "Gate landmarks confirmed" indicator and disables the Generate Report button when gate landmarks are unconfirmed.

### Report Generation

`CephWorkspacePanel` → "Generate Report" button → `POST /dental/imaging/images/{imageId}/ceph/reports` → returns `{version}` → "View Report v{N}" button becomes visible → `window.open('/imaging-ceph-report/{imageId}?version={N}', '_blank')`.

### Export (PNG)

"PNG" button (visible after report creation) → `composeCephCanvas()` + `canvasToPngBlob()` → download link. This is a client-side operation using the `ceph-export.ts` lib; no backend call required.

---

## Gate 5 — Forms, Modals, Tables

### Upload Modal

Located in `apps/dentalemon/src/features/imaging/components/image-upload.tsx`. Fields: file picker, modality selector, tooth number. The modal opens as a dialog/sheet (verified by E2E test IMG-05 which expects a `[role="dialog"]` or `[data-testid="upload-sheet"]`).

**Finding IMG-07 (P2):** No client-side MIME-type or file-size validation is visible in the upload hook or component. Backend enforces BR-033 (file size) and BR-034 (mime type allowlist), but the UI will submit any file and only show an error after the API rejects it. Pre-validation would improve UX for large files.

### Finding Entry Form

`FindingsSidebar` provides fields for `type`, `toothNumber`, `surfaces`, `status`, `note`. Validation is done via the `CreateFindingSchema` Zod schema on the backend. No client-side Zod validation was found in the sidebar component.

### Ceph Landmark Canvas

Not a traditional form. Landmark placement is a canvas click event → coordinate capture → `useCephLandmarks.upsert()`. The `CephLandmarkPalette` panel shows landmark codes and their status (placed/confirmed/locked). Status transitions are enforced: placed → confirmed → locked (forward-only FSM, verified by `ceph-landmark.fsm.property.test.ts`). Locked landmarks reject PATCH (422 `LANDMARK_LOCKED`).

### Imaging List/Table

`PatientImageList` renders thumbnails fetched by `useImagingStudies`. Checkbox selection enables comparison mode ("Compare" button visible when exactly 2 images selected). Max 2 selection enforced client-side. Click on image opens `ImagingWorkspace` overlay.

**Finding IMG-10 (P3):** No deletion confirmation dialog for `deleteImage`. The delete path exists in the backend with role restriction, but the frontend fires the delete on a single action with no confirmation dialog. Prior audit flagged void invoice similarly (CF-09). Image deletion is irreversible.

---

## Gate 6 — Backend/API Contract Alignment

### Complete Endpoint List (21 endpoints, all in OpenAPI spec)

```
GET     /dental/patients/{patientId}/images              PatientImageMgmt_listPatientImages
POST    /dental/imaging/studies                          ImagingMgmt_createImagingStudy
GET     /dental/imaging/studies/{studyId}                ImagingMgmt_getImagingStudy
DELETE  /dental/imaging/images/{imageId}                 ImagingMgmt_deleteImage
PATCH   /dental/imaging/images/{imageId}/calibration     ImagingMgmt_updateImageCalibration
PATCH   /dental/imaging/images/{imageId}/modality        ImagingMgmt_updateImageModality
POST    /dental/imaging/images/{imageId}/measurements    ImagingMgmt_createMeasurement
GET     /dental/imaging/images/{imageId}/measurements    ImagingMgmt_listMeasurements
DELETE  /dental/imaging/measurements/{measurementId}     ImagingMgmt_deleteMeasurement
POST    /dental/imaging/images/{imageId}/findings        ImagingFindingsMgmt_createFinding
GET     /dental/imaging/images/{imageId}/findings        ImagingFindingsMgmt_listFindings
PATCH   /dental/imaging/findings/{findingId}             ImagingFindingsMgmt_updateFinding
DELETE  /dental/imaging/findings/{findingId}             ImagingFindingsMgmt_deleteFinding
GET     /dental/imaging/images/{imageId}/ceph/analysis   CephMgmt_getCephAnalysis
POST    /dental/imaging/images/{imageId}/ceph/analysis/recompute  CephMgmt_recomputeCephAnalysis
POST    /dental/imaging/images/{imageId}/ceph/landmarks  CephMgmt_batchUpsertCephLandmarks
GET     /dental/imaging/images/{imageId}/ceph/landmarks  CephMgmt_listCephLandmarks
PATCH   /dental/imaging/images/{imageId}/ceph/landmarks/{landmarkCode}  CephMgmt_updateCephLandmark
DELETE  /dental/imaging/images/{imageId}/ceph/landmarks/{landmarkCode}  CephMgmt_deleteCephLandmark
POST    /dental/imaging/images/{imageId}/ceph/reports    CephMgmt_createCephReport
GET     /dental/imaging/images/{imageId}/ceph/reports    CephMgmt_getCephReport
```

All 21 endpoints are in the OpenAPI spec with `bearerAuth` security. No undocumented endpoints detected.

### Frontend Hook → Backend URL Match

| Hook | URL Called | Matches Spec |
|------|------------|-------------|
| `useImagingStudies` | `GET /dental/patients/{patientId}/images?branchId=` | Yes |
| `useImagingUpload` | `POST /dental/imaging/studies` | Yes |
| `useImagingFindings` | `GET/POST /dental/imaging/images/{imageId}/findings` | Yes |
| `useImagingFindings` | `PATCH /dental/imaging/findings/{findingId}` | Yes |
| `useImagingFindings` | `DELETE /dental/imaging/findings/{findingId}` | Yes |
| `useCephLandmarks` | `POST /dental/imaging/images/{imageId}/ceph/landmarks` | Yes |
| `useCephLandmarks` | `GET /dental/imaging/images/{imageId}/ceph/landmarks` | Yes |
| `useCephLandmarks` | `PATCH .../ceph/landmarks/{landmarkCode}` | Yes |
| `useCephAnalysis` | `GET /dental/imaging/images/{imageId}/ceph/analysis` | Yes |
| `CephWorkspacePanel` | `POST /dental/imaging/images/{imageId}/ceph/reports` | Yes |
| `CephWorkspacePanel` | `GET /dental/imaging/images/{imageId}/ceph/reports` | Yes |
| `CephReportPage` (report route) | `GET /dental/imaging/images/{imageId}/ceph/reports?version=N` | Note: spec operationId uses plural `reports` for both GET/POST — matches |

All frontend hook URLs match the OpenAPI spec. No URL drift detected.

**Note on wrapper architecture:** The `ImagingMgmt_*`, `ImagingFindingsMgmt_*`, and `PatientImageMgmt_*` handler files are one-line pass-throughs to impl files. The wrapper files contain no auth logic; auth lives entirely in the impl files. This is correct by design (coverage test comment: "one-line pass-through to the underlying impl"). The analysis tool flagged these as `NONE/NoAuth` in the wrapper layer — this is not a bug, it is an architectural pattern. The test in `imaging-coverage.test.ts` validates this delegation chain explicitly.

---

## Gate 7 — Role-Based Journey Map

### Journey A: dentist_owner uploads X-ray → adds findings → creates measurement → generates ceph report

1. Navigate to patient workspace → imaging tab → imaging overlay opens
2. Click "Upload Image" → modal opens → select file, set modality=cephalometric → submit
3. `POST /dental/imaging/studies` → 201, returns presigned URL → `PUT {presigned URL}` → study created
4. Click image thumbnail → `ImagingWorkspace` opens with canvas
5. "Ceph" button visible (modality=cephalometric) → click → `CephWorkspacePanel` opens
6. `GET /dental/imaging/images/{id}/ceph/analysis` → 200 (empty, missing:[all])
7. Click canvas to place landmark N → `POST .../ceph/landmarks` → analysis updated
8. Repeat for all required landmarks → confirm A, B, Go, Po
9. "Generate Report" button enabled → click → `POST .../ceph/reports` → 201, version=1
10. "View Report v1" button → `window.open('/imaging-ceph-report/{id}?version=1', '_blank')`
11. Report renders with measurements table, scale bar, disclaimer

**Status: FUNCTIONAL** — full journey works. Gap: step 10 opens new tab with no back navigation (IMG-03).

### Journey B: dentist_associate views existing study (read vs write access)

`dentist_associate` has write access (assertBranchRole includes associate). Associate can create studies, findings, measurements, place landmarks, generate reports — same as owner. No read-only restriction exists for associate role in imaging. This is correct per domain model (`dentist_associate` has "clinical write + Rx").

### Journey C: staff_scheduling accesses imaging

Backend: Any `POST/PATCH/DELETE` will return 403 (assertBranchRole rejects non-dentist roles).
Frontend: `ImagingWorkspace` renders all write controls regardless of role. The imaging tab is accessible to any workspace user. No frontend guard on the upload button, findings sidebar, or ceph panel. Staff will see fully interactive UI, attempt actions, and receive 403 from the API silently (IMG-01).

**Status: BACKEND SAFE, FRONTEND BROKEN** — staff_scheduling receives correct 403 from all write endpoints but sees misleading UI.

---

## Gate 8 — Test Confidence Gap

### Backend Unit Tests (all use mock DB, no real DB connections)

| File | Test Count | DB Strategy | Error Code Assertions | Quality |
|------|-----------|-------------|----------------------|---------|
| `imaging.test.ts` | ~63 tests | Mock objects | 0 error-code asserts | Happy paths + role restriction tests (BR-033, BR-034, BR-026, BR-027) |
| `imaging-coverage.test.ts` | ~30 tests | Mock objects | 0 error-code asserts | Wrapper delegation only; confirms 201/200/204 but never checks `$.code` |
| `ceph.test.ts` | ~90+ tests | Mock objects | Partial (422 codes present) | Strong: covers CIMG-07..15, D-G, D-I, D-J, D-L, landmark FSM, tier gate, immutability |
| `ceph-landmark.fsm.property.test.ts` | Property tests | Mock | N/A | Forward-only state machine (placed→confirmed→locked) |
| `imaging-finding.fsm.property.test.ts` | Property tests | Mock | N/A | Finding status FSM |

**Finding IMG-04 (P1):** `imaging-coverage.test.ts` tests 13 wrapper handlers (30 tests) but has zero error-code assertions — all tests check only HTTP status codes (201, 200, 204, 404). The test comment acknowledges this: "one happy-path call per wrapper is sufficient to bring function coverage to 100%". This is coverage-gaming: high function coverage numbers, zero behavior coverage for error paths of the wrapper handlers. The wrappers are thin pass-throughs so the risk is low, but any regression in the delegation chain (wrong function imported, type mismatch) would not be caught.

`imaging.test.ts` has 63 tests with 0 error-code assertions (per prior audit hardening plan). This was flagged as a hardening target.

### Frontend Unit Tests

| File | Tests | Quality |
|------|-------|---------|
| `use-imaging-studies.test.ts` | ~6 tests | Good: happy path, empty, disabled state, URL shape, error |
| `use-imaging-upload.test.ts` | ~8 tests | Good: progress states, body validation, abort, storage failure, cleanup |
| `use-imaging-findings.test.ts` | ~10 tests | Good: create, update, delete, optimistic, error |
| `use-ceph-analysis.test.ts` | ~5 tests | Adequate: cache, fetch, empty state |
| `use-ceph-landmarks.test.ts` | ~15 tests | Good: upsert, update, delete, locked rejection |
| Component tests (CephAngleArcLayer, CephLandmarkLayer, etc.) | Multiple | Render/props focused |

Frontend hook tests use mocked `global.fetch` — no real network calls. Adequate for contract validation.

### E2E Tests

| Spec File | Tests | Backend | Quality |
|-----------|-------|---------|---------|
| `imaging-ceph.spec.ts` | ~15 tests (CEPH-01..05) | All mocked via `page.route()` | Panel open/close, landmark palette, measurements display |
| `imaging-ceph-export.spec.ts` | ~12 tests (CEPH-06..10) | All mocked | Gate enforcement, report generation, PNG button, CephReportView |
| `imaging-findings.spec.ts` | ~8 tests (CIMG-01..06) | All mocked | FindingsSidebar create/update/delete |
| `imaging-annotation.spec.ts` | ~10 tests | All mocked | Annotation toolbar, tool activation, single-active enforcement |
| `imaging-measurement.spec.ts` | ~10 tests | All mocked | MeasurementToolbar, SVG overlay, panoramic warning |
| `imaging-comparison.spec.ts` | ~10 tests | All mocked | ComparisonView, checkbox selection, offline cache |
| `ipad-imaging.spec.ts` | iPad layout tests | Mocked | Responsive layout |
| `journeys/11-ceph-tier-gate.journey.spec.ts` | Journey test | Near-real (uses real server context) | Tier gate end-to-end |

**Finding IMG-08 (P2):** Every ceph and imaging E2E spec uses `page.route()` mock interception. The specs explicitly note: "Without a running dev server these tests are skipped automatically." This means the tests validate UI wiring against mocked API responses only. A regression in the actual API contract (wrong URL, wrong method, wrong response shape) would not be caught by these specs — only the Hurl contract tests (`dental-imaging.hurl`) would catch that.

The `11-ceph-tier-gate.journey.spec.ts` is the only spec that runs against real server context (uses `pinAuth`, `openWorkspace`, `readOrgContext` helpers). It validates the full tier gate workflow.

### Confidence Scores

| Layer | Score | Rationale |
|-------|-------|-----------|
| Backend unit (ceph) | 8/10 | Comprehensive: FSM, tier gate, immutability, 401/422/404 paths all covered |
| Backend unit (imaging/findings/measurements) | 5/10 | 63 tests in imaging.test.ts, 0 error-code assertions; wrapper tests are delegation-only |
| Backend contract (Hurl) | 7/10 | Full ceph lifecycle covered; imaging-specific hurl file not located (may be merged into broader file) |
| Frontend hooks | 7/10 | Good coverage, all mocked fetch; upload/ceph landmarks well tested |
| E2E (ceph) | 5/10 | Mocked API only; UI wiring verified but real API integration not tested end-to-end |
| E2E (imaging) | 5/10 | Same limitation — mocked throughout |
| Role enforcement (backend) | 9/10 | All write paths use assertBranchRole; read paths use assertBranchAccess; tier gate on all ceph ops |
| Role enforcement (frontend) | 2/10 | No role prop on ImagingWorkspace; no frontend guard on any imaging write control |

---

## Critical Issues Detail

### IMG-01 (P1): No Role Prop on ImagingWorkspace

**File:** `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx`
**Evidence:** `ImagingWorkspaceProps` interface has no `role`, `canEdit`, or `readOnly` field. The workspace renders "Upload Image" button, `FindingsSidebar`, `MeasurementToolbar`, `AnnotationToolbar`, and `CephWorkspacePanel` for every caller regardless of role.
**Impact:** staff_full and staff_scheduling users see and can interact with all clinical imaging write controls. API returns 403 for all writes, but the UI presents broken affordance and misleading error states.
**Fix:** Add `role?: MemberRole` prop to `ImagingWorkspaceProps`. Hide upload, delete, finding creation, measurement creation, ceph landmark placement, and report generation controls when role is not in `['dentist_owner', 'dentist_associate']`. The `_workspace/$patientId.tsx` parent already has access to the org context store which contains `memberId` and `branchId`; role should be read from the same store.

### IMG-02 (P1): Unauthenticated Access to Ceph Report Route

**File:** `apps/dentalemon/src/routes/imaging-ceph-report.$imageId.tsx`
**Evidence:** `createFileRoute('/imaging-ceph-report/$imageId')({ validateSearch, component })` — no `beforeLoad`. Backend `CephMgmt_getCephReport` correctly requires auth (returns 401 if unauthenticated). However, the frontend route renders the loading state unconditionally, fires the fetch, and shows raw error text on failure.
**Impact:** An unauthenticated user who receives a report URL (e.g., shared link) sees a white page with "Error: [401 text]" rather than being redirected to login. In a print context (`window.open`), the new tab may not carry the session if the auth cookie has `SameSite=Strict`. The rendered page will be a broken print view rather than a graceful redirect.
**Fix:** Add `beforeLoad: requireAuthenticated` (or the appropriate equivalent from the project's auth utils) to the route definition. Additionally, on `isError`, check if error message contains "401" and redirect to login rather than showing raw error text.

### IMG-03 (P1): Ceph Report Opens in New Tab with No Back Navigation

**File:** `apps/dentalemon/src/features/imaging/components/CephWorkspacePanel.tsx` (line 173–174)
**Evidence:** `window.open('/imaging-ceph-report/${imageId}?version=${createdVersion}', '_blank')`. `CephReportView.tsx` has no back/close button (grep for `button/back/navigate/href` returned empty).
**Impact:** Clinicians viewing a ceph report for printing cannot navigate back to the workspace without using browser back button. In a kiosk/iPad context this is a significant UX failure. For print workflows specifically, opening a new tab is intentional, but the report view should include a "Close" button (`window.close()`) and a "Back to Workspace" link.
**Fix:** Add a close/back button to `CephReportView` component. At minimum: `<button onClick={() => window.close()}>Close</button>` visible in screen view (hidden in print media query). The `imaging-ceph-export.spec.ts` tests would need updating to assert this button's presence.

### IMG-04 (P1): imaging-coverage.test.ts Has Zero Error-Code Assertions

**File:** `services/api-ts/src/handlers/dental-imaging/imaging-coverage.test.ts`
**Evidence:** 30 test cases, all asserting HTTP status codes only (201, 200, 204, 404). Comment: "one happy-path call per wrapper is sufficient to bring function coverage to 100%." `imaging.test.ts` similarly has 63 tests with 0 error-code assertions (per hardening plan analysis).
**Impact:** Coverage metrics show high numbers but behavioral regressions in error handling are undetected. If a wrapper silently eats a 403 and returns 200, no test catches it.
**Fix:** Add `$.code` assertions to at minimum: auth failure path (401), not-found path (404), and role-forbidden path (403) for each wrapper group. This aligns with the test hardening plan Phase 2 already documented.

---

## Recommended Fix Priority

| Priority | ID | Action | Effort |
|----------|----|--------|--------|
| 1 | IMG-01 | Add `role` prop to `ImagingWorkspace`, hide write controls for non-dentist roles | Medium — requires role prop threading from workspace route |
| 2 | IMG-02 | Add `beforeLoad: requireAuthenticated` to ceph report route; improve error UX on 401 | Small |
| 3 | IMG-03 | Add close/back button to `CephReportView` | Small |
| 4 | IMG-04 | Add error-code assertions to `imaging-coverage.test.ts` and `imaging.test.ts` | Medium — 30+ test cases to augment |
| 5 | IMG-06 | Add `credentials: 'include'` to initiate fetch in `useImagingUpload` | Trivial |
| 6 | IMG-07 | Add client-side MIME type and file size validation in upload component | Small |
| 7 | IMG-10 | Add delete confirmation dialog for image delete | Small |
| 8 | IMG-05 | Document (comment) the intentional read/write role split for ceph GET handlers | Trivial |
| 9 | IMG-08 | Add one real-backend E2E journey for imaging upload → finding → measure workflow | Large |

---

## Overall Confidence Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Backend correctness | 8/10 | All endpoints auth-gated, role restrictions correct, tier gate complete, ceph FSM solid |
| Frontend role safety | 3/10 | No role guard on any imaging write control; staff sees full clinical UI |
| Route security | 5/10 | Workspace route guarded; ceph report route unguarded |
| API contract alignment | 9/10 | All 21 endpoints in spec, all URLs match, no drift detected |
| Test coverage depth | 5/10 | High function coverage numbers conceal zero error-code assertion coverage; E2E all mocked |
| Navigation/UX completeness | 6/10 | Ceph report route lacks back navigation; no delete confirmation |
| **Module overall** | **6/10** | Backend is strong; frontend role safety and the unguarded print route are the critical gaps |
