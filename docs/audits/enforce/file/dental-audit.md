# dental-audit — File Enforcement
<!-- oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary
- Files scanned: 5 (source + test, `services/api-ts/src/handlers/dental-audit/`)
- Findings: 3 (P0: 0, P1: 2, P2: 1, P3: 0)
- Service files present: `.service.ts` ❌  |  `.repo.ts` ✅ (`repos/audit-log.repo.ts`)

> **Source note**: The run prompt specifies `services/api-ts/src/handlers/dental-org/` as the dental-audit source. Investigation shows dental-audit has its own dedicated directory at `services/api-ts/src/handlers/dental-audit/`. The dental-org directory contains org/membership/consent handlers — no audit-specific handlers. This report scans the canonical `dental-audit` directory.

## Findings

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EF-AUD-001 | P1 | Missing `.service.ts` — `consumers/domain-events.consumer.ts` contains business logic (event routing, append-only enforcement, action mapping) that should be extracted into a service layer; currently the consumer directly instantiates `AuditLogRepository` and performs logic inline | `consumers/domain-events.consumer.ts` | — |
| EF-AUD-002 | P1 | No dedicated `.test.ts` for `getAuditEvents.ts` handler — `audit.test.ts` tests only the repo layer (`AuditLogRepository` + `logAuditEvent`); HTTP handler path, filter logic, and authorization in `getAuditEvents.ts` have zero direct test coverage | `getAuditEvents.ts` | — |
| EF-AUD-003 | P2 | No `.test.ts` for `consumers/domain-events.consumer.ts` — consumer logic (event-to-action routing, PHI filtering intent) is entirely untested | `consumers/domain-events.consumer.ts` | — |

## File Inventory

| File | Lines | Role | Notes |
|------|-------|------|-------|
| `getAuditEvents.ts` | 61 | Handler | No dedicated test (EF-AUD-002) |
| `consumers/domain-events.consumer.ts` | 48 | Domain event consumer | No service extraction (EF-AUD-001), no test (EF-AUD-003) |
| `repos/audit-log.repo.ts` | 56 | Repository | Clean |
| `repos/audit-log.schema.ts` | 24 | DB schema | Clean |
| `audit.test.ts` | 187 | Test (repo-level) | Covers repo only |
| **Total** | **376** | | |

## Checks: PASS

- **File naming**: All files camelCase `.ts`. No PascalCase violations.
- **File size**: No file exceeds 300 lines. No P1/P2 size flags.
- **Direct db ops in handlers**: `getAuditEvents.ts` delegates entirely to `AuditLogRepository` — no raw `db.select/insert/update/delete` in handler. ✅
- **Cross-module imports**: None detected. Module stays within allowed boundaries. ✅
- **`.repo.ts` present**: `repos/audit-log.repo.ts` exists. ✅
- **Directory structure**: `handlers/` + `repos/` + `consumers/` — well-organized. ✅

## F2 Assessment: Service Layer

Module is small (5 files, 376 total lines). The missing `.service.ts` (EF-AUD-001) is flagged P1 because `consumers/domain-events.consumer.ts` accumulates business logic inline that bypasses the repo interface. A `dental-audit.service.ts` wrapping `AuditLogRepository` and exposing `logEvent(payload)` + `queryEvents(filters)` would:
1. Decouple the consumer from direct repo instantiation
2. Unify the two write paths (`logAuditEvent` core shim vs consumer)
3. Create a testable unit for the append-only enforcement rule (MODULE_SPEC §5)
