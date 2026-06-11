# Documentation Migration Plan

Phase 2 output. Read alongside `DOCS_INVENTORY.md`. Stop point: HITL gate 2 — review before Phase 3 execution.

## Decisions made (HITL gate 1 deferred to my judgment)

| Question | Decision | Rationale |
|---|---|---|
| Flat vs nested `MODULE_SPEC.*.md` | **Leave both** | Investigated — not duplicates. Flat = backend-handler-level (16 files, source-inspected, referenced by `docs/quality/MODULE_SPEC_HANDOFF.md` + `SCOPE.*`). Nested = product-module-level (22 files, validated against MASTER_PRD v3.0). Different audiences, both canonical. |
| ADRs location | **Move to `docs/architecture/adr/`** | Industry standard. 1 script touch (`scripts/update-scorecard.ts:32`). Consolidates `docs/architecture/` from 1 file → 12 files (1 standing + 11 ADRs). |
| Empty `docs/_archive/` | **Delete** | Recreate when first real archive lands. No content = noise. |
| Scope | **Minimal-risk + 1 bundled script-touch (ADR move)** | High value/low risk. Full restructure deferred. |

## Proposed folder structure (post-migration)

```
docs/
├── INDEX.md                        # (NEW) top-level navigation, replaces docs/README.md as canonical index
├── README.md                       # KEEP as-is (used by GitHub)
├── ARCHITECTURE.md                 # KEEP at root — load-bearing (QUICKSTART.md ref)
├── adr/                            # → REMOVED, contents moved
├── architecture/
│   ├── ARCHITECTURE.md             # (NEW symlink/redirect OR leave master at root)
│   ├── COMMS-CONSOLIDATION.md      # existing
│   └── adr/                        # (MOVED FROM docs/adr/)
│       ├── 0000-template.md
│       ├── 0001-typespec-first-api-contracts.md
│       ├── ... 0010-mega-module-rebuild-over-split.md
│       └── README.md
├── aha/                            # KEEP — audit playbook isolated
├── audits/
│   ├── MULTI-TENANT-AUDIT.md       # (MOVED FROM root)
│   └── domain-graph/               # KEEP
├── execution/                      # KEEP — slice specs, TDD proofs, wave plans
├── product/
│   ├── prd/
│   │   └── PRD_INDEX.md            # (NEW) — indexes MASTER_PRD + 22 nested + 16 flat handler specs
│   ├── MASTER_PRD.md               # KEEP
│   ├── MODULE_SPEC.*.md (×16)      # KEEP — handler-level specs (load-bearing for quality/)
│   ├── modules/                    # KEEP — m01..m22 product modules
│   └── ... (all other product/ files KEEP)
├── quality/
│   ├── QA-COVERAGE-MATRIX.md       # (MOVED FROM root)
│   ├── deferred-tests.md           # (MOVED FROM docs/roadmap/)
│   └── ... (all existing files KEEP)
├── roadmap/                        # → REMOVED (contents moved to quality/)
├── security/                       # KEEP
├── ver-3/                          # KEEP intact — versioned snapshot
├── workflow/                       # KEEP
├── project-map/                    # KEEP — generated nav + generate.ts script
└── _archive/                       # → REMOVED (empty)
```

## File move map

| Current Path | Proposed Path | Reason | Risk | Script touch |
|---|---|---|---|---|
| `docs/adr/*` (11 files) | `docs/architecture/adr/*` | Industry standard ADR location | LOW | `scripts/update-scorecard.ts:32` |
| `docs/MULTI-TENANT-AUDIT.md` | `docs/audits/MULTI-TENANT-AUDIT.md` | Belongs with audit outputs | LOW | none (no external refs) |
| `docs/QA-COVERAGE-MATRIX.md` | `docs/quality/QA-COVERAGE-MATRIX.md` | Quality artifact | LOW | none |
| `docs/roadmap/deferred-tests.md` | `docs/quality/deferred-tests.md` | Single-file dir; deferred tests = quality artifact | LOW | none |

**Total moves**: 14 files (11 ADRs + 3 root-level).

## Files to delete

| Path | Reason |
|---|---|
| `docs/.DS_Store` | macOS cruft |
| `docs/aha/.DS_Store` | macOS cruft |
| `docs/_archive/.DS_Store` | macOS cruft |
| `docs/_archive/` (dir, after .DS_Store removed) | Empty dir |
| `docs/adr/` (dir, after move) | Empty after ADR move |
| `docs/roadmap/` (dir, after move) | Empty after deferred-tests.md move |

## Files to keep in place (no move)

| Path | Reason |
|---|---|
| `docs/ARCHITECTURE.md` | Referenced by `QUICKSTART.md`, `services/api-ts/CONTRIBUTING.md`. Renaming = ripple. |
| `docs/README.md` | GitHub-rendered dir overview. |
| `docs/architecture/COMMS-CONSOLIDATION.md` | Stays put as ADRs move in. |
| `docs/aha/**` (10 files) | Audit playbook — already isolated. |
| `docs/audits/domain-graph/DOMAIN_OVERVIEW.md` | Engine output location. |
| `docs/execution/**` (36 files) | Referenced by ARCHITECTURE.md slice instruction. |
| `docs/product/**` (201 files) | Canonical PRD/spec home. Flat + nested both kept. |
| `docs/project-map/**` (6 files) | Contains `generate.ts` script + its outputs. |
| `docs/quality/**` (30 files) | 8 scripts read/write here. |
| `docs/security/**` (4 files) | 2 scripts write here. |
| `docs/ver-3/**` (130 files) | Versioned snapshot — intact. |
| `docs/workflow/SUPERPOWERS_FLOW.md` | `CLAUDE.md` ref. |

## New files to create

| Path | Purpose |
|---|---|
| `docs/INDEX.md` | Top-level navigation/index (links to all subdirs + PRD_INDEX). |
| `docs/product/prd/PRD_INDEX.md` | Indexes MASTER_PRD + 22 product-module specs + 16 handler-level specs. Documents the two-layer pattern. |

## References to update (in source + docs)

| File | Old Reference | New Reference |
|---|---|---|
| `scripts/update-scorecard.ts:32` | `'docs/adr'` | `'docs/architecture/adr'` |
| `docs/adr/README.md` (any internal cross-links) | check for self-refs | update to `docs/architecture/adr/` if any |
| `docs/ARCHITECTURE.md` | `docs/templates/MODULE_SPEC.template.md` (BROKEN) | `docs/quality/MODULE_SPEC_TEMPLATE.md` |
| `docs/ARCHITECTURE.md` | `docs/templates/SLICE_SPEC.template.md` (BROKEN) | Remove instruction OR use `docs/execution/slices/w1-t1-repo-consolidation/SLICE_SPEC.md` as the canonical example |
| `scripts/ui-consistency-detect.ts` (×3) | `docs/audits/PATTERNS.lock.md` (BROKEN) | **[NEEDS REVIEW]** — investigate where this should now point. Likely removed during OLI cleanup. Possible: restore from `git log -- docs/audits/PATTERNS.lock.md`, or update script to a current source-of-truth. Out of scope for migration — flag as separate followup. |
| `apps/memberry/src/utils/guards.ts` | `docs/audits/E2E_REMEDIATION_FINAL.md` (BROKEN) | **[NEEDS REVIEW]** — comment-only ref. Either update to a current audit file or remove. Out of scope for migration — flag as separate followup. |

## Execution order

Bundle per category, one commit each. Bisectable.

1. **Commit 1 — cleanup**: delete 3 `.DS_Store`, ensure `.gitignore`, remove `docs/_archive/`.
2. **Commit 2 — move ADRs**: `git mv docs/adr/* docs/architecture/adr/` + update `scripts/update-scorecard.ts:32` + smoke-test the scorecard script.
3. **Commit 3 — re-home root files**: `git mv docs/MULTI-TENANT-AUDIT.md docs/audits/` + `git mv docs/QA-COVERAGE-MATRIX.md docs/quality/`.
4. **Commit 4 — consolidate roadmap/**: `git mv docs/roadmap/deferred-tests.md docs/quality/` + `rmdir docs/roadmap`.
5. **Commit 5 — fix broken refs in ARCHITECTURE.md**: update the 2 `docs/templates/` references.
6. **Commit 6 — new indexes**: write `docs/INDEX.md` + `docs/product/prd/PRD_INDEX.md`.
7. **Commit 7 — final report**: write `docs/DOCS_CLEANUP_REPORT.md`.

Two pre-existing broken refs (`ui-consistency-detect.ts` + `guards.ts`) flagged as separate followup — out of migration scope, need investigation of original target.

## git mv dry-run preview

```
# Commit 2 — ADR move
git mv docs/adr/0000-template.md docs/architecture/adr/0000-template.md
git mv docs/adr/0001-typespec-first-api-contracts.md docs/architecture/adr/
git mv docs/adr/0002-hand-wired-route-allowlist.md docs/architecture/adr/
git mv docs/adr/0003-drizzle-orm-over-prisma.md docs/architecture/adr/
git mv docs/adr/0004-bun-over-nodejs.md docs/architecture/adr/
git mv docs/adr/0005-person-module-as-pii-safeguard.md docs/architecture/adr/
git mv docs/adr/0006-domain-event-bus-for-cross-module-cascades.md docs/architecture/adr/
git mv docs/adr/0007-audit-officer-position-via-typespec-extension.md docs/architecture/adr/
git mv docs/adr/0008-superpowers-workflow-replaces-gsd.md docs/architecture/adr/
git mv docs/adr/0010-mega-module-rebuild-over-split.md docs/architecture/adr/
git mv docs/adr/README.md docs/architecture/adr/README.md

# Commit 3 — root file re-home
git mv docs/MULTI-TENANT-AUDIT.md docs/audits/MULTI-TENANT-AUDIT.md
git mv docs/QA-COVERAGE-MATRIX.md docs/quality/QA-COVERAGE-MATRIX.md

# Commit 4 — consolidate roadmap
git mv docs/roadmap/deferred-tests.md docs/quality/deferred-tests.md
rmdir docs/roadmap
```

## Validation checklist

- [ ] All `docs/adr/` references in code updated (only `scripts/update-scorecard.ts:32`).
- [ ] Scorecard script still produces a valid ADR count.
- [ ] `.gitignore` covers `.DS_Store` at root.
- [ ] No new broken markdown links inside `docs/` (`rg '\]\(.*docs/adr' docs/` returns 0 after ADR move).
- [ ] `docs/INDEX.md` created.
- [ ] `docs/product/prd/PRD_INDEX.md` created and links resolve.
- [ ] 2 broken refs in `docs/ARCHITECTURE.md` fixed.
- [ ] Pre-existing broken refs (PATTERNS.lock.md, E2E_REMEDIATION_FINAL.md) flagged in cleanup report — separate followup.

## Remaining risks

- ADR move: if any external blog/wiki/PR description deep-links to `docs/adr/0001-…`, those break. Mitigated by: (a) GitHub follows renames, (b) commit message names new path.
- `docs/_archive/` removal: future archive lands in a recreated dir. No risk if convention is followed.

## What's NOT being done (intentionally)

- Moving `docs/quality/` content (8-script footprint).
- Moving `docs/ver-3/` (versioned snapshot, 130 files).
- Renaming `docs/ARCHITECTURE.md`.
- Restructuring `docs/product/modules/` (canonical).
- Touching `docs/aha/`, `docs/security/`, `docs/workflow/`, `docs/project-map/`, `docs/audits/domain-graph/`.
- Fixing `scripts/ui-consistency-detect.ts` + `guards.ts` broken refs (need separate investigation).
- Adding `docs/engineering/` dir (no clear win).

---

## HITL Gate 2 — approve before Phase 3

7 commits planned. ~14 files moved, 3 files deleted, 2 files created, 1 script edit, 2 broken-ref fixes. Out-of-scope items explicitly listed.
