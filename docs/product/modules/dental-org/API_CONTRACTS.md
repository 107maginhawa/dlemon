<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-org, API_CONVENTIONS.md, ERROR_TAXONOMY.md -->

# API Contracts — dental-org

> All responses wrap in `{ data, meta }` (API_CONVENTIONS.md §2).
> Auth: Bearer JWT required on all endpoints.
> Branch scope: `assertBranchAccess` called before every endpoint.

---

## Endpoints

### POST /api/v1/dental/organizations

Create a new dental organization.

**Auth:** Authenticated user (becomes `dentist_owner`)
**Rate limit:** Default

**Request body:**

| Field | Type | Nullable | Required | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| `name` | string | NO | YES | — | min:2, max:120 | — | `"Sunshine Dental"` |
| `country_code` | string | NO | YES | ISO 3166-1 alpha-2 | length:2 | — | `"AU"` |
| `owner_person_id` | string | NO | YES | uuid | — | — | `"01JX..."` |

**Response 201:** `{ data: Organization }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `name` | string | NO | |
| `country_code` | string | NO | |
| `created_at` | string (date-time) | NO | |

**Errors:** `VALIDATION_ERROR(400)`, `CONFLICT(409)`

---

### POST /api/v1/dental/branches

Create a branch within an org.

**Auth:** `dentist_owner`
**Rate limit:** Default

**Request body:**

| Field | Type | Nullable | Required | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| `org_id` | string | NO | YES | uuid | — | — | `"01JX..."` |
| `name` | string | NO | YES | — | min:2, max:120 | — | `"City Clinic"` |
| `address` | object | NO | YES | — | — | — | `{...}` |
| `address.street` | string | NO | YES | — | max:200 | — | `"123 Main St"` |
| `address.city` | string | NO | YES | — | max:100 | — | `"Sydney"` |
| `address.postcode` | string | NO | YES | — | max:20 | — | `"2000"` |
| `address.country` | string | NO | YES | ISO 3166-1 alpha-2 | length:2 | — | `"AU"` |
| `timezone` | string | NO | YES | IANA timezone | — | — | `"Australia/Sydney"` |
| `working_hours` | object | NO | NO | — | — | `null` | `{...}` |

**Response 201:** `{ data: Branch }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `org_id` | string (uuid) | NO | |
| `name` | string | NO | |
| `address` | object | NO | |
| `timezone` | string | NO | |
| `created_at` | string (date-time) | NO | |

**Errors:** `VALIDATION_ERROR(400)`, `NOT_FOUND(404)` (org not found), `FORBIDDEN(403)`

---

### GET /api/v1/dental/branches/:id

Get branch details.

**Auth:** Any branch member
**Path params:** `id` (uuid)
**Rate limit:** Default

**Response 200:** `{ data: Branch }`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/memberships

Invite staff to a branch.

**Auth:** `dentist_owner`
**Rate limit:** Default

**Request body:**

| Field | Type | Nullable | Required | Format | Enum | Constraints | Example |
|-------|------|----------|----------|--------|------|-------------|---------|
| `branch_id` | string | NO | YES | uuid | — | — | `"01JX..."` |
| `email` | string | NO | YES | email | — | max:255 | `"jane@clinic.com"` |
| `role` | string | NO | YES | — | `staff_scheduling`, `staff_full`, `dentist_associate`, `dentist_owner` | — | `"staff_full"` |

**Response 201:** `{ data: Membership }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `branch_id` | string (uuid) | NO | |
| `person_id` | string (uuid) | NO | |
| `role` | string | NO | |
| `status` | string | NO | `active`, `invited`, `revoked` |
| `created_at` | string (date-time) | NO | |

**Errors:** `VALIDATION_ERROR(400)`, `MEMBERSHIP_CONFLICT(409)`, `FORBIDDEN(403)`
**Events emitted:** DE-022 MembershipAssigned

---

### PATCH /api/v1/dental/memberships/:id

Update membership role or status.

**Auth:** `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Enum | Example |
|-------|------|----------|----------|------|---------|
| `role` | string | YES | NO | `staff_scheduling`, `staff_full`, `dentist_associate`, `dentist_owner` | `"dentist_associate"` |
| `status` | string | YES | NO | `active`, `revoked` | `"revoked"` |

**Response 200:** `{ data: Membership }`

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`, `VALIDATION_ERROR(422)`
**Events emitted:** DE-023 MembershipRevoked (when status → revoked)

---

### GET /api/v1/dental/fee-schedule

Get CDT fee schedule for a branch. The fee schedule is the active CDT
procedure-code catalog with per-branch price overrides; entries without an
override use the procedure code's default fee.

**Auth:** `dentist_owner`, `dentist_associate`
**Query params:** `branchId` (uuid, required)

**Response 200:** `{ data: FeeScheduleEntry[] }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `cdtCode` | string | NO | e.g., `"D0150"` |
| `description` | string | NO | From the CDT procedure-code catalog |
| `priceCents` | integer | NO | Effective price for this branch, in cents |
| `currency` | string | NO | ISO 4217 (from branch settings; defaults to `"PHP"`) |

**Errors:** `VALIDATION_ERROR(400)` (missing `branchId`), `NOT_FOUND(404)`, `FORBIDDEN(403)`

> Field/param names are camelCase to match the platform wire convention and the
> generated SDK (see sibling endpoints e.g. `GET /api/v1/dental/dashboard`).

---

### PATCH /api/v1/dental/fee-schedule/:cdt

Update price for a CDT code.

**Auth:** `dentist_owner`
**Path params:** `cdt` (CDT code string, e.g., `D0150`)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `branchId` | string | NO | YES | uuid | `"01JX..."` |
| `priceCents` | integer | NO | YES | min:0, max:999999 | `15000` |

**Response 200:** `{ data: FeeScheduleEntry }` (the updated entry)

**Errors:** `VALIDATION_ERROR(400)`, `FORBIDDEN(403)`, `INVALID_CDT_CODE(422)` (unknown/inactive CDT code)

Sets a per-branch price override on `dental_branch.settings.feeSchedule`
(`Record<cdtCode, priceCents>`). The owner-only role check runs before the CDT
existence check so CDT validity is never leaked to under-privileged callers.

---

### GET /api/v1/dental/dashboard

Practice summary statistics.

**Auth:** `dentist_owner`
**Query params:** `branch_id` (uuid, required)

**Response 200:**

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `appointments_today` | integer | NO | |
| `active_patients` | integer | NO | |
| `outstanding_invoices` | integer | NO | Count of unpaid invoices |
| `outstanding_cents` | integer | NO | Total outstanding amount |
| `period_start` | string (date) | NO | |
| `period_end` | string (date) | NO | |

**Errors:** `FORBIDDEN(403)`

---

### GET /api/v1/dental/audit-events

Paginated audit log. Proxy — canonical definition in `dental-audit/API_CONTRACTS.md`. No independent schema; all params/responses defined there.

**Auth:** `dentist_owner`
**Query params:** See AUDIT_CONTRACTS.md §5

**Response 200:** Standard paginated collection

**Errors:** `FORBIDDEN(403)`, `BRANCH_ACCESS_DENIED(403)`, `INVALID_DATE_RANGE(422)`
