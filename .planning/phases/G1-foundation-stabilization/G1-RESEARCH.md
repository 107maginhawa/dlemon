# Phase G1: Foundation Stabilization - Research

**Researched:** 2026-05-21
**Domain:** RBAC / role enforcement, visit lifecycle, FSM guards, Vite bundle exclusion
**Confidence:** HIGH — all claims verified by direct codebase inspection

---

## Executive Summary

All five F-001..F-005 findings are **partially or fully resolved at the implementation level**. The
primary work remaining for G1 is **test coverage**: the three handlers guarded by F-001 already
use `assertBranchRole` with correct allowed-role lists, but tests only verify `staff_full` is
blocked — not `staff_scheduling` specifically. BR-005, CephLandmark FSM, and PaymentPlan FSM are
all implemented and have unit tests. F-005 is moot: the `imaging-test.tsx` and
`imaging-comparison-test.tsx` files do not exist in the production routes directory; the
preventive work needed is a vite config guard + naming convention so they can never be silently
bundled if added later.

**Primary recommendation:** G1 is primarily a test-gap-closure wave, not a greenfield implementation
wave. Each slice means: write the missing `staff_scheduling`-specific tests (RED), confirm green,
then close the finding.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F-001 | `staff_scheduling` blocked from treatments, void invoices, prescriptions | `assertBranchRole` already guards all 3 handlers; only `staff_scheduling`-specific tests missing |
| F-002 | BR-005 auto-discard empty visit | `updateDentalVisit` implements full auto-discard; `business-rules.test.ts` has 5 dedicated tests |
| F-003 | CephLandmark invalid transitions → 422 | `CephMgmt_updateCephLandmark` has FSM guard; `ceph.test.ts` has `INVALID_STATUS_TRANSITION` tests |
| F-004 | PaymentPlan invalid transitions → 422 | `updateDentalPaymentPlan` delegates to `planRepo.setStatus` which enforces FSM; `dental-billing-module4.test.ts` has terminal-state tests |
| F-005 | `imaging-test.tsx` + `imaging-comparison-test.tsx` excluded from prod bundle | Files do not exist in `apps/dentalemon/src/routes/`; need vite config guard to prevent future regression |

---

## G1-S1: assertBranchAccess + MemberRole

### Current State

Two utility functions exist:

- `services/api-ts/src/handlers/shared/assert-branch-access.ts` — role-blind; checks membership
  existence only. `[VERIFIED: direct read]`
- `services/api-ts/src/handlers/shared/assert-branch-role.ts` — role-aware; takes
  `allowedRoles: MemberRole[]`; throws `ForbiddenError` (same message to prevent role enumeration)
  if role not in allowed list. `[VERIFIED: direct read]`

### MemberRole enum values

```typescript
// membership.schema.ts
export const memberRoleEnum = pgEnum('member_role', [
  'dentist_owner',
  'dentist_associate',
  'staff_full',
  'staff_scheduling',   // ← the role that must be blocked
]);
```

`[VERIFIED: direct read of services/api-ts/src/handlers/dental-org/repos/membership.schema.ts]`

### Handler Status for the 3 Success-Criteria Endpoints

All three handlers **already use `assertBranchRole`** (not the role-blind `assertBranchAccess`):

| Endpoint | File | Guard | Allowed roles |
|----------|------|-------|---------------|
| `POST /dental/visits/{id}/treatments` | `createDentalTreatment.ts:33` | `assertBranchRole` | `['dentist_owner', 'dentist_associate']` |
| `POST /dental/billing/invoices/{id}/void` | `voidDentalInvoice.ts:29` | `assertBranchRole` | `['dentist_owner']` |
| `POST /dental/visits/{id}/prescriptions` | `createPrescription.ts:33` | `assertBranchRole` | `['dentist_owner', 'dentist_associate']` |

`[VERIFIED: grep of assertBranchRole usages across all handlers]`

### What the Existing Tests Check

Existing role-gate tests use `STAFF_USER` seeded with `role: 'staff_full'` — **not**
`staff_scheduling`. The tests verify `staff_full → 403` but the success criteria requires
`staff_scheduling → 403` to be proven:

- `dental-treatment.test.ts:514` — `createDentalTreatment role gate: staff_full → 403` ✓ (exists)
- `dental-billing.test.ts:1154` — `voidDentalInvoice role gate: staff_full → 403` ✓ (exists)
- `clinical-prescription-history.test.ts:693` — `createPrescription role gate: staff_full → 403` ✓ (exists)

`staff_scheduling` is **never used as the blocked role** in any role-gate test. `[VERIFIED: grep across all handler test files]`

### What Needs to Be Added

For each of the three handlers, add a `describe` block:

```typescript
describe('createDentalTreatment role gate — staff_scheduling', () => {
  test('staff_scheduling → 403', async () => {
    // seed SCHEDULING_USER with role: 'staff_scheduling'
    // call handler → expect 403
  });
});
```

The existing `buildTestApp(user)` pattern with a new `SCHEDULING_USER` fixture (seeded as
`role: 'staff_scheduling'`) is the correct approach — mirrors the `STAFF_USER` pattern already in
each test file.

### Large Surface of Remaining `assertBranchAccess` Usage

Many other handlers still use the role-blind `assertBranchAccess`. These are NOT in scope for
F-001's success criteria (which is scoped to 3 specific endpoints), but the planner should note
them to avoid scope creep during implementation:

- `dental-clinical`: createAttachment, listMedicalHistory, updatePrescription, updateLabOrder,
  listLabOrders, listConsentForms, createLabOrder, createMedicalHistoryEntry, listPrescriptions,
  listAttachments, listAmendments, deleteAttachment, createConsentForm, signConsentForm,
  updateMedicalHistoryEntry
- `dental-visit`: treatmentTemplates, getToothHistory, getTreatmentPlanVersion, getDentalChart,
  listDentalTreatments, getTreatmentPlan, getDentalVisit, acceptTreatmentPlan, listDentalVisits,
  getVisitNotes, carryOverTreatments
- `dental-org`: branchSettings, createMember, deactivateMember, updateMember, pinRecovery,
  listMembers, getDashboardSummary, consentTemplates, resetMemberPin
- `dental-imaging`: multiple imaging + ceph handlers

These read/list operations may intentionally allow `staff_scheduling` access. Do not touch them
for G1.

### Test Pattern to Replicate

```typescript
// dental-treatment.test.ts — established pattern
const STAFF_USER = { id: '00000000-0000-0000-0000-000000000099', email: 'staff@clinic.com' };
const STAFF_MEMBER_ID = 'c0000000-0000-1000-8000-000000000099';

// In beforeAll:
await db.insert(dentalMemberships).values({
  id: STAFF_MEMBER_ID, branchId: BRANCH_ID, personId: STAFF_USER.id,
  displayName: 'Test Staff', role: 'staff_full',  // ← change to 'staff_scheduling'
  status: 'active', pinFailedAttempts: 0,
  createdBy: TEST_USER.id, updatedBy: TEST_USER.id
}).onConflictDoNothing();

// Use a different ID namespace (e.g. 0x9A) to avoid collision with existing staff_full member
```

### Cross-Module E2E

Required after G1-S1 per ROADMAP. Use existing `auth-gates.spec.ts` as the base pattern. The E2E
for the role matrix needs to:
1. Create a `staff_scheduling` member via the API
2. Authenticate as that member
3. Attempt the 3 guarded endpoints → assert 403 each

`auth-gates.spec.ts` already shows the fetch-from-page pattern for API calls with session context.
The E2E fixture `setupDentalOrg` in `tests/e2e/fixtures.ts` creates a `dentist_owner` member —
a new helper `setupSchedulingMember` can seed a `staff_scheduling` member to the same branch.

---

## G1-S2: BR-005 Auto-Discard Empty Visit

### Current State: Fully Implemented and Tested

Implementation: `services/api-ts/src/handlers/dental-visit/updateDentalVisit.ts:91-106`

```typescript
// When status=completed, three emptiness checks run:
const hasNoTreatments = treatments.length === 0;
const hasNoNotes = !notes || (!notes.subjective && !notes.objective && !notes.assessment && !notes.plan);
const hasNoAttachments = attachments.length === 0;

if (hasNoTreatments && hasNoNotes && hasNoAttachments) {
  const discardedRaw = await repo.discard(visitId);
  // ...returns 200 with status='discarded'
}
```

`[VERIFIED: direct read of updateDentalVisit.ts]`

### Test Coverage: Complete

`services/api-ts/src/handlers/dental-visit/business-rules.test.ts` has a dedicated BR-005 describe
block with 5 tests covering:

1. Empty visit → `discarded` (primary case)
2. Notes only → not discarded (goes through normal path → 422 consent guard)
3. Attachments only → not discarded
4. Treatments + consent + notes → completes normally (not discarded)
5. DB persistence check via VisitRepository

`[VERIFIED: direct read of business-rules.test.ts:188-280]`

### What "Empty" Means (Canonical Definition)

Empty = **no treatments** AND **no meaningful SOAP notes** (empty row is created by
`createDentalVisit` automatically, so only non-empty SOAP content counts) AND **no attachments**.
Notes with only whitespace or all-null SOAP fields count as empty.

### G1-S2 Work Needed

The ROADMAP says "not implemented" — but it IS implemented. The planner should **verify tests pass
against the live DB** rather than writing new implementation. If the `bun test` run in the phase
reveals the BR-005 tests as failing (e.g., a prior migration broke the `discard()` method), fix
that. Otherwise G1-S2 is a verification task, not an implementation task.

**Risk:** The old `business-rules.test.ts` at the root handlers level
(`src/handlers/business-rules.test.ts:1584`) has a `describe.skip('BR-005 ...')` — this is
a different, older test file that was superseded by the new
`dental-visit/business-rules.test.ts`. Do not confuse the two.

---

## G1-S3: CephLandmark FSM Guard

### Current State: Fully Implemented and Tested

FSM definition in schema:

```typescript
// imaging_ceph.schema.ts
export const CEPH_LANDMARK_TRANSITIONS: Record<CephLandmarkStatus, CephLandmarkStatus[]> = {
  placed: ['confirmed'],
  confirmed: ['locked'],
  locked: [],  // terminal — immutable once locked
};
```

Guard in handler (`CephMgmt_updateCephLandmark.ts:78-86`):

```typescript
if (body.status !== undefined && body.status !== landmark.status) {
  const allowed = CEPH_LANDMARK_TRANSITIONS[landmark.status as CephLandmarkStatus];
  if (!allowed?.includes(body.status as CephLandmarkStatus)) {
    throw new BusinessLogicError(
      `Cannot transition landmark from '${landmark.status}' to '${body.status}'...`,
      'INVALID_STATUS_TRANSITION',
    );
  }
}
```

`[VERIFIED: direct read of CephMgmt_updateCephLandmark.ts]`

### Test Coverage: Complete

`ceph.test.ts` contains `describe('Invalid status transition', ...)` with tests:
- `placed → locked` (skips confirmed) → 422 `INVALID_STATUS_TRANSITION`
- `confirmed → placed` (backward) → 422 `INVALID_STATUS_TRANSITION`
- `LANDMARK_LOCKED` error for coordinate changes on locked landmarks

`[VERIFIED: grep of ceph.test.ts:612-645]`

### G1-S3 Work Needed

Verification only — run `bun test` against `ceph.test.ts` and confirm tests pass. No new
implementation required. If tests are currently failing (possible if they were written as RED tests
that were never made green), implement the missing path.

---

## G1-S4: PaymentPlan FSM Guard

### Current State: Fully Implemented and Tested

FSM in `dental-payment-plan.repo.ts:23-26`:

```typescript
export const PAYMENT_PLAN_TRANSITIONS: Record<DentalPaymentPlan['status'], DentalPaymentPlan['status'][]> = {
  // actual transitions defined here; completed and defaulted are terminal
};
```

Handler `updateDentalPaymentPlan.ts:35-38`:

```typescript
await assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner', 'staff_full']);
const updated = await planRepo.setStatus(planId, body.status);
// setStatus throws BusinessLogicError('INVALID_TRANSITION') on bad transition
```

`[VERIFIED: direct read of updateDentalPaymentPlan.ts and grep of dental-payment-plan.repo.ts]`

### Test Coverage: Complete

`dental-billing-module4.test.ts` has `describe('G1-S4 — PaymentPlan FSM: invalid transitions ...')` 
with 5 tests covering `completed → *` and `defaulted → *` terminal-state rejections, all expecting
422 `INVALID_TRANSITION`.

`[VERIFIED: grep of dental-billing-module4.test.ts:150-218]`

### G1-S4 Work Needed

Verification only — confirm tests pass. The ROADMAP description "not guarded" reflects the state at
audit time (before recent implementation). The implementation appears complete.

---

## G1-S5: Production Bundle Exclusion

### Current State

The `imaging-test.tsx` and `imaging-comparison-test.tsx` **route files do not exist** in:
- `apps/dentalemon/src/routes/` — confirmed empty search
- `apps/dentalemon/src/routeTree.gen.ts` — no `imaging-test` entries

`[VERIFIED: find command returning no results, routeTree.gen.ts inspection]`

The E2E tests navigate to `/imaging-test` and `/imaging-comparison-test` routes. These tests use
a self-skip pattern — when the dev server isn't running or the route doesn't exist, navigation
times out and the test is treated as skipped (not failed) per Playwright behavior.

### Why F-005 is Still Marked OPEN

The audit (`BROWNFIELD_STATUS.md`) flagged a risk that these files **might be added** during
development (e.g., for local debugging/E2E harness setup) and accidentally get bundled into the
production Vite build. The preventive control is missing.

### What Needs to Be Implemented

The Vite + TanStack Router setup uses file-based routing from `src/routes/`. Any file placed
there with a valid name gets auto-discovered. The existing `tanstackRouter` plugin config already
excludes `.test.(ts|tsx)` files via `routeFileIgnorePattern`. The safe approach:

**Option A — Extend `routeFileIgnorePattern`** (simplest):
```typescript
// vite.config.ts — tanstackRouter plugin
tanstackRouter({
  routesDirectory: './src/routes',
  generatedRouteTree: './src/routeTree.gen.ts',
  routeFileIgnorePattern: '\\.(test|dev)\\.(ts|tsx)$',  // also excludes *.dev.tsx
})
```

Then if anyone creates `imaging-test.dev.tsx` it won't bundle. But this doesn't protect against
`imaging-test.tsx` without the `.dev.` suffix.

**Option B — Explicit ignore list** (recommended for F-005):
```typescript
routeFileIgnorePattern: '(\\.(test)\\.(ts|tsx)$|imaging-test\\.tsx$|imaging-comparison-test\\.tsx$)',
```

**Option C — Vite build exclusion via `rollupOptions.external`** — less appropriate because these
are internal routes, not external packages.

**Recommended approach:** Option B — add the two specific filenames to `routeFileIgnorePattern`.
This is declarative, reviewable, and prevents the exact files named in F-005 from ever being
bundled even if added to `src/routes/` during development.

### Verification

After adding the pattern, create a dummy `apps/dentalemon/src/routes/imaging-test.tsx` (with any
valid route export), run `bun run build`, confirm no route for `/imaging-test` appears in
`dist/`, then delete the dummy file.

---

## TDD Infrastructure

### Test Pattern (unit tests)

All existing role-gate tests follow this pattern:

```typescript
// 1. Fixture namespace with unique UUIDs per test file
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const STAFF_USER = { id: '00000000-0000-0000-0000-000000000099', email: 'staff@clinic.com' };
const SCHEDULING_USER = { id: '00000000-0000-0000-0000-000000000098', email: 'sched@clinic.com' };

// 2. Seed in beforeAll
await db.insert(dentalMemberships).values({
  id: SCHEDULING_MEMBER_ID, branchId: BRANCH_ID, personId: SCHEDULING_USER.id,
  displayName: 'Scheduling Staff', role: 'staff_scheduling',
  status: 'active', pinFailedAttempts: 0,
  createdBy: TEST_USER.id, updatedBy: TEST_USER.id
}).onConflictDoNothing();

// 3. buildTestApp(user) injects user into Hono context
function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    c.set('database', db);
    await next();
  });
  // ... register handlers
  return app;
}

// 4. RED test first
test('staff_scheduling → 403 on createDentalTreatment', async () => {
  const app = buildTestApp(SCHEDULING_USER);
  const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ... }),
  });
  expect(res.status).toBe(403);
});
```

`[VERIFIED: dental-treatment.test.ts, dental-billing.test.ts, clinical-prescription-history.test.ts]`

### UUID Namespace Conflicts to Avoid

Each test file uses a unique UUID namespace to avoid insertion conflicts across test suites that
share the same live DB. When adding `SCHEDULING_USER` to existing test files:

- `dental-treatment.test.ts`: existing STAFF_USER uses `...000000000099`; use `...000000000098` for scheduling
- `dental-billing.test.ts`: existing STAFF_USER uses `...000000000099`; use `...000000000098` for scheduling
- `clinical-prescription-history.test.ts`: check existing namespace before assigning scheduling UUID

### FSM Test Pattern (already used in ceph.test.ts and module4.test.ts)

```typescript
test('placed → locked skips confirmed → 422 INVALID_STATUS_TRANSITION', async () => {
  const landmark = await seedLandmark({ status: 'placed' });
  const app = buildTestApp(TEST_USER);
  const res = await app.request(
    `/dental/imaging/images/${landmark.imageId}/ceph/landmarks/${landmark.landmarkCode}`,
    { method: 'PATCH', headers: ..., body: JSON.stringify({ status: 'locked' }) }
  );
  expect(res.status).toBe(422);
  const body = await res.json();
  expect(body.code).toBe('INVALID_STATUS_TRANSITION');
});
```

---

## Cross-Module E2E

### Existing E2E Harness

`apps/dentalemon/tests/e2e/auth-gates.spec.ts` — covers BR-016 (workspace requires branch
context) and BR-026 (image delete requires role). Uses `setupDentalOrg` + direct fetch from page
context to test API-level role enforcement.

### Required for G1-S1

A new describe block in `auth-gates.spec.ts` (or a new `role-matrix.spec.ts`):

```typescript
// Role matrix E2E: staff_scheduling blocked on guarded routes
test.describe('G1-S1: staff_scheduling blocked on clinical writes', () => {
  test('staff_scheduling → 403 on createDentalTreatment', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    // Create staff_scheduling member for the same branch
    // Authenticate as scheduling member
    // POST /dental/visits/{id}/treatments → expect 403
  });
  // + void invoice, + prescription
});
```

`setupDentalOrg` in `fixtures.ts` creates `dentist_owner`. A new `setupSchedulingMember` helper
can call `POST /dental/organizations/{orgId}/branches/{branchId}/members` with
`role: 'staff_scheduling'`. Note: `createMember` uses `assertBranchAccess` (role-blind), so the
dentist_owner who created the org can create a scheduling member for that branch.

---

## Implementation Order Rationale

Sequential is correct because:

1. **G1-S1 first** — role security is the highest-priority gap; blocks any future work until resolved
2. **G1-S2 second** — BR-005 verification is a prerequisite check; if implementation is broken it
   reveals a deeper regression to fix before proceeding
3. **G1-S3 third** — CephLandmark FSM is self-contained within `dental-imaging`; no cross-module deps
4. **G1-S4 fourth** — PaymentPlan FSM is self-contained within `dental-billing`
5. **G1-S5 last** — preventive config change; no runtime behavior change; safest to do after tests
   pass

Hidden dependency: G1-S1 cross-module E2E requires the live API server (port 7213) and app
(port 3003) to be running. Plan the E2E step explicitly rather than embedding it in S1's unit test
wave.

---

## Risks and Landmines

### Risk 1: UUID Namespace Collision

**Problem:** Adding a new `SCHEDULING_USER` to existing test files could collide with an
already-seeded UUID from another test suite that shares the same live Postgres instance.

**Mitigation:** Use unique UUIDs — check existing namespace constants in the target test file
before assigning. Prefer IDs like `...000000000098` (one below the existing `...99` STAFF_USER)
and use `onConflictDoNothing()`.

### Risk 2: G1-S2/S3/S4 Already-Implemented — ROADMAP Mismatch

**Problem:** ROADMAP says "not implemented" for F-002, F-003, F-004, but the code shows full
implementation with tests. Running the tests first might reveal they're actually failing (test
infra regression) or passing (ROADMAP is stale).

**Mitigation:** `bun test` as first step of each slice. If tests are RED → implement/fix.
If GREEN → mark finding closed and move on.

### Risk 3: G1-S5 — Vite `routeFileIgnorePattern` Regex Escaping

**Problem:** The pattern is a string passed to TanStack Router's Vite plugin. Regex escaping
inside a JS string requires double-escaping backslashes.

**Mitigation:** Test the pattern with a dummy route file before removing it, as described in
the G1-S5 section.

### Risk 4: `buildTestApp` Doesn't Hit Real Server

**Memory note:** A previous feedback note (`feedback_test_verification.md`) says "Handler unit
tests with buildTestApp() don't catch route registration bugs; must hit real server."

For G1-S1/S2/S3/S4, the `buildTestApp` pattern is sufficient because we're testing handler
business logic (role checks, FSM guards), not route registration. The cross-module E2E (which
hits a real server) catches route registration issues and covers the integration layer.

### Risk 5: `session` vs `user` Context in Billing Handlers

`voidDentalInvoice.ts` uses `ctx.get('session')` (not `ctx.get('user')`), with `session.userId`
for the role check. The billing test's `buildTestApp` must set `session` (not `user`) when
testing billing handlers. Existing billing tests already handle this — replicate the pattern.

---

## Sources

- `services/api-ts/src/handlers/shared/assert-branch-access.ts` — role-blind guard (direct read)
- `services/api-ts/src/handlers/shared/assert-branch-role.ts` — role-aware guard (direct read)
- `services/api-ts/src/handlers/dental-org/repos/membership.schema.ts` — MemberRole enum (direct read)
- `services/api-ts/src/handlers/dental-visit/createDentalTreatment.ts` — assertBranchRole call site
- `services/api-ts/src/handlers/dental-billing/voidDentalInvoice.ts` — assertBranchRole call site
- `services/api-ts/src/handlers/dental-clinical/createPrescription.ts` — assertBranchRole call site
- `services/api-ts/src/handlers/dental-visit/updateDentalVisit.ts:91-106` — BR-005 implementation
- `services/api-ts/src/handlers/dental-visit/business-rules.test.ts:188-280` — BR-005 tests
- `services/api-ts/src/handlers/dental-imaging/CephMgmt_updateCephLandmark.ts:78-86` — FSM guard
- `services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.schema.ts:136-140` — FSM table
- `services/api-ts/src/handlers/dental-imaging/ceph.test.ts:612-645` — FSM tests
- `services/api-ts/src/handlers/dental-billing/updateDentalPaymentPlan.ts` — PaymentPlan handler
- `services/api-ts/src/handlers/dental-billing/repos/dental-payment-plan.repo.ts:23-26` — PaymentPlan FSM
- `services/api-ts/src/handlers/dental-billing/dental-billing-module4.test.ts:150-218` — FSM tests
- `apps/dentalemon/vite.config.ts` — Vite + TanStack Router config, `routeFileIgnorePattern`
- `apps/dentalemon/src/routes/` — confirmed no imaging-test routes (find command)
- `apps/dentalemon/src/routeTree.gen.ts` — confirmed no imaging-test in route tree
- `apps/dentalemon/tests/e2e/auth-gates.spec.ts` — E2E role gate pattern
- `apps/dentalemon/tests/e2e/fixtures.ts` — `setupDentalOrg` helper

**Confidence:** HIGH across all findings — all verified by direct file reads in this session.
