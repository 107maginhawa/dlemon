# Project Structure Inventory

> AHA prompt **02** output. Inventory + classification only — **no moves performed**.
> Audit date: 2026-06-11. Companion: `../migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`.
> Read alongside prompt **01** outputs:
> - `./DOCS_INVENTORY.md`
> - `./PRD_INDEX_DRAFT.md`
> - `../migration-plans/DOCS_MIGRATION_PLAN.md`

---

## Summary

- Root files scanned: **17** committed + **1** untracked (`.DS_Store`)
- Root folders scanned: **19** (5 source, 14 tooling/state/build)
- Misplaced file candidates: **5** (`.DS_Store` × N, plus 4 root markdowns that are arguably docs)
- Duplicate candidates: **1** (`ARCHITECTURE.md` exists at root AND in `docs/`)
- Temporary/generated candidates: **~60+** (`.audits/*.log`, `.playwright-mcp/console-*.log` × 474, `.DS_Store` × 10)
- High-risk move candidates: **6** (`test-setup-root.ts`, `bunfig.toml`, `turbo.json`, `railway.json`, `docker-compose.yml`, `docker/`)
- Files recommended to keep in root: **15** (README, CLAUDE, CONTRIBUTING, CHANGELOG, package.json, bun.lock, bunfig.toml, turbo.json, docker-compose.yml, railway.json, .gitignore, .env.example, VERSION, ARCHITECTURE.md, test-setup-root.ts)
- Files recommended for docs: **3** suggested (`QUICKSTART.md`, `ROADMAP.md`, `VERTICAL_TDD.md`) — all NEEDS REVIEW, none Must-Have
- Files recommended for scripts: **0** (already well-organized)
- Files recommended for tools: **0** (no candidates today)
- Files recommended for infra: **0** Must-Have. `docker/`, `docker-compose.yml`, `railway.json` could move to `infra/` later but currently load-bearing at root.
- Files recommended for archive: **~50 `.audits/*.log`** cruft logs (NEEDS REVIEW) + 1 `apps/memberry/TDD_PROOF.md` (top-level slice artifact — out of scope here, flagged for docs prompt)

---

## Current Root Observations

- **Root is mostly clean.** Cluttered only by (a) `.DS_Store` cruft and (b) 4 stale-but-canonical Markdown process docs that have grown into root over time (`QUICKSTART.md`, `ROADMAP.md`, `VERTICAL_TDD.md`, plus root `ARCHITECTURE.md`).
- **Folder naming is consistent.** `apps/`, `packages/`, `services/`, `specs/`, `scripts/`, `docs/` follow standard monorepo conventions.
- **Source layout uses `services/api-ts` + `specs/api`** as a polyglot-ready shape (sibling `api-rs` / `api-go` documented in `specs/api/IMPLEMENTING.md`). Do NOT impose `modules/` — this repo's module pattern lives under `services/api-ts/src/handlers/{module}/` and is not a root concern.
- **No `tests/` at root** — repo convention is per-app/per-service test colocation (`apps/*/tests/`, `services/api-ts/src/**/*.test.ts`, `specs/api/tests/contract/`). The root **`testing/`** folder is a tooling/factories area (registry, factories, inventory generators), not a test suite — name is a slight foot-gun but correct in spirit.
- **AI/agent files are well-placed.** `.claude/`, `CLAUDE.md`, `.planning/` (gsd), `.gstack/`, `.understand-anything/` live in conventional locations. No `AGENTS.md` exists — this repo uses CLAUDE.md as its agent file (per user's preference).
- **Tool/agent state dirs are gitignored.** `.planning/`, `.context/`, `.audits/*.json`, `.audits/*.txt`, `.turbo`, `.playwright-mcp`, `.gstack/`, `.understand-anything/` all in `.gitignore`. **Gap:** `.audits/*.log` is NOT ignored — explains why ~50 `baseline-*.log` / `contract-*.log` files are committed under `.audits/`.
- **`.DS_Store` polluted** — 10 found despite `.gitignore` covering them. Either untracked-but-present or historically committed; recheck during execution.
- **Config files NOT at root** that conventions sometimes expect: no `LICENSE`, no `SECURITY.md`, no `CODE_OF_CONDUCT.md`, no root `tsconfig.json`, no root `eslint.config.js`, no root `.editorconfig`. None are problems — the monorepo delegates to `packages/typescript-config` and `packages/eslint-config` workspaces. Adding `LICENSE` / `SECURITY.md` is a separate decision, out of scope for this audit.
- **Build/test/lint config and scripts are well-modularized**: 26 npm scripts, all dispatching to `turbo`, `docker compose`, `bun scripts/*.ts`, or `husky`. No misplaced root automation.
- **Generated/committed-by-mistake outputs noticed**:
  - `.audits/*.log` (~50+ contract-*, baseline-* logs)
  - `.playwright-mcp/console-*.log` (474 files — gitignored, but the dir is huge on disk)
  - `testing/generated/*.json` (intentional generated artifacts; consider gitignore strategy in a future audit)
- **CI-affecting risk**: `.github/workflows/ci.yml` writes to `.audits/coverage-matrix.json` (line 402–413). Anything moving `.audits/` would require CI workflow updates.

---

## Root File Assessment

| File | Current Purpose | Keep in Root? | Reason | Suggested New Location |
|---|---|---|---|---|
| `README.md` | Project entry point | **Yes** | Standard repo entry | — |
| `CLAUDE.md` | AI agent instructions | **Yes** | AI agent file convention | — |
| `CONTRIBUTING.md` | Contributor guide | **Yes** | Standard contributor entry | — |
| `CHANGELOG.md` | Release log | **Yes** | Repo-wide release history | — |
| `ARCHITECTURE.md` | System architecture | **Yes** (with caveat) | Cross-referenced by QUICKSTART + CLAUDE.md + CONTRIBUTING; root entry is conventional. **BUT** see Duplicate section — also exists at `docs/ARCHITECTURE.md` | (Optional) consolidate into `docs/ARCHITECTURE.md`; currently load-bearing |
| `QUICKSTART.md` | Quick local setup | **Keep for now** | Standard contributor entry; referenced by `.audits/PRODUCTION_AUDIT.md` and prompt-01 outputs | (Optional, NEEDS REVIEW) `docs/QUICKSTART.md` |
| `ROADMAP.md` | Roadmap of work | **Keep for now** | Referenced by CLAUDE.md "Deferred Work" section; outward-facing | (Optional, NEEDS REVIEW) `docs/ROADMAP.md` |
| `VERTICAL_TDD.md` | Development protocol | **Keep for now** | CLAUDE.md ("Development Protocol" link) + many skill files reference it from root | (Optional, NEEDS REVIEW) `docs/engineering/VERTICAL_TDD.md` |
| `VERSION` | Version marker (8 B) | **Yes** | Likely consumed by release tooling; small enough to keep | — |
| `package.json` | Workspace root | **Yes** | Required by Bun + Turbo | — |
| `bun.lock` | Lockfile | **Yes** | Required at root | — |
| `bunfig.toml` | Bun test/install config | **Yes** | Bun resolves from root; `preload = ["./test-setup-root.ts"]` ties to root path | — |
| `turbo.json` | Turbo monorepo orchestrator | **Yes** | Turbo expects root | — |
| `docker-compose.yml` | Local dev infra (postgres, mailpit, stripe-mock, grafana, loki) | **Yes** | Convention; npm scripts (`infra:up`) call from root | — |
| `railway.json` | Railway deploy manifest | **Yes** | Railway expects `railway.json` at repo root | — |
| `.gitignore` | Git ignore rules | **Yes** | Required at root | — |
| `.env.example` | Env var template | **Yes** | Conventional | — |
| `test-setup-root.ts` | Bun test preload (mocks, polyfills, no-ops e2e specs) | **Yes** | `bunfig.toml` `preload = ["./test-setup-root.ts"]` + 30+ `.test.tsx` files reference relative path. **High risk to move.** | — |
| `.DS_Store` | macOS metadata cruft | **No** | Useless; covered by `.gitignore` already | DELETE |

---

## Root Folder Assessment

| Folder | Apparent Purpose | Standard Category | Issue | Suggested Action |
|---|---|---|---|---|
| `apps/` | Frontend apps (admin, memberry) | `apps/` | None | Keep |
| `packages/` | Shared libs (sdk-ts, eslint-config, typescript-config, ui) | `packages/` | None | Keep |
| `services/` | Backend services (api-ts) | `apps/`-equivalent | None | Keep |
| `specs/` | TypeSpec API contract + Hurl tests | `packages/`-equivalent (spec workspace) | None | Keep — load-bearing for SDK + impl generation |
| `scripts/` | Repo automation (gates, lints, contract runner, etc.) | `scripts/` | One `.DS_Store` inside; `audit/` + `gates/` subdirs are well-organized | Keep |
| `docs/` | Documentation | `docs/` | Covered by prompt 01 | Keep — see DOCS_MIGRATION_PLAN |
| `testing/` | Test infrastructure (factories, registry, inventory generators, `generated/`) | Closest match: `tools/` or `tests/` | Naming clash with potential `tests/` convention; folder is actually **test tooling**, not a test suite. Referenced by `test:registry`, `test:inventory`, `test:br` npm scripts. | Keep — moving would break npm scripts |
| `docker/` | Grafana dashboards + Loki config mounted by `docker-compose.yml` | `infra/` | Functional, but loose at root | Keep — `docker-compose.yml` references `./docker/...` paths |
| `.github/` | CI workflows (7 files), no issue/PR templates | `.github/` | None | Keep |
| `.claude/` | AI skills + settings.local.json | AI/dev tooling | None | Keep |
| `.husky/` | Git hooks (pre-commit) | Standard | None | Keep |
| `.planning/` | gsd workflow state (gitignored) | Tool state | None | Keep — gitignored |
| `.context/` | Codex session id (gitignored) | Tool state | Single line file | Keep — gitignored |
| `.gstack/` | gstack tool state (gitignored) | Tool state | None | Keep — gitignored |
| `.turbo/` | Turbo cache (gitignored) | Build cache | None | Keep — gitignored |
| `.playwright-mcp/` | Playwright MCP console logs — 474 files, ~MB | Tool cache | Already gitignored but huge on disk | Keep (consider local cleanup; not a repo concern since ignored) |
| `.understand-anything/` | Knowledge graph + fingerprints (gitignored) | Tool state | Multi-MB JSON | Keep — gitignored |
| `.audits/` | Audit outputs (PRODUCTION_AUDIT.md + ~60 `*.log` files) | Mixed: `docs/audits/` for the `.md`, `tmp/` for the logs | `*.json` + `*.txt` gitignored, but `*.log` NOT. Most logs are baseline/contract run artifacts — historical cruft. CI writes `coverage-matrix.json` here. | NEEDS REVIEW — see Migration Plan |
| `node_modules/` | Dependencies (gitignored) | Standard | None | Keep |

---

## Misplaced Files

| File | Current Path | Suggested Path | Reason | Risk |
|---|---|---|---|---|
| `.DS_Store` | `./` and 9 other dirs | DELETE | macOS cruft; `.gitignore` already covers it (lines 131-132). Currently untracked but cluttering directory listings. | **Low** — delete in execution phase |
| `ARCHITECTURE.md` (root) | `./ARCHITECTURE.md` | (Optional) Consolidate with `docs/ARCHITECTURE.md` | Duplication risk: same name lives at both `./ARCHITECTURE.md` (18 KB) and `docs/ARCHITECTURE.md`. Prompt-01 inventory already KEEPS the docs version. Need to confirm they aren't divergent before either is moved. | **Medium** — likely high reference count; needs diff first |
| `QUICKSTART.md` | `./QUICKSTART.md` | (Optional) `docs/QUICKSTART.md` | Process doc, fits `docs/`. Referenced from `.audits/PRODUCTION_AUDIT.md` + prompt-01 inventory + `.understand-anything/`. | **Medium** — handful of refs to update |
| `ROADMAP.md` | `./ROADMAP.md` | (Optional) `docs/ROADMAP.md` | Outward-facing roadmap, fits `docs/`. Referenced by CLAUDE.md "Deferred Work" section. | **Medium** — single explicit ref in CLAUDE.md + many in `.planning/` |
| `VERTICAL_TDD.md` | `./VERTICAL_TDD.md` | (Optional) `docs/engineering/VERTICAL_TDD.md` | Development protocol — fits `docs/engineering/`. Referenced by CLAUDE.md, CONTRIBUTING.md, 8+ skill files, `.planning/` plans, ARCHITECTURE.md. | **Medium-High** — wide reference fan-out |

> None of the above are Must-Have. All four root markdowns work today; moving them is cosmetic alignment.

---

## Duplicate / Temporary / Generated Files

| File | Reason Flagged | Suggested Action | Risk |
|---|---|---|---|
| `ARCHITECTURE.md` at root + `docs/ARCHITECTURE.md` | Two files, same name, both authoritative? | Diff the two; decide canonical; redirect the other. Do NOT auto-delete. | **Medium** |
| `.DS_Store` × 10 (`./`, `docs/`, `docs/aha/`, `docs/aha/project-structure/`, `scripts/`, `apps/`, `apps/memberry/`, `apps/memberry/tests/`, `services/`, `services/api-ts/`) | macOS metadata | Delete; already gitignored | **Low** |
| `.audits/baseline-*.log`, `.audits/contract-*.log` (~50+ files) | Historical run logs; sit in committed dir | NEEDS REVIEW — likely archive/delete + add `.audits/*.log` to `.gitignore`. CI consumer (`.audits/coverage-matrix.json`) is separate. | **Low-Medium** — confirm no script reads them |
| `.playwright-mcp/console-*.log` × 474 | Local tool cache | Already gitignored. Optional: local prune. Not a repo concern. | **Low** |
| `apps/memberry/TDD_PROOF.md` | Slice artifact at app root, not at slice path | Out of scope for root audit — flag for prompt that audits app trees. | — |

---

## High-Risk Items

| File / Folder | Risk | Recommendation |
|---|---|---|
| `test-setup-root.ts` | Hard-coded path in `bunfig.toml` (`preload = ["./test-setup-root.ts"]`) AND ~30+ frontend `.test.tsx` files import via relative paths. | **Do Not Move.** Document why in CONTRIBUTING. |
| `bunfig.toml` | Bun discovers from process cwd / repo root. | **Do Not Move.** |
| `turbo.json` | Turbo expects at workspace root. | **Do Not Move.** |
| `package.json` | Workspace root; required at top. | **Do Not Move.** |
| `bun.lock` | Lockfile peer of `package.json`. | **Do Not Move.** |
| `railway.json` | Railway looks for `railway.json` at repo root. Moving would silently break deploys. | **Do Not Move** unless Railway is replaced. |
| `docker-compose.yml` | Devs and CI invoke from root (`docker compose up`); paths inside reference `./docker/...`. | **Do Not Move.** |
| `docker/` (grafana + loki) | Referenced by `docker-compose.yml` volume mounts; `.understand-anything/` indexes the contents. | **Do Not Move** without updating docker-compose. |
| `.audits/` | CI workflow `ci.yml:402–413` writes `coverage-matrix.json` here; CLAUDE.md references `PRODUCTION_AUDIT.md`. | Keep dir; clean logs only. |
| `testing/` | `test:registry`, `test:inventory`, `test:br` npm scripts reference `testing/scripts/*.ts` and `testing/registry/*.ts`. | **Do Not Move.** Renaming requires updating `package.json` scripts. |
| `VERTICAL_TDD.md` | Cross-referenced by CLAUDE.md + CONTRIBUTING.md + 8+ skill files + `.planning/` plans. | If moved, update all refs in one PR. **Medium-High** reference risk. |

---

## Do Not Move Yet

| File / Folder | Reason |
|---|---|
| `test-setup-root.ts` | Wired into `bunfig.toml` preload + 30+ test files. |
| `bunfig.toml`, `turbo.json`, `package.json`, `bun.lock` | Tool-discoverable only from root. |
| `railway.json` | Railway hard-expects root manifest. |
| `docker-compose.yml`, `docker/` | Compose path coupling. |
| `.github/` | CI discoverability. |
| `.husky/` | Husky hook resolution. |
| `.claude/`, `.planning/`, `.context/`, `.gstack/`, `.turbo/`, `.playwright-mcp/`, `.understand-anything/` | Tool state — moving breaks tooling. |
| `apps/`, `packages/`, `services/`, `specs/`, `scripts/`, `testing/`, `docs/` | Workspace + npm-script coupled. |
| `ARCHITECTURE.md` (root) | Wide reference fan-out; resolve duplication first (see Migration Plan §Duplication). |
| `ROADMAP.md`, `QUICKSTART.md`, `VERTICAL_TDD.md` | Move is cosmetic — defer to a coordinated docs-move PR if at all. |
| `VERSION` | Probably consumed by release tooling — verify producer/consumer before moving. |
| `.audits/PRODUCTION_AUDIT.md` | Referenced by `CLAUDE.md`; cleanup of sibling `.log` files is separate from the `.md`. |
