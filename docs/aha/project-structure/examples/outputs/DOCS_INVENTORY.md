# Documentation Inventory

> AHA prompt **01** output. Companion artifacts:
> - `../migration-plans/DOCS_MIGRATION_PLAN.md`
> - `./PRD_INDEX_DRAFT.md`
>
> **Inventory + planning only.** No moves, deletes, renames, or rewrites performed.
> Audit date: 2026-06-11. Snapshot of `docs/` after the 2026-06-10 restructure
> (see `docs/DOCS_CLEANUP_REPORT.md` for that prior round).

## Summary

| Metric | Count |
|---|---:|
| Total files scanned | 446 |
| Markdown files | 432 |
| Non-markdown files (json/yaml/ts/DS_Store) | 14 |
| Root-level `docs/` files | 6 |
| Top-level directories | 11 |
| PRD-related files (incl. handler-level + product-module + cross-cutting + UX screens) | ~298 |
| Architecture files (ADRs + standing arch docs) | 12 |
| Engineering / quality / audit files (`docs/quality` + `docs/audits` + `docs/security`) | 38 |
| Execution / slice files (`docs/execution`) | 36 |
| Audit / AHA / AI-prompting files (`docs/aha`) | 15 |
| Project-map (generated nav + `generate.ts`) | 6 |
| Workflow doc | 1 |
| Archive candidates (this audit) | 1 (`docs/aha/copy.md`) |
| Duplicate-basename collisions (by filename only — NOT semantic dupes) | 13 basenames |
| Broken-reference risks (load-bearing external refs) | 8 |

## File counts by top-level dir

| Dir | Files | Primary category | Notes |
|---|---:|---|---|
| `docs/product/` | 202 | Product / PRD | Master PRD + 22 nested module specs + 16 flat handler specs + cross-cutting foundation docs + 76 ui-prototype files |
| `docs/ver-3/` | 130 | Product (versioned) + UX | Versioned snapshot of v3 PRD suite (33 PRD-ish files + 109 per-screen UX specs + business-rules registry) — keep intact |
| `docs/execution/` | 36 | Engineering | 6 wave plans + 13 SLICE_SPEC.md + 17 TDD_PROOF.md |
| `docs/quality/` | 32 | Engineering / audit | Scorecards, baselines, SCOPE.*, handoffs, observability/contract/E2E coverage |
| `docs/aha/` | 15 | Audit / AI prompting | 8 step prompts + `copy.md` + 4 project-structure prompts + .DS_Store cruft + this output |
| `docs/architecture/` | 12 | Architecture | 11 ADRs (`adr/0000-template.md` … `0010-mega-module-rebuild-over-split.md` + `README.md`) + `COMMS-CONSOLIDATION.md` |
| `docs/project-map/` | 6 | Generated nav | Includes the live `generate.ts` script — do NOT move |
| `docs/security/` | 4 | Engineering / audit | `security-quickscan.json`, `migrations-audit.json`, audit md — load-bearing scripts |
| `docs/audits/` | 2 | Audit | `MULTI-TENANT-AUDIT.md`, `domain-graph/DOMAIN_OVERVIEW.md` |
| `docs/workflow/` | 1 | Engineering | `SUPERPOWERS_FLOW.md` — referenced by root `CLAUDE.md` |
| `docs/` root | 6 | Mixed | `README.md`, `ARCHITECTURE.md`, `DOCS_INVENTORY.md`, `DOCS_MIGRATION_PLAN.md`, `DOCS_CLEANUP_REPORT.md`, `.DS_Store` |

## Current Docs Observations

- **Two-layer PRD pattern is in place** (Master + nested module-spec + flat handler-spec + versioned `ver-3/`). Documented in `docs/README.md`, `docs/DOCS_CLEANUP_REPORT.md`, and `docs/product/prd/PRD_INDEX.md`. Not a misplacement — but it does mean PRD content lives in **four** physical locations.
- **PRD content already inventoried.** `docs/product/prd/PRD_INDEX.md` (created `fcdfb666`) is the canonical PRD index. This audit's `PRD_INDEX_DRAFT.md` is a re-derivation against the prompt's classification schema — not a replacement.
- **Root-level workflow artifacts persist.** `docs/DOCS_INVENTORY.md`, `docs/DOCS_MIGRATION_PLAN.md`, and `docs/DOCS_CLEANUP_REPORT.md` from the 2026-06-10 cleanup sit at `docs/` root, not in an AHA folder. They could be moved into `docs/aha/project-structure/outputs/` later for consistency with this prompt's conventions.
- **`docs/aha/copy.md` is unexplained.** Filename suggests a scratch/duplicate. Mark `[NEEDS REVIEW]` — do not archive yet.
- **`docs/aha/.DS_Store` and `docs/.DS_Store`** are tracked-by-presence but `.gitignore`-covered — untracked, no action.
- **Short-form module landing pages co-exist with nested module specs.** `docs/product/modules/m01-auth-onboarding.md` (overview) sits next to `docs/product/modules/m01-auth-onboarding/MODULE_SPEC.md` (full spec). Cross-checked — different audiences, not duplicates. Pattern repeats 19× (modules m01–m19; m20–m22 have no short-form). `[NEEDS REVIEW]` for consistency (either backfill m20–m22 short-forms or delete the m01–m19 ones).
- **`ver-3/` is a parallel PRD suite, not historical-yet.** It is referenced as the authoritative v3 PRD by `CONTRIBUTING.md:2456`, `CONTRIBUTING.md:2472`, root `CLAUDE.md` indirectly, plus `docs/project-map/generate.ts`. Not safe to archive even though it visually resembles a historical bucket.
- **Per-module `API_CONTRACTS.md` (22 files) are engineering specs** living inside `docs/product/modules/*`. Schema-level / wire-level. Not PRDs. Properly co-located with module spec, so the location is fine — but the **classification mistake** would be to treat them as PRDs.
- **`docs/execution/` and `docs/execution/slices/`** mix wave-level plans and per-slice TDD proofs. Already a clean engineering bucket — no action.
- **Duplicate basenames** are NOT semantic duplicates. 22× `MODULE_SPEC.md` / 22× `API_CONTRACTS.md` / 23× `NAVIGATION_MAP.md` / 17× `TDD_PROOF.md` / 13× `SLICE_SPEC.md` / 19× `screens.md`/`components.md`/`mock-data.md`/`interaction-states.md` — all are intentional per-module/per-slice repetition. Flag only `README.md` (3×), `training.md` (3×), `events.md` (3×), `dashboard.md` (3×), `training-detail.md` (2×), `payments.md` (2×), `jobs.md` (2×) for human eyeball confirmation.
- **No formal archive bucket exists yet.** Previous cleanup deleted `docs/_archive/` after emptying it. Re-create only when first archive candidate is approved.

## File Classification

Per-file enumeration of all 432 markdown + 14 non-md files would be 446 rows. Instead, this section classifies by directory bucket. For deep per-file PRD classification, see `PRD_INDEX_DRAFT.md`.

| Current Path (or pattern) | Category | Confidence | Referenced By | Suggested Action |
|---|---|---:|---|---|
| `docs/README.md` | Index | 1.0 | none external — read by humans hitting `docs/` | Keep at root |
| `docs/ARCHITECTURE.md` | Architecture | 1.0 | `QUICKSTART.md`, `services/api-ts/CONTRIBUTING.md`, root `ARCHITECTURE.md` | Keep at root — high-risk to move |
| `docs/DOCS_INVENTORY.md` | Audit (process artifact) | 1.0 | `docs/README.md`, `docs/DOCS_CLEANUP_REPORT.md` | Keep — or migrate into `docs/aha/project-structure/outputs/` for AHA consistency |
| `docs/DOCS_MIGRATION_PLAN.md` | Audit (process artifact) | 1.0 | `docs/README.md`, `docs/DOCS_CLEANUP_REPORT.md` | Keep — or migrate into `docs/aha/project-structure/migration-plans/` |
| `docs/DOCS_CLEANUP_REPORT.md` | Audit (process artifact) | 1.0 | `docs/README.md` | Keep — or migrate into `docs/aha/project-structure/outputs/` |
| `docs/.DS_Store` | Cruft | 1.0 | none | Already gitignored — untracked; no action |
| `docs/product/MASTER_PRD.md` | Product / Canonical PRD | 1.0 | `docs/product/prd/PRD_INDEX.md`, every nested module spec | Keep in place |
| `docs/product/MODULE_SPEC.*.md` (16 flat files) | Product / Engineering hybrid (handler-level) | 0.95 | `docs/quality/MODULE_SPEC_HANDOFF.md`, `docs/quality/SCOPE.*` | Keep in place — load-bearing |
| `docs/product/modules/m{NN}-*/MODULE_SPEC.md` (22 nested) | Product / Canonical PRD | 1.0 | `docs/product/prd/PRD_INDEX.md`, `MASTER_PRD.md` | Keep in place |
| `docs/product/modules/m{NN}-*/API_CONTRACTS.md` (22) | Engineering (API spec) | 0.95 | sibling MODULE_SPEC.md | Keep in place — co-located is correct |
| `docs/product/modules/m{NN}-*/NAVIGATION_MAP.md` (23) | Product (UX/IA) | 0.9 | sibling MODULE_SPEC.md | Keep in place |
| `docs/product/modules/m{NN}-*/ui-prototype/*.md` (76 files: components/screens/interaction-states/mock-data) | Product / UX | 0.9 | sibling MODULE_SPEC.md | Keep in place |
| `docs/product/modules/m{NN}-*.md` (19 short-form, m01–m19) | Product (overview / supporting) | 0.85 | `docs/project-map/INDEX.md` (generated) | `[NEEDS REVIEW]` — confirm intent vs nested MODULE_SPEC; either backfill m20–m22 or delete |
| `docs/product/{DOMAIN_MODEL,WORKFLOW_MAP,STATE_MACHINES,EVENT_CONTRACTS,DOMAIN_GLOSSARY,ERROR_TAXONOMY,ROLE_PERMISSION_MATRIX,API_CONVENTIONS,AUDIT_CONTRACTS,DATA_GOVERNANCE,DISASTER_RECOVERY,MODULE_MAP,NAVIGATION_MAP,OBSERVABILITY,PERFORMANCE,SEED_MANIFEST,THREAT_MODEL,UI_BLUEPRINT,UI_CONSISTENCY_SPEC}.md` | Cross-cutting (product + arch hybrid) | 0.9 | Many — load-bearing | Keep in place |
| `docs/product/prd/PRD_INDEX.md` | Product (index) | 1.0 | `docs/README.md`, `docs/DOCS_CLEANUP_REPORT.md` | Keep — canonical PRD index |
| `docs/ver-3/business/br-registry.json` | Product / Engineering (test registry) | 1.0 | `docs/project-map/generate.ts:29`, `scripts/br-coverage.ts:20`, `testing/registry/report.ts:13` | DO NOT MOVE — 3+ code refs |
| `docs/ver-3/business/personas-and-roles.md` | Product (supporting requirement) | 0.95 | `docs/project-map/generate.ts:30` | DO NOT MOVE |
| `docs/ver-3/business/{business-rules,context,cross-cutting,metrics,roadmap}.md` | Product (supporting requirement) | 0.9 | sibling references | Keep — versioned bucket intact |
| `docs/ver-3/ux/screens/**/*.md` (109 files) | Product / UX (per-screen spec) | 0.95 | `docs/ver-3/ux/screen-inventory.md` | Keep — versioned bucket intact |
| `docs/ver-3/{DESIGN,EXECUTION-CHECKLIST,GAP-BACKLOG,HANDLER-MODULE-MAP,plan,manifest}.md` | Mixed (PRD + execution + manifest) | 0.85 | inter-bucket references | Keep — versioned bucket intact |
| `docs/ver-3/plans/{finances-ux-overhaul,ux-inspiration-queue,wave5-governance-ux-audit}.md` | Product (plan / supporting requirement) | 0.85 | none external observed | Keep — `ux-inspiration-queue.md` is "SUPERSEDED" per auto-memory; verify before any future archive |
| `docs/architecture/COMMS-CONSOLIDATION.md` | Architecture | 1.0 | none external observed | Keep in place |
| `docs/architecture/adr/0000-template.md` … `0010-mega-module-rebuild-over-split.md` (11 files) + `README.md` | Architecture (ADR) | 1.0 | `scripts/update-scorecard.ts:32` (reads `docs/architecture/adr/`) | DO NOT MOVE — load-bearing script ref |
| `docs/aha/00-aha-shared-rules.md` … `07-consolidate-roadmap.md` (8 step prompts) | Audit / AI prompting | 1.0 | each other | Keep — already isolated |
| `docs/aha/copy.md` | Audit / AI prompting | 0.5 | none observed | `[NEEDS REVIEW]` — likely scratch; archive candidate |
| `docs/aha/project-structure/prompts/01-04*.md` | Audit / AI prompting | 1.0 | each other (this audit) | Keep |
| `docs/aha/.DS_Store`, `docs/aha/project-structure/.DS_Store` | Cruft | 1.0 | none | Already gitignored; untracked |
| `docs/audits/MULTI-TENANT-AUDIT.md` | Audit | 1.0 | `.audits/PRODUCTION_AUDIT.md` | Keep in place |
| `docs/audits/domain-graph/DOMAIN_OVERVIEW.md` | Audit | 1.0 | none external observed | Keep in place |
| `docs/execution/VERTICAL_SLICE_PLAN.md`, `WAVE{0B,1_PHASE1B,2A,2B,3A}_VERTICAL_SLICE_PLAN.md` | Engineering (execution plan) | 1.0 | inter-bucket | Keep |
| `docs/execution/slices/*/SLICE_SPEC.md` (13) | Engineering (spec) | 1.0 | sibling `TDD_PROOF.md` | Keep |
| `docs/execution/slices/*/TDD_PROOF.md` (17) | Engineering (test proof) | 1.0 | sibling `SLICE_SPEC.md` | Keep |
| `docs/quality/SCORECARD.md` | Quality (generated) | 1.0 | `scripts/update-scorecard.ts` writes here | DO NOT MOVE |
| `docs/quality/CONTRACT_COVERAGE.{md,json}` | Quality | 1.0 | `scripts/update-scorecard.ts:15` | DO NOT MOVE |
| `docs/quality/E2E_DEPTH_AUDIT.{md,json}` | Quality | 1.0 | `scripts/update-scorecard.ts:16` | DO NOT MOVE |
| `docs/quality/OBSERVABILITY_AUDIT.{md,json}` | Quality | 1.0 | `scripts/audit-observability.ts:21`, `scripts/update-scorecard.ts:19` | DO NOT MOVE |
| `docs/quality/SDK_BASELINE_OPS.json` | Quality (baseline) | 1.0 | `scripts/check-sdk-compat.ts:33` | DO NOT MOVE |
| `docs/quality/R0_BASELINE.md` | Quality | 1.0 | `docs/quality/SDK_BASELINE_OPS.json` (referenced internally) | Keep |
| `docs/quality/R{1,2,3,4,5}_*_SCOPE.md` (R1 chapters, R2 governance, R3 credentials, R4 directory, R5 elections, R5 officers) | Quality / supporting requirement | 0.95 | each other | Keep |
| `docs/quality/SCOPE.{membership,dues-special-assessments,certificates,credits}.md` | Audit-derived requirement | 0.9 | `docs/quality/MODULE_SPEC_HANDOFF.md` | Keep — audit tier |
| `docs/quality/{MODULE_SPEC_HANDOFF,MODULE_SPEC_TEMPLATE,CONTRACT_COVERAGE_HANDOFF,E2E_DEPTH_HANDOFF,OBSERVABILITY_HANDOFF,MEGA_MODULE_DECISION,RECON_BASELINE,REMAINING_SCOPE,WAVE_3_5_2_INVESTIGATION,deferred-tests}.md` | Quality / audit handoff | 0.95 | various | Keep |
| `docs/quality/HAND_WIRED_ROUTES.yaml` | Engineering config | 1.0 | various | Keep |
| `docs/quality/RECON_BASELINE.fe-matrix.json` | Quality (baseline) | 1.0 | sibling .md | Keep |
| `docs/quality/QA-COVERAGE-MATRIX.md` | Quality | 1.0 | previously moved from root | Keep |
| `docs/security/security-quickscan.json` | Engineering / audit (generated) | 1.0 | `scripts/security-quickscan.ts:331`, `scripts/update-scorecard.ts:17` | DO NOT MOVE |
| `docs/security/migrations-audit.json` | Engineering / audit (generated) | 1.0 | `scripts/update-scorecard.ts:18` | DO NOT MOVE |
| `docs/security/security-audit.md`, related .md | Engineering / audit | 1.0 | inter-bucket | Keep |
| `docs/workflow/SUPERPOWERS_FLOW.md` | Engineering / workflow | 1.0 | root `CLAUDE.md:444` | DO NOT MOVE |
| `docs/project-map/generate.ts` | Engineering (script) | 1.0 | usage: `bun docs/project-map/generate.ts` | DO NOT MOVE |
| `docs/project-map/INDEX.md` + other generated md | Engineering (generated nav) | 1.0 | `generate.ts` writes them | DO NOT MOVE |

## PRD Candidates

> Detailed PRD-by-PRD enumeration lives in `PRD_INDEX_DRAFT.md`. This table summarizes by tier.

| Tier (per prompt §5) | Locations / files | Count | Suggested Target (this prompt's schema) | Notes |
|---|---|---:|---|---|
| 1. Canonical PRD — Master | `docs/product/MASTER_PRD.md` | 1 | `docs/product/prd/active/MASTER_PRD.md` | Already canonical; physical move not proposed (cross-ref cost) |
| 1. Canonical PRD — Product-module | `docs/product/modules/m{NN}-*/MODULE_SPEC.md` | 22 | `docs/product/prd/active/m{NN}-*/MODULE_SPEC.md` | Move would break 100+ cross-refs; recommend **status quo + treat `docs/product/modules/` as the canonical PRD root** |
| 1. Canonical PRD — Handler-level (different layer, both canonical) | `docs/product/MODULE_SPEC.*.md` | 16 | `docs/product/prd/active/` (handler tier) | Two-layer PRD pattern — handler tier already documented in `PRD_INDEX.md` |
| 2. Historical PRD | None explicitly marked. `ver-3/` is "versioned" but currently authoritative (`CONTRIBUTING.md:2472`). | 0 | `docs/product/prd/historical/` (empty for now) | Do not pre-archive `ver-3/` |
| 3. Supporting Requirement | `docs/product/modules/m*/{NAVIGATION_MAP,ui-prototype/*}.md` (~99 files); `docs/ver-3/ux/screens/**` (109 files); `docs/ver-3/business/*.md`; `docs/product/{DOMAIN_GLOSSARY,ROLE_PERMISSION_MATRIX,…}.md` | ~280 | `docs/product/requirements/` (theoretical) | Stay in place — co-location is the value |
| 4. Engineering Spec (mistaken-for-PRD risk) | `docs/product/modules/m*/API_CONTRACTS.md` (22); `docs/architecture/adr/*` (11); `docs/execution/slices/*/SLICE_SPEC.md` (13); `docs/execution/**` plan files | ~50 | Already in correct buckets | Do NOT promote any of these into a PRD folder |
| 5. Audit-derived Requirement | `docs/quality/SCOPE.*.md` (4); `docs/quality/R{0..5}_*.md` (6); `docs/quality/MEGA_MODULE_DECISION.md`; `docs/audits/MULTI-TENANT-AUDIT.md`; `docs/audits/domain-graph/DOMAIN_OVERVIEW.md` | ~13 | Keep in audit buckets | Per prompt §5.5: do not promote unless explicitly stated |

## Archive Candidates

| Current Path | Reason | Safe to Archive Later? | References Found |
|---|---|---|---|
| `docs/aha/copy.md` | Filename suggests scratch / duplicate-of-something. Not referenced. | YES once human confirms intent | grep finds no inbound refs |
| `docs/ver-3/plans/ux-inspiration-queue.md` | Auto-memory `ux-inspiration-queue` marks it "SUPERSEDED by strategic upgrade plan" | YES once human confirms supersedence | none external observed; live `.planning/` mentions exist but treat as informational |
| `docs/product/modules/m01-auth-onboarding.md` … `m19-committee-management.md` (19 short-form overviews) | Possibly redundant with nested MODULE_SPEC | `[NEEDS REVIEW]` — could also be the intended landing pages; do not archive yet | `docs/project-map/INDEX.md` (generated) likely references them |
| (nothing else this round) | — | — | — |

## Duplicate / Near-Duplicate Candidates

Filename-only basename collisions. Most are intentional per-module/per-slice repetition and NOT semantic duplicates. Flagged for eyeball confirmation only.

| File A | File B | Similarity Reason | Suggested Canonical |
|---|---|---|---|
| `docs/product/modules/m05-membership/MODULE_SPEC.md` (and 21 siblings) | `docs/product/MODULE_SPEC.member.membership.md` (and 15 flat siblings) | Same `MODULE_SPEC.*` basename pattern at two layers | KEEP BOTH — different layers (product-module PRD vs handler spec). Documented in `docs/README.md` |
| `docs/product/modules/m{NN}-*.md` (19 files) | `docs/product/modules/m{NN}-*/MODULE_SPEC.md` (22 files) | Short-form landing + nested full spec for same module slug | `[NEEDS REVIEW]` — pick one pattern across all 22 modules |
| `docs/ver-3/ux/screens/*/training.md` (3 occurrences across member/officer/org-member) | siblings | Same filename, different role surface | KEEP BOTH — per-role screen specs |
| `docs/ver-3/ux/screens/*/events.md` (3) | siblings | Same filename, different role surface | KEEP BOTH |
| `docs/ver-3/ux/screens/*/dashboard.md` (3) | siblings | Same filename, different role surface | KEEP BOTH |
| `docs/ver-3/ux/screens/*/payments.md` (2) | siblings | Same filename, different role surface | KEEP BOTH |
| `docs/ver-3/ux/screens/*/jobs.md` (2) | siblings | Same filename, different role surface | KEEP BOTH |
| `docs/ver-3/ux/screens/*/training-detail.md` (2) | siblings | Same filename, different role surface | KEEP BOTH |
| `docs/architecture/adr/README.md`, `docs/ver-3/business/modules/README.md`, root `docs/README.md` | sibling READMEs | Folder-local index | KEEP BOTH (different folders) |
| `docs/product/modules/m*/API_CONTRACTS.md` (22) | siblings | Per-module API contract spec | KEEP — not duplicates |
| `docs/product/modules/m*/NAVIGATION_MAP.md` (23) | siblings | Per-module nav | KEEP — not duplicates |
| `docs/execution/slices/*/SLICE_SPEC.md` (13) | siblings | Per-slice spec | KEEP |
| `docs/execution/slices/*/TDD_PROOF.md` (17) | siblings | Per-slice TDD proof | KEEP |

## Do Not Move Yet

| Current Path | Reason |
|---|---|
| `docs/architecture/adr/` (whole tree) | `scripts/update-scorecard.ts:32` reads `readdirSync('docs/architecture/adr')` |
| `docs/workflow/SUPERPOWERS_FLOW.md` | Referenced by root `CLAUDE.md:444` |
| `docs/quality/SCORECARD.md`, `docs/quality/CONTRACT_COVERAGE.{md,json}`, `docs/quality/E2E_DEPTH_AUDIT.{md,json}`, `docs/quality/OBSERVABILITY_AUDIT.{md,json}`, `docs/quality/SDK_BASELINE_OPS.json` | Generated/consumed by `scripts/update-scorecard.ts`, `scripts/check-sdk-compat.ts`, `scripts/audit-observability.ts` |
| `docs/quality/R0_BASELINE.md` | Referenced inside `SDK_BASELINE_OPS.json` note field — semantic anchor |
| `docs/security/security-quickscan.json`, `docs/security/migrations-audit.json` | Written by `scripts/security-quickscan.ts`, read by `scripts/update-scorecard.ts` |
| `docs/ver-3/business/br-registry.json`, `docs/ver-3/business/personas-and-roles.md` | Read by `docs/project-map/generate.ts`, `scripts/br-coverage.ts`, `testing/registry/report.ts` |
| `docs/project-map/generate.ts` and the .md it writes | Script is co-located; do not split |
| `docs/audits/PATTERNS.lock.md` (if/when present) | Referenced by `scripts/ui-consistency-detect.ts:163` — check before any audit-bucket reshuffle |
| `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` (if/when present) | Referenced by `CONTRIBUTING.md:2454` — currently NOT in tree (already moved/removed); cross-ref likely stale |
| `docs/audits/SANITY_CHECK.md` (if/when present) | Referenced by `CONTRIBUTING.md:146` — currently NOT in tree; cross-ref likely stale |
| Root `docs/ARCHITECTURE.md` | Cross-refs from `QUICKSTART.md`, `services/api-ts/CONTRIBUTING.md`, root `ARCHITECTURE.md` |
| Root `docs/README.md` | Discoverability anchor |
| Root `docs/DOCS_INVENTORY.md`, `docs/DOCS_MIGRATION_PLAN.md`, `docs/DOCS_CLEANUP_REPORT.md` | Cross-ref each other + `docs/README.md`. Moving them now invalidates 4 inbound links. |

## Load-Bearing External Refs (re-confirmed)

| Referencing file | Doc reference | Risk class |
|---|---|---|
| `CLAUDE.md:444` | `docs/workflow/SUPERPOWERS_FLOW.md` | HIGH (top-level instructions) |
| `CONTRIBUTING.md:146` | `docs/audits/SANITY_CHECK.md` | **STALE** — file not present |
| `CONTRIBUTING.md:2436` | `docs/ver-3/business/br-registry.json` | HIGH (test infrastructure) |
| `CONTRIBUTING.md:2454` | `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` | **STALE** — file not present |
| `CONTRIBUTING.md:2456` | `docs/ver-3/` | HIGH |
| `CONTRIBUTING.md:2472` | `docs/ver-3/` PRD suite | HIGH |
| `scripts/update-scorecard.ts` | `docs/architecture/adr/`, `docs/quality/*.json`, `docs/security/*.json` | HIGH (CI ratchet) |
| `scripts/check-sdk-compat.ts:33` | `docs/quality/SDK_BASELINE_OPS.json` | HIGH (CI gate) |
| `scripts/audit-observability.ts:21` | `docs/quality/OBSERVABILITY_AUDIT.json` | HIGH |
| `scripts/security-quickscan.ts:331` | `docs/security/security-quickscan.json` | HIGH |
| `scripts/ui-consistency-detect.ts:68,163` | `docs/audits/PATTERNS.lock.md` | HIGH if file present; **possibly stale** |
| `scripts/br-coverage.ts:20` | `docs/ver-3/business/br-registry.json` | HIGH |
| `docs/project-map/generate.ts:29-30` | `docs/ver-3/business/br-registry.json`, `personas-and-roles.md` | HIGH |
| `testing/registry/report.ts:13` | `docs/ver-3/business/br-registry.json` | HIGH |

## Stale-Reference Findings (for the link-validation prompt #04)

- `CONTRIBUTING.md:146` → `docs/audits/SANITY_CHECK.md` — file not found in current tree.
- `CONTRIBUTING.md:2454` → `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` — file not found.
- `scripts/ui-consistency-detect.ts:68,163` → `docs/audits/PATTERNS.lock.md` — file not found.

These should NOT be fixed by this prompt — flag to prompt 04 for resolution.
