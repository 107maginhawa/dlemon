# Dental Audit Module Specification

**Module:** `dental-audit`
**Version:** 1.0
**Status:** Implemented

## Overview

The dental-audit module provides a queryable, HIPAA-compliant audit trail for all PHI-touching operations in the platform. It supplements the always-on Pino structured log stream with a persistent database table (`audit_log_entry`) that supports filtered queries by event type, category, actor, resource, and date range.

Primary users: Practice owners (`dentist_owner`), compliance officers (`admin` role). The `GET /dental/admin/audit` endpoint is admin-only; no patient-facing access is permitted.

## Schema

### Tables

| Table | Purpose |
|-------|---------|
| `audit_log_entry` | Immutable record of every PHI access and modification event |

### `audit_log_entry`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `baseEntityFields` |
| `event_type` | `audit_event_type` enum | `authentication \| data-access \| data-modification \| system-config \| security \| compliance` |
| `category` | `audit_category` enum | `hipaa \| security \| privacy \| administrative \| clinical \| financial` |
| `action` | `audit_action` enum | `create \| read \| update \| delete \| login \| logout` |
| `outcome` | `audit_outcome` enum | `success \| failure \| partial \| denied` |
| `user` | uuid nullable | FK → Better-Auth user |
| `user_type` | varchar(20) | `client \| provider \| admin \| system` |
| `resource_type` | varchar(100) NOT NULL | Entity type (e.g. `patient`, `invoice`) |
| `resource` | varchar(255) NOT NULL | Entity ID or descriptor |
| `description` | varchar(1000) NOT NULL | Human-readable event summary |
| `details` | jsonb | Structured event metadata |
| `ip_address` | varchar(45) | IPv4 or IPv6 |
| `user_agent` | varchar(500) | Browser/client UA string |
| `session_id` | varchar(255) | Session correlation |
| `request_id` | varchar(255) | Request correlation (from `X-Request-ID` header) |
| `integrity_hash` | varchar(64) | SHA-256 hash for tamper detection |
| `retention_status` | `audit_retention_status` enum | `active \| archived \| pending-purge` |
| `archived_at` | timestamp | When entry was archived |
| `archived_by` | text | FK → Better-Auth user who archived |
| `purge_after` | timestamp | Retention expiry date |

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `audit_event_type_idx` | `event_type` | Filter by event class |
| `audit_category_idx` | `category` | Filter by compliance category |
| `audit_user_idx` | `user` | Filter by actor |
| `audit_resource_idx` | `resource_type, resource` | Filter by affected entity |
| `audit_created_at_idx` | `created_at` | Time-range queries |
| `audit_user_event_idx` | `user, event_type` | Actor + event class |
| `audit_resource_type_event_idx` | `resource_type, event_type` | Entity + event class |
| `audit_date_range_idx` | `created_at, retention_status` | Retention sweeps |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/dental/admin/audit` | `admin`, `compliance` | List audit log entries (paginated, filtered) |

### Query Parameters — `GET /dental/admin/audit`

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventType` | string | Filter by event type enum |
| `category` | string | Filter by compliance category |
| `action` | string | Filter by action enum |
| `outcome` | string | Filter by outcome enum |
| `user` | uuid | Filter by actor user ID |
| `userType` | string | Filter by actor type |
| `resourceType` | string | Filter by resource entity type |
| `resource` | uuid | Filter by specific resource ID |
| `retentionStatus` | string | Filter by retention status |
| `startDate` | ISO date | Range start (inclusive) |
| `endDate` | ISO date | Range end (inclusive) |
| `limit` | integer | Page size (default: 25, max: 100) |
| `offset` | integer | Page offset |

## Handler Structure

```
handlers/audit/
├── listAuditLogs.ts          # GET /dental/admin/audit handler
├── listAuditLogs.test.ts     # Handler unit tests
├── repos/
│   ├── audit.schema.ts       # Drizzle table + type definitions
│   ├── audit.repo.ts         # AuditRepository (findMany, count, logEvent)
│   └── audit.repo.test.ts    # Repository unit tests
└── jobs/                     # Background retention sweep jobs
```

## Core Services

| File | Purpose |
|------|---------|
| `src/core/audit-logger.ts` | `logAuditEvent()` helper — writes to `audit_log_entry` via AuditRepository |
| `src/core/audit.ts` | `createAuditService()` factory — injected into Hono app context |
| `src/db/audit.schema.ts` | Standalone schema export (for migrations) |
| `src/db/audit.repo.ts` | Standalone repo export (for direct DB access) |

## Pino Integration

Every audit event is dual-written:
1. **Pino structured log** — real-time stream via `createRequestLogger` middleware
2. **`audit_log_entry` DB table** — persistent, queryable, filterable

PHI-touching handlers call `logAuditEvent()` directly in their implementation. The `listAuditLogs` handler self-logs its own access (meta-audit).

## Business Rules

| Rule | Description |
|------|-------------|
| BA-001 | Only `admin` and `compliance` roles may query audit logs |
| BA-002 | `startDate` must not be after `endDate` — returns 400 |
| BA-003 | Page size is capped at 100 entries per request |
| BA-004 | `integrity_hash` is set on write; tamper detection is read-side verification |
| BA-005 | `retention_status = pending-purge` entries are excluded from default listing |

## Compliance Notes

- **HIPAA §164.312(b)**: Audit controls — this module satisfies the technical safeguard requirement for hardware, software, and procedural mechanisms to record and examine activity in information systems containing PHI.
- **Retention**: HIPAA requires audit log retention for 6 years. The `purge_after` column enforces this at the data layer.
- **Integrity**: `integrity_hash` (SHA-256) enables detection of log tampering at the storage layer.

## Cross-Module Dependencies

| Dependency | Direction | Purpose |
|-----------|-----------|---------|
| Better-Auth (`user` table) | audit → auth | `archived_by` FK; actor correlation |
| All PHI handlers | PHI handlers → audit | `logAuditEvent()` called on every PHI read/write |
| dental-org | dental-org → audit | Org/branch admin events |

## Integration with Other Modules

The audit module is **write-once from other modules, read-only for admins**. No module should query audit logs except via `GET /dental/admin/audit`. Cross-module writes go through `logAuditEvent()` only.
