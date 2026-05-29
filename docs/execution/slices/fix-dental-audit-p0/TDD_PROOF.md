# TDD_PROOF: fix-dental-audit-p0

**Findings**: EM-AUD-005, EM-AUD-006
**Date**: 2026-05-29

---

## Test run: EM-AUD-005 (setPin audit trail)

**File**: `src/handlers/dental-org/auth-security-hardening.test.ts`
**Command**: `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase_test bun test src/handlers/dental-org/auth-security-hardening.test.ts`

```
 12 pass
 0 fail
 20 expect() calls
Ran 12 tests across 1 file. [946.00ms]
```

New tests added (within `describe('EM-AUD-005 ...')`):
- `successful setPin writes audit log entry [EM-AUD-005]` — PASS
- `failed setPin (cross-org) does NOT write success audit entry [EM-AUD-005 negative]` — PASS

All 10 pre-existing tests still pass (no regression).

---

## Test run: EM-AUD-006 (405 append-only enforcement)

**File**: `src/handlers/dental-audit/audit-append-only.test.ts`
**Command**: `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase_test bun test src/handlers/dental-audit/audit-append-only.test.ts`

```
 4 pass
 0 fail
 8 expect() calls
Ran 4 tests across 1 file. [13.00ms]
```

Tests:
- `DELETE /dental/audit-events/:id → 405 AUDIT_APPEND_ONLY` — PASS
- `PUT /dental/audit-events/:id → 405 AUDIT_APPEND_ONLY` — PASS
- `PATCH /dental/audit-events/:id → 405 AUDIT_APPEND_ONLY` — PASS
- `DELETE with a different ID also returns 405 [route param independence]` — PASS

---

## Typecheck

No new TypeScript errors introduced in changed files:

```
bun run typecheck 2>&1 | grep "setPin\|audit-append\|DentalMembershipManagement_setPin"
(no output — clean)
```

Pre-existing errors in `acceptance.registration-and-visit.test.ts`, `rbac-http.test.ts`, `dental-billing.test.ts`, and `dental-patient-sync.test.ts` are unrelated to this slice and were present before these changes.

---

## Files modified

| File | Change |
|------|--------|
| `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_setPin.ts` | Added `logAuditEvent` import + call after successful PIN set |
| `services/api-ts/src/app.ts` | Added DELETE/PUT/PATCH 405 handlers for `/dental/audit-events/:id` |

## Files created (tests)

| File | Purpose |
|------|---------|
| `services/api-ts/src/handlers/dental-audit/audit-append-only.test.ts` | 4 tests verifying 405 contract (EM-AUD-006) |
| `services/api-ts/src/handlers/dental-org/auth-security-hardening.test.ts` | 2 tests appended for setPin audit trail (EM-AUD-005) |
