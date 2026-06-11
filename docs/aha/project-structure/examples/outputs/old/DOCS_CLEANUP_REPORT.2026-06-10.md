# Documentation Cleanup Report

Phase 3+4 final report. Companion to `DOCS_INVENTORY.md` (Phase 1) and `DOCS_MIGRATION_PLAN.md` (Phase 2).

## Summary

- **8 commits** on `main` (3 pre-migration cleanup + 5 structural).
- **14 files moved** via `git mv` (history preserved).
- **35 OLI archive files deleted** + **5 OLI codebase-map files deleted** (Phase 0 cleanup, user-driven).
- **58 files modified** to strip OLI engine markers (Phase 0).
- **3 broken refs fixed** (2 in `ARCHITECTURE.md`, 2 self-refs in `docs/architecture/adr/README.md` and `docs/quality/deferred-tests.md`).
- **2 new index files**: `docs/product/prd/PRD_INDEX.md`, refreshed `docs/README.md`.
- **3 dirs removed**: `docs/adr/`, `docs/roadmap/`, `docs/_archive/`.
- **1 script updated**: `scripts/update-scorecard.ts` (ADR path).
- **Scorecard verified**: still produces ADR count = 10. ✅

## Files Moved

| Old Path | New Path | Commit |
|---|---|---|
| `docs/adr/0000-template.md` | `docs/architecture/adr/0000-template.md` | `939eecd5` |
| `docs/adr/0001-typespec-first-api-contracts.md` | `docs/architecture/adr/0001-typespec-first-api-contracts.md` | `939eecd5` |
| `docs/adr/0002-hand-wired-route-allowlist.md` | `docs/architecture/adr/0002-hand-wired-route-allowlist.md` | `939eecd5` |
| `docs/adr/0003-drizzle-orm-over-prisma.md` | `docs/architecture/adr/0003-drizzle-orm-over-prisma.md` | `939eecd5` |
| `docs/adr/0004-bun-over-nodejs.md` | `docs/architecture/adr/0004-bun-over-nodejs.md` | `939eecd5` |
| `docs/adr/0005-person-module-as-pii-safeguard.md` | `docs/architecture/adr/0005-person-module-as-pii-safeguard.md` | `939eecd5` |
| `docs/adr/0006-domain-event-bus-for-cross-module-cascades.md` | `docs/architecture/adr/0006-…` | `939eecd5` |
| `docs/adr/0007-audit-officer-position-via-typespec-extension.md` | `docs/architecture/adr/0007-…` | `939eecd5` |
| `docs/adr/0008-superpowers-workflow-replaces-gsd.md` | `docs/architecture/adr/0008-…` | `939eecd5` |
| `docs/adr/0010-mega-module-rebuild-over-split.md` | `docs/architecture/adr/0010-…` | `939eecd5` |
| `docs/adr/README.md` | `docs/architecture/adr/README.md` | `939eecd5` |
| `docs/MULTI-TENANT-AUDIT.md` | `docs/audits/MULTI-TENANT-AUDIT.md` | `a11b9c46` |
| `docs/QA-COVERAGE-MATRIX.md` | `docs/quality/QA-COVERAGE-MATRIX.md` | `a11b9c46` |
| `docs/roadmap/deferred-tests.md` | `docs/quality/deferred-tests.md` | `2ac3bb99` |

## Files Deleted

| Path | Reason | Commit |
|---|---|---|
| `docs/_archive/oli/**` (35 files) | OLI archive — process byproducts no longer referenced | `79ecc213` |
| `docs/audits/codebase-map/**` (5 files) | Engine-regenerated, removed since OLI is out | `79ecc213` |
| `docs/_archive/.DS_Store` | macOS cruft | uncommitted |
| `docs/aha/.DS_Store` | macOS cruft | uncommitted |
| `docs/.DS_Store` | macOS cruft | uncommitted |
| `docs/_archive/` (empty dir) | Removed after files cleared | uncommitted (git ignores empty dirs) |
| `docs/adr/` (empty dir after moves) | Removed | `939eecd5` |
| `docs/roadmap/` (empty dir after move) | Removed | `2ac3bb99` |

`.DS_Store` files already covered by `.gitignore` (lines 131-132), so untracked — no commit needed.

## Files Created

| Path | Purpose | Commit |
|---|---|---|
| `docs/DOCS_INVENTORY.md` | Phase 1 inventory | uncommitted (workflow artifact) |
| `docs/DOCS_MIGRATION_PLAN.md` | Phase 2 plan | uncommitted (workflow artifact) |
| `docs/DOCS_CLEANUP_REPORT.md` | Phase 4 report (this file) | (next commit) |
| `docs/product/prd/PRD_INDEX.md` | Index of all PRDs (master + 22 product-module + 16 handler-level + cross-cutting) | `fcdfb666` |

## Files Modified (refs updated)

| File | Change | Commit |
|---|---|---|
| `scripts/update-scorecard.ts` | `readdirSync('docs/adr')` → `readdirSync('docs/architecture/adr')` | `939eecd5` |
| `docs/quality/SCORECARD.md` | Regenerated after script change | `939eecd5` |
| `ARCHITECTURE.md` (root) | `docs/templates/MODULE_SPEC.template.md` → `docs/quality/MODULE_SPEC_TEMPLATE.md` | `cc3b226b` |
| `ARCHITECTURE.md` (root) | `docs/templates/SLICE_SPEC.template.md` → reference existing slice spec as example | `cc3b226b` |
| `docs/architecture/adr/README.md` | Self-ref `docs/adr/0000-template.md` → `docs/architecture/adr/0000-template.md` | (next commit) |
| `docs/quality/deferred-tests.md` | Self-ref `docs/roadmap/deferred-tests.md` → `docs/quality/deferred-tests.md` | (next commit) |
| `docs/README.md` | Refreshed to reflect post-migration structure; documents flat-vs-nested MODULE_SPEC distinction | `fcdfb666` |

## PRD Organization Summary

Memberry uses a **two-layer PRD pattern**; both layers canonical at their own scope.

| Layer | Path | Count | Owner | Scope |
|---|---|---|---|---|
| Master PRD | `docs/product/MASTER_PRD.md` | 1 | Product | Cross-module product requirements |
| Product-module | `docs/product/modules/m{NN}-{slug}/MODULE_SPEC.md` | 22 | Product | Per-product-module PRD; validated against MASTER_PRD |
| Handler-level | `docs/product/MODULE_SPEC.*.md` | 16 | Eng | Per-backend-handler-dir spec; source-inspected |
| Cross-cutting foundation | `docs/product/{DOMAIN_MODEL,WORKFLOW_MAP,STATE_MACHINES,…}.md` | ~20 | Product+Eng | Domain model, workflows, event contracts, taxonomies |

All indexed in [`docs/product/prd/PRD_INDEX.md`](./product/prd/PRD_INDEX.md).

## Validation Results

| Check | Result |
|---|---|
| `docs/adr/` references in code (excluding intentional migration notes in README) | 1 stale self-ref in `docs/architecture/adr/README.md` — **FIXED** |
| `docs/roadmap/` references | 1 stale self-ref in `docs/quality/deferred-tests.md` — **FIXED** |
| `docs/MULTI-TENANT-AUDIT.md` / `docs/QA-COVERAGE-MATRIX.md` references in code | 0 external refs (only README migration notes) ✅ |
| `docs/templates/` broken refs | 0 remaining ✅ |
| Scorecard script regression | ADR count still 10 ✅ |
| `git mv` history preservation | 100% rename detection verified in `git diff --stat` ✅ |
| `.DS_Store` in `.gitignore` | Already covered (lines 131-132) ✅ |
| Final `docs/` tree | 13 dirs, clean structure ✅ |

## Final docs/ structure

```
docs/
├── README.md                    # Index + landscape map
├── DOCS_INVENTORY.md            # workflow artifact
├── DOCS_MIGRATION_PLAN.md       # workflow artifact
├── DOCS_CLEANUP_REPORT.md       # this file
├── aha/                         # 10 audit playbook prompts
├── architecture/
│   ├── COMMS-CONSOLIDATION.md
│   └── adr/                     # 11 ADRs (0000-0010 + README)
├── audits/
│   ├── MULTI-TENANT-AUDIT.md
│   └── domain-graph/
├── execution/                   # 36 slice + wave files
├── product/                     # 201 files (master + 22 modules + cross-cutting + 16 handler specs)
│   ├── prd/
│   │   └── PRD_INDEX.md
│   └── modules/m01-m22/
├── project-map/                 # 6 generated nav files + generate.ts
├── quality/                     # 31 audit/scorecard/baseline files
├── security/                    # 4 security audits
├── ver-3/                       # 130 versioned snapshot files
└── workflow/                    # 1 superpowers flow file
```

## Remaining Risks / Followups

1. **`scripts/ui-consistency-detect.ts`** (×3 refs) and **`apps/memberry/src/utils/guards.ts`** (×1 ref) point to two paths that no longer exist:
   - `docs/audits/PATTERNS.lock.md`
   - `docs/audits/E2E_REMEDIATION_FINAL.md`

   These are **pre-existing broken refs** (not caused by this migration; likely removed during OLI cleanup or earlier). Out of scope for this migration. **Separate followup needed**: either restore from git history, recreate the audit artifacts, or update the script/comment to point at current sources. Investigate which.

2. **PRD_INDEX.md is hand-maintained** — no script regenerates it. When a new product module or handler spec is added, the index must be updated manually. Acceptable trade-off (PRDs change rarely).

3. **`docs/README.md` migration history section** will grow stale over time. Remove the "Recent restructure (2026-06-10)" section after ~3 months.

4. **External deep-links** to `docs/adr/0001-…` from blog posts, wiki, or PR descriptions will 404. GitHub follows renames in the UI, but absolute external URLs do not. Acceptable — repo-internal migration always carries this risk.

## Recommended Next Actions

1. Commit the 3 final artifacts: this report + self-ref fixes + workflow artifacts.
2. Investigate `PATTERNS.lock.md` and `E2E_REMEDIATION_FINAL.md` broken refs as a separate task.
3. Optional: add a CI lint that catches stale `docs/adr/` / `docs/roadmap/` refs in future PRs (`rg --glob '!docs/DOCS_*.md' 'docs/(adr|roadmap)/'`).
4. Optional: introduce a markdown link checker (lychee, markdown-link-check) in CI.

---

**Migration complete.** 13 dirs → 13 dirs (same count, cleaner structure). Zero load-bearing script breakage. Zero new broken refs introduced.
