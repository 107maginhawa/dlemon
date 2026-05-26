<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_MAP.md, DOMAIN_MODEL.md, ROLE_PERMISSION_MATRIX.md, WORKFLOW_MAP.md, MODULE_SPEC.md ×10 -->

# API Conventions — Dentalemon

> **Single source of truth for all cross-cutting API decisions.**
> All per-module API_CONTRACTS.md files implement these conventions without exception.

---

## 1. Base URL & Versioning

| Decision | Value |
|----------|-------|
| Base path | `/api/v1` |
| Dental namespace | `/api/v1/dental` |
| Versioning strategy | URL path (`/v1`, `/v2`) |
| Version bump trigger | Breaking change to request/response shape |
| Deprecation window | 6 months minimum |

All dental module endpoints are prefixed `/api/v1/dental/...`.
Platform module endpoints (person, booking, etc.) are prefixed `/api/v1/...`.

---

## 2. Response Envelope

### 2.1 Success (single resource)

```json
{
  "data": { },
  "meta": {
    "request_id": "req_01JXXXXXXXXXX",
    "timestamp": "2026-05-24T12:00:00.000Z"
  }
}
```

### 2.2 Success (collection / paginated)

```json
{
  "data": [ ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  },
  "meta": {
    "request_id": "req_01JXXXXXXXXXX",
    "timestamp": "2026-05-24T12:00:00.000Z"
  }
}
```

### 2.3 Success (action / mutation with no body)

```json
{
  "data": { "ok": true },
  "meta": { "request_id": "req_01JXXXXXXXXXX", "timestamp": "2026-05-24T12:00:00.000Z" }
}
```

### 2.4 Error

```json
{
  "error": {
    "code": "BUSINESS_ERROR_CODE",
    "message": "Human-readable message",
    "details": { }
  },
  "meta": {
    "request_id": "req_01JXXXXXXXXXX",
    "timestamp": "2026-05-24T12:00:00.000Z"
  }
}
```

**Rules:**
- `data` and `error` are mutually exclusive — never both present
- `meta.request_id` always present (set by `createRequestId` middleware)
- `details` is optional; omitted for simple errors, included for validation field errors
- Field validation errors use `details.fields`: `{ "fieldName": ["message1"] }`

---

## 3. Authentication

| Decision | Value |
|----------|-------|
| Scheme | Bearer JWT (Better-Auth session token) |
| Header | `Authorization: Bearer <token>` |
| Session management | Better-Auth (server-side session store) |
| Branch scope | All dental endpoints require `branch_id` (query param or body) |
| Guard function | `assertBranchAccess(userId, branchId)` — throws 403 if not member |
| Role guard | `assertBranchRole(userId, branchId, [roles])` — throws 403 if wrong role |

**All dental endpoints require authentication.** No public dental endpoints exist.

---

## 4. Authorization Model

Four dental membership roles in ascending privilege order:

| Role | Code | Description |
|------|------|-------------|
| Staff – Scheduling | `staff_scheduling` | Calendar + check-in only |
| Staff – Full | `staff_full` | All non-clinical, non-financial ops |
| Dentist Associate | `dentist_associate` | Clinical write + Rx |
| Dentist Owner | `dentist_owner` | Full access including financial + admin |

Better-Auth system roles (`admin`, `user`, `support`) govern platform-level access.
Dental membership roles govern dental domain access within a branch.

**403 response** when: (a) user not a member of branch, (b) user role insufficient for operation.

---

## 5. Pagination

| Parameter | Type | Default | Max | Notes |
|-----------|------|---------|-----|-------|
| `page` | integer | 1 | — | 1-based |
| `per_page` | integer | 20 | 100 | Clamped server-side |

Collection endpoints that may return >20 items **must** paginate.
Audit log, patient search, appointment calendar are always paginated.

---

## 6. Filtering & Sorting

- Filter params: flat query parameters (e.g., `status=draft&branch_id=uuid`)
- Date range: `date_from` / `date_to` (ISO 8601: `YYYY-MM-DD`)
- Sorting: `sort_by=field&sort_dir=asc|desc` (default per-endpoint, see module contracts)
- All collection endpoints filter by `branch_id` — **never** return cross-branch data

---

## 7. Idempotency

| Endpoint type | Idempotency |
|--------------|-------------|
| GET | Always idempotent |
| DELETE | Always idempotent (repeated = same 200) |
| POST (create) | Not idempotent by default |
| POST (action) | Idempotent key via `Idempotency-Key` header (optional, 24h window) |
| PATCH | Idempotent (same body = same result) |

Clients may send `Idempotency-Key: <uuid>` on POST create/action endpoints.
Server returns cached response within 24h if key already used.

---

## 8. ETags & Conditional Updates

Not implemented in Phase 1. Planned for offline-first conflict resolution (cadence sync layer handles CRDT).

---

## 9. Rate Limiting

| Tier | Limit | Window | Header |
|------|-------|--------|--------|
| Default | 1000 req | 1 min | `X-RateLimit-*` |
| File upload | 10 req | 1 min | Same |
| Auth endpoints | 20 req | 1 min | Same |

Rate limit headers on every response:
- `X-RateLimit-Limit`: total allowed
- `X-RateLimit-Remaining`: remaining in window
- `X-RateLimit-Reset`: Unix timestamp of window reset

429 response includes `Retry-After` header (seconds).

---

## 10. File Uploads

- Content-Type: `multipart/form-data`
- Max file size: 50 MB (imaging), 10 MB (documents), 5 MB (attachments)
- Accepted MIME types: per endpoint (see per-module contracts)
- Storage: S3/MinIO via platform `storage` module
- Presigned URLs: returned for direct download (24h TTL)

---

## 11. CORS

Configured per environment:
- Development: `*`
- Production: explicit allowlist (clinic app origin only)

Handled by `createCorsMiddleware` in app middleware stack.

---

## 12. Security Headers

Applied globally by `createSecurityHeaders` middleware:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- PHI cache control via `createPhiCacheHeaders`: `Cache-Control: no-store, no-cache, must-revalidate`

---

## 13. Bulk Operations

Where supported (see per-module contracts):
- `POST /dental/*/bulk-*` pattern
- Request body: `{ "ids": ["uuid", ...], ...options }`
- Response: `{ "data": { "affected": N, "errors": [] } }`
- Max batch size: 50 items per request
- Partial success supported: `errors[]` contains per-ID failures

---

## 14. Webhooks / HATEOAS

Phase 1: No webhooks or HATEOAS links implemented.
Domain events (DE-001–DE-024) are internal via pg-boss; no external webhook delivery.

---

## 15. Request ID

Every request assigned `X-Request-ID` header by `createRequestId` middleware.
Value echoed in `meta.request_id` in all responses.
Format: `req_` + ULID.

---

## 16. Append-Only Endpoints

Some endpoints enforce append-only semantics at the router level:
- Medical history entries (dental-clinical)
- Audit events (dental-audit)
- Follow-up notes (dental-patient)
- Imported PMD records (dental-pmd)
- Imported EMR records (dental-emr)

PATCH/DELETE on these routes returns `405 Method Not Allowed`.

---

## 17. CSRF Protection

Applied by `createCsrfGuard` middleware to all state-changing requests (POST, PATCH, PUT, DELETE).
Exempt: file upload multipart endpoints (handled via same-origin token check).
