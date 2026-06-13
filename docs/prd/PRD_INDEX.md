# PRD Index

This repo uses a **two-layer requirements pattern**:

- **`docs/prd/`** (this folder) — the canonical product requirements layer: what to build and why.
- **`docs/product/`** — the engineering-spec layer derived from the PRD: domain model, module specs, API contracts, UI prototypes. See [`docs/product/`](../product/).

## Active PRDs

| Module / Feature | File | Status | Source | Notes |
|---|---|---|---|---|
| Whole product (v3) | [`v3-dentalemon.md`](./v3-dentalemon.md) | **Canonical / current** | Product | Single authoritative PRD: vision, personas, MVP scope, feature scope, business model |

## Historical PRDs

| Module / Feature | File | Previous Location | Reason Archived | Notes |
|---|---|---|---|---|
| — | none | — | — | No superseded PRD files exist in the tree; the v2→v3 transition is narrated in `context/design-doc.md` |

## Supporting Requirement Files

| Area | File | Type | Notes |
|---|---|---|---|
| Business rules | [`BUSINESS_RULES.md`](./BUSINESS_RULES.md) | BR-001..048 catalog | **Load-bearing**: consumed by `scripts/audit-traceability.ts`, `specs/api/docs/standards/br-registry.json`, backend tests — do not move |
| Acceptance criteria | [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md) | Given/When/Then gates | **Load-bearing**: consumed by `scripts/audit-traceability.ts` — do not move |
| Design rationale | [`context/design-doc.md`](./context/design-doc.md) | v2→v3 design narrative | APPROVED 2026-05-01 |
| Wireframes | [`context/wireframes/`](./context/wireframes/) (28 HTML) + [`context/workspace-wireframe.html`](./context/workspace-wireframe.html) | UI/UX prototypes | Referenced by `docs/product/UI_CONSISTENCY_SPEC.md` |
| Clinical constraints | [`../clinical/STANDARDS_COMPLIANCE.md`](../clinical/STANDARDS_COMPLIANCE.md) | Regulatory requirement | AAP/EFP 2017 perio, ceph calibration; binding non-goals (no-AI, offline-first) |
| Improvement backlog | [`../reviews/IMPROVEMENT_BACKLOG.md`](../reviews/IMPROVEMENT_BACKLOG.md) | Ranked P0–P3 backlog | Advisory layer feeding roadmap |

## Module-Level Specs (engineering layer — not PRDs)

Per-module requirements derived from the PRD live at
`docs/product/modules/<module>/MODULE_SPEC.md` (+ `API_CONTRACTS.md`, `ui-prototype/`).
They cite PRD sections and are inputs to skills and code generation — see
[`docs/product/MODULE_MAP.md`](../product/MODULE_MAP.md) for the full module list.

## Needs Review

| File | Reason | Suggested Action |
|---|---|---|
| — | none currently | — |
