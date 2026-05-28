---
oli-version: "1.0"
based-on:
  - ARCHITECTURE.md@v1.0
  - MODULE_MAP.md@v2.0 (Phase 11 bucketing)
last-modified: 2026-05-28
last-modified-by: oli-structure-audit
checksum: b8e2f931
---

# Structural Audit Report

## 1. Executive Summary

**Stack:** Bun + Hono + Drizzle (backend) · React + Vite + TanStack Router (frontend) · TypeSpec (specs)
**Source:** `services/api-ts/src/`, `apps/dentalemon/src/`, `apps/account/src/`, `apps/sample-workspace/src/`, `packages/*/src/`
**Files scanned:** 2,843 tracked files (TS/TSX subset)
**Modules:** 23 backend handler modules · 3 frontend apps · 4 packages
**Remediation baseline:** 2026-05-27 audit (checksum a9f0d896) — 13-phase plan at `~/.claude/plans/id-like-to-understand-wiggly-storm.md`, all 13 phases complete.

| Severity | Baseline (2026-05-27) | Current | Delta |
|----------|-----------------------|---------|-------|
| P0 | 34 | **0** | −34 |
| P1 | 4 | **0** | −4 |
| P2 | ~120 | ~16 | −104 |
| P3 | ~30 | ~6 | −24 |

**Structural Dimensions:**

| Dimension | Baseline | Current | Delta | Rating |
|-----------|----------|---------|-------|--------|
| Folder Structure Compliance | 7.0/10 | **8.0/10** | +1.0 | GOOD |
| Dependency Graph Health | 6.5/10 | **8.0/10** | +1.5 | GOOD |
| File Organization Quality | 3.5/10 | **6.5/10** | +3.0 | FAIR |
| Config Hygiene | 9.5/10 | **9.5/10** | 0.0 | GOOD |

Rating: GOOD (8–10), FAIR (5–7), POOR (0–4)

**F7 target (all 4 ≥ 8/10): PARTIAL** — File Organization at 6.5 is the remaining gap. Three large components (~514–549 LOC), one Ceph naming convention block, and MODULE_MAP.md drift account for the shortfall.

**Headline**: All 34 P0 boundary/duplicate violations and all 4 P1 issues resolved across 13 remediation phases. Cross-module repo imports dropped from 30 to 0 in production (Phase 10). Config and dependency hygiene are clean. File Organization is the one dimension not yet at target — remaining work is 3 component splits, Ceph naming rename, and one doc update.

---

## 2. Folder Structure Compliance

### Scaffold Compliance
| Directory | Status |
|-----------|--------|
| docs/product/ | ✅ PRESENT |
| docs/product/modules/ | ✅ PRESENT |
| docs/execution/ | ✅ PRESENT |
| docs/audits/ | ✅ PRESENT |
| .planning/ | ✅ PRESENT |
| .planning/config.json | ✅ PRESENT |

**Verdict**: All scaffold dirs present.

### ARCHITECTURE.md Convention Compliance

ARCHITECTURE.md declares: "Each handler directory contains: Handler files (CRUD operations), `repos/` (DB), `jobs/` (background), `utils/` (module-specific)."

Reality: `jobs/` present in 4/23 modules; `utils/` present in 5/23 modules. Convention is aspirational, not enforced. Formally deferred in MODULE_FATE.md (Phase 12).

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| SA-GLOBAL-001 | P2 | `apps/sample-workspace/` layout is undocumented in ARCHITECTURE.md — its sandbox role appears only in CLAUDE.md. | OPEN |
| SA-GLOBAL-002 | P2 | `docs/product/MODULE_MAP.md` predates Phase 11 bucketing — dental-visit/clinical/patient bucket assignments not reflected. | OPEN |

### Resolved (this remediation cycle)

| Finding | Resolution | Phase |
|---------|-----------|-------|
| `apps/account/` ownership ambiguity | Frozen as upstream-template reference; CLAUDE.md + README banner updated | Phase 8 (b9aee2d8) |
| `apps/dentalemon/src/services/` | Eliminated — `services/onesignal.ts` → `features/notifications/onesignal.ts` | Phase 9a (a3708288) |
| `apps/dentalemon/src/utils/` | Eliminated — 6 files migrated to `lib/` (config, guards, load-org-context, pin-session, rbac, runtime-config) | Phase 9b (a3708288) |

---

## 3. File Duplicate Report

### Diverged Duplicates (P0) — RESOLVED

All 33 `apps/account/src/*` vs `apps/dentalemon/src/*` diverged-content pairs resolved by Phase 8 (b9aee2d8). Decision: `apps/account/` is frozen upstream-template reference; `apps/dentalemon/` is the canonical product app. Divergence is now intentional and documented. No action required.

### Identical Duplicates (P2) — deferred

72 identical-content pairs between `apps/account/` and `apps/dentalemon/` remain. Deferred to future-work F3 (packages/ui + packages/shared-utils extraction, multi-quarter). No immediate action required given Phase 8 freeze.

### Backend assert-branch-access (P3 — downgraded from P0)

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| SA-DENTAL-SCHEDULING-001 | P3 | `dental-scheduling/utils/assert-branch-access.ts` is a 1–3 line re-export shim for `shared/assert-branch-access.ts`, not a diverged fork. No divergence. | OPEN (acceptable) |

---

## 4. Dead File Analysis

Dead-file scan remains unreliable without proper `@/` alias resolution. SA-FE-DEAD-001..006 from baseline deferred to a dedicated pass using `knip` or `ts-prune`.

| ID | Severity | File | Status |
|----|----------|------|--------|
| SA-FE-DEAD-007 | P2 | `apps/dentalemon/src/features/imaging/spike/canvas-benchmark.tsx` — spike code committed to production feature dir | OPEN — remove before next release |

---

## 5. Dependency Graph Health

### Circular Dependencies — RESOLVED

| ID | Cycle | Resolution |
|----|-------|-----------|
| SA-FE-CYC-001 | `tooth-overview-step.tsx` ↔ `tooth-slideout.tsx` (type-only import cycle) | **FIXED** Phase 3 (bc31a60f) — vestigial `export type { ChartEntryClassification }` re-export removed from tooth-slideout |

**Backend**: 0 file-level cycles. **Frontend**: 0 remaining cycles.

### Cross-module Repo Imports — RESOLVED

**0 production violations** (was 30 across 9 modules). All migrated to facade pattern via 19 facade files. ESLint `no-restricted-imports` enforces boundary in each module's `.eslintrc.cjs`. `bun run check:boundaries:error` exits 0.

Phase 10 (233bad8b). Per-module facade migration history in `.planning/STATE.md`.

### Fragile Hubs (P2)

Fan-in counts reduced post-Phase 10 (facade migration absorbed cross-module consumers).

| ID | Severity | File | Fan-in | Baseline | Note |
|----|----------|------|--------|----------|------|
| SA-GLOBAL-004 | P2 | `services/api-ts/src/handlers/patient/repos/patient.schema.ts` | 29 | 65 | Reduced by facades. Still de-facto shared infra. |
| SA-GLOBAL-005 | P2 | `services/api-ts/src/handlers/dental-org/repos/branch.schema.ts` | 16 | 48 | Tenancy-critical — expect consumers. |

Infrastructure files (`database.ts` 421, `errors.ts` 387) excluded — high fan-in by design.

---

## 6. Naming Convention Compliance

### Ceph handler naming (P2 — new finding)

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| SA-IMAGING-001 | P2 | 9 `Ceph*` files in `dental-imaging/` use PascalCase (`CephMgmt_batchUpsertCephLandmarks.ts`) while dominant convention is camelCase (`createImagingStudy.ts`). Shim pattern predates camelCase standard. | OPEN |

### dental-org Management handlers — RESOLVED

`DentalMembershipManagement_create.ts` deprecated with RFC 8594 `Sunset: 2026-09-01` header; `createMember.ts` is canonical. Phase 5 (47f7a749).

### Test Naming (P2 — deferred to F1)

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| SA-GLOBAL-006 | P2 | 21 test files leak sprint/ticket IDs into permanent filenames (`*-moduleN.test.ts`, `ac-*.test.ts`, `AUDIT-P0-001-*.test.ts`). | OPEN — deferred to F1 (after audit archive) |

---

## 7. Colocation Analysis

**Detected strategy:** Colocated (consistent). Three test homes coexist (`src/handlers/*.test.ts`, `src/tests/`, `tests/`) — unchanged from baseline, no regressions.

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| SA-GLOBAL-007 | P3 | Frontend test colocation mixed — some tests colocated, some in separate `tests/` dir. Convention undocumented. | OPEN |
| SA-API-COLO-001 | P3 | `error-envelope.conformance.test.ts` exists in both `src/tests/` and `src/handlers/`. Downgraded: both pass, no production impact. | OPEN |

---

## 8. Barrel File Health

**Total barrels: 4** — all in `packages/` (`ceph-math`, `sdk-ts/generated`, `sdk-ts/generated/client`, `sdk-ts/flows`). Unchanged from baseline.

- Chain depth: 0 · Circular barrels: 0

**Verdict**: Clean. No findings.

---

## 9. Config Sprawl Analysis

Unchanged from baseline. Config hygiene clean.

0 conflicting env values · 0 orphan configs · 0 artifact leakage.

---

## 10. Filesystem Hygiene

### Build Artifact Leakage — 0 violations (unchanged)

### Deep Nesting (P2)

| ID | Severity | Path | Depth | Status |
|----|----------|------|-------|--------|
| SA-WORKSPACE-001 | P2 | 4 files in `apps/dentalemon/src/features/workspace/components/dental/*` | 7 | OPEN |

### Large Files (P2 — reduced from baseline)

Phase 9c split 4 large frontend components (8af49db9). Remaining above 500 LOC threshold:

| ID | Severity | Path | Lines | Status |
|----|----------|------|-------|--------|
| SA-DENTALEMON-001 | P2 | `apps/dentalemon/src/features/workspace/components/treatment-table.tsx` | ~549 | OPEN |
| SA-DENTALEMON-002 | P2 | `apps/dentalemon/src/routes/$patientId.tsx` | ~544 | OPEN |
| SA-DENTALEMON-003 | P2 | `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` | ~514 | OPEN (reduced from 1,051 by Phase 9c) |

Backend: emr.repo.ts (678 LOC), billing/handleStripeWebhook.ts (671 LOC) — both below 1,000 LOC service threshold. No backend findings.

### Gitignore / Env (P3)

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| SA-GLOBAL-008 | P3 | `apps/account/.env` tracked in git — confirm example-only values. | OPEN |
| SA-GLOBAL-009 | P3 | Verify `constants/` dirs not empty after Phase 9c refactor. | OPEN |

---

## 11. Finding Summary

| Severity | Baseline | Current | Delta |
|----------|----------|---------|-------|
| P0 | 34 | **0** | −34 ✅ |
| P1 | 4 | **0** | −4 ✅ |
| P2 | ~120 | **~16** | −104 ✅ |
| P3 | ~30 | **~6** | −24 ✅ |

### Open P2 Findings

| ID | Module | Description |
|----|--------|-------------|
| SA-GLOBAL-001 | Global | sample-workspace not documented in ARCHITECTURE.md |
| SA-GLOBAL-002 | Global | MODULE_MAP.md predates Phase 11 bucketing |
| SA-GLOBAL-004 | dental-patient | patient.schema.ts fan-in=29 (de-facto shared) |
| SA-GLOBAL-005 | dental-org | branch.schema.ts fan-in=16 (tenancy-critical) |
| SA-GLOBAL-006 | Global | 21 test files with milestone/ticket names (deferred F1) |
| SA-IMAGING-001 | dental-imaging | 9 Ceph* files PascalCase vs camelCase convention |
| SA-DENTALEMON-001 | dentalemon | treatment-table.tsx ~549 LOC |
| SA-DENTALEMON-002 | dentalemon | $patientId.tsx ~544 LOC |
| SA-DENTALEMON-003 | dentalemon | imaging-workspace.tsx ~514 LOC |
| SA-WORKSPACE-001 | dentalemon | 4 files at nesting depth 7 |
| SA-FE-DEAD-007 | dentalemon | canvas-benchmark.tsx spike in production dir |
| (72 identical dups) | account/dentalemon | Deferred to packages/ui extraction (F3) |

### Open P3 Findings

| ID | Description |
|----|-------------|
| SA-DENTAL-SCHEDULING-001 | assert-branch-access re-export shim (acceptable) |
| SA-GLOBAL-007 | Frontend test colocation convention undocumented |
| SA-GLOBAL-008 | apps/account/.env tracked |
| SA-GLOBAL-009 | constants/ dirs possibly empty post-Phase 9c |
| SA-API-COLO-001 | error-envelope.conformance.test.ts in 2 homes |

---

## 12. Structural Dimensions

| Dimension | Baseline | Current | Change Driver |
|-----------|----------|---------|---------------|
| Folder Structure Compliance | 7.0/10 | **8.0/10** | apps/account frozen (+clarity), services/ + utils/ eliminated in dentalemon (Phase 9a/9b), module bucketing (Phase 11) |
| Dependency Graph Health | 6.5/10 | **8.0/10** | Type cycle fixed (Phase 3), 30→0 cross-module repo violations (Phase 10), fragile hub fan-in reduced by facades |
| File Organization Quality | 3.5/10 | **6.5/10** | P0 diverged dups resolved (Phase 8), dental-org dup resolved (Phase 5), 4 large files split (Phase 9c). Gap to 8.0: 3 remaining large components + Ceph naming + MODULE_MAP.md |
| Config Hygiene | 9.5/10 | **9.5/10** | No change |

**F7 target (≥ 8/10 all): 3/4 met.** File Organization at 6.5 is the gap. To reach 8.0: SA-DENTALEMON-001/002/003 + SA-IMAGING-001 + SA-GLOBAL-002. Estimated: 1–2 days.

---

## 13. Recommended Actions

### To Close F7 Gap (File Organization 6.5 → 8.0)

1. **Split 3 large components** (SA-DENTALEMON-001/002/003):
   - `treatment-table.tsx` (~549 LOC) — extract column defs + row actions
   - `$patientId.tsx` (~544 LOC) — extract tab panels
   - `imaging-workspace.tsx` (~514 LOC) — remaining panels from Phase 9c

2. **Rename 9 Ceph handler files** (SA-IMAGING-001):
   - `CephMgmt_*.ts` → `ceph-*.ts` (matches dominant camelCase convention)
   - Update imports in consumers

3. **Update MODULE_MAP.md** (SA-GLOBAL-002):
   - Reflect Phase 11 dental-visit/clinical/patient bucket assignments
   - One-file doc update, no code changes

### Future Work (F-series)

- **F1** (test rename): Rename 21 milestone/ticket-ID test files after audit archive confirmed
- **F2** (backend DI): Run `/oli-enforce-all` to seed ENFORCEMENT_REPORT.md — unblocked by Phase 10+11
- **F3** (schema unification + packages/ui): Multi-quarter (H2 2026 → H1 2027)
- **F5** (sample-workspace decision): Document or delete as part of SA-GLOBAL-001 resolution

### Advisory (P3)

- Remove `imaging/spike/canvas-benchmark.tsx` spike file (SA-FE-DEAD-007)
- Add `.gitignore` entries: `.tanstack/`, `test-results/`, `playwright-report/`, `.journey-tmp/`
- Verify `apps/account/.env` contains example-only values (SA-GLOBAL-008)
- Verify `constants/` dirs not empty post-Phase 9c (SA-GLOBAL-009)

---

**What's next:**

| Condition | Recommendation |
|-----------|----------------|
| F7 PARTIAL (File Org 6.5 < 8.0) | Address SA-DENTALEMON-001/002/003 + SA-IMAGING-001 + SA-GLOBAL-002 to close the gap. ~1–2 days. |
| All P0/P1 resolved | Structure clean at boundary layer. Run `/oli-audit-codebase` for full 19-dimension assessment. |
| F2 ready | Run `/oli-enforce-all` to seed ENFORCEMENT_REPORT.md for backend service-layer/DI refactor planning. |

---

*Generated 2026-05-28 by `/oli-structure-audit` (post-remediation re-run). Baseline: checksum a9f0d896 (2026-05-27). Remediation plan: `~/.claude/plans/id-like-to-understand-wiggly-storm.md` — all 13 phases committed on main.*
