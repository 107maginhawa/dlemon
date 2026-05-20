# Dental Org Module Specification

**Module:** `dental-org`
**Version:** 1.0
**Status:** Implemented

## Overview

The dental-org module manages the multi-tenant organizational hierarchy for dental practices:
**Organization** (the practice/business entity) → **Branch** (physical clinic location) → **Membership** (staff member in a branch).

It is the authorization spine of the platform. Every clinical, billing, and scheduling operation resolves branch access through `assertBranchAccess`, which checks `dental_membership`. The module also owns subscription tier management (`orgTier`, `imagingTier`), PIN-based local authentication, branch settings (working hours, locale, consent templates), and the dashboard summary endpoint.

Primary users: Practice owners (`dentist_owner`), admin staff (`staff_full`).

## Schema

### Tables

| Table | Purpose |
|-------|---------|
| `dental_organization` | Top-level tenant: practice name, subscription tier, owner, country code |
| `dental_branch` | Physical clinic location: org FK, address, city, timezone, working hours, active flag |
| `dental_membership` | Staff member in a branch: role, PIN hash, status, avatar, last login, security question |
| `dental_consent_template` | Reusable consent form templates per branch: title, body, witness requirement |

### `dental_organization`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `baseEntityFields` |
| `name` | text NOT NULL | Max 120 chars; unique per `owner_person_id` |
| `tier` | `org_tier` enum NOT NULL | `solo \| clinic \| group \| enterprise` |
| `owner_person_id` | uuid NOT NULL | FK → Better-Auth person |
| `country_code` | text NOT NULL | ISO 3166-1 alpha-2 |
| `active` | boolean NOT NULL | Default `true` |
| `imaging_tier` | `imaging_tier` enum nullable | `free \| basic \| addon`; NULL treated as `free` |

### `dental_branch`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `baseEntityFields` |
| `organization_id` | uuid NOT NULL | FK → `dental_organization` (CASCADE DELETE) |
| `name` | text NOT NULL | Max 120 chars |
| `address` | text | Street address |
| `city` | text | Max 80 chars |
| `timezone` | text | IANA timezone (e.g. `Asia/Manila`) |
| `working_hours` | jsonb | Day-keyed object with open/close times |
| `phone` | text | Branch phone number |
| `active` | boolean NOT NULL | Default `true` |

Branch settings (locale, currency, dateFormat) are stored as a JSONB settings blob managed via `getBranchSettings` / `updateBranchSettings`.

### `dental_membership`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `baseEntityFields` |
| `branch_id` | uuid NOT NULL | FK → `dental_branch` (CASCADE DELETE) |
| `person_id` | uuid nullable | FK → Better-Auth person; NULL for PIN-only staff |
| `display_name` | text NOT NULL | Shown on PIN select screen |
| `role` | `member_role` enum NOT NULL | `dentist_owner \| dentist_associate \| staff_full \| staff_scheduling` |
| `pin_hash` | text | Bcrypt-hashed PIN |
| `pin_locked_until` | timestamp | Set after `PIN_MAX_ATTEMPTS` failures |
| `pin_failed_attempts` | integer NOT NULL | Default 0; resets on successful verify |
| `status` | `member_status` enum NOT NULL | `active \| inactive` |
| `avatar_url` | text | Profile photo URL |
| `last_login_at` | timestamp | Updated on successful PIN verify (FR6.4) |
| `security_question` | text | PIN recovery question |
| `security_answer_hash` | text | Bcrypt-hashed answer |

Unique constraint: `(person_id, branch_id)` where `person_id IS NOT NULL`.

### `dental_consent_template`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `baseEntityFields` |
| `branch_id` | uuid NOT NULL | FK → `dental_branch` |
| `name` | text NOT NULL | Template display name |
| `body` | text NOT NULL | Full consent text |
| `requires_witness_signature` | boolean NOT NULL | Default `false` |
| `active` | boolean NOT NULL | Default `true` |

### Enums

`org_tier`: `solo | clinic | group | enterprise`
`imaging_tier`: `free | basic | addon`
`member_role`: `dentist_owner | dentist_associate | staff_full | staff_scheduling`
`member_status`: `active | inactive`

## Business Rules

### BR-016: Branch membership required for all clinical data access
**Rule:** BR-016 — Branch membership is required for all clinical data access. Every handler calls `assertBranchAccess`, which verifies the requesting user holds a `DentalMembership` record for the requested branch with `status = 'active'`.

**HTTP:** `403` if no active membership found.

**Implementation:** `services/api-ts/src/handlers/shared/assert-branch-access.ts` — called by all clinical, billing, imaging, scheduling, and visit handlers.

---

### BR-016b: PIN lockout after failed attempts
**Rule:** After a configurable number of consecutive PIN failures, the membership is locked until `pin_locked_until` expires. Locked memberships return `429 Too Many Requests`.

**Implementation:** `verifyPin.ts` — increments `pin_failed_attempts` on failure; sets `pin_locked_until` when threshold is reached. Resets both on success.

---

### BR-016c: Imaging tier gates ceph features
**Rule:** `dental_organization.imaging_tier` (NULL or `free`) blocks all CephMgmt endpoints with 403. See CIMG-001/CIMG-002 in the dental-imaging MODULE_SPEC.

**Implementation:** `dental_membership.imagingTier` is resolved from the org and checked in all CephMgmt handlers.

## Permission Matrix

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|-----------|:---:|:---:|:---:|:---:|
| Create organization | Yes (self) | No | No | No |
| Get / update organization | Yes | No | No | No |
| Create branch | Yes | No | No | No |
| Get / list branches | Yes | Yes | Yes | Yes |
| Create membership | Yes | No | No | No |
| List members | Yes | Yes | Yes | Yes |
| Deactivate member | Yes | No | No | No |
| Reset / set PIN (own) | Yes | Yes | Yes | Yes |
| Reset PIN (others) | Yes | No | No | No |
| Verify PIN | Yes | Yes | Yes | Yes |
| Set security question | Yes | Yes | Yes | Yes |
| Recover PIN | Yes | Yes | Yes | Yes |
| Get / update working hours | Yes | No | Yes | No |
| Get / update branch settings | Yes | No | Yes | No |
| List consent templates | Yes | Yes | Yes | Yes |
| Create / update / delete consent template | Yes | No | Yes | No |
| Get org context | Yes | Yes | Yes | Yes |
| Get dashboard summary | Yes | Yes | Yes | Yes |

**Default-deny:** Any role not listed as "Yes" receives `403 ForbiddenError`.

## API Endpoints

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| `POST` | `/dental/org/organizations` | `DentalOrganizationManagement_create` | Creates org + default branch |
| `GET` | `/dental/org/organizations/:id` | `DentalOrganizationManagement_get` | |
| `PATCH` | `/dental/org/organizations/:id` | `DentalOrganizationManagement_update` | Includes `imagingTier` update |
| `POST` | `/dental/org/organizations/:orgId/branches` | `DentalBranchManagement_create` | |
| `GET` | `/dental/org/organizations/:orgId/branches` | `DentalBranchManagement_list` | |
| `GET` | `/dental/org/organizations/:orgId/branches/:branchId` | `DentalBranchManagement_get` | |
| `POST` | `/dental/org/organizations/:orgId/branches/:branchId/members` | `DentalMembershipManagement_create` | |
| `GET` | `/dental/org/organizations/:orgId/branches/:branchId/members` | `DentalMembershipManagement_list` | |
| `POST` | `/dental/org/organizations/:orgId/branches/:branchId/members/:membershipId/deactivate` | `DentalMembershipManagement_deactivate` | |
| `POST` | `/dental/org/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin` | `DentalMembershipManagement_verifyPin` | Rate-limited; returns 429 on lockout |
| `POST` | `/dental/org/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin` | `DentalMembershipManagement_setPin` | |
| `GET` | `/dental/org/members` | `listMembers` | Flat list across branches |
| `POST` | `/dental/org/members` | `createMember` | Flat create |
| `POST` | `/dental/org/members/:memberId/reset-pin` | `resetMemberPin` | Owner-only |
| `POST` | `/dental/org/members/:memberId/security-question` | `setSecurityQuestion` | |
| `POST` | `/dental/org/members/:memberId/recover-pin` | `recoverPin` | Via security question |
| `GET` | `/dental/org/branches/:branchId/working-hours` | `getWorkingHours` | |
| `PUT` | `/dental/org/branches/:branchId/working-hours` | `updateWorkingHours` | |
| `GET` | `/dental/org/branches/:branchId/settings` | `getBranchSettings` | |
| `PUT` | `/dental/org/branches/:branchId/settings` | `updateBranchSettings` | |
| `GET` | `/dental/org/branches/:branchId/consent-templates` | `listConsentTemplates` | |
| `POST` | `/dental/org/branches/:branchId/consent-templates` | `createConsentTemplate` | |
| `PATCH` | `/dental/org/branches/:branchId/consent-templates/:id` | `updateConsentTemplate` | |
| `DELETE` | `/dental/org/branches/:branchId/consent-templates/:id` | `deleteConsentTemplate` | |
| `GET` | `/dental/org/context` | `getOrgContext` | Returns resolved org + branch for current user |
| `GET` | `/dental/org/dashboard/summary` | `getDashboardSummary` | Query: `branchId?` |

## TypeSpec Source

`specs/api/src/modules/dental-org.tsp`

## Dependencies

- Better-Auth (`person_id` FK → cloud user accounts)
- `dental_membership.imagingTier` — consumed by `dental-imaging` CephMgmt gate
- `assert-branch-access.ts` — shared utility consumed by all other dental modules

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-20 | 1.0 | Initial spec (4 tables, BR-016, permission matrix, 26 endpoints) |
