# Dental Gap Registry

Last updated: 2026-05-25 | Branch: feat/v1.5-g1-foundation | Run: 002

---

## GAP-DENTAL-001

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-001 |
| **Title** | BR-011 consent gate absent in createDentalInvoice |
| **Severity** | P1 — Major Release Blocker |
| **Area** | dental-billing / dental-clinical |
| **Type** | Business rule not enforced |
| **Status** | RESOLVED — 2026-05-25 (P1-001, commit 59d8abc) |

**Evidence:**
- `services/api-ts/src/handlers/dental-billing/billing-gate-http.test.ts` lines 1-15: explicit STOP CONDITION comment: "createDentalInvoice does NOT check for a signed consent form before creating an invoice. The handler only validates that performed/verified treatments exist."
- The test file states: "A test for 'invoice blocked without consent' cannot be written because the production code does not enforce this rule."
- `business-rules.test.ts` line 249: `BR-005: active→completed WITH treatments (performed) → NOT discarded, requires consent+notes` — consent IS checked for visit completion, but NOT for invoice creation.

**Impact:**
A clinic can create a dental invoice before the patient has signed a consent form. This is a clinical compliance risk and violates BR-011 per the module spec.

**Recommended Fix:**
In `createDentalInvoice.ts`: before creating the invoice, query `consent_form` table for a signed consent form for the patient/visit. If none exists, return 422 with code `CONSENT_REQUIRED`.

**Verification:**
Add test in `billing-gate-http.test.ts`: `createDentalInvoice blocked when no signed consent form exists`. Test must go RED before fix, GREEN after.

---

## GAP-DENTAL-002

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-002 |
| **Title** | No dental_chart_version table — past visit chart edits overwrite silently |
| **Severity** | P1 — Major Release Blocker |
| **Area** | dental-visit / data integrity |
| **Type** | Missing audit trail / data integrity |
| **Status** | RESOLVED — 2026-05-25 (P1-002, commit 1e61bd5) |

**Evidence:**
- `CAROUSEL-CONCEPT.md §10/G2`: "A clinician who edits a tooth on a past `active` visit silently overwrites the historical snapshot with no audit trail."
- `dental-chart.schema.ts`: `dentalCharts` has `teeth` JSONB column with no version table alongside it. Comment explicitly states: "no version column — contrast: visitNoteVersions has unique(noteId, version) and is never updated."
- `visit_note_version` table exists (append-only) but `dental_chart` has no equivalent.

**Impact:**
A clinician editing a tooth on any non-locked visit permanently overwrites the chart state. There is no way to detect or recover from inadvertent or malicious chart edits. This is a P1 data integrity risk for a clinical system.

**Recommended Fix:**
Create `dental_chart_version` table (append-only, mirroring `visit_note_version` pattern). On every `upsertDentalChart` call, insert a version row with a snapshot. The `dental_chart` row can still be updated in-place for the active snapshot, but versions provide auditability.

**Verification:**
Migration + repo test: upsert chart twice → `dental_chart_version` has 2 rows. Past versions queryable. Completed/locked visit chart cannot be mutated.

---

## GAP-DENTAL-003

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-003 |
| **Title** | Treatment save error silently swallowed in frontend (G8) |
| **Severity** | P1 — Major Release Blocker |
| **Area** | frontend / dental workspace |
| **Type** | Silent failure — clinical action |
| **Status** | RESOLVED — 2026-05-25 (P1-003, commit ef82e2c) |

**Evidence:**
- `CAROUSEL-CONCEPT.md §10/G8`: "Treatment save error silently swallowed — The `saveTreatmentMutation.onError` callback is a no-op. A failed treatment save (network error, 422 from FSM guard, 500) gives the clinician no feedback."
- `features/workspace/hooks/use-save-treatment.ts` exists but G8 was documented as unresolved in the carousel concept doc.

**Impact:**
A clinician saves a treatment (e.g., marks a tooth as "performed"). If the save fails, the UI gives no error feedback. The clinician believes the save succeeded. The dental record is incorrect. This is a P1 clinical safety UX risk — silent failure of a clinical record action.

**Recommended Fix:**
In `use-save-treatment.ts` (and `use-save-chart.ts` if same pattern): add `onError` handler that displays a toast/alert. Message: "Treatment could not be saved. Please try again." Log the error. Verify the mutation's `isError` state is surfaced to the user.

**Verification:**
Component test for `treatment-table.tsx`: mock API to return 422 → verify error toast appears. Playwright E2E: simulate network failure during treatment save → verify error message visible.

---

## GAP-DENTAL-004

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-004 |
| **Title** | E2E CI runs with continue-on-error: true — failures don't block |
| **Severity** | P1 — Major Release Blocker |
| **Area** | CI/CD |
| **Type** | CI reliability / release gate |
| **Status** | RESOLVED — 2026-05-25 (P1-004, commit 82ec9e6) |

**Evidence:**
- `.github/workflows/quality.yml` e2e job: `continue-on-error: true` — explicit flag prevents E2E failures from blocking CI.
- Comment in workflow: "structural: E2E job has no backend; journey-verification covers real E2E with postgres+seed."
- However, `journey-verification` job's CI gate behavior was not confirmed as actually blocking.

**Impact:**
If E2E tests regress (e.g., a frontend workflow breaks), CI passes and the change can be merged. The journey-verification job may catch this, but if it too runs without backend infrastructure in CI, regressions can ship undetected.

**Recommended Fix:**
Either (a) fix the E2E job to run against a real backend in CI (add postgres service + seed), or (b) confirm the `journey-verification` job is a hard-fail gate and document it explicitly. Remove `continue-on-error: true` from whichever job provides the authoritative E2E gate.

**Verification:**
Introduce a deliberate regression in a workspace component, push to a test branch, verify CI fails.

---

## GAP-DENTAL-005

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-005 |
| **Title** | No SLICE_SPEC.md or TDD_PROOF.md anywhere in repository |
| **Severity** | P2 — Process Debt |
| **Area** | OLI pipeline / process |
| **Type** | Missing OLI artifact |
| **Status** | OPEN |

**Evidence:**
- `find docs/execution -type f` — docs/execution/ directory does not exist.
- `find . -path '*/slices/*' -type f` — no results.
- `.planning/phases/` contains plan summaries and reviews but no SLICE_SPEC.md or TDD_PROOF.md files per the oli-execution-gate format.

**Impact:**
Cannot formally verify that AC/BR items were tested before implementation for any slice. TDD proof cannot be independently audited. Downstream tools (oli-confidence-stack, oli-audit-compliance) cannot verify git-history test-before-implementation ordering.

**Note:** This is P2 (not P1) because: (a) tests exist and are substantial, (b) the project graduated at 9.0/10 using an earlier process, and (c) missing slice spec format is historical process debt rather than a code correctness issue.

**Recommended Fix:**
For G1 and future phases: create `docs/execution/slices/{slice-name}/SLICE_SPEC.md` and `TDD_PROOF.md` per oli-execution-gate format before executing each slice.

---

## GAP-DENTAL-006

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-006 |
| **Title** | N+1 query in getToothHistory endpoint (G6) |
| **Severity** | P2 — Performance Risk |
| **Area** | dental-visit / backend |
| **Type** | Query performance |
| **Status** | OPEN |

**Evidence:**
- `CAROUSEL-CONCEPT.md §8`: "G6 visible here: 30 visits = 60 sequential database round-trips (chart + treatments per visit). No batch query, no JOIN."
- `getToothHistory.ts` lines 42-77: `for (const visit of completedVisits)` loop with two `await` statements per iteration.

**Impact:**
A patient with 30+ visits (common in dental care) triggers 60+ sequential DB queries for tooth history. Noticeable latency in the tooth history panel of the carousel.

**Recommended Fix:**
Batch-fetch all charts and treatments for the patient in two queries, then join in-memory. Or use a single SQL JOIN across `dental_chart`, `dental_treatment`, and `dental_visit` filtered by patient + toothNumber.

---

## GAP-DENTAL-007

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-007 |
| **Title** | dental-emr module spec has INFERRED-only workflows; no backend handler |
| **Severity** | P2 — Spec Completeness |
| **Area** | dental-emr / product |
| **Type** | Spec ahead of implementation |
| **Status** | OPEN |

**Evidence:**
- `docs/product/modules/dental-emr/MODULE_SPEC.md`: spec_version 1.0, generated 2026-05-24.
- Workflows: WF-100 [INFERRED] and WF-101 [INFERRED] only.
- No `services/api-ts/src/handlers/dental-emr/` directory exists.

**Impact:**
dental-emr appears in the module map but has no implementation. The spec was auto-generated with inferred workflows. Until this module is scoped and implemented, the product gap exists.

**Recommended Fix:**
Either (a) define concrete workflows for dental-emr (external record import/view) and schedule implementation, or (b) mark the module as `PLANNED` / `FUTURE_PHASE` in MODULE_MAP.md so it doesn't imply current implementation.

---

## GAP-DENTAL-008

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-008 |
| **Title** | dental-perio sparse backend test coverage |
| **Severity** | P2 — Test Confidence |
| **Area** | dental-perio / tests |
| **Type** | Insufficient test coverage for clinical module |
| **Status** | OPEN |

**Evidence:**
- `find services/api-ts/src/handlers/dental-perio -name '*.test.ts'` — one result: `repos/perio-chart.repo.test.ts`.
- No handler-level tests for `createPerioChart`, `upsertToothReading`, `completePerioChart`, `getVisitPerioChart`.
- No FSM property test for perio chart state transitions.
- No RBAC/tenancy test for perio endpoints.

**Impact:**
Periodontal charting is a clinical feature. Treatment decisions and gum disease tracking depend on accurate perio records. Lack of handler tests means business rules (e.g., cannot complete a chart with missing readings, visit linkage, branch access) are unverified at the handler level.

**Recommended Fix:**
Add `dental-perio-coverage.test.ts` covering: createPerioChart, upsertToothReading, completePerioChart, getVisitPerioChart, branch access enforcement, and the perio FSM transitions (draft → active → completed).

---

## GAP-DENTAL-009

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-009 |
| **Title** | Pediatric charting unwired in frontend (G11) |
| **Severity** | P2 — Product Completeness |
| **Area** | frontend / dental-visit |
| **Type** | Feature incomplete |
| **Status** | OPEN |

**Evidence:**
- `CAROUSEL-CONCEPT.md §10/G11`: "Pediatric charting unwired — backend accepts toothNumber 1-20 for primary dentition; the FDI component (`universal-tooth-fdi.tsx`) supports pediatric. But the workspace never switches to a 20-tooth layout; `initializeDentition` has a `dentitionType` param but the frontend always sends `permanent`."
- `features/workspace/components/dental/universal-tooth-fdi.tsx` exists but pediatric routing is unimplemented.

**Impact:**
Pediatric patients (a significant portion of dental practice) cannot have correct pediatric dentition charted. All patients use adult (32-tooth) layout regardless of age.

---

## GAP-DENTAL-010

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-010 |
| **Title** | dental-emr vs dental-visit module boundary naming confusion |
| **Severity** | P2 — Architecture Clarity |
| **Area** | product / architecture |
| **Type** | Module boundary |
| **Status** | OPEN |

**Evidence:**
- Product layer has `dental-emr` as a module (with MODULE_SPEC, API_CONTRACTS, UI blueprint).
- Backend implementation layer has `dental-visit` which handles the EMR-like functionality (visits, charts, treatments, notes).
- `dental-emr` MODULE_SPEC overview describes "integrated EMR module" but workflows are INFERRED only.
- No mapping between `dental-emr` spec and `dental-visit` implementation in any document.

**Impact:**
Developers and auditors cannot tell whether `dental-emr` is a future feature, a rename of `dental-visit`, or a separate integration layer. This ambiguity creates spec drift risk.

**Recommended Fix:**
Document explicitly: is `dental-emr` the product-layer name for what `dental-visit` implements? If yes, align names or create a mapping doc. If `dental-emr` is a separate future module (external EMR import), mark it `FUTURE_PHASE`.

---

## GAP-DENTAL-011

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-011 |
| **Title** | G1 foundation phase has no CONTEXT.md or PLAN.md |
| **Severity** | P2 — Process / Current Branch |
| **Area** | .planning / G1 |
| **Type** | Incomplete phase planning artifact |
| **Status** | OPEN |

**Evidence:**
- `ls .planning/phases/G1-foundation-stabilization/` — only `G1-RESEARCH.md` found.
- No `G1-CONTEXT.md`, `G1-PLAN.md`, or `G1-VERIFICATION.md`.
- Current branch is `feat/v1.5-g1-foundation` — this phase is actively being executed.

**Impact:**
Cannot verify what G1 is supposed to achieve, which files it touches, or what the acceptance criteria are. Makes it impossible to verify G1 is complete.

---

## GAP-DENTAL-012

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-012 |
| **Title** | Manual route overrides shadow generated routes in app.ts |
| **Severity** | P2 — Architecture Debt |
| **Area** | services/api-ts / app.ts |
| **Type** | Fragile routing pattern |
| **Status** | OPEN |

**Evidence:**
- `app.ts` lines 107-130: "Override routes where generated zValidator rejects string path params for int32 fields. These manual routes shadow the generated ones (Hono matches first-registered)."
- Three manual routes: `/dental/branches`, `/dental/visits/history/:patientId/teeth/:toothNumber`, `/dental/admin/audit`.
- These were added because the TypeSpec-generated validators incorrectly typed path params as int32 instead of string/UUID.

**Impact:**
The TypeSpec → generated validators → manual override chain means these three routes bypass the OpenAPI validation pipeline. If the TypeSpec schema is updated, the manual overrides may become stale or contradictory without the compiler catching it. Increases maintenance surface.

**Recommended Fix:**
Fix the TypeSpec definition to correctly type the path params (as string/UUID), regenerate, and remove the manual overrides from app.ts.

---

## GAP-DENTAL-013

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-013 |
| **Title** | panelOpen prop dead-coded in tooth slideout (G9) |
| **Severity** | P3 — Advisory |
| **Area** | frontend / workspace |
| **Type** | Dead code |
| **Status** | OPEN |

**Evidence:**
- `CAROUSEL-CONCEPT.md §10/G9`: "`panelOpen` prop is dead-coded — The `ToothSlideout` component accepts `panelOpen` but uses internal `open` state from a `useState`; the prop never overrides it."

---

## GAP-DENTAL-014

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-014 |
| **Title** | Incomplete tooth state legend (G10) |
| **Severity** | P3 — Advisory |
| **Area** | frontend / dental-chart |
| **Type** | UI completeness |
| **Status** | OPEN |

**Evidence:**
- `CAROUSEL-CONCEPT.md §10/G10`: "Incomplete legend — `showLegend` renders only 5 of 9 `toothStateEnum` values. `implant`, `extracted`, `watchlist` are missing from the colour legend."

---

## GAP-DENTAL-015

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-015 |
| **Title** | Time-lapse playback not implemented (G3) |
| **Severity** | P3 — Future Feature |
| **Area** | frontend / carousel |
| **Type** | Feature deferred |
| **Status** | OPEN |

**Evidence:**
- `CAROUSEL-CONCEPT.md §10/G3`: No `useTimelapse` hook, no Play/pause button, no speed control.

---

## GAP-DENTAL-016

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-016 |
| **Title** | Year-grouping tabs not implemented (G4) |
| **Severity** | P3 — Future Feature |
| **Area** | frontend / carousel |
| **Type** | Feature deferred |
| **Status** | OPEN |

**Evidence:**
- `CAROUSEL-CONCEPT.md §10/G4`: Year-grouping tabs described in design doc; `year-segment-control.tsx` component EXISTS but integration into carousel is incomplete.

---

## GAP-DENTAL-017

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-017 |
| **Title** | No reduced-motion fallback for carousel animations (G5) |
| **Severity** | P3 — Accessibility |
| **Area** | frontend / carousel |
| **Type** | Accessibility |
| **Status** | OPEN |

**Evidence:**
- `CAROUSEL-CONCEPT.md §10/G5`: No `prefers-reduced-motion` media query check on the Swiper CoverFlow effect configuration.

---

## GAP-DENTAL-018

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-018 |
| **Title** | Tamper-evidence for chart versions deferred (G12) |
| **Severity** | P3 — Future Phase |
| **Area** | dental-visit / data integrity |
| **Type** | Security feature deferred |
| **Status** | OPEN |

**Evidence:**
- `CAROUSEL-CONCEPT.md §10/G12`: "Tamper-evidence deferred — the design doc mentioned HMAC signing of chart snapshots for tamper-detection. Not implemented. Not blocking."

---

---

## GAP-DENTAL-019

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-019 |
| **Title** | dental-imaging module is too broad — ceph analysis is a distinct subdomain |
| **Severity** | P2 — Architecture |
| **Area** | dental-imaging / module boundary |
| **Type** | Module boundary (SPLIT) |
| **Status** | OPEN |

**Evidence:**
- `services/api-ts/src/handlers/dental-imaging/` contains two clearly separated naming groups: `CephMgmt_*.ts` (10 files: batch upsert landmarks, create/get/list ceph reports, delete landmark, get ceph analysis, recompute) and `ImagingMgmt_*.ts` + `ImagingFindingsMgmt_*.ts` (basic imaging).
- dental-imaging MODULE_SPEC §5: ceph analysis is gated by `imagingTier = cbct` — different clinical workflow, different training requirement, different regulatory context.
- FSM tests are split: `ceph-landmark.fsm.property.test.ts` vs `imaging-finding.fsm.property.test.ts`.

**Impact:**
Developers adding basic imaging features wade through ceph landmark/analysis code. Ceph-specific bugs (landmark math, analysis recompute) are tested in the same test file as bitewing uploads. The module is already architecturally diverging in its naming.

**Recommended Fix:**
Create `handlers/dental-ceph/` and move all `CephMgmt_*.ts` handlers + `ceph.test.ts` + `ceph-landmark.fsm.property.test.ts` there. Update router registration in app.ts. Create `docs/product/modules/dental-ceph/MODULE_SPEC.md` (split from dental-imaging §4 WF-030/WF-031).

---

## GAP-DENTAL-020

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-020 |
| **Title** | dental-emr spec is a zombie — no implementation, purpose ambiguous, conflicts with dental-visit |
| **Severity** | P2 — Architecture Clarity |
| **Area** | dental-emr / module boundary |
| **Type** | Module boundary (RENAME + FUTURE_PHASE) |
| **Status** | OPEN |

**Evidence:**
- `services/api-ts/src/handlers/dental-emr/` does NOT exist.
- `docs/product/modules/dental-emr/MODULE_SPEC.md` exists with INFERRED-only workflows, no concrete endpoints.
- `dental-visit` IS the dental EMR in practice — it manages visit lifecycle, charting, treatments, SOAP notes.
- Base `handlers/emr/` also exists as a separate non-dental handler directory, deepening the confusion.
- GAP-DENTAL-010 (prior run) already flagged boundary ambiguity.

**Impact:**
Three things called "EMR": `dental-emr` spec (zombie), `dental-visit` (actual implementation), `emr` (base module). Developers cannot determine which is authoritative.

**Recommended Fix:**
1. Rename `docs/product/modules/dental-emr/` to `dental-emr-integration`.
2. Update MODULE_SPEC: scope = "external EMR data import from third-party systems (e.g. Open Dental, Dentrix)"; `implementation_status: future_phase`.
3. Add comment in MODULE_MAP.md: "dental-visit is the active dental EMR; dental-emr-integration is deferred external EMR bridge."

---

## GAP-DENTAL-021

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-021 |
| **Title** | dental-clinical directly imports VisitRepository from dental-visit (G-003 bounded-context violation) |
| **Severity** | P2 — Architecture |
| **Area** | dental-clinical / dental-visit |
| **Type** | Module coupling |
| **Status** | OPEN |

**Evidence:**
- `docs/product/modules/dental-clinical/MODULE_SPEC.md §1`: explicit flag: "KNOWN COUPLING RISK (G-003): Imports `VisitRepository` directly from dental-visit — must be refactored to service interface in Wave G1."
- This means dental-clinical tests depend on dental-visit's internal database schema and repo signature.

**Impact:**
Changes to dental-visit's VisitRepository (field renames, query signature changes) silently break dental-clinical. The coupling makes the two modules co-deployable only — bounded contexts are not isolated.

**Recommended Fix:**
1. Define a `VisitService` interface in `dental-visit/` exposing only what dental-clinical needs (e.g., `getVisitStatus(visitId): VisitStatus`, `assertVisitOpen(visitId): void`).
2. dental-clinical imports the interface, not the repo class.
3. Verify: `grep -r "from.*dental-visit/repos"` in dental-clinical returns empty.

---

## GAP-DENTAL-022

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-022 |
| **Title** | dental-audit MODULE_SPEC has no handler directory — getAuditEvents lives in dental-org |
| **Severity** | P2 — Architecture Confusion |
| **Area** | dental-audit / dental-org |
| **Type** | Module boundary (MERGE) |
| **Status** | OPEN |

**Evidence:**
- `services/api-ts/src/handlers/dental-audit/` does NOT exist in the handler directory listing.
- `app.ts` imports `getAuditEvents` from `@/handlers/dental-org/getAuditEvents`.
- `docs/product/modules/dental-audit/MODULE_SPEC.md` exists describing audit log read surface.
- Base `handlers/audit/` has `listAuditLogs.ts` covering the platform-level audit stream.

**Impact:**
dental-audit has a spec and no code. dental-org owns audit query logic that should belong elsewhere. The audit endpoint (`GET /dental/admin/audit`) is routed via dental-org, making dental-org responsible for cross-cutting concerns it shouldn't own.

**Recommended Fix:**
Create `handlers/dental-audit/` with `getAuditEvents.ts` moved from dental-org. Update router import in app.ts. dental-audit MODULE_SPEC becomes the implementation spec for this handler.

---

## GAP-DENTAL-023

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-023 |
| **Title** | dental-pmd data scope undocumented — generatePMD aggregation contract is unknown |
| **Severity** | P2 — Spec Clarity |
| **Area** | dental-pmd |
| **Type** | Missing spec (EXPAND) |
| **Status** | OPEN |

**Evidence:**
- `docs/product/modules/dental-pmd/MODULE_SPEC.md §7 Data Requirements` is thin — lists PMD document fields but not what generatePMD aggregates from other modules.
- `handlers/dental-pmd/generatePMD.ts` exists but its source data scope cannot be determined from the spec alone.
- MODULE_SPEC §20 AI Instructions: "PMD generation must be atomic — either full snapshot or fail" — correct pattern, but no list of what fields are snapshotted.
- Import side (`importPMD`, `listImportedPMDs`) is a separate concern (external portability ingestion) with no documented FK isolation contract beyond "no DB FKs."

**Impact:**
New developers cannot safely modify the PMD generation logic without understanding which module fields are included. Two concerns (generate vs import) are combined without explicit interface documentation.

**Recommended Fix:**
Add §7.1 Data Scope table to MODULE_SPEC listing each field generatePMD reads, its source module, and its inclusion rationale. Add §7.2 Import Contract: define that importedPMD rows are foreign-origin read-only records with UUID references only, never joined to local tables.

---

## GAP-DENTAL-024

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-024 |
| **Title** | `docs/modules/` is a stale duplicate of `docs/product/modules/` missing dental-perio |
| **Severity** | P2 — Developer Confusion |
| **Area** | docs / module specs |
| **Type** | Documentation duplication (SIMPLIFY) |
| **Status** | OPEN |

**Evidence:**
- `find docs/modules -name MODULE_SPEC.md` returns 10 files (dental-audit, dental-billing, dental-clinical, dental-emr, dental-imaging, dental-org, dental-patient, dental-pmd, dental-scheduling, dental-visit).
- `find docs/product/modules -name MODULE_SPEC.md` returns 11 files (all of the above + dental-perio).
- `docs/modules/` is missing dental-perio — the most recently added module spec.
- Both directories contain MODULE_SPEC.md files; it is unclear which is canonical.

**Impact:**
Developers may read the `docs/modules/` copy and miss dental-perio. If MODULE_SPEC updates are made in both directories independently, the two drift silently.

**Recommended Fix:**
Remove `docs/modules/` entirely (git rm -r). All module specs live at `docs/product/modules/`. Update any cross-references in ARCHITECTURE.md or CLAUDE.md that point to `docs/modules/`.

---

## GAP-DENTAL-025

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-025 |
| **Title** | dental-visit treatment templates are visit-module code but org-level config domain (V2 split) |
| **Severity** | P3 — Architecture (V2) |
| **Area** | dental-visit / dental-org |
| **Type** | Module boundary (MOVE_RESPONSIBILITY, V2) |
| **Status** | OPEN — DEFERRED V2 |

**Evidence:**
- `handlers/dental-visit/` contains: `createTreatmentTemplate.ts`, `listTreatmentTemplates.ts`, `updateTreatmentTemplate.ts`, `deleteTreatmentTemplate.ts`, `treatmentTemplates.ts`.
- Templates are branch-scoped, reusable across multiple visits, and are configuration entities — not visit-specific records.
- The `applyTemplate.ts` handler in dental-visit correctly uses templates, but the template CRUD is co-located with visit CRUD.

**Impact (V2):**
When a clinic wants to share templates across branches or export template sets, the logic will need to move. Keeping templates in dental-visit prevents org-level template governance.

**Recommended Fix (V2):**
Move template CRUD handlers to dental-org (or a dedicated dental-config module). dental-visit's applyTemplate reads from org-scoped templates via dental-org service. Not a V1 blocker — do not refactor until template cross-branch sharing is a product requirement.

---

## GAP-DENTAL-026

| Field | Value |
|---|---|
| **Gap ID** | GAP-DENTAL-026 |
| **Title** | Base modules (emr, patient, provider) lack documented extension contracts with dental layer |
| **Severity** | P3 — Developer Guidance (V2) |
| **Area** | base modules / dental modules |
| **Type** | Documentation gap (BACKLOG_REVIEW) |
| **Status** | OPEN — DEFERRED V2 |

**Evidence:**
- `handlers/emr/`, `handlers/patient/`, `handlers/provider/` exist alongside dental-specific counterparts.
- No document defines: does dental-patient extend base patient? Does dental-membership replace base provider? Is base emr used in the dental context?
- ARCHITECTURE.md not deep-audited in this pass.

**Impact (V2):**
New team members may build on the wrong base. The dental layer may silently duplicate base module logic.

**Recommended Fix (V2):**
Create `docs/product/BASE_MODULE_CONTRACTS.md` with a table: base module → dental extension module → extension pattern (extends/replaces/uses/ignores).

---

## Gap Status Summary

| Severity | Count | Open | Fixed | Deferred |
|---|:---:|:---:|:---:|:---:|
| P0 | 0 | 0 | — | — |
| P1 | 4 | 0 | 4 | 0 |
| P2 | 16 | 14 | 2 | 0 |
| P3 | 8 | 6 | 0 | 2 |
| **Total** | **28** | **20** | **6** | **2** |

_P1: all 4 resolved 2026-05-25. P2: GAP-008 resolved 2026-05-25. GAP-019 through GAP-026 added in Pass 08._
