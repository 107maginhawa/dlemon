# Documentation Inventory

> AHA prompt **01** output for **this repository** (dentalemon). Audit date: 2026-06-11.
> Inventory + classification only — **no moves performed**.
> Companion: `../migration-plans/DOCS_MIGRATION_PLAN.md`, `./PRD_INDEX_DRAFT.md`.
> Sample artifacts from a foreign repo live in `../examples/` and were ignored.

## Summary

- Total files scanned: **440** under `docs/`
- Markdown files: **314**
- Non-markdown files: **126** (64 teeth SVGs + wireframe XMLs in `development/`, 28 wireframe HTMLs + JSON in `prd/context/`, ~20 audit screenshots/logs in `audits/`, module ui-prototype assets in `product/`)
- PRD-related files: **1 canonical PRD** + 2 companion requirement docs + 4 context artifacts + ~120 engineering-spec files in `product/`
- Architecture files: **15** (`architecture/` 7 + `decisions/` 8 ADRs)
- Engineering files: **~90** (`development/` 16 md + 69 assets, `testing/` 5, `spikes/` 1, `execution/` 2)
- API/integration files: **1** (`api/ERROR_ENVELOPE.md`) + per-module `API_CONTRACTS.md` inside `product/modules/`
- Audit/prompt files: **~145** (`audits/` 90, `aha/` 29, `reviews/` 30 — reviews are product-advisory, see below)
- Archive candidates: **~35** (see table)
- Duplicate candidates: **4 sets** (see table)
- Broken reference risks: **1 confirmed** (`docs/product/MASTER_PRD.md` referenced by 5 skills, file does not exist)

## Current Docs Observations

- **The tree is coherent at its core, sprawling at its edges.** `docs/prd/` (canonical PRD layer) and `docs/product/` (engineering-spec layer) form a deliberate, well-documented two-layer pattern — they are NOT duplicates and must not be merged. The sprawl lives in the six audit-adjacent buckets (`audits/`, `reviews/`, `research/`, `spikes/`, `execution/`, `context/`), which have distinct de-facto purposes but no index explaining them.
- **Bucket purposes (verified):** `audits/` = systematic module audits + gap plans + trackers (operational); `reviews/` = industry/clinical benchmarking + improvement backlog (advisory, code-referenced); `research/` = exploratory standards research, self-described "may be superseded" (historical); `context/` = canonical external reference standards (living, audit baselines); `execution/` = slice specs/TDD proofs (nascent); `spikes/` = completed experiments.
- **Duplicate AHA prompt pack:** `docs/audits/module-gap-plans/aha/prompts/*.md` (8 files) is byte-identical (cmp-verified) to `docs/aha/prompts/*.md`. Canonical home per AHA shared rules §1 is `docs/aha/`. Plus two 1-byte `copy.md` debris files.
- **Two stale architecture duplicates** (already flagged in `docs/README.md` §8.2 known follow-ups): `docs/architecture/DOMAIN_MODEL.md` (~95% overlap with canonical `docs/product/DOMAIN_MODEL.md`) and `docs/architecture/ROLE_MATRIX.md` (subset of canonical `docs/product/ROLE_PERMISSION_MATRIX.md`).
- **Possible error-envelope overlap:** `docs/api/ERROR_ENVELOPE.md` vs `docs/architecture/ERROR_ENVELOPE_DENTALEMON.md` — NEEDS REVIEW.
- **Load-bearing docs are real and verified** (not just markdown links): `docs/prd/BUSINESS_RULES.md` + `ACCEPTANCE_CRITERIA.md` are read by `scripts/audit-traceability.ts`, `specs/api/docs/standards/br-registry.json`, and 2 backend tests; `docs/security/SECURITY_ADVISORIES.md` is referenced by `.github/workflows/quality.yml`; `docs/reviews/plans/04-case-presentation.md`, `plans/05-reminders-recall.md`, `research/perio.md` are cited in backend source/TypeSpec comments; `docs/development/*` is referenced by root `CONTRIBUTING.md`/`CLAUDE.md`/`AGENTS.md` and multiple skills.
- **One phantom path:** 5 `.claude/skills/*/SKILL.md` files reference `docs/product/MASTER_PRD.md`, which does not exist (skills have fallbacks; the real canonical PRD is `docs/prd/v3-dentalemon.md`).
- **Not broken (false alarm):** `specs/api/README.md` references `docs/standards/*` — these are relative to `specs/api/` and resolve to the existing `specs/api/docs/standards/` directory.
- **ADRs have a single home** at `docs/decisions/` (8 ADRs); `docs/architecture/` has no `adr/` subdir — no conflict, but no cross-link either.
- **Single-file stub dirs:** `observability/` (README only), `clinical/` (1), `runbooks/` (1), `security/` (1), `spikes/` (1) — fine to keep; consolidation would churn references for no gain.

## File Classification

| Current Path | Category | Confidence | Referenced By | Suggested Action |
|---|---|---:|---|---|
| `docs/README.md` | Docs index | H | many | Keep (update after moves) |
| `docs/prd/v3-dentalemon.md` | Product/Requirements (canonical PRD) | H | skills (fallback), docs | Keep in place |
| `docs/prd/BUSINESS_RULES.md`, `ACCEPTANCE_CRITERIA.md` | Product/Requirements | H | `scripts/audit-traceability.ts`, br-registry, 2 backend tests | **Do not move** |
| `docs/prd/context/**` (design-doc, design-approved.json, 28 wireframe HTMLs) | Product/Requirements (supporting) | H | UI_CONSISTENCY_SPEC, memory docs | Keep in place |
| `docs/product/*.md` (17 top-level specs) | Engineering spec layer (domain/API/security/design) | H | skills, code comments (`database.ts`, `rbac.test.ts`) | Keep in place |
| `docs/product/modules/**` (14 module dirs) | Engineering spec layer (module specs + ui-prototypes) | H | skills (`audit-compliance`, `module-specs`) | Keep in place |
| `docs/clinical/STANDARDS_COMPLIANCE.md` | Product/Requirements (regulatory) | H | memory/docs | Keep in place |
| `docs/architecture/{ARCHITECTURE,CONTRACT_SPINE,DESIGN,INTEGRATION_ENDPOINTS}.md` | Architecture | H | `CLAUDE.md`, skills | Keep in place |
| `docs/architecture/DOMAIN_MODEL.md` | Architecture (stale duplicate) | H | low | **Resolve duplicate** (canonical = `docs/product/DOMAIN_MODEL.md`) |
| `docs/architecture/ROLE_MATRIX.md` | Architecture (stale duplicate) | H | low | **Resolve duplicate** (canonical = `docs/product/ROLE_PERMISSION_MATRIX.md`) |
| `docs/architecture/ERROR_ENVELOPE_DENTALEMON.md` + `docs/api/ERROR_ENVELOPE.md` | API | M | docs | **[NEEDS REVIEW]** possible overlap |
| `docs/decisions/ADR-001..008.md` | Architecture (ADRs) | H | gap-plans, reviews | Keep in place; cross-link from architecture |
| `docs/development/*.md` (16: CONTRIBUTING_*, VERTICAL_TDD, MODULE_TEMPLATE, …) | Engineering | H | root CONTRIBUTING/CLAUDE/AGENTS, skills, api-ts scripts | **Do not move** |
| `docs/development/teeth/` (64 SVGs), `wireframes/` | Engineering assets | H | docs | Keep in place |
| `docs/testing/*.md` (5) | Engineering (dated snapshots) | H | memory/docs | Keep in place |
| `docs/security/SECURITY_ADVISORIES.md` | Compliance | H | `.github/workflows/quality.yml` | **Do not move** |
| `docs/observability/README.md`, `docs/runbooks/migration-rollback.md` | Operations | M | — | Keep in place |
| `docs/audits/{MODULE_AUDIT_TRACKER,MASTER-GAP-MATRIX}.md` | Audit (hub trackers) | H | research, gap-plans, commits | **Do not move** |
| `docs/audits/module-gap-plans/*.md` (20) | Audit (active gap source-of-truth) | H | trackers, execution slices | **Do not move** |
| `docs/audits/module-gap-plans/aha/prompts/` (8) + `aha/copy.md` | AI-prompting (duplicate pack) | H | none unique | **Remove duplicate** (canonical = `docs/aha/prompts/`) |
| `docs/audits/modules/*.md` (15 dated audits 2026-06-08) | Audit (historical snapshots) | H | MODULE_AUDIT_TRACKER | Archive candidate (conditional) |
| `docs/audits/{TRACEABILITY,SWEEP_*,MODULE_WORKFLOW_AUDIT}*.md` (dated) | Audit (historical snapshots) | M | matrix | Archive candidate (conditional) |
| `docs/audits/workflow-verification/**` | Audit/Execution (tracker + runs) | M | active resume point (memory) | Keep; `runs/*.txt` logs archive candidate |
| `docs/audits/workspace-workflow-research/**` (9) | Audit/Research (reconciled) | H | MASTER-GAP-MATRIX | Keep in place |
| `docs/audits/dental-charting/CHARTING_RESEARCH_RECONCILIATION.md` | Audit | M | context guides | Keep in place |
| `docs/reviews/**` (30: README, IMPROVEMENT_BACKLOG, modules/, plans/, research/) | Product advisory + research | H | backend code comments, TypeSpec (`plans/04`, `plans/05`, `research/perio.md`) | **Do not move** |
| `docs/research/**` (13 incl. external-references/) | Research (self-described exploratory) | M | none from code | Archive candidate **[NEEDS REVIEW]** |
| `docs/spikes/imaging-canvas-spike.md` | Engineering (completed spike) | M | none | Archive candidate **[NEEDS REVIEW]** (hardware validation pending) |
| `docs/execution/slices/patient-contact/` (2) | Execution (active slice) | H | gap matrix | Keep in place |
| `docs/context/*.md` (7: IDEAL standard, charting/imaging guides, personas, MODULES) | Product reference standards (living) | H | audits, reconciliations | **Do not move** |
| `docs/aha/prompts/*.md` (8 + copy.md) | AI-prompting (canonical pack) | H | audit workflow (next phase) | Keep; delete `copy.md` debris |
| `docs/aha/project-structure/**` | AI-prompting (this audit) | H | this pipeline | Keep in place |

## PRD Candidates

| Current Path | PRD Type | Confidence | Suggested Target | Notes |
|---|---|---:|---|---|
| `docs/prd/v3-dentalemon.md` | Canonical PRD | H | Keep at `docs/prd/` | The single authoritative PRD (v3, ~2500 lines). Moving would churn skill fallbacks for zero gain. |
| `docs/prd/BUSINESS_RULES.md` | Supporting Requirement | H | Keep (load-bearing) | BR-001..048; consumed by traceability script + tests |
| `docs/prd/ACCEPTANCE_CRITERIA.md` | Supporting Requirement | H | Keep (load-bearing) | AC gates; consumed by traceability script |
| `docs/prd/context/design-doc.md` | Supporting Requirement | M | Keep | v2→v3 design narrative, APPROVED |
| `docs/product/modules/*/MODULE_SPEC.md` (14) | Engineering Spec (module-level sub-PRDs) | H | Keep | Cite PRD sections; skill + codegen inputs |
| `docs/product/{MODULE_MAP,DOMAIN_MODEL,WORKFLOW_MAP}.md` | Engineering Spec (PRD-derived, generated) | H | Keep | Generated 2026-05-24 by oli skills; sole-owned |
| `docs/context/CEPH_TRACING_MODULE_PRD_AND_IMPLEMENTATION_SPEC.md` | Audit-Derived/External Requirement | M | Keep in `context/` | External guide, reconciled against code — not a canonical PRD |
| `docs/clinical/STANDARDS_COMPLIANCE.md` | Supporting Requirement (regulatory) | H | Keep | Binding clinical constraints + intentional non-goals |

## Archive Candidates

| Current Path | Reason | Safe to Archive Later? | References Found |
|---|---|---|---|
| `docs/audits/module-gap-plans/aha/prompts/` (8 files) | Byte-identical duplicate of `docs/aha/prompts/` | **Yes — delete** (not archive; zero unique content) | None unique to this copy |
| `docs/aha/prompts/copy.md`, `docs/audits/module-gap-plans/aha/copy.md` | 1-byte debris | **Yes — delete** | None |
| `docs/architecture/DOMAIN_MODEL.md` | Superseded by `docs/product/DOMAIN_MODEL.md` (canonical per docs/README.md §8.2) | Yes, after extracting any unique content | docs links only |
| `docs/architecture/ROLE_MATRIX.md` | Superseded by `docs/product/ROLE_PERMISSION_MATRIX.md` | Yes, after extracting any unique content | docs links only |
| `docs/audits/modules/*.md` (15) | Point-in-time module audits (2026-06-08), synthesized into tracker | Conditional — tracker links must be updated | `MODULE_AUDIT_TRACKER.md` |
| `docs/audits/workflow-verification/runs/*.txt` | Transient run logs | Yes | TRACKER summary suffices |
| `docs/research/**` (13) | Self-described "exploratory, may be superseded"; baseline 2026-06-06 | **[NEEDS REVIEW]** — may serve compliance audit trail | No code refs |
| `docs/spikes/imaging-canvas-spike.md` | Completed spike, hardware validation pending | **[NEEDS REVIEW]** | None |

## Duplicate / Near-Duplicate Candidates

| File A | File B | Similarity Reason | Suggested Canonical |
|---|---|---|---|
| `docs/aha/prompts/*.md` (8) | `docs/audits/module-gap-plans/aha/prompts/*.md` (8) | Byte-identical (cmp verified) | `docs/aha/prompts/` (per AHA shared rules §1) |
| `docs/product/DOMAIN_MODEL.md` | `docs/architecture/DOMAIN_MODEL.md` | ~95% overlap; product/ is sole-owned by generation skill | `docs/product/DOMAIN_MODEL.md` |
| `docs/product/ROLE_PERMISSION_MATRIX.md` | `docs/architecture/ROLE_MATRIX.md` | architecture/ is a 99-line subset of 220-line product/ doc; product/ is code-referenced | `docs/product/ROLE_PERMISSION_MATRIX.md` |
| `docs/api/ERROR_ENVELOPE.md` | `docs/architecture/ERROR_ENVELOPE_DENTALEMON.md` | Same topic, relationship unverified | **[NEEDS REVIEW]** |

## Do Not Move Yet

| Current Path | Reason |
|---|---|
| `docs/prd/BUSINESS_RULES.md`, `docs/prd/ACCEPTANCE_CRITERIA.md` | Read by `scripts/audit-traceability.ts`, `specs/api/docs/standards/br-registry.json`, `services/api-ts/src/tests/business-rules.test.ts`, `dental-perio-coverage.test.ts` |
| `docs/security/SECURITY_ADVISORIES.md` | Referenced by `.github/workflows/quality.yml` |
| `docs/development/**` | Referenced by root `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`, `.claude/skills/*`, `services/api-ts/scripts/verify-registry-uniqueness.ts` |
| `docs/reviews/plans/04-case-presentation.md`, `plans/05-reminders-recall.md`, `research/perio.md` | Cited in backend source/TypeSpec comments (`case-presentation.schema.ts`, `perio-staging.ts`, `perio-cal.ts`, `resolve-reminder-channels.ts`, `dental-patient-finance.tsp`) |
| `docs/product/**` | Skill inputs (`audit-compliance`, `module-specs`) + code comments (`database.ts`, `rbac.test.ts`); canonical engineering-spec layer |
| `docs/audits/{MODULE_AUDIT_TRACKER,MASTER-GAP-MATRIX}.md` + `module-gap-plans/*.md` | Hub trackers + gap source-of-truth; dense intra-docs reference web; active branch work resumes from them |
| `docs/context/**` | Audit baselines (IDEAL standard reconciled 2026-06-08; charting/imaging guides referenced by reconciliations) |
| `docs/architecture/ARCHITECTURE.md` | Linked from `CLAUDE.md` |
| `docs/aha/**` | This audit pipeline + the upcoming module-audit pack run from here |
