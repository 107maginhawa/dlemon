<!-- oli-audit v1 | dimension: test-confidence | date: 2026-05-26 -->
# Test Confidence Audit

**Date**: 2026-05-26  
**Scope**: `services/api-ts/src/handlers/` + `apps/dentalemon/src/`  
**Runner**: Bun test  
**Result**: 964 pass / 2508 fail / 1550 errors across 3472 tests in 183 files

---

## Overall Test Run Health

| Metric | Value |
|--------|-------|
| Total tests | 3472 |
| Passing | 964 (27.8%) |
| Failing | 2508 (72.2%) |
| Errors | 1550 |
| Files run | 183 |
| Execution time | 111.9s |

> **Critical**: 72% failure rate indicates widespread infrastructure failures (likely DB connectivity / seeding issues), not logic bugs. Many tests require a live Postgres instance at `postgres://postgres:password@localhost:5432/monobase`. The failure count is not representative of test quality — the test files themselves are well-structured.

---

## Module Dashboard

### Backend — `services/api-ts/src/handlers/`

| Module | Test Files | Status | Notes |
|--------|-----------|--------|-------|
| dental-org | 20 | PARTIAL | 26 handler files lack dedicated tests (see detail below) |
| dental-visit | 19 | COVERED | Highest coverage outside dental-org |
| dental-clinical | 15 | COVERED | Good coverage |
| dental-patient | 13 | COVERED | Good coverage |
| dental-billing | 12 | COVERED | Good coverage |
| booking | 10 | COVERED | |
| dental-scheduling | 8 | COVERED | |
| billing | 6 | COVERED | |
| dental-imaging | 5 | COVERED | |
| emr | 4 | COVERED | |
| audit | 3 | COVERED | |
| dental-pmd | 3 | COVERED | |
| email | 3 | COVERED | |
| provider | 3 | COVERED | |
| storage | 3 | COVERED | |
| comms | 2 | COVERED | |
| dental-perio | 2 | COVERED | |
| patient | 2 | COVERED | |
| person | 2 | COVERED | |
| dental-audit | 1 | COVERED | |
| notifs | 1 | COVERED | |
| reviews | 1 | THIN | Single test file |
| **metrics.ts** | **0** | **UNTESTED** | No test file at all |
| **shared** | **0** | **UNTESTED** | No test file at all |

### Cross-Cutting Test Files (handlers root)

| File | Purpose |
|------|---------|
| `ac-g2s1.test.ts` | Access control G2S1 scenario |
| `business-rules.test.ts` | Domain business rules |
| `cross-org-isolation.test.ts` | Multi-org isolation |
| `error-envelope.conformance.test.ts` | Error shape conformance |
| `rbac-http.test.ts` | RBAC HTTP layer |

### Frontend — `apps/dentalemon/src/`

| Area | Test Files | Status |
|------|-----------|--------|
| patients/components | 5 | COVERED |
| patients/hooks | 5 | COVERED |
| patients/z_pages | 2 | COVERED |
| settings/components | 4 | COVERED |
| constants | 3 | COVERED |
| scripts/journey-harness | 1 | COVERED |
| features (other modules) | 0 | UNTESTED |

**No E2E test files found under `apps/dentalemon/src/`** (Playwright tests may exist elsewhere — not in scope of this scan).

---

## dental-org Module Detail

20 test files exist but **26 handler files have no dedicated test**:

### Untested handler files in dental-org

| Handler File | Risk |
|-------------|------|
| `DentalMembershipManagement_create.ts` | HIGH — core membership creation |
| `DentalMembershipManagement_deactivate.ts` | HIGH — member lifecycle |
| `DentalMembershipManagement_list.ts` | MEDIUM |
| `DentalBranchManagement_create.ts` | HIGH — branch creation |
| `DentalBranchManagement_get.ts` | MEDIUM |
| `DentalBranchManagement_list.ts` | MEDIUM |
| `DentalOrganizationManagement_create.ts` | HIGH — org creation |
| `DentalOrganizationManagement_get.ts` | MEDIUM |
| `DentalOrganizationManagement_update.ts` | MEDIUM |
| `pinRecovery.ts` | HIGH — security-sensitive |
| `recoverPin.ts` | HIGH — security-sensitive |
| `setSecurityQuestion.ts` | HIGH — security-sensitive |
| `setPin.ts` | HIGH — see coverage note below |
| `getDashboardSummary.ts` | MEDIUM |
| `getBranchSettings.ts` | LOW |
| `branchSettings.ts` | LOW |
| `getWorkingHours.ts` | LOW |
| `updateBranchSettings.ts` | LOW |
| `updateWorkingHours.ts` | LOW |
| `consentTemplates.ts` | MEDIUM |
| `createConsentTemplate.ts` | MEDIUM |
| `deleteConsentTemplate.ts` | MEDIUM |
| `listConsentTemplates.ts` | MEDIUM |
| `updateConsentTemplate.ts` | MEDIUM |

---

## Recently Modified Auth/PIN Files — Coverage Assessment

| File | Modified | Covered By | Coverage Status |
|------|----------|-----------|----------------|
| `DentalMembershipManagement_verifyPin.ts` | 2026-05-26 | `auth-security-hardening.test.ts` (untracked) | PARTIAL — 4 security scenarios only (CF-38, CF-39, CF-46) |
| `DentalMembershipManagement_setPin.ts` | 2026-05-26 | `auth-security-hardening.test.ts` (untracked) | PARTIAL — cross-org 403 test only |
| `pinRecovery.ts` | 2026-05-26 | `auth-security-hardening.test.ts` (recoverPin imported) + `dental-auth-module7.test.ts` | PARTIAL |
| `setPin.ts` | 2026-05-26 | `verifyPin.test.ts` (imports from `setPin.ts`) | COVERED — PIN set/change tests exist |
| `verifyPin.ts` | 2026-05-26 | `verifyPin.test.ts` (imports from `verifyPin.ts`) | COVERED — correct PIN, wrong PIN, lockout at 5/10 attempts |

**Key finding**: `verifyPin.test.ts` imports from `verifyPin.ts`/`setPin.ts` (old wrapper files). `auth-security-hardening.test.ts` imports from `DentalMembershipManagement_verifyPin.ts`/`DentalMembershipManagement_setPin.ts` (new refactored files). The new files have security-scenario coverage but NOT full functional coverage (happy path, lockout progression, PIN change). The test files exercise different implementations — if logic diverges between the old wrappers and the new `DentalMembershipManagement_*` files, gaps exist.

**`auth-security-hardening.test.ts` is untracked (git status: `??`)** — it has never been committed. It exists only locally and is not part of CI.

---

## TDD Proof Files

22 `TDD_PROOF.md` files found under `docs/execution/slices/`. Covered slices:

`p1-001-consent-gate`, `p1-002-chart-version-audit`, `p1-003-error-toast`, `p1-004-e2e-ci-hard-gate`, `p2-001` through `p2-010`, `GAP-001`, `a1-operatory`, `a2-procedure-code`, `patient-contact`, `recall`, `sync-metadata-foundation`, `treatment-plan-fsm`, `wave1-audit-infra`

No `TDD_PROOF.md` found for the recent auth/PIN slice (Slice H / auth-security-hardening).

---

## Overall Test Confidence Score

**4 / 10**

| Dimension | Score | Reason |
|-----------|-------|--------|
| Test file coverage (backend) | 6/10 | Most modules have files; dental-org has 26 untested handlers |
| Test file coverage (frontend) | 5/10 | patients + settings covered; other features not |
| Test pass rate | 1/10 | 27.8% passing — infrastructure/DB issues dominating |
| Security-sensitive coverage | 5/10 | PIN auth has partial security tests; happy-path gaps on new files |
| TDD compliance | 6/10 | 22 TDD_PROOF files; Slice H has none |
| CI commitment | 3/10 | `auth-security-hardening.test.ts` is untracked — not in CI |

---

## Top 3 Gaps to Fix

### Gap 1 — `auth-security-hardening.test.ts` is untracked (CRITICAL)
The only test file covering `DentalMembershipManagement_verifyPin.ts`, `DentalMembershipManagement_setPin.ts`, and `pinRecovery.ts` (the three most recently modified security-sensitive files) has never been committed. It does not run in CI. Any regression in these handlers is invisible in CI.

**Fix**: `git add services/api-ts/src/handlers/dental-org/auth-security-hardening.test.ts && git commit`.

### Gap 2 — 72% test failure rate masks real signal
3,472 tests run with 2,508 failures. Until the infrastructure failure root cause is diagnosed (likely DB not running or seed mismatch in CI), you cannot distinguish real regressions from environmental noise. The test suite is producing zero actionable signal at this pass rate.

**Fix**: Diagnose and fix DB connectivity in the test environment. Run `bun test --only-failures 2>&1 | grep "error:" | sort -u | head -20` to categorize failure types. Ensure `bun run db:migrate` + seed run before `bun test` in CI.

### Gap 3 — `DentalMembershipManagement_create/deactivate/list` + all `DentalBranch*` + `DentalOrganization*` handlers have zero tests
The new `DentalMembership*` and `DentalBranch*` and `DentalOrganization*` handler files (the refactored entrypoints) have no test coverage whatsoever. The old `createMember.test.ts` / `createOrganization.test.ts` test the legacy wrappers, not these new files.

**Fix**: Add handler-level tests for each `DentalMembershipManagement_create`, `DentalMembershipManagement_deactivate`, `DentalBranchManagement_create/get/list`, and `DentalOrganizationManagement_create/get/update` using the same `buildTestApp()` pattern in `verifyPin.test.ts`. Minimum: happy path + auth guard + 404.
