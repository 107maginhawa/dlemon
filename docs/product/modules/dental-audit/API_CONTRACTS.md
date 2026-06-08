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

**Response 200:** `{ data: DentalAuditEvent[], meta: { total, limit, offset } }`

Field names are **camelCase** and match the viewer DTO in `getAuditEvents.ts#toDTO` / TypeSpec `DentalAuditEvent` (V-AUD-003). The `beforeSnapshot`/`afterSnapshot` JSONB columns are **deliberately omitted** from the response (latent-PHI guard, AC-AUD-004).

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `tenantId` | string (uuid) | NO | Organization the event belongs to |
| `branchId` | string (uuid) | YES | Null for org-level events |
| `actorId` | string (uuid) | NO | The acting user (UUID only — never a name) |
| `actorRole` | string | YES | Membership role at time of event |
| `eventType` | string | YES | `data-modification` \| `security` \| `authentication` \| `data-access` \| `compliance` \| `system-config` |
| `action` | string | NO | e.g. `invoice.voided`, `audit_log.accessed` |
| `resourceType` | string | NO | DB `target_type` (e.g. `dental_invoice`) |
| `resourceId` | string (uuid) | YES | DB `target_id`; null for non-entity events |
| `reason` | string | YES | Optional reason supplied with the action |
| `ipAddress` | string | YES | Web requests only |
| `userAgent` | string | YES | Web requests only |
| `metadata` | object | YES | Safe non-PHI key/value pairs |
| `timestamp` | string (date-time) | NO | ISO 8601 UTC |

> The previously documented `aggregate_type`/`aggregate_id`/`occurred_at`/snake_case fields are **NOT** the implemented response — the DTO is camelCase (`resourceType`/`resourceId`/`timestamp`) and excludes the before/after snapshots.

**Sort:** `timestamp DESC` (default, not configurable)

**Errors:** `FORBIDDEN(403)`, `BRANCH_ACCESS_DENIED(403)`, `INVALID_DATE_RANGE(422)`

---

### PATCH /DELETE /PUT /api/v1/dental/audit-events/:id

**All write methods:** Returns `405 AUDIT_EVENT_IMMUTABLE`

No exceptions. Audit events cannot be modified or deleted.

---

## Write Contract (All Modules)

Audit events are written by all other modules via pg-boss — not by direct API calls from clients. See AUDIT_CONTRACTS.md for the full write schema and mandatory audit event table.
