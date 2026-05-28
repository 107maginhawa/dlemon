# CI / Test Infrastructure Audit — Module #18

**Date:** 2026-05-26
**Auditor:** Read-only automated audit
**Scope:** CI pipeline (`.github/workflows/`), contract layer (`specs/api/tests/contract/`), E2E journey harness (`apps/dentalemon/tests/e2e/journeys/`), unit test corpus (`services/api-ts/src/`), traceability script, Playwright config, coverage thresholds.
**Primary gate:** Gate 8 (Test Confidence Gap). Secondary: Gate 6 (API Contract Alignment).
**Known prior findings (not re-reported):** CF-13 (E2E `continue-on-error: true`), CF-14 (8/16 journeys BROKEN-expected normalized), CF-33 (Hurl not covering dental endpoints — superseded; dental Hurl files now exist but have a blocking status issue documented below).

---

## Findings Summary

| # | Severity | Gate | Finding | File |
|---|----------|------|---------|------|
| CI-F1 | P1 | G8 | api-ts backend unit tests (182 files) are never run in CI — `quality.yml` only runs `apps/dentalemon` frontend unit tests | `.github/workflows/quality.yml` |
| CI-F2 | P1 | G6 | All 35 Hurl scenarios are `continue-on-error: true` in `contract.yml`, including 10 named as pre-existing failures — the contract gate is fully advisory and never blocks merge | `.github/workflows/contract.yml` |
| CI-F3 | P1 | G8 | `expectedVerdict` comment/code mismatch in 7 of 16 journey specs — comment says "BROKEN (provisional)" but `expectedVerdict: 'PASS'` in code; one inverse case (J11). Journey harness uses the code value for exit-code logic, so comment is actively misleading | `apps/dentalemon/tests/e2e/journeys/*.spec.ts` |
| CI-F4 | P1 | G8 | 10 Hurl scenarios named as known-broken in `contract.yml` include three dental-domain files (`dental-billing`, `dental-pmd`, `dental-visit`) — the contract layer for the most clinically sensitive endpoints is confirmed non-green with no fix timeline | `.github/workflows/contract.yml` |
| CI-F5 | P2 | G8 | `unit-test` CI job runs `bun test --coverage src/` scoped to `apps/dentalemon/src/` only — backend handler tests in `services/api-ts/src/handlers/` are outside scope and generate no coverage artifact | `.github/workflows/quality.yml` |
| CI-F6 | P2 | G8 | Performance ratchet job (`perf-ratchet`) is permanently disabled (`if: false`) pending a staging environment — no P95 latency regression guard exists for any dental endpoint | `.github/workflows/quality.yml` |
| CI-F7 | P2 | G6 | Traceability script (`audit-traceability.ts`) detects BR coverage by mention/tag scan only — `contractFiles` field is populated but the CI gate (`audit:trace:ci`) only checks P0 BR test presence, not whether those tests are passing | `scripts/audit-traceability.ts` |
| CI-F8 | P2 | G8 | Journey harness (`journey-verification` job) runs "14 specs" per CI comment but 16 journey files exist (`01`–`16`) — 2 journeys may be excluded from the authoritative hard-fail gate | `.github/workflows/quality.yml` |
| CI-F9 | P3 | G8 | Security audit step in `contract.yml` is `continue-on-error: true` pending triage of ~35 dev-tool advisories — no tracked deadline; advisory count is not bounded | `.github/workflows/contract.yml` |
| CI-F10 | P3 | G8 | `perf-ratchet` script exists and is version-controlled (`services/api-ts/tests/perf/scenarios/perf.ts`) but the CI job comment lists 3 manual setup steps with no owner or ETA | `.github/workflows/quality.yml` |

---

## Gate-by-Gate Analysis

### Gate 8 — Test Confidence Gap (Primary Gate)

#### Test Pyramid Inventory

| Layer | Count | CI Job | Blocking? |
|-------|-------|--------|-----------|
| Frontend unit (apps/dentalemon) | Bun test, `src/` scope | `unit-test` | Yes — 75% line/function, 60% branch threshold via `bunfig.toml` |
| Backend unit (services/api-ts) | 182 `.test.ts` files | **NOT RUN** | No CI job covers this |
| Contract (Hurl, 35 files) | 35 `.hurl` files | `contract` | No — `continue-on-error: true` on Hurl step |
| E2E flat specs (apps/dentalemon) | ~52 `.spec.ts` files | `e2e` | No — `continue-on-error: true` (CF-13) |
| E2E journey harness (16 specs) | 16 journey `.spec.ts` | `journey-verification` | Yes — `computeExitCode` exits 1 on PASS-expected regressions |

#### CI-F1 — Backend Unit Tests Never Run (P1)

The `unit-test` job in `quality.yml` runs:
```
cd apps/dentalemon && bun test --coverage src/
```

This scope covers only the React frontend. The 182 backend test files under `services/api-ts/src/` (covering handlers, repos, jobs, core, and db layers) are not executed by any CI job. No coverage artifact is produced for the backend. A backend regression in any dental handler, repo, or job will not fail CI.

The `contract` workflow does boot `api-ts` and run Hurl against it — but with `continue-on-error: true`, so even a completely broken boot would not block merge (though the `/livez` healthcheck would catch a total boot failure).

#### CI-F3 — Journey `expectedVerdict` Comment/Code Mismatch (P1)

7 of 16 journey specs have a divergence between the prose comment and the `expectedVerdict` code value:

| Journey | Comment says | Code says | Risk |
|---------|-------------|-----------|------|
| J01 new-patient-exam | BROKEN (provisional) | PASS | CI will hard-fail if J01 breaks |
| J02 periodic-recall | BROKEN (provisional) | PASS | CI will hard-fail if J02 breaks |
| J05 status-integrity | BROKEN | PASS | CI will hard-fail if J05 breaks |
| J08 informed-refusal | BROKEN (provisional) | PASS | CI will hard-fail if J08 breaks |
| J09 plan-versioning | BROKEN (provisional) | PASS | CI will hard-fail if J09 breaks |
| J10 void-amend-audit | BROKEN | PASS | CI will hard-fail if J10 breaks |
| J11 ceph-tier-gate | PASS (provisional) | BROKEN | CI will NOT fail if J11 regresses |

The `computeExitCode` function uses `expectedVerdict` from code, not comments. Comments reading "BROKEN (provisional)" were written when the journey was not yet implemented but the code was already set to PASS — likely reflecting optimism about imminent fixes. J11 is the inverse: the comment was updated to reflect a known gap but the code was not updated, so a regression in ceph tier-gating is silently absorbed by CI.

#### CI-F8 — Journey Count Mismatch (P2)

The `journey-verification` job comment says "14 specs" but `ls journeys/` shows 16 files (`01`–`16`). The discrepancy suggests J15 and/or J16 were added after the comment was written and may not be in the harness run list. If the external `run-journey-harness.ts` script has a hard-coded list or glob that misses two specs, those journeys have no blocking CI coverage.

#### Coverage Thresholds

`apps/dentalemon/bunfig.toml` enforces:
- Line coverage: 75%
- Function coverage: 75%
- Branch coverage: 60%

These thresholds apply to frontend unit tests only. No threshold is enforced for backend.

---

### Gate 6 — API Contract Alignment

#### CI-F2 — All Hurl Scenarios Advisory (P1)

In `contract.yml`, the Hurl execution step has:
```yaml
- name: Hurl contract scenarios
  continue-on-error: true
```

This applies to all 35 Hurl files, including the dental-specific ones. The justification is "pre-existing failures" on 10 named files, but the `continue-on-error` flag is on the single step that runs all files — not just the failing ones. Even if all pre-existing failures were fixed, the flag would need to be explicitly removed to restore blocking behaviour.

The 10 named pre-existing failures are:
`audit-side-effects`, `auth-password-reset`, `auth-verification`, `billing-lifecycle`, `dental-billing`, `dental-pmd`, `dental-visit`, `email`, `expand`, `expand-edge`

Three of these (`dental-billing`, `dental-pmd`, `dental-visit`) cover the most clinically sensitive dental workflows. No fix milestone or issue link is tracked in the workflow file (reference is to a closed/placeholder GitHub URL pattern).

#### Hurl Coverage of Dental Endpoints

Prior finding CF-33 ("Hurl not covering dental endpoints") is now partially resolved. Eight dental-specific Hurl files exist:

| File | Coverage scope |
|------|---------------|
| `dental-billing.hurl` | Dental billing workflows |
| `dental-clinical.hurl` | Prescriptions, consent, attachments, lab orders, amendments |
| `dental-imaging.hurl` | Imaging + cephalometric analysis full chain (signup → org → branch → member → study → image → landmarks → report) |
| `dental-org.hurl` | Org/branch/membership CRUD |
| `dental-patient.hurl` | Patient create/list/get/update/archive/restore/import/export/safety-floor/statement |
| `dental-pmd.hurl` | PMD generate/get/list/import/export |
| `dental-scheduling.hurl` | Scheduling workflows |
| `dental-visit.hurl` | Visit lifecycle |

Coverage breadth is good. However, three of these eight files (`dental-billing`, `dental-pmd`, `dental-visit`) are named as pre-existing failures in CI, so their scenarios are not currently green. The Hurl files exist but their contract assertions are not enforced.

#### Schemathesis

The `contract.yml` also installs Schemathesis (`pipx install schemathesis`) but no Schemathesis run step is visible in the workflow output. This may be an incomplete integration (tool installed but not wired to a step), or the step was removed after the comment referencing it was written.

#### Traceability (CI-F7)

`scripts/audit-traceability.ts` is a well-structured tool that:
1. Parses BRs from `docs/prd/BUSINESS_RULES.md`
2. Scans test files for `@BR-NNN` mention tags
3. Classifies P0 BRs: `BR-002`, `BR-003`, `BR-014`, `BR-015`, `BR-016`, `BR-019`, `BR-026`
4. CI gate (`audit:trace:ci`) exits 1 if any P0 BR has zero test file mentions

The weakness: the gate verifies BR *mentions* in test files, not that the associated tests are passing. A test file can `@BR-019` in a comment of a `test.skip()` block and the CI gate passes. Combined with the Hurl `continue-on-error` flag, a P0 BR covered only by a failing Hurl test would still pass the traceability gate.

---

## Critical Issues Detail

### CI-F1 — Backend Unit Tests Never Run

182 backend test files in `services/api-ts/src/` cover handlers, repos, jobs, core utilities, and DB audit wiring. None of these run in CI. The `unit-test` job in `quality.yml` is scoped exclusively to `apps/dentalemon/src/`. There is no separate `api-ts-test` job.

**Fix:** Add a job to `quality.yml`:
```yaml
api-unit-test:
  name: API Unit Tests
  runs-on: ubuntu-latest
  timeout-minutes: 15
  services:
    postgres: ...  # same as journey-verification
  steps:
    - run: cd services/api-ts && bun test --coverage
```

### CI-F2 — Contract Gate Fully Advisory

The single `continue-on-error: true` on the Hurl step means no contract failure can block a merge. Even when all 10 pre-existing failures are resolved, the flag must be removed explicitly. There is no tracking item in the workflow file with a target date.

**Fix:** Run known-broken files with `--continue-on-error` individually (via a skip list in `run-contract-tests.ts`) and remove the blanket flag from the CI step. Files not in the skip list should be blocking.

### CI-F3 — Journey Spec Comment/Code Mismatch

7 specs have `expectedVerdict` code diverging from prose comments. This creates two risks:
1. Journeys believed to be "provisional / BROKEN" by developers will hard-fail CI if they actually break (J01, J02, J05, J08, J09, J10).
2. J11 (`ceph-tier-gate`) has a BROKEN code value but comment says PASS — a regression in ceph tier gating is silently tolerated.

**Fix:** Audit and synchronize comment and code for all 16 specs. The code value is authoritative; comments must match.

---

## Overall Confidence Score: 5 / 10

**Rationale:**

The CI infrastructure shows genuine sophistication: the `journey-verification` job is well-designed (real Postgres, real api-ts, seed, hard-fail on PASS-expected regressions), the traceability gate is automated with P0/P1 priority tiers, Hurl contract coverage now exists for all dental domains, and frontend unit tests have enforced thresholds. These are strong foundations.

However, three structural gaps significantly erode confidence:

1. **No backend unit test coverage in CI** (CI-F1): 182 backend test files are written but never executed by any CI job. A broken repo, handler, or job goes undetected until a contract test or journey fails — and both of those gates are advisory.

2. **Contract gate is fully advisory** (CI-F2): All 35 Hurl scenarios run `continue-on-error: true`. Three dental-domain files are confirmed failing. The contract layer provides visibility but zero enforcement.

3. **Journey verdict state is incoherent** (CI-F3): 7 of 16 journey specs have mismatched comment vs code verdicts, including J11 where a ceph regression would be silently absorbed.

The combination of (1) and (2) means that a backend change can break dental billing, PMD generation, or visit lifecycle — and no blocking CI job would catch it until a human runs `bun test` locally or the manual TRACEABILITY_MATRIX is checked.

Scoring breakdown:
- Pipeline completeness: 6/10 (7 blocking jobs, but missing backend unit gate)
- Contract coverage: 5/10 (files exist, all advisory, 3 dental files failing)
- E2E/journey coverage: 6/10 (hard-fail gate exists, verdict state partially inconsistent)
- Traceability: 7/10 (automated, P0-scoped, but mention-only detection)
- Test pyramid health: 4/10 (backend layer has 0 CI enforcement)

**Overall: 5/10**
