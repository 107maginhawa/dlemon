# SLICE_SPEC: fix-dental-audit-p0

**Findings addressed**: EM-AUD-005 (P0), EM-AUD-006 (P0)
**Date**: 2026-05-29
**Status**: COMPLETE

---

## EM-AUD-005 — setPin writes no audit event

**Severity**: P0 (security-sensitive mutation unaudited)

**Root cause**: `DentalMembershipManagement_setPin.ts` called `repo.updatePin()` and returned immediately with no call to `logAuditEvent`. Every other security-sensitive handler (verifyPin, visit state changes) writes an audit record; setPin was the sole gap.

**Fix**: Added `logAuditEvent` call from `@/handlers/audit/repos/audit.facade` after a successful `repo.updatePin()`. The call uses:
- `eventType: 'security'`
- `category: 'security'`
- `action: 'update'` (maps to the `audit_action` enum; `update_pin` is not a valid enum value)
- `outcome: 'success'`
- `resourceType: 'dental_membership'`, `resource: membershipId`

The call is wrapped in `try/catch` — audit failure must never block the PIN mutation response (consistent with verifyPin pattern).

**File changed**: `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_setPin.ts`

---

## EM-AUD-006 — No 405 routes for audit-events mutation verbs

**Severity**: P0 (append-only not enforced at HTTP level)

**Root cause**: The audit endpoint (`GET /dental/admin/audit`) had no sibling 405 handlers for DELETE/PUT/PATCH on individual audit records. Nothing prevented a future route registration or accidental handler wiring from enabling mutation.

**Fix**: Added three route handlers in `services/api-ts/src/app.ts` immediately after the GET audit route:

```
DELETE /dental/audit-events/:id → 405 { code: 'AUDIT_APPEND_ONLY' }
PUT    /dental/audit-events/:id → 405 { code: 'AUDIT_APPEND_ONLY' }
PATCH  /dental/audit-events/:id → 405 { code: 'AUDIT_APPEND_ONLY' }
```

These are unconditional — no auth check needed; the 405 fires regardless of session state.

**File changed**: `services/api-ts/src/app.ts`

---

## Test files

| File | Coverage |
|------|----------|
| `src/handlers/dental-org/auth-security-hardening.test.ts` | EM-AUD-005: setPin writes audit entry (positive + negative) |
| `src/handlers/dental-audit/audit-append-only.test.ts` | EM-AUD-006: DELETE/PUT/PATCH all return 405 + correct code (4 tests) |
