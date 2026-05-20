# Compliance Report

---
Audit Date: 2026-05-18
Branch: feat/v1.4-clinical-imaging
Modules Audited: dental-imaging (MODULE_SPEC.md), cross-module (BUSINESS_RULES.md + ACCEPTANCE_CRITERIA.md)
Prior Report: 2026-05-16 (dental-imaging only, SHA 57b06d4)
Auditor: oli-audit-compliance
---

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|----------------|
| `docs/modules/dental-imaging/MODULE_SPEC.md` | ✓ | Steps 3–10 (dental-imaging) |
| `docs/prd/BUSINESS_RULES.md` | ✓ | Step 3 (BR-001–BR-022 cross-module) |
| `docs/prd/ACCEPTANCE_CRITERIA.md` | ✓ | Step 4 (40 ACs) |
| `docs/prd/v3-dentalemon.md` | ✓ | Step 5 (role/domain context) |
| `specs/api/docs/standards/domain-glossary.md` | ✓ | Step 6 (domain terms) |
| `docs/product/ROLE_PERMISSION_MATRIX.md` | ✗ | Step 5 used inline matrix in MODULE_SPEC.md:144 |
| `docs/product/DOMAIN_GLOSSARY.md` | ✗ | Step 6 used specs/api/docs/standards/domain-glossary.md |
| `docs/product/API_CONTRACTS.md` | ✗ | Step 8b skipped |
| `docs/product/EVENT_CONTRACTS.md` | ✗ | Step 9c skipped |
| `docs/product/AUDIT_CONTRACTS.md` | ✗ | Step 9d skipped |
| `docs/product/DATA_GOVERNANCE.md` | ✗ | Step 9e skipped (--regulated not set) |
| MODULE_SPEC.md for non-imaging modules | ✗ | Steps 3–10 limited to BR/AC docs for other modules |

> **Spec paradox disclaimer:** This audit validates code against specs. If specs are wrong, compliant code may still be incorrect. Last spec-consistency run: NOT RUN.

> **Scope note:** Only `docs/modules/dental-imaging/MODULE_SPEC.md` exists. All other modules (dental-visit, dental-billing, dental-clinical, dental-scheduling, dental-patient, dental-pmd) have no MODULE_SPEC.md — audited against BUSINESS_RULES.md and ACCEPTANCE_CRITERIA.md as spec source. Violations flagged as module `CROSS`.

---

## Executive Summary

- **Overall compliance rate:** 84% (59/70 scoreable items — 0 P0, 1 P1, 6 P2, 3 P3)
- **P0 violations (fix now):** 0
- **P1 violations (fix before new work):** 1 _(was 3; V-CROSS-002 + V-CROSS-003 resolved 2026-05-18)_
- **P2 violations (fix when touching):** 6
- **P3 observations:** 3
- **Spec gaps found:** 7 (ceph has NO BRs in spec — largest gap)
- **Health score:** 7.4 / 10

**Top 3 risks:**
1. **Ceph (11 handlers, 3 DB tables) has zero spec coverage** — CIMG-NNN test IDs reference rules that exist nowhere in BUSINESS_RULES.md or MODULE_SPEC.md. A compliance re-audit after any ceph refactor will find violations with no spec to anchor them.
2. **40% of Acceptance Criteria (16/40) have no tests** — the AC layer is the only layer validating full user-facing flows; its absence means regressions in scheduling, prescriptions, invoicing, and PMD are undetectable.
3. **BR-005 (auto-discard empty visit) not implemented** — a user creating a visit accidentally has no cleanup path; manual cleanup required.

---

## Category Summary

| Category | Items | Compliant | P0 | P1 | P2 | P3 | Spec Gaps |
|----------|-------|-----------|----|----|----|----|-----------|
| Business Rules (core, BR-001–BR-022) | 22 | 19 | 0 | 1 | 1 | 1 | 0 |
| Business Rules (imaging, BR-023–BR-035) | 13 | 11 | 0 | 0 | 1 | 1 | 1 |
| Business Rules (ceph, CIMG-NNN) | 0 | — | — | — | — | — | ✗ No BRs in spec |
| Acceptance Criteria | 40 | 25 | 0 | 0 | 4 | 1 | 0 |
| Permissions | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| Domain Terminology | — | — | — | — | — | — | ✗ Inline glossary only |
| Bounded Context Integrity | — | — | — | — | — | — | ✗ No DOMAIN_MODEL.md |
| Error Contracts | — | — | — | — | — | — | ✗ No global error contract |
| API Contracts (module spec) | 13 | 13 | 0 | 0 | 0 | 0 | 0 |
| State Transitions | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| Data Validation | 8 | 8 | 0 | 0 | 0 | 0 | 0 |

---

## Violations by Module

### CROSS — Cross-Module (BR-001–BR-022 + all ACs)

**Compliance rate:** 87% (40/46 items — 0 P0, 1 P1, 5 P2, 1 P3)

#### P1 — Fix Before New Work

| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-CROSS-001 | Business Rules | **BR-005 not enforced:** Visit auto-discard on session end is explicitly `not-implemented` in spec with `describe.skip` in tests. No session timeout or heartbeat infrastructure. A visit created via the "+" button but abandoned persists indefinitely. | `services/api-ts/src/handlers/dental-visit/` — no discard handler | Implement session heartbeat + scheduled job to delete zero-entry visits older than N minutes; or formalize deferral with an ADR entry in BUSINESS_RULES.md. |
| ~~V-CROSS-002~~ | ~~Acceptance Criteria~~ | ~~**AC-REG-02 UNTESTED**~~ | ~~`apps/dentalemon/tests/e2e/` — absent~~ | ✅ **RESOLVED 2026-05-18** — `patient-registration.spec.ts`: test `AC-REG-02: API rejects patient creation when consentGiven=false (BR-015)` added. Direct `fetch` with `consentGiven: false` → asserts 422. |
| ~~V-CROSS-003~~ | ~~Acceptance Criteria~~ | ~~**AC-VISIT-02 no E2E**~~ | ~~`apps/dentalemon/tests/e2e/` — absent~~ | ✅ **RESOLVED 2026-05-18** — `workspace-readonly.spec.ts` covers: (1) no mark-done button + slideout read-only → "Add Amendment"; (2) "View Invoice" footer link. |

#### P2 — Fix When Touching

| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-CROSS-004 | Business Rules | **BR-013 placeholder:** Invoice reconciliation rule has `describe.skip` in `business-rules.test.ts`. Underlying code may enforce the rule, but no test validates the edge case. | `services/api-ts/src/handlers/business-rules.test.ts` — skip | Remove skip, implement test for invoice reconciliation edge case. |
| V-CROSS-005 | Acceptance Criteria | **AC-SCHED-01 UNTESTED:** Create appointment — calendar update and slot unavailability. No unit test or E2E. | `apps/dentalemon/tests/e2e/` — absent | Add test: create appointment → slot unavailable in calendar view. |
| V-CROSS-006 | Acceptance Criteria | **AC-SCHED-04 UNTESTED:** Cancel appointment — status=cancelled, slot freed. No unit test or E2E. | `apps/dentalemon/tests/e2e/` — absent | Add E2E: cancel → slot reappears. |
| V-CROSS-007 | Acceptance Criteria | **AC-MED-03 no E2E:** Consent e-signature flow has no E2E. `consent-sheet.test.ts` exists but no Playwright spec asserting signed form becomes read-only on re-open. | `apps/dentalemon/tests/e2e/` — absent | Add Playwright: sign consent → read-only on re-open. |
| V-CROSS-008 | Acceptance Criteria | **AC-PAY-01 UNTESTED:** Record payment against invoice — no unit or E2E test. Core revenue path. | `apps/dentalemon/tests/e2e/` — absent | Add test: POST payment → invoice status updates. |

#### P3 — Track

| ID | Category | Description | Notes |
|----|----------|-------------|-------|
| V-CROSS-009 | Business Rules | **BR-020 stub 501:** Patient merge returns HTTP 501 explicitly. Spec documents it as not-implemented. | Intentional. Acceptable until merge feature built. |

---

### dental-imaging — (MODULE_SPEC.md exists, BR-023–BR-035)

**Compliance rate:** 94% — delta from 2026-05-16 audit (0 P0/P1/P2 then; 2 new P2s from ceph test gaps).
**Delta since 2026-05-16:** 11 ceph handlers landed with no spec update — surfaced as spec gap, not code violation. Two previously untested imaging BRs (031, 032) escalated to P2.

#### P2 — Fix When Touching

| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-DIMAG-002 | Business Rules | **BR-031 offline caching untested:** `use-offline-cache.ts` hook exists but has no test. Only implementation of offline-first IndexedDB promise in spec. | `apps/dentalemon/src/features/imaging/hooks/use-offline-cache.ts` | Add unit test: simulate network unavailability → images served from IndexedDB cache. |
| V-DIMAG-003 | Business Rules | **BR-032 modality non-nullable: no explicit test tag:** `imaging.test.ts` has broad coverage but no test tagged `[BR-032]` or asserting `modality: null` → 422. | `services/api-ts/src/handlers/dental-imaging/imaging.test.ts` | Add test: POST /dental/imaging/studies with `modality: null` → 422. |

#### P3 — Track

| ID | Category | Rule | Description | Notes |
|----|----------|------|-------------|-------|
| V-DIMAG-001 | Business Rules | BR-035 | Annotation last-write-wins resolver not implemented | Carries from 2026-05-16. Phase 3b per spec; `imaging_annotation.updated_at` present; no P0/P1 impact. |

---

## Spec Gaps

Items where the spec is incomplete — these are **NOT** code violations:

| Module | Section | Gap | Impact | Recommendation |
|--------|---------|-----|--------|----------------|
| dental-imaging | BUSINESS_RULES.md | **Ceph has zero BRs.** 11 handlers enforce: imagingTier gate (free → 403), landmark state machine (`placed→confirmed→locked` terminal), report gate (A/B/Go/Po must be `confirmed`), branch isolation (non-member → 404 not 403), immutable versioned reports. Test IDs use `CIMG-NNN` namespace with no spec doc. | HIGH | Add `## Ceph (v1.4) — CIMG-001..NNN` section to BUSINESS_RULES.md |
| dental-imaging | MODULE_SPEC.md | Not updated for ceph. Spec covers BR-023–BR-035 only. 3 new tables (`imaging_ceph_landmark`, `imaging_ceph_analysis`, `imaging_ceph_report`), 11 endpoints, landmark FSM, tier gating undocumented. | HIGH | Update MODULE_SPEC.md: schema, BRs, permission matrix rows, state transitions (SM-02), API endpoints for all `CephMgmt_*` handlers |
| dental-imaging | MODULE_SPEC.md — AC-NNN | No acceptance criteria. Test traceability to user-facing ceph behaviors unmappable. | MEDIUM | Add AC-NNN entries (ceph panel open/close, landmark palette, measurements display, report generation, PDF export) |
| dental-imaging | Section 8 — State Transitions | Imaging finding FSM (`suspected→confirmed→resolved`, enforced in `updateFinding.ts`) and ceph landmark FSM not documented in MODULE_SPEC.md. | LOW | Add Section 8 with SM-01 (imaging finding) and SM-02 (ceph landmark) |
| cross-module | ROLE_PERMISSION_MATRIX.md | No standalone permission matrix. Only imaging module has inline matrix (MODULE_SPEC.md §144). Non-imaging modules have no formal permission spec. | MEDIUM | Create `docs/product/ROLE_PERMISSION_MATRIX.md` covering all modules |
| cross-module | DOMAIN_GLOSSARY.md | Glossary exists at `specs/api/docs/standards/domain-glossary.md` but not linked from CLAUDE.md, MODULE_SPEC.md, or product docs. | LOW | Reference in CLAUDE.md and MODULE_SPEC.md |
| cross-module | Global Error Contract | `@/core/errors` shapes are consistent but no document defines the expected envelope. | LOW | Add error envelope definition to `docs/product/API_CONVENTIONS.md` |

---

## Unauditable Items

| Item | Reason | Manual Check Needed |
|------|--------|-------------------|
| BR-033: Max file size 100MB | Enforcement delegated to storage layer (S3/MinIO). Handler accepts before storage validates. | Verify MinIO/S3 bucket policy enforces 100MB; test with 101MB upload |
| BR-031: IndexedDB offline serving | Requires browser + network disable. Cannot verify statically. | Playwright: `page.route('**', abort)` + cache pre-warm |
| Ceph imagingTier at runtime | `imagingTier` sourced from DB. Static analysis cannot confirm field is populated for all existing orgs. | Verify seed + migration sets `imagingTier` on `dental_membership` for all orgs |

---

## Test Traceability Summary

| Type | Total | Strong Test | Weak Test | No Test | Traceability % |
|------|-------|-------------|-----------|---------|----------------|
| Business Rules (BR-001–BR-022) | 22 | 15 | 4 | 3 | 86% |
| Business Rules (BR-023–BR-035) | 13 | 9 | 2 | 2 | 85% |
| Ceph Rules (CIMG-NNN) | — | — | — | — | 0% (no spec) |
| Acceptance Criteria | 40 | 19 | 5 | 16 | 48% |

Note: Traceability is supplementary — severity is determined by code enforcement status, not test coverage. For full confidence scoring, run `/oli-confidence-stack`.

### AC Traceability Detail (untested/partial items)

| AC | Description | Test Status | Severity |
|----|-------------|-------------|----------|
| ~~AC-REG-02~~ | Registration blocked without consent | ✅ E2E added 2026-05-18 (`patient-registration.spec.ts` — `AC-REG-02` test) | ~~P1~~ Resolved |
| ~~AC-VISIT-02~~ | Workspace read-only after checkout | ✅ E2E added 2026-05-18 (`workspace-readonly.spec.ts` — 2 tests) | ~~P1~~ Resolved |
| AC-SCHED-01 | Create appointment | No test | P2 |
| AC-SCHED-04 | Cancel appointment | No test | P2 |
| AC-MED-03 | Collect e-signature consent | Unit only | P2 |
| AC-PAY-01 | Record payment against invoice | No test | P2 |
| AC-REG-01 | Register new patient with consent | No E2E | P2 |
| AC-REG-03 | Walk-in from calendar | Unit only | P2 |
| AC-SCHED-02 | Edit existing appointment | No test | P2 |
| AC-CHART-02 | Save tooth chart entry | Unit only | P2 |
| AC-CHART-03 | Chart blocked for completed visit | Unit only | P2 |
| AC-TXPLAN-01 | View treatment plan | No test | P2 |
| AC-RX-01 | Write prescription | No E2E | P2 |
| AC-PAY-02 | Partial payment creates payment plan | No test | P2 |
| AC-PAY-03 | Payment plan blocks invoice void | No test | P2 |
| AC-PMD-01 | Generate PMD for completed visit | Unit only | P2 |
| AC-PMD-02 | Share PMD | No test | P2 |
| AC-PMD-03 | Import external PMD | Unit only | P2 |
| AC-CHART-05 | Five-surface selector | Unit only | P3 |
| AC-PROF-01 | View patient profile | Unit only | P3 |
| AC-PROF-02 | Navigate workspace from profile | Unit only | P3 |

---

## Stabilization Plan

### Fix Now (P0)
_None._

### Fix Before New Work (P1)

| Priority | ID | Fix | Effort |
|----------|----|-----|--------|
| 1 | Spec gap | Add CIMG-NNN BRs to BUSINESS_RULES.md | ✅ Done 2026-05-18 |
| 2 | Spec gap | Update MODULE_SPEC.md for ceph schema/BRs/endpoints/FSM | ✅ Done 2026-05-18 |
| 3 | V-CROSS-002 | E2E: POST /dental/patients consent=false → 422 | ✅ Done 2026-05-18 |
| 4 | V-CROSS-003 | Playwright: completed visit → no edit controls | ✅ Done 2026-05-18 |
| 5 | V-CROSS-001 | Implement BR-005 OR add formal ADR deferral | ✅ ADR-010 added 2026-05-18 |

### Fix When Touching Module (P2)

- **dental-visit:** V-CROSS-004 (BR-013 skip)
- **dental-scheduling:** V-CROSS-005 (AC-SCHED-01), V-CROSS-006 (AC-SCHED-04)
- **dental-clinical:** V-CROSS-007 (AC-MED-03 E2E)
- **dental-billing:** V-CROSS-008 (AC-PAY-01)
- **dental-imaging:** V-DIMAG-002 (use-offline-cache test), V-DIMAG-003 (BR-032 tag)
- Remaining P2 ACs: add tests when touching corresponding handler

### Track (P3)

- V-CROSS-009: BR-020 stub 501 (intentional)
- V-DIMAG-001: BR-035 last-write-wins (Phase 3b)
- AC-CHART-05, AC-PROF-01, AC-PROF-02 (low risk)

---

## Health Score

| Dimension | Score (0–10) | Notes |
|-----------|-------------|-------|
| Business rule enforcement (BR-001–BR-035) | 6/10 | P1 cap: BR-005 not-implemented; BR-020 stub; otherwise strong enforcement |
| Acceptance criteria test coverage | 5/10 | 40% untested; P1s resolved (AC-REG-02 + AC-VISIT-02 E2E added) |
| Permission coverage | 9/10 | Role gates enforced; branch isolation enforced; ceph tier gate enforced |
| Domain terminology consistency | 7/10 | Glossary exists; not formally linked per-module |
| Bounded context integrity | 6/10 | D-01 FK references partial (~25 cols remain); no DOMAIN_MODEL.md |
| Error contract compliance | 7/10 | `@/core/errors` consistent; no formal envelope doc |
| API contract compliance | 9/10 | All endpoints registered in routes.ts; ceph 8 routes registered; Zod validators generated |
| State transition safety | 9/10 | Visit, treatment, imaging finding, ceph landmark FSMs all enforced |
| Data validation coverage | 9/10 | Zod validators for all routes; ceph request bodies validated |

**Overall health: 7.4 / 10** _(average of 9 applicable dimensions; AC coverage +1 from P1 resolution 2026-05-18)_

---

## What's Next

**All P1 stabilization items resolved as of 2026-05-18.**

| Item | Status |
|------|--------|
| CIMG-NNN BRs → BUSINESS_RULES.md | ✅ Done |
| MODULE_SPEC.md ceph update | ✅ Done |
| ADR-010 (BR-005 formal deferral) | ✅ Done |
| AC-REG-02 E2E (`patient-registration.spec.ts`) | ✅ Done |
| AC-VISIT-02 E2E (`workspace-readonly.spec.ts`) | ✅ Done |

Remaining open work (all P2/P3, deferred to post-merge):
- V-CROSS-004: BR-013 skip (dental-billing)
- V-CROSS-005/006: AC-SCHED-01/04 (scheduling E2E)
- V-CROSS-007: AC-MED-03 E2E (consent sheet re-open)
- V-CROSS-008: AC-PAY-01 (payment E2E)
- V-DIMAG-002/003: use-offline-cache test + BR-032 tag

Re-run audit after post-merge P2 work:
```
/oli-audit-compliance --module dental-imaging
```
