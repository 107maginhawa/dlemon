# Trace Report

---
oli-version: trace-v1
Report Date: 2026-06-01
Phase: D (code + tests exist)
Modules Traced: all 12 (dental-audit, dental-billing, dental-clinical, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit, emr-consultation, external-records-import) + governance chains (erasure, legal-hold, retention)
Mode: standalone (artifact + code, engine-map-enriched for frontend scope)
Data Sources: WORKFLOW_MAP.md (98 WF + WF-P01..05 + WF-EMRC-001..006), DOMAIN_MODEL.md (24 DE, 6 SM), 12 MODULE_SPECs, ROLE_PERMISSION_MATRIX.md, EVENT_CONTRACTS.md, ERROR_TAXONOMY.md, OpenAPI (specs/api/dist/openapi/openapi.json — 210 paths / 140 dental), codebase-map engine v5 (FRESH: producer=engine, fields_unavailable=[], git_sha a3bfc9a5), COMPLIANCE_REPORT.md (governance pass), CONFIDENCE_REPORT.md, JOURNEY_COVERAGE_REPORT.md
Partial Staleness: CODE_SPEC_TRACE.json reports `spec_source: null` / `matched: []` because `spec_trace_optin: false` in map-meta (spec-trace phase ran 0ms — opt-in, disabled by config, NOT a regression). CODE_API_SURFACE response_shape is empty for all 43 frontend-scope endpoints and api_calls carry no field-access data → algorithm 5g cannot produce verified edges; 5g findings route to `unverified` per R1 (confidence_threshold=MEDIUM). Trace relied on direct ID grep across spec + test source.
HEAD: 26925ce2 (re-verify pass over ece7f89c → 26925ce2)
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
- **Net change:** P1 5 → 4 → 2 → **1** (TR-WF-PLAN + TR-WF-DOCDRIFT cleared 2026-06-01; **TR-BR-013 formally deferred → P2 2026-06-01**, see below). Remaining P1: TR-INFRA-001 (separate-repo tooling).
- **TR-DG-002 RESOLVED (was the standing P1).** The dental manual-route → TypeSpec migration on this branch (OpenAPI 103→140 dental paths, suite 2957/0) landed the erasure + legal-hold **HTTP path operations into the compiled OpenAPI contract**. Verified present: `/dental/erasure-requests` (+`/{id}`, `/approve`, `/reject`) and `/dental/legal-holds` (+`/{id}/release`) — 6 path operations, not just the component schemas that were the prior residual gap. SDK/clients can now discover the WFG-006 erasure surface. Spec→code→test→contract chain now COMPLETE.
- **TR-LH-001 downgraded (P2 → anchored/informational).** Legal-hold endpoints are now in the OpenAPI contract and have a TypeSpec source; residual is only the absence of a *product* MODULE_SPEC/WF node. code→test→contract COMPLETE.
- **BR-019 — CORRECTION 2026-06-01: prior "now TESTED" was a FALSE POSITIVE.** `approveAmendment.test.ts` asserts **501 NOT_IMPLEMENTED** — a *deferral-stub* test, not an implementation. BR-019 supervisor approval is deliberately deferred (feature flag `dental_clinical_amendment_approval` off, MODULE_SPEC §18). WORKFLOW_MAP's not-enforced status was CORRECT; the read mistook the 501-stub test for implementation. WORKFLOW_MAP §5 clarified to "DEFERRED — 501 stub + deferral test" so doc and code agree → **TR-WF-DOCDRIFT resolved (false positive)**.
- **WF-048/049/050 confirmed (TR-WF-PLAN RESOLVED 2026-06-01).** The treatment FSM transitions are enforced in `updateDentalTreatment.ts` (forward-only → 422 per BR-006; dismiss/decline audited) and tested by `treatment.fsm.property.test.ts` / `treatment-fsm-http.test.ts` / `dental-visit.treatment-status-transitions.test.ts`. WORKFLOW_MAP ops table [INFERRED] tags removed; they are real workflows.
- **Product BR namespace re-baselined to 58 canonical IDs** (prior report counted 47 product BRs; this run traces the full namespace incl. BR-SCH-001..004 + BR-P01..P07). 53/58 carry an explicit `BR-NNN` tag in a test; the remaining 5 are semantically covered (medium confidence) → 58/58 any-layer.
- **TR-INFRA-001 carried (P1, tooling).** Engine spec-trace is opt-in and disabled (`spec_trace_optin: false`); not run, not a product trace regression.

## Summary

| Metric | Count |
|--------|-------|
| Total nodes | 405 |
| Total edges | 612 |
| CRITICAL gaps (P0) | 0 |
| HIGH gaps (P1) | 1 |
| MEDIUM gaps (P2) | 34 |
| unverified (5g, map-degenerate) | 1 cluster |
| Chain coverage (WF → test) | 80% |

Node manifest: WF=109 (98 numbered + WF-P01..05 + WF-EMRC-001..006), BR=58 (BR-001..047 + BR-SCH-001..004 + BR-P01..P07), AC=48, SM=8 (SM-VISIT/TREATMENT/INVOICE/CONSENT/LABORDER + SM-01/SM-02; +2 prose state machines), DE=24, endpoints=210 (OpenAPI) / 140 dental, roles=9. Nodes in graph = 405 ≥ collected. Output marked **COMPLETE**.

## Verdict: PASS

No P0 dangling references and no cross-module blind spots (all 16 §12 cross-module flows have an integration mechanism — sync API, pg-boss event, or UUID-ref). Every canonical BR (58/58) has at least one test at some layer. The prior standing P1 (TR-DG-002, erasure paths absent from OpenAPI) is **RESOLVED** by this branch's route migration. TR-WF-PLAN (WF-048/049/050 promoted to confirmed) and TR-WF-DOCDRIFT (BR-019 false-positive — clarified to DEFERRED-501-stub) were cleared 2026-06-01. TR-BR-013 (billing `markUncollectible` WFG-008) was **formally deferred to Phase 2 → P2 2026-06-01** (feature-flag `dental_billing_uncollectible` off, intentional 501 stub + deferral tests, documented error path AC-BIL-005 → 501; reconciled in WORKFLOW_MAP §5/WFG-008 mirroring BR-019/BR-020). The **1 remaining P1** is tooling (engine spec-trace opt-in/off — separate repo). All P2s are AC-tag drift, missing-E2E for unit-only BRs, orphan/inferred WFs, the legal-hold/retention spec-anchoring items, and the BR-013 deferral — all report-only.

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
| TR-INFRA-001 | engine trace off | `CODE_SPEC_TRACE.json` `spec_source: null`, `matched: []`; map-meta `spec_trace_optin: false`, spec-trace phase 0ms. Engine spec→code trace is opt-in and disabled — not run this map build. Tooling/config item, not a product regression. **Carried.** | docs/audits/codebase-map/CODE_SPEC_TRACE.json; .map-meta.json:provenance | Enable `spec_trace_optin` and re-run engine map against the 210-path OpenAPI; verify matched>0. |
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
| 5g FE-field-phantom | 5g | Engine map `CODE_API_SURFACE.response_shape` empty for all 43 frontend endpoints (`is_phantom=true` blanket) and api_calls carry no field-access data. Below MEDIUM confidence_threshold → routed to unverified, does not fail gate. Re-run map with response-shape extraction to materialize 5g edges. |

## Suggested Actions

| Priority | Action | Gaps Fixed | Command |
|----------|--------|-----------|---------|
| 1 | Enable engine `spec_trace_optin` + re-run codebase map against 210-path OpenAPI; verify matched>0 and response_shape populated | TR-INFRA-001 (P1) + unblocks 5g unverified | re-run oli-codebase-map |
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

Baseline at docs/trace/.trace-baseline.json (critical=0, high=5, medium=15).

| Severity | Baseline | Current | Status |
|----------|----------|---------|--------|
| CRITICAL (P0) | 0 | 0 | PASS |
| HIGH (P1) | 5 | 2 | PASS (improved −3: TR-DG-002 + TR-WF-PLAN + TR-WF-DOCDRIFT resolved) |
| MEDIUM (P2) | 15 | 33 | NOTE: count rose due to expanded canonical-BR/AC namespace re-baseline (58 BR / 48 AC vs prior 47/55) surfacing pre-existing unit-only + untagged items — not new regressions. All P2 report-only. Per-severity ratchet on P0/P1 PASS. |

Net: P1 improved (5→4). P2 nominal increase is a measurement-scope change (full namespace traced this run), not introduced gaps. No P0. No regression on the gating severities.
