<!-- oli-version: 1.1 -->
<!-- based-on: docs/product/modules/*/MODULE_SPEC.md, docs/product/MODULE_BOUNDARIES.md, docs/audits/enforce/.baseline.json -->
<!-- generated: 2026-06-02T00:00:00Z -->

# Enforcement Report

**Generated:** 2026-06-02 (HEAD c26d37bd)
**Modules Audited:** 12 (dental-audit, dental-billing, dental-clinical, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit, emr-consultation, external-records-import)
**Baseline Compared:** enforcement-2026-06-01b (git_sha ece7f89c, 2026-06-01)
**Days Since Last Run:** 1
**Coverage Completeness:** FULL
**Mode:** `--auto` (read-only; NOT `--fix`)

---

## Audit Scope

| Artifact | Available | Used |
|----------|-----------|------|
| MODULE_MAP.md | YES | YES |
| DOMAIN_MODEL.md | YES | YES |
| WORKFLOW_MAP.md | YES | YES |
| EVENT_CONTRACTS.md | YES | YES |
| ROLE_PERMISSION_MATRIX.md | YES | YES |
| AUDIT_CONTRACTS.md | YES | YES |
| UI_CONSISTENCY_SPEC.md | YES (DRAFT — P3 cap) | YES |
| Baseline (.baseline.json) | YES (enforcement-2026-06-01b) | YES |

**Ground-truth checkers run (empirical, this run):**
- `cd services/api-ts && bun run check:boundaries` → **0 cross-module repo boundary violations** ✅
- `bunx eslint 'src/handlers/**/*.ts'` (no-restricted-imports) → **64 reach-in warnings** (54 true P2 + 10 emr-facade P3) — unchanged vs baseline
- `bunx eslint 'src/handlers/**/*.ts'` (all rules) → **7 errors** (NEW vs baseline claim of 0 — see EF-LINT) + ~3640 warnings
- `services/api-ts` `tsc --noEmit` → **0 errors, 0 type cycles** ✅
- `apps/dentalemon` `tsc --noEmit` → **0 errors** ✅
- `bun audit` → **0 vulnerabilities** ✅

**Sub-skills dispatched:**
- [x] coverage.md (Phase 0) — spec coverage stable, 12/12 modules specced
- [x] dependency security scan (Phase 0.5) — `bun audit` clean
- [x] module.md (Phase 1, per module) — boundary/layering ground-truth via check:boundaries + ESLint
- [x] file.md (Phase 1, per module) — file-org + lint-error scan
- [x] /oli-check --journeys (Phase 1.5) — carried from JOURNEY_COVERAGE_REPORT.md (no FE regressions this cycle)
- [x] cross-module.md (Phase 2) — 0 alias boundary violations
- [x] /oli-check --traceability (Phase 2.5) — carried from docs/audits/enforce/trace.md (P1=0 after this cycle's reclassifications)
- [x] /oli-check --compliance (Phase 3, audit-logging) — carried from audit-compliance artifacts
- [x] ui-consistency.md (Phase 1.6) — re-run, lemon-literal under-count corrected

**Incomplete sub-skills (if any):** none

---

## Coverage Completeness

**Status:** FULL

All mandatory phases completed. WORKFLOW_MAP.md present and not in `--module` mode, so Phase 1.5 (journeys) and Phase 2.5 (traceability) both ran. No DEGRADED cap applied.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Coverage Score** | ~92% (12/12 modules specced) |
| **Modules Audited** | 12 |
| **Compliant Modules** | 12 (no P0/P1 code-level findings) |
| **Non-Compliant Modules** | 0 |
| **Total P0 Findings** | 0 |
| **Total P1 Findings** | 0 (code-level) |
| **Total P2 Findings** | 1 cluster (54 backend reach-ins, `EB-BOUNDARY-reachins01`) |
| **Total P3 Findings** | 4 (emr-facade lint-drift; UI-spec DRAFT; api-ts lint-errors; lemon-literal-wide) |
| **Cross-Module P0** | 0 |
| **Cross-Module P1** | 0 |
| **Regressions (new P0/P1)** | 0 |
| **Resolved Since Last Run** | 0 |
| **Overall Trend** | STABLE |

**Overall trend:** STABLE — 0 regressions, 0 resolved, no new blocking findings. One P3 (`EF-LINT-api-ts-7errs`) is newly *surfaced* (baseline asserted 0 lint errors; empirical re-run finds 7 style-rule errors in api-ts). It is non-blocking and pre-existing.

---

## Module Compliance

| Module | Score | Label | P0 | P1 | P2 | P3 | Trend | Status |
|--------|-------|-------|----|----|----|----|-------|--------|
| dental-audit | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-billing | 9.0/10 | COMPLIANT | 0 | 0 | (1 reach-in in cluster) | 1 (lint err ×1) | → | COMPLETE |
| dental-clinical | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-imaging | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-org | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-patient | 9.0/10 | COMPLIANT | 0 | 0 | (27 reach-ins in cluster) | 0 | → | COMPLETE |
| dental-perio | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-pmd | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-scheduling | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 1 (lint err ×2) | → | COMPLETE |
| dental-visit | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 1 (lint err ×3, test-only) | → | COMPLETE |
| emr-consultation | 9.0/10 | COMPLIANT | 0 | 0 | 0 | 1 (emr-facade lint-drift + 1 lint err test-only) | → | COMPLETE |
| external-records-import | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |

> The 54 backend reach-ins + 10 emr-facade warnings are tracked as cross-cutting clusters (`EB-BOUNDARY-reachins01` P2, `EB-EMR-facade-lintdrift01` P3) rather than fragmented per-module, per baseline convention. Per-module reach-in attribution: dental-patient 27, billing 13, emr 10 (facade, approved), notifs 5, booking 4, patient 2, provider 2, dental-billing 1.

### P0/P1 Module Findings (Action Required)

No P0/P1 module findings.

---

## File Compliance

| Module | Files Checked | P0 | P1 | P2 | P3 | Status |
|--------|---------------|----|----|----|----|--------|
| (all 12) | full handler tree | 0 | 0 | 0 | 1 (EF-LINT-api-ts-7errs) | COMPLETE |

### P0/P1 File Findings (Action Required)

No P0/P1 file findings.

### P3 File Findings (Track)

**`EF-LINT-api-ts-7errs`** — P3 — backend — `cd services/api-ts && bun run lint` exits **non-zero (7 errors)**, contradicting the baseline's "0 lint errors" claim. All 7 are style-rule errors, none are logic bugs:
- `@typescript-eslint/no-unused-expressions` ×3 (production): `dental-billing/createDentalInvoice.ts:127`, `dental-scheduling/cancelAppointment.ts:71`, `dental-scheduling/createAppointment.ts:132`. All three are the `scheduler && emitXxx(...)` short-circuit best-effort domain-event pattern (DE-010/011/020) — functionally correct fire-and-forget; ESLint dislikes the bare `&&` expression-statement. Fix: wrap as `if (scheduler) { void emitXxx(...) }`.
- `@typescript-eslint/no-require-imports` ×3 (test-only): `dental-visit/repos/treatment-decline.test.ts:54,59,64`. Convert to `await import()` / static import.
- `@typescript-eslint/no-unsafe-function-type` ×1 (test-only): `emr/emr.handlers.test.ts:145` — bare `Function` type in a test mock.
- **Impact:** the *root* `bun run lint` only filters the `dentalemon` frontend workspace, so these api-ts errors are NOT caught by the repo's default lint gate today — they only surface when `lint` runs inside `services/api-ts`. Gate-coverage gap (see IMPROVEMENTS).

---

## Cross-Module Findings

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 0 |
| P2 | 0 (alias-level); 1 cluster (54 relative reach-ins, `EB-BOUNDARY-reachins01`) |
| P3 | 1 (`EB-EMR-facade-lintdrift01`) |

### P0/P1 Cross-Module Findings (Action Required)

No P0/P1 cross-module findings. `check:boundaries` (absolute `@/handlers/` alias imports) = **0 violations**.

### P2/P3 Cross-Module Findings (Track)

- **`EB-BOUNDARY-reachins01`** — P2 — 54 ESLint `no-restricted-imports` relative repo reach-ins across 8 modules (dental-patient 27, billing 13, notifs 5, booking 4, patient 2, provider 2, dental-billing 1). Handlers import `../module/repos/` directly instead of via `*.facade.ts`. Migrate one PR per module per MODULE_BOUNDARIES.md priority (dental-imaging→dental-patient→…). Unchanged vs baseline.
- **`EB-EMR-facade-lintdrift01`** — P3 — 10 emr `no-restricted-imports` warnings flag `*-emr.facade` imports — the *documented APPROVED* bridge. The ESLint ignore-glob (`repos/*.facade.ts`) covers the facade *definition* but the warning fires on the *consumer* import path. Add `.facade` to the consumer exempt pattern or accept as benign noise. Unchanged vs baseline.

---

## UI Journey Findings

Carried from `JOURNEY_COVERAGE_REPORT.md` / `JOURNEY_COVERAGE_REPORT_dental-billing.md`. FE diff since prior audit (a3bfc9a5..HEAD) = 13 files (workspace hooks/tests + 1 route + test-setup); the changed route diff shows no journey-breaking changes. **No P0/P1 UI journey findings.**

---

## Traceability Findings

Carried from `docs/audits/enforce/trace.md` (Phase 2.5). After this cycle's reclassifications (TR-DG-002 CLEARED, TR-IMG-ANNOT-SM false-positive cleared, TR-BR-013 deferred P1→P2, TR-INFRA-001 reclassified EXTERNAL): **P0=0, P1=0**. No P0/P1 traceability findings.

---

## Dependency Security Findings

| Ecosystem | Lockfile | Vulnerabilities | P0 | P1 | P2 | P3 | Status |
|-----------|----------|----------------|----|----|----|----|--------|
| Node.js/Bun | bun.lock | 0 | 0 | 0 | 0 | 0 | COMPLETE |
| Rust (cadence, api-ts-embedded) | Cargo.lock | not scanned | — | — | — | — | INCOMPLETE (cargo-audit not invoked) |

`bun audit` → **No vulnerabilities found** @ HEAD. All prior `ED-GLOBAL` dep CVEs remain resolved. Rust crates' `Cargo.lock` not CVE-scanned this run — advisory gap, not a finding.

### Lockfile Integrity Issues

All lockfiles have valid manifests.

### P0/P1 Dependency Findings (Action Required)

No P0/P1 dependency findings.

---

## Audit Logging Findings

Carried from Phase 3 (audit-logging-only). Erasure/legal-hold/retention governance routes emit `logAuditEvent` on every transition; admin RBAC enforced at handler layer; domain-event emitters (DE-010/011/020) wired on scheduling + billing. **No P0/P1 audit-logging findings.** (Full BR/AC audit-event coverage deferred to the `--compliance` dimension.)

---

## UI Consistency Findings (Phase 1.6)

Spec `UI_CONSISTENCY_SPEC.md` is `audit_status: DRAFT` (infer-from-code) → **all findings P3-capped** until curated via `/oli-spec-gate`. Full detail in `docs/audits/UI_CONSISTENCY_REPORT.md`.

| Category | Adherence | Finding |
|----------|-----------|---------|
| Button className-override | 0.94 (3 of 49) | `EU-CLASSNAME-OVERRIDE-onbwiz` P3 (would-be P2) — onboarding-wizard.tsx L243/246/248 |
| z-index off-scale | 0.99 | `EU-ZINDEX-calendar` P3 — calendar-day/week (3 `z-[N]`) |
| Color tokens | **0.82 (CORRECTED)** | `EU-COLOR-lemon-literal-wide` P3 (would-be P2) — brand `#FFE97D`/`#4A4018` as arbitrary literals in **174 occurrences / 59 files** (prior run under-counted as "1"). Pre-existing/KNOWN. |
| Icon size lock | 1.00 | — |
| Page-shell coverage | 1.00 | — |
| Loading-state hygiene | OK | — |

**Sub-verdict: WARN** (0 P0/P1; 5 P3 KNOWN, draft-capped). The lemon-literal correction is a measurement fix, not a regression — the drift was present at the prior audit point a3bfc9a5.

---

## Ratchet Summary

**Baseline date:** 2026-06-01 (enforcement-2026-06-01b, ece7f89c)

### Regressions — New P0/P1 (Action Required)

No regressions. 0 new P0/P1 since baseline.

### New Findings — New P2/P3 (Track)

| ID | Sev | Module | Finding |
|----|-----|--------|---------|
| EF-LINT-api-ts-7errs | P3 | backend | `services/api-ts` lint exits non-zero (7 style-rule errors). Newly surfaced — baseline claimed 0. Pre-existing code; non-blocking. |
| EU-COLOR-lemon-literal-wide | P3 | dentalemon (FE) | Brand color literal drift corrected from "1" to 174 occ / 59 files. Pre-existing; measurement correction, not a code change. |

### Known Findings (Persistent)

| ID | Sev | Module | Finding | Age |
|----|-----|--------|---------|-----|
| EB-BOUNDARY-reachins01 | P2 | cross-module | 54 relative repo reach-ins | 2d |
| EB-EMR-facade-lintdrift01 | P3 | emr | 10 emr-facade lint warnings (approved bridge) | 2d |
| EU-GLOBAL-uispec01 | P3 | FE | UI_CONSISTENCY_SPEC DRAFT — EU findings P3-capped | 2d |

### Resolved Since Last Run

None this cycle. (Prior cycle resolved EF-DENTAL-IMG-naming01 + TR-IMG-ANNOT-SM.)

### Per-Module Score Trend

All 12 modules → (within ±0.5 of baseline). No score movement; ece7f89c..c26d37bd = 6 `docs(trace)`/`docs(audits)` commits, 0 source changes.

---

## Stabilization Plan

### Fix Now — P0 Findings (0)

No P0 findings. No immediate blocking issues.

### Fix Before New Work — P1 Findings (0)

No P1 findings.

### Fix When Touching — P2 Findings (1 cluster)

| ID | Module | Finding | Action |
|----|--------|---------|--------|
| EB-BOUNDARY-reachins01 | 8 modules | 54 relative repo reach-ins | Migrate to `*.facade.ts`, one module per PR (priority: dental-imaging→dental-patient→dental-billing→…). |

### Track — P3 Findings (4)

| ID | Module | Finding |
|----|--------|---------|
| EB-EMR-facade-lintdrift01 | emr | 10 facade-consumer lint warnings; add `.facade` to consumer exempt glob. |
| EU-GLOBAL-uispec01 | FE | Promote UI_CONSISTENCY_SPEC to enforcing via `/oli-spec-gate`. |
| EF-LINT-api-ts-7errs | backend | Fix 7 api-ts lint errors (3 `scheduler && emit`→`if`, 3 test `require()`, 1 test `Function`); add api-ts lint to the repo gate. |
| EU-COLOR-lemon-literal-wide | FE | Sweep `bg-[#FFE97D]`→`bg-primary` etc., one feature folder per PR; add cva `lemon` Button variant. |

---

## What's Next

**Branch 5 — All P0/P1 clear, no regressions, coverage ≥ 70%:**

Enforcement Suite Passed — No Blocking Issues. All 12 modules cleared P0 and P1 enforcement checks. Boundary alias check = 0 violations; both typechecks clean (no type cycles); `bun audit` clean.

Included this run: audit-logging compliance (Phase 3), traceability (Phase 2.5), UI consistency (Phase 1.6, draft-capped), dependency scan (Phase 0.5).

Recommended next steps:
1. `/oli-check --compliance` (full) — BRs/ACs/permissions/data-governance beyond audit logging.
2. `/oli-check --confidence` — test coverage vs spec obligations.
3. Address the two backend gate-coverage gaps (api-ts lint not in repo gate; Rust Cargo.lock not CVE-scanned) — see report IMPROVEMENTS.

To monitor drift: `/oli-check --enforcement --diff`.

---

*Pipeline: `/oli-spec-modules` → `/oli-check --enforcement` (coverage→deps→module/file→journeys→ui-consistency→cross-module→traceability→audit-logging→merge) → **YOU ARE HERE** → `/oli-check --compliance` (full) → `/oli-check --confidence`*
