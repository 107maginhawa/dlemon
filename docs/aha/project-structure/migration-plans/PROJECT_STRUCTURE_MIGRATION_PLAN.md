# Project Structure Migration Plan

> AHA prompt **02** output. Read alongside `../outputs/PROJECT_STRUCTURE_INVENTORY.md`.
>
> **No moves performed.** This is a proposal for a later execution phase.
> Audit date: 2026-06-11.
>
> Companion to prompt **01**: `./DOCS_MIGRATION_PLAN.md`. This document covers
> the *wider project/root* structure; docs reorg lives there.

---

## Proposed Root Structure

> Current root is **mostly already aligned** with standard conventions. The
> recommended structure below documents what should exist, not what should
> change. The only *non-optional* changes are: (1) prune `.DS_Store` cruft,
> (2) gitignore `.audits/*.log`, (3) resolve `ARCHITECTURE.md` duplication.

```text
memberry/
├── .github/
│   └── workflows/                 # CI (ci.yml, contract.yml, deploy.yml, e2e-flake-tracking.yml,
│                                  #     migration-checklist.yml, monitor.yml, quality-gates.yml)
│       (no ISSUE_TEMPLATE, no PULL_REQUEST_TEMPLATE, no CODEOWNERS — optional adds)
├── .claude/                       # AI agent skills + local settings
│   ├── settings.local.json
│   └── skills/                    # 20 development skills (br-extract, commit, ... typespec)
├── .husky/                        # Git hooks
├── .planning/                     # gsd workflow state (gitignored)
├── .context/                      # tool session state (gitignored)
├── .gstack/                       # gstack tool state (gitignored)
├── .turbo/                        # turbo cache (gitignored)
├── .playwright-mcp/               # playwright MCP cache (gitignored)
├── .understand-anything/          # knowledge graph (gitignored)
├── .audits/                       # Audit reports + CI matrix
│   ├── PRODUCTION_AUDIT.md        # Referenced by CLAUDE.md
│   ├── coverage-matrix.json       # CI-written (gitignored)
│   └── (no committed *.log)       # → add .audits/*.log to .gitignore
├── apps/                          # Frontend apps
│   ├── admin/                     # Platform ops dashboard (port 3003)
│   └── memberry/                  # Product app (port 3004)
├── packages/                      # Shared libs
│   ├── eslint-config/
│   ├── sdk-ts/                    # Generated TanStack Query hooks + hand-written client
│   ├── typescript-config/
│   └── ui/
├── services/                      # Backend services
│   └── api-ts/                    # Reference Hono + Drizzle + Bun impl
├── specs/                         # API contract source
│   └── api/                       # TypeSpec + OpenAPI + Hurl tests
├── scripts/                       # Repo-level automation (lint gates, contract runner, scorecard)
│   ├── audit/                     # Sub-dir for audit scripts
│   ├── gates/                     # Sub-dir for CI gates
│   └── *.ts                       # Top-level scripts
├── testing/                       # Test tooling (factories, registry, inventory generators)
│   ├── factories/
│   ├── registry/
│   ├── scripts/
│   └── generated/                 # Generated inventories (consider gitignore strategy)
├── docker/                        # docker-compose-mounted configs (grafana, loki)
├── docs/                          # See ./DOCS_MIGRATION_PLAN.md
├── node_modules/                  # gitignored
├── README.md
├── CLAUDE.md                      # AI agent file (no separate AGENTS.md)
├── CONTRIBUTING.md
├── CHANGELOG.md
├── ARCHITECTURE.md                # ← needs duplicate-resolution vs docs/ARCHITECTURE.md
├── ROADMAP.md                     # Keep at root (optional move to docs/)
├── QUICKSTART.md                  # Keep at root (optional move to docs/)
├── VERTICAL_TDD.md                # Keep at root (optional move to docs/engineering/)
├── VERSION                        # 8-byte version marker
├── package.json
├── bun.lock
├── bunfig.toml                    # references ./test-setup-root.ts
├── turbo.json
├── docker-compose.yml             # references ./docker/...
├── railway.json
├── test-setup-root.ts             # bunfig preload — load-bearing
├── .env.example
└── .gitignore
```

Not present today (intentionally absent or optional adds):
- `LICENSE` — no decision recorded
- `SECURITY.md` — optional add
- `CODE_OF_CONDUCT.md` — optional add
- `AGENTS.md` — superseded by `CLAUDE.md`
- root `tsconfig.json` / `eslint.config.js` / `.editorconfig` — delegated to `packages/`
- `modules/` — does not match this repo's convention; modules live under `services/api-ts/src/handlers/{module}/`

---

## Root Files to Keep

| File | Reason |
|---|---|
| `README.md` | Repo entry point |
| `CLAUDE.md` | AI agent file (project + monorepo rules) |
| `CONTRIBUTING.md` | Contributor guide |
| `CHANGELOG.md` | Release log |
| `ARCHITECTURE.md` | Cross-ref'd from CLAUDE.md, CONTRIBUTING.md, QUICKSTART.md — **but** has a potential duplicate in `docs/` (see §Duplication) |
| `ROADMAP.md` | CLAUDE.md "Deferred Work" links here |
| `QUICKSTART.md` | Cross-ref'd from `.audits/PRODUCTION_AUDIT.md` and prompt-01 outputs |
| `VERTICAL_TDD.md` | Cross-ref'd from CLAUDE.md, CONTRIBUTING.md, 8+ skill files, `.planning/` plans, ARCHITECTURE.md |
| `VERSION` | Version marker; likely consumed by release tooling |
| `package.json`, `bun.lock` | Workspace root |
| `bunfig.toml` | Bun config; `preload = ["./test-setup-root.ts"]` |
| `turbo.json` | Turbo orchestrator |
| `docker-compose.yml` | Local dev infra entry; refs `./docker/...` |
| `railway.json` | Railway expects at root |
| `test-setup-root.ts` | Test preload, wired into `bunfig.toml` + 30+ test files |
| `.gitignore`, `.env.example` | Standard repo files |

---

## Proposed File Move Map

> All moves below are **OPTIONAL** unless flagged Must-Have. None are
> executed by this prompt.

| Current Path | Proposed Path | Reason | Risk | References to Update | Must-Have? |
|---|---|---|---|---|---|
| `./.DS_Store` (+ 9 other dirs) | DELETE | macOS cruft; already in `.gitignore` lines 131-132 (so untracked but present on disk) | **Low** — untracked | None | **Yes — Must-Have (delete)** |
| `.audits/*.log` (~50+ files) | `.audits/_archive/` OR DELETE; also add `.audits/*.log` to `.gitignore` | Historical contract/baseline run logs; not load-bearing | **Low-Medium** — confirm no script reads them; CI only reads `.audits/coverage-matrix.json` | None known | **Yes — Must-Have (gitignore + prune)** |
| `./ARCHITECTURE.md` | Resolve duplication with `docs/ARCHITECTURE.md`: diff first, then either (a) keep root as canonical and add `docs/ARCHITECTURE.md → root` pointer, or (b) keep docs as canonical and replace root with a one-line pointer | Two same-named files is a navigation hazard | **Medium** — root file referenced from CLAUDE.md + CONTRIBUTING.md + QUICKSTART.md + many skill / `.planning/` files | All `ARCHITECTURE.md` refs (wide fan-out — see Inventory) | **Yes — Must-Have (diff & resolve)** |
| `./QUICKSTART.md` | `docs/QUICKSTART.md` | Process doc fits `docs/` convention | **Medium** | `.audits/PRODUCTION_AUDIT.md`, `docs/aha/project-structure/migration-plans/DOCS_MIGRATION_PLAN.md`, `docs/aha/project-structure/outputs/DOCS_INVENTORY.md` (latter two are AHA artifacts themselves) | No (cosmetic) |
| `./ROADMAP.md` | `docs/ROADMAP.md` | Outward-facing roadmap fits `docs/` | **Medium** | `CLAUDE.md` "Deferred Work" link | No (cosmetic) |
| `./VERTICAL_TDD.md` | `docs/engineering/VERTICAL_TDD.md` | Development protocol → engineering docs bucket | **Medium-High** | CLAUDE.md, CONTRIBUTING.md, `.claude/skills/{br-extract,commit,contract-scaffold,develop,module-review,persona-audit,pre-commit}/SKILL.md`, `.planning/p15-middleware-refactor.md`, `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md`, multiple `.planning/phases/**/PLAN.md`, ARCHITECTURE.md | No (cosmetic) |
| `apps/memberry/TDD_PROOF.md` | Out of scope for root audit | Slice artifact misplaced at app root | n/a | n/a | Defer (different prompt) |

---

## Proposed Archive Map

| Current Path | Archive Path | Reason | Risk |
|---|---|---|---|
| `.audits/baseline-*.log`, `.audits/contract-*.log` (~50+) | `.audits/_archive/2026-06/` OR DELETE | Stale run output; only `.json`/`.txt` are gitignored, `.log` slipped through | **Low** — no known consumer; confirm during execution |
| (None at root level) | — | Root has no obvious archive candidates today | — |

---

## Files to Keep In Place

| Current Path | Reason |
|---|---|
| `test-setup-root.ts` | Wired into `bunfig.toml` preload + 30+ test files |
| `bunfig.toml`, `turbo.json`, `package.json`, `bun.lock` | Tool-discoverable only at root |
| `railway.json` | Railway hard-expects root manifest |
| `docker-compose.yml`, `docker/` | Compose `volumes` reference `./docker/...` paths |
| `.github/`, `.husky/`, `.claude/` | Tool discoverability |
| `apps/`, `packages/`, `services/`, `specs/`, `scripts/`, `testing/`, `docs/` | npm scripts + workspace coupling |
| `.planning/`, `.context/`, `.gstack/`, `.turbo/`, `.playwright-mcp/`, `.understand-anything/` | Tool state (gitignored) |
| `VERSION` | Likely consumed by release tooling — keep until producer/consumer mapped |
| `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.gitignore`, `.env.example` | Standard repo entry files |

---

## High-Risk Items

| Path | Risk | Recommendation |
|---|---|---|
| `test-setup-root.ts` | `bunfig.toml preload = ["./test-setup-root.ts"]` + 30+ component `.test.tsx` files reference root-relative path. Move silently breaks all unit tests. | **Do Not Move.** |
| `bunfig.toml` / `turbo.json` / `package.json` / `bun.lock` | Tool discovery is by-convention at workspace root. | **Do Not Move.** |
| `railway.json` | Railway deploys break silently if absent at root. | **Do Not Move** without Railway swap. |
| `docker-compose.yml` + `docker/` | Compose `volume` mounts reference `./docker/grafana`, `./docker/loki`. Moving `docker/` breaks `infra:up`. | **Do Not Move** as a pair. |
| `.audits/` (entire dir) | CI `.github/workflows/ci.yml:402-413` writes `coverage-matrix.json` here. `CLAUDE.md` references `PRODUCTION_AUDIT.md`. Wholesale move requires coordinated CI + docs update. | Clean *contents* (logs) only; keep dir. |
| `ARCHITECTURE.md` (root) | Wide reference fan-out. Duplication with `docs/ARCHITECTURE.md` must be resolved *before* either is moved. | **Diff first**, then decide. |
| `VERTICAL_TDD.md` | Largest fan-out of any single root markdown (skills + CLAUDE + CONTRIBUTING + planning). | If moved, single coordinated PR updating all 15+ refs. |
| `VERSION` | Unverified consumer — could be a release script or CI step. | Map producer/consumer before any move. |

---

## Relationship to Docs Migration Plan

This plan and `./DOCS_MIGRATION_PLAN.md` (prompt 01) are deliberately **non-overlapping**:

| Concern | Owned by |
|---|---|
| `docs/` internal reorg, PRD index, archive of stale workflow docs | `DOCS_MIGRATION_PLAN.md` |
| `docs/aha/copy.md` scratch-file disposition | `DOCS_MIGRATION_PLAN.md` |
| Stale doc-ref cleanup (CONTRIBUTING line 146, 2454; `scripts/ui-consistency-detect.ts` PATTERNS.lock.md) | `DOCS_MIGRATION_PLAN.md` (flagged for prompt 04) |
| Root `.md` placement (`ARCHITECTURE`, `ROADMAP`, `QUICKSTART`, `VERTICAL_TDD`) | **This plan** |
| Root `.DS_Store` cleanup | **This plan** |
| `.audits/*.log` cleanup + gitignore patch | **This plan** |
| `testing/`, `docker/`, `scripts/` placement | **This plan** |
| `.github/`, tool-state dirs, tooling config files at root | **This plan** |
| Root config files (`package.json`, `turbo.json`, `bunfig.toml`, etc.) | **This plan** |

If the four root markdowns (`QUICKSTART`, `ROADMAP`, `VERTICAL_TDD`, root `ARCHITECTURE`) are later moved into `docs/`, the move must be coordinated with `DOCS_MIGRATION_PLAN.md` so the docs-side index/PRDs see the new paths in the same PR.

---

## Validation Checklist for Execution Phase

- [ ] `package.json` scripts checked — any moved path is also updated in `scripts` (esp. `test:registry`, `test:inventory`, `test:br`, `lint:*`, `test:contract`)
- [ ] `tsconfig` paths checked — confirm no root `tsconfig.json` is added unintentionally; verify workspace `tsconfig.json` files still resolve `packages/typescript-config` correctly
- [ ] Import aliases checked — `@monobase/api-spec`, `@monobase/sdk-ts`, `@repo/eslint-config`, `@repo/typescript-config` unaffected by any move
- [ ] CI workflows checked — `.github/workflows/{ci,contract,deploy,e2e-flake-tracking,migration-checklist,monitor,quality-gates}.yml` references to `.audits/*`, `docs/*`, `scripts/*`, `testing/*` updated when sources move
- [ ] Docker/deployment files checked — `docker-compose.yml` volume mounts, `services/api-ts/Dockerfile`, `railway.json` `dockerfilePath` all still resolve
- [ ] README/docs references checked — `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `QUICKSTART.md`, `ROADMAP.md`, `VERTICAL_TDD.md` re-grepped after any path change
- [ ] AI prompt references checked — `.claude/skills/**/SKILL.md` re-grepped for moved paths; `.planning/**/PLAN.md` likewise
- [ ] Test references checked — `bunfig.toml preload`, `apps/*/playwright.config.ts`, `testing/scripts/*.ts`, `testing/registry/*.ts`, `services/api-ts/**/*.test.ts`, `apps/memberry/src/**/*.test.tsx`
- [ ] `.gitignore` updated — `.audits/*.log` added if log cleanup executed; verify no over-broad pattern shadows tracked files
- [ ] `.audits/coverage-matrix.json` write path preserved — CI step at `.github/workflows/ci.yml:402-413` still resolves
- [ ] If `ARCHITECTURE.md` duplication resolved — every inbound link redirected; `git log --follow` left intact via `git mv`
- [ ] `.DS_Store` purge — `git rm --cached` for any tracked instance (most should already be untracked); `find . -name .DS_Store -delete` for working-tree cleanup
