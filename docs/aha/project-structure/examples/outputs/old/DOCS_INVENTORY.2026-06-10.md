# Documentation Inventory

Generated as Phase 1 output of `docs/` audit + cleanup. Stop point: HITL gate 1 — review before migration plan (Phase 2).

## Summary

| Metric | Count |
|---|---|
| Top-level dirs | 13 |
| Total files | 432 |
| Markdown files | 418 |
| Non-markdown files | 14 |
| `.DS_Store` cruft | 3 |
| Duplicate markdown (md5 collision) | 0 |
| External refs from code/scripts | 25 source files |
| Internal refs inside docs/ | minimal (only `docs/README.md` matched) |
| Pre-existing broken refs | 4 (not caused by this migration) |

## File counts by top-level dir

| Dir | Files | Category | Action |
|---|---:|---|---|
| `docs/product/` | 201 | Product / PRD (mod specs + master PRD + cross-module) | **Keep** — co-located PRD pattern already in place |
| `docs/ver-3/` | 130 | Versioned bucket (plans, business rules, UX screens) | **Keep intact** — versioned snapshot, do not flatten |
| `docs/execution/` | 36 | Engineering execution (slice specs, TDD proofs, wave plans) | **Keep** — referenced by ARCHITECTURE.md slice template |
| `docs/quality/` | 30 | Audit outputs, scorecards, baselines, scope docs | **Keep** — load-bearing (8 script refs) |
| `docs/adr/` | 11 | Architecture decision records | **Optionally** move to `docs/architecture/adr/` — see Phase 2 |
| `docs/aha/` | 10 | Audit-Heal-Adopt prompts | **Keep** — already isolated |
| `docs/project-map/` | 6 | Generated nav (incl. `generate.ts` script) | **Keep** — script lives here, contains INDEX.md |
| `docs/security/` | 4 | Security audits + JSON output | **Keep** — load-bearing (2 script refs) |
| `docs/workflow/` | 1 | `SUPERPOWERS_FLOW.md` | **Keep** — referenced by `CLAUDE.md` |
| `docs/roadmap/` | 1 | `deferred-tests.md` | Move to `docs/quality/` |
| `docs/audits/` | 1 | `domain-graph/DOMAIN_OVERVIEW.md` | Consider folding with `docs/quality/` |
| `docs/architecture/` | 1 | `COMMS-CONSOLIDATION.md` | Re-home target if ADRs move here |
| `docs/_archive/` | 0 (empty after OLI removal) | — | Remove dir if empty, or keep as future archive bucket |
| `docs/` root | 4 md | `ARCHITECTURE.md`, `MULTI-TENANT-AUDIT.md`, `QA-COVERAGE-MATRIX.md`, `README.md` | See per-file table below |

## Root-level files

| File | Classification | Confidence | Referenced By | Suggested Action |
|---|---|---:|---|---|
| `docs/README.md` | Index | 1.0 | none external | Keep — promote to `docs/INDEX.md` content |
| `docs/ARCHITECTURE.md` | Architecture | 1.0 | `QUICKSTART.md`, `services/api-ts/CONTRIBUTING.md` | **Keep at root** OR move to `docs/architecture/ARCHITECTURE.md` with redirect — high risk, recommend keep |
| `docs/MULTI-TENANT-AUDIT.md` | Audit | 0.9 | none external (verify) | Move to `docs/quality/` or `docs/audits/` |
| `docs/QA-COVERAGE-MATRIX.md` | Quality / Audit | 0.9 | none external (verify) | Move to `docs/quality/` |

## Load-bearing external refs (script-managed)

These paths are **written and/or read** by scripts. Moving requires script updates in the same commit.

| Path | Read/Write | Source file |
|---|---|---|
| `docs/ver-3/business/br-registry.json` | R/W | `scripts/br-coverage.ts`, `testing/registry/report.ts`, `VERTICAL_TDD.md` |
| `docs/quality/CONTRACT_COVERAGE.json` | W | `scripts/contract-coverage-gap.ts` |
| `docs/quality/CONTRACT_COVERAGE.json` | R | `scripts/update-scorecard.ts` |
| `docs/quality/E2E_DEPTH_AUDIT.json` | W | `scripts/audit/e2e-depth-audit.ts` |
| `docs/quality/E2E_DEPTH_AUDIT.json` | R | `scripts/update-scorecard.ts` |
| `docs/quality/HAND_WIRED_ROUTES.yaml` | R | `scripts/check-hand-wired-routes.ts` |
| `docs/quality/OBSERVABILITY_AUDIT.json` | W | `scripts/audit-observability.ts` |
| `docs/quality/SDK_BASELINE_OPS.json` | R | `scripts/check-sdk-compat.ts` |
| `docs/quality/R0_BASELINE.md` | ref | `scripts/check-sdk-compat.ts` |
| `docs/quality/SCORECARD.md` | W | `scripts/update-scorecard.ts` |
| `docs/security/migrations-audit.json` | W | `scripts/audit-migrations.ts` |
| `docs/security/security-quickscan.json` | W | `scripts/security-quickscan.ts` |
| `docs/workflow/SUPERPOWERS_FLOW.md` | ref | `CLAUDE.md` |
| `docs/product/THREAT_MODEL.md` | ref (comment) | `services/api-ts/src/app.ts` |
| `docs/adr/` (count) | R | `scripts/update-scorecard.ts` |

**Implication**: keep `docs/quality/`, `docs/security/`, `docs/workflow/`, `docs/ver-3/business/`, `docs/adr/`, `docs/product/THREAT_MODEL.md` exactly where they are. Any move = 1-line script update each. Bundle script updates with the file move in the same commit.

## Pre-existing broken refs (NOT caused by migration — fix opportunistically)

| Broken Ref | Source | Suggested Fix |
|---|---|---|
| `docs/templates/MODULE_SPEC.template.md` | `docs/ARCHITECTURE.md` | Point to `docs/quality/MODULE_SPEC_TEMPLATE.md` |
| `docs/templates/SLICE_SPEC.template.md` | `docs/ARCHITECTURE.md` | No template exists — either create one from an existing slice or remove instruction |
| `docs/audits/PATTERNS.lock.md` | `scripts/ui-consistency-detect.ts` (×3) | Investigate — likely removed with OLI; either restore from git history or update script |
| `docs/audits/E2E_REMEDIATION_FINAL.md` | `apps/memberry/src/utils/guards.ts` | Update comment to point at current audit location or remove |

## PRD classification

Repo already follows **PRD-per-module** co-location pattern. No restructure needed.

| Path | PRD Type | Confidence |
|---|---|---:|
| `docs/product/MASTER_PRD.md` | Master PRD (cross-module) | 1.0 |
| `docs/product/modules/m##-{name}.md` (×22) | Module landing — PRD-like overview | 0.9 |
| `docs/product/modules/m##-{name}/MODULE_SPEC.md` (×22) | Module spec / detailed PRD | 0.95 |
| `docs/product/modules/m##-{name}/API_CONTRACTS.md` | API contract (engineering) | 0.9 |
| `docs/product/modules/m##-{name}/INTEGRATION_CONTRACTS.md` | Integration spec | 0.9 |
| `docs/product/modules/m##-{name}/NAVIGATION_MAP.md` | UI nav (engineering) | 0.9 |
| `docs/product/MODULE_SPEC.*.md` (×11 at product/ root) | **Conflict** — old flat-layout module specs alongside nested ones | 0.7 — **[NEEDS REVIEW]** |
| `docs/ver-3/plan.md`, `docs/ver-3/business/business-rules.md` | Versioned PRD snapshot | 1.0 |
| `docs/execution/*VERTICAL_SLICE_PLAN.md` | Engineering execution plan (NOT PRD) | 0.95 |
| `docs/execution/slices/*/SLICE_SPEC.md` | Engineering slice spec (NOT PRD) | 0.95 |
| `docs/quality/SCOPE.*.md`, `docs/quality/R[0-5]_*.md` | Audit-derived scope (NOT PRD) | 0.9 |
| `docs/quality/MEGA_MODULE_DECISION.md`, `docs/adr/0010-mega-module-rebuild-over-split.md` | ADR-like decisions | 0.9 |

**[NEEDS REVIEW] item**: `docs/product/MODULE_SPEC.*.md` (11 files at root) coexists with `docs/product/modules/m##/MODULE_SPEC.md` (22 nested). Likely **old flat layout** vs **new nested layout**. Need to confirm which is canonical before doing anything.

## Archive candidates

| Path | Reason | Safe to Archive? |
|---|---|---|
| `docs/_archive/` (empty) | Just `.DS_Store` left after OLI removal | Remove dir entirely, or keep as future bucket |
| 3× `.DS_Store` files (`docs/.DS_Store`, `docs/aha/.DS_Store`, `docs/_archive/.DS_Store`) | macOS cruft | Yes — delete + add to `.gitignore` if missing |
| `docs/product/MODULE_SPEC.*.md` (×11 at flat-product/ root) | Likely superseded by nested `docs/product/modules/m##/MODULE_SPEC.md` | **[NEEDS REVIEW]** — verify before move |

## Do Not Move Yet

| Path | Reason |
|---|---|
| `docs/quality/**` | 8 scripts read/write here — bundled move only |
| `docs/security/**` | 2 scripts write here |
| `docs/ver-3/business/br-registry.json` | 3 scripts + VERTICAL_TDD.md reference it |
| `docs/ver-3/**` (everything) | Versioned snapshot — flatten = data loss |
| `docs/workflow/SUPERPOWERS_FLOW.md` | `CLAUDE.md` ref |
| `docs/ARCHITECTURE.md` | `QUICKSTART.md` ref + `services/api-ts/CONTRIBUTING.md` ref |
| `docs/product/THREAT_MODEL.md` | `services/api-ts/src/app.ts` comment ref |
| `docs/adr/**` | `scripts/update-scorecard.ts` counts files here |
| `docs/aha/**` | Audit playbook isolated — don't mix with PRDs/audits |
| `docs/audits/domain-graph/` | If `@oli/engine` regen ever re-runs, it writes here |
| `docs/project-map/generate.ts` | Script lives alongside output |

---

## Recommended migration scope (preview — full plan in Phase 2)

**Minimal-risk moves** (low blast radius, clear win):

1. Delete 3 `.DS_Store` files + ensure `.gitignore` covers them.
2. Remove empty `docs/_archive/` OR repopulate by archiving superseded `docs/product/MODULE_SPEC.*.md` (pending review).
3. Move `docs/roadmap/deferred-tests.md` → `docs/quality/deferred-tests.md` (single file, no script refs found).
4. Move `docs/MULTI-TENANT-AUDIT.md` → `docs/audits/MULTI-TENANT-AUDIT.md`.
5. Move `docs/QA-COVERAGE-MATRIX.md` → `docs/quality/QA-COVERAGE-MATRIX.md`.
6. Move `docs/architecture/COMMS-CONSOLIDATION.md` → `docs/architecture/` is fine as future home; consider moving ADRs in.
7. Create `docs/product/prd/PRD_INDEX.md` indexing existing module PRDs.
8. Fix 4 pre-existing broken refs.
9. **[NEEDS REVIEW]** Reconcile flat `docs/product/MODULE_SPEC.*.md` vs nested `docs/product/modules/m##/MODULE_SPEC.md`.

**Out of scope** (too risky, low value):
- Moving `docs/quality/` (8 script touch points).
- Moving `docs/ver-3/` (versioned snapshot).
- Renaming root `docs/ARCHITECTURE.md`.
- Restructuring `docs/product/modules/` (already canonical).

---

## HITL Gate 1 — review before Phase 2

Approve or adjust:
- Minimal-risk move list above (8 items).
- Decision on flat-vs-nested `docs/product/MODULE_SPEC.*.md`.
- Whether to move ADRs into `docs/architecture/adr/` (low-risk — only `scripts/update-scorecard.ts` counts files, glob update needed).
- Whether to delete empty `docs/_archive/` or keep for future.
