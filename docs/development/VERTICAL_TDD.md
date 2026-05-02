# Vertical TDD Development Protocol

**Version 1.0 | Mandatory for all agents, all sessions, all tasks**

This document defines the development protocol for this monorepo. It applies to every AI agent (Claude Code, gstack, Copilot, Codex, Gemini, or any other) and every human developer. No exceptions.

---

## Two Rules

### Rule 1: Tests Before Code, Always

For every unit of work — new module, new endpoint, new component, bugfix — tests are written FIRST. Implementation comes second.

**Why**: Tests written after implementation only confirm your assumptions. Tests written before implementation define the contract, catch design mistakes early, and ensure edge cases are covered before you write a line of production code.

### Rule 2: Vertical Slices, Never Horizontal Layers

Each module is built end-to-end (API contract → backend tests → backend → frontend tests → frontend → E2E → verify) before touching the next module. Never batch work horizontally ("all migrations first", "all handlers first", "all frontends last").

**Why**: Horizontal phases hide integration failures until the end. Frontend work routinely reveals API design gaps — discovering them after 6 backends are "done" means reworking all 6.

---

## Per-Module Sequence (10 Steps)

Every module follows this exact sequence. Do NOT skip steps. Do NOT reorder.

```
Step 1:  TypeSpec        → Define API contract in specs/api/src/modules/
Step 2:  Codegen         → bun run build + generate (specs → services)
Step 3:  Backend Tests   → Write FAILING unit tests (.test.ts colocated with handler/repo)
Step 4:  Backend Impl    → Implement schemas, repos, handlers until tests PASS
Step 5:  Contract Tests  → Write FAILING Hurl tests (specs/api/tests/contract/)
Step 6:  Contract Impl   → Fix endpoints until Hurl tests PASS
Step 7:  Frontend Tests  → Write FAILING component + hook tests (.test.ts colocated)
Step 8:  Frontend Impl   → Implement components + hooks until tests PASS
Step 9:  E2E Test        → Write Playwright spec for the module's critical user journey
Step 10: Verify Gate     → bun test + typecheck + lint — ALL green before next module
```

**Skip rules:**
- Backend-only work: skip steps 7-9
- Frontend-only work (API exists): skip steps 1-6
- Bug fix: may only need steps 3-4 or 7-8, but ALWAYS write the failing test first

---

## TDD Red-Green-Refactor Cycle

For each test file:

1. **RED**: Write test cases that describe the expected behavior (from PRD, wireframes, or business rules). Run them. They MUST fail. If they pass, your tests aren't testing anything useful.

2. **GREEN**: Write the minimum implementation to make the tests pass. No more.

3. **REFACTOR**: Clean up the implementation while keeping tests green. Re-run after every change.

---

## Test Layers (All Required Per Module)

| Layer | Tool | Location | What It Tests |
|-------|------|----------|---------------|
| **Backend unit** | `bun:test` | `services/api-ts/src/handlers/{module}/*.test.ts` | Repos (CRUD, validation, edge cases), handlers (I/O, auth, errors) |
| **Contract** | Hurl | `specs/api/tests/contract/{module}.hurl` | Full HTTP request/response per endpoint |
| **Frontend unit** | `bun:test` + `happy-dom` | `apps/{app}/src/features/{module}/**/*.test.ts` | Hooks, utils, schemas, component behavior |
| **E2E** | Playwright | `apps/{app}/tests/e2e/{journey}.spec.ts` | Critical user journeys end-to-end |

### Test File Locations

```
services/api-ts/src/handlers/{module}/repos/{entity}.test.ts     # Backend repo unit
services/api-ts/src/handlers/{module}/{handler}.test.ts           # Backend handler unit
specs/api/tests/contract/{module}.hurl                            # Contract
apps/{app}/src/features/{module}/components/{component}.test.ts   # Frontend component
apps/{app}/src/features/{module}/hooks/{hook}.test.ts             # Frontend hook
apps/{app}/tests/e2e/{journey}.spec.ts                            # E2E journey
```

---

## Gate Enforcement

A module is NOT complete until:

1. All backend unit tests pass
2. All Hurl contract tests pass
3. All frontend unit tests pass
4. E2E test for the module's primary journey passes
5. `bun run typecheck` is clean across all workspaces
6. No regressions in previously completed modules (`bun test` at root)

**Do NOT start the next module until the current module passes ALL gates.**

---

## What Tests Should Cover

### Backend tests — derive from:
- **TypeSpec definition**: declared error codes → test each one
- **PRD business rules**: edge cases → test each one
- **Data model constraints**: required fields, enums, FKs, status machines → test transitions and boundaries
- **Auth requirements**: which roles can access → test allowed and denied

### Frontend tests — derive from:
- **Wireframes**: what renders, what's interactive, what's hidden → test render and interaction
- **User journeys**: PRD user journey descriptions → test the UI flow
- **Design system**: visual states, empty states, loading states, error states → test each
- **Accessibility**: keyboard nav, screen reader labels, focus management → test a11y

### Contract tests — derive from:
- **OpenAPI spec**: status codes, response shapes, required fields → validate the wire format
- **Auth requirements**: which endpoints need auth, which roles → test 401/403 paths
- **End-to-end flows**: multi-step API workflows → test the full sequence

---

## Dependency Ordering

When multiple modules are in scope, process them in dependency order. If Module B references Module A's types (e.g., billing references visit), complete Module A's full 10-step pass first.

```
Example: dental-org → patient → dental-visit → dental-clinical → dental-billing
Complete each fully before starting the next.
```

---

## Rationalizations to Reject

These thoughts mean STOP — you are about to violate the protocol:

| Rationalization | Why It's Wrong |
|----------------|----------------|
| "I'll do all migrations first, then all handlers" | Each migration is validated by its handler tests. Batching hides failures. |
| "I'll batch similar handlers" | Each handler has unique business rules needing unique test coverage. |
| "I'll write all tests at the end" | Tests written after implementation confirm assumptions, not correctness. |
| "I'll add tests in a follow-up" | There is no follow-up. Tests are part of the work, not a separate task. |
| "This is too simple to need tests" | Simple code has simple tests. Write them. They take 2 minutes. |
| "I'll test it manually" | Manual testing doesn't persist. The next developer gets no safety net. |
| "Let me just get the frontend working first" | Frontend without backend tests means you're building on unverified foundations. |
| "I know this works, I've done it before" | Your confidence is not a test suite. Write the test. |
| "I'll write a comprehensive test later" | Comprehensive tests deferred are comprehensive tests never written. |
| "The generated code doesn't need tests" | Generated code is consumed by your code. Test the integration points. |

---

## Example: Adding a "Reviews" Module

```
1. /typespec → create specs/api/src/modules/reviews.tsp
2. Codegen  → cd specs/api && bun run build && cd ../../services/api-ts && bun run generate

3. Backend Tests (RED):
   - Write services/api-ts/src/handlers/reviews/repos/review.test.ts
     → CRUD, star rating 1-5 validation, one review per person per entity
   - Write services/api-ts/src/handlers/reviews/createReview.test.ts
     → 201 on valid, 400 on missing fields, 409 on duplicate
   - Run: cd services/api-ts && bun test src/handlers/reviews/ → ALL FAIL

4. Backend Impl (GREEN):
   - Write review.schema.ts, review.repo.ts, createReview.ts
   - Run: bun test src/handlers/reviews/ → ALL PASS

5. Contract Tests (RED):
   - Write specs/api/tests/contract/reviews.hurl
   - Run: bun run test:contract → FAILS on review endpoints

6. Contract Impl (GREEN):
   - Fix routing/validation → Hurl PASSES

7. Frontend Tests (RED):
   - Write apps/account/src/features/reviews/components/review-form.test.ts
     → renders star selector, validates required fields, submits mutation
   - Write apps/account/src/features/reviews/components/review-list.test.ts
     → renders reviews, shows empty state, handles loading
   - Run: cd apps/account && bun test src/features/reviews/ → ALL FAIL

8. Frontend Impl (GREEN):
   - Write review-form.tsx, review-list.tsx, schema.ts
   - Run: bun test src/features/reviews/ → ALL PASS

9. E2E:
   - Write apps/account/tests/e2e/submit-review.spec.ts
   - Run: bun run test:e2e → PASSES

10. Verify Gate:
    - bun test (root) → ALL PASS (no regressions)
    - bun run typecheck → CLEAN
    - Module complete. Proceed to next module.
```

---

## Enforcement Across Tools

This protocol is referenced by:
- `CLAUDE.md` — Claude Code sessions
- `AGENTS.md` — All AI agents (gstack, Copilot, Codex, Gemini, etc.)
- `/develop` skill — Orchestrator dispatches skills in this order
- `/handler` skill — Backend TDD workflow
- `/frontend-module` skill — Frontend implementation (must include tests)

If any tool, skill, or agent attempts to skip tests or batch horizontally, the protocol takes precedence.
