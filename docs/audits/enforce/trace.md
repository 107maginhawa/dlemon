<!-- oli-version: 1.1 | skill: oli-trace | run: run-7-2026-05-29 | prev: run-6-strict-2026-05-29 -->
<!-- generated: 2026-05-29 | phase: D (TDD_PROOFs + test files present) -->
<!-- partial-staleness: dashboard module (no MODULE_SPEC), dental-patient sub-modules (alerts/insurance/contacts/sync unspecced) -->

# Traceability Report — run-7-2026-05-29

**Run ID:** run-7-2026-05-29
**Date:** 2026-05-29
**Baseline:** run-6-strict-2026-05-29 (P0=0, P1=11, P2=12, P3=0)
**Phase detected:** D (WORKFLOW_MAP + DOMAIN_MODEL + MODULE_SPECs + SLICE_SPECs + TDD_PROOFs + test files)
**Algorithms executed:** 4a (orphan nodes), 4b (broken chains), 4c (coverage gaps), 4d (cross-module blind spots), 4e (dangling references), 5f (journey completion gaps)

---

## Summary

| Metric | Count | vs run-6 |
|--------|-------|----------|
| **P0 findings** | 1 | +1 new |
| **P1 findings** | 10 | -1 (TR-020 resolved) |
| **P2 findings** | 15 | +3 new |
| **P3 findings** | 0 | — |
| **Total findings** | 26 | +3 net |
| **Orphan BRs** | 4 | same (BR-005, BR-013, BR-019, BR-020) |
| **Broken chains** | 2 | same (FR0.x dashboard, FR9.1 perio routing) |
| **Dead specs (AC no test)** | 5 | -1 (TR-020 resolved, TR-024 new) |
| **Unspecced impls** | 36 | +3 new groups |
| **State machine divergences** | 2 | +2 new (TR-025, TR-026) |
| **Resolved since run-6** | 1 | TR-020 (AC-AUD-002 — 405 test committed a9895673) |

---

## Graph Statistics

| Node type | Count | Source |
|-----------|-------|--------|
| workflow (WF-NNN) | 104 | WORKFLOW_MAP (98) + MODULE_SPECs inferred (6) |
| business_rule (BR-NNN) | 47 | WORKFLOW_MAP §5 (BR-001–BR-022) + MODULE_SPECs (BR-P01–P07, BR-SCH-001–004, BR-016b/c, BR-023–047) |
| acceptance_criteria (AC-NNN) | 43 | MODULE_SPECs §11 across 11 modules |
| state_machine (SM-NNN) | 7 | DOMAIN_MODEL §6 (SM-VISIT, SM-TREATMENT, SM-INVOICE, SM-CONSENT, SM-LABORDER, SM-IMAGING-FINDING/SM-01, SM-CEPH-LANDMARK/SM-02) |
| domain_event (DE-NNN) | 24 | EVENT_CONTRACTS (DE-001–DE-024) |
| error_code | 42 | ERROR_TAXONOMY.md |
| role | 6 | ROLE_PERMISSION_MATRIX (dentist_owner, dentist_associate, staff_full, staff_scheduling, patient, platform_admin) |
| api_endpoint | 67 | MODULE_SPEC §10 API tables across 11 modules |
| slice | 27 | docs/execution/slices/ (SLICE_SPECs found) |
| test_file | 73 | services/api-ts/src/handlers/dental-*/*.test.ts |
| ui_screen | 11 | apps/dentalemon/src/routes/*.tsx |
| ui_action | 31 | JOURNEY_COVERAGE_REPORT (dental-visit + dental-billing + dental-pmd) |

**Total nodes:** ~476 | **Connectivity ratio:** medium (Phase D — test files add edges but UI chain incomplete)

---

## Coverage Matrix — WF→BR→Spec→Slice→Test Chain

| Module | WFs Specced | BRs Defined | ACs Defined | Tests Present | Full Chain % |
|--------|-------------|-------------|-------------|---------------|--------------|
| dental-visit | 10 | 8 | 5 | 19 test files | 85% |
| dental-patient | 8 | 4 | 4 | 13 test files | 70% (sub-modules unspecced) |
| dental-scheduling | 6 | 4 | 5 | 10 test files | 88% |
| dental-billing | 8 | 5 | 5 | 12 test files | 82% |
| dental-clinical | 9 | 6 | 6 | 18 test files | 72% (BR-003 guards missing) |
| dental-imaging | 7 | 25 | 5 | 5 test files | 60% (annotation SM missing) |
| dental-org | 7 | 4 | 3 | 24 test files | 78% |
| dental-pmd | 3 | 2 | 4 | 3 test files | 68% (TR-018 dead spec) |
| dental-perio | 5 | 7 | 10 | 2 test files | 55% (WF routing error) |
| dental-audit | 3 | 0 | 4 | 2 test files | 80% |
| dental-emr-integration | 3 | 0 | 3 | 0 spec'd tests | 20% (future phase, premature impl) |
| **dashboard** | **0** | **0** | **0** | **0** | **0% (no MODULE_SPEC)** |

**Overall chain completeness:** ~68% (Phase D baseline; CRITICAL gaps cap score — see §health-score)

---

## Algorithm 4a — Orphan Nodes (degree-0)

Nodes with no edges to other nodes (no spec reference, no test reference, no WF link).

| ID | Node | Type | Severity | Status |
|----|------|------|----------|--------|
| TR-001 | BR-005 | business_rule | P1 | KNOWN — auto-discard empty visit; ADR-010 deferred; no enforcing WF |
| TR-002 | BR-013 | business_rule | P1 | KNOWN — markUncollectible; no handler file, no test |
| TR-003 | BR-019 | business_rule | P1 | KNOWN — supervisor amendment approval; not implemented |
| TR-004 | BR-020 | business_rule | P1 | KNOWN — patient merge; cross-module cascade undocumented |
| TR-005 | BR-030 | business_rule | P2 | KNOWN — annotation SM tail (BR-023–035 range); spec cites BR-023 only |
| TR-006 | BR-047 | business_rule | P2 | KNOWN — ceph analysis tail (BR-036–047 range); spec cites BR-036 only |

**Orphan count:** 6 nodes (4 P1, 2 P2)

---

## Algorithm 4b — Broken Chains (WF→BR→Spec→Slice→Test)

| ID | FR/WF | Module | Chain Status | Severity | Notes |
|----|-------|--------|--------------|----------|-------|
| TR-013 | FR0.1–FR0.8 | dashboard | BROKEN | P1 | 8 dashboard FRs — no WF assignment, no MODULE_SPEC, no test coverage |
| TR-014 | FR9.1 / WF-042 | dental-perio | BROKEN | P2 | Perio charting WF-042 → MODULE_SPEC §4 lists WF-038 (wrong WF); spec routing error |

**Working chains (sampled):**
- FR1.4 → WF-009 → dental-visit → AC-VIS-002/003 → tests ✓
- FR2.1 → WF-005 → dental-patient → AC-PAT-001 → tests ✓
- FR3.1 → WF-006 → dental-scheduling → AC-SCH-001 → tests ✓
- FR4.1 → WF-013 → dental-billing → AC-BIL-001 → tests ✓
- FR1.12 → WF-016 → dental-clinical → AC-CLI-001 → tests ✓
- FR1.19 → WF-030 → dental-imaging → AC-IMG-001/003 → tests ✓
- FR6.1 → WF-004 → dental-org → WF-004 spec → tests ✓
- FR8.1 → WF-021 → dental-pmd → AC-PMD-001 → tests ✓

---

## Algorithm 4c — Coverage Gaps (BR/AC with no test, AC with no slice)

### Dead Specs (AC defined, no behavioral test found)

| ID | AC | Module | Severity | Status | Description |
|----|----|--------|----------|--------|-------------|
| TR-015 | AC-CLI-006 | dental-clinical | P1 | OPEN | Write to completed visit → 422 (BR-003): createPrescription, createConsentForm, createAttachment have no visit-status guard and no test covering 422 on completed visit write |
| TR-016 | AC-IMG-002 | dental-imaging | P0 | **ESCALATED** | Annotation status reversal (confirmed→draft) → 422 (SM-01): imaging_annotation table has NO status column in schema — the annotation state machine (draft/confirmed/resolved) is entirely absent from the implementation. AC is dead and the underlying SM is unimplemented. |
| TR-017 | AC-BIL-005 | dental-billing | P1 | KNOWN | markUncollectible → 501 (BR-013): no handler file, no test |
| TR-018 | AC-PMD-002 | dental-pmd | P2 | OPEN | PATCH imported PMD → 405 (BR-022): no test asserts 405 on PATCH /dental/pmd/imported/:id |
| TR-024 | AC-P01–AC-P10 | dental-perio | P2 | NEW | Perio ACs unchecked by ID: dental-perio-coverage.test.ts covers behavior but no test references AC-P01 through AC-P10 by identifier; chain is semantically covered but formally broken |

**Note on TR-020 (RESOLVED):** AC-AUD-002 (405 on audit PATCH/DELETE) — test `audit-append-only.test.ts` committed at a9895673 (2026-05-29 09:29). Test asserts 405 for DELETE, PUT, PATCH on `/dental/audit-events/:id`. **Resolved before run-7.**

### Untested BRs (implementation exists, no test tag)

The following BRs are enforced in code but have no test explicitly tagged with the BR identifier (semantic coverage present, formal traceability broken):

- BR-028: No test (P1 gap V-IMG-004 per imaging MODULE_SPEC)
- BR-040: No dedicated test for calibration unit display UI labeling (P2)
- BR-046: No stale-read test after PATCH coordinates (P2)

---

## Algorithm 4d — Cross-Module Blind Spots

Cross-module dependencies with no formal integration contract (API endpoint OR event contract OR integration test).

| ID | From | To | Dependency | Severity | Status |
|----|------|----|------------|----------|--------|
| TR-027 | dental-clinical | dental-visit | Schema import (dentalVisits, treatmentPlanVersions) via repos/*.schema.ts — G-003 coupling; facade exemption applies but no integration contract | P2 | KNOWN — G-003 tracked, Wave G1 refactor planned |
| TR-028 | dental-scheduling | dental-visit | Check-in creates visit — cross-module sync call (WF-089); no formal API contract between modules | P2 | KNOWN — WF-089 documented in WORKFLOW_MAP §12 |
| TR-029 | dental-pmd | dental-clinical | PMD snapshot reads clinical data at generation — no integration test covering multi-module PMD generation | P2 | KNOWN — PMD-S1 slice covers unit; integration gap |

**Event coverage audit (DE-001 to DE-024):**
- DE-001 VisitCheckedIn: dental-audit consumer present; dental-billing consumer absent
- DE-002 VisitCompleted: dental-pmd consumer flag absent (enforce module report)
- DE-007 through DE-009 (invoice lifecycle): no consumers implemented
- DE-021 PatientRegistered: not published (EM-PAT-005 P1 in enforce report)
- DE-008 InvoicePaid consumer in dental-patient: absent (EM-PAT-006 P1)
- **Overall event coverage: 0% emitted (0/24 events implemented per cross-module report)**

| ID | Gap | Severity | Status |
|----|-----|----------|--------|
| TR-030 | DE-001 to DE-024: 0% event emission coverage | P1 | KNOWN — cross-module report EX-series |

---

## Algorithm 4e — Dangling References (ID cited, never defined)

| ID | Reference | Cited In | Severity | Status |
|----|-----------|----------|----------|--------|
| TR-031 | BUSINESS_RULES.md §Imaging (for BR-023–035) | dental-imaging MODULE_SPEC §5 | P2 | KNOWN — BUSINESS_RULES.md exists at docs/prd/BUSINESS_RULES.md; BR-023–035 ARE defined there in the imaging MODULE_SPEC §5b table. Not dangling — cross-reference valid. |
| TR-032 | WF-042 cited in dental-perio MODULE_SPEC §4 as WF-038 | MODULE_SPEC | P2 | KNOWN — wrong WF ID in spec (should be WF-042, not WF-038) |
| TR-033 | SM-01 referenced for both ImagingAnnotation AND ImagingFinding | DOMAIN_MODEL + MODULE_SPEC | P2 | NEW — SM-01 label is ambiguous: MODULE_SPEC §2 assigns SM-01 to ImagingAnnotation; DOMAIN_MODEL §6 defines SM-IMAGING-FINDING (SM-01) with draft→confirmed→resolved states. The finding FSM in code uses suspected/confirmed/monitoring/resolved (4 states). Three definitions conflict. |

---

## Algorithm 5f — Journey Completion Gaps (UI-relevant WFs without complete interaction chain)

Requires: ui_action → api_endpoint → workflow. Checked against JOURNEY_COVERAGE_REPORT files.

| ID | WF | Module | Gap | Severity | Status |
|----|----|---------|----|----------|--------|
| TR-034 | WF-003 | auth | Patient magic link login — no patient portal route exists in apps/dentalemon/src/routes/ | P2 | KNOWN — Phase 2 patient portal |
| TR-035 | WF-015 | dental-billing | Create payment plan — PaymentPlanView is read-only, no creation form; WF-015 unreachable from frontend | P1 | OPEN (JOURNEY report confirmed MISSING) |
| TR-036 | WF-021 | dental-pmd | Generate PMD — handleSharePMD fires unconditionally; no eligibility check, no error feedback, no download fallback | P1 | OPEN (JOURNEY report BLOCKER) |
| TR-037 | WF-022 | dental-pmd | Import External PMD — no file upload; raw JSON textarea only; no checksum verification UI | P1 | OPEN (JOURNEY report BLOCKER) |
| TR-038 | WF-078 | auth/patient | Patient portal session (view PMD, view appointments, revoke consent) — no patient-facing routes | P2 | KNOWN — Phase 2 |
| TR-039 | WF-088 | dental-patient | GDPR patient erasure — no handler and no frontend route | P2 | KNOWN — compliance gap WFG-006 |

---

## NEW Findings (run-7 additions)

### TR-025 — State Machine Divergence: SM-01 (Imaging Annotation)

**Algorithm:** 4e (dangling reference) + 4c (coverage gap)
**Severity:** P0
**Status:** NEW

**Description:** The `imaging_annotation` table has **no status column** in the Drizzle schema (`repos/imaging.schema.ts`). The MODULE_SPEC §2 specifies annotation state: `draft→confirmed→resolved`. The DOMAIN_MODEL §6 defines SM-IMAGING-FINDING (SM-01) with `draft→confirmed→resolved`. However:

1. The `imaging_annotation` Drizzle table (`imagingAnnotations`) contains no `status` field — only `type`, `geometry`, `measurementValue`, `measurementUnit`, `toothNumber`, `visible`.
2. AC-IMG-002 ("Annotation status reversal confirmed→draft → 422") is dead: the status field to revert does not exist in the schema.
3. WF-020 (Annotate radiograph) assumes SM-01 annotation state transitions that have no database backing.

**Impact:** CRITICAL — the annotation state machine is entirely absent from the implementation. BR-023 to BR-035 (annotation rules) are documented against a schema that doesn't exist.

**Fix:** Add `status` column to `imaging_annotation` table with enum `draft|confirmed|resolved`; implement transition guard in updateAnnotation handler; add test for confirmed→draft reversal 422.

---

### TR-026 — State Machine Divergence: SM-01 (Imaging Finding vs Spec)

**Algorithm:** 4e (dangling reference)
**Severity:** P2
**Status:** NEW

**Description:** The imaging finding FSM in code (`repos/imaging_finding.schema.ts`) implements 4 states: `suspected | confirmed | monitoring | resolved`. The DOMAIN_MODEL §6 and MODULE_SPEC §2 define SM-01 (confusingly applied to both annotations and findings) as `draft → confirmed → resolved` (3 states). Specific divergences:
- Code initial state: `suspected`; spec initial state: `draft`
- Code has: `monitoring` state (oscillates with `confirmed`); spec has no `monitoring`
- Code terminal: `resolved`; spec terminal: `resolved` (matches)
- `confirmed ↔ monitoring` oscillation — not documented in any spec

**Impact:** MEDIUM — the implementation is clinically richer than the spec (monitoring is a valid clinical state). However the spec needs updating to reflect the actual state machine. AC-IMG-002 references "confirmed→draft" which maps to "confirmed→suspected" in code — the test concept is correct but the state names are wrong.

**Fix:** Update DOMAIN_MODEL §6 SM-IMAGING-FINDING and MODULE_SPEC §2 to reflect the 4-state model. Rename AC-IMG-002 to reference "suspected" not "draft".

---

### TR-027 — Unspecced Sub-Module: dental-patient extended operations

**Algorithm:** 5c (unspecced implementation)
**Severity:** P2
**Status:** NEW (pre-existing handlers, newly audited)

**Description:** The dental-patient MODULE_SPEC §10 defines 10 API endpoints (patient CRUD, archive, statement, follow-up, bulk-archive, import, export). The implementation contains **6 additional sub-module groups** with **29 handler files** not listed in MODULE_SPEC §10 or §19 (Vertical Slice Plan):

| Sub-module | Handlers | PRD basis |
|-----------|----------|-----------|
| alerts/ | createDentalAlert, listDentalAlerts, updateDentalAlert | FR2.15 (Safety Floor alerts) — spec references implicit |
| contacts/ | createPatientContact, deletePatientContact, listPatientContacts, updatePatientContact | FR2.3 (emergency contact) — spec mentions but no API table entry |
| insurance/ | createClaimDraft, createInsuranceProfile, listPatientClaims, listPatientInsuranceProfiles, updateClaimStatus, updateInsuranceProfile, getClaimReadiness | PRD Phase 2 only — unspecced for Phase 1 |
| sync/ | createSyncLog, listSyncLogs, updateSyncLog | Not in PRD v3 Phase 1 |
| engagement/ | createTask, listPatientTasks, updateTask (+ follow-up note handlers) | Follow-up notes in spec; tasks not |
| treatment-plans/ | acceptTreatmentPlan, createTreatmentPlan, getTreatmentPlan, getTreatmentPlanVersion, listPatientTreatmentPlans, updateTreatmentPlan | "treatment plan view" mentioned in spec but no API table entry |

**Impact:** 29 handlers implement behavior with no MODULE_SPEC coverage, no ACs, and no defined WF-IDs. Insurance handlers are explicitly Phase 2 per PRD.

**Fix:** Add MODULE_SPEC §10 entries for contacts, alerts, and engagement/tasks (Phase 1 scope). Move insurance to Phase 2 feature flag gate. Add WF-IDs for task management and sync logging.

---

## Gap Summary (WORKFLOW_MAP §14 pre-identified gaps)

| WFG | Description | TR link | Status |
|-----|-------------|---------|--------|
| WFG-001 | BR-005 auto-discard (no enforcing workflow) | TR-001, TR-007 | DEFERRED (ADR-010) |
| WFG-002 | Orphan appointment when visit draft fails | untracked | OPEN |
| WFG-003 | Concurrent visit conflict — client recovery undocumented | untracked | OPEN |
| WFG-004 | Duplicate invoice race condition | untracked | OPEN |
| WFG-005 | PMD generation async SLA unclear | untracked | OPEN |
| WFG-006 | GDPR PHI purge not implemented | TR-039 | OPEN |
| WFG-007 | Patient merge (BR-020) undocumented | TR-004, TR-008 | OPEN |
| WFG-008–013 | Notification workflows | TR-030 event coverage | P3 |
| WFG-014 | Lab order and consent form search/filter | untracked | P3 |

---

## Findings Index

| ID | Algorithm | Sev | Status | One-liner |
|----|-----------|-----|--------|-----------|
| TR-001 | 4a | P1 | KNOWN | BR-005 orphan — auto-discard deferred |
| TR-002 | 4a | P1 | KNOWN | BR-013 orphan — markUncollectible no handler |
| TR-003 | 4a | P1 | KNOWN | BR-019 orphan — supervisor approval not implemented |
| TR-004 | 4a | P1 | KNOWN | BR-020 orphan — patient merge not implemented |
| TR-005 | 4a | P2 | KNOWN | BR-030 range tail uncovered in spec |
| TR-006 | 4a | P2 | KNOWN | BR-047 range tail uncovered in spec |
| TR-007 | 4b | P1 | KNOWN | WF-047 orphan op — auto-discard no pg-boss job |
| TR-008 | 4b | P1 | KNOWN | WF-057 orphan op — patient merge not implemented |
| TR-009 | 4b | P2 | KNOWN | WF-061 orphan op — slot generation G-001 not implemented |
| TR-010 | 4b | P2 | KNOWN | WF-042 spec routing error in dental-perio MODULE_SPEC §4 |
| TR-011 | 5c | P2 | KNOWN | 32 shim handlers (CephMgmt_* etc.) unspecced by filename |
| TR-012 | 5c | P2 | KNOWN | ~170 dental handlers not named in MODULE_SPEC (spec covers via WF-NNN, not filenames) |
| TR-013 | 4b | P1 | KNOWN | FR0.1–FR0.8 dashboard chain broken — no MODULE_SPEC, no WF, no tests |
| TR-014 | 4b | P2 | KNOWN | FR9.1 perio chain broken — WF-042 not listed in MODULE_SPEC §4 |
| TR-015 | 4c | P1 | OPEN | AC-CLI-006 dead spec — BR-003 guards missing in createPrescription, createConsentForm, createAttachment |
| TR-016 | 4c | P0 | **ESCALATED** | AC-IMG-002 dead spec — annotation SM (draft/confirmed/resolved) entirely absent from schema |
| TR-017 | 4c | P1 | KNOWN | AC-BIL-005 dead spec — markUncollectible no 501 handler |
| TR-018 | 4c | P2 | OPEN | AC-PMD-002 dead spec — no 405 test for PATCH /imported/:id |
| TR-019 | 4c | P2 | OPEN | AC-EMR-001 dead spec — future phase; no EMR 405 test |
| TR-020 | 4c | — | **RESOLVED** | AC-AUD-002 — 405 test committed a9895673 (2026-05-29 09:29) |
| TR-021 | 5f | P1 | OPEN | EMR forward violation — 6 handlers in /handlers/emr/ violate FUTURE PHASE gate |
| TR-022 | 5f | P2 | KNOWN | 32 shim handlers — structural duplicate from F7 remediation |
| TR-023 | 5f | P2 | OPEN | dental-perio WF mismatch in MODULE_SPEC §4 (WF-038 → should be WF-042) |
| TR-024 | 4c | P2 | NEW | AC-P01–AC-P10 dental-perio — behavior covered but no AC-ID tags in tests |
| TR-025 | 4c+4e | P0 | **NEW** | Annotation SM (SM-01) entirely missing from schema — no status column on imaging_annotation |
| TR-026 | 4e | P2 | **NEW** | SM-01 naming ambiguity — annotation spec says draft/confirmed/resolved; finding code has suspected/confirmed/monitoring/resolved |
| TR-027 | 5c | P2 | **NEW** | dental-patient 29 unspecced handlers — alerts, contacts, insurance (Phase 2), sync, tasks, treatment-plans |
| TR-028 | 4d | P2 | KNOWN | dental-clinical→dental-visit cross-module schema import (G-003, facade exempt) |
| TR-029 | 4d | P2 | KNOWN | dental-scheduling→dental-visit check-in no integration contract |
| TR-030 | 4d | P1 | KNOWN | 0/24 domain events emitted — entire event system absent |
| TR-031 | 4e | — | CLOSED | BUSINESS_RULES.md reference valid — file exists and defines BR-023–035 |
| TR-032 | 4e | P2 | KNOWN | WF-042 cited as WF-038 in dental-perio MODULE_SPEC |
| TR-033 | 4e | P2 | **NEW** | SM-01 label collision — three conflicting definitions across spec artifacts |
| TR-034 | 5f | P2 | KNOWN | WF-003 patient magic link — no patient portal route (Phase 2) |
| TR-035 | 5f | P1 | OPEN | WF-015 create payment plan — no UI; PaymentPlanView is read-only |
| TR-036 | 5f | P1 | OPEN | WF-021 generate PMD — no eligibility check, no error feedback, no download fallback |
| TR-037 | 5f | P1 | OPEN | WF-022 import PMD — no file upload; raw JSON textarea only; no checksum UI |
| TR-038 | 5f | P2 | KNOWN | WF-078 patient portal session — no patient-facing routes (Phase 2) |
| TR-039 | 5f | P2 | KNOWN | WF-088 GDPR erasure — no handler, no frontend route |

**Totals: P0=2, P1=10, P2=15, P3=0. Resolved: 1 (TR-020).**

---

## Phase Health Score Contribution

Per oli-trace formula: Phase D score = `slice_completion × trace_chain_coverage%`

| Dimension | Value | Notes |
|-----------|-------|-------|
| Slice completion | ~63% | 27 SLICE_SPECs present; dashboard, patient sub-modules, and event system have no slices |
| Chain coverage | ~68% | WF→BR→Spec→Slice→Test complete for 68% of audited FRs |
| CRITICAL gap ratio | 2/476 ≈ 0.4% | TR-016 + TR-025 are CRITICAL (P0) |
| Phase D score multiplier | **3/10 MAX** | Two P0 CRITICAL gaps cap score at 3/10 per oli-trace protocol |

**Note:** P0 cap overrides arithmetic score. Fix TR-016 and TR-025 to uncap Phase D score.

---

## Recommended Actions by Priority

### P0 — Block: Fix before any Phase D gate passes

**TR-016 + TR-025 (Annotation State Machine Missing)**
These two findings combine into one root cause: the `imaging_annotation` table has no `status` column.

1. Add `status` to `imagingAnnotations` schema: `pgEnum('imaging_annotation_status', ['draft', 'confirmed', 'resolved'])`
2. Set default `'draft'`; add `ANNOTATION_TRANSITIONS` constant
3. Add `updateAnnotation` handler with transition guard (422 on reversal)
4. Add test: `confirmed → draft → 422`; `draft → confirmed → 200`
5. Update AC-IMG-002 description to clarify annotation vs finding SM-01 scope

**Skill:** `/handler` + `/test-api`
**Files:** `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts`, new `updateAnnotation.ts`

---

### P1 — Fix before next release

2. **TR-015** — Add BR-003 visit-status guards to `createPrescription`, `createConsentForm`, `createAttachment` in dental-clinical; add acceptance test covering 422 on completed-visit write.
3. **TR-035** — Add create-payment-plan form to `PaymentPlanView`; WF-015 must be reachable from invoice detail.
4. **TR-036** — Fix `handleSharePMD`: add visit eligibility check, loading indicator, error toast, download fallback.
5. **TR-037** — Replace raw JSON textarea in PMD import with file upload dropzone; add checksum verification.
6. **TR-021** — Resolve `/handlers/emr/` forward violation: either delete 6 files OR add MODULE_SPEC section with explicit phase gate marking them as `implementation_status: future_phase`.
7. **TR-017** — Add `markUncollectible` 501 stub handler + test asserting 501.
8. **TR-013** — Dashboard: add `dental-dashboard` MODULE_SPEC or map FR0.1–FR0.8 to dental-org/scheduling specs with WF assignments.
9. **TR-030** — Events: begin DE-001 emission from check-in handler; unblocks audit trail chain.

### P2 — Fix within current milestone

10. **TR-026** — Update DOMAIN_MODEL §6 SM-IMAGING-FINDING and MODULE_SPEC §2 to reflect 4-state finding machine (suspected/confirmed/monitoring/resolved); rename AC-IMG-002 accordingly.
11. **TR-027** — Document dental-patient sub-modules in MODULE_SPEC §10: add API entries for contacts, alerts, tasks. Gate insurance behind feature flag with Phase 2 annotation.
12. **TR-023 / TR-032 / TR-010** — Fix dental-perio MODULE_SPEC §4: replace WF-038 with WF-042.
13. **TR-033** — Resolve SM-01 naming collision: assign distinct SM IDs to annotation SM (SM-01) and finding SM (SM-03) or rename finding SM in DOMAIN_MODEL.
14. **TR-018** — Add 405 test for AC-PMD-002 in `dental-pmd.data-portability.test.ts` or `dental-pmd.test.ts`.
15. **TR-024** — Add AC-P01 through AC-P10 identifier tags to dental-perio coverage test assertions.

---

## Delta vs run-6

| Finding | Change | Detail |
|---------|--------|--------|
| TR-020 | **RESOLVED** | AC-AUD-002 405 test committed at a9895673 before run-7 |
| TR-016 | **ESCALATED** P2→P0 | Annotation schema confirmed to have no status column — not just a missing test, but missing schema + implementation |
| TR-025 | **NEW** P0 | Annotation SM entirely absent (schema + handler + test) |
| TR-026 | **NEW** P2 | SM-01 finding state machine has 4 states vs 3 in spec |
| TR-027 | **NEW** P2 | 29 unspecced dental-patient sub-module handlers (alerts/contacts/insurance/sync/tasks/treatment-plans) |
| TR-033 | **NEW** P2 | SM-01 naming collision (3 conflicting definitions) |
| TR-024 | **NEW** P2 | Dental-perio AC-P01–P10 have no ID tags in tests |
| EF-PMD-005 | **SPEC COMPLIANCE** | sourceDescription now required in importPMD — aligns with MODULE_SPEC §4 item 5. No trace gap introduced. |
| EF-PMD-004 | **SPEC GAP** | authorMemberId added to PMD snapshot; MODULE_SPEC §7 does not enumerate snapshot field set — spec is underspecified but not violated |

---

*Generated by oli-trace run-7-2026-05-29 | Auto: true | Phase: D | Modules: 11 dental + dashboard (missing)*
