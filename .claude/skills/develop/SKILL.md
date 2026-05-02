---
name: develop
description: Orchestrator agent that takes a PRD or feature description and drives end-to-end implementation by dispatching the right skills in the right order. Use when given a PRD, feature spec, or multi-step development task.
---

# develop

Orchestrator agent for end-to-end feature development.

## Triggers

- User provides a PRD or feature description
- User says "build this", "implement this", "develop this"
- Multi-step development task spanning backend + frontend

## Workflow

### Phase 1: Plan

1. Run `/prd` to analyze requirements and produce a structured implementation plan
2. **STOP** — present the plan to the user for review and approval
3. Incorporate feedback before proceeding

### Phase 2: API Contract (per module)

For each new/modified module in the plan:

1. Run `/typespec` — create TypeSpec definitions and generate code
2. **STOP** — show the user the TypeSpec design for review
3. Verify generation succeeded (no errors)

### Phase 3: Per-Module Implementation (vertical)

> **WHY vertical**: Horizontal phases ("all backends, then all frontends") hide integration failures until the end. Frontend work often reveals API design gaps — discovering them after 6 backends are "done" means reworking all 6.

For each module, in dependency order, complete ALL of the following before starting the next module:

**Backend:**
1. Run `/db-migrate` — create/update database schema and generate migration
2. Run `/handler` — write tests FIRST (TDD), then implement handler + repository
3. Run `/test-api` — verify backend tests pass
4. Run `/typecheck` — verify types are clean

**Frontend (if applicable):**
5. Run `/shadcn` — install any needed UI components
6. Run `/frontend-module` — build API client, hooks, components, routes
7. Run `/typecheck` — verify frontend types are clean

**Validate:**
8. Run `/module-review` — completeness check (MUST pass before next module)

Do NOT proceed to the next module until all steps above pass for the current one.

### Phase 4: Integration

1. Run `/module-review` — final cross-module sweep
2. Run `/test-e2e` — if E2E tests exist or were written
3. Run `/pre-commit` — full verification checklist

### Phase 5: Ship

1. **STOP** — show `git diff` for user review
2. Run `/commit` — create conventional commit
3. If requested: push and create PR

## Dependency Ordering

Process modules in dependency order. If Module B references Module A's types (e.g., booking references person), complete Module A's full vertical pass first.

This is graph order, not batching — it's required when modules have real dependencies.

```
Example: person → booking → billing
Complete person fully, then booking fully, then billing fully.
```

## Scope Discipline

> **WHY**: Despite "per module" language, AI agents rationalize horizontal batching. These rationalizations sound efficient but hide integration failures.

Don't defer validation by expanding scope. Each module gets validated before starting the next.

Reject these rationalizations:
- "I'll do all migrations first, then all handlers" — NO. Each migration is validated by its own handler tests.
- "I'll batch similar handlers" — NO. Each handler has unique business rules that need their own test coverage.
- "I'll write all tests at the end" — NO. Tests written after implementation confirm assumptions, not correctness.

**Exception**: Idempotent setup operations (e.g., `bunx shadcn add card table dialog`) are fine to batch — they have no ordering dependencies.

## Decision Logic

### When to skip phases

- **Backend-only task** (no UI): skip frontend steps in Phase 3
- **Frontend-only task** (API exists): skip Phase 2 + backend steps in Phase 3
- **Existing module modification**: skip TypeSpec if contract unchanged
- **Bug fix**: may only need `/handler` or `/frontend-module` + tests

### Human checkpoints

Always pause for user review at:
1. After `/prd` plan output
2. After `/typespec` design (for new modules)
3. Before `/commit` (show `git diff`)

### Multi-module tasks

When the plan involves multiple modules:
1. Order modules by dependency (e.g., person before booking)
2. Complete each module VERTICALLY: backend + frontend + module-review before starting the next
3. Run tests after each module, not just at the end
4. Never batch "all backends then all frontends" — this is the #1 cause of late-stage rework

## Example Flow

User provides a PRD for a "Reviews" feature:

```
1. /prd → plan: new reviews module, 4 endpoints, 1 DB table, 1 frontend page
   [PAUSE for approval]

2. /typespec → create specs/api/src/modules/reviews.tsp, generate code
   [PAUSE for review]

3. Per-module vertical pass for "reviews":
   a. /db-migrate → add reviews table
   b. /handler → write tests FIRST, then implement createReview, getReview, listReviews, deleteReview
   c. /test-api → verify backend tests pass
   d. /typecheck → types clean
   e. /shadcn → add star-rating if needed
   f. /frontend-module → build reviews UI
   g. /typecheck → frontend types clean
   h. /module-review → PASS → module complete

4. /pre-commit → full checks pass
   [PAUSE for review]

5. /commit → feat(reviews): add NPS review system
```
