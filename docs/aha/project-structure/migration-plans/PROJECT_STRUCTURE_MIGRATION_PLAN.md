# Project Structure Migration Plan

> AHA prompt **02** output for **this repository** (dentalemon). Date: 2026-06-11.
> Plan only — execution happens via prompt 03 after human approval.
> Companion inventory: `../outputs/PROJECT_STRUCTURE_INVENTORY.md`.

## Proposed Root Structure

**Unchanged.** The root already matches monorepo convention; this plan contains zero
file *moves* at root — only an untracking, two gitignore lines, and optional local
disk cleanup.

```text
dentalemon/
├── .claude/  .devcontainer/  .github/
├── apps/  services/  packages/  specs/  scripts/  docs/
├── README.md  CONTRIBUTING.md  CHANGELOG.md  CLAUDE.md  AGENTS.md  VERSION
├── package.json  bun.lock  bunfig.toml  turbo.json  test-setup.ts  .gitignore
```

## Root Files to Keep

| File | Reason |
|---|---|
| All 12 tracked root files | Conventional entry points / workspace config / agent files; `test-setup.ts` is a bunfig preload (Do-Not-Move) |

## Proposed File Move Map

| # | Current Path | Proposed Path | Reason | Risk | References to Update |
|---|---|---|---|---|---|
| R1 | `.superpowers/brainstorm/57179-1778242755/**` (4 tracked files) | `git rm --cached` (keep on disk) | Per-session AI brainstorm scratch committed by mistake | **Low** | none found |
| R2 | `.gitignore` | add `.superpowers/` | Prevent future scratch commits | Low | — |
| R3 | `.gitignore` | add `.hypothesis/` | Untracked Python test cache, not currently ignored | Low | — |

## Proposed Archive Map

| Current Path | Archive Path | Reason | Risk |
|---|---|---|---|
| — | — | Nothing at root warrants archiving | — |

## Files to Keep In Place

| Current Path | Reason |
|---|---|
| Per-workspace markdown (`apps/dentalemon/{COMPONENTS,SCREENS}.md`, workspace `CONTRIBUTING.md`s, `services/api-ts/{TESTING,TYPECHECKING}.md`, `specs/api/{CONTRACT,IMPLEMENTING}.md`) | Colocation convention, referenced from root README/CLAUDE |
| `services/cadence/FIXME.md` | **[NEEDS REVIEW]** — possibly active worklist; do not touch this round |
| All gitignored local dirs (`outputs/`, `test-results/`, `.turbo/`, `.gstack/`, `.understand-anything/`, `.craft-*/`) | Local tool state; repo-invisible. Optional local `rm -rf outputs/` reclaims 19MB — user's choice, not part of execution |

## High-Risk Items

| Path | Risk | Recommendation |
|---|---|---|
| `test-setup.ts`, `bunfig.toml`, `package.json`, `bun.lock`, `turbo.json` | Build/test bootstrap | Do not move |
| `CLAUDE.md`, `AGENTS.md`, `.claude/` | Agent workflows | Do not move |

## Relationship to Docs Migration Plan

No conflicts. This plan touches only `.superpowers` untracking + 2 `.gitignore` lines;
the docs plan (`DOCS_MIGRATION_PLAN.md`) touches only paths under `docs/` plus 5
skill-file reference fixes. No file appears in both plans. Both plans agree the
repo's structural conventions stay as-is.

## Validation Checklist for Execution Phase

- [ ] package scripts checked (no script references `.superpowers` or `.hypothesis`)
- [ ] tsconfig paths checked (unaffected)
- [ ] import aliases checked (unaffected)
- [ ] CI workflows checked (no reference to removed paths)
- [ ] Docker/deployment files checked (unaffected)
- [ ] README/docs references checked
- [ ] AI prompt references checked (`.claude/skills/`)
- [ ] test references checked (`test-setup.ts` untouched)
