# Confidence Stack Report — dental-patient

**Date:** 2026-05-30
**Team size:** small
**Scope:** module `dental-patient` (`services/api-ts/src/handlers/dental-patient`, 69 files)
**Layers audited:** 1-4 (static analysis) + TDD-proof git-history verification
**Layers deferred:** 5-6 (require CI/CD/runtime evidence)
**Prior audits used:** `docs/audits/compliance/dental-patient.md` (behavior inventory — NOT shallow extraction)
**Knowledge graph:** aligned to `docs/audits/codebase-map/` (CODE_MODULE_MAP confirms 69 files, framework `hono`, confidence MEDIUM)

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 8/10 (7 base +1 TDD bonus) | Good — critical behaviors covered with real-DB, meaningful assertions | Sub-feature READ permission gates not deny/allow-paired; create-role granularity (V-PAT-002) untested |
| 2. Behavior Traceability | 7/10 | Good — every core BR/AC/state-transition has a test owner | V-PAT-002 (staff_scheduling create-deny) has NO test owner; DE-008 consumer path untested |
| 3. Test Quality Hardening | 9/10 | Strong — real Postgres, no mocks, no skips, specific-value assertions | A handful of `toBeDefined()` existence checks; brittle seeded UUID namespaces (acceptable) |
| 4. Release Gate Readiness | 7/10 | Good — CI runs unit+typecheck+lint+contract+drift+security-audit | No migration rollback/down files; no migration dry-run gate |

**Overall Test-Confidence (min L1-L3):** 7/10 — headline test-quality signal
**Release-Readiness (L4):** 7/10 — separate release-infra gauge
**Ship-Readiness (min L1-L4):** 7/10 — conservative combined gate
**Average Score:** 7.75/10

## Cross-Layer Consistency
No inconsistencies. L1(8) − L2(7) = 1 (≤3, fine). L3(9) does not exceed L1/L2 by >4. L4(7) in line with the rest. The L3=9 / L2=7 gap (2) is the expected "tests are high quality but a few behaviors lack an owner" signal — specifically the V-PAT-002 create-role-deny path.

## Per-Module Breakdown

| Module | L1 | L2 | L3 | L4 | Overall (min L1-L3) | Priority Gaps |
|--------|----|----|----|----|---------------------|---------------|
| dental-patient | 8 | 7 | 9 | 7 | 7 | V-PAT-002 create-deny test; READ deny/allow pairs; migration rollback |

## Layer 1: Coverage Integrity Detail

### "Covered" Definition Per Rule Class
| Rule Class | Meaningful Coverage Requires | Items (approx) | Covered | Line-Only | None | Weight |
|------------|------------------------------|----------------|---------|-----------|------|--------|
| Auth/permissions | deny AND allow per gate | ~14 gates | ~11 | 0 | ~3 | 35% |
| Business rules | assertion on business outcome | ~30 (BR + AC) | ~28 | 0 | ~2 | 30% |
| State transitions | guard + happy-path test | 5 FSMs (recall, task, treatment-plan, claim, sync-log) | 5 | 0 | 0 | 20% |
| API routes | status + body shape | ~40 endpoints | ~34 | 0 | ~6 | 15% |

State-transition coverage is the strongest dimension: all five FSMs have both happy-path AND invalid-transition (422) tests, plus terminal-state rejection. Auth is strong on the core surface (deny+allow pairs for archive/restore/export/bulk-archive owner gate, branchless deny across 3 paths) but weaker on sub-feature READ gates which only test 401 (unauthenticated), not 403 (wrong-role member).

### TDD git-history adjustment
All 7 sub-feature slices show test-file-add commit BEFORE impl-file-add commit (100% test-first — see TDD Proof Verification). ≥80% → **+1 bonus applied** (7 base → 8, capped at 10).

### Weight Redistribution
None — all four rule classes present.

## Layer 2: Behavior Traceability Detail

Behavior inventory taken from `docs/audits/compliance/dental-patient.md` (authoritative — not shallow). Every core-surface spec item in that report maps to a test owner:

| BR/AC | Rule | Test File | Assertion Quality |
|-------|------|-----------|-------------------|
| BR-015 / AC-PAT-001 consent → 422 | dental-patient.test.ts (EF-PAT-002), createDentalPatient.test.ts (FR2.20) | STRONG (`code === 'CONSENT_REQUIRED'`) |
| BR-015b archived read-only → 403 | dental-patient.test.ts (EF-PAT-001 — update/note/recall) | STRONG (`code === 'PATIENT_ARCHIVED'`) |
| BR-015c follow-up append-only | dental-patient.test.ts (FR2.12) | STRONG (no PATCH/DELETE route exercised) |
| AC-PAT-003 safety-floor aggregation | dental-patient.test.ts (FR2.15), dental-patient-records.test.ts (AC-PAT-003 counts) | STRONG (2 allergies + 1 medication) |
| AC-PAT-004 search branch-scoped | dental-patient.test.ts (EM-PAT-004, AC-PAT-004 same-name isolation) | STRONG (cross-branch isolation) |
| State active↔archived owner-gated | dental-patient.test.ts (EM-PAT-001/002/003) | STRONG (403 hygienist / 200 owner) |
| V-PAT-002 branchless DENY | dental-patient-branchless-auth.test.ts (3 paths) | STRONG (403 on read + write) |
| V-PAT-009 already-archived → 409 | dental-patient.test.ts | STRONG (`code === 'PATIENT_ALREADY_ARCHIVED'`) |
| V-PAT-014 no PII leak | dental-patient-records.test.ts (contactInfo/primaryAddress undefined) | STRONG |
| AUDIT archive/export records | dental-patient.test.ts (AL, AL-006) | STRONG (queries DentalAuditRepository, asserts action/resourceType/PHI-safe metadata) |
| Import all-or-nothing tx | dental-patient.bulk-import.test.ts | STRONG |
| 5 FSMs (recall/task/treatment-plan/claim/sync) | recall/tasks/treatment-plan/insurance/sync test files | STRONG (happy + 422 invalid + terminal) |

### Permission Gate Coverage
| Gate | Deny Test? | Allow Test? | Test File |
|------|-----------|-------------|-----------|
| Archive = dentist_owner | YES (403 hygienist) | YES (200 owner) | dental-patient.test.ts |
| Restore = dentist_owner | YES (EM-PAT-003) | YES | dental-patient.test.ts |
| Bulk-archive = dentist_owner | YES (EM-PAT-002) | YES | dental-patient.test.ts |
| Export = dentist_owner | YES (EM-PAT-001) | YES | dental-patient.test.ts |
| Branchless patient = DENY all | YES (3 paths) | n/a | dental-patient-branchless-auth.test.ts |
| **Create = deny staff_scheduling** | **NO** | partial (staff_full 201) | — (untraced) |
| Sub-feature READ wrong-role 403 | NO (only 401) | YES | contacts/recall/task/etc. |

### Untraced Behaviors
- **V-PAT-002 (P1 from compliance):** `createDentalPatient` uses `assertBranchAccess` (membership, role-agnostic) where the matrix denies `staff_scheduling`. There is NO test asserting a `staff_scheduling` member gets 403 on create — the gap that the compliance audit flagged is also a test gap.
- **DE-008 InvoicePaid consumer:** `has_active_payment_plan` sync path has no test owner in this module (likely lives in dental-billing).

## Layer 3: Test Quality Detail

### Assertion Audit (14 files, ~616 expect() calls)
Specific-value status assertions dominate: **226** typed status-code assertions across 200(85)/201(35)/401(28)/400(25)/404(22)/422(16)/403(10)/409(2)/204(1). Plus extensive `code === '...'` and field-value `toBe(...)` checks. Weak `toBeDefined/toBeTruthy/toBeFalsy` occurrences are low (mostly id-existence checks paired with adjacent strong assertions); `dental-patient-records.test.ts` has the most (14) but they accompany strong status/value checks.

| Signal | Result |
|--------|--------|
| STRONG assertion ratio | High (~90%+ of meaningful assertions are specific values/codes) |
| Snapshot-only tests | NONE |
| `expect(true)` placeholders | NONE |

### Mock Audit
**NO mocks** (`jest.mock`/`spyOn`/`vi.mock`) anywhere in dental-patient tests. Every test runs against a real Postgres test DB (`createDatabase(... monobase_test)`) — aligns with the project anti-over-mocking standard. The CI harness (`scripts/test-with-db.ts`) clones a per-file migrated template DB, so tests can't contaminate each other.

### Flake Report
NONE. No `.skip`, `.todo`, `xit`, `xdescribe`, `jest.retryTimes`, or sleep/setTimeout flake markers.

### Data Stability
SEEDED. Every file uses `beforeAll` to insert org/branch/membership/person/patient with `onConflictDoNothing`/`onConflictDoUpdate`, and `afterEach` truncates/deletes. UUIDs are file-namespaced constants (e.g. `d9...`, `a033`) deliberately disjoint to avoid cross-file `beforeAll` races (a documented EF-PAT-004 fix). This is intentional seeding, not brittleness.

## Layer 4: Release Gate Readiness Detail

### CI Pipeline Check (`.github/workflows/`)
| Check | Status |
|-------|--------|
| CI config found | YES (contract, openapi-drift, postgres-services, quality, release) |
| Test step | PRESENT (quality.yml unit-test + coverage; postgres-services.yml api-unit-tests w/ real Postgres) |
| Lint step | PRESENT (quality.yml lint) |
| Type check step | PRESENT (quality.yml + postgres-services.yml typecheck) |
| Build step | PRESENT (quality.yml build; release.yml) |
| Security scan step | PRESENT (`bun audit` in contract.yml) |

### Migration Safety
| Check | Status |
|-------|--------|
| Migration files found | YES (76 SQL migrations) |
| Rollback/down files | NO (Drizzle forward-only; migrations auto-run on server start) |
| CI dry-run | PARTIAL (contract.yml `git diff --exit-code src/generated/migrations` = drift gate, not a dry-run apply) |

### Version Management
| Check | Status |
|-------|--------|
| Version file | YES (VERSION + package.json) |
| CHANGELOG.md | YES |
| Release workflow | YES (release.yml) |

### Health Check Endpoint
| Check | Status |
|-------|--------|
| Health endpoint found | YES (`src/core/health.ts`, wired in `app.ts`) |
| Dependency depth | DEEP (core/health.ts present; assumed DB check) |

## TDD Proof Verification

| Slice | Claimed Tests | Test File Exists | Test-First (git) | Fabrication |
|-------|---------------|------------------|------------------|-------------|
| fix-dental-patient-p0 | 53 pass / 0 fail (dental-patient.test.ts) | YES (1305 lines, 165 expects) | n/a (fix on existing file) | NO |
| patient-contact (P0-A) | 14/14 | YES (dental-patient-contacts.test.ts) | YES (test 05-25 < impl 05-28) | NO |
| recall (P0-B) | 12/12 | YES (dental-patient-recall.test.ts) | YES (test ad530ae 05-25 < impl 886eafd 05-28) | NO |
| treatment-plan-fsm (P0-C) | covered | YES | YES (test 41fd9b0 05-25 < impl ea55238 05-28) | NO |
| sync-metadata-foundation (P0-D) | covered | YES | YES (test aba9d73 05-25 < impl 5a7f03f 05-28) | NO |
| P2-001 alerts | 10 ACs/BRs | YES | YES (test 1efab9d 05-26 < impl 379db69 05-28) | NO |
| P2-003 tasks | covered | YES | YES (test 02972a6 05-26 < impl db54a57 05-28) | NO |
| insurance (B2) | covered | YES | YES (test f77f6dc 05-26 < impl 1c65fd0 05-28) | NO |

**Git-history compliance:** 7/7 sub-feature slices with test-first commit ordering (100%).
**Proof validity:** all referenced test files exist on disk; assertion counts meet/exceed claims (e.g. recall proof claims 12, file has 34 expects across ≥18 test cases).
**Score adjustments:** Layer 1 +1 bonus (≥80% test-first). Layer 2 +1 candidate withheld (kept at 7 because V-PAT-002 deny path remains untraced — not all behaviors valid-and-owned).
**Fabrication detected:** NO.

> Note on commit clustering: test-add commits are 05-25/05-26 and impl-add commits cluster on 05-28. This reflects a RED-batch then GREEN-batch cadence (consistent with the oli-execution-gate timestamps in each TDD_PROOF). Ordering is unambiguously test-before-impl in every case; no `feat`-before-`test` violation found.

## Unauditable Items

| Item | Reason | Manual Check Needed |
|------|--------|---------------------|
| Frontend tests for patient UI | Frontend lives in apps/dentalemon; no patient-specific unit tests located in this run | Verify apps/dentalemon patient component/hook tests |
| Health-check dependency depth | Endpoint exists; runtime DB-check depth not executed | Hit /health and inspect payload |
| Coverage % (line) | No committed coverage report; CI computes it ephemerally | Run `bun test --coverage` |

## Prioritized Action Plan

### P0 — Fix Now
None. No P0 confidence gaps; no fabrication; all core behaviors traced.

### P1 — Fix Before Major New Work
- **CONF-DP-001:** Add a test asserting `staff_scheduling` (branch member, wrong role) gets **403 on POST /dental/patients** — pins the V-PAT-002 create-role gap so the compliance fix (assertBranchAccess → assertBranchRole) is regression-guarded. File: `dental-patient.test.ts` near the EM-PAT-002 block. (createDentalPatient.ts:45)
- **CONF-DP-002:** Add wrong-role 403 (deny) tests for sub-feature READ endpoints (contacts/recalls/tasks/alerts/insurance GET) — currently only 401-unauthenticated is tested, leaving the role-deny half of each gate untraced.

### P2 — Fix When Touching Module
- **CONF-DP-003:** Add/locate a test for the DE-008 `has_active_payment_plan` consumer path (EC1 archive-block depends on it; currently the flag is set directly in tests via `db.update`, never via the real event consumer).
- **CONF-DP-004:** Trim low-value `toBeDefined()` existence checks in dental-patient-records.test.ts where a specific-value assertion is feasible.

### P3 — Track
- **CONF-DP-005:** No migration rollback/down files (Drizzle forward-only). Consider a CI migration dry-run apply (not just drift diff) for release safety.

## What's Next
- Fix CONF-DP-001/002 → re-run `/oli-check --confidence --module dental-patient --layer 2`
- The single P1 from the compliance audit (V-PAT-002) and the matching test gap (CONF-DP-001) should be fixed together.
- Test-confidence here is genuinely high (real-DB integration tests, strong assertions, verified test-first); the gating items are deny-path permission tests, not test-quality defects.
