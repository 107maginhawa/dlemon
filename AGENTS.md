# AGENTS.md

Instructions for all AI agents working in this repository (gstack, GitHub Copilot, Codex, Gemini, Windsurf, Cursor, or any other AI coding assistant).

## Required Reading

Before writing any code, read these documents in order:

1. **[CLAUDE.md](./CLAUDE.md)** — Full project context, architecture, patterns, and commands
2. **[docs/development/VERTICAL_TDD.md](./docs/development/VERTICAL_TDD.md)** — Mandatory development protocol

## Development Protocol: Vertical TDD

**This protocol is mandatory. It overrides your default behavior. No exceptions.**

### Rule 1: Tests Before Code

Every unit of work — new module, endpoint, component, or bugfix — requires tests written FIRST. Implementation comes second. This applies to backend code, frontend code, and infrastructure.

### Rule 2: Vertical Slices

Each module is built end-to-end before touching the next module. The sequence is:

```
1. TypeSpec        → Define API contract (specs/api/src/modules/)
2. Codegen         → bun run build + generate
3. Backend Tests   → Write FAILING tests first (.test.ts colocated)
4. Backend Impl    → Make tests pass
5. Contract Tests  → Write FAILING Hurl tests (specs/api/tests/contract/)
6. Contract Impl   → Make Hurl pass
7. Frontend Tests  → Write FAILING component/hook tests (.test.ts colocated)
8. Frontend Impl   → Make tests pass
9. E2E Test        → Playwright spec for the critical user journey
10. Verify Gate    → bun test + typecheck — ALL green, no regressions
```

**Do NOT start the next module until the current module passes all gates.**

### Forbidden Patterns

- "I'll do all migrations first, then all handlers" — NO
- "I'll write tests at the end" — NO
- "This is too simple for tests" — NO
- "I'll batch similar work across modules" — NO
- "Let me get it working first, then add tests" — NO

### Gate Checklist

Before marking any module complete:

- [ ] Backend unit tests pass (`cd services/api-ts && bun test`)
- [ ] Contract tests pass (`bun run test:contract`)
- [ ] Frontend unit tests pass (`cd apps/{app} && bun test`)
- [ ] E2E test passes (`cd apps/{app} && bun run test:e2e`)
- [ ] Type check clean (`bun run typecheck`)
- [ ] No regressions in other modules

## Tech Stack

- **Runtime**: Bun (not Node.js)
- **Backend**: Hono + Drizzle ORM + PostgreSQL
- **Frontend**: Vite + React 19 + TanStack Router + shadcn/ui
- **API Spec**: TypeSpec → OpenAPI → codegen
- **Testing**: bun:test (unit), Hurl (contract), Playwright (E2E)
- **Auth**: Better-Auth
- **SDK**: Auto-generated from OpenAPI via @hey-api/openapi-ts

## Key Commands

```bash
# API-first workflow
cd specs/api && bun run build                    # TypeSpec → OpenAPI
cd services/api-ts && bun run generate           # OpenAPI → routes/validators
cd packages/sdk-ts && bun run generate           # OpenAPI → SDK hooks

# Testing
cd services/api-ts && bun test                   # Backend unit tests
bun run test:contract                            # Hurl contract tests
cd apps/{app} && bun test                        # Frontend unit tests
cd apps/{app} && bun run test:e2e                # Playwright E2E

# Quality gates
bun run typecheck                                # TypeScript validation
```

## Full Documentation

See [CLAUDE.md](./CLAUDE.md) for complete project documentation including:
- Repository structure and monorepo layout
- Module structure patterns
- Database patterns (Drizzle, migrations)
- Frontend patterns (routes, components, hooks)
- Compliance and security considerations
