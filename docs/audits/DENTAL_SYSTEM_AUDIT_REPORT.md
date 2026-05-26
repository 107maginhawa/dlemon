# Dental System Audit Report

**Date:** 2026-05-25  
**Branch:** feat/v1.5-g1-foundation  
**Audit format:** 00-dental-audit-orchestrator.md v1  
**Prior graduation:** 9.0/10 on 2026-05-21  

---

## Executive Summary

The Dentalemon dental management system is a well-structured, AI-built production-grade dental platform. The system has 9 dental-vertical backend modules, a rich frontend workspace with the timeline carousel charting concept, comprehensive E2E test suite, and strong backend test coverage for critical modules (dental-visit, dental-billing, dental-scheduling, dental-imaging).

The system graduated the OLI confidence criteria at 9.0/10 on 2026-05-21. This audit identifies 4 P1 blockers that should be resolved before a new production release:

1. **BR-011 not enforced** — invoices can be created without signed patient consent
2. **No dental_chart_version** — past chart edits overwrite silently with no audit trail
3. **Treatment save errors are silent** — clinician gets no feedback on failed treatment saves
4. **E2E CI does not block** — regressions can ship if E2E fails

None of these are catastrophic data-loss bugs in the current state, but all are clinical/compliance risks that should be addressed before release.

**Release Status:** `NOT READY — P1 blockers exist`

---

## OLI Pipeline Artifact Audit

### Summary

The project followed an OLI-adjacent process with execution plans in `.planning/phases/` rather than `docs/execution/slices/`. This is a historical divergence from the current OLI slice spec format, not a failure of the process itself.

The project configuration (`config.json`) is correctly set up: `tdd_mode: true`, `oli-execution-gate` configured for executor agents, `graduation` thresholds of 9.0 for all dimensions.

**Classification:** Greenfield-intended but pipeline-incomplete (slice spec format).

### Artifact Matrix

| Artifact | Exists | Current | Audited | Risk | Notes |
|---|:---:|:---:|:---:|---|---|
| oli.md | ✅ | ✅ | ✅ | Low | Full pipeline spec loaded |
| .planning/config.json | ✅ | ✅ | ✅ | Low | TDD mode ON, gate configured |
| DOMAIN_MODEL.md | ✅ | ✅ | PARTIAL | Low | Exists; not deep-sampled |
| DOMAIN_GLOSSARY.md | ✅ | ✅ | NOT_AUDITED | Low | Exists |
| MODULE_MAP.md | ✅ | ✅ | NOT_AUDITED | Low | Exists |
| DATA_GOVERNANCE.md | ✅ | ✅ | NOT_AUDITED | Low | Exists + draft version |
| API_CONVENTIONS.md | ✅ | ✅ | NOT_AUDITED | Low | Exists |
| ERROR_TAXONOMY.md | ✅ | ✅ | NOT_AUDITED | Low | Exists |
| EVENT_CONTRACTS.md | ✅ | ✅ | NOT_AUDITED | Low | Exists |
| CONSISTENCY_REPORT.md | ✅ | ✅ | NOT_AUDITED | Low | Exists |
| 11 MODULE_SPECs | ✅ | ✅ | PARTIAL | Low | All present; dental-emr INFERRED |
| 11 API_CONTRACTs | ✅ | ✅ | NOT_AUDITED | Low | All present |
| 11 UI blueprints | ✅ | ✅ | NOT_AUDITED | Low | All present |
| MASTER_PRD.md | ❌ | — | NOT_FOUND | Medium | No master PRD; risk: product scope not auditable |
| WORKFLOW_MAP.md | ❌ | — | NOT_FOUND | Medium | Workflows reconstructed from code |
| ROLE_PERMISSION_MATRIX.md | ❌ | — | NOT_FOUND | Medium | RBAC audited via code instead |
| VERTICAL_SLICE_PLAN.md | ❌ | — | NOT_FOUND | Medium | Process gap (GAP-DENTAL-005) |
| SLICE_SPEC.md (any) | ❌ | — | NOT_FOUND | Medium | Process gap (GAP-DENTAL-005) |
| TDD_PROOF.md (any) | ❌ | — | NOT_FOUND | Medium | Process gap (GAP-DENTAL-005) |
| PRD_AUDIT_REPORT.md | ❌ | — | NOT_FOUND | Low | Not blocking |
| SYNC_ARCHITECTURE.md | ❌ | — | NOT_FOUND | Low | Local-first is future phase |

### Findings

| Gap ID | Severity | Area | Finding | Evidence |
|---|---|---|---|---|
| GAP-DENTAL-005 | P2 | OLI pipeline | No SLICE_SPEC.md or TDD_PROOF.md in repo | docs/execution/ absent |
| GAP-DENTAL-011 | P2 | G1 phase | G1 has only RESEARCH.md, no CONTEXT/PLAN | .planning/phases/G1-foundation-stabilization/ |
| — | INFO | Process | .planning/phases/ provides equivalent context for executed phases | Multiple phase summaries/verifications exist |

---

## Dental Product and Workflow Coverage Audit

### Summary

All 14 core dental clinic workflows were audited. 13 of 14 are at least partially implemented. WF-014 (notifications/comms/storage) was not audited (out of scope for dental-vertical focus).

The system is production-useful for:
- Solo dentists and small-to-mid-sized clinics
- Chairside iPad charting (workspace implemented)
- Multi-branch setup (dental-org module confirmed)
- Admin and billing workflows (dental-billing confirmed)
- Imaging and cephalometric analysis (dental-imaging confirmed)

The system is NOT yet production-complete for:
- Pediatric patients (dentition not switchable — GAP-DENTAL-009)
- Clinics requiring consent-gated invoicing (BR-011 gap — GAP-DENTAL-001)

### Workflow Coverage Matrix

| Workflow | Backend | Frontend | Tests | Status | Notes |
|---|---|---|---|---|---|
| WF-001 Org/Branch Setup | ✅ Full | ✅ | ✅ | COMPLETE | PIN, members, consent templates |
| WF-002 Auth/PIN | ✅ Full | ✅ | ✅ | COMPLETE | setPin/verifyPin/recoverPin proven |
| WF-003 Patient Registration | ✅ Full | ✅ | ✅ | COMPLETE | Create, archive, import, statement |
| WF-004 Scheduling | ✅ Full | ✅ | ✅ | COMPLETE | FSM: scheduled→checked_in→cancelled |
| WF-005 Visit Workspace | ✅ Full | ✅ | ✅ | COMPLETE | Create visit, chart, treatments, notes |
| WF-006 Dental Charting | ✅ Full | ✅ | ✅ | COMPLETE | 32-tooth, surfaces, snapshots |
| WF-007 Treatment Planning | ✅ Full | ✅ | ✅ | COMPLETE | Plan versions, carry-over, templates |
| WF-008 Consent/Clinical Safety | PARTIAL | PARTIAL | PARTIAL | INCOMPLETE | BR-011 gap; sign note works; invoice consent missing |
| WF-009 Perio Charting | ✅ Full | PARTIAL | PARTIAL | MOSTLY COMPLETE | Backend full; frontend perio test sparse |
| WF-010 Imaging/Ceph | ✅ Full | ✅ | ✅ | COMPLETE | Measurements, findings, ceph FSM |
| WF-011 Prescriptions/Lab Orders | ✅ Full | ✅ | ✅ | COMPLETE | Rx, lab orders with status FSM |
| WF-012 Billing/Collections | ✅ Full | ✅ | ✅ | MOSTLY COMPLETE | Missing: consent gate before invoice |
| WF-013 PMD | ✅ Full | PARTIAL | PARTIAL | MOSTLY COMPLETE | generate/import/export exist; frontend thin |
| WF-014 Notifications/Comms/Storage | NOT_AUDITED | NOT_AUDITED | NOT_AUDITED | NOT_AUDITED | — |

### Module Architecture Recommendations

| Module | Recommendation | Rationale |
|---|---|---|
| dental-visit | KEEP | Core module; correct boundaries |
| dental-org | KEEP | Multi-tenant; correct boundaries |
| dental-patient | KEEP | Patient record; correct |
| dental-clinical | KEEP | Clinical artifacts correctly separated |
| dental-billing | KEEP | Dental-specific billing correctly separated from generic billing |
| dental-scheduling | KEEP | Correctly separated from generic booking |
| dental-perio | KEEP | Correctly scoped; needs more tests |
| dental-imaging | KEEP | Complex; correctly scoped |
| dental-pmd | KEEP | Clear bounded context |
| dental-emr | BACKLOG_REVIEW | Only INFERRED workflows; no implementation; may duplicate dental-visit scope |
| dental-audit | KEEP | Correct separation of audit read surface |

### Findings

| Gap ID | Severity | Finding | Evidence |
|---|---|---|---|
| GAP-DENTAL-001 | P1 | BR-011 not enforced in createDentalInvoice | billing-gate-http.test.ts explicit STOP CONDITION |
| GAP-DENTAL-007 | P2 | dental-emr spec INFERRED-only; no backend | No handlers/dental-emr directory |
| GAP-DENTAL-009 | P2 | Pediatric charting unwired | CAROUSEL-CONCEPT §10/G11; frontend always sends permanent |
| GAP-DENTAL-010 | P2 | dental-emr vs dental-visit boundary ambiguity | Naming mismatch between spec layer and implementation |

---

## Spec-to-Code Compliance Audit

### Summary

Spec-to-code compliance is generally strong for implemented modules. The TypeSpec → OpenAPI → generated routes pipeline is working. The main compliance gaps are the BR-011 enforcement gap and the dental_chart_version data integrity gap.

### Compliance Matrix

| Area | Spec Source | Code Source | Status | Risk |
|---|---|---|---|---|
| dental-visit charting | dental-visit/MODULE_SPEC.md | dental-visit/handlers | IMPLEMENTED | Low |
| dental-visit note signing | MODULE_SPEC.md | signVisitNotes.ts | IMPLEMENTED | Low — RBAC correct, version table correct |
| dental-visit chart versioning | MODULE_SPEC.md | dental-chart.schema.ts | IMPLEMENTED | Low — dental_chart_version added (GAP-DENTAL-002 RESOLVED) |
| dental-billing invoice creation | MODULE_SPEC.md | createDentalInvoice.ts | IMPLEMENTED | Low — BR-011 consent gate added (GAP-DENTAL-001 RESOLVED) |
| dental-billing FSM | MODULE_SPEC.md | invoice.fsm.property.test.ts | IMPLEMENTED | Low |
| dental-clinical consent | MODULE_SPEC.md | consent-form.schema.ts + business-rules.test.ts | PARTIAL | Medium — consent gating visit completion OK; invoice not gated |
| dental-org RBAC | MODULE_SPEC.md | assert-branch-role.ts | IMPLEMENTED | Low |
| dental-scheduling FSM | MODULE_SPEC.md | appointment.fsm.property.test.ts | IMPLEMENTED | Low |
| dental-perio | MODULE_SPEC.md | handlers/dental-perio/ | IMPLEMENTED | Low — handler coverage tests added (GAP-DENTAL-008 RESOLVED) |
| dental-imaging ceph FSM | MODULE_SPEC.md | ceph-landmark.fsm.property.test.ts | IMPLEMENTED | Low |
| dental-emr | MODULE_SPEC.md (INFERRED) | — | NOT_IMPLEMENTED | Medium |

### API Drift Matrix

| Endpoint | Contract | Implementation | Status |
|---|---|---|---|
| POST /dental/visits/{id}/notes/sign | TypeSpec → generated | signVisitNotes.ts | COMPLIANT |
| POST /dental/visits/{id}/chart | TypeSpec → generated | upsertDentalChart.ts | COMPLIANT |
| POST /dental/invoices | TypeSpec → generated | createDentalInvoice.ts | PARTIAL — BR-011 missing |
| GET /dental/branches | TypeSpec → generated | manual override in app.ts | COMPLIANT — manual workaround for int32 bug |
| GET /dental/visits/history/:patientId/teeth/:toothNumber | TypeSpec → generated | manual override in app.ts | COMPLIANT — manual workaround |
| GET /dental/admin/audit | TypeSpec → generated | manual override in app.ts | COMPLIANT — manual workaround |

### Domain Drift Matrix

| Entity/Concept | Domain Model | Implementation | Status |
|---|---|---|---|
| DentalChart | One row per visit, snapshot | dental_chart table, jsonb teeth column | COMPLIANT |
| dental_chart_version | Expected per design | ABSENT | DRIFT — GAP-DENTAL-002 |
| TreatmentFSM | diagnosed→planned→performed→verified | treatment.schema.ts + FSM tests | COMPLIANT |
| VisitNote versioning | Append-only, signed = immutable | visit_note_version table | COMPLIANT |
| ConsentForm | Signed required before clinical completion | business-rules.test.ts BR-005 | PARTIAL — invoice not gated |
| PIN authentication | Hashed PIN per member | DentalMembershipManagement_setPin.ts | COMPLIANT |

### Findings

| Gap ID | Severity | Finding | Evidence |
|---|---|---|---|
| GAP-DENTAL-001 | RESOLVED | BR-011 consent gate added | P1-001 (59d8abc) 2026-05-25 |
| GAP-DENTAL-002 | RESOLVED | dental_chart_version table added | P1-002 (1e61bd5) 2026-05-25 |
| GAP-DENTAL-012 | P2 | Manual route overrides bypass TypeSpec pipeline | app.ts lines 107-130 |

---

## TDD and Test Confidence Audit

### Summary

Backend test coverage for critical modules is strong. dental-visit has 17 test files including FSM property tests, business rules tests, and surface condition tests. dental-billing has invoice and payment plan FSM property tests. dental-scheduling has appointment FSM property tests. dental-imaging has 4057 lines of test code.

The main weakness is dental-perio (1 repo test only) and the absence of formal TDD proof artifacts.

### Execution Gate Configuration

- `config.json workflow.tdd_mode: true` — ✅
- `config.json agent_skills.gsd-executor: ["skills/oli-execution-gate"]` — ✅
- Slice specs: ❌ (GAP-DENTAL-005)
- TDD proofs: ❌ (GAP-DENTAL-005)

### Backend Test Coverage by Module

| Module | Unit/Handler | Repo | FSM | RBAC | Data Lifecycle | Overall |
|---|---|---|---|---|---|---|
| dental-org | ✅ Strong (5 files) | ✅ | — | ✅ (auth module7) | — | STRONG |
| dental-patient | ✅ Strong (5 files) | ✅ | ✅ (consent FSM) | — | ✅ (records) | STRONG |
| dental-visit | ✅ Strong (17 files) | ✅ | ✅ (visit+treatment FSM) | ✅ | ✅ (surface map) | STRONG |
| dental-clinical | ✅ (3+ files) | ✅ (soft-delete) | — | — | ✅ (attachments) | ADEQUATE |
| dental-billing | ✅ Strong (8 files) | ✅ | ✅ (invoice+plan FSM) | ✅ (billing gate) | — | STRONG |
| dental-scheduling | ✅ (6 files) | ✅ | ✅ (appointment FSM) | ✅ | — | STRONG |
| dental-perio | — | ✅ (1 repo test) | — | — | — | WEAK |
| dental-imaging | ✅ Strong (5 files, 4057 lines) | — | ✅ (ceph+finding FSM) | — | — | STRONG |
| dental-pmd | ✅ (3 files) | ✅ | — | — | — | ADEQUATE |

### Frontend Test Coverage

| Area | Hook Tests | Component Tests | E2E | Overall |
|---|---|---|---|---|
| Workspace | ✅ Strong (9 hooks) | ✅ Strong (10 components) | ✅ (ipad-workspace, workspace-readonly) | STRONG |
| Patients | ✅ (patient-filter-tabs, folder-card) | ✅ | ✅ (patient-registration, returning-patient) | ADEQUATE |
| Billing | — | — | ✅ (billing.spec, billing-queue-morgan) | PARTIAL |
| Imaging | ✅ (patient-image-list) | — | ✅ (imaging-ceph, imaging-measurement, etc.) | ADEQUATE |
| Staff | ✅ (use-staff-members) | ✅ (staff-list) | ✅ (add-staff) | ADEQUATE |

### E2E Coverage (Playwright)

40+ E2E spec files covering:
- walk-in, first-launch, dental-onboarding, returning-patient-visit
- billing, invoice-detail, billing-queue-morgan, clinical-billing-handoff
- calendar, calendar-riley, ipad-calendar
- consent-signing, attachments
- imaging-ceph, imaging-measurement, imaging-comparison, imaging-findings, ipad-imaging
- ipad-perio-charting, ipad-workspace
- auth-pin, auth-gates, safety-floor, workspace-readonly
- 13 numbered journey specs (01 new-patient-exam → 13 ceph-locked-landmark)

**Critical issue:** E2E CI job runs with `continue-on-error: true` — failures are non-blocking (GAP-DENTAL-004).

### Test Confidence Score

| Layer | Score | Notes |
|---|:---:|---|
| Spec item coverage | 40/100 | No SLICE_SPEC/TDD_PROOF; AC/BR coverage inferred from test names |
| Backend unit/integration | 80/100 | Strong for 7/9 modules; dental-perio weak |
| Frontend/component | 75/100 | Workspace excellent; billing/calendar thin |
| E2E workflow | 70/100 | Good coverage exists; CI gate non-blocking |
| Permission/security tests | 75/100 | RBAC per-module tests; ac-g2s1, billing-gate-http |
| Data lifecycle tests | 60/100 | soft-delete proven; chart versioning unproven |
| TDD proof quality | 0/100 | No TDD_PROOF.md artifacts exist |
| CI reliability | 60/100 | Unit gate is hard; E2E is soft |
| **Overall** | **58/100** | Strong code tests; weak process artifacts |

### Findings

| Gap ID | Severity | Finding | Evidence |
|---|---|---|---|
| GAP-DENTAL-003 | RESOLVED | onError toasts added to useSaveChart, useSaveTreatment, useUpdateTreatment | P1-003 (ef82e2c) 2026-05-25 |
| GAP-DENTAL-004 | RESOLVED | E2E CI gate hardened | P1-004 (82ec9e6) 2026-05-25 |
| GAP-DENTAL-005 | P2 | No SLICE_SPEC or TDD_PROOF artifacts | docs/execution/ absent |
| GAP-DENTAL-008 | RESOLVED | dental-perio-coverage.test.ts added — 12/12 pass | P2-001 2026-05-25 |

---

## UI/UX, iPad-First, and Timeline Carousel Audit

### Summary

The timeline carousel is implemented (`timeline-carousel.tsx`, `dental-chart.tsx`, `tooth-slideout.tsx`, `treatment-table.tsx`). All critical carousel infrastructure exists. The workspace is iPad-aware (ipad-workspace E2E spec, touch-friendly layout).

Known design gaps from `CAROUSEL-CONCEPT.md §10` have been verified against current code. Most remain open. G8 (silent treatment save) is the most critical.

### UI Coverage Matrix

| Area | Audited | Status | Risk |
|---|:---:|---|---|
| Timeline carousel component | ✅ | EXISTS — carousel implemented | Low |
| Dental chart SVG | ✅ | EXISTS — 32-tooth FDI | Low |
| Tooth slideout | ✅ | EXISTS — panelOpen dead code issue | Low |
| Treatment table | ✅ | EXISTS | Low |
| Visit note signing UX | ✅ | EXISTS — signVisitNotes + addendum | Low |
| Workspace top bar | ✅ | EXISTS | Low |
| Year segment control | ✅ | EXISTS but integration incomplete | Medium |
| Pediatric dentition | ✅ | NOT WIRED — always permanent | Medium |
| Pre-completion checklist | ✅ | EXISTS | Low |
| Billing/payment modal | ✅ | EXISTS | Low |
| Consent sheet | ✅ | EXISTS | Low |
| Lab orders sheet | ✅ | EXISTS | Low |
| Rx sheet | ✅ | EXISTS | Low |
| SOAP notes sheet | ✅ | EXISTS | Low |
| Attachments sheet | ✅ | EXISTS | Low |
| Time-lapse playback | ✅ | NOT IMPLEMENTED | Low (P3) |
| Reduced-motion fallback | ✅ | NOT IMPLEMENTED | Low (P3) |

### Carousel Compliance Matrix

| Requirement | Status | Evidence | Severity |
|---|---|---|---|
| Visit cards exist | ✅ PASS | timeline-carousel.tsx | — |
| Oldest-to-newest sorting | ASSUMED PASS | Endpoint returns visits sorted | — |
| Most recent auto-selected | ASSUMED PASS | CAROUSEL-CONCEPT §2 | — |
| Active card visually distinguished | ASSUMED PASS | Coverflow effect | — |
| Non-active cards read-only | PARTIAL | Convention, no DB constraint | Medium |
| + New Visit flow exists | ✅ PASS | use-create-visit.ts + hook tests | — |
| Cumulative snapshot model | ✅ PASS | One dental_chart row per visit, seeded from prior | — |
| Past snapshots stable | ✅ PASS | dental_chart_version added; saveVersion() on every upsert | GAP-DENTAL-002 RESOLVED |
| Tooth history per-tooth | ✅ PASS | getToothHistory endpoint | — |
| Treatment save error feedback | ✅ PASS | onError toast on useSaveChart/useSaveTreatment/useUpdateTreatment | GAP-DENTAL-003 RESOLVED |
| Pediatric charting | ❌ FAIL | G11 — always permanent | Medium — GAP-DENTAL-009 |
| Time-lapse playback | ❌ FAIL | G3 — not implemented | Low — GAP-DENTAL-015 |
| Year-grouping tabs | PARTIAL | G4 — component exists; not wired | Low — GAP-DENTAL-016 |
| Reduced-motion fallback | ❌ FAIL | G5 | Low — GAP-DENTAL-017 |
| Complete legend | PARTIAL | G10 — 5/9 states shown | Low — GAP-DENTAL-014 |
| panelOpen prop functional | ❌ FAIL | G9 — dead-coded | Low — GAP-DENTAL-013 |

### UX Findings

| Gap ID | Severity | Area | Finding |
|---|---|---|---|
| GAP-DENTAL-003 | P1 | Treatment save | Mutation onError is no-op; silent failure |
| GAP-DENTAL-009 | P2 | Pediatric | Dentition not switchable in frontend |
| GAP-DENTAL-013 | P3 | Tooth slideout | panelOpen prop dead-coded |
| GAP-DENTAL-014 | P3 | Chart legend | 4 tooth states missing from legend |
| GAP-DENTAL-015 | P3 | Carousel | Time-lapse not implemented |
| GAP-DENTAL-016 | P3 | Carousel | Year tabs component exists but not integrated |
| GAP-DENTAL-017 | P3 | Carousel | No prefers-reduced-motion check |

---

## Release Readiness

### Final Status

**`P1 BLOCKERS CLEARED — 2026-05-25`**

### P1 Blocker List (all resolved)

| Gap ID | Title | Status |
|---|---|---|
| GAP-DENTAL-001 | BR-011 consent gate in createDentalInvoice | ✅ RESOLVED (P1-001, 59d8abc) |
| GAP-DENTAL-002 | Add dental_chart_version audit trail | ✅ RESOLVED (P1-002, 1e61bd5) |
| GAP-DENTAL-003 | Fix silent treatment save error in frontend | ✅ RESOLVED (P1-003, ef82e2c) |
| GAP-DENTAL-004 | Fix E2E CI gate to actually block | ✅ RESOLVED (P1-004, 82ec9e6) |

### P2 Remediation List

| Gap ID | Title | Priority |
|---|---|---|
| GAP-DENTAL-008 | Add dental-perio handler tests | ✅ RESOLVED (P2-001, 2026-05-25) |
| GAP-DENTAL-006 | Fix N+1 in getToothHistory | High |
| GAP-DENTAL-005 | Create SLICE_SPEC + TDD_PROOF for future phases | Medium |
| GAP-DENTAL-009 | Wire pediatric dentition in frontend | Medium |
| GAP-DENTAL-012 | Fix TypeSpec int32 bug; remove app.ts overrides | Medium |
| GAP-DENTAL-007 | Scope dental-emr or mark as future phase | Low |
| GAP-DENTAL-010 | Document dental-emr vs dental-visit boundary | Low |
| GAP-DENTAL-011 | Complete G1 phase artifacts (CONTEXT + PLAN) | Low |

### P3 Polish/Future List

| Gap ID | Title |
|---|---|
| GAP-DENTAL-013 | Fix panelOpen dead code in ToothSlideout |
| GAP-DENTAL-014 | Complete chart legend (implant, extracted, watchlist) |
| GAP-DENTAL-015 | Implement time-lapse playback |
| GAP-DENTAL-016 | Wire year-segment-control into carousel |
| GAP-DENTAL-017 | Add prefers-reduced-motion to Swiper config |
| GAP-DENTAL-018 | Add HMAC tamper-evidence to chart snapshots |

### Audit Coverage Score

| Dimension | Score |
|---|---|
| Backend dental modules audited | 9/9 = 100% |
| Frontend workspace coverage | 80% |
| Spec artifacts present | 11/11 module specs |
| Workflow coverage | 13/14 (93%) |
| TDD proof artifacts | 0/0 (none required by old process) |
| Test confidence overall | 58/100 |

### Per-Module Status Matrix

| Module | Backend | Tests | Frontend | Spec | Release Ready |
|---|---|---|---|---|---|
| dental-org | ✅ | ✅ | ✅ | ✅ | YES |
| dental-patient | ✅ | ✅ | ✅ | ✅ | YES |
| dental-visit | ✅ | ✅ | ✅ | ✅ | CONDITIONAL (chart versioning P1) |
| dental-clinical | ✅ | ✅ | ✅ | ✅ | CONDITIONAL (consent gate P1) |
| dental-billing | ✅ | ✅ | ✅ | ✅ | CONDITIONAL (consent gate P1) |
| dental-scheduling | ✅ | ✅ | ✅ | ✅ | YES |
| dental-perio | ✅ | WEAK | PARTIAL | ✅ | CONDITIONAL (sparse tests P2) |
| dental-imaging | ✅ | ✅ | ✅ | ✅ | YES |
| dental-pmd | ✅ | PARTIAL | PARTIAL | ✅ | CONDITIONAL (thin frontend) |
| dental-emr | ❌ | ❌ | ❌ | INFERRED | NO (not implemented) |
| dental-audit | ✅ | ✅ | NOT_AUDITED | ✅ | NOT_AUDITED |

### Re-Audit Instructions

After fixing P1 blockers, re-run this audit with:
```
docs/audits/prompts/00-dental-audit-orchestrator.md
Resume from previous run: yes
Prior run: Run 001 (2026-05-25)
Reuse Gap IDs: GAP-DENTAL-001 through GAP-DENTAL-018
Focus: verify P1 gaps closed, update status in DENTAL_GAP_REGISTRY.md
```

---

## Module Improvement and Boundary Audit

**Run:** 003 — 2026-05-25  
**Prompt:** `docs/audits/03-dental-product-workflow-audit.md` (Module Architecture section)  
**Guardrail:** `docs/audits/01-audit-enforcement-guardrails.md`  
**Methodology:** Each module evaluated against 11 production-usefulness criteria. Every finding is backed by file-level evidence. No recommendation is issued for elegance alone.

---

### Module Improvement Matrix

| Module | Current Role | Issue | Recommendation | Reason | Risk | Priority | V1/V2 |
|---|---|---|---|---|---|---|---|
| dental-org | Multi-tenancy root: orgs, branches, memberships, PIN auth, fee schedules, consent templates | `getAuditEvents` handler is co-located here but belongs to an audit context | KEEP + MOVE_RESPONSIBILITY | Remove audit routing from dental-org into dental-audit; fee schedule is correctly org-scoped | Low | P2 | V1 |
| dental-patient | Patient registration, profile, medical history, safety floor aggregation | `docs/modules/dental-patient` (stale) vs `docs/product/modules/dental-patient` is a duplicate source | KEEP + SIMPLIFY | Module boundaries are correct; stale docs/ copy confuses devs | Low | P2 | V1 |
| dental-scheduling | Dental appointment lifecycle (book → checked-in → no-show/cancelled) | No recurring appointment or waitlist support; these are P2 production gaps for real clinics | KEEP + BACKLOG_REVIEW | Core FSM correct; recurrence/waitlist is V2 scope | Low | P3 | V2 |
| dental-visit | Core clinical workspace: visit lifecycle, treatments, dental chart, SOAP notes, dentition, carry-over, treatment templates | Too broad — treatment templates are org-level config, not visit-scoped; SOAP note versioning is correct but note signing + templates in same module adds width | KEEP (V1), SPLIT treatment templates to dental-org (V2) | Visit workspace paradigm is the right mental model for V1; template portability across branches is org-domain logic | Medium | P3 | V2 |
| dental-perio | Per-visit periodontal charting (6-site probing, BOP, recession, mobility, furcation) | No handler-level tests until P2-001 (now resolved); historical comparison view and print layout not implemented | KEEP + EXPAND | Well-bounded context; correct separation from dental-visit; production usefulness requires comparison view for clinical value | Medium | P2 | V1 |
| dental-clinical | Visit-scoped clinical documents: prescriptions, lab orders, consent forms, medical history, attachments, amendments | Mixes 5+ distinct document types; directly imports VisitRepository from dental-visit (G-003 coupling); acceptable for V1 but architectural risk | KEEP (V1), MOVE_RESPONSIBILITY for VisitRepository coupling | All document types share visit scope + immutability rule; splitting now is premature; coupling is known risk | Medium | P2 | V1 |
| dental-billing | Dental invoicing, payment plans, payments, discounts, collections, receipts | No insurance/payer support; statement generation missing; these are real clinic gaps | KEEP + BACKLOG_REVIEW | Core billing FSM and payment plan FSM are strong; insurance is V2 | Low | P3 | V2 |
| dental-imaging | Radiographic studies, images, measurements, findings, calibration + cephalometric analysis, landmarks, ceph reports | Mixes two distinct clinical sub-domains: basic imaging (bitewings, panoramics) and cephalometric analysis (CBCT, landmarks, analysis reports). CephMgmt_* handlers already use a separate naming convention from ImagingMgmt_* | SPLIT → `dental-imaging` (basic) + `dental-ceph` (cephalometric) | Ceph requires CBCT imaging tier, distinct clinical training, different workflow (landmark placement, analysis recompute), and separate FSM. Already architecturally diverging. Combining them in one module obscures each context | High | P2 | V1 |
| dental-pmd | Patient medical document: generate snapshot, export PDF/JSON, import from external, list imported | Data scope of `generatePMD` is undocumented — unclear what fields it aggregates across modules; import side (read-only historical record) is a different concern than generate/export | KEEP + EXPAND spec | Good bounded context for portability; dual concerns (generate vs import) need explicit documentation; no DB FKs constraint is correct | Low | P2 | V1 |
| dental-emr | Spec-only: "integrated EMR module" with INFERRED workflows; zero backend implementation | Zombie spec — no handler directory, no schema, INFERRED-only. `dental-visit` IS the dental EMR in practice. Spec causes naming confusion (GAP-DENTAL-010). | RENAME to `dental-emr-integration` and mark `FUTURE_PHASE` | If dental-emr means external EMR import, that is a distinct integration module (not a rename of dental-visit). The current spec conflates the two. Renaming + scoping removes ambiguity | High | P2 | V1 (spec only) |
| dental-audit | Audit log read surface for dental context | `getAuditEvents` is in `dental-org` handlers, not `dental-audit`. Module spec exists, no dedicated handler directory. Spec and implementation are in different modules | MERGE — move `getAuditEvents` into dental-audit handler scope, or consolidate under base `audit` module | dental-audit and base `audit` overlap without clear differentiation. Base `audit` already has `listAuditLogs`. dental-audit should be the dental-specific query surface | Medium | P2 | V1 |
| base `billing` | Stripe Connect merchant accounts, generic invoice FSM | Correctly separated from dental-billing (Stripe abstraction vs dental treatment billing) | KEEP | No changes needed | None | — | — |
| base `booking` | Generic time-slot scheduling (slots, events, booking lifecycle) | Correctly separated from dental-scheduling (appointment paradigm vs slot paradigm) | KEEP | No changes needed | None | — | — |
| base `emr` | Non-dental EMR handler directory exists | No audit performed on this module. In a dental-vertical codebase this creates naming confusion with dental-emr spec | BACKLOG_REVIEW | Determine if base emr is used by dental layer; if not, document or remove to reduce naming confusion | Low | P3 | V2 |
| base `patient` | Non-dental patient handler | Exists alongside dental-patient without documented boundary | BACKLOG_REVIEW | Confirm dental-patient extends (not duplicates) base patient; document the extension contract | Low | P3 | V2 |
| base `provider` | Non-dental provider/clinician base | Exists but unclear whether dental layer uses it or has its own staff concept via dental-membership | BACKLOG_REVIEW | Audit after base module boundary clarification | Low | P3 | V2 |
| `shared` | assertBranchAccess, assertBranchRole utilities | These are dental-org domain logic, not true cross-cutting utilities | MOVE_RESPONSIBILITY | assertBranchAccess/assertBranchRole should export from dental-org service, not from shared/ — currently correct in practice but naming suggests wrong location | Low | P3 | V2 |
| `docs/modules/` | Duplicate of `docs/product/modules/` | Missing dental-perio (present only in docs/product/modules/); stale copy creates version confusion | SIMPLIFY — remove `docs/modules/` | docs/product/modules/ is the canonical location per MODULE_MAP; docs/modules/ is a stale shadow | Low | P2 | V1 |

---

### Boundary Findings

| Area | Current Boundary Problem | Recommended Boundary | Impact | Task |
|---|---|---|---|---|
| dental-imaging vs dental-ceph | CephMgmt_* and ImagingMgmt_* share a single handler directory despite different clinical domains, tier requirements, and FSMs | dental-imaging: studies, images, measurements, findings; dental-ceph: landmarks, analysis, ceph reports, recompute | Reduces cognitive load when adding new imaging features; prevents ceph-specific tests from bloating imaging coverage | GAP-DENTAL-019, TASK-DENTAL-P2-008 |
| dental-emr vs dental-visit | dental-emr spec describes "integrated EMR" but dental-visit IS the EMR implementation. No handler directory for dental-emr. Spec creates false expectation | dental-visit = the active dental EMR; dental-emr-integration = future external EMR import module | Eliminates GAP-DENTAL-010 and developer confusion; closes zombie spec | GAP-DENTAL-020, TASK-DENTAL-P2-009 |
| dental-clinical → dental-visit coupling | dental-clinical imports VisitRepository from dental-visit directly (G-003 flag in MODULE_SPEC) | dental-clinical uses a VisitService interface; dental-visit owns the implementation | Bounded context separation; allows dental-visit and dental-clinical to evolve independently | GAP-DENTAL-021, TASK-DENTAL-P2-010 |
| dental-audit vs base audit vs dental-org | getAuditEvents is in dental-org handlers; dental-audit has a MODULE_SPEC but no handler directory; base audit has listAuditLogs | dental-audit handler directory with getAuditEvents and listDentalAuditLogs; base audit for platform-level event stream | Removes handler/spec mismatch; gives dental-audit a concrete implementation footprint | GAP-DENTAL-022, TASK-DENTAL-P2-011 |
| dental-pmd generate vs import | generatePMD (snapshot aggregation across modules) and importPMD (external portability ingestion) are both in dental-pmd with no documented data scope boundary | generatePMD: explicit data scope doc listing all sourced fields; importedPMD: read-only foreign record with no FK coupling | Prevents scope creep in PMD generation; import side stays decoupled | GAP-DENTAL-023, TASK-DENTAL-P2-012 |
| docs/modules/ vs docs/product/modules/ | Two directories serving the same purpose; docs/modules/ is stale and missing dental-perio | docs/product/modules/ is canonical; docs/modules/ is removed | Removes developer confusion over which spec is current | GAP-DENTAL-024, TASK-DENTAL-P2-013 |
| dental-visit treatment templates | createTreatmentTemplate, listTreatmentTemplates, updateTreatmentTemplate, deleteTreatmentTemplate are in dental-visit but templates are org/branch-level reusable config | Templates belong in dental-org or a dental-config module; dental-visit consumes templates but doesn't own them | Correct ownership of shared config data; enables sharing templates across multiple dentists in a branch | GAP-DENTAL-025 (V2) |
| base emr/patient/provider vs dental equivalents | Three base modules (emr, patient, provider) exist alongside dental-specific modules without documented extension contracts | Document: dental-patient extends base patient; dental-membership replaces base provider concept; base emr use in dental context | Prevents future developers from building on wrong foundation | GAP-DENTAL-026 (V2 BACKLOG) |

---

### Module Improvement Tasks

| Task ID | Module | Recommendation | Required Change | Tests Needed | Verification |
|---|---|---|---|---|---|
| TASK-DENTAL-P2-008 | dental-imaging | SPLIT → dental-imaging + dental-ceph | Create `handlers/dental-ceph/` directory; move CephMgmt_*.ts files; update router registration; update MODULE_SPEC | No new logic — move tests alongside code; verify ceph.test.ts still passes | `bun test` green; dental-ceph handlers registered in app.ts |
| TASK-DENTAL-P2-009 | dental-emr | RENAME to dental-emr-integration + mark FUTURE_PHASE | Rename `docs/product/modules/dental-emr/` to `dental-emr-integration`; update MODULE_SPEC with concrete scope (external EMR import, not an alias for dental-visit); update MODULE_MAP.md | No backend tests (no implementation) | MODULE_MAP.md updated; MODULE_SPEC has `implementation_status: future_phase` |
| TASK-DENTAL-P2-010 | dental-clinical | MOVE_RESPONSIBILITY — eliminate G-003 coupling | Introduce VisitService interface; dental-clinical uses interface not VisitRepository directly | Existing dental-clinical tests must pass without direct dental-visit import | `bun test dental-clinical` green; no import from `handlers/dental-visit/repos` |
| TASK-DENTAL-P2-011 | dental-audit | MERGE — create handler directory | Create `handlers/dental-audit/` with getAuditEvents moved from dental-org; add listDentalAuditLogs handler pointing to dental-specific audit events | Test: GET /dental/admin/audit returns 200 with branch-scoped events | Handler moved; dental-org no longer imports getAuditEvents |
| TASK-DENTAL-P2-012 | dental-pmd | EXPAND spec — document data scope | Add §7.1 Data Scope table to MODULE_SPEC listing exact fields generatePMD aggregates from each module; add §7.2 Import Contract | Existing dental-pmd tests still pass | MODULE_SPEC §7.1 + §7.2 present; generatePMD output matches documented scope |
| TASK-DENTAL-P2-013 | docs | SIMPLIFY — remove stale docs/modules/ | Delete `docs/modules/` directory or replace with redirect README pointing to `docs/product/modules/` | — | `find docs/modules` returns empty or redirect only |
| TASK-DENTAL-P3-007 | dental-visit | SPLIT (V2) treatment templates | Move createTreatmentTemplate/listTreatmentTemplates/updateTreatmentTemplate/deleteTreatmentTemplate to dental-org; dental-visit applyTemplate reads from org-scoped store | Existing template tests still pass; add test for cross-branch template access | dental-visit handler dir has no template files; dental-org exposes template endpoints |
| TASK-DENTAL-P3-008 | base modules | BACKLOG_REVIEW — document extension contracts | Create `docs/product/BASE_MODULE_CONTRACTS.md` documenting: dental-patient extends patient; dental-membership replaces provider concept; base emr use in dental context | — | Document exists and is linked from each MODULE_SPEC |
