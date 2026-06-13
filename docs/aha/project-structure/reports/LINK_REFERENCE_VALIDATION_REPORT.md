# Link and Reference Validation Report

> AHA prompt **04** execution report for **this repository** (dentalemon). Date: 2026-06-11.
> Predecessors: `../outputs/DOCS_INVENTORY.md`, `../outputs/PRD_INDEX_DRAFT.md`,
> `../outputs/PROJECT_STRUCTURE_INVENTORY.md`, `../migration-plans/*.md`,
> `./DOCS_AND_ROOT_CLEANUP_REPORT.md`.

## Summary

- Markdown files checked: **~300 active** (all `docs/**/*.md` excluding `docs/archive/` and `docs/aha/project-structure/examples/`, which are intentionally historical) + 4 root markdowns
- Root files checked: `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`
- Config files checked: `.gitignore` (new patterns verified), `bunfig.toml` (untouched)
- Scripts checked: `rg` sweep for all cleanup old-paths across the whole repo
- CI files checked: not modified by cleanup; `docs/security/SECURITY_ADVISORIES.md` (the one CI-referenced doc) untouched
- Broken links found: **0**
- Broken links fixed: **0** (none to fix)
- Stale references found: **0 in active files**
- Stale references fixed: 0
- Items needing review: **2** (pre-existing content questions, not link breaks — see below)

## Validation Method

- Custom relative-link checker: extract `](...)` targets from every active markdown
  file, resolve against the file's directory, `test -e` each target. **122 relative
  links extracted, all resolve.** Checker verified with a negative control (fake
  link correctly flagged).
- `rg` sweep for every old path from the cleanup report (`docs/research/`,
  `module-gap-plans/aha`, `docs/product/MASTER_PRD`, `docs/aha/prompts/copy.md`)
  across the entire repo excluding archive + AHA-historical artifacts: **0 hits**.
- Canonical indexes individually checked: `docs/README.md`, `docs/prd/PRD_INDEX.md`,
  `docs/archive/ARCHIVE_INDEX.md`, `docs/aha/project-structure/README.md`,
  `examples/README.md`, root `README.md`/`CONTRIBUTING.md`/`CLAUDE.md`/`AGENTS.md`: all clean.
- Limitations: external HTTP links not validated (no link checker run); anchor
  fragments (`#section`) not validated; backtick-style path mentions (non-link
  prose) validated only for the cleanup-affected paths.

## Missing Expected Files

| Expected File | Required? | Status | Notes |
|---|---|---|---|
| `docs/prd/PRD_INDEX.md` | Yes | Present | Created in prompt 03 |
| `docs/archive/ARCHIVE_INDEX.md` | Yes | Present | Created in prompt 03 |
| `docs/INDEX.md` | No | **Deliberately absent** | `docs/README.md` is the repo's index convention (documented deviation in cleanup report) |
| `docs/aha/project-structure/prompts/01..04-*.md` | Yes | All 4 present | OK |
| `outputs/{DOCS_INVENTORY,PRD_INDEX_DRAFT,PROJECT_STRUCTURE_INVENTORY}.md` | Yes | All present | OK |
| `migration-plans/{DOCS,PROJECT_STRUCTURE}_MIGRATION_PLAN.md` | Yes | Both present | OK |
| `reports/DOCS_AND_ROOT_CLEANUP_REPORT.md` | Yes | Present | OK |

## Broken Links

| File | Broken Reference | Issue | Suggested Fix | Status |
|---|---|---|---|---|
| _none_ | — | — | — | — |

## Stale References to Old Paths

| File | Old Reference | New Reference | Status |
|---|---|---|---|
| _none in active files_ | — | — | — |

Notes:
- `docs/reviews/**` links matching `../research/` resolve to the **internal**
  `docs/reviews/research/` directory (verified), not the archived `docs/research/`.
- `docs/archive/research-2026-06/**` internal cross-links reference pre-archive
  sibling paths — intentional historical record (all siblings moved together, so
  relative links between them still resolve anyway).
- `docs/aha/project-structure/{outputs,migration-plans}/*.md` describe pre-cleanup
  state by design (point-in-time inventory).

## PRD Index Validation

| PRD Index Entry | Target Exists? | Issue | Status |
|---|---|---|---|
| `v3-dentalemon.md` | Yes | — | OK |
| `BUSINESS_RULES.md`, `ACCEPTANCE_CRITERIA.md` | Yes | — | OK |
| `context/design-doc.md`, `context/wireframes/`, `context/workspace-wireframe.html` | Yes | — | OK |
| `../clinical/STANDARDS_COMPLIANCE.md`, `../reviews/IMPROVEMENT_BACKLOG.md`, `../product/MODULE_MAP.md` | Yes | — | OK |

## Archive Index Validation

| Archive Entry | Target Exists? | Original Path Recorded? | Status |
|---|---|---|---|
| `research-2026-06/` | Yes (13 files) | Yes (`docs/research/`) | OK — reason + date + canonical replacement recorded |

## AHA Project Structure Validation

| File / Folder | Expected? | Exists? | Issue | Status |
|---|---|---|---|---|
| `prompts/` (4 prompt files) | Yes | Yes | — | OK |
| `outputs/` (3 fresh outputs) | Yes | Yes | — | OK |
| `migration-plans/` (2 fresh plans) | Yes | Yes | — | OK |
| `reports/` (this + cleanup report) | Yes | Yes | — | OK |
| `examples/` (quarantined foreign artifacts + warning README) | Yes | Yes | — | OK |
| `README.md` | Yes | Yes | links verified | OK |

## Root Reference Validation

| File | Reference | Issue | Status |
|---|---|---|---|
| `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md` | all relative links | none | OK |
| `CLAUDE.md` → `docs/architecture/ARCHITECTURE.md`, `docs/development/VERTICAL_TDD.md` | untouched by cleanup | — | OK |

## Prompt / AHA Reference Validation

| File | Reference | Issue | Status |
|---|---|---|---|
| 5 edited `.claude/skills/*/SKILL.md` | `docs/prd/v3-dentalemon.md` | target exists | OK |
| `docs/aha/prompts/00..07-*.md` | sole remaining copy of the audit pack | — | OK |

## Script / Config / CI Reference Validation

| File | Reference | Issue | Status |
|---|---|---|---|
| `scripts/audit-traceability.ts` | `docs/prd/BUSINESS_RULES.md` + `ACCEPTANCE_CRITERIA.md` | files untouched | OK |
| `.github/workflows/quality.yml` | `docs/security/SECURITY_ADVISORIES.md` | untouched | OK |
| `.gitignore` | `/outputs/`, `.superpowers/`, `.hypothesis/` | `git check-ignore` verified | OK |
| `bun run typecheck` | — | green post-cleanup (cleanup report) | OK |

## Fixed References

| File | Change |
|---|---|
| _none required this round_ | — |

## Needs Review

| File | Reference | Reason |
|---|---|---|
| `docs/architecture/DOMAIN_MODEL.md` | filename collision with `docs/product/DOMAIN_MODEL.md` | Complementary docs sharing a name — rename decision pending (tracked in `docs/README.md` Known follow-ups) |
| `docs/architecture/ROLE_MATRIX.md` | content stale vs `membership.schema.ts` | Content merge/remove decision pending (tracked in Known follow-ups) |

## Final Assessment

**Safe.**

- All 122 relative markdown links in active docs resolve; canonical indexes clean.
- Zero stale references to any path touched by the cleanup.
- Load-bearing docs (traceability inputs, CI-referenced advisories, skill inputs)
  verified untouched and resolving; typecheck green.
- The two NEEDS-REVIEW items are pre-existing content questions, not broken
  references, and are documented in `docs/README.md` Known follow-ups.

## Recommended Next Action

1. The docs tree is now clean for the **module audit** (`docs/aha/prompts/` pack) — proceed.
2. Optional: add `lychee` or `markdown-link-check` to CI to catch future link drift.
3. Follow-ups already tracked: architecture doc rename/merge; archive dated audit snapshots post-sweep.
