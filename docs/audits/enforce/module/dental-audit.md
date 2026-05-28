<!-- oli-enforce-module v1.0 | generated: 2026-05-27 | module: dental-audit -->

# Enforcement Report — dental-audit

**Module spec:** `docs/product/modules/dental-audit/MODULE_SPEC.md`  
**API contracts:** `docs/product/modules/dental-audit/API_CONTRACTS.md`  
**Standard reference:** §5.11 (AUD-BR-001..004)  
**Reviewer:** Claude (adversarial, oli-enforce-module)  
**Date:** 2026-05-27  
**Status:** ISSUES FOUND

---

## Executive Summary

The dental-audit module has a functioning repository layer and test suite for `AuditLogRepository` and `logAuditEvent`. The core write path is wired correctly for the handlers that call it. However, **every declared AC and the single declared GET endpoint has at least one enforcement gap.** The most critical issues are:

1. **Wrong auth model** — spec declares `dentist_owner` access; handler enforces `admin` system role only. Dentist owners cannot access the audit log at all.
2. **No branch ownership guard** — any `admin` user can pass any `branchId` and retrieve cross-branch audit data.
3. **WF-096 (async pg-boss consumer) is entirely absent** — the spec-declared async write pathway does not exist.
4. **AC-AUD-002 not enforced** — no 405 route blocking PATCH/PUT/DELETE on audit events.
5. **Schema diverges from §7 data requirements** — 5 declared fields (`category`, `event_type`, `outcome`, `ip_address`, `retention_status`) are absent from `dental_audit_log`.
6. **AC-AUD-001 violated** — audit writes are synchronous inline (not async via pg-boss); the "within 5s" constraint is coincidentally met but the architecture contradicts the spec.
7. **G-005 PHI leak** — `displayName` (staff name) written into the `audit_log_entry.details` field in `verifyPin` handler, violating AC-AUD-004 and the PHI rule.
8. **Recursion violation** — `listAuditLogs` (platform audit endpoint) writes a new audit event on every query, directly contradicting §17.

---

## Findings

---

### CR-01: Auth model mismatch — `dentist_owner` cannot access audit log (BLOCKER)

**File:** `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts:21`  
**Spec reference:** API_CONTRACTS.md `Auth: dentist_owner only`; MODULE_SPEC.md §6  

**Issue:** The handler checks `roles.includes('admin')`. In this system, `admin` is the Better-Auth platform-level system role (used by platform admins), not the `dentist_owner` context role from `DentalMembership`. A dentist owner has Better-Auth role `user` with a `dentist_owner` context role — they will always receive 403. The endpoint is permanently inaccessible to its declared audience.

**Fix:**
```typescript
// Replace the admin-only check with dentist_owner context role check
const membership = await getMembershipForUser(db, user.id);
if (!membership || membership.role !== 'dentist_owner') {
  throw new ForbiddenError('dentist_owner role required to access audit log');
}
// Then enforce branch scope from membership rather than accepting branchId freely
const scopedBranchId = membership.branchId;
```

---

### CR-02: No branch ownership guard — cross-branch data leak (BLOCKER)

**File:** `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts:30`  
**Spec reference:** AC-AUD-003: "Audit log viewer returns only events for requesting user's branch."  

**Issue:** `branchId` is accepted as a free query parameter. Any caller who passes the auth check can supply an arbitrary `branchId` and read another branch's audit events. There is no call to `assertBranchAccess` or equivalent. This is a data-isolation security vulnerability.

**Fix:**
```typescript
// Derive branchId from the authenticated user's membership, not from the query string
const membership = await getMembershipForUser(db, user.id);
const scopedBranchId = membership.branchId; // ignore caller-supplied branchId
const { entries, total } = await repo.list(
  { ...filters, branchId: scopedBranchId },
  { limit, offset },
);
```

---

### CR-03: G-005 PHI leak — `displayName` written to audit details (BLOCKER)

**File:** `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_verifyPin.ts:67`  
**Spec reference:** AC-AUD-004: "No email or name fields appear in any audit event." MODULE_SPEC.md §5 G-005.  

**Issue:** The `details` payload written to `audit_log_entry` includes `displayName: member.displayName`. `display_name` is a human-readable staff name (PII). This directly violates G-005 and AC-AUD-004. The audit event should only contain UUIDs.

**Fix:**
```typescript
// Remove displayName from details — IDs only
details: { memberId: membershipId },
```

---

### CR-04: `listAuditLogs` writes audit event on every audit query — recursion violation (BLOCKER)

**File:** `services/api-ts/src/handlers/audit/listAuditLogs.ts:82–101`  
**Spec reference:** MODULE_SPEC.md §17: "Audit module itself does NOT write audit events (avoid recursion)."  

**Issue:** Every call to `GET /audit/logs` invokes `repo.logEvent(...)` which inserts a new row into `audit_log_entry`. This creates an unbounded recursive chain: viewing audit logs generates an audit entry; if that entry is visible in subsequent queries, viewing it generates another entry. §17 explicitly prohibits this.

**Fix:** Remove the `repo.logEvent(...)` call at lines 82–101 entirely. The Pino structured logger at line 103 is sufficient for compliance without the recursive loop.

---

### CR-05: `setPin` writes no audit event — sensitive operation unaudited (BLOCKER)

**File:** `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_setPin.ts`  
**Spec reference:** AUD-BR-001 (security-sensitive mutations must be auditable); AUD-BR-004 (actor, action, target, timestamp required).  

**Issue:** PIN changes are security-sensitive operations that permanently alter authentication credentials. `setPin` calls no audit logger of any kind. A PIN change by any actor (including a malicious insider) leaves no trace. By contrast, `verifyPin` does write an audit entry on success.

**Fix:**
```typescript
// After successful repo.updatePin(), add:
try {
  const auditRepo = new AuditLogRepository(db);
  await auditRepo.insert({
    actorId: user.id,
    tenantId: member.tenantId,
    branchId: member.branchId,
    action: 'membership.pin_set',
    targetType: 'dental_membership',
    targetId: membershipId,
  });
} catch (err) {
  logger?.warn?.({ err }, 'Failed to write PIN_SET audit log');
}
```

---

### CR-06: AC-AUD-002 not enforced — no 405 on PATCH/PUT/DELETE for audit events (BLOCKER)

**File:** `services/api-ts/src/app.ts` (missing routes)  
**Spec reference:** AC-AUD-002: "Audit event cannot be modified or deleted (405 on PATCH/PUT/DELETE)." API_CONTRACTS.md: `PATCH /DELETE /PUT → 405 AUDIT_EVENT_IMMUTABLE`.  

**Issue:** No PATCH, PUT, or DELETE routes are registered for `/dental/admin/audit/:id` or equivalent. The spec requires an explicit 405 response. Without it, these methods fall through to Hono's default 404 handler, which does not satisfy the spec requirement and leaks implementation detail.

**Fix:**
```typescript
// Register explicit 405 handlers:
['patch', 'put', 'delete'].forEach((method) => {
  (app as any)[method]('/dental/admin/audit/:id',
    (_c: any) => _c.json({ error: 'AUDIT_EVENT_IMMUTABLE' }, 405)
  );
});
```

---

### CR-07: WF-096 async pg-boss consumer entirely absent (BLOCKER)

**File:** No file — entirely missing  
**Spec reference:** MODULE_SPEC.md §3 WF-096; §10b DE-001 through DE-024; AC-AUD-001 "within 5s via pg-boss".  

**Issue:** The spec declares that all 24 domain events (DE-001..DE-024) should be consumed by dental-audit via pg-boss async queue. No pg-boss consumer, job registration, or event handler for domain events exists in `services/api-ts/src/handlers/dental-audit/`. The current mechanism (`logAuditEvent` called synchronously inline) is a stopgap that does not match the declared async architecture. Many critical module write handlers also do not call `logAuditEvent` at all (see WR-01).

**Fix:** Register a pg-boss consumer for dental domain events in a new `handlers/dental-audit/jobs/index.ts`, consuming the declared event queue and inserting rows into `dental_audit_log`. This is the spec's primary write path for the module.

---

### WR-01: Majority of write handlers missing `logAuditEvent` calls (WARNING)

**Files (representative sample):**
- `services/api-ts/src/handlers/dental-clinical/createConsentForm.ts`
- `services/api-ts/src/handlers/dental-clinical/createAmendment.ts`
- `services/api-ts/src/handlers/dental-clinical/createPrescription.ts`
- `services/api-ts/src/handlers/dental-clinical/deleteAttachment.ts`
- `services/api-ts/src/handlers/dental-visit/createDentalTreatment.ts`
- `services/api-ts/src/handlers/dental-visit/createVisitNoteAddendum.ts`

**Spec reference:** AUD-BR-001: "Clinical create/update/finalize/delete/reversal actions must be auditable." AUD-BR-002: "Billing discounts, voids, refunds, and payment changes must be auditable."  

**Issue:** `grep -L logAuditEvent` across `create*.ts`, `update*.ts`, `delete*.ts` shows ~28 write handlers with no audit call. Audited handlers include: `updateDentalVisit`, `updateDentalTreatment`, `createDentalVisit`, `voidDentalInvoice`, `applyDentalDiscount`, and patient contact handlers. Consent form creation, amendments, prescriptions, and clinical deletions are not audited.

**Fix:** Systematically add `logAuditEvent` calls to all clinical and billing write handlers. Use the WF-096 pg-boss consumer as the eventual long-term solution; inline `logAuditEvent` as the short-term fix.

---

### WR-02: `dental_audit_log` schema missing 5 fields declared in §7 data requirements (WARNING)

**File:** `services/api-ts/src/handlers/dental-audit/repos/audit-log.schema.ts`  
**Spec reference:** MODULE_SPEC.md §7: declared fields include `category`, `event_type`, `outcome`, `ip_address`, `retention_status`.  

**Issue:** The spec's data requirements table lists these fields; the actual schema has none of them. The API response contract (API_CONTRACTS.md) also references `event_type`, `actor_role`, and `occurred_at` (vs `timestamp` in schema). The response currently returns raw DB rows with mismatched field names.

**Missing fields:**

| Spec field | Schema status |
|---|---|
| `category` | Absent |
| `event_type` | Absent |
| `outcome` | Absent |
| `ip_address` | Absent |
| `retention_status` | Absent |
| `actor_role` | Absent |
| `occurred_at` | Present as `timestamp` (naming mismatch in response) |

**Fix:** Add missing columns to the schema, generate a migration, and add a response serializer that maps `timestamp` → `occurred_at`.

---

### WR-03: `metadata` field silently dropped in `dental_audit_log` writes (WARNING)

**File:** `services/api-ts/src/core/audit-logger.ts:54–66`  

**Issue:** `AuditEvent.metadata` is written to `dental_audit` (legacy table, line 44) but is **not** written to `dental_audit_log` (spec table). The `dental_audit_log` schema has no `metadata` column. Any caller passing `metadata` (e.g., `discount.applied` with `{ percentageRate, reason }`) loses that context in the spec-compliant table. Silent data loss.

**Fix:** Add a `metadata: jsonb('metadata')` column to `dental_audit_log` schema and pass it in `auditLogRepo.insert(...)`.

---

### WR-04: Missing `INVALID_DATE_RANGE` (422) validation (WARNING)

**File:** `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts:34–35`  
**Spec reference:** API_CONTRACTS.md: `INVALID_DATE_RANGE(422)` declared as explicit error.  

**Issue:** No validation that `to >= from` is performed. Invalid date strings (e.g., `from=not-a-date`) produce `Invalid Date` objects that are passed directly to Drizzle's `gte()`, which will generate invalid SQL or throw an unhandled 500 error. The spec declares a 422 response for this case.

**Fix:**
```typescript
const fromDate = from ? new Date(from) : undefined;
const toDate   = to   ? new Date(to)   : undefined;
if (fromDate && isNaN(fromDate.getTime())) throw new ValidationError('Invalid date_from');
if (toDate   && isNaN(toDate.getTime()))   throw new ValidationError('Invalid date_to');
if (fromDate && toDate && fromDate > toDate) {
  throw new ValidationError('date_from must not be after date_to', 'INVALID_DATE_RANGE');
}
```

---

### WR-05: `limit`/`offset` NaN not guarded — malformed query params cause DB errors (WARNING)

**File:** `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts:36–37`  

**Issue:** `Number('abc')` returns `NaN`. `Math.min(NaN, 200)` returns `NaN`. Passing `NaN` to Drizzle's `.limit()` or `.offset()` will generate invalid SQL (e.g., `LIMIT NaN`) which PostgreSQL will reject with a 500-level error. No input validation guards these parameters.

**Fix:**
```typescript
const rawLimit  = parseInt(ctx.req.query('limit')  ?? '50', 10);
const rawOffset = parseInt(ctx.req.query('offset') ?? '0',  10);
const limit  = isNaN(rawLimit)  ? 50  : Math.min(rawLimit,  200);
const offset = isNaN(rawOffset) ? 0   : Math.max(rawOffset, 0);
```

---

### WR-06: API query parameter names diverge from spec (WARNING)

**File:** `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts:34–38`  
**Spec reference:** API_CONTRACTS.md query params: `actor_id`, `event_type`, `aggregate_type`, `aggregate_id`, `date_from`, `date_to`, `page`, `per_page`.  

**Issue:** The handler accepts camelCase names (`actorId`, `targetType`, `targetId`) instead of the spec's snake_case names (`actor_id`, `aggregate_type`, `aggregate_id`). It also uses `limit`/`offset` instead of `page`/`per_page`. The spec declares `event_type` as a filter param; the handler has no `event_type` filter at all. Any client following the API contract will get no filter applied.

**Fix:** Accept spec-declared parameter names and map internally. The legacy aliases (`personId`, `resourceType`, `resourceId`) can remain for backward compatibility.

---

### WR-07: No HTTP-level test for `getAuditEvents` handler (WARNING)

**File:** `services/api-ts/src/handlers/dental-audit/audit.test.ts`  

**Issue:** All existing tests exercise `AuditLogRepository` directly and `logAuditEvent` at the function level. No test exercises the HTTP handler `getAuditEvents` — meaning auth enforcement, query parameter handling, pagination, and the branch-isolation logic (when fixed) are all untested at the route level. Per MEMORY.md project feedback: "Handler unit tests with buildTestApp() don't catch route registration bugs; must hit real server."

**Fix:** Add integration tests that start the real server and issue authenticated requests to `GET /dental/admin/audit`, covering: 403 for wrong role, 200 with branch scope, filter by `actor_id`, invalid date 422.

---

### WR-08: `verifyPin` uses failed-attempt count before increment on lockout path (WARNING)

**File:** `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_verifyPin.ts:87`  

**Issue:** On the failed-attempt branch, if `repo.recordFailedPinAttempt()` returns `null` (DB error or race), the fallback is `member.pinFailedAttempts + 1`. This returns the pre-increment count + 1 in the response. More seriously, if `updated` is `null`, `repo.isLockedOut(updated)` is called with `null` (line 79). `repo.isLockedOut` must be null-safe or this will throw. This is a logic defect in the audit-adjacent security path.

**Fix:** Guard the null case explicitly:
```typescript
if (!updated) {
  return ctx.json({ success: false, failedAttempts: member.pinFailedAttempts + 1 });
}
if (repo.isLockedOut(updated)) { ... }
```

---

### IN-01: `dental-audit.test.ts` AC-003 label conflates repo test and AC (INFO)

**File:** `services/api-ts/src/handlers/dental-audit/audit.test.ts:178`  

**Issue:** Test labeled `AC-003` tests `list()` filtering by `branchId` at the repo level. But AC-AUD-003 ("audit log viewer returns only events for requesting user's branch") requires HTTP-level enforcement — a user cannot bypass it by passing a different `branchId`. The test label implies the AC is covered when it is not.

**Fix:** Rename repo-level test to avoid implying AC coverage. Add HTTP-level test for AC-AUD-003.

---

### IN-02: Two parallel audit tables create ambiguity (INFO)

**Files:** `services/api-ts/src/db/audit.schema.ts` (`dental_audit`), `services/api-ts/src/handlers/dental-audit/repos/audit-log.schema.ts` (`dental_audit_log`)  

**Issue:** Both tables exist and both are written by `logAuditEvent`. The legacy `dental_audit` table has `personId`/`resourceType`/`metadata`; the spec table `dental_audit_log` has `actorId`/`targetType`/`beforeSnapshot`. The GET endpoint reads from `dental_audit_log`. The query filters for some handlers (e.g., `dental-audit-wiring.test.ts`) use `dental_audit`. Long-term this creates maintenance burden and partial coverage of each table.

**Fix (documented gap):** Plan a migration to decommission `dental_audit` and consolidate all writes to `dental_audit_log` with the missing fields (WR-02, WR-03) resolved first.

---

### IN-03: `dental-audit.test.ts` AC-003 uses `as any` cast indicating schema mismatch (INFO)

**File:** `services/api-ts/src/db/dental-audit-wiring.test.ts:83–98`  

**Issue:** The test comment "AC-003: TRUE RED — branchId column not in schema yet" and the widespread `as any` casts indicate a known schema gap that was never closed. The `dental_audit` table now has `branchId` (the schema file shows it), but the test still carries stale "TRUE RED" comments and `as any` casts, suggesting the fix was applied to the schema but the tests were not updated to reflect it.

**Fix:** Remove `as any` casts and the stale "TRUE RED" comment; verify the test passes cleanly against the current schema.

---

## Coverage Matrix — Spec Items Checked

| Spec Item | Checked | Status | Finding |
|---|---|---|---|
| §3 WF-028 — View audit log endpoint | Yes | PARTIAL | Exists but wrong auth role (CR-01), no branch guard (CR-02) |
| §3 WF-096 — Async pg-boss write consumer | Yes | NOT IMPLEMENTED | Entirely absent (CR-07) |
| §5 Business rules — append-only | Yes | PARTIAL | No 405 routes (CR-06) |
| §5 7-year retention | Yes | NOT IMPLEMENTED | `retention_status` absent from dental_audit_log schema (WR-02) |
| §5 G-005 — no PHI in log body | Yes | VIOLATED | displayName in verifyPin details (CR-03) |
| §6 Permissions — dentist_owner read | Yes | BROKEN | admin role enforced instead (CR-01) |
| §6 Permissions — system write only | Yes | PARTIAL | setPin missing audit (CR-05); many handlers missing (WR-01) |
| §6 Permissions — delete NEVER | Yes | PARTIAL | No 405 handler to enforce it (CR-06) |
| §7 Data requirements — 12 fields | Yes | PARTIAL | 5 fields absent from dental_audit_log (WR-02) |
| §7b Aggregate — append-only, no state machine | Yes | OK | Correct |
| §8 State transitions — none | Yes | OK | Correct |
| §10 API GET /dental/audit-events | Yes | PARTIAL | Route mismatch, wrong auth, no branch guard, param name divergence (CR-01, CR-02, WR-06) |
| §10b Domain events consumed DE-001..DE-024 | Yes | NOT IMPLEMENTED | No consumer exists (CR-07) |
| §11 AC-AUD-001 — write within 5s | Yes | PARTIAL | Architecture is synchronous inline, not pg-boss async as spec declares (CR-07) |
| §11 AC-AUD-002 — 405 on mutations | Yes | NOT IMPLEMENTED | No 405 routes registered (CR-06) |
| §11 AC-AUD-003 — branch-scoped read | Yes | NOT ENFORCED | No branch ownership check (CR-02) |
| §11 AC-AUD-004 — no PHI in fields | Yes | VIOLATED | displayName in verifyPin (CR-03) |
| §14 Dependencies — assertBranchAccess | Yes | MISSING | Not called in getAuditEvents (CR-02) |
| §17 Observability — no self-audit recursion | Yes | VIOLATED | listAuditLogs logs itself (CR-04) |
| §19 AUD-S1 — async pg-boss consumer | Yes | NOT IMPLEMENTED | (CR-07) |
| §19 AUD-S2 — paginated filtered viewer | Yes | PARTIAL | Pagination works; filters use wrong param names (WR-06) |
| §19 AUD-S3 — G-005 PHI removal from auth logs | Yes | PARTIALLY VIOLATED | displayName still present in verifyPin (CR-03) |
| AUD-BR-001 — clinical actions auditable | Yes | PARTIAL | ~28 write handlers missing logAuditEvent (WR-01) |
| AUD-BR-002 — billing discounts/voids auditable | Yes | PARTIAL | voidDentalInvoice and applyDentalDiscount audited; others missing (WR-01) |
| AUD-BR-003 — permission-denied attempts logged | Yes | COVERAGE GAP | No spec declaration on implementation; not implemented |
| AUD-BR-004 — actor/action/target/timestamp present | Yes | OK | logAuditEvent always writes required fields |

---

## Prioritized Remediation

| Priority | ID | Finding |
|---|---|---|
| P0 | CR-01 | dentist_owner cannot access audit log |
| P0 | CR-02 | Cross-branch audit data leak |
| P0 | CR-03 | PHI (displayName) in audit details |
| P0 | CR-04 | listAuditLogs writes audit entry on every call (recursion) |
| P0 | CR-05 | setPin has no audit trail |
| P0 | CR-06 | No 405 enforcement on audit event mutations |
| P1 | CR-07 | WF-096 pg-boss consumer entirely absent |
| P1 | WR-01 | ~28 write handlers missing logAuditEvent |
| P1 | WR-02 | 5 declared fields absent from dental_audit_log schema |
| P1 | WR-03 | metadata silently dropped in dental_audit_log writes |
| P1 | WR-04 | Invalid date range not validated (422 not returned) |
| P1 | WR-05 | NaN limit/offset causes DB errors on malformed input |
| P2 | WR-06 | Query param names diverge from spec (snake_case vs camelCase, page/per_page vs limit/offset) |
| P2 | WR-07 | No HTTP-level test for getAuditEvents |
| P2 | WR-08 | verifyPin isLockedOut(null) potential null dereference |
| P3 | IN-01 | AC-003 test label implies HTTP coverage it does not provide |
| P3 | IN-02 | Two parallel audit tables (dental_audit + dental_audit_log) |
| P3 | IN-03 | Stale "TRUE RED" comments and as-any casts in wiring test |

---

## V1 Readiness Rating

**ORANGE** — Core write infrastructure is present (`logAuditEvent`, `AuditLogRepository`), but the viewer endpoint has a broken auth model, the branch isolation AC is not enforced, PHI is actively being written to audit logs, and the spec-primary async write pathway (WF-096) does not exist.

---

_Reviewed: 2026-05-27_  
_Reviewer: Claude (oli-enforce-module, adversarial)_  
_Depth: deep_
