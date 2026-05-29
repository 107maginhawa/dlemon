# Trace Report — Dentalemon

---
oli-version: trace-v1
Report Date: 2026-05-30 (cycle-3 refresh + journey-report integration)
Phase: D
Modules Traced: all (12 dental modules + Monobase platform layer)
Mode: standalone
Data Sources: artifacts (WORKFLOW_MAP, DOMAIN_MODEL, EVENT_CONTRACTS, ROLE_PERMISSION_MATRIX, 12 MODULE_SPECs), knowledge_graph (CODE_SPEC_TRACE 237 ops / 0 spec-only / 0 code-only / auth_drift=2, CODE_API_SURFACE 237 endpoints, CODE_DATA_MODEL, CODE_STATE_MACHINES, CODE_IMPORT_GRAPH), compliance_report (🟡 WARN, 0 P0 / 15 P1 / 40 P2 / 27 P3), confidence_report (suite Test-Conf floor 7, **1 P0 = emr PHI audit assertions**), journey_report (ALL-FRONTEND, fresh 2026-05-30 — 0 P0 / 2 P1 / 1 P2 / 3 P3)
Partial Staleness: CODE_SPEC_TRACE.json carries `auth_drift=2` on `mergePatients`/`unmergePatients` because its scanner only inspects ROUTE-level middleware (`code_roles=None`), not in-handler `user.role !== 'admin'` guards — a known detection false-positive (also surfaced as journey J-MAP-003). CONFIDENCE_REPORT and CODE_SPEC_TRACE predate some cycle-3 test additions; this refresh credits cycle-3 from the per-module compliance/confidence slices. The JOURNEY report is now ALL-FRONTEND (supersedes the prior dental-visit-only scope) and contributes UI-journey edges (types 12,15,16,17) across modules.
---

## Changes Since Last Run

- **New gaps:** 2 (TR-P1-10 J-FE-001 invoice-issue broken FE→API chain; TR-P1-11 J-FE-002 ceph-report broken FE→API chain) — both surfaced by the new all-frontend journey scan that the prior trace predated.
- **Carried P0:** 1 (TR-P0-02 = CONF-EMRC-001 emr PHI audit-row assertions; the single suite P0 from CONFIDENCE — the prior trace report did not surface it as a P0 traceability gap).
- **Resolved/Downgraded:** TR-P0-01 patient-merge auth-drift → P3 cosmetic (in-handler guard tested; engine false-positive). Ceph BR-036..047, dental-imaging reach, pmd deny, person base = RESOLVED.
- **Net change vs cycle-2:** P0 1→1 (different P0: was auth-drift, now emr-audit), P1 9→7, P2 ~14.

## Summary

| Metric | Count |
|--------|-------|
| Total nodes | ~668 |
| Total edges | ~1,099 |
| **CRITICAL gaps (P0)** | **1** |
| **HIGH gaps (P1)** | **7** |
| **MEDIUM gaps (P2)** | 14 |
| Chain coverage (WF→test) | ~80% (83 / 104 workflows fully chained to a test) |
| API↔spec parity (backbone) | **237 / 237** (0 spec-only, 0 code-only) |
| Cross-module blind spots (5d) | **0** |
| Dangling endpoint references (5e) | **0** |

> **Headline.** The intent→spec→code→test backbone is structurally strong: every one of the 237 OpenAPI operations resolves to a routed handler (CODE_SPEC_TRACE perfect parity), every documented cross-module reference has an integration mechanism (27 sync import edges + EVENT_CONTRACTS §4 consumers, 0 circular), and the 30 canonical BRs + 12 ceph BRs are all tested. The remaining gaps are **(a) one P0 carried from CONFIDENCE** (emr PHI audit assertions have zero asserting coverage — a regression reintroducing the patient UUID into the tenant slot would pass green), **(b) two newly-surfaced broken FE→API journey chains** (invoice-issue and ceph-report — the UI calls a method/path that no routed handler answers, so WF-052 and the WF-030 reporting tail are dead at the click), and **(c) deferred-feature / event-test reach gaps** (BR-005/013/019/020, DE-017..024 publisher-audit tests, 39/48 ACs lacking exact-ID trace).

## Per-Phase Health Contribution

| Phase | Score | Metric | Notes |
|-------|-------|--------|-------|
| A | 9/10 | Artifact completeness | All WF/BR/AC/SM/DE/role/endpoint nodes defined; **0 endpoint-level dangling refs (237/237 matched)**. Minor: deferred BRs (BR-005/013/019/020) and WF-100's `dental-emr` module-name mismatch (code = `emr`/`emr-consultation`). |
| B | 9/10 | Spec coverage | 30/30 canonical BRs defined in WORKFLOW_MAP §5 and cross-referenced in MODULE_SPECs; +12 extended ceph BRs (BR-036..047) have spec→test edges. C4/C7 consistency PASS (dental-clinical→dental-visit via VisitService interface; 0 circular). Gap: `dental-perio` MODULE_SPEC defines 0 ACs. |
| C | 8/10 | Slice coverage | No `VERTICAL_SLICE_PLAN.md` slice nodes; 46 TDD_PROOFs under `docs/execution/slices/`. BRs map to implemented handlers; slice-layer linkage inferred. **Not capped (no CRITICAL slice gap).** |
| D | **6/10** | Test coverage | (canonical BR tested 100% + 12/12 ceph) × (chain coverage 80%) would weight to 8, **but capped lower by the 1 P0** (emr signature-compliance guarantee has ZERO asserting coverage per CONFIDENCE) **and the 2 broken FE→API journey chains** (WF-052, WF-030r dead at runtime). Residual drag: DE-017..024 (8 events untraced), BR-013/019 incomplete, 39/48 ACs lack exact-ID trace. |

## Coverage Matrix — broken / low-coverage workflows

| WF-ID | Name | BRs Linked | BRs Tested | API Exposed | Chain % | Limiting factor |
|-------|------|:----------:|:----------:|:-----------:|:-------:|-----------------|
| WF-052 | Invoice issue (draft→issued) | BR-012 | ✓ (backend) | Yes (PATCH `issueDentalInvoice`) | **BROKEN** | **5f — FE calls `POST .../issue`; handler is PATCH; +duplicated call (J-FE-001). Action dead at runtime.** |
| WF-030r | Ceph report generate/view | BR-036..047 | ✓ | Yes (`/ceph/reports` plural) | **BROKEN** | **5f — FE calls singular `/ceph/report`; only plural routed (J-FE-002). 404 on Generate Report + report viewer route.** |
| (emr) | EMR consultation PHI audit (create/read/update/finalize/list/listEMRPatients) | EMR-C BRs | **0 audit-row asserts** | Yes | partial | **5c — P0: signature-compliance guarantee has ZERO asserting coverage (CONF-EMRC-001).** |
| WF-047 | Auto-discard empty visit | BR-005 | 0 | No | 0% | 5a/5b — deferred (ADR-010); no enforcing impl. |
| WF-041 | Invoice void / uncollectible | BR-011, BR-013 | BR-011 only | Yes | 50% | 5c — BR-013 markUncollectible incomplete (V-PMD/V-BIL orphan). |
| WF-038 | Clinical amendment | BR-019 | append-only ✓, approval gate 0 | Yes | ~40% | 5b — BR-019 supervisor-approval 501 endpoint missing (V-CLI-001). |
| WF-057 | Patient merge | BR-020 | describe.skip v2.0 | merge/unmerge present + auth_drift FP | 0% | 5b/5c — formally deferred v2.0; auth_drift is engine false-positive (in-handler admin guard present). |
| WF-058/088 | Patient archive / GDPR erasure | — | 0 | No | 0% | 5b — no implementation (WFG-006). |
| WF-080..085 | Notification flows | — | partial | events only | ~15% | 5f — reactive notifs deferred (ADR-006); DE-017..024 untraced. |
| WF-032 | Initialize dentition | — | 0 (UI) | Yes | ~50% | 5f — JOURNEY: no dentition-init UI in workspace. |
| WF-048/049/050 | Treatment plan present/verify/dismiss | BR-006 | BR-006 ✓ | Yes | ~70% | 5f — JOURNEY PARTIAL: plan-level only, no item-level (TP-BR-005). |
| WF-073..079 | Role "day-in-the-life" journeys (inferred) | composite | n/a | composite | n/a | 5a — documentation composites, not single-endpoint workflows. |

### Fully-chained core workflows (representative — 100% chain)

WF-005, WF-006, WF-007, WF-009, WF-010, WF-012, WF-013, WF-014, WF-016, WF-017, WF-018, WF-021, WF-022, WF-028, WF-035 — each: BR linked → in spec → API-exposed → tested. 74 of 104 workflows reach 100% chain.

## Gap List by Severity

### CRITICAL (P0) — Blocks Phase Progression

| Gap ID | Algorithm | Description | Source | Suggested Fix | Autofix |
|--------|-----------|-------------|--------|---------------|---------|
| **TR-P0-02** | 5c (coverage gap, security-critical) | **emr-consultation PHI audit-row assertions missing — the module's signature compliance guarantee has ZERO asserting coverage.** All 6 EMR PHI ops (create/read/update/finalize/list/listEMRPatients) log audit rows, but no test asserts (a) an audit row with the expected `action` exists, (b) `tenant_id === EMR_AUDIT_TENANT_SENTINEL` (NOT the patient UUID), (c) update logs field NAMES only. A regression reintroducing the patient UUID into the tenant slot would pass the suite green. This is the single suite P0 (CONFIDENCE CONF-EMRC-001). | CONFIDENCE_REPORT §P0; subjects `createConsultation.ts:110`, `getConsultation.ts:90`, `updateConsultation.ts:99`, `finalizeConsultation.ts:93`, `listConsultations.ts:131`, `listEMRPatients.ts:99` | New `emr-audit.test.ts`: assert audit-row presence + sentinel tenant_id + field-names-only for each of the 6 ops. | false |

> **Note on the former TR-P0-01 (merge/unmerge auth-drift):** RESOLVED → P3 cosmetic. CODE_SPEC_TRACE still reports `auth_drift=2` and CODE_API_SURFACE shows auth `?` on `POST /patients/merge` + `/unmerge`, but this is a route-level-scanner false-positive: the in-handler admin guard (`user.role !== 'admin' → ForbiddenError`) is present and tested (`patient-merge-auth.test.ts`), and BR-020 is formally deferred (`describe.skip … [deferred v2.0]`). Journey J-MAP-003 flags the same; COMPLIANCE should confirm and the map should be regenerated to clear it. Endpoint-level dangling references = **0** (237/237 parity). Cross-module blind spots = **0**.

### HIGH (P1) — Warns at Phase Boundary

| Gap ID | Algorithm | Description | Source | Suggested Fix | Autofix |
|--------|-----------|-------------|--------|---------------|---------|
| **TR-P1-10** | 5f | **WF-052 Invoice-issue FE→API chain BROKEN** — `invoice-detail.tsx:63,68` issues `POST /dental/billing/invoices/:id/issue`, but the routed handler `issueDentalInvoice` is **PATCH**; the call is also duplicated (bad-merge artifact). The draft→issued action is dead at runtime (404/405). | JOURNEY J-FE-001; `apps/dentalemon/src/features/billing/components/invoice-detail.tsx:63,68` | Change method to PATCH; delete the duplicate fetch (lines 67-71). | **true** |
| **TR-P1-11** | 5f | **WF-030 (ceph) report FE→API chain BROKEN** — `CephWorkspacePanel.tsx:52` (POST) and `imaging-ceph-report.$imageId.tsx:35` (GET) call singular `/ceph/report`; only plural `/ceph/reports` (`CephMgmt_createCephReport`/`getCephReport`) is routed. Generate-Report + report-viewer route 404. | JOURNEY J-FE-002; `apps/dentalemon/src/features/imaging/components/CephWorkspacePanel.tsx:52`; `apps/dentalemon/src/routes/imaging-ceph-report.$imageId.tsx:35` | Change FE paths to `/ceph/reports` (plural). | **true** |
| TR-P1-04 | 5c | **Event layer: 8/24 domain events still untraced (was 18/24)** — `*-events.test.ts` assert DE-001..016 by exact ID; remaining untraced DE-017..024 (PMDGenerated, ImagingStudyUploaded, ImagingFindingConfirmed, CephAnalysisComputed, PatientRegistered, MembershipAssigned, and `[INFERRED]` DE-023 MembershipRevoked / DE-024 PatientMergeRequested-NOT-IMPL). | EVENT_CONTRACTS; live test grep | Add publisher-asserts-`dental_audit_log`-row tests for DE-017..022; document DE-023/024 as inferred/deferred in the denominator. | false |
| TR-P1-05 | 5b | **BR-019 supervisor-approval gate unimplemented** — append-only amendment IS tested, but WF-038's approval requirement has no enforcing impl; spec requires a 501 endpoint (V-CLI-001). | WORKFLOW_MAP §5; COMPLIANCE V-CLI-001 | Add `POST /dental/visits/:id/amendments/:aid/approve` → 501 NOT_IMPLEMENTED + route, or descope via ADR. | false |
| TR-P1-06 | 5b | **BR-013 (markUncollectible) incomplete** — WF-041 invoice-void chain ~50%; `uncollectible` transition lacks complete impl/error path. | WORKFLOW_MAP §5 BR-013; SM-INVOICE "INCOMPLETE" | Complete `uncollectible` transition + test, or descope. | false |
| TR-P1-07 | 5f | **WF-032 Initialize dentition NOT COVERED** — no dentition-init UI in workspace; journey chain has no `ui_action`→`ACTION_COMPLETES_WF_STEP` (endpoint `initializeDentition` exists). | JOURNEY (workspace) | Add dentition-init UI action bound to `POST /dental/patients/:id/dentition`; add E2E. | false |
| TR-P1-08 | 5f | **WF-048/049/050 treatment-plan completion PARTIAL** — plan-level FSM only, no item-level completion (TP-BR-005 NOT COVERED); CR-05 approval record deferred. | JOURNEY (treatment-plans) | Add item-level plan completion + patient-approval record. | false |

> **RESOLVED this cycle:** ceph BR-036..047 (12/12 tested, `ceph-business-rules.test.ts`) · dental-imaging (5→7 files, ~273 it-blocks, `imaging-integration.test.ts` 55 real-DB/13 handlers) · dental-pmd deny tests · person base (25 unit + 91 e2e). Former TR-P0-01 merge auth-drift → P3.

### MEDIUM (P2) — Report Only

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| TR-P2-01 | 5c | **39 of 48 canonical AC IDs lack an exact-ID test trace** — tests use divergent AC naming (`AC-CHART-NN`, `AC-PAY-NN`, `AC-REG-NN`, …) vs MODULE_SPEC `AC-PREFIX-NNN`; only 9 match by exact ID (AC-AUD-002/003/004, AC-CLI-005, AC-IMG-001/002, AC-PAT-003/004, AC-PMD-001). Behavior largely tested (medium-confidence semantic), AC→test edge not machine-verifiable. | spec AC ∩ test AC = 9/48 | Reconcile test describe-block AC IDs to canonical MODULE_SPEC AC IDs. |
| TR-P2-02 | 5a | **Orphan BR-005** (auto-discard empty visit) — deferred ADR-010, no enforcing WF/impl. | WORKFLOW_MAP §5 | Track; implement in scheduled-job phase. |
| TR-P2-03 | 5a | **Orphan workflows WF-073..079** — role day-in-the-life composites with no single owning endpoint (covered transitively). | WORKFLOW_MAP §4 | Annotate as composite; exclude from atomic chain denominator. |
| TR-P2-04 | 5a | **Orphan reporting/notification WFs** — WF-086 (appt utilization), WF-080..085 (notifications): inferred, not implemented / no endpoint. | WORKFLOW_MAP §8/§9 | Track per WFG-009..013. |
| TR-P2-05 | 5c | **`dental-perio` MODULE_SPEC defines 0 ACs** — spec gap (rules tested, but no AC nodes to trace to). | MODULE_SPEC dental-perio | Backfill perio ACs. |
| TR-P2-06..14 | 5c | **AC-VIS-\*, AC-SCH-\*, AC-BIL-\*, AC-ORG-\*, AC-EMR(C)-\*** etc. without exact-ID test trace (the 39 from TR-P2-01, enumerated by module). | grep per-module AC counts | Align AC IDs across spec + tests. |

> Map-quality P2 (consumed from JOURNEY J-MAP-001/002): `CODE_ROUTE_MAP.json` is empty (`{"routes":{}}`) — the extractor doesn't parse TanStack file-based routes; and `CODE_API_SURFACE.json` omits the **68 hand-mounted routes in `services/api-ts/src/app.ts`** and reports all 237 endpoints with `consumer_count:0`. This means the knowledge graph under-reports FE→BE edges and would generate false dead-call findings if trusted alone — regenerate `oli-codebase-map` with app.ts mount detection + SDK/fetch consumer resolution before the next trace, else TR-P1-10/11-class breaks stay invisible to the graph.

## Suggested Actions

| Priority | Action | Gaps Fixed | Command |
|----------|--------|-----------|---------|
| 1 | Add `emr-audit.test.ts` asserting audit-row + sentinel tenant_id + field-names-only for all 6 EMR PHI ops | **1 P0** | `/oli-execute --module emr-consultation` |
| 2 | Fix FE invoice-issue (POST→PATCH + dedupe) and ceph-report (`/reports` plural) | **2 P1** | `/oli-check --fix` (both autofixable) / `/frontend-module` |
| 3 | Add publisher-asserts-audit-row tests for DE-017..022 (mark DE-023/024 inferred/deferred) | 1 P1 | `/oli-execute` (event-layer) |
| 4 | Implement/descope BR-019 approval gate (501) + BR-013 markUncollectible | 2 P1 | PRD amendment + `/oli-execute` |
| 5 | Add dentition-init UI (WF-032) + item-level plan completion (WF-048/049/050) | 2 P1 | `/frontend-module dental-visit` |
| 6 | Reconcile AC test IDs to canonical MODULE_SPEC AC IDs; backfill perio ACs | 11 P2 | Edit MODULE_SPECs + test describe blocks |
| 7 | Regenerate knowledge graph with app.ts mount + TanStack route + consumer resolution; clears auth_drift FP | P2/P3 map quality | `/oli-codebase-map` |

## Graph Statistics

### Nodes by Type

| Type | Count |
|------|-------|
| workflow | 104 |
| business_rule | 30 canonical (BR-001..030) + 17 extended (BR-031..047, ceph/imaging) |
| acceptance_criteria | 48 (perio = 0 — spec gap) |
| state_machine | 7 named (SM-VISIT/TREATMENT/INVOICE/CONSENT/LABORDER/SM-01/SM-02) — code carries 28 status FSMs |
| domain_event | 24 (DE-001..024) |
| role | 12 (4 PRD personas + extended + admin/user/support) |
| api_endpoint | 237 (matched) + ~68 hand-mounted in app.ts (omitted by CODE_API_SURFACE — J-MAP-001) |
| ui_screen | 24 TanStack file-based routes (CODE_ROUTE_MAP empty — inferred from app source) |
| slice | 0 nodes (46 TDD_PROOFs under docs/execution/slices/) |
| test_file | ~302 |
| ui_action | ~11 mapped (dental-visit journey) + inferred elsewhere |
| **Total** | **~668** |

### Edges by Type (key)

| Type | Count | Avg Confidence |
|------|-------|----------------|
| WF_EXPOSED_VIA_API | 237 | high (perfect spec↔code parity backbone) |
| ROLE_AUTHORIZED_FOR_ENDPOINT | 183 | high (required_roles on 183/237 ops) |
| WF_ENFORCES_BR | 38 | high |
| BR_DEFINED_IN_SPEC | 30 | high |
| BR_TESTED_BY | 42 | high (30 canonical + 12 ceph) |
| AC_TESTED_BY | 9 exact + 39 semantic | high / medium |
| EVENT_TESTED_BY (publisher-audit) | 16 | high (DE-001..016; DE-017..024 untraced) |
| ACTION_TRIGGERS_API | ~11 | medium (2 BROKEN: J-FE-001/002) |
| cross_module_integration | 27 | high (0 circular; C7 via VisitService interface) |
| **Total** | **~1,099** | — |

### Connected Components (Union-Find)

| Metric | Count |
|--------|-------|
| Connected components | 8 |
| Largest component | ~610 nodes (WF↔BR↔API↔role↔test↔event core via 237-endpoint backbone) |
| Islands (single-node) | ~14 (orphan inferred WFs, deferred BR-005, unimplemented BR-013/019/020, perio ACs absent) |

## Ratchet Status

| Severity | Cycle-2 Baseline | Cycle-3 Current | Status |
|----------|:---:|:---:|--------|
| CRITICAL | 1 | **1** | PASS (= ; different P0 — emr-audit replaces resolved merge auth-drift) |
| HIGH | 9 | **7** | PASS (−2; +2 new journey breaks, −4 resolved reach gaps) |
| MEDIUM | 14 | 14 | PASS (=) |
| **Total** | 24 | **22** | PASS (−2) |

> The 2 new P1s (TR-P1-10/11) are net additions surfaced only because the journey scan widened to all-frontend; they are offset by 4 resolved reach P1s, so HIGH still ratchets down. The P0 count holds at 1 but is now a genuine security-coverage gap (emr PHI audit assertions) rather than the engine-false-positive merge auth-drift.

## Trace Manifest

- Spec IDs collected: WF=104, BR=30 canonical (+17 extended), AC=48, SM=7 named / 28 code FSMs, events=24, endpoints=237, roles=12
- Nodes in graph: ~668
- Edges in graph: ~1,099
- Chains traced: 104/104 (COMPLETE ≈83, PARTIAL ≈13, BROKEN ≈6 [GDPR, amendment-approval, uncollectible, auto-discard, +2 FE journey breaks], UNMAPPABLE/composite 4)
- BRs with coverage: 30/30 canonical + 12/12 ceph = 42 tested; deferred orphans BR-005/013/019/020
- AC with exact-ID test trace: 9/48 (39 semantic-only → P2)
- Events with test owner: 16/24 (DE-017..024 untraced)
- Dangling endpoint references: **0** (237/237 spec↔code parity)
- Cross-module blind spots (5d): **0**

## What's Next

- **1 CRITICAL gap (TR-P0-02)** — land the emr PHI audit-row assertions; it is the only true ship-blocker-class traceability gap (security-coverage). Until then, Phase D is capped.
- **7 HIGH gaps** — 2 are autofixable FE string/method edits (invoice-issue PATCH, ceph `/reports` plural) that resurrect dead WF-052 + WF-030r actions; the rest are event-test reach + deferred-feature completion.
- **Regenerate the knowledge graph** before trusting it for the next trace: it omits 68 app.ts mounts, has an empty route map, reports all endpoints consumer_count:0, and carries the merge auth_drift false-positive.
- Re-run after remediation: `/oli-check --traceability --no-new-gaps` (ratchet: CRITICAL ≤ 1, HIGH ≤ 7, MEDIUM ≤ 14).
