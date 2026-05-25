# Audit Coverage Manifest

## Audit Run Metadata

- Date: 2026-05-25
- Auditor: Claude Sonnet 4.6 (automated)
- Repo/branch: feat/v1.5-g1-foundation
- Commit hash: ff8dce4 (head at audit time)
- Audit scope: Full system — OLI pipeline, product workflows, spec-to-code compliance, TDD confidence, UI/UX carousel
- Resume from previous run: no (first run under new audit prompt format)

---

## Source Artifacts Inventory

| Artifact | Path | Exists | Audited | Notes |
|---|---|:---:|:---:|---|
| MODULES.md | docs/context/MODULES.md | ✅ | ✅ | 9 dental + 9 base + 3 healthcare-core + 1 infra |
| oli.md | docs/context/oli.md | ✅ | ✅ | Full pipeline orchestrator spec |
| oli-execution-gate.md | docs/context/oli-execution-gate.md | ✅ | ✅ | Loaded via skill |
| CAROUSEL-CONCEPT.md | docs/context/CAROUSEL-CONCEPT.md | ✅ | ✅ | 12 sections, 12 known gaps documented |
| ARCHITECTURE.md | docs/architecture/ARCHITECTURE.md | ✅ | PARTIAL | Checked via .planning/codebase/ARCHITECTURE.md |
| MASTER_PRD.md | docs/product/MASTER_PRD.md | ❌ | NOT_FOUND | No master PRD file at this path |
| PRD_AUDIT_REPORT.md | docs/product/PRD_AUDIT_REPORT.md | ❌ | NOT_FOUND | — |
| DOMAIN_MODEL.md | docs/product/DOMAIN_MODEL.md | ✅ | NOT_AUDITED | Exists; deep content not sampled |
| DOMAIN_GLOSSARY.md | docs/product/DOMAIN_GLOSSARY.md | ✅ | NOT_AUDITED | Exists |
| ROLE_PERMISSION_MATRIX.md | docs/product/ROLE_PERMISSION_MATRIX.md | ❌ | NOT_FOUND | Not found at expected path |
| MODULE_MAP.md | docs/product/MODULE_MAP.md | ✅ | NOT_AUDITED | Exists |
| WORKFLOW_MAP.md | docs/product/WORKFLOW_MAP.md | ❌ | NOT_FOUND | Not found at expected path |
| DATA_GOVERNANCE.md | docs/product/DATA_GOVERNANCE.md | ✅ | NOT_AUDITED | Also DATA_GOVERNANCE_DRAFT.md exists |
| API_CONVENTIONS.md | docs/product/API_CONVENTIONS.md | ✅ | NOT_AUDITED | Exists |
| ERROR_TAXONOMY.md | docs/product/ERROR_TAXONOMY.md | ✅ | NOT_AUDITED | Exists |
| EVENT_CONTRACTS.md | docs/product/EVENT_CONTRACTS.md | ✅ | NOT_AUDITED | Exists |
| CONSISTENCY_REPORT.md | docs/product/CONSISTENCY_REPORT.md | ✅ | NOT_AUDITED | Exists |
| AUDIT_CONTRACTS.md | docs/product/AUDIT_CONTRACTS.md | ✅ | NOT_AUDITED | Exists |
| VERTICAL_SLICE_PLAN.md | docs/execution/VERTICAL_SLICE_PLAN.md | ❌ | NOT_FOUND | docs/execution/ directory absent |
| SLICE_SPEC.md (any) | docs/execution/slices/*/SLICE_SPEC.md | ❌ | NOT_FOUND | No slice specs anywhere |
| TDD_PROOF.md (any) | docs/execution/slices/*/TDD_PROOF.md | ❌ | NOT_FOUND | No TDD proof files anywhere |
| .planning/config.json | .planning/config.json | ✅ | ✅ | TDD mode ON; oli-execution-gate configured |
| Planning phases | .planning/phases/ | ✅ | PARTIAL | 12+ phases; G1 has only RESEARCH.md |
| Module specs (11) | docs/product/modules/*/MODULE_SPEC.md | ✅ | PARTIAL | All 11 exist; dental-emr INFERRED-only |
| API contracts (11) | docs/product/modules/*/API_CONTRACTS.md | ✅ | NOT_AUDITED | All 11 exist |
| UI prototypes (11) | docs/product/modules/*/ui-prototype/ | ✅ | NOT_AUDITED | All 11 have screens/components/form-contracts |
| CI workflows | .github/workflows/ | ✅ | ✅ | 5 workflows; E2E continue-on-error: true |

---

## Backend Inventory

| Module | Path | Handler Files | Test Files | Repos | Status | Notes |
|---|---|:---:|:---:|:---:|---|---|
| dental-org | handlers/dental-org/ | ~30 | 5 | 4 | AUDITED | PIN auth, branch, membership, consent templates |
| dental-patient | handlers/dental-patient/ | ~15 | 5 | 3 | AUDITED | Treatment plans, follow-up notes, bulk ops |
| dental-visit | handlers/dental-visit/ | ~25 | 17 | 5 | AUDITED | Charts, treatments, notes, FSM — strongest coverage |
| dental-clinical | handlers/dental-clinical/ | ~12 | 3+ | 3 | AUDITED | Prescriptions, lab orders, consents, attachments |
| dental-billing | handlers/dental-billing/ | ~18 | 8 | 3 | AUDITED | Invoice FSM, payment plan FSM, discounts, receipts |
| dental-scheduling | handlers/dental-scheduling/ | 8 | 6 | 1 | AUDITED | Appointment FSM, working hours |
| dental-perio | handlers/dental-perio/ | ~8 | 1 | 1 | PARTIALLY_AUDITED | Only repo test; handler coverage thin |
| dental-imaging | handlers/dental-imaging/ | ~20 | 5 (4057 lines) | 3 | AUDITED | Ceph FSM, findings FSM, coverage test |
| dental-pmd | handlers/dental-pmd/ | ~6 | 3 | 1 | AUDITED | Generate/import/export PMD |
| shared | handlers/shared/ | 2 | — | — | AUDITED | assert-branch-access, assert-branch-role |
| person | handlers/person/ | 4 | — | 1 | NOT_AUDITED | Base identity module |
| billing | handlers/billing/ | ~12 | 6 | 1 | NOT_AUDITED | Stripe Connect base |
| booking | handlers/booking/ | ~10 | 8 | 3 | NOT_AUDITED | Generic scheduling base |
| audit | handlers/audit/ | 2 | 2 | 1 | NOT_AUDITED | Read-only audit logs |
| notifs | handlers/notifs/ | 3 | — | 1 | NOT_AUDITED | Notification inbox |
| comms | handlers/comms/ | 5 | 2 | 2 | NOT_AUDITED | Chat + WebRTC |
| storage | handlers/storage/ | 5 | 3 | 1 | NOT_AUDITED | S3 multipart |
| email | handlers/email/ | 6 | 2 | 2 | NOT_AUDITED | SMTP queue |
| reviews | handlers/reviews/ | 3 | — | 1 | NOT_AUDITED | Review CRUD |
| dental-emr | handlers/dental-emr/ | 0 | 0 | 0 | NOT_FOUND | Spec exists; no backend implementation |

---

## Frontend Inventory

| Area | Path | Route Files | Component Files | Hook Files | Test Files | Status |
|---|---|:---:|:---:|:---:|:---:|---|
| Workspace | features/workspace/ | 1 | 22 | 18 | 19 | AUDITED |
| Patients | features/patients/ | 2 | ~8 | ~4 | 4 | AUDITED |
| Billing | features/billing/ | 1 | ~6 | ~3 | ~2 | PARTIALLY_AUDITED |
| Imaging | features/imaging/ | ~5 | ~15 | ~8 | 1 | PARTIALLY_AUDITED |
| Staff | features/staff/ | 1 | ~4 | 2 | 2 | NOT_AUDITED |
| Calendar | routes/_dashboard/calendar | 1 | — | — | — | NOT_AUDITED |
| Dashboard | routes/_dashboard/dashboard | 1 | — | — | — | NOT_AUDITED |
| Onboarding | features/onboarding/ | 1 | ~3 | — | 1 | NOT_AUDITED |
| Settings | routes/_dashboard/settings | 1 | — | — | — | NOT_AUDITED |
| Reports | routes/_dashboard/reports | 1 | — | — | — | NOT_AUDITED |

---

## Spec Inventory

| Module | MODULE_SPEC | API_CONTRACTS | UI_BLUEPRINT | SLICE_SPEC | TDD_PROOF | Status |
|---|:---:|:---:|:---:|:---:|:---:|---|
| dental-org | ✅ | ✅ | ✅ | ❌ | ❌ | PARTIALLY_AUDITED |
| dental-patient | ✅ | ✅ | ✅ | ❌ | ❌ | PARTIALLY_AUDITED |
| dental-visit | ✅ | ✅ | ✅ | ❌ | ❌ | PARTIALLY_AUDITED |
| dental-clinical | ✅ | ✅ | ✅ | ❌ | ❌ | PARTIALLY_AUDITED |
| dental-billing | ✅ | ✅ | ✅ | ❌ | ❌ | PARTIALLY_AUDITED |
| dental-scheduling | ✅ | ✅ | ✅ | ❌ | ❌ | PARTIALLY_AUDITED |
| dental-perio | ✅ | ✅ | ✅ | ❌ | ❌ | PARTIALLY_AUDITED |
| dental-imaging | ✅ | ✅ | ✅ | ❌ | ❌ | PARTIALLY_AUDITED |
| dental-pmd | ✅ | ✅ | ✅ | ❌ | ❌ | PARTIALLY_AUDITED |
| dental-emr | ✅ (INFERRED) | ✅ | ✅ | ❌ | ❌ | NOT_AUDITED — no backend |
| dental-audit | ✅ | ✅ | ✅ | ❌ | ❌ | NOT_AUDITED |

---

## Workflow Inventory

| Workflow | Backend Audited | Frontend Audited | Tests Audited | Status |
|---|:---:|:---:|:---:|---|
| WF-001 Org/Branch Setup | ✅ | PARTIAL | ✅ | AUDITED |
| WF-002 Auth/PIN | ✅ | PARTIAL | ✅ | AUDITED |
| WF-003 Patient Registration | ✅ | ✅ | ✅ | AUDITED |
| WF-004 Scheduling/Appointment | ✅ | PARTIAL | ✅ | AUDITED |
| WF-005 Visit Creation/Workspace | ✅ | ✅ | ✅ | AUDITED |
| WF-006 Dental Charting | ✅ | ✅ | ✅ | AUDITED |
| WF-007 Treatment Planning | ✅ | ✅ | ✅ | AUDITED |
| WF-008 Consent/Clinical Safety | PARTIAL | PARTIAL | PARTIAL | PARTIALLY_AUDITED |
| WF-009 Perio Charting | ✅ | PARTIAL | PARTIAL | PARTIALLY_AUDITED |
| WF-010 Imaging/Cephalometric | ✅ | ✅ | ✅ | AUDITED |
| WF-011 Prescriptions/Lab Orders | ✅ | ✅ | ✅ | AUDITED |
| WF-012 Billing/Collections | ✅ | ✅ | ✅ | AUDITED |
| WF-013 PMD | ✅ | PARTIAL | PARTIAL | PARTIALLY_AUDITED |
| WF-014 Notifications/Audit/Storage | NOT_AUDITED | NOT_AUDITED | NOT_AUDITED | NOT_AUDITED |

---

## Audit Pass Completion

| Pass | Status | Audited Areas | Partial Areas | Not Audited |
|---|---|---|---|---|
| 01 Enforcement Guardrails | COMPLETE | All rules loaded | — | — |
| 02 OLI Pipeline Artifacts | COMPLETE | config, phases, module specs, CI | slice specs, TDD proofs | MASTER_PRD, WORKFLOW_MAP, ROLE_PERMISSION_MATRIX |
| 03 Product Workflow Audit | COMPLETE | WF-001 thru WF-013 | WF-008, WF-009, WF-013 | WF-014 |
| 04 Spec-to-Code Compliance | COMPLETE | dental-visit, dental-billing, dental-clinical | dental-perio, dental-emr | dental-audit |
| 05 TDD Confidence | COMPLETE | Backend per-module | dental-perio frontend | E2E run state unknown |
| 06 UI/UX Carousel | COMPLETE | timeline-carousel, workspace, carousel gaps G1-G12 | billing UX, perio UX | accessibility deep-dive |
| 07 Remediation Tasks | COMPLETE | All gaps assigned tasks | — | — |

---

## Coverage Score

- Backend modules audited: 10/20 (50% — dental verticals well covered; base modules not audited as out of scope)
- Dental backend modules audited: 9/9 (100%)
- Frontend areas audited: 3/10 (workspace, patients, imaging)
- Specs audited (MODULE_SPEC): 11/11 present; 0/11 have SLICE_SPEC or TDD_PROOF
- Tests audited: 12 of ~90 test files sampled
- Workflows audited: 13/14 (93%)
- TDD proofs audited: 0 exist (process debt)
