# dental-audit — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-6-strict-2026-05-29 | mode: --strict -->

## Summary
- Findings: 16 (P0: 2, P1: 7, P2: 4, P3: 3)
- Service-Layer Pattern: ABSENT (no `.service.ts`; repos present but instantiated inline, not injected)
- Compliance Score: 0/100 (capped; formula yields -1 before cap)
- Resolved since run-5: 5 findings (EM-AUD-001, EM-AUD-003, EM-AUD-004, EM-AUD-007, and EM-AUD-002 partially)
- Net new findings: 1 (EM-AUD-020 — DE queue coverage gap)

**Source directory:** `services/api-ts/src/handlers/dental-audit/`
**Shared with:** `services/api-ts/src/handlers/audit/` (base platform audit repo/schema/facade)

---

## Resolved Findings (vs run-5)

| Prior ID | Resolution | Evidence |
|----------|-----------|---------|
| EM-AUD-001 | RESOLVED | `getAuditEvents.ts:22` now enforces `dentist_owner` role (was `admin`) |
| EM-AUD-002 | PARTIAL → re-filed as P1 | `assertBranchAccess` added but only fires when `branchId` query param present; spec lists `branch_id` as first (non-optional) param |
| EM-AUD-003 | RESOLVED | `DentalMembershipManagement_verifyPin.ts` no longer writes `displayName`; audit details contain only `memberId` UUID |
| EM-AUD-004 | RESOLVED | `getAuditEvents` does NOT write audit events (spec §17: "Audit module itself does NOT write audit events") |
| EM-AUD-007 | RESOLVED | `registerAuditDomainEventConsumer` registered in `app.ts`; consumer file exists at `consumers/domain-events.consumer.ts` |

---

## Active Findings

| ID | Sev | Status | Description | File | Line | Spec Ref |
|----|-----|--------|-------------|------|------|---------|
| EM-AUD-005 | P0 | KNOWN | `setPin` writes no audit event — security-sensitive mutation unaudited | `dental-org/DentalMembershipManagement_setPin.ts` | — | AUD-BR-001, AUD-BR-004 |
| EM-AUD-006 | P0 | KNOWN | No 405 routes registered — AC-AUD-002 (append-only) not enforced at HTTP level | `app.ts` | — | AC-AUD-002, MODULE_SPEC §5 |
| EM-AUD-002 | P1 | KNOWN (downgraded P0→P1) | `branchId` is optional in handler; spec §10 lists `branch_id` as first required param; unscoped queries return all branches | `getAuditEvents.ts` | 31,34 | AC-AUD-003, MODULE_SPEC §10 |
| EM-AUD-008 | P1 | KNOWN | ~28 write handlers across modules have no `logAuditEvent` / `publishAuditEvent` call | multiple | — | AUD-BR-001, AUD-BR-002, AC-AUD-001 |
| EM-AUD-009 | P1 | KNOWN | `dental_audit_log` schema missing required fields: `category`, `event_type`, `outcome`, `ip_address`, `resource_id`, `retention_status` | `repos/audit-log.schema.ts` | — | MODULE_SPEC §7 |
| EM-AUD-010 | P1 | KNOWN | `metadata` field absent from `dental_audit_log` schema and repo — silently dropped on write | `repos/audit-log.schema.ts`, `audit-log.repo.ts` | — | API_CONTRACTS §response |
| EM-AUD-011 | P1 | KNOWN | No `INVALID_DATE_RANGE` (422) validation on `from`/`to` params — invalid dates silently accepted | `getAuditEvents.ts` | 40-41 | API_CONTRACTS §ERRORS |
| EM-AUD-012 | P1 | KNOWN | F2: `AuditLogRepository` instantiated `new X(db)` inline in both handler and consumer; no DI seam | `getAuditEvents.ts:45`, `consumers/domain-events.consumer.ts:30` | 45, 30 | F2 DI pattern |
| EM-AUD-020 | P1 | NEW | Single generic queue `dental.audit.domain-events` used for ALL events; spec requires DE-001 through DE-024 to be consumed individually. No per-event queue name mapping exists — no way to verify all 24 event types actually flow through. | `consumers/domain-events.consumer.ts` | 5 | MODULE_SPEC §10b |
| EM-AUD-013 | P2 | KNOWN | API path `/dental/admin/audit` in app.ts vs spec's `/dental/audit-events`; params are camelCase (`actorId`) vs spec snake_case (`actor_id`); pagination uses `limit/offset` vs spec's `page` | `app.ts`, `getAuditEvents.ts` | — | MODULE_SPEC §10, API_CONTRACTS §query-params |
| EM-AUD-014 | P2 | KNOWN | No HTTP-level tests for `getAuditEvents` — auth, branch-scope, and pagination all untested at route level (repo-level tests exist only) | `audit.test.ts` | — | VERTICAL_TDD §AUD-S2 |
| EM-AUD-015 | P2 | KNOWN | `NaN` not guarded: `Number(ctx.req.query('limit') ?? 50)` → `NaN` when `limit=abc`; causes DB query with `NaN` limit | `getAuditEvents.ts` | 42-43 | API hygiene |
| EM-AUD-016 | P2 | KNOWN | F2: Base facade `logAuditEvent` creates `new AuditRepository(db, logger)` on every invocation — no singleton | `audit/repos/audit.facade.ts` | 15 | F2 DI pattern |
| EM-AUD-017 | P3 | KNOWN | AC-AUD-003 test label implies HTTP coverage it does not provide (repo-level only) | `audit.test.ts` | ~178 | TEST labeling |
| EM-AUD-018 | P3 | KNOWN | Two parallel audit tables (`dental_audit` via legacy + `dental_audit_log` spec-compliant) create maintenance ambiguity | schema files | — | MODULE_SPEC §7 |
| EM-AUD-019 | P3 | KNOWN | Stale "TRUE RED" comments and `as any` casts in wiring test | `dental-audit-wiring.test.ts` | ~83 | code hygiene |

---

## Strict Compliance Checks (dental-audit critical module)

| Strict Check | Status | Notes |
|---|---|---|
| pg-boss consumer registered for ALL 24 DE events | PARTIAL | Single queue `dental.audit.domain-events`; one consumer handles all event types generically. Spec says "DE-001 through DE-024 → each writes one audit event." Individual event routing not verifiable without per-event queue mapping. |
| 7-year retention enforcement | NOT IMPLEMENTED | `retention_status` field absent from `dental_audit_log` schema (EM-AUD-009). Base platform `audit_log_entry` has the field but dental-audit's own table does not. |
| Audit log query endpoint at GET /dental/audit-events | PARTIAL | Route registered as `/dental/admin/audit` (wrong path), path param `branch_id` is optional not required, query params camelCase not snake_case (EM-AUD-013). |
| Self-audit prevention: viewing audit log does NOT create audit event | PASS | `getAuditEvents` contains no `logAuditEvent` or `publishAuditEvent` calls. Spec §17 explicitly requires this. |

---

## F2: Service-Layer/DI Assessment

### Pattern Verdict: ABSENT (unchanged from run-5)

No `.service.ts` file exists. Architecture is Handler → Repository (direct). Business logic (auth checks, branch-scope enforcement, pagination capping, date parsing) lives in `getAuditEvents.ts` rather than a testable service.

### File Structure

```
services/api-ts/src/handlers/dental-audit/
├── audit.test.ts                          ← repo-level tests only
├── consumers/
│   └── domain-events.consumer.ts          ← registered in app.ts ✓
├── getAuditEvents.ts                      ← handler (contains business logic)
└── repos/
    ├── audit-log.repo.ts                  ← encapsulates DB queries ✓
    └── audit-log.schema.ts                ← schema (missing 6 fields)
```

### Layer Status

| Layer | Present | Notes |
|-------|---------|-------|
| Repository (`.repo.ts`) | YES | `AuditLogRepository` encapsulates DB queries |
| Schema (`.schema.ts`) | PARTIAL | Table defined; 6 spec-required fields missing |
| Consumer | YES | `registerAuditDomainEventConsumer` registered in `app.ts` |
| Service (`.service.ts`) | NO | Absent entirely |
| DI / injection | NO | Repos instantiated `new X(db)` inline at call sites |
| Handler thinness | PARTIAL | Delegates to repo but retains business logic |

---

## Coverage Matrix

| Spec Item | Status | Finding(s) |
|-----------|--------|-----------|
| §1 Module Overview | PASS | Purpose, users, scope reflected in handler structure |
| §2 Domain Terms — AuditEvent, EventType, Retention | PARTIAL | Terms used; `EventType` not typed (free-text `action`), `retention` field absent |
| §3 WF-028 — View audit log | PARTIAL | Endpoint exists; wrong path, branchId optional (EM-AUD-013, EM-AUD-002) |
| §3 WF-096 — Async pg-boss write consumer | PARTIAL | Consumer registered; single queue (EM-AUD-020) |
| §5 Business rule — append-only | PARTIAL | No UPDATE/DELETE in repo ✓; no 405 HTTP routes (EM-AUD-006) |
| §5 Business rule — 7-year retention | NOT IMPLEMENTED | `retention_status` absent from schema (EM-AUD-009) |
| §5 Business rule — no PHI | PASS | No PHI in audit fields (verifyPin fixed); G-005 note in spec acknowledged |
| §6 Permissions — dentist_owner read | PASS | `dentist_owner` role enforced in handler |
| §6 Permissions — system write only | PARTIAL | ~28 handlers missing audit calls (EM-AUD-008); setPin unaudited (EM-AUD-005) |
| §7 Data requirements — 12 fields | PARTIAL | 6 fields absent: category, event_type, outcome, ip_address, resource_id, retention_status (EM-AUD-009) |
| §7 Data requirements — metadata | NOT IMPLEMENTED | `metadata` absent from schema (EM-AUD-010) |
| §7b Aggregate Boundaries | PARTIAL | Root/nested structure ok; two tables exist (EM-AUD-018) |
| §8 State Transitions | N/A | No FSM; append-only |
| §9 UI/UX | N/A | Frontend spec not in scope of this handler audit |
| §10 API GET /dental/audit-events | PARTIAL | Wrong path, optional branchId, camelCase params (EM-AUD-013) |
| §10b Domain Events DE-001–024 | PARTIAL | One generic queue; no individual DE-NNN mapping (EM-AUD-020) |
| §11 AC-AUD-001 — write within 5s | PARTIAL | pg-boss async path exists; 28 modules not wired (EM-AUD-008) |
| §11 AC-AUD-002 — 405 on mutations | NOT IMPLEMENTED | No 405 routes (EM-AUD-006) |
| §11 AC-AUD-003 — branch-scoped read | PARTIAL | assertBranchAccess present but only when branchId provided (EM-AUD-002) |
| §11 AC-AUD-004 — no PHI | PASS | displayName removed; only UUIDs in audit fields |
| §12 Test Coverage | PARTIAL | Repo-level tests good; no HTTP-level tests (EM-AUD-014) |
| §13 Edge Cases | PARTIAL | NaN unguarded (EM-AUD-015); no invalid date handling (EM-AUD-011) |
| §14 Dependencies | PASS | assertBranchAccess imported from dental-org; no boundary violations |
| §15 Error Handling | PARTIAL | UnauthorizedError + ForbiddenError mapped correctly; no 422 for bad dates |
| §16 Performance | PARTIAL | 4 indices on `dental_audit_log` ✓; count query uses full-table scan (N+1 risk on large tables) |
| §17 Observability | PASS | No self-audit ✓; structured logger available in handler |
| §18 Feature Flags | N/A | No feature flags referenced in spec |
| §19 Vertical Slice Plan — AUD-S1 | PARTIAL | Consumer registered; single queue gap (EM-AUD-020) |
| §19 Vertical Slice Plan — AUD-S2 | PARTIAL | Endpoint exists; path/param divergence (EM-AUD-013) |
| §19 Vertical Slice Plan — AUD-S3 | PASS | G-005 PHI removed from verifyPin audit |
| §20 AI Instructions | PARTIAL | Rule 1 (no PHI) ✓; Rule 2 (async) ✓; Rule 3 (no PATCH/PUT/DELETE) NOT ENFORCED (EM-AUD-006); Rule 4 (paginate) ✓ |

---

## Score Calculation

| Category | Count | Deduction | Total |
|----------|-------|-----------|-------|
| P0 findings | 2 | ×15 | -30 |
| P1 findings | 7 | ×8 | -56 |
| P2 findings | 4 | ×3 | -12 |
| P3 findings | 3 | ×1 | -3 |
| Absent required sections | 0 | ×8 | 0 |
| Stub sections | 0 | ×4 | 0 |
| **Raw** | | | **-1** |
| **Score (floor 0)** | | | **0/100** |

---

## Readiness Rating

**RED (NOT_READY)** — 2 active P0 compliance violations; 7 P1 functional gaps including missing schema fields, incomplete event coverage, and no 405 enforcement. Module score 0/100.

Top P0s requiring immediate fix before v1 ship:
1. **EM-AUD-005** — `setPin` (security mutation) writes no audit event
2. **EM-AUD-006** — No 405 routes; `DELETE /dental/admin/audit/:id` succeeds (or returns 404 from routing, not 405 from policy)

Top P1s for compliance gate:
1. **EM-AUD-009** — `retention_status` (HIPAA 7-year) absent from schema
2. **EM-AUD-020** — 24 DE events not individually mapped through consumer
3. **EM-AUD-008** — ~28 write handlers produce no audit events

---

_Reviewed: 2026-05-29_
_Run: run-6-strict-2026-05-29_
_Reviewer: Claude (oli-enforce-module --strict, adversarial)_
_Depth: deep_
_Baseline: run-5 (2026-05-28) — score 28, P0:6, P1:6_
