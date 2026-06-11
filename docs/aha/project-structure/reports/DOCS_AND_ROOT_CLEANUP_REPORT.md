# Docs and Root Cleanup Report

> AHA prompt **03** execution report for **this repository** (dentalemon). Date: 2026-06-11.
> Approved plans: `../migration-plans/DOCS_MIGRATION_PLAN.md`,
> `../migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`
> (human approval recorded at the Stage 3 checkpoint: full core set; archives
> delegated to executor judgment "good long term and standard practices").

## Summary

Executed the approved core set plus one archive. **Two planned items were
intentionally NOT executed** because execution-time verification disproved their
premise (see Deviations) — exactly the stop-and-flag behavior the prompt's safety
rules require.

- **Deleted** the byte-identical duplicate AHA prompt pack (`docs/audits/module-gap-plans/aha/`, 9 files) and the 1-byte `docs/aha/prompts/copy.md` debris.
- **Fixed** 5 skill files referencing the nonexistent `docs/product/MASTER_PRD.md` → canonical `docs/prd/v3-dentalemon.md`.
- **Untracked** 4 `.superpowers/brainstorm/**` AI-scratch files; gitignored `.superpowers/` and `.hypothesis/`.
- **Archived** `docs/research/` (13 files) → `docs/archive/research-2026-06/` (`git mv`; zero inbound references verified before move).
- **Created** `docs/prd/PRD_INDEX.md` and `docs/archive/ARCHIVE_INDEX.md`; updated `docs/README.md` (the repo's existing docs index — a parallel `docs/INDEX.md` was deliberately NOT created, see Deviations).
- **Guard:** `bun run typecheck` green after all changes.

## Files Moved

| Old Path | New Path | Reason |
|---|---|---|
| `docs/research/**` (13 files incl. `external-references/`) | `docs/archive/research-2026-06/**` | Self-described "exploratory, may be superseded"; baseline 2026-06-06; zero inbound references (rg-verified); `git mv` preserves history |

## Files Deleted

| Path | Reason |
|---|---|
| `docs/audits/module-gap-plans/aha/prompts/*.md` (8 files) | Byte-identical (cmp-verified) to canonical `docs/aha/prompts/`; zero references to this copy |
| `docs/audits/module-gap-plans/aha/copy.md`, `docs/aha/prompts/copy.md` | 1-byte debris |
| `.superpowers/brainstorm/57179-1778242755/**` (4 files, `git rm --cached`) | Per-session AI brainstorm scratch committed by mistake; files remain on disk, now gitignored |

## Files Left Untouched (incl. plan deviations)

| Path | Reason |
|---|---|
| `docs/architecture/DOMAIN_MODEL.md` | **DEVIATION from plan M3.** Planned redirect-stub assumed ~95% duplication; execution-time diff showed 192/242 lines differ — it documents the 10 dental handler modules (v1.0), while `product/DOMAIN_MODEL.md` is the oli-generated entity model. Complementary docs, not duplicates. Flagged in `docs/README.md` Known follow-ups with a rename suggestion. |
| `docs/architecture/ROLE_MATRIX.md` | **DEVIATION from plan M4.** Not a subset duplicate: it is stale-vs-code (lists 4 roles incl. nonexistent `staff_view`; `membership.schema.ts` defines 9+). Its access-tier framing may be worth merging into the canonical matrix — content work requiring human review. Flagged in `docs/README.md` Known follow-ups. |
| `docs/audits/modules/*.md` (15 dated audits) | **A1 deferred.** Linked from active MODULE_AUDIT_TRACKER, gap-plans, and workflow-verification prompts; the sweep is in progress (resume point: tracker row 4). Archive after it completes. |
| `docs/audits/workflow-verification/runs/**` | **A2 re-scoped to keep.** Not "2 loose logs" — it is the active evidence tree (per-module reports + screenshots) for the in-progress sweep. |
| `docs/spikes/imaging-canvas-spike.md` | **A4 kept.** Hardware validation still pending — not finished work. |
| `docs/api/ERROR_ENVELOPE.md` + `docs/architecture/ERROR_ENVELOPE_DENTALEMON.md` | NEEDS REVIEW pair — `docs/README.md` already documents them as generic-vs-dentalemon variants; left alone. |
| `docs/prd/**`, `docs/product/**`, `docs/development/**`, `docs/context/**`, `docs/reviews/**`, `docs/decisions/**`, `docs/security/**` | Keep-in-place per approved plan (load-bearing / referenced / coherent) |
| All 12 tracked root files; per-workspace markdown; `services/cadence/FIXME.md` | Keep-in-place per approved plan |

## PRD Organization Summary

| PRD / Requirement Area | Canonical File | Supporting Files | Historical Files |
|---|---|---|---|
| Whole product | `docs/prd/v3-dentalemon.md` (indexed by new `docs/prd/PRD_INDEX.md`) | `BUSINESS_RULES.md`, `ACCEPTANCE_CRITERIA.md`, `context/design-doc.md`, wireframes, `clinical/STANDARDS_COMPLIANCE.md` | none |
| Module level | `docs/product/modules/*/MODULE_SPEC.md` (engineering layer — intentionally not moved into a `prd/active/` shape) | `API_CONTRACTS.md`, `ui-prototype/` | none |

No PRD files were moved. The repo's `docs/prd/` ↔ `docs/product/` two-layer
convention was preserved per the approved plan.

## Root Cleanup Summary

| File / Folder | Action | Reason |
|---|---|---|
| `.superpowers/brainstorm/**` (4 files) | `git rm --cached` | Scratch committed by mistake |
| `.gitignore` | Added `.superpowers/`, `.hypothesis/` | Close ignore gaps |
| All other root files/folders | Left in place | Root was already clean |

(Stage 0 of this pipeline had already anchored the `outputs/` ignore pattern to `/outputs/`.)

## References Updated

| File | Change |
|---|---|
| `.claude/skills/ui-prototype-pack/SKILL.md:61` | `docs/product/MASTER_PRD.md` → `docs/prd/v3-dentalemon.md` |
| `.claude/skills/prd-audit/SKILL.md:45` | phantom path → canonical PRD path |
| `.claude/skills/audit-compliance/SKILL.md:68` | phantom path → canonical PRD + companions |
| `.claude/skills/module-specs/SKILL.md:41` | phantom path → canonical PRD path |
| `.claude/skills/vertical-slice-plan/SKILL.md:56` | bare `MASTER_PRD.md` → canonical PRD path |
| `docs/README.md` | research/ → archive pointer; new §9 Archive; audits/aha lines in §8; ADR count 007→008; PRD_INDEX link; Known follow-ups rewritten with corrected duplicate analysis |

Generic template prose mentioning "MASTER_PRD template" / "sections within
MASTER_PRD.md" in skills was left as-is (fallback language, not path references).

## Indexes Created or Updated

| File | Purpose |
|---|---|
| `docs/prd/PRD_INDEX.md` | **NEW** — canonical PRD index + two-layer pattern explanation |
| `docs/archive/ARCHIVE_INDEX.md` | **NEW** — archive index incl. deliberately-deferred items |
| `docs/README.md` | **UPDATED** — remains the single docs index. **DEVIATION:** the planned separate `docs/INDEX.md` was NOT created — the repo's existing convention is `docs/README.md` as index; a parallel file would drift (prompt 01 rule: "use the repo's existing convention"). |

## Validation Performed

| Check | Result |
|---|---|
| `rg "docs/research/"` outside archive/AHA artifacts | **0 stale refs** (matches in `docs/reviews/**` resolve to the internal `docs/reviews/research/`, verified) |
| `rg "module-gap-plans/aha"` | **0 refs** |
| `rg "docs/product/MASTER_PRD"` | **0 refs** |
| Duplicate pack byte-identity before delete | **cmp-verified** all 8 files |
| `git mv` used for archive move | **OK** (history preserved) |
| `.superpowers` files remain on disk after `--cached` removal | **OK** |
| `bun run typecheck` (dentalemon + api-ts) | **GREEN** (exit 0 both) |
| No source code, schema, migrations, lockfile changes | **OK** (git status: docs, skills, .gitignore only) |

## Remaining Risks

| Risk | Location | Recommendation |
|---|---|---|
| DOMAIN_MODEL name collision (two complementary docs share a filename) | `docs/architecture/DOMAIN_MODEL.md` vs `docs/product/DOMAIN_MODEL.md` | Human decision: rename architecture's to `MODULE_ARCHITECTURE.md` (or similar) + update its 2 inbound doc links |
| Stale role matrix | `docs/architecture/ROLE_MATRIX.md` | Human content review: merge access-tier framing into `product/ROLE_PERMISSION_MATRIX.md`, then remove |
| Dated audit snapshots accumulate | `docs/audits/modules/` | Archive after workflow-verification sweep completes (tracked in ARCHIVE_INDEX deferred table) |
| Archived research internal links reference pre-move sibling paths | `docs/archive/research-2026-06/**` | Intentional (historical record); prompt 04 should treat as historical-descriptive, not broken |

## Recommended Next Actions

1. Run **Prompt 04** (link/reference validation) — next stage of this pipeline.
2. Resolve the two NEEDS-REVIEW architecture docs in a small follow-up (rename + tier-merge).
3. After the workflow-verification sweep completes, archive `docs/audits/modules/*_2026-06-08.md` and rewrite tracker links.
