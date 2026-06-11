# PRD Index Draft

> AHA prompt **01** output for **this repository** (dentalemon). Date: 2026-06-11.
> Draft only — the canonical index, if approved, will live at `docs/prd/PRD_INDEX.md`
> (note: NOT `docs/product/prd/` — this repo's existing convention is `docs/prd/` for
> the PRD layer and `docs/product/` for the engineering-spec layer; we keep it).

## Active PRD Candidates

| Module / Feature | Current File | Suggested Canonical Path | Confidence | Notes |
|---|---|---|---:|---|
| Whole product (v3) | `docs/prd/v3-dentalemon.md` | Keep in place | H | The single authoritative PRD. ~2500 lines: vision, personas, MVP scope, feature scope, business model. |

## Historical PRD Candidates

| Module / Feature | Current File | Suggested Historical Path | Reason | Notes |
|---|---|---|---|---|
| — | none found | — | — | No v1/v2 PRD files exist in the tree; `docs/prd/context/design-doc.md` narrates the v2→v3 transition but is a supporting doc, not a superseded PRD. |

## Supporting Requirement Files

| Area | Current File | Type | Suggested Path | Notes |
|---|---|---|---|---|
| Business rules | `docs/prd/BUSINESS_RULES.md` | Business rules (BR-001..048) | Keep — **load-bearing** | Consumed by `scripts/audit-traceability.ts`, br-registry, 2 backend tests |
| Acceptance criteria | `docs/prd/ACCEPTANCE_CRITERIA.md` | Acceptance criteria | Keep — **load-bearing** | Consumed by traceability script |
| Design narrative | `docs/prd/context/design-doc.md` | Design rationale | Keep | APPROVED 2026-05-01 |
| Wireframes | `docs/prd/context/wireframes/*.html` (28) + `workspace-wireframe.html` | UI/UX prototypes | Keep | Referenced by UI_CONSISTENCY_SPEC |
| Clinical constraints | `docs/clinical/STANDARDS_COMPLIANCE.md` | Regulatory requirement | Keep | AAP/EFP 2017, ceph calibration; binding non-goals (no-AI, offline-first) |
| Improvement backlog | `docs/reviews/IMPROVEMENT_BACKLOG.md` | Ranked product backlog (P0–P3) | Keep | Advisory layer feeding roadmap |

## Engineering Specs Mistaken for PRDs

| File | Reason Not PRD | Suggested Category |
|---|---|---|
| `docs/product/modules/*/MODULE_SPEC.md` (14) | Engineer-facing module specs derived from PRD sections; codegen/skill inputs | Engineering spec layer — keep in `docs/product/` |
| `docs/product/{MODULE_MAP,DOMAIN_MODEL,WORKFLOW_MAP,DOMAIN_GLOSSARY}.md` | Generated/maintained by oli skills from the PRD; sole-owned | Engineering spec layer — keep |
| `docs/product/modules/*/API_CONTRACTS.md` | Mirror TypeSpec API source of truth | API spec — keep |
| `docs/context/CEPH_TRACING_MODULE_PRD_AND_IMPLEMENTATION_SPEC.md` | External research guide despite "PRD" in name; reconciled against code as a reference standard | Reference standard — keep in `docs/context/` |
| `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` | External reference standard used as audit baseline | Reference standard — keep |

## Needs Review

| File | Reason | Suggested Action |
|---|---|---|
| `docs/product/MASTER_PRD.md` (does not exist) | Referenced by 5 `.claude/skills/*/SKILL.md` files (`module-specs`, `audit-compliance`, `ui-prototype-pack`, `vertical-slice-plan`, `prd-audit`) | Either point those skills at `docs/prd/v3-dentalemon.md` or accept the documented fallback behavior; flagged for prompt 03 as a low-risk reference fix |
| `docs/prd/` vs `docs/product/` naming | Two-layer pattern is sound but undocumented at the top of each folder | Optional: one-paragraph README in each folder declaring the layer split (prompt 03 candidate) |
