# dental-imaging — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary

- **Findings:** 14 (P0: 0, P1: 10, P2: 3, P3: 1)
- **Service-Layer Pattern:** PARTIAL — repo classes exist (`ImagingRepository`, `ImagingCephRepository`, `ImagingFindingRepository`), no service layer or DI singletons
- **Compliance Score:** 44/100

### Score Breakdown

| Dimension | Score | Cap Applied | Notes |
|-----------|-------|-------------|-------|
| Public API completeness | 3/10 | P1 cap | 8/9 contract endpoints mismatched or absent |
| Workflow implementation | 6/10 | — | WF-019/020/040/030/031 all have code paths; study_date gap in WF-019 |
| Domain term consistency | 9/10 | — | Terms used correctly; no ad-hoc synonyms found |
| State machine enforcement | 7/10 | — | SM-01 guarded for Finding; Annotation SM not guarded |
| Event publishing | 0/10 | P1 cap | All 3 declared events (DE-018/019/020) never emitted |
| Auth / permissions | 6/10 | — | authMiddleware on all routes; staff_full role gap on GET studies |
| F2 Service-Layer / DI | 4/10 | — | Repos exist but direct `new` in every handler; no singletons |

**Overall:** 44/100 — P1 cap applied to API completeness and events dims.

---

## Findings

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|----------|
| EM-IMG-144BE775 | P1 | `GET /dental/imaging/studies` list endpoint (patient_id filter, pagination) absent from registered routes — only `GET /studies/:studyId` exists | `services/api-ts/src/generated/openapi/routes.ts` | — | API_CONTRACTS §GET /api/v1/dental/imaging/studies |
| EM-IMG-152F9A95 | P1 | `POST /dental/imaging/studies/:id/annotations` (create annotation) has no handler or route registration | `services/api-ts/src/handlers/dental-imaging/` | — | API_CONTRACTS §POST /api/v1/dental/imaging/studies/:id/annotations |
| EM-IMG-C40244A4 | P1 | `PATCH /dental/imaging/studies/:id/annotations/:aid` (update annotation, status→confirmed) has no handler or route | `services/api-ts/src/handlers/dental-imaging/` | — | API_CONTRACTS §PATCH /api/v1/dental/imaging/studies/:id/annotations/:aid |
| EM-IMG-6A13895D | P1 | `POST /dental/imaging/ceph-analyses` not registered; impl models ceph under `/images/:imageId/ceph/…` breaking the contract resource model | `services/api-ts/src/generated/openapi/routes.ts` | — | API_CONTRACTS §POST /api/v1/dental/imaging/ceph-analyses |
| EM-IMG-8CD0FA81 | P1 | `PUT /dental/imaging/ceph-analyses/:id/landmarks` missing; impl has `POST /images/:imageId/ceph/landmarks` — wrong verb and URL | `services/api-ts/src/generated/openapi/routes.ts` | — | API_CONTRACTS §PUT /api/v1/dental/imaging/ceph-analyses/:id/landmarks |
| EM-IMG-3B53ABB3 | P1 | `study_date` field declared required in contract for `POST /studies` absent from `createImagingStudy` body parsing and from `imaging_study` schema (only `createdAt` exists) | `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts` | 22–37 | API_CONTRACTS §POST /studies body, MODULE_SPEC §7 |
| EM-IMG-1973EF93 | P1 | `staff_full` role permitted for `GET /dental/imaging/studies` per contract; no handler includes `staff_full` in `assertBranchRole` — read-only staff cannot list studies | `services/api-ts/src/handlers/dental-imaging/getImagingStudy.ts` | 28 | API_CONTRACTS §GET /studies Auth, ROLE_PERMISSION_MATRIX |
| EM-IMG-5A805E17 | P1 | `DE-018 ImagingStudyUploaded` declared published in MODULE_SPEC §10b; zero event emit/publish calls found in any imaging handler | `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts` | — | MODULE_SPEC §10b |
| EM-IMG-0435E807 | P1 | `DE-019 ImagingFindingConfirmed` declared published in MODULE_SPEC §10b and API_CONTRACTS (annotation PATCH); never emitted in `updateFinding` or any annotation handler | `services/api-ts/src/handlers/dental-imaging/updateFinding.ts` | — | MODULE_SPEC §10b, API_CONTRACTS §PATCH annotations |
| EM-IMG-8891E413 | P1 | `DE-020 CephAnalysisComputed` declared published in MODULE_SPEC §10b and API_CONTRACTS (recompute 202 response); never emitted in `recomputeCephAnalysis` or `batchUpsertCephLandmarks` | `services/api-ts/src/handlers/dental-imaging/recomputeCephAnalysis.ts` | — | MODULE_SPEC §10b, API_CONTRACTS §POST ceph-analyses/:id/recompute |
| EM-IMG-2404E9CE | P2 | Impl URL scheme (`/images/:imageId/…`) diverges from all contract URLs (`/studies/:id/…`, `/ceph-analyses/:id/…`) — 5 of 9 contract endpoints use incompatible base paths; API_CONTRACTS needs update or routes need aliases | `services/api-ts/src/generated/openapi/routes.ts` | — | API_CONTRACTS §Endpoints |
| EM-IMG-3796DC9D | P2 | All 20+ handlers instantiate repos directly: `new ImagingRepository(db)`, `new ImagingCephRepository(db)`, `new ImagingFindingRepository(db)` on every request — no singletons, no DI container | `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts` | 34–35 | MODULE_SPEC §20 AI Instructions |
| EM-IMG-04E1D56A | P2 | WF-019 step 2 requires `study_date` captured as study metadata; `imaging_study` DB schema has no `study_date` column (only `createdAt`), making retrospective date entry impossible | `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts` | — | MODULE_SPEC §4 WF-019, §7 Data Requirements |
| EM-IMG-C37C4883 | P3 | Annotation state machine (draft→confirmed→resolved, SM-01) not guarded for `ImagingAnnotation`; only `ImagingFinding` has FSM guard (`FINDING_TRANSITIONS`). Annotation status is a free-form write | `services/api-ts/src/handlers/dental-imaging/` | — | MODULE_SPEC §8, DOMAIN_MODEL SM-IMAGING-FINDING |

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

## Stabilization Plan

| Priority | Action |
|----------|--------|
| **Fix now (P1)** | Add `GET /dental/imaging/studies` list endpoint with `branch_id` + `patient_id` query params and pagination |
| **Fix now (P1)** | Add annotation create (`POST`) and update (`PATCH`) handlers, or update API_CONTRACTS.md to remove them if intentionally dropped |
| **Fix now (P1)** | Add `study_date` column to `imaging_study` schema + migration + update `createImagingStudy` body parsing |
| **Fix now (P1)** | Emit `DE-018` after first image added to study; emit `DE-019` when finding/annotation status→confirmed; emit `DE-020` on ceph recompute |
| **Fix now (P1)** | Add `staff_full` to allowed roles in imaging read handlers (`getImagingStudy`, `listFindings`, `listMeasurements`) |
| **Fix before new work (P1)** | Resolve URL scheme divergence: update API_CONTRACTS.md to match `/images/:imageId/…` paths (or add route aliases) |
| **Fix when touching (P2)** | Create `imaging.service.ts` singleton + `resolveImageWithAuth` shared helper to DRY 20+ handler boilerplates |
| **Fix when touching (P2)** | Confirm `study_date` schema column after P1 migration |
| **Track (P3)** | Add status transition guard to `ImagingAnnotation` PATCH once annotation endpoints are built |

---

## What's Next

1. **URL scheme decision** — Confirm whether API_CONTRACTS.md should be updated to match TypeSpec-generated `/images/:imageId/…` scheme. If yes, 5 P1s become P2 (contract drift) and score rises to ~58/100.
2. **List studies + annotations** — Genuine gaps. Build `GET /studies` list handler and annotation CRUD before v1.4 ships.
3. **Event publishing** — Wire lightweight event emit for DE-018/019/020. Required for audit compliance.
4. **Re-run** after URL scheme decision and event wiring — expected score 72–78/100.
