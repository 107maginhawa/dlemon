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

**Query params:**

| Param | Type | Required | Format | Constraints | Notes |
|-------|------|----------|--------|-------------|-------|
| `branch_id` | string | YES | uuid | — | Scope guard — only events for caller's branch |
| `actor_id` | string | NO | uuid | — | Filter by staff member |
| `event_type` | string | NO | — | e.g., `VisitCompleted`, `InvoicePaid` | Matches `event_type` field |
| `aggregate_type` | string | NO | — | `Visit`, `Invoice`, `Patient`, etc. | |
| `aggregate_id` | string | NO | uuid | — | Filter by specific entity |
| `action` | string | NO | — | `CREATED`, `READ`, `UPDATED`, `DELETED`, `ACCESSED`, `GENERATED` | |
| `date_from` | string | NO | date (YYYY-MM-DD) | — | Inclusive |
| `date_to` | string | NO | date (YYYY-MM-DD) | ≥ date_from | Inclusive |
| `page` | integer | NO | — | Default: 1 | |
| `per_page` | integer | NO | — | Default: 20, max: 100 | |

**Response 200:** Standard paginated collection

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
