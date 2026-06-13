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
- [`prd/PRD_INDEX.md`](./prd/PRD_INDEX.md) — PRD index (canonical PRD + companions + layer map)
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
- `decisions/ADR-001 … ADR-008` — accepted architecture decisions

## 6. Testing
- [`testing/TEST_STANDARDS.md`](./testing/TEST_STANDARDS.md) — testing strategy & framework requirements

## 7. Operations
- [`runbooks/migration-rollback.md`](./runbooks/migration-rollback.md)
- [`security/SECURITY_ADVISORIES.md`](./security/SECURITY_ADVISORIES.md) — CI advisory allowlist (read by `scripts/check-audit.sh`)
- [`observability/README.md`](./observability/README.md)

## 8. Reviews & Audits (non-authoritative)
- `reviews/modules/` — per-module design scorecards
- `reviews/plans/` — feature design plans (some are imported by backend code — see below)
- `audits/` — module audit trackers, gap plans, workflow-verification evidence
- `aha/` — reusable audit prompt packs + the project-structure audit pipeline

## 9. Archive
- [`archive/ARCHIVE_INDEX.md`](./archive/ARCHIVE_INDEX.md) — historical docs moved out of active areas
  (includes the former `research/` exploratory standards analysis, now `archive/research-2026-06/`)

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

- **`architecture/DOMAIN_MODEL.md` vs `product/DOMAIN_MODEL.md` — NOT duplicates**
  (verified 2026-06-11): the `architecture/` doc describes the 10 dental handler
  modules and vertical-slice layout (v1.0, 2026-05-21); the `product/` doc is the
  oli-generated entity/bounded-context model (v1.1, 2026-05-24). They are
  complementary. Decide whether to rename `architecture/DOMAIN_MODEL.md` to
  something like `MODULE_ARCHITECTURE.md` to kill the name collision.
- **`architecture/ROLE_MATRIX.md` is stale vs code** (verified 2026-06-11): it lists
  4 member roles including a nonexistent `staff_view`, while
  `membership.schema.ts` defines 9+ roles and the canonical
  `product/ROLE_PERMISSION_MATRIX.md` carries the hygienist amendments. Its
  access-tier framing (OWNER_ONLY / CLINICAL_WRITE / …) may still be worth merging
  into the canonical doc before removing it. Needs human content review.
- **Dated audit snapshots** (`audits/modules/*_2026-06-08.md`) are archive
  candidates once the workflow-verification sweep completes — they are still
  linked from active trackers and prompts.
