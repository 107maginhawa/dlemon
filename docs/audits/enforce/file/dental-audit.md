<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-file -->
<!-- module: dental-audit | files-inspected: 6 | spec-artifacts: MODULE_SPEC, API_CONTRACTS, AUDIT_CONTRACTS, DOMAIN_MODEL, ERROR_TAXONOMY, WORKFLOW_MAP, ROLE_PERMISSION_MATRIX, MODULE_MAP -->

# Enforce-File Report — dental-audit

**Module:** dental-audit  
**Generated:** 2026-05-29  
**Source path:** `services/api-ts/src/handlers/dental-audit/`  
**Files inspected:** 6  
**Spec artifacts loaded:** MODULE_SPEC.md, API_CONTRACTS.md, AUDIT_CONTRACTS.md, DOMAIN_MODEL.md, ERROR_TAXONOMY.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md

---

## File Inventory & Classification

| # | File | Type (12-type table) | Specs Loaded |
|---|------|----------------------|--------------|
| 1 | `getAuditEvents.ts` | Handler/Controller | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 2 | `repos/audit-log.schema.ts` | Schema (*.schema.*) | DOMAIN_MODEL + MODULE_SPEC |
| 3 | `repos/audit-log.repo.ts` | Repository (*Repo*) | MODULE_SPEC + DOMAIN_MODEL |
| 4 | `consumers/domain-events.consumer.ts` | Service/UseCase (event consumer) | MODULE_SPEC + WORKFLOW_MAP |
| 5 | `audit-append-only.test.ts` | Test (*.test.*) | Mirror handler specs: MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 6 | `audit.test.ts` | Test (*.test.*) | Mirror repo specs: MODULE_SPEC + DOMAIN_MODEL |

**Total globbed files:** 6  
**Total classified:** 6 (complete coverage)

---

## Findings

### P1 Findings (Spec-declared gap — must fix before merge)

---

#### EF-AUD-001
**Severity:** P1  
**Confidence:** HIGH  
**Title:** Schema field names diverge from AUDIT_CONTRACTS.md canonical schema  
**File:** `repos/audit-log.schema.ts`  
**Lines:** 7–14  
**Spec Source:** AUDIT_CONTRACTS.md §2, API_CONTRACTS.md response table

**Description:**  
The `dental_audit_log` schema uses field names that do not match the canonical AuditEvent interface defined in AUDIT_CONTRACTS.md §2. The spec declares:

| Spec field | Schema field | Status |
|------------|-------------|--------|
| `event_type` | (missing) | MISSING |
| `actor_role` | (missing) | MISSING |
| `aggregate_type` | `targetType` | DRIFTED (non-spec term) |
| `aggregate_id` | `targetId` | DRIFTED (non-spec term) |
| `occurred_at` | `timestamp` | DRIFTED (non-spec name) |
| `ip_address` | (missing) | MISSING |
| `user_agent` | (missing) | MISSING |
| `metadata` | (missing) | MISSING |
| `action` | `action` | OK |
| `actor_id` | `actorId` | OK (column alias) |
| `branch_id` | `branchId` | OK (column alias) |

The columns `reason`, `beforeSnapshot`, `afterSnapshot` exist in the schema but are not part of the spec-declared AuditEvent interface. `event_type` (the domain event name, e.g. `VisitCompleted`) is entirely absent — instead the schema stores a raw `action` string (`visit.complete`), which is a different semantic.

AC-AUD-004 compliance note: The `beforeSnapshot`/`afterSnapshot` JSONB columns may carry PHI if not carefully governed — this is a latent risk.

---

#### EF-AUD-002
**Severity:** P1  
**Confidence:** HIGH  
**Title:** GET route path `/dental/admin/audit` does not match spec path `/api/v1/dental/audit-events`  
**File:** `getAuditEvents.ts`  
**Lines:** 2–3 (docstring); registered at `app.ts:196`  
**Spec Source:** API_CONTRACTS.md §Endpoints, AUDIT_CONTRACTS.md §5, MODULE_SPEC.md §10

**Description:**  
The handler docstring declares `GET /dental/admin/audit` and `app.ts` registers it at `/dental/admin/audit`. The spec (API_CONTRACTS.md, AUDIT_CONTRACTS.md §5, MODULE_SPEC.md §10) declares the endpoint as `GET /api/v1/dental/audit-events`. This is a contract-breaking path mismatch — any SDK or client generated from the OpenAPI spec will target the wrong path. The `sdk-ts` package will fail to resolve this endpoint.

---

#### EF-AUD-003
**Severity:** P1  
**Confidence:** HIGH  
**Title:** `branch_id` is REQUIRED per spec but only conditionally enforced in handler  
**File:** `getAuditEvents.ts`  
**Lines:** 31–35  
**Spec Source:** API_CONTRACTS.md (branch_id: Required=YES), AUDIT_CONTRACTS.md §5, AC-AUD-003

**Description:**  
API_CONTRACTS.md declares `branch_id` as `Required: YES` for `GET /api/v1/dental/audit-events`. AUDIT_CONTRACTS.md §5 confirms: "Branch scope — guards cross-branch access." AC-AUD-003 states: "Audit log viewer returns only events for requesting user's branch."

The handler makes `branch_id` optional — it only calls `assertBranchAccess` when `branchId` is provided (line 34: `if (branchId) { ... }`). When `branchId` is absent, no branch scope is applied and the query may return events across all branches. This violates AC-AUD-003 and the Required=YES constraint. The handler should return 422/VALIDATION_ERROR when `branch_id` is missing.

---

#### EF-AUD-004
**Severity:** P1  
**Confidence:** HIGH  
**Title:** Query param names use camelCase instead of spec-required snake_case; spec params `event_type`/`aggregate_type`/`aggregate_id`/`date_from`/`date_to`/`per_page` are absent  
**File:** `getAuditEvents.ts`  
**Lines:** 29–43  
**Spec Source:** API_CONTRACTS.md query params table

**Description:**  
The spec defines all query params in snake_case (`branch_id`, `actor_id`, `event_type`, `aggregate_type`, `aggregate_id`, `date_from`, `date_to`, `per_page`). The handler reads camelCase variants (`branchId`, `actorId`, `targetType`, `targetId`) which will not match HTTP query strings sent by spec-compliant clients. Additionally:
- `event_type` — absent from handler (no per-event-type filtering)
- `aggregate_type` — absent (handler uses non-spec `targetType`)
- `aggregate_id` — absent (handler uses non-spec `targetId`)
- `date_from`/`date_to` — absent (handler uses non-spec `from`/`to`)
- `per_page` — absent (handler uses non-spec `limit`)
- Legacy aliases `personId`/`resourceType`/`resourceId` are present but not in spec

---

#### EF-AUD-005
**Severity:** P1  
**Confidence:** HIGH  
**Title:** Error code `AUDIT_APPEND_ONLY` used in tests and app.ts differs from spec-declared `AUDIT_EVENT_IMMUTABLE`  
**File:** `audit-append-only.test.ts`  
**Lines:** 19, 22, 25, 39, 51, 63, 73  
**Spec Source:** API_CONTRACTS.md ("Returns `405 AUDIT_EVENT_IMMUTABLE`"), AUDIT_CONTRACTS.md §6

**Description:**  
AUDIT_CONTRACTS.md §6 specifies: "Error code: `AUDIT_EVENT_IMMUTABLE`." API_CONTRACTS.md documents the 405 endpoint returning `405 AUDIT_EVENT_IMMUTABLE`. Both the test file and `app.ts` (lines 201–210) use `AUDIT_APPEND_ONLY` instead. This is a wire-level error code drift — any client parsing the error code will receive an undocumented code that does not appear in ERROR_TAXONOMY.md.

---

### P2 Findings (Domain term drift / naming / shape mismatch — fix before GA)

---

#### EF-AUD-006
**Severity:** P2  
**Confidence:** HIGH  
**Title:** Domain term drift — `targetType`/`targetId` used throughout instead of spec terms `aggregate_type`/`aggregate_id`  
**File:** `repos/audit-log.schema.ts`, `repos/audit-log.repo.ts`, `consumers/domain-events.consumer.ts`, `getAuditEvents.ts`  
**Lines:** schema:10–11; repo:6–8,32–34; consumer:14–15; handler:37–38  
**Spec Source:** AUDIT_CONTRACTS.md §2 (canonical field names), DOMAIN_GLOSSARY.md

**Description:**  
AUDIT_CONTRACTS.md §2 uses `aggregate_type` and `aggregate_id` throughout the canonical schema. The entire implementation stack uses the non-spec synonym `targetType`/`targetId`. The `DentalAuditDomainEvent` interface (public contract for all modules publishing events) exports `targetType`/`targetId` — all other modules that call `publishAuditEvent` will use these non-spec names. This creates a hard mismatch with the spec-declared API response shape and AUDIT_CONTRACTS.md.

---

#### EF-AUD-007
**Severity:** P2  
**Confidence:** HIGH  
**Title:** Pagination uses non-spec `limit`/`offset` names and allows max=200 vs spec max=100  
**File:** `getAuditEvents.ts`  
**Lines:** 42–43, 60  
**Spec Source:** API_CONTRACTS.md (params: `page`, `per_page`; max: 100; default: 20)

**Description:**  
The spec declares pagination params as `page` (default: 1) and `per_page` (default: 20, max: 100). The handler reads `limit` (default: 50, max: 200) and `offset`. Three deviations: (1) param names differ from spec, (2) max cap is 200 vs spec's 100, (3) response meta uses `{ total, limit, offset }` instead of spec standard pagination envelope per API_CONVENTIONS.md §2.2.

---

#### EF-AUD-008
**Severity:** P2  
**Confidence:** MEDIUM  
**Title:** `registerDelayed` used for pg-boss consumer registration instead of a persistent worker API  
**File:** `consumers/domain-events.consumer.ts`  
**Lines:** 32  
**Spec Source:** MODULE_SPEC.md §14 (pg-boss async queue), AUDIT_CONTRACTS.md §4

**Description:**  
The consumer calls `scheduler.registerDelayed(DENTAL_AUDIT_EVENTS_QUEUE, 0, handler)`. The `registerDelayed` method schedules a one-shot deferred job rather than registering a persistent queue worker. AUDIT_CONTRACTS.md §4 requires continuous async consumption of the audit event queue. Using `registerDelayed` with delay=0 means only a single deferred execution fires at startup rather than a continuously-running worker — published audit events after startup will accumulate unprocessed. This silently violates AC-AUD-001 ("Any write operation → audit event created within 5s"). Confidence is MEDIUM as the full `JobScheduler` interface definition was not inspected.

---

#### EF-AUD-009
**Severity:** P2  
**Confidence:** MEDIUM  
**Title:** `audit.test.ts` imports `logAuditEvent` from `@/core/audit-logger` which creates a circular dependency path  
**File:** `audit.test.ts`  
**Lines:** 14  
**Spec Source:** MODULE_MAP.md (dental-audit declared dependencies)

**Description:**  
The test imports `logAuditEvent` from `@/core/audit-logger`. `core/audit-logger.ts` itself imports `AuditLogRepository` from `@/handlers/dental-audit/repos/audit-log.repo` (confirmed via app.ts grep). This creates a circular reference: `dental-audit/audit.test.ts` → `core/audit-logger` → `dental-audit/repos/audit-log.repo`. MODULE_MAP.md does not list `core/audit-logger` as a declared dependency of dental-audit. While tests may be exempt from production boundary rules, this circular path should be documented or resolved.

---

### P3 Findings (Advisory / style-level)

---

#### EF-AUD-010
**Severity:** P3  
**Confidence:** HIGH  
**Title:** `audit-append-only.test.ts` tests use isolated stub app instead of real server routes  
**File:** `audit-append-only.test.ts`  
**Lines:** 15–29  
**Spec Source:** Project memory `feedback_test_verification.md`

**Description:**  
The 405-immutability tests build a minimal isolated Hono app (`buildAuditImmutabilityApp()`) rather than testing against the real registered application. Project memory explicitly flags this pattern as insufficient: "Handler unit tests with buildTestApp() don't catch route registration bugs; must hit real server." The real 405 handlers are registered in `app.ts` lines 201–207, but these tests verify only an inline stub. If the real app routes are misconfigured or the error code is wrong (see EF-AUD-005), these tests will pass while the API silently fails.

---

#### EF-AUD-011
**Severity:** P3  
**Confidence:** MEDIUM  
**Title:** No WF-028 or WF-096 workflow traceability annotations in handler or consumer  
**File:** `getAuditEvents.ts`, `consumers/domain-events.consumer.ts`  
**Lines:** entire files  
**Spec Source:** WORKFLOW_MAP.md (WF-028: View audit log, WF-096: Write audit event)

**Description:**  
MODULE_SPEC.md §3 declares WF-028 (audit log viewer) and WF-096 (audit event write). Neither handler has `// WF-028` or `// WF-096` traceability annotations. The module has 0% annotated functions, below the 5% adoption gate for mandatory per-function checks. Flagged as advisory only.

---

## File Compliance Scores

| File | Checks Applied | Checks Passed | Score | P0 | P1 | P2 | P3 |
|------|---------------|--------------|-------|----|----|----|----|
| `getAuditEvents.ts` | 6 | 1 | 17% | 0 | 3 (002,003,004) | 1 (007) | 1 (011) |
| `repos/audit-log.schema.ts` | 6 | 3 | 50% | 0 | 1 (001) | 1 (006) | 0 |
| `repos/audit-log.repo.ts` | 6 | 5 | 83% | 0 | 0 | 1 (006 shared) | 0 |
| `consumers/domain-events.consumer.ts` | 6 | 3 | 50% | 0 | 0 | 2 (006,008) | 1 (011) |
| `audit-append-only.test.ts` | 6 | 4 | 67% | 0 | 1 (005) | 0 | 1 (010) |
| `audit.test.ts` | 6 | 5 | 83% | 0 | 0 | 1 (009) | 0 |

---

## Module-Level Summary

| Metric | Value |
|--------|-------|
| Total files | 6 |
| Files with 0 P0/P1 findings | 2 (`audit-log.repo.ts`, `audit.test.ts`) |
| Module traceability score | 33% (2/6 files clean) |
| Total findings | 11 |
| P0 | 0 |
| P1 | 5 |
| P2 | 4 |
| P3 | 2 |

---

## Review Required (LOW confidence findings)

No LOW confidence findings. All findings are HIGH or MEDIUM confidence.

---

## What's Next

**P1 findings detected.** Resolve spec-declared gaps before merge.

**Priority fix order:**

1. **EF-AUD-002** (P1) — Align route path to `/api/v1/dental/audit-events` in both handler docstring and `app.ts` registration.
2. **EF-AUD-003** (P1) — Make `branch_id` required; return `422 VALIDATION_ERROR` when absent; remove the optional conditional guard.
3. **EF-AUD-004** (P1) — Rename query params to snake_case per spec (`branch_id`, `actor_id`, `event_type`, `aggregate_type`, `aggregate_id`, `date_from`, `date_to`, `per_page`).
4. **EF-AUD-005** (P1) — Change error code from `AUDIT_APPEND_ONLY` to `AUDIT_EVENT_IMMUTABLE` in `app.ts` and all tests.
5. **EF-AUD-001** (P1) — Add missing schema fields (`event_type`, `actor_role`, `occurred_at`, `ip_address`, `user_agent`, `metadata`) or document intentional deviation in a migration ADR.
6. **EF-AUD-006** (P2) — Rename `targetType`/`targetId` to `aggregate_type`/`aggregate_id` across schema, repo, consumer, and handler; update `DentalAuditDomainEvent` public interface (cross-module impact).
7. **EF-AUD-007** (P2) — Align pagination to `page`/`per_page` with max=100 and standard response envelope.
8. **EF-AUD-008** (P2) — Verify `registerDelayed` vs persistent `work()` for pg-boss worker semantics; replace if incorrect.

**Cross-module note:** EF-AUD-001 and EF-AUD-006 affect the `DentalAuditDomainEvent` interface, which is the public contract consumed by ALL other modules publishing audit events — renaming requires a coordinated multi-module update.
