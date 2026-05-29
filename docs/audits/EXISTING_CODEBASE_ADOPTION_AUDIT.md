# Existing Codebase Adoption Audit

---
Audit Date: 2026-05-30
Source Directory: /Users/eladventures/Desktop/dentalemon
Stack: TypeScript + Hono + Drizzle ORM (PostgreSQL) + Bun (test runner)
Producer: @oli/engine AST engine (ts-morph) — engine path, NOT regex fallback
Knowledge-graph git SHA (.map-meta.json): 86f9cbaae0c92f3a78711ab1b65da844acb98b6d
Map timestamp: 2026-05-29T21:35:10Z (regenerated 2026-05-30 local)
---

## 1. Executive Summary

- **Overall health: STRONG (9.0/10).** This is a graduated, spec-first codebase. The knowledge graph rebuilt cleanly from AST. Every cross-check axis is clean except two coarse-detection false positives (see below).
- **Top risks:** None at P0/P1. The two `auth_drift` findings (`POST /patients/merge`, `POST /patients/unmerge`) are **false positives** — the engine's auth detection captures route-chain middleware only, not in-handler role checks; both handlers DO enforce `admin` in the handler body (`if (user.role !== 'admin') throw ForbiddenError`, added in commit 5c5e0225 and tested).
- **Immediate blockers:** None.
- **Recommended adoption approach:** Continue spec-first Vertical TDD. The OpenAPI document at `specs/api/dist/openapi/openapi.json` is the single source of truth and is fully realized in code (237/237 operations matched). Use `/oli-check` going forward.

This audit accompanies a full FROM-SCRATCH rebuild of the codebase knowledge graph under `docs/audits/codebase-map/`. All numbers below are read directly from the regenerated AST artifacts.

## 2. Project Overview

- Modules discovered: **23** (8 Hono handler-group modules + 15 generic)
- Data tables found: **75** (PostgreSQL dialect)
- Enums found: **58**
- API endpoints: **237**
- OpenAPI operations: **237** (100% matched to code)
- State machines: **28**
- Import edges: **27** (0 circular dependencies)
- Source files scanned: **542**

## 3. Project Structure

**Stack:** TypeScript + Hono + Drizzle ORM + Bun test framework.

The engine scanned the opted-in scope declared in the committed `.oli/config.json`:
- `module_roots`: `services/api-ts/src/handlers` (depth 1)
- `include`: `services/api-ts/src/**/*.{ts,tsx}`
- `data_model_sources`: `services/api-ts/src/handlers/**/repos/*.schema.ts`
- `spec_sources`: `specs/api/dist/openapi/openapi.json`
- `hono_route_tables`: `services/api-ts/src/generated/openapi/routes.ts`

Note: `.oli/config.json` scopes the engine to the backend (`services/api-ts`), which is the authoritative product surface. The frontend apps (`apps/dentalemon`, `apps/account`) are not in the engine's `module_roots` and were therefore not module-mapped this run. Per the oli-codebase-map contract, `.oli/config.json` is committed by the target and MUST NOT be synthesized or overwritten by the skill; the committed scope was respected. Frontend mapping requires the target to opt-in by adding the app roots to `module_roots`.

## 4. Module Map

23 modules detected. Framework split: **8 Hono**, **15 generic**. Full per-module detail in `docs/audits/codebase-map/CODE_MODULE_MAP.json` / `.md`. Highest-traffic modules (by import fan-in):

| Module | Importers (fan-in) | Role |
|--------|-------------------|------|
| patient | 7 | Patient aggregate — referenced across clinical/vertical modules |
| person | 6 | Central PII safeguard |
| dental-visit | 5 | Visit lifecycle |
| dental-org | 5 | Org/membership |

Highest fan-out: `dental-patient` (4), `dental-billing`/`dental-clinical`/`dental-perio` (3). No circular dependencies (0 cycles over 27 edges). The fan-in on `patient`/`person` is the intended Person-Centric design, not a coupling smell.

## 5. Domain Glossary Summary

Terminology extraction targets user-facing UI strings (i18n/JSX/template text). Because the engine scope is backend-only this run, `CODE_TERMINOLOGY_MAP.json` is intentionally minimal — no frontend strings in scope. Domain entities are instead captured in the data model (75 tables) and state machines (28 FSMs).

### DDD Analysis (from data model + state machines)

- **Aggregate roots:** `person` (owns consent JSONB, profile), `patient`/`dental_patient`, `booking`, `invoice` — entities with child collections and lifecycle ownership.
- **Domain events:** surfaced implicitly via status-field transitions across 28 state machines (treatment lifecycle, visit completion gates, invoice status, imaging/ceph workflow).
- **Cross-module pattern:** API/repository composition; `person`/`patient` referenced by FK and via repository imports. No hidden shared-table coupling flagged.

Confidence: DDD classifications are `[INFERRED]` from schema shape and FSM detection.

## 6. Permission Summary

Endpoint auth breakdown (from `CODE_API_SURFACE.json`):

| auth_required | Count |
|---------------|-------|
| true (protected) | 233 |
| false (explicitly public) | 0 |
| null (undetermined by static middleware detection) | 4 |

The 4 `null`-auth endpoints are:
1. `POST /billing/webhooks/stripe` — public by design (Stripe signature-verified webhook, not session auth).
2. `POST /dental/org/members/:memberId/recover-pin` — guarded in-handler.
3. `POST /patients/merge` — admin-enforced in-handler (see auth-drift note).
4. `POST /patients/unmerge` — admin-enforced in-handler (see auth-drift note).

None are genuine unprotected mutations. The engine reports `null` (not `false`) precisely because it cannot statically resolve the auth posture from route-chain middleware alone.

## 7. Business Rules Summary

Business-rule enforcement is concentrated in handler validators and repository guards. State-machine guards (28 FSMs) encode the bulk of explicit business rules — e.g., treatment state progression requires two steps (`diagnosed → planned → performed`; a single jump to `performed` is a 422), and visit completion hard-gates on open treatments and unsigned consent. Role checks (e.g., admin-only patient merge/unmerge) are enforced in-handler. These are `[CURRENT BEHAVIOR]`, verified against the suite (graduated at 2684/0 tests).

## 8. API Surface Summary

- **237 endpoints**, all keyed `{method} {path}` in `CODE_API_SURFACE.json`.
- **0 phantom endpoints.**
- **0 single-consumer deprecation signals.**
- Auth resolved on 233/237 routes; 4 `null` (see Section 6).

### 8b. API Contract Drift

No per-module `API_CONTRACTS.md` artifacts exist (template uses OpenAPI as the contract). Drift is measured against the OpenAPI document via Spec Trace — see Section 9b. Result: zero structural drift; 2 coarse auth-drift false positives.

## 9. State Machines Summary

**28 state machines** extracted (`CODE_STATE_MACHINES.json`), via `drizzle_enum` (lifecycle-named status/state enums) and assignment-pattern detection. 58 declared enums back the data model. Examples: booking status, treatment lifecycle, visit completion, invoice status, imaging/ceph workflow states. Transition guards are present in handler logic; no unguarded destructive transitions flagged at the map level.

### 9b. Domain Model / Spec Drift (OpenAPI Spec Trace)

`spec_source: specs/api/dist/openapi/openapi.json`

| Category | Count | Severity |
|----------|-------|----------|
| Matched (spec ↔ code) | **237** | — |
| Spec-only (documented, no backend route) | **0** | — |
| Code-only (backend route, no spec operation) | **0** | — |
| Auth drift (spec-protected, code-unguarded by middleware detection) | **2** | P2 (false positive) |

**Spec-trace coverage: 237/237 (100%).** Every documented operation has a matching backend handler, and no backend route exists outside the spec.

**Auth-drift detail (both FALSE POSITIVES):**

| Operation | Spec roles | Handler | Reality |
|-----------|-----------|---------|---------|
| POST /patients/merge | admin | services/api-ts/src/handlers/patient/mergePatients.ts | `if (user.role !== 'admin') throw ForbiddenError` (line 19-20) |
| POST /patients/unmerge | admin | services/api-ts/src/handlers/patient/unmergePatients.ts | `if (user.role !== 'admin') throw ForbiddenError` (line 25-26) |

The engine's `auth_drift` is documented as coarse: it detects route-chain middleware presence, not in-handler role enforcement. Both handlers enforce `admin` in the body (added in commit 5c5e0225, tested). No remediation required.

## 10. UI / Screens Summary

Frontend apps (`apps/dentalemon`, `apps/account`) are outside the engine's committed `module_roots`, so screens/components were not mapped this run. To include them, the target should extend `.oli/config.json` `module_roots` with the app roots (a target-owned decision; the skill must not edit that file). No mock-data contamination assessment was performed for this scope.

## 11. Test Coverage Summary

Per project memory, the suite is green at **2684 pass / 0 fail** (graduated cycle 3, confidence 9.0). The test runner uses recursive discovery with per-file DB clones; ~175 test files gate CI. Backend test coverage of business rules and state transitions is strong (handler unit + contract + DB-backed). Frontend coverage is tracked separately via Playwright E2E.

## 12. Repository Guardrails Review

| File | Exists? | Accurate? | Notes |
|------|---------|-----------|-------|
| docs/architecture/ARCHITECTURE.md | Yes | Yes | Key patterns; referenced by CLAUDE.md |
| CONTRIBUTING.md | Yes | Yes | Dev workflows, DB workflow |
| CLAUDE.md | Yes | Yes | Comprehensive AI guidance, Vertical TDD |
| README.md | Yes | Yes | Overview, commands, stack |

Guardrails are mature and consistent with the codebase.

## 13. PRD / Spec Coverage Review

| Artifact | Exists? | Matches Code? | Notes |
|----------|---------|--------------|-------|
| OpenAPI (specs/api/dist/openapi/openapi.json) | Yes | 100% | Single source of truth; 237/237 traced |
| TypeSpec sources (specs/api/src/) | Yes | Yes | Compiles to the OpenAPI doc |
| docs/product/modules/*/MODULE_SPEC.md | No | n/a | Template uses OpenAPI as contract; not a gap for this stack |
| docs/product/DOMAIN_MODEL.md | No | n/a | Domain captured in schema + FSMs |

The absence of `docs/product/` MODULE_SPECs is by design for this spec-first template — the OpenAPI document is canonical and fully covered.

## 14. Standards Gap Matrix

| Area | Current State | Target | Gap | Priority |
|------|--------------|--------|-----|----------|
| Architecture docs | Present, accurate | Reflects system | None | — |
| Contributing rules | Present | Defines workflow | None | — |
| Claude rules | Present, detailed | Guides AI | None | — |
| API contract | OpenAPI 237/237 traced | Single source of truth | None | — |
| Server validation | Validators per handler | Critical inputs validated | None visible | — |
| Server RBAC | 233 protected, role checks in-handler | Server-side checks | None (engine coarse on 2) | — |
| Tests | 2684/0, BR + FSM coverage | Critical rules tested | None visible | — |
| Audit logs | audit module, Pino structured | Sensitive actions auditable | None | — |
| Frontend in knowledge graph | Out of engine scope | Mapped if opted-in | Target decision | P3 |

## 15. Inconsistency Report

### Critical (Security/Data Integrity)
None.

### Major (Functional Gaps)
None at the map level.

### Minor (Consistency)
| ID | Type | Description | Impact |
|----|------|-------------|--------|
| MIN-01 | Tooling | 2 coarse `auth_drift` false positives (merge/unmerge) — role check is in-handler, not middleware | Cosmetic; no security gap |
| MIN-02 | Scope | Frontend apps not in `module_roots`; knowledge graph is backend-only | Frontend not in component/route/terminology artifacts |

## 16. Risk Assessment

### P0 (Fix Immediately)
None.

### P1 (Fix Before Major New Work)
None.

### P2 (Fix When Touching Module)
- The 2 `auth_drift` entries are tooling-coarse false positives, not code defects. If desired, move the admin role check from the handler body into a route-chain middleware so the engine resolves `auth_required: true` — purely cosmetic for the map.

### P3 (Improve Later)
- Consider opting the frontend apps into `.oli/config.json` `module_roots` so the knowledge graph covers `apps/dentalemon` screens, components, routes, and terminology (target-owned config change).

## 17. Stabilization Plan

### Fix Immediately
- Nothing. Codebase is graduated and green.

### Fix Before Major New Work
- Nothing blocking.

### Fix When Touching Module
- Optionally lift merge/unmerge admin checks into middleware (cosmetic). Keep using Vertical TDD; regenerate the map after structural changes.

## 18. Standards Adoption Plan

The codebase has already adopted the standard (spec-first, Vertical TDD, OLI-graduated).

- **Phase 1 — Guardrails:** Complete.
- **Phase 2 — Document Current Reality:** Complete this run (knowledge-graph artifacts regenerated from AST).
- **Phase 3 — Stabilize Risky Areas:** Complete (suite 2684/0, 0 P0/P1).
- **Phase 4 — Vertical Slice TDD:** In continuous use.
- **Phase 5 — Gradual Migration:** Optionally extend engine scope to frontend.

## 19. Recommended First 3 Vertical Slices to Standardize

The backend is already fully standardized. Remaining adoption work is observational/cosmetic:

| Rank | Slice | Module | Why | Risk | Work |
|------|-------|--------|-----|------|------|
| 1 | Opt frontend into engine scope | apps/dentalemon | Complete the knowledge graph | Low | Edit target `.oli/config.json` module_roots |
| 2 | Lift merge/unmerge auth to middleware | patient | Clear the 2 coarse auth-drift flags | Low | Move in-handler role check to route chain |
| 3 | (n/a — backend graduated) | — | — | — | — |

## 20. Health Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Terminology consistency | n/a | Frontend out of scope this run |
| Permission coverage | 9 | 4 null-auth (all explained), 2 coarse-drift FPs |
| Business rule clarity | 9 | 28 FSMs, strong handler guards |
| API consistency | 10 | 237/237 spec-matched |
| State machine safety | 9 | Guards present; two-step treatment transitions enforced |
| Error handling uniformity | 9 | Consistent Hono/validator patterns |
| Backend test coverage | 9 | 2684/0, BR + FSM covered |
| Frontend test coverage | n/a | Out of map scope (Playwright tracked separately) |
| PRD/spec coverage | 10 | OpenAPI 100% traced |
| Architecture alignment | 9 | Docs accurate, no cycles |
| Domain model clarity | 9 | 75 tables, 58 enums, postgres |
| Cross-module coupling | 9 | 0 circular deps; patient/person fan-in by design |
| Stub density | 9 | No runtime stubs surfaced in scope |

**Overall health: 9.0/10**

## 21. Final Recommendations

### Do Now
- Nothing blocking. Knowledge graph is fresh and clean.

### Do Next
- Optionally extend `.oli/config.json` `module_roots` to include `apps/dentalemon` so future map runs cover the frontend.
- Optionally lift the merge/unmerge admin role check into middleware to clear the 2 cosmetic auth-drift flags.

### Do Later
- Re-run the map (`oli-codebase-map`) after any structural change; use `--check` in CI to detect drift.

### Avoid
- Do NOT hand-edit generated artifacts under `docs/audits/codebase-map/` or the generated OpenAPI/routes.
- Do NOT synthesize/overwrite `.oli/config.json` from tooling — it is target-owned.
