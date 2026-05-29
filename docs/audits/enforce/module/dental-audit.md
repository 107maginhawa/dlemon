# dental-audit — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-7-2026-05-29 | mode: standard -->

## Summary
- Findings: 14 (P0: 1, P1: 7, P2: 3, P3: 3)
- Service-Layer Pattern: ABSENT (no `.service.ts`; repos present but instantiated inline, not injected)
- Compliance Score: 9/100
- Resolved since run-6: 3 findings (EM-AUD-005 partial→full P1, EM-AUD-006 RESOLVED, EM-AUD-019 RESOLVED — wiring test file deleted)
- Net new findings: 1 (EM-AUD-021 — inet import without field; Wave3 incomplete schema fix)

**Source directory:** `services/api-ts/src/handlers/dental-audit/`
**Shared with:** `services/api-ts/src/handlers/audit/` (base platform audit repo/schema/facade)

---

## Wave3 Sprint Verification (run-7 vs run-6)

| Prior ID | Run-6 Status | Wave3 Claim | Run-7 Verdict | Evidence |
|----------|-------------|-------------|---------------|---------|
| EM-AUD-005 | P0 KNOWN | FIXED — setPin now writes audit | PARTIAL → downgrade to P1 | setPin calls `logAuditEvent` from platform audit facade (writes to `audit_log_entries`, NOT `dental_audit_log`). Event invisible in dental audit viewer endpoint. |
| EM-AUD-006 | P0 KNOWN | FIXED — 405 routes registered | RESOLVED | `app.ts:201-209` registers DELETE/PUT/PATCH → 405; `audit-append-only.test.ts` verifies contract |
| EM-AUD-019 | P3 KNOWN | (implicit) | RESOLVED | `dental-audit-wiring.test.ts` no longer exists |
| EM-AUD-021 | N/A | N/A | NEW P2 | `audit-log.schema.ts` diff shows `inet` added to import but no `ip_address` column added to table — incomplete Wave3 fix attempt |

**Wave3 net result for dental-audit: 1 P0 resolved, 1 P0 downgraded to P1. 13 findings remain open.**

---

## Active Findings

| ID | Sev | Status | Description | File | Line | Spec Ref |
|----|-----|--------|-------------|------|------|---------|
| EM-AUD-001 | P0 | NEW (re-opened) | Route `/dental/admin/audit` uses `authMiddleware({ roles: ['admin'] })` — requires platform admin system role. Dentist-owners have system role `user` + context role `dentist_owner` (from `member_role` enum). They cannot pass the middleware check and never reach the handler's `dentist_owner` validation. Spec §6 explicitly grants READ to `dentist_owner`. | `app.ts` | 196-199 | MODULE_SPEC §6, AC-AUD-003 |
| EM-AUD-002 | P1 | KNOWN | `branchId` is optional query param in handler; `assertBranchAccess` only fires when `branchId` is provided. A dentist_owner who omits `branchId` receives all branches' audit events, violating branch-scoped isolation. Spec §10 lists `branch_id` as first (implicit required) param; AC-AUD-003 mandates branch-scope enforcement unconditionally. | `getAuditEvents.ts` | 31, 34 | AC-AUD-003, MODULE_SPEC §10 |
| EM-AUD-005 | P1 | DOWNGRADED (was P0) | `setPin` calls `logAuditEvent` from the **platform** audit facade (`@/handlers/audit/repos/audit.facade`), which writes to `audit_log_entries` (base platform table) — not to `dental_audit_log`. Security-sensitive setPin events are invisible in the dental audit viewer endpoint (`GET /dental/admin/audit`). Should call `logAuditEvent` from `@/core/audit-logger` (which dual-writes to `dental_audit_log`). | `dental-org/DentalMembershipManagement_setPin.ts` | 7, 51 | AUD-BR-001, AC-AUD-001 |
| EM-AUD-008 | P1 | KNOWN | ~28 write handlers across modules lack `logAuditEvent`/`publishAuditEvent` calls. Only a subset of modules wire into audit (dental-visit, dental-imaging, dental-patient read-path, dental-org). Large write surface (recalls, tasks, insurance, claims, contacts, sync logs, alerts, etc.) produces zero audit events. Violates AC-AUD-001 ("any write operation → audit event within 5s"). | multiple handlers | — | AUD-BR-001, AUD-BR-002, AC-AUD-001 |
| EM-AUD-009 | P1 | KNOWN | `dental_audit_log` schema missing 5 spec-required fields: `category` (enum), `event_type` (enum), `outcome` (enum), `ip_address`, `retention_status` (enum). Wave3 added `inet` to schema imports but did not add the `ip_address` column. Schema uses `targetType`/`targetId` instead of spec-named `resource_type`/`resource_id` (term drift). | `repos/audit-log.schema.ts` | — | MODULE_SPEC §7 |
| EM-AUD-010 | P1 | KNOWN | `metadata` field absent from `dental_audit_log` schema and repo. All metadata from `logAuditEvent` calls is silently dropped on write to `dental_audit_log`. | `repos/audit-log.schema.ts`, `audit-log.repo.ts` | — | API_CONTRACTS §response |
| EM-AUD-011 | P1 | KNOWN | No `INVALID_DATE_RANGE` (422) validation on `from`/`to` query params in `getAuditEvents`. `new Date(from)` returns `Invalid Date` silently; no NaN/invalid guard. Also `Number(ctx.req.query('limit') ?? 50)` returns `NaN` when `limit=abc` — passed directly to DB query. | `getAuditEvents.ts` | 40-43 | API hygiene |
| EM-AUD-012 | P1 | KNOWN | `AuditLogRepository` instantiated `new AuditLogRepository(db)` inline at handler call site and inside consumer. No DI seam — prevents mock injection in unit tests without import mocking. | `getAuditEvents.ts:45`, `consumers/domain-events.consumer.ts:30` | 45, 30 | F2 DI pattern |
| EM-AUD-020 | P1 | KNOWN | Single generic queue `dental.audit.domain-events` receives all events from all modules. Spec §10b requires DE-001 through DE-024 to each write one audit event. No per-event queue name mapping exists; no way to verify all 24 event types actually flow through. A dropped event of type DE-015 is indistinguishable from a never-published one. | `consumers/domain-events.consumer.ts` | 5 | MODULE_SPEC §10b |
| EM-AUD-013 | P2 | KNOWN | Route path mismatch: implemented as `GET /dental/admin/audit`, spec declares `GET /dental/audit-events`. Query params use camelCase (`actorId`, `branchId`) vs spec snake_case (`actor_id`, `branch_id`). Pagination uses `limit`/`offset` vs spec's `page`. | `app.ts:196`, `getAuditEvents.ts` | — | MODULE_SPEC §10 |
| EM-AUD-014 | P2 | KNOWN | No HTTP-level tests for `getAuditEvents` — auth enforcement, branch-scope, pagination, and 405 enforcement all untested at route level. `audit.test.ts` tests repository only; `audit-append-only.test.ts` builds a local Hono app (not the real app). | `audit.test.ts` | — | VERTICAL_TDD §AUD-S2 |
| EM-AUD-021 | P2 | NEW | Wave3 added `inet` to the `drizzle-orm/pg-core` import in `audit-log.schema.ts` but never added an `ip_address: inet('ip_address')` column. The import is dead code. Confirms the EM-AUD-009 ip_address field fix was started but not completed. | `repos/audit-log.schema.ts` | 1 | MODULE_SPEC §7 |
| EM-AUD-017 | P3 | KNOWN | `audit.test.ts` test labelled `AC-003: list() filters by branchId` implies HTTP-level coverage but only exercises the repository. Label is misleading — AC-AUD-003 requires branch-scope enforcement at the HTTP routing layer. | `audit.test.ts` | ~178 | TEST labeling |
| EM-AUD-018 | P3 | KNOWN | Two parallel audit tables: `dental_audit` (legacy, via `DentalAuditRepository`) and `dental_audit_log` (spec-compliant). `audit-logger.ts` dual-writes to both. `setPin` only writes to platform `audit_log_entries` via facade. Three separate audit destinations create maintenance ambiguity and inconsistent query surfaces. | multiple schema files | — | MODULE_SPEC §7 |
| EM-AUD-016 | P3 | KNOWN | Platform facade `logAuditEvent` in `audit/repos/audit.facade.ts:15` creates `new AuditRepository(db, logger)` on every invocation — no singleton or DI. Performance overhead on audit-heavy paths. | `audit/repos/audit.facade.ts` | 15 | F2 DI pattern |

---

## Critical Re-Opening: EM-AUD-001 (P0)

Run-6 marked EM-AUD-001 as RESOLVED based on `getAuditEvents.ts:22` checking `dentist_owner` in handler logic. This was incorrect. The route in `app.ts:197` applies `authMiddleware({ roles: ['admin'] })` BEFORE the handler is reached.

The `authMiddleware` implementation (`middleware/auth.ts`) checks `user.role` from the Better-Auth session against the required role strings. Per `ROLE_PERMISSION_MATRIX.md`:
- Platform `admin` system role → Platform Admin actor only
- `dentist_owner` → context role from `DentalMembership.member_role`, system role = `user`

A dentist_owner presents with `user` system role. `authMiddleware({ roles: ['admin'] })` will throw `ForbiddenError('Insufficient permissions')` before the handler's `dentist_owner` check at line 22 is ever executed.

**Impact:** The audit log viewer is functionally inaccessible to its intended audience (dentist_owner) and accessible only to platform admins. AC-AUD-003 cannot be satisfied.

**Fix:** Change `authMiddleware({ roles: ['admin'] })` to `authMiddleware({ roles: ['user'] })` and rely on the handler's `dentist_owner` role check.

---

## Strict Compliance Checks

| Strict Check | Status | Notes |
|---|---|---|
| GET /dental/audit-events accessible to dentist_owner | FAIL | Route locked to `['admin']` system role; dentist_owners blocked (EM-AUD-001 P0) |
| pg-boss consumer registered for all 24 DE events | PARTIAL | Single queue `dental.audit.domain-events`; generic consumer. No per-DE routing (EM-AUD-020) |
| 7-year retention enforcement | NOT IMPLEMENTED | `retention_status` field absent from `dental_audit_log` schema (EM-AUD-009) |
| Append-only 405 on mutations | PASS | DELETE/PUT/PATCH → 405 registered in `app.ts:201-209`; test coverage in `audit-append-only.test.ts` |
| No PHI in audit fields | PASS | No email/name fields; only UUID actor_id, resource_id. G-005 wave tracked |
| Self-audit prevention | PASS | `getAuditEvents` contains no `logAuditEvent` or `publishAuditEvent` calls |
| Branch-scoped read enforcement | FAIL | `assertBranchAccess` only fires when `branchId` param provided; omitting it returns all-branch data (EM-AUD-002) |

---

## F2: Service-Layer/DI Assessment

### Pattern Verdict: ABSENT (unchanged from run-6)

No `.service.ts` file. Architecture is Handler → Repository (direct). Business logic (auth checks, branch-scope enforcement, pagination capping, date parsing) resides in `getAuditEvents.ts` rather than a testable service.

### File Structure

```
services/api-ts/src/handlers/dental-audit/
├── audit-append-only.test.ts              ← 405 route tests (local Hono app, not real app) ✓
├── audit.test.ts                          ← repo-level tests only
├── consumers/
│   └── domain-events.consumer.ts          ← registered in app.ts ✓
├── getAuditEvents.ts                      ← handler (contains business logic)
└── repos/
    ├── audit-log.repo.ts                  ← encapsulates DB queries ✓
    └── audit-log.schema.ts                ← schema (missing 5 fields; inet imported but not used)
```

### Layer Status

| Layer | Present | Notes |
|-------|---------|-------|
| Repository (`.repo.ts`) | YES | `AuditLogRepository` encapsulates DB queries |
| Schema (`.schema.ts`) | PARTIAL | Table defined; 5 spec-required fields missing; dead `inet` import |
| Consumer | YES | `registerAuditDomainEventConsumer` registered in `app.ts` |
| Service (`.service.ts`) | NO | Absent entirely |
| DI / injection | NO | Repos instantiated `new X(db)` inline at call sites |
| Handler thinness | PARTIAL | Delegates to repo but retains business logic |
| Index.ts barrel export | NO | Missing — not blocking but inconsistent with other modules |

---

## Coverage Matrix

| Spec Item | Status | Finding(s) |
|-----------|--------|-----------|
| §1 Module Overview | PASS | Purpose, users, scope reflected in handler structure |
| §2 Domain Terms — AuditEvent, Retention | PARTIAL | `AuditEvent` used; no typed `EventType` enum (free-text `action`); `retention_status` absent |
| §3 WF-028 — View audit log | FAIL | Endpoint exists but inaccessible to dentist_owner (EM-AUD-001) |
| §3 WF-096 — Async pg-boss write consumer | PARTIAL | Consumer registered; single generic queue (EM-AUD-020) |
| §5 Business rule — append-only | PASS | 405 routes registered; no UPDATE/DELETE in repo |
| §5 Business rule — 7-year retention | NOT IMPLEMENTED | `retention_status` absent from schema (EM-AUD-009) |
| §5 Business rule — no PHI | PASS | No PHI in audit fields |
| §6 Permissions — dentist_owner read | FAIL | Route blocked by `authMiddleware(['admin'])` (EM-AUD-001) |
| §6 Permissions — system write only | PARTIAL | ~28 handlers missing audit calls (EM-AUD-008); setPin writes to platform table not dental_audit_log (EM-AUD-005) |
| §7 Data requirements — 12 fields | PARTIAL | 5 fields absent: category, event_type, outcome, ip_address, retention_status (EM-AUD-009) |
| §7 Data requirements — metadata | NOT IMPLEMENTED | `metadata` absent from schema (EM-AUD-010) |
| §7b Aggregate Boundaries | PARTIAL | Append-only enforced; three audit destinations (EM-AUD-018) |
| §8 State Transitions | N/A | No FSM; append-only |
| §10 API GET /dental/audit-events | FAIL | Wrong path, wrong auth, optional branchId, camelCase params (EM-AUD-001, EM-AUD-002, EM-AUD-013) |
| §10b Domain Events DE-001–024 | PARTIAL | Generic queue; no individual DE-NNN mapping (EM-AUD-020) |
| §11 AC-AUD-001 — write within 5s | PARTIAL | pg-boss path exists; ~28 handlers not wired (EM-AUD-008) |
| §11 AC-AUD-002 — 405 on mutations | PASS | DELETE/PUT/PATCH → 405 confirmed |
| §11 AC-AUD-003 — branch-scoped read | FAIL | Optional branchId + admin-locked route (EM-AUD-001, EM-AUD-002) |
| §11 AC-AUD-004 — no PHI | PASS | Only UUIDs in audit fields |
| §12 Test Coverage | PARTIAL | Repo-level tests good; 405 contract tested; no HTTP-level integration tests (EM-AUD-014) |
| §13 Edge Cases | PARTIAL | NaN unguarded; no date validation (EM-AUD-011) |
| §14 Dependencies | PASS | `assertBranchAccess` imported from shared; no boundary violations |
| §15 Error Handling | PARTIAL | UnauthorizedError + ForbiddenError mapped; no 422 for bad dates |
| §16 Performance | PARTIAL | 4 indices ✓; count via full-table scan (N+1 risk at scale) |
| §17 Observability | PASS | No self-audit ✓; structured logger available |
| §19 Vertical Slice Plan — AUD-S1 | PARTIAL | Consumer registered; single queue gap (EM-AUD-020) |
| §19 Vertical Slice Plan — AUD-S2 | FAIL | Endpoint inaccessible to dentist_owner (EM-AUD-001) |
| §19 Vertical Slice Plan — AUD-S3 | PASS | G-005 PHI removed from verifyPin audit |
| §20 AI Instructions | PARTIAL | Rule 1 (no PHI) ✓; Rule 2 (async) ✓; Rule 3 (no PATCH/PUT/DELETE) PASS; Rule 4 (paginate) ✓; Rule 5 (ARCHITECTURE.md) — dentist_owner access broken |

---

## Score Calculation

| Category | Count | Deduction | Total |
|----------|-------|-----------|-------|
| P0 findings | 1 | ×15 | -15 |
| P1 findings | 7 | ×8 | -56 |
| P2 findings | 3 | ×3 | -9 |
| P3 findings | 3 | ×1 | -3 |
| Absent required sections | 0 | ×8 | 0 |
| Stub sections | 0 | ×4 | 0 |
| **Raw** | | | **17** |
| **P0 cap applied (≥1 P0 → max 30)** | | | **min(17→cap disabled, use raw)** |
| **Score** | | | **9/100** |

> Scoring: base 100, deduct per finding weight. P0 presence caps at 30 max; raw score 17 falls below cap → use raw. Rounding: floor.

---

## Readiness Rating

**RED (NOT_READY)** — 1 active P0 (dentist_owner locked out of audit viewer), 7 P1 functional gaps.

**Top fix priority:**

1. **EM-AUD-001 (P0)** — Change `authMiddleware({ roles: ['admin'] })` to `authMiddleware({ roles: ['user'] })` at `app.ts:197`. The handler-level `dentist_owner` check is already in place; the route-level auth is the only blocker. One-line fix.

2. **EM-AUD-002 (P1)** — Require `branchId` param in `getAuditEvents`; return 400 if absent. Currently unscoped queries violate branch isolation.

3. **EM-AUD-005 (P1)** — Change `setPin`'s import from `@/handlers/audit/repos/audit.facade` to `@/core/audit-logger` so the event writes to `dental_audit_log` and appears in the dental audit viewer.

4. **EM-AUD-009 (P1)** — Complete the abandoned Wave3 schema fix: add `ip_address inet('ip_address')`, plus `category`, `event_type`, `outcome`, `retention_status` columns. Remove the dead `inet` import orphan.

5. **EM-AUD-008 (P1)** — Audit event wiring audit across all dental modules; ~28 write handlers produce no audit events.

---

_Reviewed: 2026-05-29_
_Run: run-7-2026-05-29_
_Reviewer: Claude (oli-enforce-module, adversarial)_
_Depth: deep_
_Baseline: run-6-strict-2026-05-29 — score 0/100 (capped), P0:2, P1:7, P2:4, P3:3_
_Wave3 sprint audit: 1 P0 resolved (EM-AUD-006), 1 P0 downgraded to P1 (EM-AUD-005), 1 P0 re-opened (EM-AUD-001 — was incorrectly marked RESOLVED in run-6)_
