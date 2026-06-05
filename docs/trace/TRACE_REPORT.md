# Trace Report

---
oli-version: trace-v1
Report Date: 2026-06-04 (re-trace against full-scope spec-trace map; prior substantive run 2026-06-01)
Phase: D (code + tests exist)
Modules Traced: all 12 (dental-audit, dental-billing, dental-clinical, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit, emr-consultation, external-records-import) + governance chains (erasure, legal-hold, retention)
Mode: standalone (artifact + code, engine-map-enriched for frontend scope)
Data Sources: WORKFLOW_MAP.md (98 WF + WF-P01..05 + WF-EMRC-001..006), DOMAIN_MODEL.md (24 DE, 6 SM), 12 MODULE_SPECs, ROLE_PERMISSION_MATRIX.md, EVENT_CONTRACTS.md, ERROR_TAXONOMY.md, OpenAPI (specs/api/dist/openapi/openapi.json — 210 paths / 140 dental), codebase-map engine v5 (FRESH: producer=engine, fields_unavailable=[], git_sha a3bfc9a5), COMPLIANCE_REPORT.md (governance pass), CONFIDENCE_REPORT.md, JOURNEY_COVERAGE_REPORT.md
Partial Staleness: CODE_SPEC_TRACE.json reports `spec_source: null` / `matched: []` because `spec_trace_optin: false` in map-meta (spec-trace phase ran 0ms — opt-in, disabled by config, NOT a regression). CODE_API_SURFACE response_shape is empty for all 43 frontend-scope endpoints and api_calls carry no field-access data → algorithm 5g cannot produce verified edges; 5g findings route to `unverified` per R1 (confidence_threshold=MEDIUM). Trace relied on direct ID grep across spec + test source.
HEAD: 08b91b79 (main; re-trace over c26d37bd → 08b91b79 — full-scope spec-trace map, engine v6)
---

## Re-trace Pass (2026-06-05, fix/contract-drift-auth-cleanup @ 9f33ce4f — FRESH map, /oli-check traceability)

> **✅ VERDICT: PASS.** Fresh OLI knowledge graph rebuilt at HEAD `9f33ce4f` (`.map-meta.json` git_sha matches HEAD exactly → map FRESH, not stale). Spec↔code parity is total and the BR→test matrix is fully populated. `bun run audit:trace:ci` exits **0** (all P0 safety-critical BRs have test coverage).

### Tool output (ground truth)
- **`bun run audit:trace`** → 47 BRs / 55 ACs parsed; coverage **16 FULLY_COVERED (unit+E2E) / 30 UNIT_COVERED (no literal E2E tag) / 0 UNTESTED / 1 NOT_IMPLEMENTED**. Written to `docs/audits/TRACEABILITY_MATRIX_AUTO.md`.
- **`bun run audit:trace:ci`** → **exit 0** — "CI gate passed — all P0 BRs have test coverage."
- **`CODE_SPEC_TRACE.json`** (engine v6, `spec_source=specs/api/dist/openapi/openapi.json`) → **matched=352, spec_only=0, code_only=0, auth_drift=0** (full spec↔code parity; the prior run's `auth_drift=2` on `/patients/merge`+`/unmerge` is now **0** — resolved, confirms the `@useAuth` security-decorator fix in the SDK/spec).

### Coverage metrics
- **AC tag coverage: 52/55** defined ACs are referenced by at least one test (94%). The 3 un-*tagged* ACs — **AC-SETTINGS-01** (branch working hours), **AC-IMG-01** (imaging study + upload URL), **AC-IMG-02** (image list branch-membership enforcement) — are all behaviorally covered (verified: `branch.test.ts` + `online-booking.spec.ts` for SETTINGS-01; `imaging.test.ts` / `imaging-integration.test.ts` / `imaging-coverage.test.ts` for IMG-01/02). These are **tag-literal gaps (P2)**, not coverage gaps.
- **BR→E2E coverage: 16/47 (34%)** carry a literal `BR-NNN` tag in an E2E spec. The 30 "unit-only" BRs are unit/contract-covered; the 4 flagged P1 (BR-007/012/018/021) were **trust-but-verify confirmed behaviorally covered by E2E** (`workspace-readonly.spec.ts`, `04-revenue-chain.journey.spec.ts`, `lab-order-tracking.spec.ts`, `09-plan-versioning`/`10-void-amend-audit.journey.spec.ts`) — they just omit the literal tag. **Orphan BRs (zero test reference anywhere): NONE.**
- **Chain coverage (WF→test): 80%** (unchanged — matches baseline; spec-trace parity holds all 18 journey specs intact).

### Gap findings (all P2/P3 — no P0/P1 in-scope)

| ID | Sev | Module | Finding | Evidence (verified) |
|---|---|---|---|---|
| TR-DOC-BR020 | P2 | dental-patient | **BR-020 doc drift** — `BUSINESS_RULES.md` marks patient merge/unmerge "not-implemented (TODO)" but the feature SHIPS: `handlers/patient/mergePatients.ts` + `unmergePatients.ts` + `patient-merge-auth.test.ts` (22 assertions) exist, `POST /patients/merge` + `/unmerge` are **matched** spec-trace routes, auth_drift now 0. BR doc references the wrong module path (`dental-patient/` vs `patient/`) and a stale status. | `CODE_SPEC_TRACE.json` matched; `handlers/patient/*merge*`; `BUSINESS_RULES.md:69` |
| TR-TAG-E2E | P2 | all | 30 BRs unit-covered but lack a literal `BR-NNN` tag in their E2E spec; 4 (BR-007/012/018/021) verified behaviorally E2E-covered. Cosmetic traceability-tagging debt; add `// @BR-NNN` to journey describe blocks. | `TRACEABILITY_MATRIX_AUTO.md` gaps table |
| TR-TAG-AC | P2 | dental-org, dental-imaging | AC-SETTINGS-01 / AC-IMG-01 / AC-IMG-02 behaviorally tested but un-tagged in their tests. | grep verify (branch/imaging tests) |
| TR-TOOL-REGEX | P3 | tooling | `audit-traceability` AC regex `AC-[A-Z]+-\d{2}` truncates 3-digit module ACs (`AC-BL-001`→`AC-BL-00`), producing 11 phantom "dangling" tags. **Not real dangling refs** — they are real 3-digit ACs in module unit tests (`dental-chart-baseline.test.ts` etc.). Tooling limitation, no spec gap. | `dental-chart-baseline.test.ts:4-22` |

### Discrepancies vs prior baseline (tool-vs-ground-truth)
1. **auth_drift 2→0** (RESOLVED): prior baseline note carried `auth_drift=2` (`/patients/merge`,`/unmerge`) as a route-level-only false positive. The fresh map computes **auth_drift=0** — the spec/SDK now carries the bearer security decorator on those ops, so the drift is genuinely gone, not just suppressed. Baseline note is now stale on this point.
2. **BR-020** "not-implemented" status in `BUSINESS_RULES.md` is **contradicted by code** (handlers + tests + matched routes exist). Filed TR-DOC-BR020 (P2 doc drift) — the only ground-truth-vs-doc contradiction this run.
3. **TR-PHANTOM-ORG-001** (prior gate-flipping P1) **confirmed still resolved**: `DELETE /dental/org/members/:memberId` present in matched routes (`deactivateMember.ts` wired); no phantom recurrence.

---

## Re-trace Pass (2026-06-04, main @ 08b91b79 — FULL-SCOPE spec-trace map, engine v6)

> **✅ RESOLVED SAME DAY (post-fix re-verify).** TR-PHANTOM-ORG-001 was fixed in this session: added the `@delete deactivateMember` op to `dental-org.tsp` → `bun run build` + `bun run generate` wired `DELETE /dental/org/members/:memberId` into `routes.ts:1160` (authMiddleware + param validator) and imported the existing handler into `registry.ts:111,480`. Added a real-route-registration regression test (`deactivateMember.route.test.ts`) that inspects the generated `registerRoutes` (no DB) — RED before, GREEN after. Gates: backend **286 files / 3368 pass / 0 fail**, typecheck clean, `check:boundaries` clean. Map rescan confirms `is_phantom` 2→1 (only the ceph `:qs` URL-parse artifact remains, a non-gap), `DELETE /dental/org/members/:memberId` now resolves to `deactivateMember.ts` (phantom=False), spec-trace `matched 351→352`. **In-scope product P1 back to 0 → gate PASS.** The detection-state narrative below is retained for the audit trail.

**Why this run first reversed the prior PASS:** commits `420f1ef5` (enable spec-trace via `spec_sources`) and `08b91b79` (regen codebase-map with request/response shapes) re-scoped the engine map to include `services/api-ts/src/**` and turned on the spec↔code trace. The two off-gate items the prior report carried — **TR-INFRA-001** (`spec_trace_optin=false`, `matched=[]`) and the **5g unverified cluster** (`response_shape` empty for all FE endpoints) — now have real data and are **resolved as root-cause**. Running 5g (FE→BE phantom detection) for the first time against a populated backend route table surfaced **one live broken FE↔BE chain that the prior frontend-only map could not see**. Trust banner: `MAP-FRESHNESS: FRESH-ENOUGH` (map@3e79017 vs HEAD@08b91b7, no in-scope source drift), producer=engine v6, `fields_unavailable=[]` → **THESIS IN FORCE**.

Fresh-map signals consumed this run (`docs/audits/codebase-map/`, regenerated 11:46):
- `CODE_SPEC_TRACE.json`: `spec_source=specs/api/dist/openapi/openapi.json`, **matched=351, spec_only=0, code_only=0, auth_drift=2** (`spec_trace_optin=true`).
- `CODE_API_SURFACE.json`: 353 endpoints, **336 with `response_shape`**, only **2 `is_phantom`** (vs the prior blanket "all 43 FE endpoints phantom").

### NEW — HIGH (P1, in-scope product) — gate-flipping

**TR-PHANTOM-ORG-001 — FE staff-deactivation calls a backend route that does not exist (broken journey).**
- **FE call:** `apps/dentalemon/src/features/staff/hooks/use-staff-members.ts:68-73` — `deactivateMember()` issues `fetch(\`${API}/dental/org/members/${memberId}\`, { method: 'DELETE' })`. Reachable from the UI: `staff-list.tsx:101,219` renders a **"Deactivate"** button → `useStaffMutations().deactivate` → this fetch.
- **Backend:** **no `DELETE` route exists** for `/dental/org/members/:memberId`. `routes.ts` registers only GET/POST `/dental/org/members`, PATCH `/:memberId`, and the `recover-pin`/`reset-pin`/`security-question` sub-routes. OpenAPI declares only `patch` on that path. `dental-org.tsp` declares **no** delete-member operation (the only `@delete` is `deleteConsentTemplate`; membership deactivation is a separate `POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/deactivate`).
- **Orphan handler:** `services/api-ts/src/handlers/dental-org/deactivateMember.ts` declares `Path: DELETE /dental/org/members/:memberId` but is **NOT in `registry.ts`** and **NOT wired in `routes.ts`** — a complete handler whose TypeSpec/route/registry wiring was never added (incomplete vertical slice: backend layer written, contract+wiring layer skipped).
- **Runtime impact:** clicking "Deactivate" → `DELETE` → **404** → `throw new Error('Failed to deactivate member (404)')` error toast. **Staff deactivation is non-functional in production.**
- **Why it was missed:** `use-staff-members.test.ts:168` mocks `fetch` and asserts `method==='DELETE'` — green without a real backend route (the known mock-masking failure mode; route-registration bugs need a real-server hit).
- **Severity P1** (broken FE↔BE chain / journey-completion gap, algorithm 5f+5g). **Fix (either):** (a) declare `@delete` member op in `specs/api/src/modules/dental-org.tsp`, regen, and register the existing `deactivateMember` handler; OR (b) repoint the FE hook to the existing `POST .../members/{membershipId}/deactivate` operation. Option (a) is lower-churn since the handler already exists.

### CONFIRMED FALSE-POSITIVE → CLEARED (P3 done same session)

**`auth_drift=2` (`POST /patients/merge`, `POST /patients/unmerge`)** — was engine route-level detection only: the in-handler admin guard was enforced (`mergePatients.ts:18-20` `if (user.role !== 'admin') throw new ForbiddenError`; `patient-merge-auth.test.ts`, 22 assertions), but the ops carried only `x-security-required-roles: #["admin"]` and **lacked `@useAuth(bearerAuth)`**, so the OpenAPI `security` block was empty and the generated route had **no `authMiddleware`** — a safe-direction divergence (code stricter than contract). **FIXED 2026-06-04:** added `@useAuth(bearerAuth)` to both ops in `patient.tsp` → regen now emits `security: [{bearerAuth: []}]` + `authMiddleware({roles:["admin"]})` on both routes (defense in depth, not just the in-handler guard). Map rescan: **auth_drift 2→0**; spec-trace `matched=352, spec_only=0, code_only=0, auth_drift=0` — full parity.

### RESOLVED this run (root-cause cleared)

- **TR-INFRA-001 (was EXTERNAL / standing) → RESOLVED.** `.oli/config.json` now sets `spec_sources: ["specs/api/dist/openapi/openapi.json"]` and `include`/`module_roots` cover `services/api-ts/src/**`. Engine computed `spec_trace_optin=true`; `CODE_SPEC_TRACE` reports **matched=351, spec_only=0, code_only=0** — full spec↔code parity. The prior "frontend-scoped map → empty backend surface → matched=0" blocker is gone.
- **5g unverified cluster (FE-field-phantom) → MATERIALIZED.** `response_shape` is now populated for 336/353 endpoints (only 2 phantom). 5g ran with real data instead of routing to `unverified`; it surfaced exactly one in-scope phantom (TR-PHANTOM-ORG-001) and one artifact (below). The map-degenerate caveat is retired.
- **`GET /dental/imaging/images/:imageId/ceph/analysis:qs` (2nd `is_phantom`) → ARTIFACT, not a gap (P3).** The backend route exists (`routes.ts:948`, OpenAPI `get`); the `:qs` suffix is an engine URL-parser artifact for the FE call's query string. No action.

### Verdict delta

| | Prior (2026-06-02 @ c26d37bd) | This run (2026-06-04 @ 08b91b79) |
|---|---|---|
| In-scope product **P1** | 0 (+1 EXTERNAL: TR-INFRA-001) | **0** (TR-PHANTOM-ORG-001 found then FIXED same session) |
| TR-INFRA-001 | EXTERNAL / out-of-scope | **RESOLVED** |
| 5g cluster | unverified (map degenerate) | **ran — 1 real phantom found + fixed** |
| Gate verdict | PASS | FAIL → **PASS** (after fix) |

**New gaps:** 1 (TR-PHANTOM-ORG-001, P1) — **fixed same session**. **Resolved:** TR-PHANTOM-ORG-001, TR-INFRA-001 (EXTERNAL→resolved), 5g-degenerate caveat. **Net in-scope P1:** 0 → 1 → **0**.

---

## Re-verify Pass (2026-06-02, 26925ce2 → c26d37bd, fresh engine map git_sha c26d37bd)

Re-ran the full chain against the FRESH codebase-map (engine v5, .map-meta git_sha c26d37bd, fields_unavailable=[], producer=engine). The 5 commits since the prior substantive run (901deb63, e20e5b2f, 04162602, c26d37bd, 7b7c740e) are **docs(trace)/docs(audits) only — zero source or spec deltas** (`git log --oneline 26925ce2..HEAD` = 5 docs commits). No new gaps, no resolved gaps, no count movement. **VERDICT UNCHANGED: PASS.** Re-grep verification of all standing-finding anchors against current source:
- **TR-BR-013 (P2 deferral) confirmed:** `dental-billing/markUncollectible.ts:24-28` — `// BR-013: deferred — always 501.` → `NOT_IMPLEMENTED` 501, feature flag `dental_billing_uncollectible`.
- **TR-WF-DOCDRIFT (false-positive) confirmed:** `dental-clinical/amendments/approveAmendment.ts:26-30` — `// BR-019: supervisor approval deferred — always 501.`, flag `dental_clinical_amendment_approval`.
- **TR-WF-PLAN (resolved) confirmed:** `dental-visit/treatments/updateDentalTreatment.ts` + 3 FSM tests (`treatment-fsm-http.test.ts`, `treatment.fsm.property.test.ts`, `dental-visit.treatment-status-transitions.test.ts`).
- **TR-DG-002 (resolved) confirmed:** 6 governance path ops present in `specs/api/dist/openapi/openapi.json` — `/dental/erasure-requests`(+`/{id}`,`/approve`,`/reject`), `/dental/legal-holds`(+`/{id}/release`); 140 dental paths total.
- **TR-LH-001 / TR-RET-001 (P2 orphan-by-design) confirmed:** no `legal-hold`/`retention` MODULE_SPEC under docs/product/modules/.
- **TR-INFRA-001 (EXTERNAL) confirmed:** `.map-meta.json:provenance.spec_trace_optin: false`, `CODE_SPEC_TRACE.json spec_source=null / coverage.matched=[]` — engine-config item, unchanged.
- Spec namespace recount stable: WF/BR/AC/SM totals match prior run (BR namespace BR-001..047 + BR-P01..07 + BR-SCH-001..004 = 58 canonical).
---

## Re-verify Pass (2026-06-01, ece7f89c → 26925ce2) — governance/FE-error chains

The compliance-dimension findings V-DG-002 (S3 erasure delete), V-DG-003 (appointment retention), and V-FE-ERR-001 (FE hook error toast) are now RESOLVED in code, and their spec→code→test chains are COMPLETE; V-IMG-EXP-001 is a docs-defer (P1→P2). These are governance/FE findings, not traceability P1s, so the trace P0/P1 counts and **PASS verdict are unchanged**. Chain notes:
- **V-DG-002 chain (erasure → S3 delete):** `dental-erasure/erasure-storage.ts::physicalDeleteErasedFiles` ← `approveErasureHandler.ts` (handler scope, `ctx.get('storage')`) ← engine-aggregated `fileIdsPendingS3Delete` from `dental-imaging/repos/imaging-erasure.facade.ts`; `erasure.s3_deleted` audit event emitted. Tested: `erasure-s3-delete.test.ts` (4), `imaging-erasure.facade.test.ts` (3). code→test→audit COMPLETE.
- **V-DG-003 chain (appointment retention):** `retention/retention-targets.ts::appointmentTarget` → `dental-scheduling/repos/dental-appointment-retention.facade.ts` (filters `scheduledAt<=cutoff`, excludes legal-held, soft-deletes via `deletedAt`); default policy `enabled` in `retention-defaults.ts:46`; column added in migration `0079_zippy_alice.sql`. Anchored under TR-RET-001 (orphan-by-design cron). Tested: `retention-appointment.test.ts` (6), `retention-defaults.test.ts` (6). code→test COMPLETE.
- **V-FE-ERR-001 chain (FE error surface):** 5 workspace mutation hooks → hook-level `onError` → `lib/error-toast.ts::toastError` (taxonomy wrapper over the `{error:{code,message}}` envelope). Tested: each hook `*.test.ts` has a `V-FE-ERR-001` toast assertion. FE suite 41/0.

Regression evidence this pass: backend `bun run test` 241 files / 2977 pass / 0 fail; FE hook suite 41/0; `typecheck` clean (api-ts + dentalemon); `check:boundaries` clean (no new cross-module leak from the new facades).

## Changes Since Last Run (HEAD a3bfc9a5 → ece7f89c, branch feat/ceph-demoable-and-manual-ux)

- **New gaps:** 0
- **Resolved gaps:** 1 P1 (TR-DG-002), 1 P2 (TR-LH-001 → anchored/informational)
- **Net change:** in-scope product P1 5 → 4 → 2 → 1 → **0** (TR-WF-PLAN + TR-WF-DOCDRIFT cleared 2026-06-01; **TR-BR-013 formally deferred → P2**; **TR-INFRA-001 reclassified EXTERNAL / out-of-scope** — separate-repo tooling, not dentalemon code; all 2026-06-01). 1 EXTERNAL tooling item (TR-INFRA-001) tracked as a known limitation, outside dentalemon product scope.
- **TR-DG-002 RESOLVED (was the standing P1).** The dental manual-route → TypeSpec migration on this branch (OpenAPI 103→140 dental paths, suite 2957/0) landed the erasure + legal-hold **HTTP path operations into the compiled OpenAPI contract**. Verified present: `/dental/erasure-requests` (+`/{id}`, `/approve`, `/reject`) and `/dental/legal-holds` (+`/{id}/release`) — 6 path operations, not just the component schemas that were the prior residual gap. SDK/clients can now discover the WFG-006 erasure surface. Spec→code→test→contract chain now COMPLETE.
- **TR-LH-001 downgraded (P2 → anchored/informational).** Legal-hold endpoints are now in the OpenAPI contract and have a TypeSpec source; residual is only the absence of a *product* MODULE_SPEC/WF node. code→test→contract COMPLETE.
- **BR-019 — CORRECTION 2026-06-01: prior "now TESTED" was a FALSE POSITIVE.** `approveAmendment.test.ts` asserts **501 NOT_IMPLEMENTED** — a *deferral-stub* test, not an implementation. BR-019 supervisor approval is deliberately deferred (feature flag `dental_clinical_amendment_approval` off, MODULE_SPEC §18). WORKFLOW_MAP's not-enforced status was CORRECT; the read mistook the 501-stub test for implementation. WORKFLOW_MAP §5 clarified to "DEFERRED — 501 stub + deferral test" so doc and code agree → **TR-WF-DOCDRIFT resolved (false positive)**.
- **WF-048/049/050 confirmed (TR-WF-PLAN RESOLVED 2026-06-01).** The treatment FSM transitions are enforced in `updateDentalTreatment.ts` (forward-only → 422 per BR-006; dismiss/decline audited) and tested by `treatment.fsm.property.test.ts` / `treatment-fsm-http.test.ts` / `dental-visit.treatment-status-transitions.test.ts`. WORKFLOW_MAP ops table [INFERRED] tags removed; they are real workflows.
- **Product BR namespace re-baselined to 58 canonical IDs** (prior report counted 47 product BRs; this run traces the full namespace incl. BR-SCH-001..004 + BR-P01..P07). 53/58 carry an explicit `BR-NNN` tag in a test; the remaining 5 are semantically covered (medium confidence) → 58/58 any-layer.
- **TR-INFRA-001 reclassified EXTERNAL / out-of-scope (2026-06-01).** This is a **separate-repo tooling** item in the oli-engine (`$OLI_ENGINE_HOME`), **not a dentalemon product code gap**. `spec_trace_optin` is not a dentalemon setting — it is *computed* by the engine as `config.spec_sources.length > 0` (`oli-engine/src/passes/orchestrator.ts:97`). Verified that a bare flip is **insufficient**: dentalemon's `.oli/config.json` scopes the codebase map to `apps/dentalemon/src/**` (frontend only), so `CODE_API_SURFACE.endpoints` contains **no backend Hono routes** — `spectrace.ts` would join the 140-path OpenAPI against an empty backend surface and yield `matched=0` (everything `spec_only`). A meaningful enable requires reconfiguring the **engine** scan to include `services/api-ts/**` and re-running `oli-codebase-map` — engine/tooling workflow in the separate repo, outside dentalemon's product scope and explicitly **not** to be addressed by editing dentalemon product code. Tracked as a known external limitation; **0 in-scope product P1**.

## Summary

| Metric | Count |
|--------|-------|
| Total nodes | 405 |
| Total edges | 612 |
| CRITICAL gaps (P0) | 0 |
| HIGH gaps (P1, in-scope product) | **0** (TR-PHANTOM-ORG-001 found + FIXED same session; TR-INFRA-001 RESOLVED) |
| MEDIUM gaps (P2) | 34 |
| unverified (5g, map-degenerate) | 0 (5g now RAN — `response_shape` populated 336/353; map no longer degenerate) |
| Chain coverage (WF → test) | 80% |

Node manifest: WF=109 (98 numbered + WF-P01..05 + WF-EMRC-001..006), BR=58 (BR-001..047 + BR-SCH-001..004 + BR-P01..P07), AC=48, SM=8 (SM-VISIT/TREATMENT/INVOICE/CONSENT/LABORDER + SM-01/SM-02; +2 prose state machines), DE=24, endpoints=210 (OpenAPI) / 140 dental, roles=9. Nodes in graph = 405 ≥ collected. Output marked **COMPLETE**.

## Verdict: PASS (TR-PHANTOM-ORG-001 found and fixed same session)

> **2026-06-04:** the full-scope spec-trace map (engine v6) surfaced **one live broken FE↔BE chain** — FE staff-deactivation issued `DELETE /dental/org/members/{id}` to a backend route that did not exist (orphan handler never wired; no TypeSpec/OpenAPI op). It was an in-scope product **P1** (broken journey, runtime 404). **It was fixed in the same session** (TypeSpec `@delete` op + regen wired the route to the existing handler; real-route-registration regression test added; map rescan confirms phantom resolved, spec-trace matched 351→352). **TR-INFRA-001 is RESOLVED** (spec-trace enabled, matched=352/0/0) and the **5g cluster is no longer degenerate** (response_shape populated 336/353). With the P1 fixed, **in-scope product P1 = 0** and the gate is **PASS**. The `auth_drift=2` patient-merge signal remains a confirmed route-level false-positive (admin guard enforced in-handler; optional P3 to add the OpenAPI security decoration).

The historical PASS rationale (still valid for everything except TR-PHANTOM-ORG-001):
No P0 dangling references and no cross-module blind spots (all 16 §12 cross-module flows have an integration mechanism — sync API, pg-boss event, or UUID-ref). Every canonical BR (58/58) has at least one test at some layer. The prior standing P1 (TR-DG-002, erasure paths absent from OpenAPI) is **RESOLVED** by this branch's route migration. TR-WF-PLAN (WF-048/049/050 promoted to confirmed) and TR-WF-DOCDRIFT (BR-019 false-positive — clarified to DEFERRED-501-stub) were cleared 2026-06-01. TR-BR-013 (billing `markUncollectible` WFG-008) was **formally deferred to Phase 2 → P2 2026-06-01** (feature-flag `dental_billing_uncollectible` off, intentional 501 stub + deferral tests, documented error path AC-BIL-005 → 501; reconciled in WORKFLOW_MAP §5/WFG-008 mirroring BR-019/BR-020), and TR-INFRA-001 was **reclassified EXTERNAL / out-of-scope** (separate-repo oli-engine tooling, not dentalemon product code; a bare `spec_trace_optin` flip is insufficient given the frontend-scoped map). **In-scope product P1 = 0.** All P2s are AC-tag drift, missing-E2E for unit-only BRs, orphan/inferred WFs, the legal-hold/retention spec-anchoring items, and the BR-013 deferral — all report-only.

## Per-Phase Health Contribution

| Phase | Score | Metric | Notes |
|-------|-------|--------|-------|
| A | 10/10 | Artifact completeness | All 12 MODULE_SPECs + WORKFLOW_MAP + DOMAIN_MODEL + roles/events/errors present |
| B | 10/10 | Spec coverage | Every BR defined in a MODULE_SPEC section (58/58) |
| C | 9/10 | Slice coverage | No VERTICAL_SLICE_PLAN.md / slices/ dir — BR→slice link UNMAPPABLE (not BROKEN); substituted BR→handler. −1 for BR-020 unimplemented (intentional 501) |
| D | 8/10 | Test coverage | 58/58 BR any-layer (100%); ~26% BR→E2E; weighted by 80% WF→test chain coverage. TR-DG-002 contract gap now closed |

## Coverage Matrix (BR chain completeness)

| BR cohort | Count | spec | backend unit | E2E | Chain status |
|-----------|-------|------|--------------|-----|--------------|
| Visit/treatment core (BR-001..008) | 8 | ✓ | ✓ | partial (6/8) | FULL/PARTIAL |
| Billing (BR-009..013) | 5 | ✓ | ✓ | partial | PARTIAL (BR-013 incomplete impl) |
| Consent/clinical (BR-014..019) | 6 | ✓ | ✓ | partial | FULL (BR-019 = deferred 501 stub by design, MODULE_SPEC §18) |
| Patient (BR-015, BR-020) | — | ✓ | ✓/501 | — | BR-020 spec-only (intentional 501) |
| PMD (BR-021,022) | 2 | ✓ | ✓ | partial | FULL |
| Imaging annotation (BR-023..035) | 13 | ✓ | ✓ | partial (BR-030 E2E) | UNIT (+FE for BR-031) |
| Ceph (BR-036..047) | 12 | ✓ | ✓ (ceph-business-rules.test.ts 12/12) | imaging-ceph-export.spec.ts | UNIT+E2E |
| Scheduling (BR-SCH-001..004) | 4 | ✓ | ✓ (SCH-004 tagged; 001/002/003 semantic) | calendar-riley.spec.ts | UNIT |
| Perio (BR-P01..P07) | 7 | ✓ | ✓ (P05/P06 semantic) | ipad-perio-charting.spec.ts | UNIT+E2E |

- Chain coverage (BR → at least one test): **58/58 = 100%.**
- Chain coverage (BR → E2E layer): **15/58 ≈ 26%** (explicit-tag, BR-001/002/003/004/006/011/013/014/015/016/017/019/024/026/030).
- WF→test chain coverage: **80%** (core PRD WF-001..044 + perio + EMRC have backend/E2E; the ~54 [INFERRED] WFs and notification WFs WF-080..087 lack direct test anchors → drives the 20% gap).
- Non-BR chains: GAP-001 localId (spec→code→E2E COMPLETE); WFG-006 erasure (spec→code→test→**OpenAPI contract COMPLETE** — was BROKEN, now resolved).

## Gap List by Severity

### CRITICAL (P0) — Blocks Phase Progression

None. No dangling spec references (all WF/BR/AC/SM/DE IDs referenced in artifacts resolve to a definition). No cross-module blind spots (all 16 §12 cross-module flows carry an integration mechanism).

### HIGH (P1) — Warns at Phase Boundary

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| ~~TR-PHANTOM-ORG-001~~ → **RESOLVED 2026-06-04** | 5f/5g FE→BE phantom | FE staff "Deactivate" `DELETE /dental/org/members/{memberId}` had no backend route (orphan unwired `deactivateMember.ts`). **Fixed:** added `@delete deactivateMember` op to `dental-org.tsp` (204/401/403/404) → regen wired `routes.ts:1160` (authMiddleware + `DeactivateMemberParams` validator) + `registry.ts:111,480`. Map rescan: `DELETE /dental/org/members/:memberId` → handler resolved, phantom=False; spec-trace matched 351→352. Regression test `deactivateMember.route.test.ts` asserts the generated route is registered. | specs/api/src/modules/dental-org.tsp; services/api-ts/src/generated/openapi/routes.ts:1160; services/api-ts/src/handlers/dental-org/deactivateMember.route.test.ts | Done. |
| ~~TR-INFRA-001~~ → **RESOLVED 2026-06-04** | engine trace | spec-trace enabled (`.oli/config.json spec_sources` set + scope widened to `services/api-ts/src/**`); engine `spec_trace_optin=true`; `CODE_SPEC_TRACE` **matched=351, spec_only=0, code_only=0**. Full spec↔code parity. No longer EXTERNAL or gating. | docs/audits/codebase-map/CODE_SPEC_TRACE.json; .oli/config.json; commits 420f1ef5, 08b91b79 | Done. |
| ~~TR-BR-013~~ → **P2** | 5c coverage | BR-013 `markUncollectible` **formally DEFERRED to Phase 2** 2026-06-01 (feature-flag `dental_billing_uncollectible` off; intentional 501 stub + deferral tests; documented error path AC-BIL-005 → 501; `uncollectible` intentionally absent from invoice status enum until flag lifted). Reconciled in WORKFLOW_MAP §5/WFG-008 to DEFERRED (mirrors BR-019/BR-020). Not an implementation gap. | WORKFLOW_MAP.md:333,606; dental-billing MODULE_SPEC §13/§18 | **RESOLVED** as documented deferral (P1→P2). |
| ~~TR-WF-PLAN~~ | 5b | ✅ **RESOLVED 2026-06-01** — WF-048/049/050 promoted from [INFERRED] to confirmed in WORKFLOW_MAP; transitions enforced (`updateDentalTreatment.ts`, 422/BR-006) + tested (`treatment.fsm.property.test.ts`, `treatment-fsm-http.test.ts`, `dental-visit.treatment-status-transitions.test.ts`). | WORKFLOW_MAP.md:142-146 | Done. |
| ~~TR-WF-DOCDRIFT~~ | 5e/5a | ✅ **RESOLVED 2026-06-01 (was FALSE POSITIVE)** — `approveAmendment.test.ts` asserts 501 (deferral stub), so BR-019 is genuinely deferred (MODULE_SPEC §18); WORKFLOW_MAP's not-enforced status was correct. Clarified §5 to "DEFERRED — 501 stub + deferral test" so doc⇄code agree. | WORKFLOW_MAP.md:332 | Done. |

### MEDIUM (P2) — Report Only

| Gap ID | Algorithm | Description | Source |
|--------|-----------|-------------|--------|
| TR-LH-001 | 5a orphan (downgraded → anchored) | `handlers/legal-hold/` now has OpenAPI path ops (`/dental/legal-holds*`) + TypeSpec source, but no product MODULE_SPEC/WF node. Spec(product)→code BROKEN; code→test→contract COMPLETE. Informational. | services/api-ts/src/handlers/legal-hold/; openapi.json |
| TR-RET-001 | 5a orphan (anchored) | `handlers/retention/` (V-RET-001/002 anchored, now also the V-DG-003 `appointment` retention target, wired to legal-hold facade, 7 test files incl. `retention-appointment.test.ts`) has no MODULE_SPEC/WF node. Intentional internal cron job. code→test COMPLETE. | services/api-ts/src/handlers/retention/; WORKFLOW_MAP.md:597 |
| TR-PAT-020 | 5c coverage | BR-020 (patient merge) spec'd but 501 NOT IMPLEMENTED; no enforcing workflow (WFG-007). Intentional/deferred (describe.skip v2.0). | dental-patient MODULE_SPEC:96; WORKFLOW_MAP.md:333,598 |
| TR-E2E-* | 5c | ~32 BRs are UNIT_COVERED with no E2E layer (imaging annotation BR-024..035 partial, scheduling BR-SCH, several billing/visit edge rules). | direct grep; JOURNEY_COVERAGE_REPORT |
| TR-AC-UNTAGGED | 5c | 19 of 48 ACs carry an explicit `AC-NNN` test tag; ~29 ACs untagged (many implicitly covered by BR tests). Also AC-BIL vs AC-BL tag drift in billing tests. | grep AC-NNN across src/tests |
| TR-PERIO-AC | 5c | dental-perio MODULE_SPEC defines 0 AC-NNN IDs (only BR-P01..07). AC layer absent for perio. | dental-perio/MODULE_SPEC.md |
| TR-WF-INFERRED | 5a orphan | 54 [INFERRED] WFs + notification WFs (WF-080..087) have no test/code anchor — expected (planning placeholders), report-only. | WORKFLOW_MAP.md §3-§13 |
| TR-WFG-NOTIF | 5f journey | WFG-009..013 (appointment reminder, invoice overdue, PMD ready, lab-order-complete notifications) not implemented — no `ui_action`→API→WF chain. | WORKFLOW_MAP.md §8,§14 |

### unverified (routed off-gate per R1)

| Cluster | Algorithm | Reason |
|---------|-----------|--------|
| 5g FE-field-phantom | 5g | Engine map `CODE_API_SURFACE.response_shape` empty for all 43 frontend endpoints (`is_phantom=true` blanket) and api_calls carry no field-access data. Below MEDIUM confidence_threshold → routed to unverified, does not fail gate. **Same root cause as TR-INFRA-001 (EXTERNAL engine-config / scope):** materialized by the same engine-repo rescan (widen scope + spec_sources). Not a dentalemon product gap. |

## Suggested Actions

| Priority | Action | Gaps Fixed | Command |
|----------|--------|-----------|---------|
| 1 | **EXTERNAL (oli-engine repo, not dentalemon code):** widen the engine map scope to include `services/api-ts/**` + set `spec_sources: [specs/api/dist/openapi/openapi.json]`, then re-run `oli-codebase-map`; verify matched>0 + response_shape populated. A bare `spec_trace_optin` flip is insufficient (frontend-scoped map → empty backend surface). | TR-INFRA-001 (EXTERNAL) + unblocks 5g unverified | re-run oli-codebase-map (engine repo) |
| 2 | ~~Update WORKFLOW_MAP §5: reconcile BR-013 (complete or formally defer)~~ ✅ DONE 2026-06-01 — BR-013 formally deferred to Phase 2 (501 stub + flag); WORKFLOW_MAP §5/WFG-008 reconciled to DEFERRED | TR-WF-DOCDRIFT, TR-BR-013 (P1→P2) | edit WORKFLOW_MAP.md |
| 3 | Promote WF-048/049/050 to explicit workflows or confirm CRUD coverage | TR-WF-PLAN (P1) | edit WORKFLOW_MAP.md §2 |
| 4 | Author MODULE_SPEC nodes for legal-hold + retention governance modules | TR-LH-001, TR-RET-001 (P2) | /oli-spec-modules |
| 5 | Add E2E for high-value unit-only BRs (imaging annotation, scheduling); add perio ACs | TR-E2E-*, TR-PERIO-AC (P2) | e2e-scaffold / module-specs |
| 6 | Normalize AC tags (AC-BIL vs AC-BL) + tag untagged ACs in tests | TR-AC-UNTAGGED (P2) | edit test describe blocks |

## Graph Statistics

### Nodes by Type

| Type | Count |
|------|-------|
| workflow | 109 |
| business_rule | 58 |
| acceptance_criteria | 48 |
| state_machine | 8 |
| domain_event | 24 |
| error_code | (catalogued in ERROR_TAXONOMY; not individually noded) |
| role | 9 |
| api_endpoint | 140 (dental, of 210 OpenAPI) |
| ui_screen / ui_action | (from JOURNEY_COVERAGE_REPORT registries) |
| slice | 0 (no VERTICAL_SLICE_PLAN/slices dir) |
| test_file | 427 (239 backend + 188 frontend/e2e) |

### Edges by Type (principal)

| Type | Count | Avg Confidence |
|------|-------|----------------|
| WF_ENFORCES_BR | 36 | high |
| BR_DEFINED_IN_SPEC | 58 | high |
| BR_TESTED_BY | 53 high + 5 medium | high |
| AC_TESTED_BY | 19 | high |
| WF_EXPOSED_VIA_API | 140 | high |
| EVENT_PUBLISHED_BY | 14 (of 24 DE traced in code) | high |
| ROLE_AUTHORIZED_FOR_ENDPOINT | 9 roles × endpoints | medium |
| WF_TRIGGERS_SM | 8 | high |
| FE_CONSUMES_FIELD | 0 verified (map degenerate → unverified) | — |

### Connected Components

| Metric | Count |
|--------|-------|
| Connected components | 1 dominant + governance subgraph + ~56 islands |
| Largest component | ~340 nodes (core dental + billing + clinical + imaging mesh) |
| Islands (single-node) | 54 [INFERRED] WFs + notification WFs (expected planning placeholders) |

## Trace Manifest
- Spec IDs collected: WF=109, BR=58, AC=48, SM=8, DE=24, endpoints=210, roles=9
- Nodes in graph: 405 (≥ collected — COMPLETE)
- Edges in graph: 612
- Chains traced: 109/109 workflows (each resolved to COMPLETE / PARTIAL / UNMAPPABLE; 54 inferred WFs = UNMAPPABLE-by-design islands, logged not silently skipped)
- BRs with coverage: 58/58 (53 explicit-tag, 5 semantic)
- Orphan BR nodes: 0
- Broken chains: 0 dangling; BR→slice link UNMAPPABLE (no slice artifacts) substituted by BR→handler
- Orphan-code modules: 2 (legal-hold — now contract-anchored, P2; retention — V-RET anchored, P2)
- Output: marked **COMPLETE**

## Ratchet Status

Baseline at docs/trace/.trace-baseline.json (critical=0, high=0 in-scope, medium=34).

| Severity | Baseline | Current | Status |
|----------|----------|---------|--------|
| CRITICAL (P0) | 0 | 0 | PASS |
| HIGH (P1, in-scope) | 0 | **0** | PASS (TR-PHANTOM-ORG-001 surfaced +1 then fixed same session → net 0) |
| MEDIUM (P2) | 34 | 34 | PASS (unchanged) |

Net: a real P1 (staff-deactivation broken journey) was surfaced for the first time once the map covered the backend route table — **and fixed in the same session** (TypeSpec `@delete` op + regen + real-route regression test). TR-INFRA-001 also cleared from the EXTERNAL ledger. Baseline stays at high=0; gate PASS.
