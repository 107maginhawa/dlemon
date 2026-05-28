# dental-audit — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary
- Findings: 19 (P0: 6, P1: 6, P2: 4, P3: 3)
- Service-Layer Pattern: ABSENT (no `.service.ts`; repos present but instantiated inline, not injected)
- Compliance Score: 28/100

**Source directory:** `services/api-ts/src/handlers/dental-audit/`
**Shared with:** `services/api-ts/src/handlers/audit/` (base platform audit repo/schema/facade)

---

## Findings

| ID | Severity | Description | File | Line | Spec Ref |
|----|----------|-------------|------|------|---------|
| EM-AUD-001 | P0 | Wrong auth role — `admin` enforced, `dentist_owner` cannot access audit log | `getAuditEvents.ts` | 22 | API_CONTRACTS §Auth, MODULE_SPEC §6 |
| EM-AUD-002 | P0 | No branch ownership guard — any admin can read any branch's audit data | `getAuditEvents.ts` | 34 | AC-AUD-003, MODULE_SPEC §14 |
| EM-AUD-003 | P0 | PHI leak — `displayName` (staff name) written into audit details | `DentalMembershipManagement_verifyPin.ts` | ~67 | AC-AUD-004, MODULE_SPEC §5 G-005 |
| EM-AUD-004 | P0 | `listAuditLogs` writes audit event on every audit query — recursion violation | `audit/listAuditLogs.ts` | 82-101 | MODULE_SPEC §17 |
| EM-AUD-005 | P0 | `setPin` writes no audit event — security-sensitive mutation unaudited | `DentalMembershipManagement_setPin.ts` | — | AUD-BR-001, AUD-BR-004 |
| EM-AUD-006 | P0 | No 405 routes registered — AC-AUD-002 (append-only) not enforced at HTTP level | `app.ts` | 193 | AC-AUD-002, API_CONTRACTS §PATCH/DELETE/PUT |
| EM-AUD-007 | P1 | WF-096 pg-boss consumer absent — async write path entirely unimplemented | missing | — | MODULE_SPEC §3 WF-096, §10b DE-001..024, AC-AUD-001 |
| EM-AUD-008 | P1 | ~28 write handlers across modules missing `logAuditEvent` calls | multiple | — | AUD-BR-001, AUD-BR-002 |
| EM-AUD-009 | P1 | `dental_audit_log` schema missing 5 required fields from §7 | `repos/audit-log.schema.ts` | — | MODULE_SPEC §7 |
| EM-AUD-010 | P1 | `metadata` field silently dropped in `dental_audit_log` writes | `audit-log.schema.ts` | — | API_CONTRACTS §response |
| EM-AUD-011 | P1 | No `INVALID_DATE_RANGE` (422) validation on date params | `getAuditEvents.ts` | 40-41 | API_CONTRACTS §ERRORS |
| EM-AUD-012 | P1 | **F2: Repo instantiated inline per-call, no DI** — `new AuditLogRepository(db)` in handler and consumer | `getAuditEvents.ts`, `consumers/domain-events.consumer.ts` | 45, 30 | F2 DI pattern |
| EM-AUD-013 | P2 | Query param names diverge from spec — camelCase vs spec's snake_case; `limit/offset` vs `page/per_page` | `getAuditEvents.ts` | 29-43 | API_CONTRACTS §query-params |
| EM-AUD-014 | P2 | No HTTP-level test for `getAuditEvents` — auth, branch-scope, pagination all untested at route level | `audit.test.ts` | — | VERTICAL_TDD protocol |
| EM-AUD-015 | P2 | `NaN` not guarded on `limit`/`offset` — malformed input causes DB 500 error | `getAuditEvents.ts` | 42-43 | API hygiene |
| EM-AUD-016 | P2 | **F2: Facade creates repo per-call, no singleton** — `new AuditRepository(db, logger)` on every `logAuditEvent` invocation | `audit/repos/audit.facade.ts` | 15 | F2 DI pattern |
| EM-AUD-017 | P3 | AC-AUD-003 test label implies HTTP coverage it does not provide (repo-level only) | `audit.test.ts` | ~178 | TEST labeling |
| EM-AUD-018 | P3 | Two parallel audit tables (`dental_audit` + `dental_audit_log`) create ambiguity and maintenance burden | schema files | — | MODULE_SPEC §7 |
| EM-AUD-019 | P3 | Stale "TRUE RED" comments and `as any` casts in wiring test | `dental-audit-wiring.test.ts` | ~83 | code hygiene |

---

## F2: Service-Layer/DI Assessment

### Pattern Verdict: ABSENT

The dental-audit module has **no `.service.ts` file**. The architecture is: Handler → Repository (direct). There is no service layer between handler and repo.

### Evidence

**1. Handler instantiates repo inline (not injected)**

```typescript
// getAuditEvents.ts:45
const repo = new AuditLogRepository(db);
const { entries, total } = await repo.list(...)
```

`AuditLogRepository` is constructed inside the request handler body on every call. `db` is pulled from context via `ctx.get('database')` and passed directly to the constructor. There is no service wrapper, no singleton, and no injectable seam.

**2. Consumer instantiates repo inline**

```typescript
// consumers/domain-events.consumer.ts:30
const repo = new AuditLogRepository(db);
// ... used inside job callback
```

Same pattern: repo constructed inline within the job-registration closure. `db` is closed over from the outer `registerAuditDomainEventConsumer(scheduler, db)` call — this is the closest thing to injection, but at the repo level, not service level.

**3. Facade creates repo per-call (no singleton)**

```typescript
// audit/repos/audit.facade.ts:15
const repo = new AuditRepository(db, logger);
return repo.logEvent(request, createdBy);
```

The base platform facade (`logAuditEvent`) is a thin function that constructs `AuditRepository` on every invocation. This is not DI — it is a factory pattern without a container. Callers pass `db` explicitly; the repo is never shared or injected.

**4. No `.service.ts` files exist**

```
services/api-ts/src/handlers/dental-audit/
├── audit.test.ts
├── consumers/domain-events.consumer.ts
├── getAuditEvents.ts          ← handler
└── repos/
    ├── audit-log.repo.ts      ← repository
    └── audit-log.schema.ts
```

The Handler → Repo boundary exists (EM-AUD-009 finding: repo is present and encapsulates DB queries). However, there is no service layer. Business logic (auth checks, branch-scope enforcement, pagination capping) lives directly in `getAuditEvents.ts` rather than in a service that could be unit-tested independently.

### What's Present vs Missing

| Layer | Present | Notes |
|-------|---------|-------|
| Repository (`.repo.ts`) | YES | `AuditLogRepository`, `AuditRepository` both exist; DB queries properly encapsulated |
| Schema (`.schema.ts`) | YES | `dental_audit_log` table defined |
| Facade (`.facade.ts`) | YES (base platform only) | `logAuditEvent` wraps `AuditRepository`; no dental-specific facade |
| Service (`.service.ts`) | NO | Absent entirely |
| DI / injection | NO | Repos instantiated `new X(db)` inline at call sites |
| Handler thinness | PARTIAL | No raw DB calls in handler body; delegates to repo. But business rules (auth, branch guard, pagination) remain in handler |

### F2 Findings Summary

**EM-AUD-012 (P1):** `getAuditEvents.ts` and `domain-events.consumer.ts` both do `new AuditLogRepository(db)` inline. This blocks testability — tests must provide a full `DatabaseInstance`; there is no way to inject a mock repo. Per project F2 target: repos should be injected, not constructed inline.

**EM-AUD-016 (P2):** The base platform facade (`audit.facade.ts`) reconstructs `AuditRepository` on every `logAuditEvent` call. This is a per-request object allocation with no reuse. Low performance impact for an audit module, but signals the pattern: the codebase has no DI container and no factory/provider layer.

### Recommended F2 Remediation

1. **Introduce `AuditLogService`** at `services/api-ts/src/handlers/dental-audit/audit-log.service.ts`:
   - Constructor receives `AuditLogRepository` (injected, not constructed)
   - Encapsulates: auth validation, branch-scope resolution, date validation, pagination normalization
   - `getAuditEvents.ts` becomes a thin adapter: extract params → call service → return JSON

2. **Wire via factory or context** (matching existing pattern in other modules):
   ```typescript
   // audit-log.service.ts
   export class AuditLogService {
     constructor(private repo: AuditLogRepository) {}
     async listForBranch(userId: string, filters: AuditFilters): Promise<PaginatedResult> { ... }
   }
   // getAuditEvents.ts
   const repo = new AuditLogRepository(db);   // or injected
   const svc  = new AuditLogService(repo);
   return svc.listForBranch(user.id, filters);
   ```

3. **Facade refactor** (lower priority): `logAuditEvent` could accept a pre-built `AuditRepository` to avoid per-call construction.

---

## Coverage Matrix

| Spec Item | Status | Finding |
|-----------|--------|---------|
| §3 WF-028 — View audit log endpoint | BROKEN | Wrong auth role, no branch guard (EM-AUD-001, EM-AUD-002) |
| §3 WF-096 — Async pg-boss write consumer | NOT IMPLEMENTED | Entirely absent (EM-AUD-007) |
| §5 Business rules — append-only | PARTIAL | No 405 routes (EM-AUD-006) |
| §5 7-year retention | NOT IMPLEMENTED | `retention_status` absent from schema (EM-AUD-009) |
| §5 G-005 — no PHI in log body | VIOLATED | `displayName` in verifyPin details (EM-AUD-003) |
| §6 Permissions — dentist_owner read | BROKEN | `admin` role enforced instead (EM-AUD-001) |
| §6 Permissions — system write only | PARTIAL | setPin unaudited; ~28 handlers missing (EM-AUD-005, EM-AUD-008) |
| §7 Data requirements — 12 fields | PARTIAL | 5 fields absent (EM-AUD-009) |
| §10 API GET /dental/audit-events | PARTIAL | Wrong path, wrong auth, no branch guard, param divergence |
| §10b Domain events DE-001..024 | NOT IMPLEMENTED | No consumer (EM-AUD-007) |
| §11 AC-AUD-001 — write within 5s | PARTIAL | Sync inline only, not async pg-boss (EM-AUD-007) |
| §11 AC-AUD-002 — 405 on mutations | NOT IMPLEMENTED | No routes registered (EM-AUD-006) |
| §11 AC-AUD-003 — branch-scoped read | NOT ENFORCED | No branch ownership check (EM-AUD-002) |
| §11 AC-AUD-004 — no PHI | VIOLATED | displayName present (EM-AUD-003) |
| §17 Observability — no self-audit | VIOLATED | listAuditLogs logs itself (EM-AUD-004) |
| F2 Service-Layer pattern | ABSENT | No `.service.ts`, repos inline (EM-AUD-012, EM-AUD-016) |

---

## Readiness Rating

**RED** — 6 P0 security/compliance violations active; viewer endpoint broken for its declared audience; PHI actively written to audit log; append-only contract not enforced at HTTP level. F2 pattern absent throughout.

---

_Reviewed: 2026-05-28_
_Run: run-5-f2-service-layer-di_
_Reviewer: Claude (oli-enforce-module, adversarial)_
_Depth: deep_
