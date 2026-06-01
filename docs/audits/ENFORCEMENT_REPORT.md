<!-- oli-version: 1.1 -->
<!-- based-on: docs/product/modules/*/MODULE_SPEC.md, docs/product/MODULE_BOUNDARIES.md, docs/audits/enforce/.baseline.json -->
<!-- generated: 2026-06-01T00:00:00Z -->

# Enforcement Report

**Generated:** 2026-06-01
**Modules Audited:** 12 spec'd (dental-audit, dental-billing, dental-clinical, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit, emr-consultation, external-records-import) + new code modules: erasure, legal-hold
**Baseline Compared:** enforcement-2026-06-01 (git 0635e0f5)
**Current HEAD:** a3bfc9a5
**Coverage Completeness:** FULL (graph-grounded, project ground-truth gates)

---

## Audit Scope

Graph-grounded enforcement using project checkers as ground truth (per baseline method):
- `bun run check:boundaries` — module-boundary alias check (authoritative for cross-module reach-ins)
- `bun audit` — dependency CVE scan
- `bun run typecheck` (tsc --noEmit) — type cycles / forbidden-tech surface
- `bun run lint` (eslint src) — banned-pattern / no-restricted-imports surface

| Gate | Result |
|------|--------|
| check:boundaries | PASS — 0 cross-module repo boundary violations |
| bun audit | PASS — No vulnerabilities found |
| typecheck | PASS — 0 errors (no type cycles) |
| lint (eslint src) | 7 errors (ALL pre-existing tech-debt), 4048 warnings |

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Verdict** | WARN (no P0/P1; carried P2/P3 tech-debt) |
| **Total P0 Findings** | 0 |
| **Total P1 Findings** | 0 |
| **Total P2 Findings** | 2 |
| **Total P3 Findings** | 2 |
| **Boundary alias violations** | 0 |
| **Dependency CVEs** | 0 |
| **Type cycles** | 0 |
| **Regressions (new P0/P1)** | 0 |
| **Overall Trend** | STABLE (no new findings; no resolutions) |

**NEW WORK VERDICT (erasure / legal-hold / *-erasure / *-retention facades):** CLEAN.
- All cross-module access via `*.facade.ts` — person-erasure, clinical-erasure, attachment-retention, imaging-erasure, patient-erasure all present.
- `check:boundaries` GREEN — 0 alias violations introduced.
- New files lint with **0 errors** (warnings only — `no-explicit-any`/unused-import, consistent with codebase baseline).
- typecheck clean — no type errors from new modules.

---

## Findings (Carried — all pre-existing, none NEW)

| ID | Sev | Module | Status | Finding |
|----|-----|--------|--------|---------|
| EF-DENTAL-IMG-naming01 | P2 | dental-imaging | KNOWN | 20 dead duplicate short-named handler files (route-wired set is `*Mgmt_`-prefixed). Delete short-named twins. |
| EB-BOUNDARY-reachins01 | P2 | 8 modules | KNOWN | 54 ESLint no-restricted-imports relative repo reach-ins. Alias check:boundaries = 0. Migrate per-PR via MODULE_BOUNDARIES.md. |
| EU-GLOBAL-uispec01 | P3 | GLOBAL | KNOWN | No UI_CONSISTENCY_SPEC.md — ui-consistency in draft mode (P3 cap). |
| EB-EMR-facade-lintdrift01 | P3 | emr | KNOWN | 10 emr no-restricted-imports warnings flag `*-emr.facade` (APPROVED bridge); exempt-list omits `repos/*.facade.ts`. |

**Pre-existing lint tech-debt (NOT counted as enforcement findings — carried, identical at base da958034):**
7 `eslint src` errors — `createDentalInvoice.ts:127` (`scheduler && emit` no-unused-expressions), `cancelAppointment.ts:71`, `createAppointment.ts:132` (same rule), `treatment-decline.test.ts:54/59/64` (require-imports), `emr.handlers.test.ts:145` (no-unsafe-function-type). The `error-envelope.conformance.test.ts` unused `AppError` is a warning, not an error. None originate from this work.

---

## Ratchet Summary

**Baseline:** enforcement-2026-06-01 (0635e0f5)
- **Regressions (new P0/P1):** none
- **New findings (P2/P3):** none
- **Known findings:** 4 (all carried, ages preserved)
- **Resolved:** none this run

The new erasure/legal-hold/retention work landed without introducing any new enforcement findings at any severity. Boundary discipline maintained (facade-only cross-module access).

---

## Stabilization Plan

### Fix Now — P0 (0)
No P0 findings. No immediate blocking issues.

### Fix Before New Work — P1 (0)
No P1 findings.

### Fix When Touching — P2 (2)
- EF-DENTAL-IMG-naming01 — delete 20 dead short-named imaging handler twins.
- EB-BOUNDARY-reachins01 — migrate 54 relative repo reach-ins to facades, one PR per module.

### Track — P3 (2)
- EU-GLOBAL-uispec01 — run `/oli-spec-ui --infer-from-code` to enable EU- enforcement.
- EB-EMR-facade-lintdrift01 — add `.facade` to ESLint exempt glob or accept warnings.

---

## What's Next

**Branch 5 — All P0/P1 clear, no regressions:**
Enforcement suite passed — no blocking issues. New data-governance modules (erasure/legal-hold) cleared all enforcement gates. Recommended: `/oli-check --compliance` (full) for the deferred data-governance BR coverage (retention/erasure WFG-006 from the deferred P1 backlog), then `/oli-check --confidence`.
