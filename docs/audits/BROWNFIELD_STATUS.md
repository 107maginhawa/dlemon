# Dentalemon — Brownfield Status Dashboard

<!-- oli-magic v2 | generated: 2026-05-26 | updated: 2026-05-30 (cycle-2 graduation check; knowledge-graph-backed re-audit) | cycle: 2 | state: cycle_2 (NOT graduated) -->

---

## Execution State

| Field | Value |
|---|---|
| **Brownfield state** | `cycle_2` — cycle-2 re-audit complete 2026-05-30; **NOT graduated** (confidence 8.0 < 9.0). Re-entry available for cycle 3. |
| **Score at graduation (cycle 1)** | 9.0 / 10 (2026-05-21) — graduated, then 2026-05-26 audit reopened cycle 2 on new P0 security drift |
| **Graduation threshold** | P0 = 0, audit/compliance/confidence ≥ 9.0 (clinical bar) |
| **Cycle-2 re-audit (2026-05-30)** | Compliance 🟢 PASS · Confidence 🟡 8.0 · Traceability 🟡 71% chain · Knowledge graph ✅ 237/0/0 spec parity |
| **G7 Security** | ✅ COMPLETE — 8/8 (3 P0 + 3 P1 security findings resolved) |
| **G8 Spec & UI** | ✅ COMPLETE — S1/S3/S4/S8 specs + ADR-005; S2 pre-satisfied; S5/S6/S7 UI |
| **Current branch** | `main` (HEAD 01f83918) |
| **Typecheck** | ✅ PASSING — api-ts + dentalemon both clean (2026-05-30) |
| **Tests** | ✅ api-ts 2542/0 (full suite); frontend touched-area 740/0 |
| **NEXT ACTION** | **Cycle 3:** run `/oli-magic` → it re-enters (renames audit + ROADMAP, state→planned), plans a cycle-3 wave from the confidence/trace P1 gaps (imaging tests, pmd deny tests, event traceability, BR-036..047, patient/person coverage, resolve GAP-DENTAL-027 + CONSISTENCY C4/C7). Cycle 3 is the **last** before `blocked`. |

---

## Cycle-2 Re-Audit Results (2026-05-30) — knowledge-graph-backed

The mandatory re-audit sequence ran against the engine knowledge graph (`docs/audits/codebase-map/`, AST, git_sha 01f83918).

### Dimension verdicts

| Dimension | Verdict / Score | Report | Headline |
|-----------|-----------------|--------|----------|
| Knowledge graph | ✅ built | `codebase-map/` | 23 modules · 237 endpoints · 75 tables · 28 FSMs · **237/0/0 spec-trace parity** · 2 auth-drift |
| Compliance | 🟢 PASS (~8.5/10) | [COMPLIANCE_REPORT.md](./COMPLIANCE_REPORT.md) | 0 P0 / 0 P1 open; ~43 P2 + C4/C7 consistency FAILs hold it < 9 |
| Confidence | 🟡 **8.0/10** | [CONFIDENCE_REPORT.md](./CONFIDENCE_REPORT.md) | L1=8 L2=8 L3=9 L4=8.75; **0 fabrication** in 17 TDD proofs verified |
| Traceability | 🟡 71% chain | [TRACE_REPORT.md](../trace/TRACE_REPORT.md) | 661 nodes/1043 edges; 0 dangling, 0 blind spots; 1 P0 (latent), 9 P1, 14 P2 |

### Why not 9.0 — the gap is *reach*, not defects

Structural health is strong (perfect API↔spec parity, zero cross-module blind spots, zero dangling refs, compliance PASS). The miss is **test coverage breadth** into specific surfaces:

| Cycle-3 P1 scope | Source | Current |
|------------------|--------|---------|
| dental-imaging coverage | confidence/trace | 5 tests / ~42 handlers (L1/L2=4) |
| dental-pmd deny-403 tests + generatePMD identity pin | confidence/trace | 0 deny tests |
| Domain-event traceability (publisher-asserts-audit-row) | confidence/trace | 6/24 events traced |
| BR-036..047 (ceph rules) test owners | trace | 0 traced |
| patient / person base-module coverage | confidence | L1/L2=3 |
| Resolve GAP-DENTAL-027 (patient merge/unmerge admin guard) | knowledge graph | latent P0/auth-drift |
| CONSISTENCY C4 (permission closure) + C7 (broken trace) | spec-gate | FAIL-level |

---

## 2026-05-26 Parallel Audit — Cycle 2 Findings

> 4 specialist agents ran concurrently. Source files in `docs/audits/mapping-audit/`.

### Scores

| Dimension | Score | Source |
|-----------|:-----:|--------|
| Security | —/10 | 3x P0, 3x P1, 1x P2 found |
| Spec compliance | 7/10 | `spec-compliance-audit.md` |
| Test confidence | 4/10 | `test-confidence-audit.md` |
| UI compliance | 5.5/10 | `ui-compliance-audit.md` |

### P0 Security Findings — ✅ ALL RESOLVED (verified 2026-05-30)

| ID | Finding | Resolution |
|----|---------|-----------|
| SEC-P0-1 | IDOR — membership/branch handlers skip `assertBranchAccess` → cross-tenant writes | ✅ `assertBranchRole`/`assertBranchAccess` on all mutations (EM-ORG-001, enforce-fix track) |
| SEC-P0-2 | Hash leak — `pinHash`, `securityAnswerHash` returned in list/deactivate | ✅ stripped in `_list`/`_deactivate`/`listMembers`/`createMember`/`updateMember` (G7-S2) |
| SEC-P0-3 | Privilege escalation — `updateMember` role change with only branch-access gate | ✅ `updateMember.ts:44–56` requires caller `dentist_owner` (G7-S3) |

### P1 Findings — ✅ ALL RESOLVED (2026-05-30)

| ID | Finding | Resolution |
|----|---------|-----------|
| SEC-P1-1 | `recoverPin` missing `authMiddleware` + schema mismatch | ✅ `pinRecovery.ts:70` auth guard; EF-ORG-P015 regression lock (G7-S4) |
| SEC-P1-2 | PIN validators allow non-digit strings (no `/^\d{4,6}$/`) | ✅ TypeSpec `@pattern` on SetPin/VerifyPin (`^\d{4,8}$`) + ResetMemberPin (`^\d{6}$`); 8/8 tests (G7-S5) |
| SEC-P1-3 | Rate limiting per-membership only | ✅ `membership.repo.ts:114–153` lockout (5/30s, 10/5min) (G7-S6) |
| TEST-P1-1 | `auth-security-hardening.test.ts` untracked — NOT in CI | ✅ tracked + 12/12 pass (G7-S7) |
| SPEC-P1-1 | `handlers/emr/` live + tested with zero MODULE_SPEC | ✅ `emr-consultation/MODULE_SPEC.md` (12 sections) — pre-satisfied (G8-S2) |
| UI-P1-1 | `timeline-carousel` + `pin-select` missing `isLoading`/`isError` | ✅ loading/error states + tests added (G8-S7) |

### Cycle-2 Waves — ✅ COMPLETE

| Wave | Goal | Parallel? | Status |
|------|------|-----------|--------|
| G7 | Close P0 security + P1 auth gaps (8 slices) | NO — sequential | ✅ COMPLETE 2026-05-30 (8/8) |
| G8 | Spec docs + UI compliance (8 slices) | YES | ✅ COMPLETE 2026-05-30 |

---

## Wave Execution Progress

All 8 brownfield waves complete.

| Wave | Name | Status | Date |
|------|------|--------|------|
| G1 | Foundation Stabilization | ✅ COMPLETE | 2026-05-21 |
| G2 | Spec & Coverage Completeness | ✅ COMPLETE | 2026-05-21 |
| G3 | Domain Model Refactoring | ✅ COMPLETE | 2026-05-21 |
| G4 | Feature Delivery | ✅ COMPLETE | 2026-05-18 |
| G5 | Future Features (periodontal) | ✅ COMPLETE | 2026-05-24 |
| G6 | Excellence — Reach 9.0 | ✅ COMPLETE | 2026-05-24 |
| G7 | Security Stabilization | ✅ COMPLETE | 2026-05-30 (7/8 enforce-fix + G7-S5) |
| G8 | Spec & UI Completeness | ✅ COMPLETE | 2026-05-30 |

**Post-graduation work (feat/v1.5-g1-foundation):**

| Slice | Description | Status | Commit |
|-------|-------------|--------|--------|
| P0-A | PatientContact entity | ✅ GREEN | TDD_PROOF ✅ |
| P0-B | Recall / Task entity | ✅ GREEN | TS4111 fixed; routes wired in app.ts; TDD_PROOF ✅ |
| P0-C | TreatmentPlan header + plan FSM | ✅ GREEN | TDD_PROOF ✅ |
| P0-D | Sync Metadata foundation | ✅ GREEN | TDD_PROOF ✅ |

---

## Module Health Dashboard

Source: DENTAL_SYSTEM_AUDIT_REPORT.md (2026-05-25 audit).
P1 blockers (GAP-001 through GAP-004) resolved same day.

| Module | Backend | Tests | Frontend | Spec | V1 Ready |
|--------|---------|-------|----------|------|----------|
| dental-org | ✅ | ✅ | ✅ | ✅ | **YES** |
| dental-patient | ✅ | ✅ | ✅ | ✅ | **YES** |
| dental-visit | ✅ | ✅ | ✅ | ✅ | **YES** (chart versioning P1 resolved 2026-05-25) |
| dental-clinical | ✅ | ✅ | ✅ | ✅ | **YES** (consent gate P1 resolved 2026-05-25) |
| dental-billing | ✅ | ✅ | ✅ | ✅ | **YES** (consent gate P1 resolved 2026-05-25) |
| dental-scheduling | ✅ | ✅ | ✅ | ✅ | **YES** |
| dental-perio | ✅ | ✅ | PARTIAL | ✅ | CONDITIONAL — thin frontend |
| dental-imaging | ✅ | ✅ | ✅ | ✅ | **YES** |
| dental-pmd | ✅ | PARTIAL | PARTIAL | ✅ | CONDITIONAL — thin frontend + sparse tests |
| dental-emr | ❌ | ❌ | ❌ | INFERRED | **NO** — zombie spec; no backend (see GAP-020) |
| dental-audit | ✅ | ✅ | — | ✅ | CONDITIONAL — no handler dir; getAuditEvents lives in dental-org |

---

## TDD Compliance

### Test Inventory

| Layer | Count | Quality |
|-------|-------|---------|
| Backend unit / integration test files | ~97 | Strong for 9/11 modules |
| Frontend test files | 126 | Strong for workspace; thin for billing/calendar |
| Playwright E2E specs | 31 | Good journey coverage |
| Hurl contract tests | 35 | Full TypeSpec pipeline |
| TDD_PROOF.md artifacts | **8** in `docs/execution/slices/` | P0-A through P0-D + P1-001–P1-004 |

### Test Confidence Scores (domain audit rubric, 2026-05-25)

| Dimension | Score | Notes |
|-----------|:-----:|-------|
| Spec item coverage (AC/BR traceability) | 40/100 | SLICE_SPEC coverage inferred from test names only |
| Backend unit / integration | 80/100 | Strong 7/9 modules; perio RESOLVED (GAP-008) |
| Frontend / component | 75/100 | Workspace excellent; billing/calendar thin |
| E2E workflow | 70/100 | Good coverage; CI gate now hard (GAP-004 resolved) |
| Permission / security tests | 75/100 | RBAC per-module; billing gate HTTP tested |
| Data lifecycle tests | 60/100 | Soft-delete proven; chart versioning now added |
| TDD proof quality | **~30/100** | 8 TDD_PROOF files exist (audit understated as 0) |
| CI reliability | 75/100 | Unit gate hard; E2E gate hardened (GAP-004) |
| **Overall** | **~58/100** | Strong code tests; weak spec-traceability artifacts |

### Key TDD Gaps

| Gap | Severity | Finding |
|-----|----------|---------|
| No local-first / offline test suite | P1 | No sync/offline test scenarios exist |
| No seed scenario tests | P2 | No test validates seed data workflows end-to-end |
| P0 E2E paths untested | P0 (safety) | Safety floor, consent sign flow, prescription submit — no E2E |
| booking-coverage.test.ts TS18046 | ❌ Blocker | 13 typecheck errors — body typed as unknown |
| updateRecall.ts TS4111 | ❌ Blocker | P0-B work; index signature property access error |

---

## Spec Compliance

### MODULE_SPEC Coverage

| Status | Count | Modules |
|--------|-------|---------|
| Full spec + backend | 9 | org, patient, visit, clinical, billing, scheduling, perio, imaging, pmd |
| Spec exists, no backend | 2 | dental-emr (zombie), dental-audit (spec only) |
| Missing spec | 0 | — |

**Stale duplicate:** `docs/modules/` (10 files, missing dental-perio) duplicates `docs/product/modules/` (11 files). Remove `docs/modules/` — see GAP-024.

### Missing Pipeline Artifacts

| Artifact | Expected Path | Status |
|----------|--------------|--------|
| MASTER_PRD.md | docs/product/MASTER_PRD.md | ❌ NOT FOUND |
| PRD_AUDIT_REPORT.md | docs/product/PRD_AUDIT_REPORT.md | ❌ NOT FOUND |
| ROLE_PERMISSION_MATRIX.md | docs/product/ROLE_PERMISSION_MATRIX.md | ❌ NOT FOUND |
| WORKFLOW_MAP.md | docs/product/WORKFLOW_MAP.md | ❌ NOT FOUND |
| SLICE_SPEC.md (G1 slices) | docs/execution/slices/g1-*/SLICE_SPEC.md | ❌ NOT FOUND |

### Spec Consistency (CONSISTENCY_REPORT.md)

| Check | Status | Finding |
|-------|--------|---------|
| C1 Naming — glossary alignment | WARN | 4 terms in MODULE_SPECs absent from DOMAIN_GLOSSARY |
| C2 Entity attributes | WARN | 5 field gaps/mismatches across visit, billing, patient |
| C3 Workflow coverage | WARN | 3 modules missing §4 Workflow Details; 1 duplicate UI route |
| C4 Permission closure | **FAIL** | 3 HIGH contradictions/gaps in ROLE_PERMISSION_MATRIX vs §6 |
| C5 API surface | WARN | 2 discrepancies (status value, cancel semantics) |
| C6 UI data binding | WARN | 2 fields referenced in screens not in §7 |
| C7 Cross-module traces | **FAIL** | 1 BROKEN trace: G-003 dental-clinical direct repo import; 1 naming conflict |
| C8 State machines | WARN | `sent` vs `issued` state name conflict |
| C9 Event coverage | PASS | All 24 events accounted for |

> C4 and C7 are FAIL-level. The spec-consistency gate was passed at graduation (2026-05-21) — these findings are post-graduation drift.

---

## Domain Design Consistency

### Boundary Issues

| Gap | Severity | Finding |
|-----|----------|---------|
| GAP-019 | P2 | dental-imaging and dental-ceph should split — different FSMs, tiers, test domains |
| GAP-020 | P2 | dental-emr is a zombie spec: no implementation, conflicts with dental-visit (which IS the EMR) |
| GAP-021 | P2 | dental-clinical imports VisitRepository directly from dental-visit (G-003 broken trace) |
| GAP-022 | P2 | dental-audit has MODULE_SPEC but no handler directory; getAuditEvents lives in dental-org |
| GAP-023 | P2 | dental-org getAuditEvents should move to dental-audit module |
| GAP-025 | P3 | Treatment templates in dental-visit are org-level config — should move to dental-org (V2) |
| GAP-026 | P3 | Base modules (emr, patient, provider) lack documented extension contracts with dental layer (V2) |

### Domain Model vs. "IDEAL_DENTAL" Standard (MASTER_AUDIT, 2026-05-25)

These gaps were found by comparing against an external dental domain standard. Some are already addressed on the current branch (marked).

| Gap | V1 Priority | Status |
|-----|-------------|--------|
| Recall / Task entity missing | V1 Required | ❌ P0-B RED on current branch |
| Role granularity: 4/8 standard roles implemented | V1 Required | ❌ OPEN — Missing: Dental Assistant, Front Desk, Billing Staff, Read-only |
| Cumulative patient-level chart snapshot (baseline) | V1 Required | ❌ OPEN — only per-visit JSONB chart exists |
| TreatmentPlan entity with plan-level FSM | V1 Required | ✅ P0-C GREEN (current branch) |
| Local-first sync metadata | V1 Required | ✅ P0-D GREEN (current branch) |
| Claims/Insurance (InsuranceProfile, ClaimDraft) | V1 Recommended | ❌ OPEN |
| Inventory / Materials | V1 Recommended | ❌ OPEN |
| Post-op instructions / Follow-up tasks | V1 Recommended | ❌ OPEN |
| Seed volume: 5 patients vs 20–50 required | V1 Required | ❌ OPEN |

### Roles Gap Detail

| Standard Role | Implemented | V1 Priority |
|---------------|-------------|-------------|
| Owner / Admin | ✅ `dentist_owner` | — |
| Dentist | ✅ `dentist_associate` | — |
| Associate Dentist | ✅ `dentist_associate` (same enum) | — |
| Hygienist | ❌ bundled in `staff_full` | Recommended |
| Dental Assistant | ❌ bundled in `staff_full` | **Required** |
| Front Desk | ❌ bundled in `staff_scheduling` | **Required** |
| Billing Staff | ❌ none | **Required** |
| Read-only / Auditor | ❌ none | Recommended |

---

## Open Gap Registry (as of 2026-05-25)

| Count | P0 | P1 | P2 | P3 |
|-------|:--:|:--:|:--:|:--:|
| Total gaps | 28 | 0 | 4 | 14 (open) | 6 (open) |
| Resolved | — | — | 4 | 2 | 2 (deferred) |

### P1 — All Resolved

| Gap | Title | Resolved |
|-----|-------|----------|
| GAP-001 | BR-011 consent gate in createDentalInvoice | ✅ 2026-05-25 (59d8abc) |
| GAP-002 | dental_chart_version table missing | ✅ 2026-05-25 (1e61bd5) |
| GAP-003 | onError toasts missing in chart/treatment hooks | ✅ 2026-05-25 (ef82e2c) |
| GAP-004 | E2E CI gate soft (continue-on-error) | ✅ 2026-05-25 (82ec9e6) |

### P2 — Open (14)

| Gap | Title | Module |
|-----|-------|--------|
| GAP-005 | SLICE_SPEC.md missing for G1 slices | process |
| GAP-007 | dental-emr no backend implementation | dental-emr |
| GAP-009 | Pediatric charting unwired (always sends permanent) | dental-visit / UI |
| GAP-010 | dental-emr vs dental-visit boundary ambiguity | architecture |
| GAP-011 | G1 phase: only RESEARCH.md, no CONTEXT/PLAN | .planning |
| GAP-012 | Manual route overrides in app.ts bypass TypeSpec pipeline | services/api-ts |
| GAP-019 | dental-imaging/dental-ceph should split into two modules | module boundary |
| GAP-020 | dental-emr zombie spec — rename as future external EMR import | module boundary |
| GAP-021 | dental-clinical direct repo import from dental-visit | bounded context |
| GAP-022 | dental-audit spec with no handler directory | dental-audit |
| GAP-023 | getAuditEvents in dental-org — should move to dental-audit | dental-org |
| GAP-024 | docs/modules/ is stale duplicate of docs/product/modules/ | docs |
| — | Role granularity: Dental Assistant, Front Desk, Billing Staff missing | dental-org |
| — | Cumulative baseline chart snapshot missing | dental-visit |

### P3 — Open (6, all V2 / Deferred)

GAP-013 (HMAC tamper-evidence), GAP-014 through GAP-018 (minor polish), GAP-025 (treatment templates → dental-org), GAP-026 (base module extension contracts).

---

## Health Trend

| Date | Event | Score | Notes |
|------|-------|-------|-------|
| 2026-05-18 | G4 Feature Delivery complete | ~7.5 | Ceph workspace merged |
| 2026-05-21 | Graduation | **9.0/10** | All waves complete; compliance + confidence ≥ 9.0 |
| 2026-05-24 | v1.5 spec pipeline | 9.0 | 70 UI blueprints; spec-consistency PASS |
| 2026-05-25 | Domain audit (P1 fixes) | **8.5*** | 4 P1 gaps resolved; domain rubric 58/100 |
| 2026-05-25 | feat/v1.5-g1-foundation | In progress | P0-A/C/D GREEN; P0-B RED; typecheck failing |
| 2026-05-30 | G7+G8 complete (cycle 2) | Pending re-audit | 3 P0 + 6 P1 security/spec/UI findings RESOLVED; gate green |
| 2026-05-30 | **Cycle-2 graduation check** (knowledge-graph re-audit) | **8.0/10** | Compliance PASS (~8.5) · Confidence **8.0** · Trace 71% · **NOT graduated** — confidence < 9.0; gap is coverage reach (imaging/pmd/events/ceph BRs). Overall = min(compliance, confidence) = 8.0 |

*Domain audit (58/100) uses a different rubric than the oli graduation audit (9.0/10). The domain audit penalizes missing TDD_PROOF artifacts (which exist but weren't detected), weak spec-traceability, and V1 domain gaps not in scope of the original brownfield assessment.

---

## Cleanup Candidates

Review before acting — suggestions only.

| File / Dir | Category | Reason | Safe? |
|-----------|----------|--------|-------|
| `docs/modules/` (entire dir, 10 files) | Stale duplicate | `docs/product/modules/` is canonical; `docs/modules/` missing dental-perio, will drift | YES — remove with `git rm -r docs/modules/` |
| `services/api-ts/src/handlers/dental-org/getAuditEvents.ts` | Moved responsibility | Should live in dental-audit per GAP-023 | VERIFY — move, don't delete |
| `.worktrees/workspace-reconciliation/` | Old worktree | Stale workspace from earlier reconciliation work | LIKELY — confirm no active work |

---

## Graduation Threshold Check

| Threshold | Required | Current (2026-05-30) | Status |
|-----------|----------|----------------------|--------|
| P0 open gaps | 0 | 0 active · **1 latent** (GAP-DENTAL-027 / TR-P0-01, stub auth-drift) | ⚠️ flagged |
| Audit health | ≥ 9.0 | ~8.5 — not freshly scored (discovery obsolete for spec'd project); structural proxy strong but unverified ≥9 | ❌ NOT MET |
| Compliance health | ≥ 9.0 | ~8.5 — 🟢 PASS (0 P0/P1) but ~43 P2 + C4/C7 consistency FAILs | ❌ NOT MET |
| Confidence | ≥ 9.0 | **8.0** (min L1=8, L2=8, L3=9) | ❌ NOT MET |
| Typecheck | PASS | ✅ PASS (api-ts + dentalemon) | ✅ |

> **Status: 🟡 NOT GRADUATED (cycle 2).** Overall = min(audit, compliance, confidence) = **8.0/10** vs the ≥9.0 clinical bar. The decisive miss is **Confidence 8.0** — coverage *reach* into dental-imaging, dental-pmd, the domain-event layer, ceph BRs, and the patient/person base modules. No active P0/P1 defects (compliance PASS); structural health is strong (237/0/0 spec parity, 0 blind spots, 0 dangling). `execution_state` set to `cycle_2`. **Cycle 3 is the last before `blocked`** — run `/oli-magic` to re-enter and plan the cycle-3 wave from the table in "Cycle-2 Re-Audit Results" above.

---

## Recommended Next Actions

**Immediate (block current branch):**
1. Fix `booking-coverage.test.ts` TS18046 — cast `body` with type assertion or fix response type
2. Fix `updateRecall.ts` TS4111 — use bracket notation `input['type']` instead of dot notation
3. Implement P0-B Recall handler (RED → GREEN)
4. Merge `feat/v1.5-g1-foundation` after tests pass

**Next wave (G7 — Domain Gap Closure):**
1. Role granularity: add `dental_assistant`, `front_desk`, `billing_staff` roles to dental-org
2. Cumulative baseline chart: patient-level JSONB chart snapshot (separate from visit chart)
3. Recall entity: complete with task scheduling, reminder hooks
4. Seed expansion: grow from 5 → 20+ realistic patients (child, allergy, offline scenarios)
5. Resolve C4 permission closure (CONSISTENCY_REPORT) — update ROLE_PERMISSION_MATRIX
6. Fix C7 broken trace: dental-clinical → introduce VisitService interface (GAP-021)

**Documentation backfill (P2):**
- Create ROLE_PERMISSION_MATRIX.md, WORKFLOW_MAP.md, MASTER_PRD.md
- Create SLICE_SPEC.md for G1 slices (GAP-005)
- Delete stale `docs/modules/` (GAP-024)
