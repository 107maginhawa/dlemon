# AUTH MODULE AUDIT
**Module:** Auth / Login / Session / PIN Auth  
**Audit Date:** 2026-05-26  
**Auditor:** Senior Code Reviewer (automated)  
**Scope:** Better-Auth login, PIN select/entry, session management, PIN security, RBAC enforcement

---

## Findings Summary

| ID | Severity | Gate | Title | File(s) |
|----|----------|------|-------|---------|
| AUTH-01 | P0 | G2 | PG-04 confirmed: PIN auth issues no server session — any authenticated Better-Auth JWT grants full API access regardless of PIN | `verifyPin.ts`, `pin-entry.$memberId.tsx`, `pin-session.ts` |
| AUTH-02 | P0 | G2 | `verifyPin` and `setPin` do not verify that `membershipId` belongs to the authenticated user's org/branch — cross-org PIN brute-force and PIN reset possible | `DentalMembershipManagement_verifyPin.ts`, `DentalMembershipManagement_setPin.ts` |
| AUTH-03 | P0 | G6 | `recoverPin` handler is registered without `authMiddleware` — fully unauthenticated endpoint resets any member's PIN given only a correct security answer (brute-forceable 4-6 digit answer space) | `routes.ts:767`, `pinRecovery.ts` |
| AUTH-04 | P1 | G3 | `/auth/pin-select` and `/auth/pin-entry/$memberId` have no `beforeLoad` guard — unauthenticated users can load these routes in the browser (API calls will fail but routes render) | `pin-select.tsx`, `pin-entry.$memberId.tsx` |
| AUTH-05 | P1 | G2 | `requireRole` guard reads member role from in-memory Zustand store (`useOrgContextStore`) set after PIN entry — store is not validated against the server session on navigation, so role can be stale or spoofed by direct URL access | `guards.ts`, `org-context.store.ts` |
| AUTH-06 | P1 | G4 | PIN session is in-memory only (`PinSessionManager`) with no persistence — full tab/app close silently drops the PIN session; user is redirected nowhere and no re-auth prompt is shown on restore | `pin-session.ts` |
| AUTH-07 | P1 | G6 | `verifyPin` (new `DentalMembershipManagement_verifyPin.ts`) drops `repo.trackLastLogin()` call present in legacy `verifyPin.ts` — FR6.4 last-login tracking broken in the active handler | `DentalMembershipManagement_verifyPin.ts` vs `verifyPin.ts` |
| AUTH-08 | P2 | G8 | Security gap from AUTH-02 (cross-org PIN verification) has no unit test or E2E test — `verifyPin.test.ts` only seeds within same org, never attempts cross-org call | `verifyPin.test.ts` |
| AUTH-09 | P2 | G7 | No E2E test covers the lockout-then-recover-PIN full journey; `auth-pin.spec.ts` checks "Forgot PIN?" link appears at 3 fails but does not exercise the recovery endpoint or new-PIN login | `auth-pin.spec.ts` |
| AUTH-10 | P2 | G3 | `auth-gates.spec.ts` tests API-level 4xx responses for missing context (BR-016/BR-026) but does not test that unauthenticated browser navigation to `/dashboard` or `/patients` redirects to sign-in | `auth-gates.spec.ts` |
| AUTH-11 | P3 | G5 | There are two parallel implementations of `verifyPin`: `verifyPin.ts` (legacy, has `trackLastLogin`) and `DentalMembershipManagement_verifyPin.ts` (generated pattern, no `trackLastLogin`). Routes register the generated one. Dead code risk and regression vector. | `verifyPin.ts`, `DentalMembershipManagement_verifyPin.ts` |
| AUTH-12 | P3 | G5 | Similarly two parallel `setPin` implementations: `setPin.ts` (legacy) and `DentalMembershipManagement_setPin.ts` (active). Legacy file should be removed to avoid confusion. | `setPin.ts`, `DentalMembershipManagement_setPin.ts` |

---

## Gate-by-Gate Analysis

### Gate 2 — Role and Permission Map

#### Auth Layer Architecture

```
unauthenticated
  └─ /auth/$authView (sign-in/sign-up) — Better-Auth email+password
       └─ Better-Auth session cookie issued on success
            └─ /auth/pin-select — lists branch members
                 └─ /auth/pin-entry/$memberId — verifies PIN
                      └─ pinSession.startSession() — in-memory only
                           └─ useOrgContextStore.setContext({ memberId, role })
                                └─ /dashboard (requireAuth checks Better-Auth session only)
```

There are **two separate, parallel auth layers**:

1. **Better-Auth layer** — cloud session, cookie-based, validated by `authMiddleware()` on every dental API call. Role stored as `session.user.role` (system roles: `admin`, `user`). This is the only layer the backend verifies.

2. **PIN layer** — local/in-memory, stored in `PinSessionManager` singleton (RAM only). Sets `memberId` and dental role (`dentist_owner`, `staff_full`, etc.) in Zustand store. Backend never sees this layer.

#### What `assertBranchAccess` checks

`assertBranchAccess(db, userId, branchId)` queries `dental_memberships` for a record where `personId = userId` AND `branchId = branchId` AND `status = 'active'`. It enforces that the caller's Better-Auth `user.id` is an active member of the target branch. **It is used in `resetMemberPin`, `setSecurityQuestion`, and `pinRecovery` — but NOT in `verifyPin` or `setPin`.**

#### PG-04 Confirmation

`DentalMembershipManagement_verifyPin` returns `{ success: true, failedAttempts: 0 }` on correct PIN. No token, no cookie, no session mutation. On the frontend, `pinSession.startSession()` stores state in a JavaScript class instance in RAM. The Better-Auth cookie (issued at login) is unchanged. Any API call from the browser uses the Better-Auth cookie — the backend validates only that cookie. PIN state is invisible to the server. Therefore:

- Authenticated user Alice can call `POST /dental/organizations/X/branches/Y/members/Z/verify-pin` to verify Bob's PIN without the server knowing or caring.
- After Alice logs in (or ignores PIN entry entirely), her Better-Auth cookie grants full access to all dental API endpoints that use `authMiddleware()` with `roles: ['user']`.
- The PIN layer provides **zero access control enforcement** at the API level.

#### Dental API RBAC

All dental endpoints use `authMiddleware()` or `authMiddleware({ roles: ['user'] })`. The `role` checked here is the Better-Auth system role (`user`, `admin`) — not the dental membership role (`dentist_owner`, `staff_full`, etc.). The dental role is never validated by the backend for dental API access. Any authenticated Better-Auth `user` can call any dental endpoint (list patients, create visits, update records) regardless of their dental membership role.

---

### Gate 3 — Route and Navigation

#### Auth Route Map

| Route | Guard | Behavior |
|-------|-------|----------|
| `/auth/$authView` (sign-in/sign-up) | `requireGuest` (index only) | Better-Auth form |
| `/auth/pin-select` | **None** | Lists branch members |
| `/auth/pin-entry/$memberId` | **None** | PIN keypad |
| `/_dashboard` (layout) | `requireAuth` | Checks Better-Auth session |
| `/_dashboard/settings` | `requireRole('settings')` | Reads Zustand store role |
| `/_dashboard/reports` | `requireRole('reports')` | Reads Zustand store role |

Auth routes `/auth/pin-select` and `/auth/pin-entry/$memberId` have no `beforeLoad` guard. An unauthenticated user who navigates directly to these URLs sees the UI. API calls will return 401 because the Better-Auth cookie is absent, but the route itself renders without redirect.

#### Post-login Flow

After Better-Auth sign-in succeeds, the user is redirected by `requireGuest` → `/dashboard`. The dashboard `beforeLoad` checks for `branchId` in `localStorage` or Zustand store — if absent, it redirects to `/dental-onboarding`. There is no automatic redirect to `/auth/pin-select` from the dashboard guard; the PIN flow is user-initiated.

#### PIN Failure/Lockout Behavior

Lockout thresholds (from `membership.repo.ts`):
- 5 failed attempts → 30-second lockout
- 10 failed attempts → 5-minute lockout

On lockout, `verifyPin` returns HTTP 429 with `{ message, lockedUntil }`. Frontend displays lockout message and hides keypad. "Forgot PIN?" link appears after 3 failed attempts (FR9.7). Back button navigates to `/auth/pin-select`.

---

### Gate 4 — Frontend Interaction Integrity

#### Login Form (`$authView.tsx`)

Single file handles sign-in and sign-up views. Defers to Better-Auth client SDK. No issues found beyond scope of this audit.

#### PIN Select Screen (`pin-select.tsx`)

- Fetches members from `/dental/org/members?branchId=...` using `credentials: 'include'` (Better-Auth cookie).
- Reads `branchId` from Zustand store with `localStorage` fallback.
- FR9.2 auto-select: single member → immediate redirect to `/auth/pin-entry/$memberId`.
- No loading state shown during fetch; empty state message renders immediately then flickers to member list.
- No `beforeLoad` guard — renders for unauthenticated users (API fetch silently fails, shows empty state).

#### PIN Entry Screen (`pin-entry.$memberId.tsx`)

- 6-digit PIN (`PIN_LENGTH = 6`) entered via numeric keypad.
- On complete entry, calls `POST /dental/organizations/${orgId}/branches/${branchId}/members/${memberId}/verify-pin`.
- On `data.success === true`: calls `pinSession.startSession()`, calls `useOrgContextStore.setContext({ memberId, role })`, navigates to role-appropriate landing (FR9.3).
- Role landing map: `dentist_owner → /dashboard`, `staff_full → /patients`, `staff_scheduling → /calendar`.
- On failure: increments local `failedAttempts` counter, shows error, shows "Forgot PIN?" after ≥3 attempts.
- Member data fetched via separate API call using legacy endpoint `/dental/org/members`.

#### Member Context Store After PIN

`useOrgContextStore` (Zustand) fields set after PIN success: `memberId`, `role`. Fields `orgId` and `branchId` must already be populated (read from store/localStorage in `handleSubmit`). The store has no TTL or server-validation step — it persists in memory until `clearContext()` is called or the tab closes. `requireRole` guards read `role` from this store directly.

---

### Gate 5 — Forms, Modals, Tables

#### Login Form Validation

Better-Auth handles email/password validation. No custom client-side validation issues observed.

#### PIN Entry Form

- Digit input via button clicks; no text field (replay-safe).
- PIN auto-submits at 6 digits — no explicit submit button.
- Backspace key supported.
- Input length enforced by `PIN_LENGTH` constant.
- No rate limiting on the frontend side — rapid clicks could trigger rapid API calls before auto-lockout engages.

#### PIN Length

The frontend uses 6-digit PINs (`PIN_LENGTH = 6`). `resetMemberPin.ts` validates `^\d{6}$`. The `recoverPin` (PIN recovery) sets a new PIN with the same schema. However, `verifyPin.ts` and `DentalMembershipManagement_verifyPin.ts` accept whatever `pin` is submitted — the `DentalMembershipManagement_verifyPinBody` validator controls length (not audited here but should be 6-digit constraint).

#### Password Reset

No custom password reset modal; relies on Better-Auth magic link / email OTP.

---

### Gate 6 — Backend/API Contract Alignment

#### Auth Endpoints

| Endpoint | Auth Required | Notes |
|----------|--------------|-------|
| `POST /auth/*` | No | Better-Auth managed |
| `POST /dental/org/members/:memberId/recover-pin` | **No** | Intentionally unauthenticated (see AUTH-03) |
| `POST /dental/org/members/:memberId/reset-pin` | Yes (`roles: ['user']`) | Owner-only role check in handler |
| `POST /dental/org/members/:memberId/security-question` | Yes (`roles: ['user']`) | |
| `POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/set-pin` | Yes (`authMiddleware()`) | No ownership/org check in handler |
| `POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/verify-pin` | Yes (`authMiddleware()`) | No ownership/org check in handler |

#### verifyPin Response (confirmed)

```json
{ "success": true, "failedAttempts": 0 }
// or on failure:
{ "success": false, "failedAttempts": N }
// or on lockout (HTTP 429):
{ "message": "Too many failed attempts", "lockedUntil": "ISO8601" }
```

No token, no session mutation, no cookie in response. PG-04 is confirmed structural.

#### OpenAPI Contract Alignment

The OpenAPI spec at `specs/api/dist/openapi/openapi.json` describes `verify-pin` as returning `{ success, failedAttempts }`. No token in the spec either — the session-less design is specified, not accidental. The security gap is architectural.

#### recoverPin — Unauthenticated Endpoint (AUTH-03)

`pinRecovery.ts` line 65: `// FR9.7: PIN recovery is intentionally unauthenticated — the user is locked out`. The rationale is correct for the locked-out-user scenario. However, the implementation has a risk:

- Answer space for a 4-6 digit numeric PIN is small if users choose numeric answers.
- The security answer lockout shares the same counter as PIN attempts, capping total brute-force at ~10 tries per lockout window. This is a reasonable mitigation but the lockout window (30s at 5 attempts) is short.
- No CAPTCHA, no IP rate limit, no account notification when a recovery is performed.
- The endpoint accepts any memberId globally with no authentication whatsoever — attacker needs only a valid `memberId` UUID (guessable from member list endpoint if branch access is obtained).

---

### Gate 7 — Role-Based Journey Map

#### Journey 1: New User → Onboarding → PIN Setup

1. User signs up via `/auth/sign-up`.
2. Better-Auth session cookie issued.
3. `requireEmailVerified` guard redirects to `/verify-email` if email unverified.
4. After email verification, `requireNoPerson` guard redirects to `/onboarding`.
5. Person profile created → redirected to `/dashboard`.
6. Dashboard `beforeLoad` checks for `branchId`; if absent, redirects to `/dental-onboarding`.
7. Org + branch created via onboarding wizard.
8. Owner creates staff member via membership management.
9. Member sets PIN via `POST .../set-pin` (no ownership check — any authenticated user can set any member's PIN).

#### Journey 2: Returning User → PIN Auth → Workspace

1. User visits app. Dashboard `beforeLoad` calls `requireAuth` — redirects to `/auth/sign-in` if no Better-Auth session.
2. User logs in. Cookie set. Dashboard loads.
3. User navigates to `/auth/pin-select` (no automatic redirect; this is user-initiated).
4. Member list displayed. User selects their profile card.
5. User enters 6-digit PIN on `/auth/pin-entry/$memberId`.
6. `verifyPin` called. On success: in-memory PIN session started, Zustand store updated with `memberId` + `role`.
7. User navigated to role-appropriate page.
8. Dashboard-level `requireRole` guards now enforce dental module access based on Zustand `role`.

**Gap:** Step 3 is not enforced. A user can access `/dashboard` without ever entering a PIN. The dashboard `beforeLoad` only checks `requireAuth` (Better-Auth) and `branchId` (org context). PIN entry is entirely optional from a guard enforcement perspective.

#### Journey 3: Wrong PIN 3x → Lockout

1. 3 wrong attempts: "Forgot PIN?" link appears (frontend-only counter, no lockout yet).
2. 5 wrong attempts: 30-second server-enforced lockout (HTTP 429).
3. 10 wrong attempts: 5-minute lockout.
4. Lockout displayed; keypad hidden.
5. User can click "Forgot PIN?" to initiate recovery.

**Gap:** Frontend `failedAttempts` counter is local state — if user refreshes the page, counter resets to 0 and "Forgot PIN?" disappears, but server lockout persists. UI inconsistency.

#### Journey 4: staff_scheduling Accesses Calendar via PIN

1. User logs in (Better-Auth). Navigates to `/auth/pin-select`.
2. Selects staff_scheduling member. Enters PIN.
3. On success: `role = 'staff_scheduling'` written to Zustand store.
4. Navigate to `/calendar` (FR9.3 landing for `staff_scheduling`).
5. `requireRole('calendar')` guard (if present) reads Zustand store `role`, calls `canAccess(role, 'calendar')`.

**Gap:** The API call to fetch calendar data uses the Better-Auth cookie. The server sees `role: 'user'` (system role). Dental role is not enforced. `staff_scheduling` and `dentist_owner` have the same API-level access.

---

### Gate 8 — Test Confidence Gap

#### Backend Unit Tests

| File | Coverage | Gap |
|------|----------|-----|
| `verifyPin.test.ts` | Correct PIN, wrong PIN, lockout at 5 and 10 attempts, setPin | No cross-org test; no test that unauthenticated call (no `user` in ctx) returns 401 |
| `dental-auth-module7.test.ts` | Security question set, recover PIN correct/wrong/no-question, new PIN works after recovery | No test for concurrent recovery attempts; no test that recovery bypasses lockout state |
| `middleware/auth.test.ts` | 401 without session, 200 with session, 403 wrong role, internal service bypass | Uses mock auth only; does not test dental-role enforcement |
| `utils/auth.test.ts` | Permission statements, `userHasRole` | Tests system roles only; no dental membership role coverage |
| `resetMemberPin.test.ts` | (not fully read) | Present |

#### E2E Tests

| File | Coverage | Gap |
|------|----------|-----|
| `auth-pin.spec.ts` | PIN select renders, member tap navigates to entry, correct PIN navigates to dashboard, wrong PIN shows error, "Forgot PIN?" after 3 fails, FR9.2 auto-select | Does not test cross-org PIN access; does not test PIN bypass to dashboard |
| `auth-gates.spec.ts` | BR-016 (missing branchId → 4xx), BR-026 (non-existent study delete → 404) | Does not test unauthenticated frontend navigation; does not test that accessing `/dashboard` without PIN entry works (it does) |
| `auth.test.ts` (E2E) | Better-Auth sign-up, sign-in, session | No dental PIN flow |

#### Confidence Scores

| Layer | Score | Justification |
|-------|-------|---------------|
| Better-Auth login/session | 8/10 | Well-tested via E2E; cookie/session infrastructure solid |
| PIN verification (backend) | 6/10 | Lockout logic tested; missing cross-org and auth bypass tests |
| PIN session (frontend) | 7/10 | `PinSessionManager` has thorough unit tests; in-memory volatility documented |
| RBAC enforcement (backend) | 3/10 | Only system roles enforced; dental roles never checked server-side |
| RBAC enforcement (frontend) | 5/10 | `requireRole` guards cover settings/reports/billing/staff; PIN bypass not tested |
| PIN recovery flow | 5/10 | Happy path tested; brute-force and notification gaps untested |
| E2E auth gates | 4/10 | API-level only; no UI-level guard enforcement tests |

---

## Critical Issues Detail

### AUTH-01 / PG-04 — PIN Auth Issues No Server Session (P0)

**Evidence:**
- `DentalMembershipManagement_verifyPin.ts`: response is `ctx.json({ success: true, failedAttempts: 0 })` — no token issued, no cookie set, no session mutation.
- `pin-session.ts`: `PinSessionManager` is a plain JavaScript class with in-memory `session` field. No HTTP call on `startSession()`.
- `routes.ts`: all dental endpoints use `authMiddleware()` which reads the Better-Auth cookie only.

**Attack vector:** Alice logs in via Better-Auth. She navigates directly to `/dashboard` (PIN entry skipped — no guard enforces it). She now has full access to all dental API endpoints as a `role: 'user'` Better-Auth user. She can read all patients, create visits, update records for any org she is a member of.

**Why this is hard to fix:** The current architecture intentionally separates the "cloud account" (Better-Auth) from the "device operator" (PIN). Fixing PG-04 properly requires either: (a) issuing a scoped JWT/cookie on successful PIN that the backend validates, adding `memberId` and dental role to the token, and enforcing it on dental routes; or (b) treating PIN as a per-request header that the backend validates per-call.

---

### AUTH-02 — No Cross-Org Check in verifyPin/setPin (P0)

**Evidence:**
- `DentalMembershipManagement_verifyPin.ts`: looks up member by `membershipId` only via `repo.findOneById(membershipId)`. Does not check if the member belongs to the `orgId` or `branchId` in the URL path parameters. Does not check if `user.id` has access to that member's branch.
- `DentalMembershipManagement_setPin.ts`: identical pattern — no `assertBranchAccess` call.
- `membership.repo.ts`: `findOneById` queries `WHERE id = membershipId` only.
- Compare: `resetMemberPin.ts` calls `assertBranchAccess(db, user.id, member.branchId)` before allowing PIN reset.

**Attack vector:** Attacker (authenticated Better-Auth user) knows a target `membershipId` UUID from another org. They call `POST /dental/organizations/{their-orgId}/branches/{their-branchId}/members/{victim-membershipId}/verify-pin` with a brute-forced PIN. The `orgId`/`branchId` in the path are validated by parameter schema (UUID format) but not checked against the membership record. The handler will happily verify or fail PINs for any membership globally.

---

### AUTH-03 — recoverPin Endpoint Unauthenticated (P0)

**Evidence:**
- `routes.ts:766-770`: `recoverPin` registered without `authMiddleware`.
- `pinRecovery.ts:65`: comment confirms intentional design.
- No IP rate limiting, no CAPTCHA, no audit notification in implementation.

**Risk:** An attacker who obtains any valid `memberId` (from a member list API call, for example) can attempt to recover the PIN by brute-forcing the security answer. The only protection is the shared 10-attempt lockout counter. A determined attacker can wait for lockout expiry and retry. There is no notification to the account owner when a recovery is performed.

**Mitigation already present:** Lockout counter is shared with PIN failures. Answer is normalized before comparison (prevents case variation). Wrong answer returns `{ success: false }` without revealing whether the question exists (prevents enumeration).

**What's missing:** notification to member/owner on recovery, IP-based rate limiting, CAPTCHA after N attempts, audit log entry.

---

### AUTH-07 — trackLastLogin Dropped in Active Handler (P1)

**Evidence:**
- `verifyPin.ts` (legacy): calls `await repo.trackLastLogin(membershipId)` on successful PIN verification.
- `DentalMembershipManagement_verifyPin.ts` (active, registered in `routes.ts`): no `trackLastLogin` call.
- `routes.ts:865-869`: registers `DentalMembershipManagement_verifyPin` (the new file).

FR6.4 last-login tracking is silently broken since the generated handler replaced the legacy one without carrying over this call.

---

## Recommended Fix Priority

### P0 — Fix Before Next Release

1. **AUTH-02** (cross-org PIN verification): Add `assertBranchAccess(db, user.id, member.branchId)` to both `DentalMembershipManagement_verifyPin` and `DentalMembershipManagement_setPin`. This is a single function call and prevents cross-org PIN brute-force.

2. **AUTH-03** (unauthenticated recoverPin): Add IP-based rate limiting middleware to `/dental/org/members/:memberId/recover-pin`. Add audit log entry on successful recovery. Consider requiring email verification (send a one-time code to the member's email before allowing PIN reset). This is a design trade-off between security and the locked-out-user UX.

3. **AUTH-01 / PG-04** (PIN auth no server session): This is the architectural root cause. Short-term mitigation: add a `beforeLoad` guard to `/_dashboard` that checks `pinSession.getSession()` is not null; redirect to `/auth/pin-select` if no PIN session. This does not fix the backend enforcement gap but closes the most obvious bypass. Long-term: issue a scoped member token on PIN success.

### P1 — Fix in Next Sprint

4. **AUTH-04** (pin-select/pin-entry no route guard): Add `requireAuth` (Better-Auth check) to `beforeLoad` of both PIN routes so unauthenticated users are redirected to sign-in.

5. **AUTH-05** (Zustand role not server-validated): At dashboard load, re-validate `memberId` from store against the `/dental/org/members` endpoint to confirm the member is still active and role is current.

6. **AUTH-07** (trackLastLogin dropped): Add `repo.trackLastLogin(membershipId)` back to `DentalMembershipManagement_verifyPin.ts`.

### P2 — Address in Backlog

7. **AUTH-08**: Add unit test asserting that `verifyPin` called with a `membershipId` from a different org returns 403.

8. **AUTH-09**: Add E2E test for full lockout → recover-PIN → re-login journey.

9. **AUTH-06** (in-memory PIN session volatility): Document the UX behavior on tab close. Consider `sessionStorage` with encryption for PIN session persistence within the tab session.

### P3 — Cleanup

10. **AUTH-11 / AUTH-12**: Delete `verifyPin.ts` and `setPin.ts` (legacy files). Routes already use the generated-pattern handlers. Keeping both creates confusion and regression risk.

---

## Overall Confidence Score

| Area | Score | Justification |
|------|-------|---------------|
| Better-Auth session infrastructure | 8/10 | Solid; storeSessionInDatabase enabled; bearer plugin active |
| PIN backend logic (hash, lockout) | 7/10 | bcrypt correct; lockout thresholds tested; ownership gap is separate |
| PIN API authorization | 2/10 | No cross-org enforcement; no dental-role enforcement at API level |
| Frontend route guarding | 4/10 | Dashboard protected; PIN routes unguarded; requireRole reads unvalidated store |
| PIN session lifecycle | 6/10 | In-memory only; 5-min inactivity timeout; tab-close silently clears |
| PIN recovery security | 4/10 | Lockout shared counter helps; no notifications, no IP limiting |
| Test coverage (all layers) | 5/10 | Backend unit tests solid for PIN logic; auth RBAC barely tested; E2E does not cover bypass |
| **Overall** | **4/10** | PG-04 + AUTH-02 + AUTH-03 represent three exploitable security gaps; core auth layer (Better-Auth) is sound |
