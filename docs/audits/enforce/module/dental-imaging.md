# dental-imaging — Module Enforcement
<!-- oli-enforce-module v1.0 --strict | run: run-6-strict-2026-05-29 | baseline: run-5 -->

## Summary

- **Findings:** 16 (P0: 0, P1: 10, P2: 5, P3: 1)
- **New findings vs run-5:** 3 (EM-IMG-FK-001, EM-IMG-FF-002, EM-IMG-DM-003 — all P2)
- **Resolved findings vs run-5:** 1 (EM-IMG-6A13895D and EM-IMG-8CD0FA81 reclassified as P2 contract-drift per URL scheme note; ceph handler completeness confirmed)
- **Service-Layer Pattern:** PARTIAL — repo classes exist (`ImagingRepository`, `ImagingCephRepository`, `ImagingFindingRepository`); `@monobase/ceph-math` isomorphic engine present; no service layer singletons or DI
- **Compliance Score:** 46/100

### Score Breakdown

| Dimension | Score | Cap Applied | Notes |
|-----------|-------|-------------|-------|
| Public API completeness | 4/10 | P1 cap | GET list + annotation POST/PATCH still missing; ceph URL scheme diverges |
| Workflow implementation | 7/10 | — | WF-019/020/040/030/031 all have code; study_date gap; annotation PATCH missing |
| Domain term consistency | 9/10 | — | Terms used correctly; no ad-hoc synonyms |
| State machine enforcement | 7/10 | — | SM-01 guarded for Finding; SM-02 (ceph landmark) fully guarded; Annotation SM-01 unguarded |
| Event publishing | 0/10 | P1 cap | DE-018/019/020 declared, none emitted |
| Auth / permissions | 6/10 | — | authMiddleware on all 21 routes; staff_full role gap on GET studies |
| F2 Service-Layer / DI | 5/10 | — | Repos exist + ceph-math package clean; direct `new` in all handlers |

**Overall:** 46/100 — P1 cap applied to API completeness and events dims.

> Score delta vs run-5: +2 (SM-02 fully guarded confirmed; `@monobase/ceph-math` isomorphic confirmed)

---

## Strict Ceph-Specific Assessment (run-6 additions)

| Check | Result |
|-------|--------|
| 3 ceph tables present (`imaging_ceph_landmark`, `imaging_ceph_analysis`, `imaging_ceph_report`) | PASS |
| `ceph_session` table | NOT REQUIRED — MODULE_SPEC §7 lists only 3 ceph tables; no `ceph_session` in spec |
| getCephAnalysis handler | PASS — `getCephAnalysis.ts` + `CephMgmt_getCephAnalysis.ts` shim |
| recomputeCephAnalysis handler | PASS — `recomputeCephAnalysis.ts` + `CephMgmt_recomputeCephAnalysis.ts` shim |
| batchUpsertCephLandmarks handler | PASS — `batchUpsertCephLandmarks.ts` |
| updateCephLandmark handler | PASS — `updateCephLandmark.ts` with SM-02 guard |
| deleteCephLandmark handler | PASS — `deleteCephLandmark.ts` with tier gate |
| listCephLandmarks handler | PASS — `listCephLandmarks.ts` |
| createCephReport handler | PASS — `createCephReport.ts` with tier gate + D-L gate-landmark check |
| getCephReport handler | PASS — `getCephReport.ts` |
| Ceph math engine isomorphic (no DOM deps) | PASS — `@monobase/ceph-math` at `packages/ceph-math/`; `src/index.ts` is pure TS, no DOM imports; `DOMPoint` only in test oracle (`ceph-coords.test.ts`), not in production code |
| Calibration gate before landmark placement | PARTIAL — `not_calibrated` state recorded correctly; `computeCephAnalysis` returns `uncalibrated: true`; but NO 422 thrown when `calibrationMethod = not_calibrated` — spec §13 edge case unenfored (see EM-IMG-DM-003) |
| imagingTier gate on all ceph endpoints | PASS — all ceph handlers call `getImagingTierForBranch()` and throw 403 ForbiddenError on `'free'` tier |
| SM-02 locked landmark rejection | PASS — `updateCephLandmark.ts` checks `CEPH_LANDMARK_TRANSITIONS`, rejects x/y changes on locked, rejects invalid status transitions with `INVALID_STATUS_TRANSITION` code |
| D-I append-only report | PASS — `imaging_ceph_report` uses `versionedSnapshotFields()`, no update/delete handler exists |

---

## Findings

### Known Findings (carried from run-5, still open)

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|----------|
| EM-IMG-144BE775 | P1 | `GET /dental/imaging/studies` list endpoint (patient_id filter, pagination) absent from registered routes — only `GET /studies/:studyId` exists | `services/api-ts/src/generated/openapi/routes.ts` | — | MODULE_SPEC §10 |
| EM-IMG-152F9A95 | P1 | `POST /dental/imaging/images/:id/annotations` (create annotation) has no handler or route registration | `services/api-ts/src/handlers/dental-imaging/` | — | MODULE_SPEC §3 WF-020 |
| EM-IMG-C40244A4 | P1 | `PATCH /dental/imaging/images/:id/annotations/:aid` (update annotation, status→confirmed) has no handler or route | `services/api-ts/src/handlers/dental-imaging/` | — | MODULE_SPEC §3 WF-020, §8 SM-01 |
| EM-IMG-3B53ABB3 | P1 | `study_date` field absent from `createImagingStudy` body parsing and `imaging_study` schema (only `createdAt` exists) | `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts` | 22–37 | MODULE_SPEC §4 WF-019, §7 |
| EM-IMG-1973EF93 | P1 | `staff_full` role permitted for `GET /dental/imaging/studies` per spec; no handler includes `staff_full` in `assertBranchRole` | `services/api-ts/src/handlers/dental-imaging/getImagingStudy.ts` | 28 | MODULE_SPEC §6 |
| EM-IMG-5A805E17 | P1 | `DE-018 ImagingStudyUploaded` declared in MODULE_SPEC §10b; zero event emit/publish calls in any imaging handler | `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts` | — | MODULE_SPEC §10b |
| EM-IMG-0435E807 | P1 | `DE-019 ImagingFindingConfirmed` declared in MODULE_SPEC §10b; never emitted in `updateFinding` or any annotation handler | `services/api-ts/src/handlers/dental-imaging/updateFinding.ts` | — | MODULE_SPEC §10b |
| EM-IMG-8891E413 | P1 | `DE-020 CephAnalysisComputed` declared in MODULE_SPEC §10b; never emitted in `recomputeCephAnalysis` or `batchUpsertCephLandmarks` | `services/api-ts/src/handlers/dental-imaging/recomputeCephAnalysis.ts` | — | MODULE_SPEC §10b |
| EM-IMG-2404E9CE | P2 | Impl URL scheme (`/images/:imageId/ceph/…`) diverges from legacy contract URLs (`/ceph-analyses/:id/…`) — API_CONTRACTS needs update to match TypeSpec-generated routes or aliases added | `services/api-ts/src/generated/openapi/routes.ts` | — | API_CONTRACTS §ceph-analyses paths |
| EM-IMG-3796DC9D | P2 | All 20+ handlers instantiate repos directly via `new ImagingRepository(db)` etc. on every request — no singletons, no DI | `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts` | 34–35 | MODULE_SPEC §20 |
| EM-IMG-04E1D56A | P2 | WF-019 step 2 requires `study_date`; `imaging_study` schema has no `study_date` column, making retrospective date entry impossible | `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts` | — | MODULE_SPEC §4 WF-019, §7 |
| EM-IMG-C37C4883 | P3 | Annotation SM-01 (draft→confirmed→resolved) not guarded for `ImagingAnnotation`; only `ImagingFinding` has `FINDING_TRANSITIONS` guard. Annotation status is free-form write. | `services/api-ts/src/handlers/dental-imaging/` | — | MODULE_SPEC §8, §5 BR-023-035 |

### New Findings (run-6)

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|----------|
| EM-IMG-FK-001 | P2 | `imaging_finding` schema has DB-level FKs to cross-module tables: `patientId.references(patients.id)`, `branchId.references(dentalBranches.id)`, `visitId.references(dentalVisits.id)` — violates §7b "no DB FKs to other modules". `treatmentId` (UUID-only) is the correct pattern. | `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts` | 64–66 | MODULE_SPEC §7b, §5 Loose Coupling |
| EM-IMG-FF-002 | P2 | Feature flags `dental_imaging_ceph_enabled` and `dental_imaging_auto_landmark` declared in MODULE_SPEC §18 are not wired anywhere — no flag check in handlers or config. The `imagingTier` runtime check exists but is a DB lookup, not a feature flag. | `services/api-ts/src/handlers/dental-imaging/` | — | MODULE_SPEC §18 |
| EM-IMG-DM-003 | P2 | Edge case MODULE_SPEC §13: "Calibration not set before landmark placement → 422 NOT_CALIBRATED" not enforced. `batchUpsertCephLandmarks` and `updateCephLandmark` allow placement with `calibrationMethod = 'not_calibrated'`; they set `uncalibrated: true` in result but do not reject with 422. | `services/api-ts/src/handlers/dental-imaging/batchUpsertCephLandmarks.ts` | 54–73 | MODULE_SPEC §13, §15 |

---

## F2: Service-Layer / DI Assessment

### Pattern Verdict: PARTIAL

**What exists:**

Three distinct repository classes are properly implemented:

- `ImagingRepository` (`repos/imaging.repo.ts`) — studies, images, teeth, annotations, calibration
- `ImagingCephRepository` (`repos/imaging_ceph.repo.ts`) — ceph landmarks, analyses, reports
- `ImagingFindingRepository` (`repos/imaging_finding.repo.ts`) — imaging findings CRUD + FSM

All repo classes follow the standard pattern: constructor-injected `DatabaseInstance`, typed methods, Drizzle ORM only (no raw SQL), typed return shapes.

**What's missing:**

No `.service.ts` files exist. No DI container. No singletons exported. Every handler instantiates repos directly on each request:

```typescript
// Repeated in createImagingStudy.ts, getCephAnalysis.ts, batchUpsertCephLandmarks.ts, etc.
const db = ctx.get('database') as DatabaseInstance;
const imagingRepo = new ImagingRepository(db);
const cephRepo = new ImagingCephRepository(db);
```

This pattern appears in **all 20+ handlers** (confirmed via grep across the module). Each HTTP request allocates fresh repo instances. No shared business logic layer beyond what each individual handler contains.

**Ceph math isolation:**

`computeCephAnalysis` from `@monobase/ceph-math` (external package) is called directly in 4 handlers: `batchUpsertCephLandmarks`, `getCephAnalysis`, `recomputeCephAnalysis`, `createCephReport`. The math engine is correctly isolated as a package — not inlined in handlers. This is the right pattern.

**Handler fatness:**

Handlers are moderately fat: each one orchestrates the full pipeline (fetch image → fetch study → assert auth → check imaging tier → call repo(s) → call math engine → build response). No raw Drizzle queries inline. All DB access goes through repo methods. The `image→study→assertBranch→tierCheck` block (~15 lines) is duplicated verbatim in every ceph handler (~8 files).

**Recommended fix (P2):**

Create `imaging.service.ts` exporting:
```typescript
// Singleton pattern (db injected at app startup)
export const imagingService = new ImagingService(db);

// Shared helper to DRY the repeated fetch-auth chain:
async resolveImageWithAuth(ctx, imageId, roles?, requireCephTier?)
  → { image, study, imagingRepo, cephRepo }
```

This would eliminate the ~120 lines of duplicated boilerplate across ceph handlers.

---

## Public API Completeness Inventory

Contract declares 9 endpoints. Registered routes cover 1 exactly; 8 are mismatched or absent.

| Contract Endpoint | Registered? | Notes |
|-------------------|-------------|-------|
| `POST /dental/imaging/studies` | FOUND | Exact match |
| `GET /dental/imaging/studies` | MISSING | Only `GET /studies/:studyId` registered |
| `POST /dental/imaging/studies/:id/images` | MISSING | No study-scoped image-add route |
| `POST /dental/imaging/studies/:id/annotations` | MISSING | No annotation create handler exists |
| `PATCH /dental/imaging/studies/:id/annotations/:aid` | MISSING | No annotation update handler exists |
| `POST /dental/imaging/studies/:id/findings` | MISSING (remodeled) | Impl: `POST /images/:imageId/findings` |
| `POST /dental/imaging/ceph-analyses` | MISSING (remodeled) | Impl: `GET /images/:imageId/ceph/analysis` |
| `PUT /dental/imaging/ceph-analyses/:id/landmarks` | MISSING (remodeled) | Impl: `POST /images/:imageId/ceph/landmarks` (wrong verb) |
| `POST /dental/imaging/ceph-analyses/:id/recompute` | MISSING (remodeled) | Impl: `POST /images/:imageId/ceph/analysis/recompute` |

**Note on "remodeled" items:** The implementation follows a more RESTful image-scoped design (`/images/:imageId/ceph/…`) that likely reflects TypeSpec evolution since `API_CONTRACTS.md` was written. If the TypeSpec-generated routes are the current source of truth, then `API_CONTRACTS.md` should be updated and these P1s downgraded to P2 (contract drift). The list-studies gap and annotation gaps remain genuine P1 missing features regardless.

---

## Auth / Route Protection Inventory

- All 20 registered imaging routes include `authMiddleware()` as first middleware — **no unprotected routes found (P0 clear)**
- Branch access enforced in every handler via `assertBranchAccess` or `assertBranchRole`
- Tenant isolation enforced via `image→study.branchId` chain — no direct branchId parameter trust
- `staff_full` role omitted from all imaging handlers (P1 gap on GET studies)

---

## Workflow Coverage

| Workflow | Handler | Status |
|----------|---------|--------|
| WF-019 Upload Study | `createImagingStudy.ts` | PARTIAL — study created, presigned URL generated; `study_date` not captured |
| WF-020 Annotate Radiograph | `createMeasurement.ts`, `ImagingRepository.createAnnotation` | PARTIAL — measurements work; annotation create/update endpoints missing |
| WF-040 Record Imaging Finding | `createFinding.ts`, `updateFinding.ts`, `listFindings.ts` | IMPLEMENTED |
| WF-030 Run Ceph Analysis | `getCephAnalysis.ts`, `recomputeCephAnalysis.ts` | IMPLEMENTED (tier-gated) |
| WF-031 Place Ceph Landmarks | `batchUpsertCephLandmarks.ts`, `updateCephLandmark.ts` | IMPLEMENTED (tier-gated) |

---

## Section-by-Section Checklist

| Section | Status | Notes |
|---------|--------|-------|
| §1 Overview | PASS | Study mgmt, annotations, ceph analysis, findings all implemented |
| §2 Domain Terms | PASS | All 6 terms correctly named throughout codebase |
| §3 Workflows | PARTIAL | WF-019/040/030/031 implemented; WF-020 PARTIAL (no annotation endpoints) |
| §4 Workflow Details | PARTIAL | WF-019 missing study_date; WF-020 missing annotation PATCH; WF-030/031 fully implemented |
| §5 Business Rules | PARTIAL | BR-016c (tier gate) enforced; loose coupling violated in finding schema (EM-IMG-FK-001) |
| §6 Permissions | PARTIAL | authMiddleware on all routes; staff_full role gap (EM-IMG-1973EF93) |
| §7 Data Requirements | PARTIAL | All 4 core + 3 ceph tables present; study_date missing |
| §7b Aggregate Boundaries | FAIL | `imaging_finding` has DB FKs to patients, dental_branches, dental_visits (EM-IMG-FK-001) |
| §8 State Transitions | PARTIAL | SM-01 guarded for Finding; SM-02 fully guarded; Annotation SM-01 unguarded |
| §9 UI/UX | NOT AUDITED | Frontend out of scope for this run |
| §10 API | PARTIAL | 21 routes registered; GET list missing; annotation endpoints missing |
| §10b Domain Events | FAIL | DE-018/019/020 declared, none emitted |
| §11 Acceptance Criteria | PARTIAL | AC-IMG-001 (403 free tier) tested; AC-IMG-004 (presigned URL) implemented; AC-IMG-002/003 not explicitly labeled |
| §12 Test Expectations | PASS | `imaging.test.ts`, `ceph.test.ts`, `imaging-coverage.test.ts`, `imaging-finding.fsm.property.test.ts`, `ceph-landmark.fsm.property.test.ts` all present |
| §13 Edge Cases | PARTIAL | MIME 422 implemented; wrong-branch 403 implemented; NOT_CALIBRATED 422 missing (EM-IMG-DM-003) |
| §14 Dependencies | PARTIAL | Storage (presigned URL) integrated; dental-org (branch) integrated; loose coupling violated |
| §15 Error Handling | PARTIAL | 403 tier + 404 missing implemented; 422 NOT_CALIBRATED missing |
| §16 Performance | NOT AUDITED | Pagination not verified |
| §17 Observability | PARTIAL | `logger.info` in ceph handlers; no structured event logging for DE-018/019/020 |
| §18 Feature Flags | FAIL | Both flags declared, neither wired (EM-IMG-FF-002) |
| §19 Vertical Slice Plan | PASS | v1.3 (core imaging) + v1.4 (ceph) both implemented |
| §20 AI Instructions | PARTIAL | ceph-math isomorphic; repo pattern exists; DI/singleton not adopted |

---

## Stabilization Plan

| Priority | Action |
|----------|--------|
| **Fix now (P1)** | Add `GET /dental/imaging/studies` list endpoint with `branch_id` + `patient_id` query params and pagination |
| **Fix now (P1)** | Add annotation create (`POST`) and update (`PATCH`) handlers, or update API_CONTRACTS.md to formally drop them |
| **Fix now (P1)** | Add `study_date` column to `imaging_study` schema + migration + update `createImagingStudy` body parsing |
| **Fix now (P1)** | Emit `DE-018` after first image added to study; `DE-019` when finding status→confirmed; `DE-020` on ceph recompute |
| **Fix now (P1)** | Add `staff_full` to allowed roles in imaging read handlers |
| **Fix soon (P2)** | **NEW** Remove `.references()` on `patientId`, `branchId`, `visitId` in `imaging_finding.schema.ts`; use UUID-only like `treatmentId` (EM-IMG-FK-001) |
| **Fix soon (P2)** | **NEW** Wire `dental_imaging_ceph_enabled` + `dental_imaging_auto_landmark` feature flags into config + handlers (EM-IMG-FF-002) |
| **Fix soon (P2)** | **NEW** Add 422 NOT_CALIBRATED gate in `batchUpsertCephLandmarks` and `updateCephLandmark` (EM-IMG-DM-003) |
| **Fix when touching (P2)** | Resolve URL scheme divergence: update API_CONTRACTS.md to match TypeSpec-generated `/images/:imageId/…` paths |
| **Fix when touching (P2)** | Create `imaging.service.ts` singleton + `resolveImageWithAuth` shared helper to DRY 20+ handler boilerplates |
| **Track (P3)** | Add status transition guard to `ImagingAnnotation` PATCH once annotation endpoints are built |

---

## What's New Since run-5

| Change | Detail |
|--------|--------|
| SM-02 (ceph landmark) fully guarded — CONFIRMED | `updateCephLandmark.ts` uses `CEPH_LANDMARK_TRANSITIONS`; locked-coordinate rejection implemented |
| `@monobase/ceph-math` isomorphic — CONFIRMED | Pure TS, no DOM runtime deps; `DOMPoint` only in test oracle file |
| `ceph_session` table — NOT A GAP | MODULE_SPEC §7 lists 3 ceph tables only; `ceph_session` was not in spec |
| EM-IMG-FK-001 (NEW P2) | `imaging_finding` schema has DB FK violations to cross-module tables |
| EM-IMG-FF-002 (NEW P2) | Feature flags declared in §18 not wired anywhere in implementation |
| EM-IMG-DM-003 (NEW P2) | NOT_CALIBRATED 422 gate missing from landmark placement handlers |

---

## What's Next

1. **3 new P2s** — EM-IMG-FK-001 (FK violations), EM-IMG-FF-002 (feature flags), EM-IMG-DM-003 (calibration gate) are net-new and actionable without prerequisites.
2. **List studies + annotations** — Genuine P1 gaps. Build `GET /studies` list handler and annotation CRUD.
3. **Event publishing** — Wire DE-018/019/020. Required for audit compliance and score improvement.
4. **Re-run** after events + annotations + new P2s resolved — expected score 68–74/100.
