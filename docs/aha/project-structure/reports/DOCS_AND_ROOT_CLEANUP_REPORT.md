# Docs and Root Cleanup Report

> AHA prompt **03** execution report. Date: 2026-06-11.
> Predecessors (planning): `../outputs/PROJECT_STRUCTURE_INVENTORY.md`,
> `../migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`,
> `../outputs/DOCS_INVENTORY.md`, `../migration-plans/DOCS_MIGRATION_PLAN.md`.

## Summary

Executed the **safe subset** of the two approved migration plans:

- **3 LOW-risk DOCS moves** — relocated 2026-06-10 workflow artifacts from `docs/` root into the AHA folder structure with date-stamped names under `outputs/old/` and `migration-plans/old/`.
- **2 Must-Have root-hygiene actions** — deleted 10 untracked `.DS_Store` files; added `.audits/*.log` to `.gitignore` (75 untracked logs now permanently ignored).
- **1 Must-Have skipped** — `ARCHITECTURE.md` duplication NOT resolved because the root file (376 lines, "Architecture Guide") and `docs/ARCHITECTURE.md` (253 lines, "Architecture") are **distinct documents** with different scope; choosing canonical requires human judgement. Flagged as Remaining Risk.
- **All optional / cosmetic moves skipped** — per safety rule 5 (NEEDS REVIEW), rule 7 (HIGH risk reference fan-out), and the plans' explicit "No Must-Have" classification: root markdowns (`QUICKSTART`, `ROADMAP`, `VERTICAL_TDD`) left in place; `docs/aha/copy.md` already deleted in working tree, not re-archived.
- **3 new indexes created** — `docs/INDEX.md`, `docs/aha/project-structure/README.md`, this report.

## Files Moved

| Old Path | New Path | Reason |
|---|---|---|
| `docs/DOCS_INVENTORY.md` | `docs/aha/project-structure/outputs/old/DOCS_INVENTORY.2026-06-10.md` | Align prior 2026-06-10 workflow output with AHA convention (per DOCS_MIGRATION_PLAN §File Move Map) |
| `docs/DOCS_MIGRATION_PLAN.md` | `docs/aha/project-structure/migration-plans/old/DOCS_MIGRATION_PLAN.2026-06-10.md` | Same reason |
| `docs/DOCS_CLEANUP_REPORT.md` | `docs/aha/project-structure/outputs/old/DOCS_CLEANUP_REPORT.2026-06-10.md` | Same reason |

All three used `git mv` to preserve history.

## Files Archived

None this round. The three moved DOCS workflow files are co-located with the AHA outputs (named `*.2026-06-10.md`) rather than placed under `docs/archive/` because they are AHA-adjacent process artifacts, not deprecated product docs. No `docs/archive/` directory created — would be empty.

## Files Left Untouched

| Path | Reason |
|---|---|
| `ARCHITECTURE.md` (root) AND `docs/ARCHITECTURE.md` | Distinct documents (different titles, scope, length). Cannot consolidate without human picking canonical. See Remaining Risks. |
| `QUICKSTART.md` | Optional cosmetic move — not Must-Have. Medium reference fan-out. |
| `ROADMAP.md` | Optional cosmetic move — referenced by CLAUDE.md "Deferred Work" section. |
| `VERTICAL_TDD.md` | Optional cosmetic move — HIGH-risk reference fan-out (CLAUDE, CONTRIBUTING, 8+ skill files, `.planning/`). Requires coordinated PR. |
| `VERSION` | Producer/consumer unverified — keep until mapped. |
| `test-setup-root.ts` | Do-Not-Move (bunfig.toml preload + 30+ test files reference it). |
| `docker/`, `docker-compose.yml`, `railway.json`, `bunfig.toml`, `turbo.json`, `package.json`, `bun.lock` | Do-Not-Move (tool-root discovery). |
| `.audits/baseline-*.log`, `.audits/contract-*.log` (75 files) | Already untracked; deletion is local choice. Gitignore patch ensures they stay out of repo going forward. Files remain on disk for now (not deleted from working tree). |
| `docs/aha/copy.md` | NEEDS REVIEW per DOCS_MIGRATION_PLAN. Already deleted in working tree (git shows `D docs/aha/copy.md`); no re-archive performed. |
| `apps/memberry/TDD_PROOF.md` | Out of scope for project-structure audit (app-tree concern). |

## PRD Organization Summary

| PRD / Requirement Area | Canonical File | Supporting Files | Historical Files |
|---|---|---|---|
| All PRDs | [`docs/product/prd/PRD_INDEX.md`](../../../product/prd/PRD_INDEX.md) | `docs/product/MASTER_PRD.md`, 22 product-module specs under `docs/product/modules/m*/`, 16 handler-level `docs/product/MODULE_SPEC.*.md`, `docs/ver-3/` snapshot | none in this round |

No PRDs were moved. `docs/product/prd/PRD_INDEX.md` already exists as the canonical index (created in commit `fcdfb666`). The two-layer PRD pattern documented in `docs/README.md` was preserved per the approved DOCS_MIGRATION_PLAN's explicit instruction to NOT migrate `docs/product/modules/m*/MODULE_SPEC.md` into `docs/product/prd/active/`.

## Root Cleanup Summary

| File / Folder | Action | Reason |
|---|---|---|
| `.DS_Store` × 10 (root + 9 subdirs) | **DELETED** from working tree | macOS cruft; untracked; `.gitignore` lines 131-132 already cover them. |
| `.gitignore` | **EDITED** — added `.audits/*.log` after line 150 | 75 untracked `*.log` files in `.audits/` were not previously gitignored. Now permanently ignored. |
| `docs/DOCS_INVENTORY.md` / `DOCS_MIGRATION_PLAN.md` / `DOCS_CLEANUP_REPORT.md` | **MOVED** to AHA folder structure | See Files Moved table |
| Root markdowns (`ARCHITECTURE`, `QUICKSTART`, `ROADMAP`, `VERTICAL_TDD`) | **Left in place** | Optional/cosmetic; not Must-Have |
| All tooling/state dirs (`.claude`, `.planning`, `.husky`, `.turbo`, etc.) | **Left in place** | Tool discoverability |

## References Updated

| File | Change |
|---|---|
| `docs/README.md:63` | `docs/DOCS_INVENTORY.md` + `docs/DOCS_MIGRATION_PLAN.md` + `docs/DOCS_CLEANUP_REPORT.md` → new `docs/aha/project-structure/{outputs,migration-plans}/old/*.2026-06-10.md` paths |
| `.gitignore:151` | Added `.audits/*.log` |

Internal self-references inside the *moved* historical files (e.g., DOCS_CLEANUP_REPORT.md referencing its companions) were intentionally NOT rewritten — they document the repo state as of 2026-06-10 and serve as a historical record.

References inside the still-active AHA outputs (`docs/aha/project-structure/outputs/DOCS_INVENTORY.md`, `docs/aha/project-structure/outputs/PRD_INDEX_DRAFT.md`, `docs/aha/project-structure/migration-plans/DOCS_MIGRATION_PLAN.md`) that mention the now-moved root workflow files were also left as-is — those texts describe state at audit time and the recommendations they make have now been executed (and are captured in this report).

## Indexes Created or Updated

| File | Purpose |
|---|---|
| `docs/INDEX.md` | **NEW** — top-level docs entry point, sectioned by Product/Architecture/Engineering/etc. |
| `docs/aha/project-structure/README.md` | **NEW** — AHA project-structure audit index (prompts/outputs/plans/reports) |
| `docs/aha/project-structure/reports/DOCS_AND_ROOT_CLEANUP_REPORT.md` | **NEW** — this file |

Not created:
- `docs/archive/ARCHIVE_INDEX.md` — no files archived this round (per prompt rule "Do not create empty folder structures unnecessarily").
- `docs/product/prd/PRD_INDEX.md` — already exists (untouched).

## Validation Performed

| Check | Result |
|---|---|
| `git mv` preserves history for 3 moved DOCS files | **OK** |
| No tracked `.DS_Store` files exist after deletion | **OK** (`git ls-files \| grep .DS_Store` = 0) |
| No external active doc still links to `docs/DOCS_INVENTORY.md`/`docs/DOCS_MIGRATION_PLAN.md`/`docs/DOCS_CLEANUP_REPORT.md` | **OK** — `docs/README.md` updated; the only remaining mentions are inside `docs/aha/project-structure/{outputs,migration-plans}/` AHA artifacts (historical descriptive content) |
| `.gitignore` patch matches pattern style | **OK** — `.audits/*.log` follows `.audits/*.json` / `.audits/*.txt` |
| `docs/aha/copy.md` not double-deleted | **OK** — already `D` in `git status`; no action taken |
| CI workflows reference `.audits/coverage-matrix.json` still resolve | **OK** — CI path unchanged (`.gitignore` only adds `.log`) |
| `.audits/PRODUCTION_AUDIT.md` (CLAUDE.md ref) still in place | **OK** — only tracked file in `.audits/` |
| Root tooling (bunfig, turbo, package.json, etc.) untouched | **OK** |
| `test-setup-root.ts` untouched | **OK** |
| `docker-compose.yml` + `docker/` untouched | **OK** |
| No source code, schema, migrations, lockfile, or generated files modified | **OK** |

## Remaining Risks

| Risk | Location | Recommendation |
|---|---|---|
| **`ARCHITECTURE.md` duplication unresolved** | `./ARCHITECTURE.md` (376 lines, "Architecture Guide") vs `docs/ARCHITECTURE.md` (253 lines, "Architecture") | Human author must decide canonical. Options: (a) keep both as distinct docs and rename one (e.g., `docs/ARCHITECTURE.md` → `docs/architecture/MONOREPO_ARCHITECTURE.md`); (b) merge content into one canonical; (c) keep both, formally cross-link. Prompt 04 should flag inbound link confusion. |
| **75 untracked `.audits/*.log` files remain on disk** | `.audits/` | Now gitignored; safe to `rm` locally at any time. Optional follow-up: `rm .audits/baseline-*.log .audits/contract-*.log`. |
| **Optional root-doc moves not executed** | `QUICKSTART.md`, `ROADMAP.md`, `VERTICAL_TDD.md` | If a future PR consolidates docs into `docs/`, do the moves in one coordinated change with all reference updates (~15+ inbound refs for `VERTICAL_TDD.md` alone). |
| **`apps/memberry/TDD_PROOF.md` at app root** | `apps/memberry/TDD_PROOF.md` | Out of scope here. Flag for an `apps/`-specific structure audit. |
| **Uncommitted source-file modifications coexisting with this cleanup** | Many `M` files under `apps/memberry/src/**` and `apps/admin/src/**` per `git status` | Pre-existing edits, unrelated to this audit. User should commit/discard them in a separate PR so this audit's commit stays focused. |
| **Internal AHA artifact refs point to pre-move paths** | `docs/aha/project-structure/outputs/DOCS_INVENTORY.md`, `PRD_INDEX_DRAFT.md`, `migration-plans/DOCS_MIGRATION_PLAN.md` | Intentional — these documents describe state at audit time. Prompt 04 should distinguish "historical descriptive ref" from "broken active link." |

## Recommended Next Actions

1. **Commit this cleanup** in a focused PR so the move + gitignore patch + new indexes land together. Suggested message: `chore(docs): execute AHA prompt 03 — relocate 2026-06-10 workflow docs to docs/aha/project-structure, gitignore .audits/*.log, add docs/INDEX.md`.
2. **Run Prompt 04 (Link and Reference Validation)** to catch any inbound links that may have decayed across the repo.
3. **Resolve `ARCHITECTURE.md` duplication** in a separate small PR. Decide canonical, rename or merge, then update inbound refs.
4. **Optional**: a follow-up "docs-consolidation" PR that moves `QUICKSTART.md` / `ROADMAP.md` / `VERTICAL_TDD.md` into `docs/` with all reference updates in one shot.
5. **Optional**: locally `rm .audits/baseline-*.log .audits/contract-*.log` to reclaim disk; not a repo concern after the gitignore patch.
