# Phase 0: Code Review Reference

Pre-implementation code review of all areas touched by Ambiguity Gate resolution.

---

## Gate #3: Delete Semantics — Review Findings

### Confirmed Patterns (match exploration)

| Strategy | Entities | Verified |
|----------|----------|----------|
| Hard delete | BookingEvent, ScheduleException, Draft BillingInvoice, Provider, marketplace Patient, StorageFile, Review, ClinicalAttachment | YES |
| Void | BillingInvoice (Stripe), DentalInvoice, DentalPayment | YES |
| Archive | DentalPatient (reversible + EC1 guard), EmailTemplate, AuditLog | YES |
| Deactivate | Practitioner, PractitionerRole, DentalMembership | YES |
| Cancel | DentalAppointment, Booking, EmailQueue, LabOrder | YES |
| No delete | Person, EMR, Visit, Treatment, Chart, Prescription, Consent, MedicalHistory, PMD, Org, Branch | YES |

### Issues Found

1. **CRITICAL: voidDentalPayment lacks transaction wrapping** (`handlers/dental-billing/voidDentalPayment.ts:41-45`)
   - Two DB ops (void payment + reverse invoice balance) without transaction
   - If second fails → payment marked void but invoice balance not reversed
   - **Action**: Document in ADR-001 as known risk. Fix is Phase 2 scope.

2. **HIGH: voidInvoice has no status restriction** (`handlers/dental-billing/voidDentalInvoice.ts:30`)
   - Any non-voided invoice can be voided, including `paid` invoices
   - Should paid invoices require credit note flow instead?
   - **Action**: Document current behavior in ADR-001. Ask user if paid-void is intentional.

3. **HIGH: voidInvoice lacks audit fields**
   - No `voidedBy`, no `voidReason` on invoice schema/handler
   - Payment void tracks both; invoice void tracks neither
   - **Action**: Document asymmetry in ADR-001.

4. **MEDIUM: cancelAppointment ignores request body** (`handlers/dental-scheduling/cancelAppointment.ts:31`)
   - `cancellationReason` always `undefined` — body type is `never`
   - Tests at line 715 claim to verify reason storage — needs investigation
   - **Action**: Note in ADR-001. Fix in Phase 3 (scheduling improvements).

5. **LOW: `needsFollowUp` cleared on archive, not restored on restore**
   - Probably intentional (restored patients start fresh)
   - **Action**: Document in ADR-001.

6. **LOW: Double-cancel returns 404** (not 204 or 409)
   - Status guard `WHERE status IN ('scheduled','checkedIn')` means cancelled appointment returns null → 404
   - **Action**: Document in ADR-001.

7. **INFO: Reviews spec says "soft-delete" but impl is hard delete**
   - `specs/api/src/modules/reviews.md` vs `deleteReview.ts` + `review.repo.ts`
   - **Action**: Accept hard delete as correct in ADR-001. Update spec.

---

## Gate #4: Concurrent Edit — Review Findings

### Confirmed

- `baseEntityFields` includes `version: integer('version').default(1).notNull()` (`database.schema.ts:21`)
- `updateOneById()` in `database.repo.ts:120` does NOT check or increment version — dead code
- Comment says "Optimistic locking" — misleading

### Existing Ad-Hoc Protections

1. **Billing atomic SQL**: `paidCents = paidCents + $amount` in `dental-invoice.repo.ts:147-167`
2. **Patient archive guard**: `WHERE status = 'active'` in `patient.repo.ts:303`
3. **Appointment cancel guard**: `WHERE status IN ('scheduled','checkedIn')` in `dental-appointment.repo.ts:94-96`

### Decision

- **Last-write-wins** for Phase 0
- Keep `version` column, remove misleading "Optimistic locking" comment
- Document ad-hoc protections as the actual concurrency strategy

---

## Gate #5: Session Expiry — Review Findings

### Current Flow (401 today)

1. Server returns 401 (expired 7-day session)
2. SDK `customFetch` sends with `credentials: 'include'` (`client.ts:75`)
3. hey-api generated client throws error for non-ok response
4. `errorInterceptor` wraps into `SdkError` with `status: 401`
5. TanStack Query `shouldRetry` returns false for 4xx (`provider.tsx:57-65`)
6. Query enters error state
7. **User sees: broken/empty state. No redirect. No toast. No session refresh.**

### Interceptor Implementation Details

- **Use `interceptors.response.use`** (not `interceptors.error.use`) — runs BEFORE error path
- Register alongside existing error interceptor in `provider.tsx:124` using same `useRef` guard pattern
- API: `generatedClient.interceptors.response.use((response, request, options) => Response)`

### Critical Edge Cases for Implementation

1. **Thundering herd**: 10 concurrent 401s → need dedup flag (`let redirecting = false`)
2. **Skip auth endpoints**: Don't redirect for `/auth/*` paths (expected 401s)
3. **Tauri/embedded mode**: No browser redirect — check `isTauriEnvironment() && isEmbeddedMode()`
4. **Clear PIN session too**: Cloud session gone → PIN session meaningless → call `pinSession.clearSession()`
5. **Race with Better-Auth refetch**: `useSession()` has 5min staleTime — interceptor should invalidate session query AND redirect

### Implementation Plan

```typescript
// In provider.tsx, after errorInterceptor registration:
let sessionExpiredRedirecting = false;

generatedClient.interceptors.response.use((response, request, options) => {
  if (response.status === 401 && !sessionExpiredRedirecting) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/auth/')) {
      sessionExpiredRedirecting = true;
      // Clear PIN session
      pinSession.clearSession();
      // Redirect
      window.location.assign('/auth/sign-in?session_expired=1');
    }
  }
  return response;
});
```

---

## Gate #6: Idempotency — Review Findings

### Already Protected (unique constraints)

| Endpoint | Protection | Schema |
|----------|-----------|--------|
| Billing invoice creation | `unique('invoices_context_unique')` on `context` column | `billing.schema.ts:67-68` |
| EMR consultation | `unique('consultation_notes_context_unique')` on `context` column | `emr.schema.ts:44-45` |
| Reviews | `unique('reviews_context_reviewer_type_unique')` on `(context, reviewer, reviewType)` | `review.schema.ts:53` |

### Not Protected (at risk)

| Endpoint | Risk | Notes |
|----------|------|-------|
| `POST /dental/billing/invoices/:id/payments` | **HIGH** | No duplicate guard. Double-tap = double payment |
| `POST /dental/appointments` | LOW | Staff can see/delete dupes |
| `POST /dental/visits` | LOW | One-per-appointment guard exists |

### Decision

- Document tiers in ADR-004
- Defer `Idempotency-Key` middleware (too large for Phase 0)
- Rule: new financial endpoints must have idempotency guard before shipping

---

## Seed Bug — Review Findings

### Root Cause

**File**: `services/api-ts/src/handlers/dental-org/getOrgContext.ts:43`

```typescript
member = members.find(m => m.personId === user.id) ?? members[0] ?? null;
```

When no member has `personId === user.id`, falls back to `members[0]` (could be PIN-only Ana Santos).

### Impact Chain

1. Frontend stores wrong `member.id` and `member.role` in localStorage (`_dashboard.tsx:42`)
2. All subsequent API calls use wrong `currentMemberId`
3. `assertBranchAccess` checks `personId === userId` → 403 if fallback member is PIN-only

### Fix

```diff
- member = members.find(m => m.personId === user.id) ?? members[0] ?? null;
+ member = members.find(m => m.personId === user.id) ?? null;
```

### Safe to Remove Fallback

- Frontend `_dashboard.tsx`: already handles `member: null` → redirects to onboarding
- New seed script: already handles `member: null` → creates new member
- Existing tests: don't depend on fallback

### Additional Issues Found (non-blocking)

1. `orgs[0]` picks arbitrary org (line 31) — nondeterministic for multi-org users. OK for solo tier today.
2. `branches[0]` picks arbitrary branch (line 37) — same issue.
3. `listByBranch` returns unordered results (`membership.repo.ts:48-51`) — no ORDER BY.
4. New seed script uses `getOrgContext` itself (line 115) — affected by the bug it triggers.

---

## Execution Checklist

### Step 1: Setup
- [ ] `mkdir -p docs/decisions`

### Step 2: Fix getOrgContext bug
- [ ] Edit `services/api-ts/src/handlers/dental-org/getOrgContext.ts:43` — remove `members[0]` fallback

### Step 3: Test for the fix
- [ ] Create `services/api-ts/src/handlers/dental-org/getOrgContext.test.ts`
  - [ ] Test: correct member returned when personId matches
  - [ ] Test: `member: null` when no match (NOT fallback)
  - [ ] Test: all nulls when user owns no org

### Step 4: Write ADR decision documents
- [ ] `docs/decisions/ADR-001-delete-semantics.md` — entity-strategy matrix + known issues
- [ ] `docs/decisions/ADR-002-concurrent-edit-policy.md` — last-write-wins + ad-hoc protections
- [ ] `docs/decisions/ADR-003-session-expiry.md` — 401 interceptor design
- [ ] `docs/decisions/ADR-004-idempotency.md` — endpoint safety tiers

### Step 5: Delete behavior tests (add to existing test files)
- [ ] Patient archive/restore tests in `dental-patient.test.ts` (verify existing coverage, add missing cases)
- [ ] Invoice void tests in `dental-billing.test.ts` (verify existing coverage)
- [ ] Appointment cancel tests in `dental-scheduling.test.ts` (verify existing coverage)

### Step 6: Session expiry implementation
- [ ] Edit `packages/sdk-ts/src/react/provider.tsx` — add 401 response interceptor with dedup flag
- [ ] Skip `/api/auth/*` paths
- [ ] Clear PIN session on 401
- [ ] Create `packages/sdk-ts/src/react/session-expiry.test.ts`

### Step 7: Verify
- [ ] `bun test` in `services/api-ts/` — all tests pass
- [ ] `bun run typecheck` — no regressions
- [ ] 4 ADR files in `docs/decisions/`
- [ ] getOrgContext returns `member: null` for unmatched users
- [ ] 401 interceptor redirects to sign-in
- [ ] Ambiguity Gate: 8/8 PASS
