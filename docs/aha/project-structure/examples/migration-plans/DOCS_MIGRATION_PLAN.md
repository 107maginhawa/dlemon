# Documentation Migration Plan

> AHA prompt **01** output. Read alongside `../outputs/DOCS_INVENTORY.md`
> and `../outputs/PRD_INDEX_DRAFT.md`.
>
> **No moves performed.** This is a proposal for a later execution phase.
> Audit date: 2026-06-11.

## Preface

Memberry already ran a docs cleanup on 2026-06-10 (see `docs/DOCS_CLEANUP_REPORT.md`).
That round handled the low-risk wins (ADR consolidation, root-audit re-home,
empty-dir removal). This plan focuses on what remains, **without forcing the
prompt's reference structure on top of a working layout**. Per prompt §7, we
do not force the recommended structure when the repo already has a clean
convention.

## Proposed Docs Folder Structure

> The current structure is **mostly already clean**. The only changes proposed
> here are additive (new sub-buckets under existing dirs) and a few low-risk
> consolidations. We deliberately do NOT propose physically moving the 22
> nested `MODULE_SPEC.md` files into `docs/product/prd/active/`, because the
> two-layer co-location pattern is intentional and load-bearing.

```text
docs/
├── README.md                                  # KEEP — landing index
├── ARCHITECTURE.md                            # KEEP — cross-ref'd by QUICKSTART + sibling CONTRIBUTING
├── DOCS_INVENTORY.md                          # MOVE (low-risk) → docs/aha/project-structure/outputs/old/
├── DOCS_MIGRATION_PLAN.md                     # MOVE → docs/aha/project-structure/migration-plans/old/
├── DOCS_CLEANUP_REPORT.md                     # MOVE → docs/aha/project-structure/outputs/old/
├── product/
│   ├── MASTER_PRD.md                          # KEEP — canonical
│   ├── prd/
│   │   ├── PRD_INDEX.md                       # KEEP — canonical index
│   │   └── README.md                          # (NEW, optional) — points to active = ./modules/, handler = ../MODULE_SPEC.*, historical = ../../ver-3/
│   ├── MODULE_SPEC.*.md (×16, handler-tier)   # KEEP — load-bearing
│   ├── modules/m{NN}-*/                       # KEEP — nested product PRD tier (active)
│   │   ├── MODULE_SPEC.md
│   │   ├── API_CONTRACTS.md
│   │   ├── NAVIGATION_MAP.md
│   │   └── ui-prototype/{components,screens,interaction-states,mock-data}.md
│   ├── modules/m{NN}-*.md (×19, short-form)   # NEEDS REVIEW (see below) — either backfill m20–m22 or delete all 19
│   └── (cross-cutting foundation docs)        # KEEP — DOMAIN_MODEL, WORKFLOW_MAP, STATE_MACHINES, ROLE_PERMISSION_MATRIX, etc.
├── architecture/
│   ├── COMMS-CONSOLIDATION.md                 # KEEP
│   └── adr/                                   # KEEP — load-bearing (script reads)
├── execution/                                 # KEEP
├── quality/                                   # KEEP — many script consumers
├── security/                                  # KEEP — script consumers
├── audits/                                    # KEEP
├── workflow/                                  # KEEP — root CLAUDE.md ref
├── project-map/                               # KEEP — co-located script + generated nav
├── ver-3/                                     # KEEP intact — versioned PRD suite, still authoritative
└── aha/
    ├── 00..07-*.md                            # KEEP — step prompts
    ├── copy.md                                # NEEDS REVIEW → archive candidate
    └── project-structure/
        ├── prompts/01..04*.md                 # KEEP
        ├── outputs/                           # THIS PROMPT writes here
        │   ├── DOCS_INVENTORY.md
        │   └── PRD_INDEX_DRAFT.md
        └── migration-plans/                   # THIS PROMPT writes here
            └── DOCS_MIGRATION_PLAN.md
```

## File Move Map

> All moves are **OPTIONAL** unless flagged as a Must-Have. None are
> automatically executed by this prompt.

| Current Path | Proposed Path | Reason | Risk | Must-Have? |
|---|---|---|---|---|
| `docs/DOCS_INVENTORY.md` | `docs/aha/project-structure/outputs/old/DOCS_INVENTORY.2026-06-10.md` | Aligns prior workflow output with this prompt's AHA convention | LOW — update 3 cross-refs in `docs/README.md`, `docs/DOCS_CLEANUP_REPORT.md`, `docs/DOCS_MIGRATION_PLAN.md` | No (cosmetic) |
| `docs/DOCS_MIGRATION_PLAN.md` | `docs/aha/project-structure/migration-plans/old/DOCS_MIGRATION_PLAN.2026-06-10.md` | Same reason | LOW — update 2 cross-refs | No (cosmetic) |
| `docs/DOCS_CLEANUP_REPORT.md` | `docs/aha/project-structure/outputs/old/DOCS_CLEANUP_REPORT.2026-06-10.md` | Same reason | LOW — update 1 cross-ref (`docs/README.md`) | No (cosmetic) |
| `docs/aha/copy.md` | `docs/aha/_archive/copy.md` (after human confirms intent) | Looks like scratch | LOW — no inbound refs | No (needs review) |
| (no other moves proposed this round) | — | — | — | — |

### Moves explicitly NOT proposed

| Tempting Move | Why we are NOT proposing it |
|---|---|
| `docs/product/modules/m*/MODULE_SPEC.md` → `docs/product/prd/active/m*/MODULE_SPEC.md` | Would invalidate the entire two-layer pattern documented in `docs/README.md`, `docs/DOCS_CLEANUP_REPORT.md`, and `PRD_INDEX.md`. ~100+ inbound cross-refs to repath. Co-location with `API_CONTRACTS.md` + `NAVIGATION_MAP.md` is intentional. |
| `docs/ver-3/` → `docs/archive/` or `docs/product/prd/historical/` | Still authoritative per `CONTRIBUTING.md:2456,2472`. Multiple script consumers. Not historical yet. |
| `docs/product/MODULE_SPEC.*.md` (16 flat) → `docs/engineering/handler-specs/` | Treated as canonical PRD layer per `PRD_INDEX.md`. Moving splits the PRD index across two trees. |
| `docs/audits/MULTI-TENANT-AUDIT.md` → `docs/quality/` | Already moved here from root in 2026-06-10 cleanup. Stable. |
| Anything in `docs/quality/`, `docs/security/`, `docs/project-map/` | Script consumers everywhere — see `../outputs/DOCS_INVENTORY.md` "Do Not Move Yet" section |

## Files Proposed for Archive

| Current Path | Archive Path (proposed) | Reason |
|---|---|---|
| `docs/aha/copy.md` | `docs/aha/_archive/copy.md` | Scratch file, no inbound refs. Confirm intent first. |
| `docs/ver-3/plans/ux-inspiration-queue.md` | `docs/ver-3/plans/_archive/ux-inspiration-queue.md` | Memory notes it as "SUPERSEDED by strategic upgrade plan". Verify with human before move. |

**No other archive candidates this round.** All other candidates should be re-evaluated by prompts #02–#04.

## Files Proposed to Keep In Place

| Current Path / Pattern | Reason |
|---|---|
| All 22 nested `docs/product/modules/m*/MODULE_SPEC.md` | Canonical product-PRD tier; co-located with sibling API/NAV/UI files |
| All 22 `docs/product/modules/m*/API_CONTRACTS.md` | Engineering API spec, co-located by design |
| All 16 flat `docs/product/MODULE_SPEC.*.md` | Canonical handler-tier PRD; load-bearing for `docs/quality/MODULE_SPEC_HANDOFF.md` |
| All cross-cutting `docs/product/{DOMAIN_MODEL,WORKFLOW_MAP,STATE_MACHINES,…}.md` | Many cross-refs from modules + ver-3 |
| Entire `docs/ver-3/` tree (130 files) | Currently authoritative versioned snapshot; script consumers; will become "historical" only when v4 lands |
| Entire `docs/architecture/adr/` | `scripts/update-scorecard.ts:32` reads this dir |
| Entire `docs/quality/`, `docs/security/`, `docs/project-map/` | Multiple script readers/writers |
| `docs/workflow/SUPERPOWERS_FLOW.md` | Root `CLAUDE.md:444` |
| Root `docs/ARCHITECTURE.md`, `docs/README.md` | High-traffic anchors |
| All 13 `SLICE_SPEC.md` + 17 `TDD_PROOF.md` in `docs/execution/slices/` | Engineering bucket already clean |

## PRD Organization Plan

> No physical PRD moves are proposed. The plan formalizes the **existing**
> two-layer pattern + adds a clearer entrypoint.

| Current File | PRD Classification | Proposed Path (logical) | Reason |
|---|---|---|---|
| `docs/product/MASTER_PRD.md` | Canonical (Master) | Stay — referenced as `docs/product/MASTER_PRD.md` | Master PRD anchor |
| `docs/product/modules/m{NN}-*/MODULE_SPEC.md` (×22) | Canonical (Product-module tier) | Stay — `docs/product/modules/m{NN}-*/MODULE_SPEC.md` | Active per-module PRD |
| `docs/product/MODULE_SPEC.*.md` (×16) | Canonical (Handler tier) | Stay — `docs/product/MODULE_SPEC.*.md` | Handler-implementation tier; two-layer pattern is intentional |
| `docs/product/{DOMAIN_MODEL,WORKFLOW_MAP,…}.md` (~20) | Canonical (Cross-cutting foundation) | Stay | Referenced by all modules |
| `docs/product/modules/m{NN}-*/API_CONTRACTS.md` (×22) | Engineering (not PRD) | Stay — `docs/product/modules/m{NN}-*/API_CONTRACTS.md` | Co-location is the value |
| `docs/product/modules/m{NN}-*/NAVIGATION_MAP.md` (×23) | Supporting requirement (IA) | Stay | |
| `docs/product/modules/m{NN}-*/ui-prototype/*.md` (×76) | Supporting requirement (UX) | Stay | |
| `docs/product/modules/m{NN}-*.md` short-form (×19) | Supporting / overview (or redundant) | `[NEEDS REVIEW]` | Pick one pattern for all 22 modules |
| `docs/ver-3/business/{personas-and-roles,business-rules,context,cross-cutting,metrics,roadmap}.md` | Supporting requirement | Stay — versioned bucket | Script consumers |
| `docs/ver-3/ux/screens/**/*.md` (×109) | Supporting requirement (per-screen UX) | Stay | |
| `docs/quality/SCOPE.*.md`, `docs/quality/R{0..5}_*_SCOPE.md` | Audit-derived requirement | Stay in `docs/quality/` | Per prompt §5.5 — do not promote to PRD |
| `docs/quality/MEGA_MODULE_DECISION.md` | Audit-derived decision | Stay | |
| `docs/audits/MULTI-TENANT-AUDIT.md` | Audit-derived requirement | Stay | |
| `docs/architecture/adr/*` | Architecture (not PRD) | Stay | |
| `docs/execution/slices/*/SLICE_SPEC.md` (×13) | Engineering (not PRD) | Stay | |

## References That Must Be Updated Later

> Only applies if any "Optional" move in §File Move Map is executed.

| Referencing File | Old Reference | New Reference (if move executed) | Risk |
|---|---|---|---|
| `docs/README.md` | `docs/DOCS_INVENTORY.md`, `docs/DOCS_MIGRATION_PLAN.md`, `docs/DOCS_CLEANUP_REPORT.md` | `docs/aha/project-structure/outputs/old/...` | LOW |
| `docs/DOCS_CLEANUP_REPORT.md` (self-refs to companions) | `docs/DOCS_INVENTORY.md`, `docs/DOCS_MIGRATION_PLAN.md` | New paths if moved | LOW |
| `docs/DOCS_MIGRATION_PLAN.md` (self-refs) | `docs/DOCS_INVENTORY.md` | New path if moved | LOW |

## Stale References Found During Inventory

These are NOT moves — they are dangling refs to files that **already do not
exist**. Flag for prompt **04 — Link & Reference Validation**.

| Referencing file | Broken reference | Suggested fix |
|---|---|---|
| `CONTRIBUTING.md:146` | `docs/audits/SANITY_CHECK.md` | Remove or point to a current audit doc |
| `CONTRIBUTING.md:2454` | `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` | Remove or update to current audit set |
| `scripts/ui-consistency-detect.ts:68,163` | `docs/audits/PATTERNS.lock.md` | Confirm whether script is still in use; either restore file or remove the constant |

## Validation Checklist for Execution Phase

- [ ] Markdown links checked across `docs/**`, `*.md` at repo root, `services/*/README.md`, `services/*/CONTRIBUTING.md`, `apps/*/README.md`
- [ ] Codebase references checked (`scripts/**`, `testing/**`, `services/api-ts/src/**`, `apps/*/src/**`)
- [ ] README links checked (root + per-app + per-service)
- [ ] Prompt file references checked (`docs/aha/**`, `.claude/skills/**/SKILL.md`)
- [ ] CI/script references checked (`.github/workflows/**`, `scripts/update-scorecard.ts`, `scripts/check-sdk-compat.ts`, `scripts/audit-observability.ts`, `scripts/security-quickscan.ts`, `scripts/br-coverage.ts`, `scripts/ui-consistency-detect.ts`)
- [ ] PRD index (`docs/product/prd/PRD_INDEX.md`) re-validated after any `m{NN}-*.md` short-form decision
- [ ] Archive index created (`docs/_archive/INDEX.md` or `docs/aha/_archive/INDEX.md`) **only when first real archive lands** — do not pre-create
- [ ] Confirm `docs/audits/{SANITY_CHECK,EXISTING_CODEBASE_ADOPTION_AUDIT,PATTERNS.lock}.md` either exist or stale refs are removed
- [ ] Confirm `docs/aha/copy.md` intent before any archive move
- [ ] Confirm `docs/ver-3/plans/ux-inspiration-queue.md` supersedence with project owner before any archive move
- [ ] Resolve short-form `docs/product/modules/m{NN}-*.md` policy across all 22 modules (currently only m01–m19 have them)
