---
module: dental-audit
skill: oli-enforce-file
generated: 2026-05-27
spec: docs/product/modules/dental-audit/MODULE_SPEC.md
contracts: docs/product/modules/dental-audit/API_CONTRACTS.md
backend_root: services/api-ts/src/handlers/dental-audit/
frontend: NONE (dental-audit has no dedicated frontend files — confirmed absent, noted per spec)
status: issues_found
findings:
  blocker: 4
  warning: 3
  info: 2
---

# File Enforcement Report — dental-audit

## Files Reviewed

| File | Role |
|------|------|
| `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts` | Read handler |
| `services/api-ts/src/handlers/dental-audit/repos/audit-log.repo.ts` | Repository |
| `services/api-ts/src/handlers/dental-audit/repos/audit-log.schema.ts` | DB schema |
| `services/api-ts/src/handlers/dental-audit/audit.test.ts` | Unit tests |
| `services/api-ts/src/core/audit-logger.ts` | Write shim (cross-cutting) |
| `services/api-ts/src/handlers/audit/jobs/index.ts` | Retention job |

Frontend files: none declared or found — noted as expected.

---

## Spec Item Coverage

### API_CONTRACTS.md — GET /api/v1/dental/audit-events

| Contract Item | Status | Notes |
|---------------|--------|-------|
| Auth: `dentist_owner` only | **MISSING** | Handler checks `admin` role, not `dentist_owner`. See BL-01. |
| Query param: `branch_id` (required) | **MISSING** | Accepted as optional `branchId`; not enforced as required. See BL-02. |
| Query param: `actor_id` | FOUND | Accepted as `actorId` (also `personId` alias). |
| Query param: `event_type` | **MISSING** | Not accepted. Schema uses `action` field instead. See WR-01. |
| Query param: `aggregate_type` | **MISSING** | Not accepted. Schema has no `aggregate_type` column. See WR-01. |
| Query param: `aggregate_id` | **MISSING** | Not accepted. Schema has no `aggregate_id` column. See WR-01. |
| Query param: `action` | FOUND | Accepted and wired. |
| Query param: `date_from` / `date_to` | **MISSING** | Handler uses `from`/`to` (not contract names). See WR-02. |
| Query param: `page` / `per_page` | **MISSING** | Handler uses `limit`/`offset`; default 50 (not 20), max 200 (not 100). See WR-02. |
| Response field: `event_type` | **MISSING** | Schema/table has no `event_type` column. |
| Response field: `actor_role` | **MISSING** | Schema/table has no `actor_role` column. |
| Response field: `aggregate_type` | **MISSING** | Schema/table has no `aggregate_type` column. |
| Response field: `aggregate_id` | **MISSING** | Schema/table has no `aggregate_id` column. |
| Response field: `occurred_at` | **MISSING** | Schema uses `timestamp`; not mapped to `occurred_at` in response. |
| Response field: `id`, `actor_id`, `branch_id`, `action`, `metadata` | FOUND (partial) | Present in schema; `metadata` missing from schema. |
| Sort: `occurred_at DESC` | FOUND | `orderBy(desc(dentalAuditLog.timestamp))` — correct intent, wrong field name. |
| Errors: `FORBIDDEN(403)`, `BRANCH_ACCESS_DENIED(403)`, `INVALID_DATE_RANGE(422)` | **MISSING** | None of these error codes are thrown; generic `ForbiddenError` only. |
| PATCH/PUT/DELETE → 405 `AUDIT_EVENT_IMMUTABLE` | **MISSING** | No such routes registered anywhere. See BL-03. |

### API_CONTRACTS.md — Write Contract (All Modules)

| Contract Item | Status | Notes |
|---------------|--------|-------|
| Write via pg-boss async (never inline) | **MISSING** | `logAuditEvent` writes synchronously, inline in request path. See BL-04. |
| All modules write on every write operation (DE-001–DE-024) | PARTIAL | Only dental-visit (3 handlers) and dental-patient (4 handlers) verified calling `logAuditEvent`. Most modules not wired. |

### MODULE_SPEC.md — Business Rules / Acceptance Criteria

| Spec Item | Status | Notes |
|-----------|--------|-------|
| AC-AUD-001: Any write → audit event within 5s | PARTIAL | `logAuditEvent` exists but is synchronous inline, not pg-boss. Latency gate not verifiable. |
| AC-AUD-002: No PATCH/PUT/DELETE (405) | **MISSING** | See BL-03. |
| AC-AUD-003: Viewer returns only events for caller's branch | **MISSING** | `branch_id` not required; no `assertBranchAccess` called. See BL-01, BL-02. |
| AC-AUD-004: No email/name in any audit event | FOUND (schema) | Schema fields are UUIDs only. `metadata` JSONB is open but no violations detected in reviewed callers. G-005 gap in auth handlers is a separate known issue per spec. |
| Retention: 7 years, append-only | PARTIAL | Retention job exists but targets `audit_log_entry` (base module), not `dental_audit_log`. See WR-03. |
| No PHI in log body | PARTIAL | Schema correct; `reason` and `metadata` JSONB are open vectors — no runtime sanitization. See IN-01. |
| Audit module does NOT write its own audit events (no recursion) | FOUND | Confirmed: `getAuditEvents` calls no `logAuditEvent`. |
| Metrics: `audit_events_written_total` counter | **MISSING** | No metrics emission in `logAuditEvent` or repo. See IN-02. |
| `assertBranchAccess` from dental-org | **MISSING** | Not imported or called in `getAuditEvents`. |

---

## Findings

### BL-01 — Wrong Role Enforced: `admin` instead of `dentist_owner`

**File:** `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts:21`
**BLOCKER** — Spec (MODULE_SPEC §6, API_CONTRACTS auth field) requires `dentist_owner`. Handler checks for `admin` role. Any staff member with the legacy `admin` role gains access; `dentist_owner` is denied. Wrong role means AC-AUD-003 is broken by design.

**Fix:**
```typescript
if (!roles.includes('dentist_owner')) {
  throw new ForbiddenError('dentist_owner role required to access audit log');
}
```

---

### BL-02 — `branch_id` Not Required; No `assertBranchAccess` Guard

**File:** `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts:30`
**BLOCKER** — API_CONTRACTS marks `branch_id` as required (YES) and spec AC-AUD-003 requires branch-scoped responses. Currently `branchId` is optional; when omitted the query returns all branches. `assertBranchAccess` from dental-org is never called. A `dentist_owner` (if role were correct) could read cross-branch data.

**Fix:**
```typescript
const branchId = ctx.req.query('branchId');
if (!branchId) throw new ValidationError('branch_id is required', 'VALIDATION_ERROR');
await assertBranchAccess(ctx, branchId); // import from dental-org
```

---

### BL-03 — No 405 Routes for PATCH/PUT/DELETE on Audit Events

**File:** `services/api-ts/src/app.ts` (no routes registered)
**BLOCKER** — API_CONTRACTS §PATCH/DELETE/PUT specifies `405 AUDIT_EVENT_IMMUTABLE`. No such routes exist. AC-AUD-002 is unmet. The global 405 handler returns `METHOD_NOT_ALLOWED` (a generic fallback), not `AUDIT_EVENT_IMMUTABLE`. This is functionally different from a spec-declared explicit rejection.

**Fix:** Register explicit routes:
```typescript
app.on(['PATCH', 'PUT', 'DELETE'], '/dental/audit-events/:id', (c) => {
  return c.json({ code: 'AUDIT_EVENT_IMMUTABLE', message: 'Audit events cannot be modified or deleted' }, 405);
});
```

---

### BL-04 — Audit Writes Are Synchronous, Not Async via pg-boss

**File:** `services/api-ts/src/core/audit-logger.ts:25–69`
**BLOCKER** — MODULE_SPEC §14 and API_CONTRACTS Write Contract require writes via pg-boss async queue. `logAuditEvent` writes synchronously inline using `await`. This blocks the request path (violating the AC-AUD-001 "never block main request" comment in the file itself), defeats the pg-boss dependency declared in the spec, and means any DB write failure in audit can affect the caller despite the try/catch (latency still blocks). The spec states: "never block the main request path."

**Fix:** Enqueue via pg-boss job:
```typescript
export async function logAuditEvent(
  jobs: JobScheduler,
  event: AuditEvent,
): Promise<void> {
  await jobs.send('dental.audit.write', event); // non-blocking enqueue
}
// Worker in handlers/audit/jobs registers 'dental.audit.write' handler
```

---

### WR-01 — Query Param Names Diverge from API Contract

**File:** `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts:28–44`
**WARNING** — Contract declares `event_type`, `aggregate_type`, `aggregate_id` as query params. Handler accepts none of these. Schema also lacks `aggregate_type`/`aggregate_id`/`event_type` columns. The contract shape is entirely unimplemented on these fields; clients following the contract spec will get no filtering on these dimensions.

**Fix:** Add `event_type`, `aggregate_type`, `aggregate_id` columns to `audit-log.schema.ts` and wire them in `getAuditEvents` and `AuditLogRepository.list()`.

---

### WR-02 — Pagination Params and Date Params Use Non-Contract Names

**File:** `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts:34–37`
**WARNING** — Contract specifies `date_from`/`date_to`, `page`/`per_page` (default 20, max 100). Handler uses `from`/`to`, `limit`/`offset` (default 50, max 200). No aliasing. SDK and frontend code generated from the contract will send the wrong param names and get unfiltered/wrong-paged results silently.

---

### WR-03 — Retention Job Does Not Cover `dental_audit_log` Table

**File:** `services/api-ts/src/handlers/audit/jobs/index.ts:19`
**WARNING** — HIPAA 7-year retention (MODULE_SPEC §5) must apply to `dental_audit_log`. The retention job imports from `../repos/audit.repo` which operates on `audit_log_entry` (base platform table). `dental_audit_log` has no retention enforcement, no `retention_status` column, and is never touched by the job. HIPAA-mandated purge policy is unmet for the primary dental audit table.

**Fix:** Add `retention_status` column to `dental_audit_log` schema; extend job to also process `dental_audit_log` rows.

---

### IN-01 — `reason` and JSONB `metadata` Are Open PHI Vectors

**File:** `services/api-ts/src/handlers/dental-audit/repos/audit-log.schema.ts:14,15,16`
**INFO** — Schema exposes `reason text`, `beforeSnapshot jsonb`, `afterSnapshot jsonb`. No runtime sanitization exists. Callers in dental-visit pass full objects as `before`/`after`. G-005 gap (named in spec §5) is acknowledged but no guard prevents PHI from entering `reason` or snapshot fields. Recommend schema-level or shim-level field allowlist validation before these are written.

---

### IN-02 — Missing `audit_events_written_total` Metric

**File:** `services/api-ts/src/core/audit-logger.ts`
**INFO** — MODULE_SPEC §17 declares `audit_events_written_total` counter by `event_type`. No metrics emission exists in `logAuditEvent` or in `AuditLogRepository.insert()`. Observability requirement is unmet.

**Fix:** Increment Prometheus counter after successful insert:
```typescript
import { metrics } from '@/core/metrics';
metrics.auditEventsWrittenTotal.inc({ event_type: event.action });
```

---

## Summary

4 BLOCKERs, 3 WARNINGs, 2 INFO items.

Critical compliance gaps:
- Role enforcement is wrong (`admin` vs `dentist_owner`)
- Branch-scoping is entirely optional/unenforced (AC-AUD-003 broken)
- 405 AUDIT_EVENT_IMMUTABLE routes absent (AC-AUD-002 broken)
- Audit writes are synchronous inline, not pg-boss async

The `dental_audit_log` table exists and is wired into `logAuditEvent`, but the viewer endpoint does not satisfy its own contract on auth, required params, response shape, or error codes. The retention/purge job silently misses this table entirely.

_Reviewer: oli-enforce-file | 2026-05-27_
