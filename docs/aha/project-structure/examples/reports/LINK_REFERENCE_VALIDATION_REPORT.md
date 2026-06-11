# Link and Reference Validation Report

> AHA prompt **04** execution report. Date: 2026-06-11.
> Predecessors: `../outputs/DOCS_INVENTORY.md`, `../migration-plans/DOCS_MIGRATION_PLAN.md`,
> `../outputs/PRD_INDEX_DRAFT.md`, `../outputs/PROJECT_STRUCTURE_INVENTORY.md`,
> `../migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`,
> `./DOCS_AND_ROOT_CLEANUP_REPORT.md`.

## Summary

- Markdown files checked: 448 (`docs/` 440 + root 8)
- Root files checked: 8 (`README`, `ARCHITECTURE`, `CONTRIBUTING`, `CLAUDE`, `QUICKSTART`, `ROADMAP`, `VERTICAL_TDD`, `.audits/PRODUCTION_AUDIT.md`)
- Config files checked: spot-checked via `rg` (no broken refs found in active configs)
- Scripts checked: spot-checked (no broken refs found)
- CI files checked: not modified by prior cleanup; not re-validated
- Broken links found: **3** (incl. a second OLI-archive ref discovered inside `docs/ARCHITECTURE.md` while resolving the duplication risk)
- Broken links fixed: **3**
- Stale references found: **0 in active docs** (only descriptive historical mentions remain inside AHA artifacts)
- Stale references fixed: 0
- Items needing review: **0** (`ARCHITECTURE.md` duplication resolved via redirect)

## Validation Method

- `rg` for old paths from `DOCS_AND_ROOT_CLEANUP_REPORT.md` "Files Moved" table (`docs/DOCS_INVENTORY.md`, `docs/DOCS_MIGRATION_PLAN.md`, `docs/DOCS_CLEANUP_REPORT.md`)
- `rg` for legacy archive paths (`docs/_archive/`, `_archive/oli`, `scripts/codebase-map/`, `docs/adr/`, `docs/roadmap/`, `docs/MULTI-TENANT-AUDIT`, `docs/QA-COVERAGE-MATRIX`)
- `rg` for `ARCHIVE_INDEX`, `PRD_INDEX`
- `test -e` per path on every Markdown link in `docs/README.md`, `docs/INDEX.md`, `docs/product/prd/PRD_INDEX.md`, `docs/aha/project-structure/README.md`, root `README.md`
- Glob-excluded `docs/aha/project-structure/outputs/old/` and `docs/aha/project-structure/migration-plans/old/` from stale-ref scans (historical descriptive content per cleanup-report §94)
- No external Markdown link checker (`markdown-link-check`, `lychee`) was run. External HTTP links not validated.
- Anchors (`#section`) not validated.

## Missing Expected Files

| Expected File | Required? | Status | Notes |
|---|---|---|---|
| `docs/INDEX.md` | Yes | Present | OK |
| `docs/product/prd/PRD_INDEX.md` | Yes | Present | OK |
| `docs/archive/ARCHIVE_INDEX.md` | Optional | **Absent** | Per cleanup-report §"Indexes Created or Updated": no archive bucket created this round — zero archived files. Not required. |
| `docs/aha/project-structure/README.md` | Yes | Present | OK (1 broken link fixed below) |
| `docs/aha/project-structure/prompts/01-*.md` … `04-*.md` | Yes | All 4 present | OK |
| `docs/aha/project-structure/outputs/{DOCS_INVENTORY,PRD_INDEX_DRAFT,PROJECT_STRUCTURE_INVENTORY}.md` | Yes | All 3 present | OK |
| `docs/aha/project-structure/migration-plans/{DOCS,PROJECT_STRUCTURE}_MIGRATION_PLAN.md` | Yes | Both present | OK |
| `docs/aha/project-structure/reports/DOCS_AND_ROOT_CLEANUP_REPORT.md` | Yes | Present | OK |

## Broken Links

| File | Broken Reference | Issue | Suggested Fix | Status |
|---|---|---|---|---|
| `docs/aha/project-structure/README.md:14` | `./prompts/04-link-and-reference-validation.md` | Actual filename is `04-link-reference-validation.md` (no `-and-`) | Rename link target | **FIXED** |
| `docs/architecture/adr/0005-person-module-as-pii-safeguard.md:50` | `docs/_archive/oli/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` | File permanently removed in 2026-06-10 OLI-archive cleanup (commit `79ecc213`) | Replaced with live Drizzle schema `services/api-ts/src/handlers/person/repos/person.schema.ts` | **FIXED** |

## Stale References to Old Paths

| File | Old Reference | New Reference | Status |
|---|---|---|---|
| _none in active docs_ | — | — | — |

Notes:
- `docs/README.md:55-59` mentions old paths (`docs/_archive/oli/`, `docs/adr/`, `docs/MULTI-TENANT-AUDIT.md`, `docs/QA-COVERAGE-MATRIX.md`, `docs/roadmap/`) inside a "Recent restructure (2026-06-10)" descriptive section — these are intentional historical notes, not active links. Left as-is.
- `docs/aha/project-structure/outputs/DOCS_INVENTORY.md`, `outputs/PRD_INDEX_DRAFT.md`, `migration-plans/DOCS_MIGRATION_PLAN.md` mention `docs/DOCS_INVENTORY.md` / `DOCS_MIGRATION_PLAN.md` / `DOCS_CLEANUP_REPORT.md` as point-in-time descriptions of the pre-move repo state. Per cleanup-report §"References Updated" and §"Remaining Risks", these are deliberately preserved.
- `docs/aha/project-structure/outputs/old/*.md` and `migration-plans/old/*.md` describe the 2026-06-10 cleanup itself — by design they reference pre-move paths.

## PRD Index Validation

`docs/product/prd/PRD_INDEX.md` — all 60+ link targets resolved.

| PRD Index Entry | Target Exists? | Issue | Status |
|---|---|---|---|
| Master PRD (`../MASTER_PRD.md`) | Yes | — | OK |
| 18 cross-module foundation docs (`../DOMAIN_MODEL.md` … `../SEED_MANIFEST.md`) | Yes (18/18) | — | OK |
| 22 product-module dirs (`../modules/m01-…` … `../modules/m22-…`) | Yes (22/22) | — | OK |
| 16 handler-level `MODULE_SPEC.*.md` entries | Yes (16/16) | — | OK |
| 6 audit-derived `quality/SCOPE.*.md` + `R0_BASELINE.md` + `R1_CHAPTERS_SCOPE.md` | Yes (6/6) | — | OK |
| 3 historical `ver-3/` entries | Yes (3/3) | — | OK |

## Archive Index Validation

| Archive Entry | Target Exists? | Original Path Recorded? | Status |
|---|---|---|---|
| _no archive bucket exists this round_ | n/a | n/a | n/a |

## AHA Project Structure Validation

| File / Folder | Expected? | Exists? | Issue | Status |
|---|---|---|---|---|
| `docs/aha/project-structure/` | Yes | Yes | — | OK |
| `docs/aha/project-structure/prompts/` | Yes | Yes | — | OK |
| `docs/aha/project-structure/outputs/` | Yes | Yes | — | OK |
| `docs/aha/project-structure/migration-plans/` | Yes | Yes | — | OK |
| `docs/aha/project-structure/reports/` | Yes | Yes | — | OK |
| `docs/aha/project-structure/README.md` | Yes | Yes | 1 broken prompt-04 link (fixed) | OK after fix |
| `prompts/01-docs-inventory-and-prd-organization.md` | Yes | Yes | — | OK |
| `prompts/02-project-structure-and-root-hygiene-audit.md` | Yes | Yes | — | OK |
| `prompts/03-approved-docs-and-root-cleanup-execution.md` | Yes | Yes | — | OK |
| `prompts/04-link-reference-validation.md` | Yes | Yes | — | OK |

## Root Reference Validation

| File | Reference | Issue | Status |
|---|---|---|---|
| `README.md:37-38` | `./specs/api/CONTRACT.md`, `./specs/api/IMPLEMENTING.md` | — | OK |
| `README.md:174,338-339` | `./CONTRIBUTING.md`, `./CLAUDE.md` | — | OK |
| `docs/INDEX.md:5,11,15,22-23,52` | `../ARCHITECTURE.md`, `../ROADMAP.md`, `../QUICKSTART.md`, `../CONTRIBUTING.md`, `../VERTICAL_TDD.md`, `../.audits/PRODUCTION_AUDIT.md` | — | OK |
| `docs/INDEX.md:16` | `./ARCHITECTURE.md` (intentionally distinct from root) | Flagged in cleanup-report Remaining Risks; cross-link annotation present | OK |
| `docs/INDEX.md:32-33` | `../specs/api/`, `../specs/api/CONTRACT.md`, `../specs/api/IMPLEMENTING.md` | — | OK |
| `docs/README.md:63` | 3 historical AHA paths under `docs/aha/project-structure/{outputs,migration-plans}/old/*.2026-06-10.md` | — | OK |

## Prompt / AHA Reference Validation

| File | Reference | Issue | Status |
|---|---|---|---|
| `docs/aha/project-structure/README.md:14` | `./prompts/04-link-and-reference-validation.md` | Filename mismatch | **FIXED** → `04-link-reference-validation.md` |
| `docs/aha/project-structure/README.md:11-13,20-23,27-29,33` | All other prompt/output/plan/report paths | — | OK |
| `docs/aha/project-structure/prompts/04-link-reference-validation.md:7-9` | Cross-references prompts 01/02/03 | — | OK |

## Script / Config / CI Reference Validation

| File | Reference | Issue | Status |
|---|---|---|---|
| `.gitignore` | `.audits/*.log` line added 2026-06-11 | — | OK (no doc link) |
| CI workflows | Not modified by cleanup | — | OK (unchanged) |

No scripts or configs hold references to the 3 moved DOCS workflow files (verified via `rg "docs/DOCS_INVENTORY\|docs/DOCS_MIGRATION_PLAN\|docs/DOCS_CLEANUP_REPORT"`).

## Fixed References

| File | Change |
|---|---|
| `docs/aha/project-structure/README.md:14` | Renamed link target `04-link-and-reference-validation.md` → `04-link-reference-validation.md` to match actual filename. |
| `docs/architecture/adr/0005-person-module-as-pii-safeguard.md:50` | Replaced removed `docs/_archive/oli/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` with live `services/api-ts/src/handlers/person/repos/person.schema.ts` (Drizzle schema = canonical source for current Person table structure). |
| `docs/ARCHITECTURE.md` | Replaced 253-line stale derivative (referenced deleted `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md`) with redirect to canonical root `ARCHITECTURE.md`. Root selected as canonical because (a) it self-describes as technical source of truth, (b) `services/api-ts/src/core/schema-registry.test.ts:33` reads it via `readFileSync(join(REPO_ROOT, 'ARCHITECTURE.md'))`, (c) it has wider inbound fan-out (CLAUDE.md, CONTRIBUTING.md, QUICKSTART.md, skills, `.planning/`). All inbound links to `docs/ARCHITECTURE.md` (e.g., `QUICKSTART.md:137`) continue resolving. |
| `docs/INDEX.md:16` | Reworded the architecture-pointer line from "distinct doc" to "redirect to canonical root doc" to match new state. |

## Needs Review

| File | Reference | Reason |
|---|---|---|
| _none_ | — | All flagged items resolved this round. |

## Final Assessment

**Safe.**

Justification:
- Every link checked in the four canonical indexes (`docs/INDEX.md`, `docs/product/prd/PRD_INDEX.md`, `docs/aha/project-structure/README.md`, root `README.md`) resolves to an existing file after the single fix in this round.
- The cleanup executed in prompt 03 introduced **zero stale active references**. Old-path mentions inside `docs/` are confined to:
  - the descriptive "Recent restructure" block in `docs/README.md`, and
  - intentionally historical AHA artifacts that document state at audit time.
- One independent **pre-existing** broken link in `docs/architecture/adr/0005` was uncovered (from the 2026-06-10 OLI-archive removal, not from prompt 03) and was fixed by repointing to the live Drizzle schema `services/api-ts/src/handlers/person/repos/person.schema.ts` — the canonical source of truth for the current Person table structure.
- The pre-existing **content-duplication risk** between root `ARCHITECTURE.md` and `docs/ARCHITECTURE.md` was resolved this round by replacing the docs-side copy with a redirect pointer; root selected as canonical because a test (`schema-registry.test.ts`) reads it directly from `REPO_ROOT`.
- External HTTP links and anchor fragments were not validated (no link checker available); risk is contained because no recent changes touched those.

No risky paths remain that would block normal documentation use. Two human-judgement items remain, both pre-existing and non-blocking.

## Recommended Next Action

1. **Optional**: introduce a Markdown link checker into CI (`lychee` or `markdown-link-check`) to catch future drift automatically.
2. **Optional**: commit this round (link fixes + ARCHITECTURE.md redirect + report) in a focused PR. Suggested message: `docs: AHA prompt 04 — fix 3 broken links and resolve ARCHITECTURE.md duplication`.
