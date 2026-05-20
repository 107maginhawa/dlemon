# Phase 4: TypeSpec Migration (Remaining) - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — smart discuss skipped)

<domain>
## Phase Boundary

Migrate remaining manually-registered route groups from `services/api-ts/src/app.ts` into the TypeSpec pipeline. After this phase, every dental route is defined in a `.tsp` file, compiled to OpenAPI, and registered via `src/generated/openapi/routes.ts` — zero hand-wired `app.get/post/patch/delete` calls for dental endpoints.

**Out of scope:** No new features, no handler logic changes, no frontend hook migrations beyond what's needed to keep existing hooks working after regen.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Follow existing TypeSpec patterns in `specs/api/src/modules/dental-*.tsp` exactly. Use the same codegen pipeline: `cd specs/api && bun run build` → `cd services/api-ts && bun run generate`.

Key constraints:
- Handlers must not change — only route registration moves from manual to generated
- Auth decorator (`@useAuth(DentalAuth)`) must be applied consistently (match current `dentalAuth` middleware pattern)
- `recover-pin` route has NO auth — preserve this when migrating to TypeSpec
- Frontend hooks using raw fetch (e.g. `use-treatment-plan.ts`) are NOT being replaced in this phase (BFIX-02 accepted deviation)

</decisions>

<code_context>
## Existing Code Insights

### Manual routes remaining in `services/api-ts/src/app.ts`
Group 1 — Treatment Templates:
- GET/POST `/dental/treatment-templates`
- PATCH/DELETE `/dental/treatment-templates/:id`
- POST `/dental/visits/:visitId/apply-template/:templateId`
- POST `/dental/visits/:visitId/carry-over`
- GET `/dental/patients/:patientId/treatment-plan`

Group 2 — Dental Billing:
- GET `/dental/billing/patients/:patientId/balance`
- GET `/dental/billing/collections/summary`
- GET `/dental/billing/invoices/:invoiceId/payments/:paymentId/receipt`

Group 3 — Org + Dashboard:
- GET `/dental/org/context`
- GET `/dental/dashboard/summary`

Group 4 — PMD:
- GET `/dental/pmd/imported/:id`
- GET `/dental/visits/:visitId/pmd/export`

Group 5 — Org Members:
- GET/POST `/dental/org/members`
- POST `/dental/org/members/:memberId/reset-pin`
- POST `/dental/org/members/:memberId/security-question`
- POST `/dental/org/members/:memberId/recover-pin` ← NO AUTH

Group 6 — Branch Config:
- GET/PUT `/dental/branches/:branchId/working-hours`
- GET/PUT `/dental/branches/:branchId/settings`
- GET/POST/PATCH/DELETE `/dental/branches/:branchId/consent-templates`
- GET/POST/PATCH/DELETE `/dental/branches/:branchId/consent-templates/:id`

### Existing TypeSpec files (reference for patterns)
- `specs/api/src/modules/dental-billing.tsp` — may partially cover billing routes
- `specs/api/src/modules/dental-clinical.tsp` — covers clinical/treatment ops
- `specs/api/src/modules/dental-org.tsp` — may cover org routes
- `specs/api/src/modules/dental-patient.tsp` — patient CRUD
- `specs/api/src/modules/dental-pmd.tsp` — PMD routes
- `specs/api/src/modules/dental-scheduling.tsp` — scheduling
- `specs/api/src/modules/dental-visit.tsp` — visit CRUD

### Pipeline
1. Edit `.tsp` in `specs/api/src/modules/`
2. `cd specs/api && bun run build` — compiles to OpenAPI + TS types
3. `cd services/api-ts && bun run generate` — regenerates routes/validators/registry
4. Remove manual `app.get/post/...` lines from `src/app.ts`
5. Verify handler still wired via `src/generated/openapi/routes.ts`

### Established Patterns
- Auth: `@useAuth(DentalAuth)` decorator on operations
- No-auth: omit decorator (e.g., `recover-pin`)
- Response models: defined inline or reuse existing types from `dental-patient.tsp`
- Error responses: `@error BadRequestResponse`, `@error UnauthorizedResponse`, `NotFoundResponse`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard TypeSpec patterns. Prioritize routes with the most frontend dependencies (treatment-plan, billing) to unblock future SDK-first work.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
