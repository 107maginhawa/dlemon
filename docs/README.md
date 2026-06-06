# Dentalemon Documentation

Start here. This index maps every documentation area for engineers joining the project.

Dentalemon is a spec-first Bun monorepo for dental practice management. The
canonical API contract lives **outside** `docs/` at
`specs/api/dist/openapi/openapi.json` — generated from TypeSpec; never hand-edited.

## 1. Orientation — read first
- [`architecture/ARCHITECTURE.md`](./architecture/ARCHITECTURE.md) — system architecture & key patterns
- [`context/DENTALEMON-DENTAL-WORKSPACE-REFERENCE-SPEC.md`](./context/DENTALEMON-DENTAL-WORKSPACE-REFERENCE-SPEC.md) — the carousel/workspace core concept
- [`context/MODULES.md`](./context/MODULES.md) — handler-module index
- [`context/personas.md`](./context/personas.md) — roles & user personas

## 2. Product & Domain
- [`prd/v3-dentalemon.md`](./prd/v3-dentalemon.md) — current PRD
- `prd/BUSINESS_RULES.md` · `prd/ACCEPTANCE_CRITERIA.md` — **consumed by `scripts/audit-traceability.ts`; do not move**
- `product/DOMAIN_GLOSSARY.md` · `DOMAIN_MODEL.md` · `WORKFLOW_MAP.md` · `NAVIGATION_MAP.md`
- `product/ROLE_PERMISSION_MATRIX.md` · `THREAT_MODEL.md` · `DATA_GOVERNANCE.md`
- `product/modules/<module>/` — per-module `MODULE_SPEC.md`, `API_CONTRACTS.md`, `ui-prototype/`

## 3. API & Contracts
- `product/API_CONVENTIONS.md` · `ERROR_TAXONOMY.md` · `EVENT_CONTRACTS.md` · `AUDIT_CONTRACTS.md`
- [`api/ERROR_ENVELOPE.md`](./api/ERROR_ENVELOPE.md) — generic Monobase wire-level error envelope
- [`architecture/ERROR_ENVELOPE_DENTALEMON.md`](./architecture/ERROR_ENVELOPE_DENTALEMON.md) — Dentalemon-specific variant
- Canonical OpenAPI: `specs/api/dist/openapi/openapi.json`

## 4. Development Guides
- `development/CONTRIBUTING_{API,CODING_STANDARDS,DATABASE,FRONTEND,GIT,TESTING}.md`
- [`development/VERTICAL_TDD.md`](./development/VERTICAL_TDD.md) — **mandatory** TDD protocol (tests-first, vertical slices)
- `development/MODULE_TEMPLATE.md` · `MODULE_BOUNDARIES.md`
- `development/COMPONENTS.md` · `SCREENS.md` · `DENTAL_CHART_REFERENCE.md`
- [`architecture/DESIGN.md`](./architecture/DESIGN.md) — design system (Apple HIG + lemon accent)

## 5. Decisions (ADRs)
- `decisions/ADR-001 … ADR-007` — accepted architecture decisions

## 6. Testing
- [`testing/TEST_STANDARDS.md`](./testing/TEST_STANDARDS.md) — testing strategy & framework requirements

## 7. Operations
- [`runbooks/migration-rollback.md`](./runbooks/migration-rollback.md)
- [`security/SECURITY_ADVISORIES.md`](./security/SECURITY_ADVISORIES.md) — CI advisory allowlist (read by `scripts/check-audit.sh`)
- [`observability/README.md`](./observability/README.md)

## 8. Reviews & Research (non-authoritative)
- `reviews/modules/` — per-module design scorecards
- `reviews/plans/` — feature design plans (some are imported by backend code — see below)
- `research/` — exploratory standards/compliance analysis

---

## Conventions for this folder

- **Reference docs are durable.** AI/process artifacts — dated audit/verification
  reports, per-slice TDD proofs, continuation/handoff notes — do **not** live in
  `docs/`. They belong in PR descriptions and git history.
- **Some docs are imported by code/CI.** Before moving or renaming anything, grep
  the repo for the path. Known load-bearing docs include:
  `prd/BUSINESS_RULES.md`, `prd/ACCEPTANCE_CRITERIA.md`, `product/DOMAIN_MODEL.md`,
  `product/WORKFLOW_MAP.md`, `product/DATA_GOVERNANCE.md`,
  `product/ROLE_PERMISSION_MATRIX.md`, `product/modules/*/{MODULE_SPEC,API_CONTRACTS}.md`,
  `prd/context/wireframes/*.html`, `reviews/plans/04-case-presentation.md`,
  `reviews/research/perio.md`, `security/SECURITY_ADVISORIES.md`,
  `api/ERROR_ENVELOPE.md`, the `development/CONTRIBUTING_*` set, and
  `development/VERTICAL_TDD.md`.

## Known follow-ups (doc hygiene)

- **Duplicate domain docs to reconcile:** `architecture/DOMAIN_MODEL.md` (246 lines)
  vs the canonical, code-referenced `product/DOMAIN_MODEL.md` (242); and
  `architecture/ROLE_MATRIX.md` (99) vs canonical `product/ROLE_PERMISSION_MATRIX.md`
  (180). Merge any unique content into the `product/` copies, then remove the
  `architecture/` duplicates.
