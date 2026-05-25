# G0 Phase B — E2E Drift Triage

> Branch: feat/v1.4-clinical-imaging
> Date: 2026-05-20
> Method: ran all `tests/e2e/**` suites, grouped failures by root cause

---

## Summary

| Suite | Failures | Root Cause | Fixable in 8.1? |
|---|---|---|---|
| `cors-auth.test.ts` | 18 | Pre-existing CORS config tests | No — known, pre-existing |
| `health.test.ts` | 1 | `storage: fail` — MinIO not running | No — infra-only, not code drift |
| `booking.test.ts` + `search-filtering.test.ts` | 13 | Field rename: `booking.provider` → `booking.host` | Yes — test rename |
| `emr.test.ts` | ~20 | Route rename: `POST /providers` → `POST /providers/practitioners` | Yes — test update |
| `expand.test.ts` | 4 | Auto-expand not resolving `customer` field to object | Deferred — needs investigation |

---

## D1 — Pre-existing / Infra (Skip)

### D1.1 cors-auth.test.ts (18 failures)
**Root cause**: Pre-existing. These CORS tests were already failing before this branch.
The tests validate strict-mode CORS behavior that conflicts with the development
`ALLOW_ALL_ORIGINS` / `CORS_ORIGIN` env setup in the test harness.
**Action**: None. Documented in session context as a known pre-existing failure.

### D1.2 health.test.ts (1 failure)
**Test**: `should verify service startup health check workflow`
**Root cause**: `expect(verboseHealth.checks.storage).toBe('pass')` fails because
MinIO is not running in the local dev/test environment. The health endpoint correctly
reports `storage: fail` when S3/MinIO is unreachable.
**Action**: None. This is infra-only — not code drift. When CI provisions MinIO, this passes.

---

## D2 — Booking Field Rename (Fix in 8.1)

**Files**: `tests/e2e/booking/booking.test.ts`, `tests/e2e/booking/search-filtering.test.ts`
**Failures**: 13

**Root cause**: TypeSpec (`specs/api/src/modules/booking.tsp:290`) defines the booking
host as `host: string | Person`. Tests use `booking.provider` and filter param `provider=`.
The API returns `host`, so all assertions on `booking.provider` get `undefined`.

**Evidence**:
```
Expected: "23c5bead-6771-41ea-b83a-a19992bddffb"
Received: undefined
```
The assertion is `expect(dualBooking!.provider).toBe(providerPersonId)` — field is `host`.

**Fix**: In test files, rename `booking.provider` → `booking.host`, query param `provider=`
→ `host=`, and any local variable `providerFilter` etc. that references the field.

---

## D3 — EMR Provider Route Rename (Fix in 8.1)

**File**: `tests/e2e/emr/emr.test.ts`
**Failures**: ~20 (all cascade from setup failure)

**Root cause**: The EMR test helper calls `createProviderProfile()` which POSTs to
`/providers`. But the registered routes (generated from TypeSpec) are:
- `POST /providers/practitioners`
- `GET /providers/practitioners/:id`
- `GET /providers/practitioners` (list)

The old `/providers` resource was restructured into `/providers/practitioners` and
`/providers/practitioner-roles`. All EMR tests fail because the beforeAll setup
can't create the provider profile.

**Evidence**:
```
error: Failed to create provider profile: Route not found
```

**Fix**: Update `tests/helpers/provider.ts` (and any callers in emr.test.ts) to use
`/providers/practitioners` instead of `/providers` for CREATE/GET/LIST/PATCH operations.
Check `tests/e2e/provider/provider.test.ts` — if it's green, it already uses the
correct routes; use it as the reference.

---

## D4 — Expand Feature Broken (Deferred)

**File**: `tests/e2e/expand/expand.test.ts`
**Failures**: 4 (all in Auto-Expand tests)

**Root cause**: Tests expect `data.customer` to be an expanded Person object after
`GET /billing/invoices/{id}?expand=customer`. Instead, `data.customer` is a UUID string
(the raw FK value, unexpanded).

**Investigation needed**:
- Check if `x-expandable-field` metadata still exists in the generated OpenAPI spec
  (`src/generated/openapi/`) for the billing invoice `customer` field.
- Check if the expand middleware in `src/app.ts` is still wired to billing routes.
- Check if `src/utils/expand.ts:36` `transformExpandResponse` is called on the
  `/billing/invoices/:id` handler path.

**Action**: Deferred. Not a simple rename — requires tracing middleware wiring.
File as a separate bug. Do not fix in this task.

---

## Task 8.1 Plan

Fix D2 and D3. Skip D1 (pre-existing/infra) and D4 (deferred investigation).

1. **Booking field rename** — update `booking.test.ts` + `search-filtering.test.ts`:
   - `booking.provider` → `booking.host`
   - query param `?provider=` → `?host=`
   Commit: `fix(e2e-drift): rename booking.provider → booking.host in E2E tests`

2. **EMR provider route** — Partial fix: `tests/helpers/client.ts createProviderProfile`
   updated from `POST /providers` → `POST /providers/practitioners` (correct route).
   However, `POST /providers/practitioners` requires `admin` or `credentialing` role.
   The old `POST /providers` allowed self-service. EMR tests create practitioners as
   regular users — this requires test redesign (use `signinAsAdmin()` + create practitioner,
   then use that ID). **Deferred** — architecture change, not a simple rename.
   `tests/helpers/provider.ts` also uses old routes; update needed separately.

3. **search-filtering totalCount** — Fixed: `data.totalCount` → `data.pagination.totalCount`
   (listBookingEvents wraps pagination in `{ data: [], pagination: { totalCount } }`).
   Commit: `fix(e2e-drift): rename booking.host + pagination.totalCount in E2E tests`
