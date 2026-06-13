# Project Structure Inventory

> AHA prompt **02** output for **this repository** (dentalemon). Audit date: 2026-06-11.
> Inventory + classification only — **no moves performed**.
> Companion: `../migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`.
> Read alongside prompt 01 outputs: `./DOCS_INVENTORY.md`, `./PRD_INDEX_DRAFT.md`,
> `../migration-plans/DOCS_MIGRATION_PLAN.md`.

## Summary

- Root files scanned: **12 tracked** + 1 untracked (`.DS_Store`, gitignored)
- Root folders scanned: **8 source/tracked** (`apps`, `services`, `packages`, `specs`, `scripts`, `docs`, `.github`, `.claude`, `.devcontainer`) + **9 local/ignored** (`node_modules`, `outputs`, `test-results`, `.turbo`, `.gstack`, `.understand-anything`, `.craft-*` ×2, `.git`) + **2 anomalies** (`.superpowers`, `.hypothesis`)
- Misplaced file candidates: **1** (`.superpowers/brainstorm/**` — 4 tracked AI-scratch files)
- Duplicate candidates: **0** at root (docs-level duplicates covered by prompt 01)
- Temporary/generated candidates: **2 local dirs** (`outputs/` 19MB, `.hypothesis/` 156KB) + root `.DS_Store`
- High-risk move candidates: **1** (`test-setup.ts` — bunfig preload)
- Files recommended to keep in root: **all 12 tracked files**
- Files recommended for docs: **0**
- Files recommended for scripts/tools/infra: **0**
- Files recommended for archive/removal: **4** (`.superpowers/brainstorm/**`)

## Current Root Observations

- **Root is clean.** All 12 tracked files are conventional repo-wide entry points or workspace config: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`, `VERSION`, `.gitignore`, `package.json`, `bun.lock`, `bunfig.toml`, `turbo.json`, `test-setup.ts`. No stray plans, drafts, reports, or one-off scripts at root.
- **Folder naming is consistent and conventional**: `apps/` (3 frontends), `services/` (api-ts, api-ts-embedded, cadence), `packages/` (sdk-ts, eslint-config, typescript-config), `specs/` (TypeSpec API source of truth), `scripts/` (repo automation), `docs/`. No `modules/`, `tools/`, `tests/`, or `infra/` exist and none are needed — module pattern lives in `services/api-ts/src/handlers/{module}/`, tests are colocated per workspace, Docker config lives in workspace dirs.
- **AI/agent files are well-placed**: `CLAUDE.md` + `AGENTS.md` at root, skills in `.claude/skills/` (tracked, 17 skills), `.devcontainer/` tracked.
- **One committed-by-mistake artifact**: `.superpowers/brainstorm/57179-1778242755/` — 4 tracked files (3 brainstorm mockup HTMLs + a `state/server-stopped` marker). This is per-session AI brainstorm scratch; the directory is not gitignored.
- **One gitignore gap**: `.hypothesis/` (Python Hypothesis test cache, 156KB, untracked) is not in `.gitignore`. (The `outputs/` gap was found and fixed during Stage 0 of this pipeline: the unanchored `outputs/` pattern also swallowed `docs/aha/**/outputs/`; now anchored to `/outputs/`.)
- **Local-only disk cruft (gitignored, repo-safe)**: `outputs/` (19MB audit scratch), `test-results/` (16KB Playwright), `.turbo`, `.gstack`, `.understand-anything`, `.craft-dental-patient`, `.craft-dental-scheduling`, root `.DS_Store`. Optional local `rm`; no repo action.
- **Per-workspace docs are colocated by convention** (`apps/dentalemon/COMPONENTS.md`, `SCREENS.md`, per-workspace `CONTRIBUTING.md`, `services/api-ts/TESTING.md`/`TYPECHECKING.md`, `specs/api/CONTRACT.md`/`IMPLEMENTING.md`) — referenced from root README/CLAUDE; keep. One outlier: `services/cadence/FIXME.md` (NEEDS REVIEW — likely a live worklist, not a doc).
- **No root tsconfig/eslint config** — delegated to `packages/typescript-config` and `packages/eslint-config` workspaces. Not a problem. No `LICENSE`/`SECURITY.md` (private repo; separate decision, out of scope).

## Root File Assessment

| File | Current Purpose | Keep in Root? | Reason | Suggested New Location |
|---|---|---|---|---|
| `README.md` | Project entry point | Yes | Standard | — |
| `CONTRIBUTING.md` | Contributor guide | Yes | Standard; links into `docs/development/` | — |
| `CHANGELOG.md` | Release log | Yes | Standard | — |
| `CLAUDE.md` | AI agent instructions | Yes | Agent-file convention; heavily loaded each session | — |
| `AGENTS.md` | AI agent instructions (generic) | Yes | Agent-file convention | — |
| `VERSION` | Version marker (`0.2.0.0`) | Yes | Consumed by gstack `/ship` version-bump workflow | — |
| `.gitignore` | Ignore rules | Yes | Standard | — |
| `package.json` | Workspace root manifest | Yes | Tool-root discovery | — |
| `bun.lock` | Lockfile | Yes | Standard | — |
| `bunfig.toml` | Bun config (test preload) | Yes | **Do-Not-Move**: `preload = ["./test-setup.ts"]` | — |
| `turbo.json` | Turborepo pipeline | Yes | Tool-root discovery | — |
| `test-setup.ts` | Root test preload | Yes | **Do-Not-Move**: referenced by `bunfig.toml:19` | — |

## Root Folder Assessment

| Folder | Apparent Purpose | Standard Category | Issue | Suggested Action |
|---|---|---|---|---|
| `apps/` | 3 frontend apps (dentalemon, account, sample-workspace) | apps | none | Keep |
| `services/` | Backend + Rust crates | services (apps-equivalent) | none | Keep |
| `packages/` | Shared libs | packages | none | Keep |
| `specs/` | TypeSpec API source of truth | repo convention | none | Keep |
| `scripts/` | Repo automation | scripts | none | Keep |
| `docs/` | Documentation | docs | see prompt 01 | Keep (prompt 01 plan) |
| `.github/` | CI | CI | none | Keep |
| `.claude/` | Skills/settings (tracked) | AI tooling | none | Keep |
| `.devcontainer/` | Devcontainer (tracked) | tooling | none | Keep |
| `.superpowers/` | AI brainstorm scratch | **anomaly** | 4 files tracked by mistake; dir not gitignored | Remove from index + gitignore |
| `.hypothesis/` | Python test cache (untracked) | **anomaly** | not gitignored | Add to `.gitignore` |
| `outputs/`, `test-results/`, `.turbo/`, `.gstack/`, `.understand-anything/`, `.craft-*/` | Local tool state (gitignored) | local state | disk-only | No repo action; optional local `rm` |

## Misplaced Files

| File | Current Path | Suggested Path | Reason | Risk |
|---|---|---|---|---|
| Brainstorm scratch (4 files) | `.superpowers/brainstorm/57179-1778242755/**` | `git rm --cached` + gitignore `.superpowers/` | Per-session AI scratch committed by mistake (incl. a `server-stopped` state marker) | **Low** — no references found |
| `services/cadence/FIXME.md` | (in place) | **[NEEDS REVIEW]** | Worklist-style file in a workspace root; may be intentional for the Rust crate | Low |

## Duplicate / Temporary / Generated Files

| File | Reason Flagged | Suggested Action | Risk |
|---|---|---|---|
| `outputs/` (19MB, gitignored) | Audit working scratch | Optional local `rm -rf outputs/` | none (local only) |
| `test-results/` (gitignored) | Playwright artifacts | Optional local `rm` | none |
| `.hypothesis/` (untracked, NOT ignored) | Test cache | Add `.hypothesis/` to `.gitignore` | Low |
| root `.DS_Store` (gitignored) | macOS cruft | Optional local `rm` | none |

## High-Risk Items

| File / Folder | Risk | Recommendation |
|---|---|---|
| `test-setup.ts` + `bunfig.toml` | Test bootstrap breaks for every backend test | **Do not move** |
| `package.json`, `bun.lock`, `turbo.json` | Tool-root discovery | **Do not move** |
| `CLAUDE.md`, `AGENTS.md` | Agent workflow entry points | **Do not move** |

## Do Not Move Yet

| File / Folder | Reason |
|---|---|
| All 12 tracked root files | Conventional + load-bearing (see assessments above) |
| Per-workspace markdown (`apps/*/`, `services/*/`, `specs/api/`, `packages/*/`) | Colocation convention; referenced from root README/CLAUDE |
| `services/cadence/FIXME.md` | NEEDS REVIEW — possibly an active worklist |
