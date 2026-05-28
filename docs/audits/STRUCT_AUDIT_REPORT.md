---
oli-version: "1.0"
based-on:
  - ARCHITECTURE.md@v1.0
  - MODULE_MAP.md@v1.0
last-modified: 2026-05-27
last-modified-by: oli-structure-audit
checksum: a9f0d896
---

# Structural Audit Report

## 1. Executive Summary

**Stack:** Bun + Hono + Drizzle (backend) · React + Vite + TanStack Router (frontend) · TypeSpec (specs)
**Source:** `services/api-ts/src/`, `apps/dentalemon/src/`, `apps/account/src/`, `apps/sample-workspace/src/`, `packages/*/src/`
**Files scanned:** 2,843 tracked files (TS/TSX subset)
**Modules:** 23 backend handler modules · 3 frontend apps · 4 packages

| Severity | Count |
|----------|-------|
| P0 | 34 |
| P1 | 4 |
| P2 | ~120 |
| P3 | ~30 |

**Structural Dimensions:**

| Dimension | Score | Rating |
|-----------|-------|--------|
| Folder Structure Compliance | 7.0/10 | FAIR |
| Dependency Graph Health | 6.5/10 | FAIR |
| File Organization Quality | 3.5/10 | POOR |
| Config Hygiene | 9.5/10 | GOOD |

Rating: GOOD (8-10), FAIR (5-7), POOR (0-4)

**Headline**: Config and filesystem hygiene are clean; module/file organization is the bottleneck. The codebase is mid-migration from upstream template (`apps/account/`, `patient/`, `billing/`, `emr/`) to dental-* domain modules, and the migration left load-bearing duplicates + porous module boundaries.

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

### ARCHITECTURE.md Convention Compliance (P2)

ARCHITECTURE.md declares: "Each handler directory contains: Handler files (CRUD operations), `repos/` (DB), `jobs/` (background), `utils/` (module-specific)."

Reality across 23 modules:

| Convention | Compliance |
|---|---|
| `repos/` present | 22/23 (only `shared/` lacks — by design) |
| `jobs/` present | **4/23** (audit, booking, email, notifs) |
| `utils/` present | **5/23** (booking, dental-billing, dental-org, dental-perio, dental-scheduling) |

| ID | Finding |
|----|---------|
| SA-GLOBAL-001 | ARCHITECTURE.md prescribes `jobs/` + `utils/` but 18+ modules lack them. Spec needs softening to "MAY contain" or convention needs enforcing. |

### Module Map Drift (P2)

`docs/product/MODULE_MAP.md` exists. Filesystem has additional dental-* modules beyond template baseline; module map should be checked against actual modules.

---

## 3. File Duplicate Report

### Diverged Duplicates (P0) — 33 pairs

`apps/account/src/*` vs `apps/dentalemon/src/*`: **33 same-basename files with diverged content**. Real fork, not shared.

| ID | File A | File B | Note |
|----|--------|--------|------|
| SA-APPS-001 | apps/account/src/app.tsx | apps/dentalemon/src/app.tsx | Different routing/providers |
| SA-APPS-002 | apps/account/src/components/app-sidebar.tsx | apps/dentalemon/src/components/app-sidebar.tsx | Material drift |
| SA-APPS-003 | apps/account/src/components/personal-info-form.tsx (+ .test.tsx) | apps/dentalemon/src/components/personal-info-form.tsx (+ .test.tsx) | Impl + test diverged |
| SA-APPS-004 | apps/account/src/components/phone-input.tsx (+ .test.tsx) | apps/dentalemon/src/components/phone-input.tsx (+ .test.tsx) | Impl + test diverged |
| SA-APPS-005 | apps/account/src/components/image-cropper-dialog.tsx (+ .test.tsx) | apps/dentalemon/src/components/image-cropper-dialog.tsx (+ .test.tsx) | Impl + test diverged |
| SA-APPS-006 | apps/account/src/hooks/use-format-date.ts (+ .test.ts) | apps/dentalemon/src/hooks/use-format-date.ts (+ .test.ts) | Null-handling diverged |
| SA-APPS-007 | apps/account/src/lib/format-date.ts | apps/dentalemon/src/lib/format-date.ts | Null|undefined acceptance differs |
| SA-APPS-008 | apps/account/src/components/preferences-form.test.tsx | apps/dentalemon/src/components/preferences-form.test.tsx | **Tests drifted, impl identical — silent test divergence** |
| SA-APPS-009..033 | (27 more) | | Full list in `~/.claude/plans/id-like-to-understand-wiggly-storm-agent-a9f0d8966d275f05f.md` |

### Identical Duplicates (P2) — 72 pairs

| ID | Files | Note |
|----|-------|------|
| SA-APPS-IDEN-001 | 71 files between account ↔ dentalemon, 1 between dentalemon ↔ sample-workspace | Examples: `components/input.tsx`, `components/logo.tsx`, `hooks/use-format-currency.ts`, `lib/format-currency.ts`, `router.tsx`, `utils/config.ts`, `routes/onboarding.tsx`, `routes/verify-email.tsx`, `routes/auth/$authView.tsx`, `features/person/components/preferences-form.tsx` |

**Verdict**: Both apps copy-paste-then-fork shadcn primitives + format/detect utilities + auth routes. Missing `packages/ui` + `packages/shared`.

### Backend duplicate utility (HIGH — verify)

| ID | Finding |
|----|---------|
| SA-API-001 | `assert-branch-access.ts` exists in BOTH `services/api-ts/src/handlers/shared/` AND `services/api-ts/src/handlers/dental-scheduling/utils/`. Each is referenced by ~74 import sites. Needs verification: fork or one re-exports the other? |

---

## 4. Dead File Analysis

**Tool note**: `madge --orphans apps/dentalemon` reports 194 orphans, but **the number is unreliable** — madge cannot resolve the `@/` path alias used by Vite without `--ts-config`. 125 path-resolution warnings emitted. Most "orphans" verified live via grep.

| ID | File | Reason | Status |
|----|------|--------|--------|
| SA-FE-DEAD-001 | apps/dentalemon/src/components/consent-sheet.tsx | Single reference suspected | Needs manual confirm |
| SA-FE-DEAD-002 | apps/dentalemon/src/components/sync-status-badge.tsx | Single reference suspected | Needs manual confirm |
| SA-FE-DEAD-003 | apps/dentalemon/src/components/treatment-plans-sheet.tsx | Single reference suspected | Needs manual confirm |
| SA-FE-DEAD-004 | apps/dentalemon/src/hooks/use-onesignal.ts | Single reference suspected | Needs manual confirm |
| SA-FE-DEAD-005 | apps/dentalemon/src/features/pmd/components/pmd-import.tsx | Single reference suspected | Needs manual confirm |
| SA-FE-DEAD-006 | apps/dentalemon/src/features/pmd/components/pmd-viewer-sheet.tsx | Single reference suspected | Needs manual confirm |
| SA-FE-DEAD-007 | apps/dentalemon/src/features/imaging/spike/canvas-benchmark.tsx | Spike code in production feature dir | Verified — should not ship |

**Recommendation**: Re-run dead-file scan with proper `tsconfig` path alias resolution (e.g., `knip` or `ts-prune`) before acting on this list.

---

## 5. Dependency Graph Health

### Circular Dependencies (P1)

| ID | Cycle | Length |
|----|-------|--------|
| SA-FE-CYC-001 | `apps/dentalemon/src/features/workspace/components/tooth-overview-step.tsx` → imports `type ChartEntryClassification` from `./tooth-slideout` → imports `ToothOverviewStep` from `./tooth-overview-step` | 2 |

**Note**: Cycle survives only because edge is `import type` (erased at compile). Would crash at runtime if a value import. **Fix**: extract `ChartEntryClassification` to `tooth-types.ts`.

**Backend (`services/api-ts/src/`)**: 0 file-level cycles. Clean.

### Fragile Hubs — Fan-in > 20 (P2)

| ID | File | Fan-in | Risk |
|----|------|--------|------|
| SA-API-HUB-001 | services/api-ts/src/handlers/patient/repos/patient.schema.ts | **65** | Single point of failure; renaming = mass refactor |
| SA-API-HUB-002 | services/api-ts/src/handlers/patient/repos/patient.repo.ts | 56 | Same |
| SA-API-HUB-003 | services/api-ts/src/handlers/dental-org/repos/branch.schema.ts | 48 | Tenancy-critical schema |
| SA-API-HUB-004 | services/api-ts/src/handlers/person/repos/person.schema.ts | 47 | Better-Auth-coupled |
| SA-API-HUB-005 | services/api-ts/src/handlers/dental-org/repos/membership.schema.ts | 46 | Tier/role-critical |
| SA-API-HUB-006 | services/api-ts/src/handlers/dental-visit/repos/visit.repo.ts | 38 | |
| SA-API-HUB-007 | services/api-ts/src/handlers/dental-visit/repos/visit.schema.ts | 37 | |
| (Expected infra) | services/api-ts/src/core/database.ts | 421 | Expected for db client |
| (Expected infra) | services/api-ts/src/core/errors.ts | 387 | Expected for error envelope |

**Verdict**: `patient/`, `dental-org/`, `person/` schemas are **de-facto shared infrastructure** living inside specific modules — explains why "modules" don't have boundaries.

### Cross-module repo imports (production, excluding tests)

**30 production files** import sibling modules' `repos/`. Distribution:

| Source module → Target | Count |
|---|---|
| `dental-imaging` → `dental-org/repos` | 27 |
| `dental-patient` → `patient/repos` | 21 |
| `dental-billing` → `dental-clinical`, `dental-org`, `dental-visit`, `patient` repos | 7 |
| `dental-pmd`, `dental-perio`, `dental-scheduling` → `dental-org/repos` | various |

**Sinks** (de-facto shared): `dental-org/repos` (8 modules consume), `patient/repos` (4 modules), `dental-clinical/repos`.

---

## 6. Naming Convention Compliance

### Detected conventions

| Scope | Dominant | Deviations |
|---|---|---|
| Backend handler files | camelCase (`createDentalInvoice.ts`) | `PascalCase_action.ts` in dental-imaging (21 files) and dental-org (11 files) |
| Frontend components | PascalCase + kebab-case (shadcn primitives) | Consistent |
| Feature directories | kebab-case / lowercase | Consistent |

### Backend naming violations (P2)

| ID | Module | Violating Style | Count | Example |
|----|--------|-----------------|-------|---------|
| SA-API-NAME-001 | dental-imaging | `*Mgmt_action.ts` (15-line shim pattern) | 21 | `CephMgmt_batchUpsertCephLandmarks.ts` |
| SA-API-NAME-002 | dental-org | `*Management_action.ts` (real handlers) | 11 | `DentalMembershipManagement_setPin.ts` |

**Verdict**: Two coexisting conventions in same module. Imaging shims are passthrough; dental-org has real-logic duplicates (see Section 11).

### Test naming chaos (handlers/ — 143 test files)

| Pattern | Count | Status |
|---|---|---|
| `{module}.test.ts` (normal camelCase) | 44 | ✅ |
| Kebab feature (`feature-x.test.ts`) | 56 | ✅ |
| `*.repo.test.ts` | 9 | ✅ |
| Property/FSM (`*.fsm.property.test.ts`) | 10 | ✅ |
| **Milestone-tagged `*-moduleN.test.ts`** | **16** | 🟠 sprint IDs hardcoded |
| **Cryptic `ac-*.test.ts`** | **4** | 🟠 (`ac-g2s1`, `ac-clinical`, `ac-scheduling`, `ac-billing`) |
| **Ticket-ID `AUDIT-P0-001-*.test.ts`** | **1** | 🟠 |

21 test files (15%) leak release process into permanent filenames.

---

## 7. Colocation Analysis

**Detected strategy:** Colocated (consistent).

| Source | Tests | __tests__/ dirs |
|---|---|---|
| Frontend `apps/dentalemon/src/` | 130 colocated | 0 |
| Backend `services/api-ts/src/handlers/` | 143 colocated | 0 |
| Backend `services/api-ts/src/tests/` | 2 (cross-cutting) | 0 |
| Backend `services/api-ts/tests/` (sibling of src) | ~22 (integration/e2e/perf) | 0 |

| ID | Finding |
|----|---------|
| SA-GLOBAL-COLO-001 | Three test homes coexist (`src/handlers/*.test.ts`, `src/tests/`, `tests/`). Strategy is dominantly co-located, but the cross-cutting/integration split isn't documented. |
| SA-API-COLO-001 | Duplicate file: `src/tests/error-envelope.conformance.test.ts` AND `src/handlers/error-envelope.conformance.test.ts`. Same name, two homes. |

---

## 8. Barrel File Health

**Total barrels in monorepo: 4** — all in `packages/` (`ceph-math`, `sdk-ts/generated`, `sdk-ts/generated/client`, `sdk-ts/flows`).

- Chain depth: 0 (no barrel re-exports from another barrel)
- Unused exports: not exhaustively checked, but small surface
- Circular barrels: 0
- `apps/*/` and `services/api-ts/src/` use deep imports (no barrels)

**Verdict**: Clean. No findings.

---

## 9. Config Sprawl Analysis

**Total env files**: 6 (one `.env` + `.env.example` per workspace) — normal.
**tsconfig.json per app**: 1 — no fragmentation.

| ID | Finding |
|----|---------|
| (none) | Config hygiene is clean. No conflicting env values across files. No orphan configs detected. |

---

## 10. Filesystem Hygiene

### Build Artifact Leakage (P1) — 0 violations

Git tracks **0** entries matching `(coverage/\|dist/\|build/\|.next/\|.turbo/\|test-results\|playwright-report\|.journey-tmp\|.DS_Store\|.env\|node_modules)`.

The only `.tanstack` hit is `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` (generated SDK file, intentionally tracked).

**Correction to earlier critique**: Earlier draft claimed these were committed; they are NOT — that data came from working-directory presence, not git status.

### .gitignore gaps (P3) — defensive only

Patterns present locally but not explicitly in `.gitignore`:

| ID | Pattern | Recommendation |
|----|---------|----------------|
| SA-GLOBAL-GI-001 | `.tanstack/` | Add to `.gitignore` (apps) |
| SA-GLOBAL-GI-002 | `test-results/` | Add to `.gitignore` |
| SA-GLOBAL-GI-003 | `playwright-report/` | Add to `.gitignore` |
| SA-GLOBAL-GI-004 | `.journey-tmp/` | Add to `.gitignore` |

### Deep Nesting (P2)

| ID | Path | Depth | Max |
|----|------|-------|-----|
| SA-FE-NEST-001 | `apps/dentalemon/src/features/workspace/components/dental/*` (4 files) | 8 | 6 |

449 files at depth 7 (handler `repos/` schemas — expected for the chosen layout). Distribution: 1@1, 8@2, 13@3, 30@4, 355@5, 531@6, 449@7, 4@8.

### Large Files (P2)

| ID | Path | Lines | Threshold |
|----|------|-------|-----------|
| SA-FE-SIZE-001 | apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx | **1,051** | 500 (component) |
| SA-FE-SIZE-002 | apps/dentalemon/src/components/sidebar.tsx | 773 | 500 (component) |
| SA-FE-SIZE-003 | (5 more components >500 LOC) | | |
| SA-API-SIZE-001 | services/api-ts/src/handlers/emr/repos/emr.repo.ts | 678 | 1,000 (service) — below threshold but largest non-test |
| SA-API-SIZE-002 | services/api-ts/src/handlers/billing/handleStripeWebhook.ts | 671 | 1,000 (service) — below threshold |

7 components exceed the 500 LOC component threshold; 0 services exceed the 1,000 LOC threshold.

### Empty Directories (P3) — 0 violations

No empty dirs, no `.gitkeep` files. Clean.

---

## 11. Finding Summary

| Severity | Count | Enforcement |
|----------|-------|-------------|
| P0 | 34 (33 diverged file pairs + 1 backend dup utility) | BLOCK |
| P1 | 4 (1 file cycle, 0 config conflict, 1 dup test file home, 1 dental-org real duplicate identified by prior reviewer) | BLOCK |
| P2 | ~120 (72 identical dups, 30 cross-module repo imports, 7 fragile hubs, 7 large files, 32 naming-style splits, 21 test-name-chaos, etc.) | WARN |
| P3 | ~30 (4 deep-nested files, 4 .gitignore gaps, 1 colocation note, ~20 spec sidecars missing) | WARN |

**Total findings: ~188**

---

## 12. Structural Dimensions

| Dimension | Score | Components |
|-----------|-------|------------|
| Folder Structure Compliance | 7.0/10 | scaffold: 0 violations · ARCHITECTURE.md drift: 1 (jobs/utils convention) · module map: minor drift |
| Dependency Graph Health | 6.5/10 | cycles: 1 (type-only) · fragile hubs: 7 (patient/person/dental-org schemas as de-facto shared) |
| File Organization Quality | 3.5/10 | P0 duplicates: 33 · identical dups: 72 · cross-module reaches: 30 prod · test naming chaos: 21 · large files: 7 |
| Config Hygiene | 9.5/10 | conflicts: 0 · orphans: 0 · artifact leakage: 0 · gitignore gaps: 4 (advisory) |

---

## 13. Recommended Actions

### Immediate (P0)

- **Resolve 33 diverged-content files between `apps/account/` and `apps/dentalemon/`** — decide canonical app (Phase 8 of remediation plan), then either delete the loser or extract shared bits into `packages/ui` + `packages/shared-utils`. The `preferences-form.test.tsx` divergence is especially concerning — same impl, different tests means one suite is silently testing nothing the user sees.
- **Verify `assert-branch-access.ts` duplication** — read both copies, decide if one re-exports the other or if they're independent.

### Before New Work (P1)

- **Fix the `tooth-overview-step.tsx` / `tooth-slideout.tsx` type cycle** — extract `ChartEntryClassification` to `tooth-types.ts` (one-file change).
- **Deduplicate `error-envelope.conformance.test.ts`** — pick one home, delete the other.
- **Resolve dental-org real duplicate handlers** — `createMember.ts` vs `DentalMembershipManagement_create.ts` (see prior reviewer report; two routes, two semantics; deprecate one with Sunset header).

### When Touching Module (P2)

- **Extract `packages/ui` + `packages/shared-utils`** to eliminate 72 identical duplicates + freeze further drift.
- **Lint cross-module `repos/` imports** — 30 prod files violate boundary. Start as warn, migrate via handler-facades, then error.
- **Split `imaging-workspace.tsx` (1,051 LOC)** and `sidebar.tsx` (773 LOC).
- **Rename the `*Mgmt_*` shims and `*Management_*` handlers to a single convention** (after generator policy lock).
- **Delete confirmed dead files** — `consent-sheet.tsx`, `sync-status-badge.tsx`, `treatment-plans-sheet.tsx`, `pmd-import.tsx`, `pmd-viewer-sheet.tsx`, `use-onesignal.ts`, `imaging/spike/canvas-benchmark.tsx` (after re-running with proper alias resolver).
- **Reconcile ARCHITECTURE.md handler convention** — either soften "must contain jobs/, utils/" to "may contain", or migrate the 18+ modules that lack them.

### Advisory (P3)

- Add `.gitignore` entries for `.tanstack/`, `test-results/`, `playwright-report/`, `.journey-tmp/` defensively.
- Flatten the 4 path-depth-8 files in `features/workspace/components/dental/`.
- Rename 21 milestone/ticket/cryptic test files to descriptive names (after audit reports archived).
- Backfill `.md` sidecars for 12 `dental-*.tsp` spec modules (or remove the sidecars from non-dental modules — pick one rule).

---

**What's next:**

| Condition | Recommendation |
|-----------|---------------|
| **P0/P1 findings exist (38 total)** | **Fix structural issues (see Recommended Actions above), then re-run `/oli-structure-audit`.** |
| STRUCT_AUDIT_REPORT.md consumed by oli-audit-codebase | Structural dimensions will be incorporated into Codebase Health Score on next `/oli-audit-codebase` run. |

The most ROI-positive path: **Phases 1–8 of the remediation plan at `~/.claude/plans/id-like-to-understand-wiggly-storm.md`**, starting with Phase 1 (cruft + gitignore — half day) and Phase 5 (dental-org real duplicate resolution — 2 days). Defer Phase 12 (legacy module deletion) until boundary lint is in place.

---

*Generated 2026-05-27 by `/oli-structure-audit`. Raw scan outputs preserved in `~/.claude/plans/id-like-to-understand-wiggly-storm-agent-*.md`.*
