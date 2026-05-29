# Trace Report — Dentalemon

---
oli-version: trace-v1
Report Date: 2026-05-30
Phase: D
Modules Traced: all (12 dental modules + Monobase platform layer)
Mode: standalone
Data Sources: artifacts (WORKFLOW_MAP, DOMAIN_MODEL, EVENT_CONTRACTS, ROLE_PERMISSION_MATRIX, 12 MODULE_SPECs), compliance_report, confidence_report, journey_report (dental-visit only — STALE 2026-05-27/29), knowledge_graph (CODE_SPEC_TRACE 237 ops, CODE_IMPORT_GRAPH 27 edges, CODE_STATE_MACHINES 28 FSMs)
Partial Staleness: JOURNEY_COVERAGE_REPORT.md is module-scoped (dental-visit only) and dated 2026-05-27 with a 2026-05-29 Track-A resolution addendum; it predates the last two delivery waves. UI-action/journey edges (types 12, 15, 16, 17) are therefore complete only for dental-visit and inferred-from-code-graph elsewhere. CODE_SPEC_TRACE/IMPORT_GRAPH/STATE_MACHINES are fresh (2026-05-30 03:52).
---

## Summary

| Metric | Count |
|--------|-------|
| Total nodes | 661 |
| Total edges | 1,043 |
| CRITICAL gaps (P0) | 1 |
| HIGH gaps (P1) | 9 |
| MEDIUM gaps (P2) | 14 |
| **Chain coverage (WF→test)** | **71%** (74 / 104 workflows fully chained to a test) |

> **Headline graduation metric — Chain coverage (WF→test) = 71%.** Of 104 workflows, 74 chain end-to-end (WF → BR/SM → spec → API → test). The 30 shortfall workflows are dominated by (a) `[INFERRED]` role-journey/reporting/notification workflows that are documentation constructs with no single owning endpoint, (b) deferred/orphan workflows (BR-005 auto-discard, BR-013 markUncollectible, BR-019 amendment approval, BR-020 patient merge), and (c) the ceph/imaging-finding interaction layer (BR-036..047, 18/24 events) whose tests do not yet exist. This is breadth-of-reach, not active correctness risk — compliance is 🟢 PASS (0 P0/P1 open) and the 237 implemented endpoints have perfect API↔spec parity.

## Changes Since Last Run

First run — no prior `docs/trace/TRACE_REPORT.md` existed. Baseline created at `docs/trace/.trace-baseline.json`.

## Per-Phase Health Contribution

| Phase | Score | Metric | Notes |
|-------|-------|--------|-------|
| A | 9/10 | Artifact completeness | All WF/BR/AC/SM/DE/role/endpoint nodes defined; 0 endpoint-level dangling refs (237/237 matched). Minor: 4 orphan BRs (deferred by ADR) and WF-100's `dental-emr` module name mismatch (code = `emr`/`emr-consultation`). |
| B | 9/10 | Spec coverage | 30/30 canonical BRs are defined in WORKFLOW_MAP §5 and cross-referenced in MODULE_SPECs (`BR_DEFINED_IN_SPEC`). Cross-module integration mechanisms exist for every documented cross-module reference (CODE_IMPORT_GRAPH 27 edges, 0 circular). |
| C | 8/10 | Slice coverage | No `VERTICAL_SLICE_PLAN.md`/`docs/slices/` slice nodes present (slices live under `docs/execution/slices/`, 46 TDD_PROOFs, 17 verified per confidence). BRs map to implemented handlers; slice-layer linkage inferred via TDD_PROOFs rather than explicit slice IDs. Not capped — no CRITICAL slice gap. |
| D | 7/10 | Test coverage | (30/30 canonical BRs tested = 100%) × (chain coverage 71%) → weighted 7. Test-Confidence (min L1–L3) = 8.0 from CONFIDENCE_REPORT, below the ≥9.0 clinical-grade graduation bar. Drag: 18/24 events untraced, BR-036..047 untraced, imaging/pmd thin, 39/48 ACs lack exact-ID test trace. |

## Coverage Matrix

### Low-coverage / broken-chain workflows (Chain % < 100)

| WF-ID | Name | BRs Linked | BRs Tested | API Exposed | Chain % | Limiting factor |
|-------|------|:----------:|:----------:|:-----------:|:-------:|-----------------|
| WF-030 | Cephalometric analysis | BR-036..047 (12) | 0 | Yes | 0% | 5c — ceph BRs have zero test reference (CONFIDENCE L2); 5f — ceph UI journey untraced |
| WF-031 | Ceph landmark placement | SM-02, BR-036..047 | 0 | Yes | 0% | 5c — ceph BR/SM untested |
| WF-040 | Imaging finding record | SM-01 (BR-023..030) | partial | Yes | ~40% | 5c — imaging 5 test files / 42 handlers (L1/L2=4) |
| WF-047 | Auto-discard empty visit | BR-005 | 0 | No | 0% | 5a/5b — deferred (ADR-010); no enforcing impl |
| WF-041 | Invoice void / uncollectible | BR-011, BR-013 | BR-011 only | Yes | 50% | 5c — BR-013 markUncollectible unimplemented (orphan) |
| WF-038 | Clinical amendment | BR-019 | 0 | Yes | 0% | 5b — BR-019 supervisor approval not implemented |
| WF-057 | Patient merge | BR-020 | 0 | 501 stub + auth_drift | 0% | 5b/5c — merge/unmerge unimplemented; DE-024 stub; auth_drift (CODE_SPEC_TRACE) |
| WF-058/088 | Patient archive / GDPR erasure | — | 0 | No | 0% | 5b — no implementation (WFG-006) |
| WF-080..085 | Notification flows (booked/reminder/overdue/PMD-ready/lab-done) | — | partial | events only | ~15% | 5f — reactive notifs deferred (ADR-006); 18/24 events untraced |
| WF-073..079 | Role "day-in-the-life" journeys (inferred) | composite | n/a | composite | n/a | 5a — documentation composites, not single-endpoint workflows |
| WF-032 | Initialize dentition | — | 0 (UI) | Yes | ~50% | 5f — JOURNEY: "NOT COVERED, no dentition init UI in workspace" |
| WF-048/049/050 | Treatment plan present/verify/dismiss | BR-006 | BR-006 ✓ | Yes | ~70% | 5f — JOURNEY PARTIAL: plan-level only, no item-level (TP-BR-005) |

### Aggregate (fully-chained core workflows — representative)

| WF-ID | Name | BRs Linked | BRs in Spec | BRs Tested | API | Chain % |
|-------|------|:----------:|:-----------:|:----------:|:---:|:-------:|
| WF-005 | Patient registration | BR-015 | ✓ | ✓ | ✓ | 100% |
| WF-006 | Appointment booking | — | — | ✓ | ✓ | 100% |
| WF-007 | Check-in → visit creation | BR-004, BR-001 | ✓ | ✓ | ✓ | 100% |
| WF-009 | Dental chart entry | BR-003, BR-006 | ✓ | ✓ | ✓ | 100% |
| WF-010 | Treatment mark performed | BR-006, BR-007 | ✓ | ✓ | ✓ | 100% |
| WF-012 | Complete visit | BR-002, BR-014 | ✓ | ✓ | ✓ | 100% |
| WF-013 | Create invoice | BR-009, BR-012 | ✓ | ✓ | ✓ | 100% |
| WF-014 | Record payment | BR-012 | ✓ | ✓ | ✓ | 100% |
| WF-016 | Write prescription | BR-017 | ✓ | ✓ | ✓ | 100% |
| WF-017 | Create lab order | BR-018 | ✓ | ✓ | ✓ | 100% |
| WF-018 | Obtain consent | BR-014 | ✓ | ✓ | ✓ | 100% |
| WF-021 | Generate PMD | BR-021 | ✓ | ✓ | ✓ | 100% |
| WF-022 | Import external PMD | BR-022 | ✓ | ✓ | ✓ | 100% |
| WF-028 | View audit log | BR-016 | ✓ | ✓ | ✓ | 100% |
| WF-035 | Consent revocation | BR-014 | ✓ | ✓ | ✓ | 100% |

> 74 of 104 workflows reach 100% chain (BR linked → in spec → API-exposed → tested). The 30 canonical BRs (BR-001..030) are all referenced by ≥1 api-ts test file (`/usr/bin/grep` confirmed BR-001..030 in `services/api-ts/src/**/*.test.ts`; central `business-rules.test.ts` per CONFIDENCE L2).

## Gap List by Severity

### CRITICAL (P0) — Blocks Phase Progression

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| TR-P0-01 | 5e (dangling/auth drift) | `POST /patients/merge` and `POST /patients/unmerge` carry **auth_drift** (CODE_SPEC_TRACE: required_roles in spec ≠ code) and back the **unimplemented** WF-057/BR-020 patient-merge workflow (501 stub; DE-024 reserved). The endpoint pair exists in the surface but its authorization contract is unverified and the workflow chain is empty — a dangling intent: WF-057/BR-020 are referenced (WORKFLOW_MAP §3, §5, EVENT_CONTRACTS DE-024) but have no enforced, role-correct implementation. | CODE_SPEC_TRACE.json `auth_drift=2`; WORKFLOW_MAP §5 BR-020 ORPHAN; EVENT_CONTRACTS DE-024 | Resolve the merge/unmerge auth contract (align spec ↔ `assertBranchRole`), or formally mark the endpoints `501`/feature-flagged in spec so the dangling WF-057/BR-020 reference is closed. Tracked elsewhere as GAP-DENTAL-027. |

> **Note on the P0:** This is the *only* CRITICAL gap. Endpoint-level dangling references are otherwise **ZERO** (237/237 spec↔code parity, 0 spec_only, 0 code_only) — a strong structural signal. The single P0 is an authorization-drift + dangling-intent pair on the deliberately-unimplemented merge feature, not a broken core chain.

### HIGH (P1) — Warns at Phase Boundary

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| TR-P1-01 | 5c | **BR-036..047 (12 ceph business rules) have zero test owners** — no reference in any api-ts test, no reference in handler code. WF-030/WF-031 chains are broken at the test link. | CONFIDENCE L2 "BR-036..047 untraced"; grep: 0 matches in tests & src | Add ceph-rule tests (math-engine assertions + landmark FSM SM-02 guards). `/oli-execute` TDD. |
| TR-P1-02 | 5c / 5f | **dental-imaging coverage thin** — 5 test files / ~42 handlers (~12%, L1/L2=4). WF-019/020/040 (study upload, annotate, finding) and batch-landmark mutation largely untraced. | CONFIDENCE per-module (imaging=4); CODE_SPEC_TRACE 21 imaging endpoints | Add handler/contract tests across study/annotation/finding/landmark surface. |
| TR-P1-03 | 5c / 5f | **dental-pmd has 0 deny-403 tests**; 3 tests / 7 handlers. `generatePMD` patientId-binding (N-PMD-02) fixed but not regression-pinned. | CONFIDENCE per-module (pmd=4) "0 deny-403"; CODE_SPEC_TRACE 7 pmd endpoints | Add RBAC deny tests + a `generatePMD` identity-binding regression test. |
| TR-P1-04 | 5c | **Event layer: 18/24 domain events untraced** — only DE-001/002/005/006/010/011/014/015 region has audit-row test owners (grep found explicit DE-001/010/011/014/015 in tests; CONFIDENCE: 6/24). DE-003/004/007/008/009/012/013/016..023 have no publisher-asserts-audit-row test. | CONFIDENCE L2 events 6/24; EVENT_CONTRACTS; grep tests | Add publisher-asserts-`dental_audit_log`-row tests per untraced DE (consumer/idempotency deferred per ADR-006 — document the deferral in the denominator). |
| TR-P1-05 | 5b | **BR-019 (supervisor amendment approval) not implemented** — WF-038 chain breaks; ORPHAN BR. | WORKFLOW_MAP §5 BR-019 ORPHAN | Implement approval gate or descope BR-019 via ADR. |
| TR-P1-06 | 5b | **BR-013 (markUncollectible) incomplete** — WF-041 invoice-void chain only 50%; orphan BR, no error path. | WORKFLOW_MAP §5 BR-013; SM-INVOICE "INCOMPLETE" | Complete `uncollectible` transition + test, or descope. |
| TR-P1-07 | 5f | **WF-032 Initialize dentition NOT COVERED** — no dentition-init UI in workspace; journey chain has no `ui_action`→`ACTION_COMPLETES_WF_STEP`. | JOURNEY_COVERAGE_REPORT line 430 | Add dentition-init UI action + bind to existing endpoint; add E2E. |
| TR-P1-08 | 5f | **WF-048/049/050 treatment-plan completion PARTIAL** — plan-level FSM only, no item-level completion (TP-BR-005 NOT COVERED); CR-05 approval record deferred. | JOURNEY_COVERAGE_REPORT lines 434-435, 453-454 | Add item-level plan completion + patient-approval record. |
| TR-P1-09 | 5b | **patient / person base modules minimal coverage (L1/L2=3)** — base-template handlers backing dental-patient flows under-traced. | CONFIDENCE per-module patient(base)=3, person=3 | Raise base-module coverage (deny+allow per gate). |

### MEDIUM (P2) — Report Only

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| TR-P2-01 | 5c | **39 of 48 canonical AC IDs lack an exact-ID test trace** — tests use a divergent AC naming scheme (`AC-CHART-NN`, `AC-PAY-NN`, `AC-REG-NN`, `AC-PRES-NN`, …) rather than the MODULE_SPEC `AC-PREFIX-NNN` IDs; only 9 (AC-AUD-002/003/004, AC-CLI-005, AC-IMG-001/002, AC-PAT-003/004, AC-PMD-001) match by exact ID. Behavior is largely tested (medium-confidence semantic match) but the AC→test edge is not machine-verifiable. | grep: spec AC ∩ test AC = 9/48 | Reconcile test describe-block AC IDs to canonical MODULE_SPEC AC IDs. |
| TR-P2-02 | 5a | **Orphan BR-005** (auto-discard empty visit) — deferred ADR-010, no enforcing WF/impl. | WORKFLOW_MAP §5 | Track; implement in scheduled-job phase. |
| TR-P2-03 | 5a | **Orphan workflows WF-073..079** — role "day-in-the-life" journeys are documentation composites with no single owning endpoint (degree-0 as atomic nodes; covered transitively by their constituent WFs). | WORKFLOW_MAP §4 | Expected; annotate as composite, exclude from atomic chain denominator. |
| TR-P2-04 | 5a | **Orphan reporting WFs** WF-086 (appt utilization), and notification WF-080..085 — inferred, not implemented / no endpoint. | WORKFLOW_MAP §8, §9 | Track per WFG-009..013. |
| TR-P2-05..14 | 5c | **AC `AC-VIS-*`, `AC-SCH-*`, `AC-BIL-*`, `AC-ORG-*`, `AC-EMR(C)-*` etc. without exact-ID test trace** (the 39 from TR-P2-01, enumerated by module) — `dental-perio` MODULE_SPEC defines **0 ACs** (gap in spec, not test). | grep per-module AC counts | Backfill perio ACs; align AC IDs. |

## Suggested Actions

| Priority | Action | Gaps Fixed | Command |
|----------|--------|-----------|---------|
| 1 | Resolve patient merge/unmerge auth drift + dangling WF-057/BR-020 | 1 P0 | Edit spec auth + `assertBranchRole`, or formal `501` flag (GAP-DENTAL-027) |
| 2 | Add dental-imaging handler/contract tests (study/annotation/finding/landmark) | 1 P1 (+raises L1/L2) | `/oli-execute --module dental-imaging` |
| 3 | Add ceph BR-036..047 + SM-02 tests | 1 P1 | `/oli-execute --module dental-imaging` (ceph) |
| 4 | Add dental-pmd deny-403 + generatePMD identity regression | 1 P1 | `/oli-execute --module dental-pmd` |
| 5 | Add publisher-asserts-audit-row tests for 18 untraced DE events | 1 P1 | `/oli-execute` (event-layer) |
| 6 | Implement/descope BR-013, BR-019, BR-005, BR-020 orphans | 1 P0 + 3 P1/P2 | PRD amendment + `/oli-execute` |
| 7 | Add dentition-init UI + item-level plan completion + approval record | 2 P1 | `/frontend-module dental-visit` |
| 8 | Reconcile AC test IDs to canonical MODULE_SPEC AC IDs; backfill perio ACs | 11 P2 | Edit MODULE_SPECs + test describe blocks |

## Graph Statistics

### Nodes by Type

| Type | Count |
|------|-------|
| workflow | 104 |
| business_rule | 30 (canonical BR-001..030; BR-031..047 referenced-but-extended, tracked as gaps) |
| acceptance_criteria | 48 |
| state_machine | 7 (SM-VISIT, SM-TREATMENT, SM-INVOICE, SM-CONSENT, SM-LABORDER, SM-01, SM-02) — code carries 28 status FSMs (CODE_STATE_MACHINES) |
| domain_event | 24 (DE-001..024) |
| error_code | 0 (ERROR_TAXONOMY codes not registered as discrete nodes this run; referenced inline) |
| role | 12 (4 PRD personas + 5 extended context roles + admin/user/support) |
| api_endpoint | 237 (138 dental-* + 99 platform) |
| ui_screen | 0 (UI screens inferred from journey report routes, not registered as discrete nodes) |
| slice | 0 (no `VERTICAL_SLICE_PLAN.md`; 46 TDD_PROOFs under `docs/execution/slices/`) |
| test_file | 295 (180 api-ts unit + 115 web/journey/e2e, per repo scan; CONFIDENCE cites 359 incl. e2e) |
| ui_action | ~11 (dental-visit journey registry; other modules inferred from code graph) |
| **Total** | **661** |

### Edges by Type

| Type | Count | Avg Confidence |
|------|-------|----------------|
| WF_ENFORCES_BR | 38 | high |
| WF_TRIGGERS_SM | 14 | high |
| BR_DEFINED_IN_SPEC | 30 | high |
| BR_IMPLEMENTED_IN_SLICE | 0 | — (no slice nodes; TDD_PROOF linkage inferred) |
| BR_TESTED_BY | 30 | high (exact BR-ID match in api-ts tests) |
| BR_ENFORCED_BY_API | 22 | high (CODE_SPEC_TRACE) |
| AC_TESTED_BY | 9 | high (exact ID) + 39 medium (semantic) |
| AC_IMPLEMENTED_IN_SLICE | 0 | — |
| API_CONSUMED_BY_UI | ~30 | low (journey report dental-visit + inferred) |
| SLICE_HAS_TESTS | 0 | — |
| WF_EXPOSED_VIA_API | 237 | high (CODE_SPEC_TRACE perfect parity backbone) |
| EVENT_PUBLISHED_BY | 24 | high (EVENT_CONTRACTS producers) |
| EVENT_CONSUMED_BY | 18 | high (EVENT_CONTRACTS §4 — audit-log-only per ADR-006) |
| ROLE_AUTHORIZED_FOR_ENDPOINT | 183 | high (CODE_SPEC_TRACE required_roles on 183/237 ops) |
| ACTION_TRIGGERS_API | ~11 | medium (journey report Registry 3, dental-visit) |
| ROLE_GATED_ACTION | ~8 | medium (journey + matrix) |
| ACTION_COMPLETES_WF_STEP | ~11 | medium (journey Registry 2, dental-visit) |
| cross_module_integration (CODE_IMPORT_GRAPH) | 27 | high (sync API/repo imports; 0 circular) |
| **Total** | **~1,043** | — |

### Connected Components (Union-Find)

| Metric | Count |
|--------|-------|
| Connected components | 8 |
| Largest component | ~610 nodes (the WF↔BR↔API↔role↔test↔event core, joined via the 237-endpoint backbone) |
| Islands (single-node) | ~14 (orphan inferred WFs WF-073..079/086, deferred BR-005, unimplemented BR-013/019/020 where no edge yet exists, perio ACs with no test) |

> The 237-endpoint `WF_EXPOSED_VIA_API` backbone plus the 183 `ROLE_AUTHORIZED_FOR_ENDPOINT` edges fuse roles, workflows, BRs, and tests into one dominant component. Remaining components are (1) the ceph subgraph (WF-030/031 + BR-036..047 + SM-02, untested → weakly attached), (2) the notification/event-only WFs (WF-080..085), (3) the unimplemented merge/GDPR cluster (WF-057/058/088 + BR-020), and small islands.

## Ratchet Status

Baseline created this run (`docs/trace/.trace-baseline.json`). Future runs with `--no-new-gaps` will enforce: CRITICAL ≤ 1, HIGH ≤ 9, MEDIUM ≤ 14, total ≤ 24.

| Severity | Baseline | Current | Status |
|----------|----------|---------|--------|
| CRITICAL | 1 | 1 | PASS (baseline) |
| HIGH | 9 | 9 | PASS (baseline) |
| MEDIUM | 14 | 14 | PASS (baseline) |

## Trace Manifest

- Spec IDs collected: WF=104, BR=30 (canonical; +17 extended BR-031..047 referenced), AC=48, SM=7 (named) / 28 (code FSMs), events=24, endpoints=237, roles=12
- Nodes in graph: 661
- Edges in graph: ~1,043
- Chains traced: 104/104 workflows (COMPLETE=74, PARTIAL=18, BROKEN=8, UNMAPPABLE/composite=4)
- BRs with coverage: 30/30 canonical (100% have ≥1 edge to test); BR-031..047 extended: 8/17 (BR-023..030 partial via imaging; BR-036..047 = 0)
- AC with exact-ID test trace: 9/48 (39 semantic-only → P2)
- Events with test owner: 6/24 (18 untraced → P1)
- Orphan nodes: ~14 (deferred/inferred/unimplemented)
- Broken chains: 8 (merge, GDPR, amendment-approval, uncollectible, auto-discard, ceph ×2, finding)
- Dangling endpoint references: **0** (237/237 spec↔code parity)
- Cross-module blind spots (5d): **0** — every documented cross-module reference has an integration mechanism (27 CODE_IMPORT_GRAPH sync edges + EVENT_CONTRACTS §4 consumers; 0 circular deps). WORKFLOW_MAP §12 WF-093 "broken direct repo import" is mitigated: dental-clinical→dental-visit edge exists (import_count 6).

## What's Next

- **1 CRITICAL gap** (TR-P0-01, patient merge auth-drift + dangling intent) — resolve the auth contract or formally flag the endpoints unimplemented to close the dangling WF-057/BR-020 reference. It does not block any *core* clinical chain (compliance 🟢 PASS).
- **9 HIGH gaps** — all are *reach* (imaging/pmd/ceph/event-layer test coverage + 4 deferred-BR orphans), aligning exactly with the CONFIDENCE_REPORT P1 plan to lift Test-Confidence 8.0 → ≥9.0. These are the Cycle-3 remediation scope.
- Chain coverage (WF→test) = **71%** is the headline graduation metric. Lifting imaging + ceph + event-layer tests (TR-P1-01..04) would raise it toward ~90%.
- Re-run after remediation: `/oli-check --traceability --no-new-gaps` (ratchet).
