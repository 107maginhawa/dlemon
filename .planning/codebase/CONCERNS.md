# Codebase Concerns

**Analysis Date:** 2026-05-06

## Executive Verdict: Fix Forward

**The foundation is salvageable. Do NOT go nuclear.** Here is the honest breakdown:

**What is actually working:**
- The mono-js-lf boilerplate (person, booking, billing, comms, email, notifs, storage, reviews, audit, provider, EMR) is solid — TypeSpec-driven, generated validators, proper architecture
- 11 dental-specific handler modules exist with real business logic (patient, visit, billing, scheduling, org, clinical, PMD)
- Frontend has 96 components/routes with TanStack Query hooks, 740 passing unit tests
- Backend has 82 test files, 353 tests that would pass with a DB connection (17,554 lines of test code)
- The dental scheduling module has proper branch-level authorization (`assertBranchAccess`)
- Auth middleware is well-designed with role-based access control

**What is broken or half-done:**
- All dental handlers except scheduling SKIP branch-level authorization (any authenticated user can access any branch's data)
- Dental-specific routes bypass TypeSpec-generated validators — raw `ctx.req.json()` with ad-hoc validation instead of Zod schemas
- 2 stub handlers that throw `Not implemented` errors (mergePatients, unmergePatients)
- `requireEmailVerified` guard is commented out (always passes)
- Pervasive `as any` casting (718 occurrences in backend handlers)
- No RLS policies anywhere despite CLAUDE.md mandating them
- localStorage used as auth context storage for branchId/orgId/memberId/role (30+ references)

**Why fix-forward wins:**
The boilerplate provides a genuine spec-first pipeline (TypeSpec -> OpenAPI -> validators -> handlers). The dental modules just need to be brought INTO that pipeline instead of bypassing it. The authorization gap is systematic and fixable — `assertBranchAccess` already exists, it just needs to be applied everywhere. The test infrastructure is real (not scaffolded stubs). Rebuilding would lose ~37K lines of tested handler code and ~26K lines of frontend code.

---

## Tech Debt

**Dental routes bypass TypeSpec validator pipeline:**
- Issue: All routes registered manually in `app.ts` (lines 146-225) use raw `ctx.req.json()` instead of TypeSpec-generated Zod validators. The base monobase modules use `ctx.req.valid('json')` through the generated route registry, but dental modules do ad-hoc string checks like `if (!body.displayName || typeof body.displayName !== 'string')`.
- Files: `services/api-ts/src/app.ts`, all files in `services/api-ts/src/handlers/dental-patient/`, `dental-visit/`, `dental-org/`, `dental-clinical/`
- Impact: No schema validation on request bodies for dental endpoints. Malformed input passes through. TypeSpec definitions exist (`specs/api/src/modules/dental-*.tsp`) but the generated validators are not wired to the manually-registered routes.
- Fix approach: Wire dental routes through the generated `routes.ts` registry, or at minimum import and apply the generated Zod validators in each handler. The TypeSpec definitions already exist.

**Pervasive `as any` type casting:**
- Issue: 718 occurrences across 122 handler files. Most are in dental modules where handlers bypass the generated type system.
- Files: Worst offenders: `services/api-ts/src/handlers/dental-patient/getDentalPatient.ts` (8 casts), `services/api-ts/src/handlers/dental-org/getDashboardSummary.ts` (5 casts), `services/api-ts/src/handlers/dental-patient/listDentalPatients.ts` (4 casts)
- Impact: TypeScript provides zero safety in these handlers. Bugs hide behind `as any`.
- Fix approach: Use the generated types from `@monobase/api-spec` and Drizzle's inferred types. Most casts are on `ctx.get('user')` (should use proper generic), `patient.person` (should use Drizzle join inference), and status enums.

**Two stub handlers deployed as live endpoints:**
- Issue: `mergePatients` and `unmergePatients` are registered routes that throw `Error('Not implemented')` at runtime.
- Files: `services/api-ts/src/handlers/patient/mergePatients.ts`, `services/api-ts/src/handlers/patient/unmergePatients.ts`
- Impact: These are wired into the generated route registry. Any client hitting `/patients/merge` or `/patients/unmerge` gets a 500 error. These are also marked as "Public endpoint - no auth required" in the generated scaffold.
- Fix approach: Either implement or remove from TypeSpec spec and regenerate routes.

**Audit service incomplete:**
- Issue: `markForPurging()` method declared in interface but not implemented. Comment says "TODO: Not yet implemented".
- Files: `services/api-ts/src/core/audit.ts` (lines 45-47, 78)
- Impact: Audit log retention/purging does not function. Logs grow indefinitely.
- Fix approach: Implement the method in `AuditRepository` and bind it in the service.

**Tax calculation hardcoded to zero:**
- Issue: `const tax = 0; // TODO: Calculate tax based on jurisdiction` in the base billing module.
- Files: `services/api-ts/src/handlers/billing/createInvoice.ts:120`
- Impact: Base billing module (Stripe-integrated) never calculates tax. The dental billing module correctly accepts `taxRate` from the request body, so this only affects the generic billing path.
- Fix approach: Accept taxRate as input or implement jurisdiction-based lookup.

**Internal service token is runtime-random:**
- Issue: `const internalServiceToken = crypto.randomUUID()` generated on every app start. Comment says "TODO: Move to config/env for production deployments".
- Files: `services/api-ts/src/app.ts:98`
- Impact: In a multi-instance deployment, expand requests between instances would fail because each instance has a different token.
- Fix approach: Move to environment variable.

---

## Security Considerations

**CRITICAL — Missing branch-level authorization on most dental endpoints:**
- Risk: Any authenticated user can read/write any branch's patient data, visits, invoices, clinical records, and org settings. The only module with branch access control is `dental-scheduling` (uses `assertBranchAccess`).
- Files: `services/api-ts/src/handlers/dental-patient/*.ts`, `dental-visit/*.ts`, `dental-billing/*.ts`, `dental-org/*.ts`, `dental-clinical/*.ts` — NONE of these call `assertBranchAccess` or any equivalent.
- Current mitigation: The auth middleware (`services/api-ts/src/middleware/auth.ts`) only checks that a user has the `user` role. All dental routes use `authMiddleware({ required: true, roles: ['user'] })` which grants access to ANY authenticated user.
- Recommendations: Add `assertBranchAccess(db, user.id, branchId)` to every dental handler. The utility already exists at `services/api-ts/src/handlers/dental-scheduling/utils/assert-branch-access.ts` — it just needs to be imported and called.

**Email verification guard disabled:**
- Risk: Users with unverified email addresses can access the full application.
- Files: `apps/dentalemon/src/utils/guards.ts:91-96` — the `requireEmailVerified` function body is commented out, always returns void.
- Current mitigation: None. The guard is imported and used in route beforeLoad but does nothing.
- Recommendations: Uncomment the implementation.

**No RLS (Row-Level Security) policies:**
- Risk: Application-level authorization is the only barrier. A SQL injection or ORM bypass exposes all tenant data. The global CLAUDE.md mandates RLS but zero policies exist.
- Files: All schema files in `services/api-ts/src/handlers/*/repos/*.schema.ts` (32 schema files, 3,336 lines, zero RLS)
- Current mitigation: Application-level auth checks (when they exist).
- Recommendations: Add RLS policies on all dental tables scoped by branch_id, enabled by setting `app.current_setting('app.branch_id')` in a middleware-injected transaction. This is a significant effort but critical for multi-tenant healthcare data.

**Patient merge/unmerge endpoints are public (no auth):**
- Risk: The generated scaffold marks these as "Public endpoint - no auth required". Although they currently throw 500, if implemented they would allow unauthenticated patient data manipulation.
- Files: `services/api-ts/src/handlers/patient/mergePatients.ts:20`, `unmergePatients.ts:20`
- Current mitigation: They throw `Error('Not implemented')` before any logic runs.
- Recommendations: Fix the TypeSpec definition to require authentication, regenerate, or add auth middleware manually.

**localStorage for authorization context:**
- Risk: Client-side localStorage stores `currentBranchId`, `currentOrgId`, `currentMemberId`, `currentMemberRole`. These values are sent to the API as filter params. A user could modify localStorage to impersonate another branch/role.
- Files: 30+ localStorage references across `apps/dentalemon/src/routes/`, `features/onboarding/`, `features/settings/`, `features/staff/`
- Current mitigation: The API doesn't trust these values for authorization (they're used as filters). But since the API also doesn't enforce branch access (see above), the combination means a user can access any branch's data by changing localStorage.
- Recommendations: Server-side must derive branch/org context from the authenticated session, not from client-supplied query params.

**No input validation on JSONB fields:**
- Risk: `emergencyContact`, `communicationPreferences`, `followUpNotes` are accepted from the request body and stored directly as JSONB without shape validation.
- Files: `services/api-ts/src/handlers/dental-patient/updateDentalPatient.ts:53-59`
- Impact: Arbitrary JSON can be stored in these fields, potentially breaking frontend rendering or enabling stored XSS if rendered without sanitization.
- Fix approach: Add Zod schemas for JSONB field shapes matching the TypeScript types defined in the schema file.

---

## Performance Bottlenecks

**N+1 query in getDentalPatient:**
- Problem: Fetches ALL visits for a patient to count them, then fetches ALL invoices to sum balances. No aggregation queries.
- Files: `services/api-ts/src/handlers/dental-patient/getDentalPatient.ts:32-54`
- Cause: `SELECT * FROM dental_visits WHERE patient_id = ?` followed by `visits.length` in JS. Same for invoices.
- Improvement path: Use SQL `COUNT(*)` and `SUM(balance_cents)` aggregations instead of loading all rows.

**getDashboardSummary loads all plans and orders into memory:**
- Problem: Fetches all active payment plans and pending lab orders, then filters/counts in JavaScript.
- Files: `services/api-ts/src/handlers/dental-org/getDashboardSummary.ts:30-87`
- Cause: `db.select().from(dentalPaymentPlans).where(...)` returns all matching rows, then `.length`, `.filter()`, `.reduce()` in JS.
- Improvement path: Use SQL `COUNT(*)`, `SUM()`, and `CASE WHEN` aggregations.

**Patient list does two full queries (list + count):**
- Problem: `Promise.all([repo.findManyWithPerson(filters, ...), repo.countWithPerson(filters)])` — the count query re-executes all the same joins and filters.
- Files: `services/api-ts/src/handlers/dental-patient/listDentalPatients.ts:46-49`
- Improvement path: Use a single query with `SQL_CALC_FOUND_ROWS` equivalent (Drizzle `count()` over window function) or accept eventual consistency on counts.

---

## Fragile Areas

**The app.ts manual route registration (80+ lines of imports and routes):**
- Files: `services/api-ts/src/app.ts:29-225`
- Why fragile: Every new dental endpoint requires adding an import AND a route registration. Route ordering matters (e.g., `/dental/patients/export` must come before `/dental/patients/:id`). Missing a route silently makes the endpoint unreachable. The `app as any` cast on line 140 hides type mismatches.
- Safe modification: Always add route registrations BEFORE parameterized routes. Test with a real HTTP request, not just unit tests.
- Test coverage: No tests verify route registration. The comment in MEMORY.md ("Handler unit tests with buildTestApp() don't catch route registration bugs; must hit real server") confirms this is a known gap.

**localStorage-based org/branch context:**
- Files: `apps/dentalemon/src/routes/_dashboard.tsx:30-56`, all route files that read `localStorage.getItem('currentBranchId')`
- Why fragile: The `_dashboard.tsx` beforeLoad fires a `fetch` to `/dental/org/context` on every navigation. If the API is slow or fails, it falls back to stale localStorage. After re-seeding, branch IDs change but localStorage retains old values until the API call succeeds.
- Safe modification: Always test with a fresh browser/incognito after any seed script change.
- Test coverage: No tests for the org context bootstrap flow.

**The patient schema is a hybrid of base-monobase and dental-specific fields:**
- Files: `services/api-ts/src/handlers/patient/repos/patient.schema.ts`
- Why fragile: The `patients` table schema has dental-specific fields (preferredBranchId, dentalHistorySummary, needsFollowUp, hasActivePaymentPlan, status, archivedAt, emergencyContact, communicationPreferences, recallDate, recallNote, followUpNotes) baked into the base monobase `patient` table. This means the base patient module's generic handlers (createPatient, updatePatient, etc.) and the dental-specific handlers (createDentalPatient, updateDentalPatient) both operate on the same table but with different validation and authorization levels.
- Safe modification: When adding dental fields, add them to the patient schema but only access them through dental handlers. Do not modify base patient handlers.
- Test coverage: Base patient tests exist but do not exercise dental fields.

---

## Scaling Limits

**No database connection pooling configuration visible:**
- Current capacity: Single Drizzle connection per server instance (default).
- Limit: Under concurrent load, connection exhaustion will occur.
- Scaling path: Configure PgBouncer or connection pool in Drizzle config.

**Working hours stored as JSON string in branch settings column:**
- Current capacity: Functions correctly for single branches.
- Limit: Cannot query across branches for available slots efficiently (requires loading and parsing JSON for every branch).
- Scaling path: Normalize into a `working_hours` table with day/open/close columns.

---

## Dependencies at Risk

**better-auth pinned to ~1.3.27:**
- Risk: Tilde range allows patches only. Better-Auth has been evolving rapidly (now at v2.x in some forks). The session API (`auth.api.getSession`) may change.
- Impact: Auth middleware depends on Better-Auth internals. A breaking update would affect all authentication.
- Migration plan: Monitor Better-Auth releases. The auth middleware has a clean abstraction layer that isolates most of the dependency.

---

## Missing Critical Features

**No rate limiting on any endpoint:**
- Problem: No rate limiting middleware exists. The PIN verification endpoint (`/dental/org/members/:memberId/recover-pin`) accepts unlimited attempts.
- Blocks: Production deployment without brute-force protection.

**No CSRF protection:**
- Problem: Cookie-based auth with `credentials: 'include'` but no CSRF tokens.
- Blocks: Safe production deployment for browser-based clients.

**No pagination on dental visit/treatment queries:**
- Problem: `listDentalVisits`, `listDentalTreatments` accept limit/offset but several related queries (tooth history, treatment plan) load all records.
- Blocks: Performance at scale for patients with long treatment histories.

---

## Test Coverage Gaps

**Backend tests require live database (353 pass, 702 fail without DB):**
- What's not tested without infrastructure: All repository tests, all handler integration tests
- Files: Every `*.test.ts` under `services/api-ts/src/handlers/`
- Risk: CI will fail unless PostgreSQL is provisioned. No in-memory DB fallback.
- Priority: Medium — tests ARE written, they just need infrastructure.

**No E2E tests that pass (Playwright specs exist but not wired to running app):**
- What's not tested: 18 Playwright spec files exist in `apps/dentalemon/tests/e2e/` but there is no evidence of a working E2E test pipeline.
- Files: `apps/dentalemon/tests/e2e/*.spec.ts`
- Risk: Full user flows (onboarding, patient registration, visit creation, billing) are untested end-to-end.
- Priority: High — these are the scenarios most likely to break.

**Route registration not tested:**
- What's not tested: Whether dental routes are actually reachable via HTTP
- Files: `services/api-ts/src/app.ts:146-225` — 80 lines of route registration with zero test coverage
- Risk: A typo in a route path or missing import silently makes an endpoint unreachable. Known issue per project memory.
- Priority: High — add smoke tests that hit each dental endpoint.

**No authorization tests for dental modules:**
- What's not tested: Whether user A can access user B's branch data
- Files: All dental handler tests mock auth but never test cross-branch access denial
- Risk: The authorization gap described in Security Considerations is also an untested gap.
- Priority: Critical — these tests would have caught the missing `assertBranchAccess` calls.

**Base monobase modules (EMR, comms, storage, email) have no dental-context tests:**
- What's not tested: Whether these modules work correctly within the dental app's auth/org context
- Files: `services/api-ts/src/handlers/emr/`, `comms/`, `storage/`, `email/`
- Risk: These modules are inherited from the mono-js-lf boilerplate and may not integrate cleanly with the dental org/branch model.
- Priority: Low — these modules are not yet exposed in the dental frontend.

---

*Concerns audit: 2026-05-06*
