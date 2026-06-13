# Documentation Migration Plan

> AHA prompt **01** output for **this repository** (dentalemon). Date: 2026-06-11.
> Plan only — execution happens via prompt 03 after human approval.
> Companion inventory: `../outputs/DOCS_INVENTORY.md`.

## Philosophy

The docs tree's core layers (`prd/` requirements ↔ `product/` engineering specs) are
deliberate and load-bearing. This plan therefore proposes a **minimal-move cleanup**:
kill verified duplicates and debris, resolve the two known stale architecture copies,
add the missing indexes, and *optionally* archive clearly-historical snapshots. It does
NOT propose reshaping `docs/` into the generic template structure — the repo already
has a working convention.

## Proposed Docs Folder Structure

Unchanged top-level layout, plus one new `archive/` bucket (only if the conditional
archives are approved):

```text
docs/
├── README.md            (updated index)
├── INDEX.md             (NEW — thin top-level entry point)
├── prd/                 (canonical PRD + companions — unchanged)
├── product/             (engineering-spec layer — unchanged)
├── architecture/        (minus 2 stale duplicates)
├── decisions/           (ADRs — unchanged, cross-linked from architecture)
├── development/         (unchanged — heavily referenced)
├── api/                 (pending NEEDS-REVIEW consolidation)
├── clinical/ context/ execution/ observability/ runbooks/ security/ spikes/ testing/  (unchanged)
├── audits/              (minus duplicate aha/ pack; optionally minus dated snapshots)
├── reviews/ research/   (unchanged unless research archive approved)
├── aha/                 (canonical prompt packs + this audit)
└── archive/             (NEW, only if conditional archives approved)
    └── ARCHIVE_INDEX.md
```

## File Move Map

| # | Current Path | Proposed Path | Reason | Risk |
|---|---|---|---|---|
| M1 | `docs/audits/module-gap-plans/aha/` (prompts/ ×8 + copy.md) | **DELETE** (no archive — byte-identical to `docs/aha/prompts/`) | Duplicate prompt pack; canonical home is `docs/aha/prompts/` per AHA shared rules §1 | **Low** — cmp-verified identical; no unique references |
| M2 | `docs/aha/prompts/copy.md` | **DELETE** | 1-byte debris | **Low** |
| M3 | `docs/architecture/DOMAIN_MODEL.md` | Replace with 5-line redirect stub → `docs/product/DOMAIN_MODEL.md` | Stale ~95% duplicate; product/ is canonical (sole-owned by generation skill); redirect keeps inbound links resolving | **Low** — docs links only |
| M4 | `docs/architecture/ROLE_MATRIX.md` | Replace with redirect stub → `docs/product/ROLE_PERMISSION_MATRIX.md` | Subset duplicate; product/ is canonical + code-referenced | **Low** — verify unique content first |
| M5 | `.claude/skills/{module-specs,audit-compliance,ui-prototype-pack,vertical-slice-plan,prd-audit}/SKILL.md` refs to `docs/product/MASTER_PRD.md` | Update reference → `docs/prd/v3-dentalemon.md` | Phantom path; file never existed | **Low** — text-only reference fix |

## Files Proposed for Archive

All **conditional** — each needs explicit approval at the prompt-03 gate:

| # | Current Path | Archive Path | Reason |
|---|---|---|---|
| A1 | `docs/audits/modules/*.md` (15 dated module audits, 2026-06-08) | `docs/archive/audits/module-audits-2026-06-08/` | Point-in-time snapshots, synthesized into MODULE_AUDIT_TRACKER; tracker links must be rewritten to archive paths |
| A2 | `docs/audits/workflow-verification/runs/*.txt` (2 logs) | `docs/archive/audits/execution-logs/` | Transient run logs |
| A3 | `docs/research/` (13 files incl. external-references/) | `docs/archive/research-2026-06/` | Self-described "exploratory, may be superseded"; no code references. **[NEEDS REVIEW]** — may serve as compliance-reasoning audit trail |
| A4 | `docs/spikes/imaging-canvas-spike.md` | `docs/archive/spikes/` | Completed spike. **[NEEDS REVIEW]** — hardware validation still pending; keep if active |

## Files Proposed to Keep In Place

| Current Path | Reason |
|---|---|
| `docs/prd/**` | Canonical PRD layer; BUSINESS_RULES + ACCEPTANCE_CRITERIA are script/test-consumed |
| `docs/product/**` | Engineering-spec layer; skill + codegen inputs; internally coherent |
| `docs/development/**` | Hard-referenced by root CONTRIBUTING/CLAUDE/AGENTS + skills + api-ts scripts |
| `docs/reviews/**` | `plans/04`, `plans/05`, `research/perio.md` cited in backend source/TypeSpec comments |
| `docs/context/**` | Living audit baselines (IDEAL standard, charting/imaging guides) |
| `docs/audits/**` (except M1/A1/A2) | Operational trackers + gap-plan source-of-truth with dense reference web |
| `docs/decisions/**` | Single ADR home; cited from gap-plans/reviews |
| `docs/security/SECURITY_ADVISORIES.md` | CI workflow reference |
| `docs/{clinical,testing,execution,observability,runbooks}/**` | Active or harmless; moving = churn without benefit |
| `docs/api/ERROR_ENVELOPE.md` + `docs/architecture/ERROR_ENVELOPE_DENTALEMON.md` | **[NEEDS REVIEW]** overlap unverified — do not touch in this round |

## PRD Organization Plan

| Current File | PRD Classification | Proposed Path | Reason |
|---|---|---|---|
| `docs/prd/v3-dentalemon.md` | Canonical PRD | unchanged | Single source of truth |
| `docs/prd/{BUSINESS_RULES,ACCEPTANCE_CRITERIA}.md` | Supporting requirements | unchanged (load-bearing) | Script/test consumers |
| `docs/product/modules/*/MODULE_SPEC.md` | Module-level engineering specs | unchanged | Per repo's two-layer convention |
| NEW: `docs/prd/PRD_INDEX.md` | Index | create in prompt 03 | One page: canonical PRD + companions + pointer to product/ spec layer |

This repo intentionally does NOT adopt the template's `docs/product/prd/active|historical` shape — `docs/prd/` + `docs/product/` is the established, referenced convention.

## References That Must Be Updated Later

| Referencing File | Old Reference | New Reference | Risk |
|---|---|---|---|
| `docs/audits/MODULE_AUDIT_TRACKER.md` | `modules/MODULE_*_AUDIT_2026-06-08.md` links | archive paths (only if A1 approved) | Medium — 15 links |
| 5 × `.claude/skills/*/SKILL.md` | `docs/product/MASTER_PRD.md` | `docs/prd/v3-dentalemon.md` | Low |
| Any inbound links to `docs/architecture/DOMAIN_MODEL.md` / `ROLE_MATRIX.md` | direct content links | survive via redirect stubs (M3/M4) | Low |
| `docs/README.md` | sections describing moved/deleted files | updated index | Low |

## Validation Checklist for Execution Phase

- [ ] Markdown links checked (canonical indexes: docs/README.md, docs/INDEX.md, PRD_INDEX, AHA README)
- [ ] Codebase references checked (`rg` each deleted/moved path across apps/services/packages/scripts/specs/testing)
- [ ] README links checked (root README, CONTRIBUTING, CLAUDE, AGENTS)
- [ ] Prompt file references checked (`.claude/skills/`, `docs/aha/`)
- [ ] CI/script references checked (`.github/workflows/`, `scripts/`, `services/api-ts/scripts/`)
- [ ] PRD index ready (`docs/prd/PRD_INDEX.md`)
- [ ] Archive index ready (`docs/archive/ARCHIVE_INDEX.md`, only if any A-item approved)
- [ ] `bun run typecheck` green after execution (guard: docs moves must be code-neutral)
