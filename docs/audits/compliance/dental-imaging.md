# Compliance Report — dental-imaging

---
Audit Date: 2026-05-30
Dimension: compliance (single-module slice)
Module Audited: dental-imaging
Spec Version: MODULE_SPEC 1.0 (2026-05-24); API_CONTRACTS 1.0 (2026-05-24)
Auditor: oli-check compliance dimension
Aligned-to: docs/audits/codebase-map/ (CODE_ROUTE_MAP, CODE_API_SURFACE, CODE_DATA_MODEL, CODE_SPEC_TRACE)
---

## Generated Code Exclusion

`src/generated/` is excluded from violation findings. The module's HTTP routes are wired in `src/generated/openapi/routes.ts` (config-based registry strategy — confirmed by CODE_ROUTE_MAP "strategy: config-based"). Each route registers a `*Mgmt_*` wrapper (`registry.*`) that delegates to the hand-written bare-named handler (e.g. `ImagingMgmt_createImagingStudy.ts` → `createImagingStudy.ts`). Both layers are in scope and are NOT duplicates — the wrapper applies the generated `ValidatedContext` typing, the bare file holds business logic.

20 imaging routes + `GET /dental/patients/:patientId/images` are wired (routes.ts:606–751, 981). All have `authMiddleware()` + zod param/body validators.

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|---------------|
| MODULE_SPEC.md | YES | §3–10 (BR, AC, permissions, state, API, data) |
| API_CONTRACTS.md | YES | Step 8b (schema-level contract) |
| Knowledge graph (CODE_*) | YES | Structural ground truth (route wiring, data model) |

Files audited: all `handlers/dental-imaging/*.ts` (wrappers + bare handlers + repos + schemas), route registration in `generated/openapi/routes.ts` + `registry.ts`, tier gate `dental-org/repos/org-imaging.facade.ts`, tests (`imaging.test.ts`, `ceph.test.ts`, `ceph-business-rules.test.ts`, FSM property tests, `imaging-integration.test.ts`), frontend `apps/dentalemon/src/features/imaging/**` (hooks, components, upload).

---

## Executive Summary

- **P0 violations:** 0
- **P1 violations:** 0
- **P2 violations:** 4
- **P3 violations:** 3
- The module is in strong compliance. Every mutating route enforces auth + `assertBranchRole(['dentist_owner','dentist_associate'])`; reads enforce `assertBranchAccess`. Branch isolation returns 404 (no info leak), tested. SM-01 (finding) and SM-02 (landmark) transition tables match the spec exactly and reject illegal transitions with 422. BR-016c tier gate (`!== 'addon'`) is enforced on study-create (cephalometric), measurements, and every ceph endpoint, with tests. AC-IMG-001…005 are all implemented and tested. AC-IMG-004 (S3 URL, not raw data) is satisfied via the presigned-upload pattern in `createImagingStudy` + FE `use-imaging-upload.ts`. Domain-event audit markers (DE-018/019/020) are written via `logAuditEvent` per ADR-006.
- Residual issues are all P2/P3: creator-only edit not enforced on findings/annotations, image soft-delete doesn't cascade-hide child rows, FE mutations log instead of surfacing errors, and a few minor contract/audit field drifts.

---

## Step 3 — Business Rules

| Rule | Status | Severity | Evidence |
|------|--------|----------|----------|
| BR-016c (imagingTier gates ceph; `!== 'addon'`) | ENFORCED everywhere | — | `createImagingStudy.ts:59-72` (cephalometric study create), `createMeasurement.ts:145-153` (measurement types), `batchUpsertCephLandmarks.ts:54-64`, `updateCephLandmark.ts:50-60`, `deleteCephLandmark.ts:41-51`, `recomputeCephAnalysis.ts:45-55`, `getCephAnalysis.ts:43-53`, `createCephReport.ts:48-58`. Mapping correct (free/basic → 403). |
| SM-01 finding transitions (draft→confirmed→resolved, no back-edge) | ENFORCED | — | `imaging_finding.schema.ts:61-65` FINDING_TRANSITIONS; `updateFinding.ts:69-77`. |
| SM-02 landmark transitions (not_placed→placed→…→locked) | ENFORCED | — | `imaging_ceph.schema.ts:143-148`; `updateCephLandmark.ts:74-82`; locked is terminal, coords immutable (`:66-71`). |
| Loose coupling (no cross-module DB FKs) | ENFORCED | — | `imaging.schema.ts` patientId/visitId/branchId/acquiredBy are plain `uuid()` (comments mark loose-coupling); only intra-module FKs (image→study, annotation→image). |
| BR-027 (associates delete only own-acquired images) | ENFORCED | — | `deleteImage.ts:40-44`. |
| BR-034 (MIME allowlist on upload) | ENFORCED | — | `createImagingStudy.ts:42-47` → 422 UNSUPPORTED_MIME_TYPE. |
| WF-020 "only the creator may edit" annotations/findings | MISSING (branch-role enforced instead) | P2 (V-IMG-001) | `updateFinding.ts` / `createMeasurement.ts` enforce branch role but never compare `createdBy`/`acquiredBy` to `user.id`. Any branch dentist may edit another's finding/annotation. Lower than P1: clinical PHI edited by co-located dentists is plausibly intended; spec wording vs. clinical norm is ambiguous. |

## Step 4 — Acceptance Criteria

| AC | Status | Test |
|----|--------|------|
| AC-IMG-001 (ceph w/o tier → 403) | TESTED + ENFORCED | `imaging.test.ts:287` study-create; `ceph.test.ts:382,398,412,422` ceph endpoints + null-tier. |
| AC-IMG-002 (finding confirmed→draft → 422) | TESTED + ENFORCED | `imaging-finding.fsm.property.test.ts`; transition table rejects. |
| AC-IMG-003 (landmark placed→not_placed → 422) | TESTED + ENFORCED | `ceph-landmark.fsm.property.test.ts`; `CEPH_LANDMARK_TRANSITIONS.placed` has no `not_placed`. |
| AC-IMG-004 (images in S3; URL not raw data) | TESTED + ENFORCED | `createImagingStudy.ts:85-88` returns presigned `uploadUrl` (not bytes); FE PUTs to it (`use-imaging-upload.ts:58`). |
| AC-IMG-005 (list scoped to branch) | TESTED + ENFORCED | `listPatientImages.ts:78-81` `assertBranchAccess` + `listImagingImagesForPatient` filters `branch_id`; `ceph.test.ts:441` branch isolation → 404. |

## Step 5 — Permissions

| Action | Expected | Actual | Status |
|--------|----------|--------|--------|
| Create/update/delete study·measurement·finding·ceph | dentist_owner, dentist_associate | `assertBranchRole([owner,associate])` on every write | COMPLIANT |
| View studies·images·findings·landmarks | all dental roles, branch-scoped | reads use `assertBranchAccess` (no role narrowing) | COMPLIANT (matches "View: all dental roles") |
| Edit own annotation/finding | Own (creator) | branch-role only; ownership not checked | V-IMG-001 (P2) |

No route lacks auth. Branch isolation returns 404 not 403 (no existence leak) — verified in tests (EF-IMG-001/003/004/005).

## Step 8 / 8b — API Contract Compliance

All contract endpoints exist (image-centric form ratified by spec §10 V-IMG-009; the contract's `/ceph-analyses` resource naming is the only drift, documented below).

| Check | Status | Severity |
|-------|--------|----------|
| All endpoints wired with method+path+validators | YES (routes.ts:606–751,981) | — |
| Auth requirement enforced | YES (authMiddleware + handler branch guard) | — |
| Contract `image_count` field on study response | MISSING — `getImagingStudy` returns `images[]` (length derivable) but no `image_count`; create returns raw `study` row (no `image_count`) | P2 (V-IMG-002) |
| Contract resource naming `POST /ceph-analyses`, `PUT /ceph-analyses/:id/landmarks` | implemented image-centric (`images/:imageId/ceph/*`); spec §10 V-IMG-009 ratifies image-centric → API_CONTRACTS.md is stale | P3 (V-IMG-005) |
| Contract `analysis_type` enum `steiner|ricketts|tweed|mcnamara` | code/DB enforce single value `steiner_hybrid_sn` (matches MODULE_SPEC §7); API_CONTRACTS multi-value list is stale | P3 (V-IMG-006) |

## Step 9 — State Transitions

SM-01 and SM-02 transition tables exactly match spec forward-only/terminal constraints; illegal transitions → 422 INVALID_STATUS_TRANSITION; locked-landmark coordinate/delete edits → 422 LANDMARK_LOCKED. Annotations correctly carry no state machine (`visible` flag only, V-IMG-008 spec note). COMPLIANT.

## Step 10 — Data Validation

| Entity | Status |
|--------|--------|
| imaging_study create (modality enum, MIME allowlist) | ENFORCED (`createImagingStudy`) |
| measurement/annotation create (geometry discriminated union, tier gate, tooth bounds) | ENFORCED (`createMeasurement.ts:80-89,156-169`) |
| finding create + update (type enum, status enum, tooth 1–48, surfaces max 5, note max 5000) | ENFORCED (`createFinding.ts:22-35`, `updateFinding.ts:23-35`); repo uses `Pick` payload — no mass assignment |
| ceph landmark (code, x/y, status) | ENFORCED via wrapper zod validators + transition guard |

No update-measurement endpoint exists (create/list/delete only) — so there is no unvalidated update path.

## Step 10b — Schema / Data Integrity

| Check | Status | Severity |
|-------|--------|----------|
| `deleteImage` cascade | Image is SOFT-deleted (`archiveImage` → status='archived'). Child `imaging_annotation`, `imaging_finding`, `imaging_ceph_*` rows are NOT archived/filtered. `getCephAnalysis`/`listFindings`/`listByImage` query by `imageId` regardless of image status, so children of an archived image remain queryable/visible. | P2 (V-IMG-003) |

## Step 9c/9d — Event & Audit Contract

DE-018/019/020 are audit-only markers (ADR-006). All writes call `logAuditEvent`. DE-019 confirmed-marker is correctly distinguished: `createFinding.ts:94` and `updateFinding.ts:100` emit `imaging_finding.confirmed` vs `.create`/`.update` based on status. DE-020 → `imaging_ceph_analysis.computed` (`recomputeCephAnalysis.ts:106`). Minor: `getImagingStudy.ts:44-51` audit row omits the `branchId` field (sets `tenantId` only) and omits `eventType` — inconsistent with every other handler in the module. P3 (V-IMG-007).

## Step 6 — Terminology (module-local)

Entity/status terms align with spec. Only the two stale-contract drifts above (analysis_type enum, ceph resource naming). No P1/P2 terminology issues.

## Step 11c/11d — Frontend Error Boundary & Contract

- `use-ceph-landmarks.ts`: `commitLandmark` and `deleteLandmark` have `onError` (rollback) but `batchUpsert` and the analysis `query` do NOT surface errors to the user; a 403 tier-block or 422 transition is only thrown into TanStack state with no toast/UI. P2 (V-IMG-004).
- `use-imaging-findings.ts:85,107,120`: mutation `onError` handlers only `console.error('[imaging-findings]', e)` — no user-visible feedback. Part of V-IMG-004.
- `use-imaging-upload.ts`: re-throws on failure (caller must surface); acceptable but caller-dependent.
- Contract consistency: FE upload calls `/dental/imaging/studies` with org/branch context (`branchId` in body) — matches backend. No missing-header issues found.

---

## Findings (IDs)

| ID | Sev | Title | Location | Autofix |
|----|-----|-------|----------|---------|
| V-IMG-001 | P2 | WF-020 "only the creator may edit" not enforced for findings/annotations (branch-role only; `createdBy` never compared) | `handlers/dental-imaging/updateFinding.ts:58-62`, `createMeasurement.ts:133` | no |
| V-IMG-002 | P2 | Contract `image_count` field absent from study create/get responses | `handlers/dental-imaging/getImagingStudy.ts:53`, `createImagingStudy.ts:121-131` | no |
| V-IMG-003 | P2 | `deleteImage` soft-delete does not cascade/hide child annotations·findings·ceph rows (still queryable) | `handlers/dental-imaging/deleteImage.ts:46-47`, `repos/imaging.repo.ts` archiveImage | no |
| V-IMG-004 | P2 | FE ceph `batchUpsert`/analysis query and findings mutations swallow errors (console.error only / no error UI) → tier-block & transition errors invisible | `apps/dentalemon/src/features/imaging/hooks/use-ceph-landmarks.ts:143-161`, `use-imaging-findings.ts:85,107,120` | no |
| V-IMG-005 | P3 | API_CONTRACTS.md ceph resource naming (`/ceph-analyses`) stale vs ratified image-centric routes (spec §10 V-IMG-009) | `docs/product/modules/dental-imaging/API_CONTRACTS.md:185-258` | no (spec edit) |
| V-IMG-006 | P3 | API_CONTRACTS.md `analysis_type` enum (steiner/ricketts/tweed/mcnamara) stale vs implemented single `steiner_hybrid_sn` | `API_CONTRACTS.md:199`; `repos/imaging_ceph.schema.ts:46` | no (spec edit) |
| V-IMG-007 | P3 | `getImagingStudy` audit row omits `branchId` + `eventType` fields (inconsistent with module's other audit calls) | `handlers/dental-imaging/getImagingStudy.ts:44-51` | yes |

---

## Stabilization Plan

### Fix When Touching Module (P2)
1. V-IMG-001 — decide policy: if creator-only is intended, compare `finding.createdBy`/`annotation.createdBy` (or study.acquiredBy) to `user.id` and 403 otherwise (mirror the BR-027 pattern already in `deleteImage`); otherwise update the spec to state branch-dentist edit is allowed. Requires a CR decision.
2. V-IMG-002 — add `image_count` to study create + get responses (count of active images).
3. V-IMG-003 — when archiving an image, also archive/soft-hide child annotations·findings·ceph rows, and/or filter child queries by parent image status.
4. V-IMG-004 — surface errors: give `batchUpsert` an `onError` + error UI; replace `console.error` in `use-imaging-findings` with user-visible toasts; render `query.error` in the ceph workspace.

### Track (P3)
5-6. V-IMG-005/006 — refresh API_CONTRACTS.md to the ratified image-centric surface and the single `steiner_hybrid_sn` analysis type.
7. V-IMG-007 — add `branchId` + `eventType: 'data-access'` to the `getImagingStudy` audit call.

> Spec paradox: This audit validates code against specs. V-IMG-005/006 are cases where the *spec* (API_CONTRACTS.md) is stale relative to ratified MODULE_SPEC §10 decisions — the code is correct. Fix the contract doc, not the code.
> Correction note: an earlier draft of this slice flagged a missing image-upload route, a missing study-create tier gate, an unvalidated updateMeasurement, unwired duplicate handlers, and a stray `.orig` file. Full file reads against the config-based route registry disproved all five — they are recorded here as resolved/non-issues to prevent re-flagging.
