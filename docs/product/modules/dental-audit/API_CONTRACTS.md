<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-audit, API_CONVENTIONS.md, AUDIT_CONTRACTS.md, ERROR_TAXONOMY.md -->

# API Contracts — dental-audit

> All responses wrap in `{ data, meta }`.
> Audit events are append-only — no PATCH/PUT/DELETE.
> PHI rule G-005: no names, emails, or clinical text in any field.
> 7-year retention. Paginated queries only — no unbounded returns.

---

## Endpoints

### GET /api/v1/dental/audit-events

Query the audit log for a branch.

**Auth:** `dentist_owner` only
**Rate limit:** Default

**Query params (V-AUD-004 reconciliation — these are the ACTUAL implemented params per `getAuditEvents.ts`; the previously documented `aggregate_type`/`aggregate_id`/`page`/`per_page` are NOT implemented):**

| Param | Type | Required | Format | Constraints | Notes |
|-------|------|----------|--------|-------------|-------|
| `branchId` | string | YES | uuid | — | Scope guard — only events for caller's branch; missing → `VALIDATION_ERROR(400)` |
| `actorId` | string | NO | uuid | — | Filter by staff member (alias: `personId`) |
| `tenantId` | string | NO | uuid | — | Optional tenant override; defaults to `branchId` |
| `eventType` | string | NO | — | e.g., `security`, `VisitCompleted` | Matches `event_type` field |
| `resourceType` | string | NO | — | `Visit`, `Invoice`, `Patient`, etc. | Canonical param is `targetType`; `resourceType` accepted as alias |
| `targetType` | string | NO | — | as above | Maps to DB `targetType` column |
| `resourceId` | string | NO | uuid | — | Canonical param is `targetId`; `resourceId` accepted as alias |
| `targetId` | string | NO | uuid | — | Filter by specific entity |
| `action` | string | NO | — | `CREATED`, `READ`, `UPDATED`, `DELETED`, `ACCESSED`, `GENERATED` | |
| `from` | string | NO | date-time | — | Inclusive lower bound; unparseable → `VALIDATION_ERROR(400)` |
| `to` | string | NO | date-time | ≥ `from` | Inclusive upper bound; `from > to` → `INVALID_DATE_RANGE(422)` |
| `limit` | integer | NO | — | Default: 50, max: 200 | Offset-based pagination (NOT `per_page`) |
| `offset` | integer | NO | — | Default: 0 | Offset-based pagination (NOT `page`) |

> `page`/`per_page` are **not implemented** — pagination is `limit`/`offset`. `date_from`/`date_to`
> are **not implemented** — the date filters are `from`/`to`. (V-AUD-004)

**Response 200:** `{ data: AuditEvent[], meta: { total, limit, offset } }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | ULID |
| `event_type` | string | NO | Domain event name or ACCESS_* |
| `actor_id` | string (uuid) | NO | `"system"` for automated |
| `actor_role` | string | NO | Role at time of event |
| `branch_id` | string (uuid) | NO | |
| `aggregate_type` | string | NO | |
| `aggregate_id` | string (uuid) | NO | |
| `action` | string | NO | |
| `occurred_at` | string (date-time) | NO | |
| `metadata` | object | NO | Safe non-PHI key/value pairs |

**Sort:** `occurred_at DESC` (default, not configurable)

**Errors:** `FORBIDDEN(403)`, `BRANCH_ACCESS_DENIED(403)`, `INVALID_DATE_RANGE(422)`

---

### PATCH /DELETE /PUT /api/v1/dental/audit-events/:id

**All write methods:** Returns `405 AUDIT_EVENT_IMMUTABLE`

No exceptions. Audit events cannot be modified or deleted.

---

## Write Contract (All Modules)

Audit events are written by all other modules via pg-boss — not by direct API calls from clients. See AUDIT_CONTRACTS.md for the full write schema and mandatory audit event table.
