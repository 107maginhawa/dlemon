<!-- oli-version: 1.1 -->
<!-- generated: 2026-05-24 | skill: oli-module-specs --all -->
<!-- based-on: PRD v3, DOMAIN_MODEL.md, WORKFLOW_MAP.md, existing docs/modules/dental-org/MODULE_SPEC.md -->

# Module Specification: dental-org

---
Spec Version: 1.0 | Last Updated: 2026-05-24
Last Validated Against: PRD v3-dentalemon.md
---

## 1. Module Overview

### Purpose
Manages the multi-tenant organizational hierarchy: Organization → Branch → Membership. Authorization spine of the platform — every clinical/billing/scheduling operation resolves branch access via `assertBranchAccess`. Owns subscription tier management, PIN-based local auth, branch settings, fee schedules, and consent templates.

### Users
- `dentist_owner` — primary administrator; full access
- `admin` (platform) — tenant provisioning
- All other roles — read their own membership (assertBranchAccess consumer)

### Related Modules
- All modules (consumer of `assertBranchAccess`)
- `dental-billing` (fee schedule lookup)
- `dental-scheduling` (branch working hours)
- `person` platform module (staff Person records)

### In Scope
Organization CRUD, Branch CRUD, Membership management (create/update/deactivate), fee schedule per branch, consent templates, PIN lockout, subscription tiers (`orgTier`, `imagingTier`), dashboard summary, audit log viewer.

### Out of Scope
Patient records, clinical data, billing invoices, appointment scheduling (those modules own their own scoping).

---

## 2. Domain Terms

| Term | Definition |
|------|-----------|
| Organization | Top-level tenant; a dental practice with 1+ branches |
| Branch | Physical clinic location; all clinical data scoped to a branch |
| Membership | Staff member's active role at a specific branch; RBAC enforcement point |
| dentist_owner | Highest-privilege role; full access including staff/settings/reports |
| dentist_associate | Clinical role; full workspace; limited billing/reports |
| staff_full | Administrative role; scheduling, registration, payment recording |
| staff_scheduling | Restricted; calendar only |
| Fee Schedule | Pre-configured CDT code → price list per branch |
| Consent Template | Reusable consent form text per branch |
| orgTier / imagingTier | Subscription tiers gating feature access |

---

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-043 | Any staff | Branch-scoped login (membership select) | P0 |
| WF-004 | dentist_owner | Staff invitation + first login | P0 |
| WF-027 | dentist_owner | Staff member management | P0 |
| WF-025 | dentist_owner | Configure fee schedule | P1 |
| WF-026 | dentist_owner | Configure branch hours | P1 |
| WF-069 [INFERRED] | admin | Create organization | P0 |
| WF-070 [INFERRED] | dentist_owner, admin | Create branch | P0 |
| WF-072 [INFERRED] | dentist_owner | Membership revocation | P1 |
| WF-028 | dentist_owner | View audit log | P2 |
| WF-029 | dentist_owner | Export practice reports | P2 |

---

## 4. Workflow Details

### WF-004: Staff Invitation + First Login
**Actor:** dentist_owner
**Preconditions:** Organization and Branch exist
**Steps:**
1. Owner creates invitation (email, role assignment)
2. Better-Auth sends invitation email (WF-104)
3. Staff clicks link → sets password → membership activated
**Exception:** Expired invitation → resend required

### WF-025: Configure Fee Schedule
**Actor:** dentist_owner
**Preconditions:** Branch exists
**Steps:**
1. Load CDT code list for branch
2. Edit default price per procedure
3. Save — affects all new invoices immediately
**Rule:** Existing invoices unaffected (price snapshot at invoice creation time)

---

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-016 | IF any clinical/billing operation THEN assertBranchAccess must pass | All handlers | 403 FORBIDDEN if no membership |
| BR-016b | IF PIN fails ≥N times THEN account locked for lockout_duration | Membership | `pin_locked_until` set; login blocked |
| BR-016c | IF imagingTier < required THEN ceph features blocked | ImagingTier gate | 403 |
| BR-SCH-004 | IF appointment created THEN validate against branch working hours | Branch hours | Unless walk_in=true |

---

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Create/edit staff | dentist_owner | all others | assertBranchRole(dentist_owner) |
| Assign roles | dentist_owner | all others | — |
| Configure fee schedule | dentist_owner | all others | — |
| Configure branch hours | dentist_owner | all others | — |
| View audit log | dentist_owner | all others | — |
| Export reports | dentist_owner | all others | — |
| Read own membership | all roles | — | — |
| Create organization | admin (platform) | — | — |

---

## 7. Data Requirements

### `dental_organization`
| Field | Required | Description | Validation |
|-------|---------|-------------|-----------|
| id | Yes | UUID PK | baseEntityFields |
| name | Yes | Practice name | non-empty |
| country_code | Yes | ISO 3166-1 alpha-2 | [VERIFY locale list] |
| org_tier | Yes | Subscription tier | enum |
| owner_person_id | Yes | FK → person | Must exist |

### `dental_branch`
| Field | Required | Description | Validation |
|-------|---------|-------------|-----------|
| id | Yes | UUID PK | — |
| org_id | Yes | FK → dental_organization | — |
| name | Yes | Branch display name | — |
| address / city / timezone | Yes | Physical location | — |
| working_hours | No | JSON schedule | — |
| imaging_tier | Yes | Enum | gates imaging features |
| active | Yes | Boolean | default true |

### `dental_membership`
| Field | Required | Description | Validation |
|-------|---------|-------------|-----------|
| id | Yes | UUID PK | — |
| person_id | Yes | FK → person | — |
| branch_id | Yes | FK → dental_branch | — |
| member_role | Yes | dentist_owner / dentist_associate / staff_full / staff_scheduling | enum |
| member_status | Yes | active / inactive / invited | enum |
| pin_hash | No | Local PIN auth | bcrypt |
| pin_failed_attempts | No | Lockout counter | default 0 |
| pin_locked_until | No | Lockout timestamp | nullable |

### `dental_consent_template`
| Field | Required | Description | Validation |
|-------|---------|-------------|-----------|
| branch_id | Yes | FK → dental_branch | — |
| name | Yes | Template name | — |
| body | Yes | Full consent text | — |
| requires_witness_signature | Yes | Boolean | default false |
| active | Yes | Boolean | default true |

---

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Organization | Branch | — | Owns 1+ branches |
| Branch | Membership, FeeScheduleEntry, ConsentTemplate | WorkingHours (JSON), Address | All clinical data scoped to branch; assertBranchAccess enforced per BR-016 |
| Membership | — | — | One person+branch combination per active role |

---

## 8. State Transitions

### Membership Status
```
invited ──► active ──► inactive
```
| From | To | Trigger |
|------|----|---------|
| invited | active | Staff completes first login |
| active | inactive | Owner deactivates |
| inactive | active | Owner reactivates |

---

## 9. UI/UX Requirements

### Screen: Branch Settings
**Purpose:** Configure working hours, fee schedule, consent templates
**Users:** dentist_owner
**States:** Loading, Form, Saved, Validation error

### Screen: Staff Management
**Purpose:** Invite, edit roles, deactivate staff
**Users:** dentist_owner
**States:** List view, Invite modal, Role edit modal, Deactivation confirm

---

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /dental/orgs | Create org | name, country_code, owner | org | 422 |
| POST /dental/branches | Create branch | org_id, name, address | branch | 422 |
| GET /dental/branches/:id | Get branch | — | branch | 404 |
| POST /dental/memberships | Invite staff | branch_id, email, role | membership | 409 |
| PATCH /dental/memberships/:id | Update role/status | role, status | membership | 403, 422 |
| GET /dental/fee-schedule | Get fee schedule | branch_id | CDT list + prices | 404 |
| PATCH /dental/fee-schedule/:cdt | Update CDT price | price_cents | updated entry | 422 |
| GET /dental/dashboard | Practice summary | branch_id | summary stats | 403 |
| GET /dental/audit-events | Audit log | branch_id, filters | events[] | 403 |

---

## 10b. Domain Events

### Published
| Event | Trigger | Consumers |
|-------|---------|-----------|
| DE-022 MembershipAssigned | Staff invited + accepted | notifs (welcome), dental-audit |
| DE-023 MembershipRevoked [INFERRED] | Owner deactivates | dental-audit, session revoke |

### Consumed
| Event | Source | Side Effect |
|-------|--------|------------|
| (none — org is upstream) | — | — |

---

## 11. Acceptance Criteria

### AC-ORG-001: Branch access enforced
Given a user with no membership for branch B
When they request any clinical endpoint scoped to branch B
Then 403 FORBIDDEN is returned

### AC-ORG-002: Fee schedule affects new invoices
Given dentist_owner updates CDT D0120 price to $150
When a new invoice is created with D0120 line item
Then line item price defaults to $150

### AC-ORG-003: Staff invitation flow
Given dentist_owner sends invitation to new staff email
When staff completes first login
Then membership status transitions to `active`

---

## 12. Test Expectations

- Unit: assertBranchAccess gate (returns 403 for non-member)
- Unit: BR-016b PIN lockout counter increment and unlock
- Unit: BR-016c imagingTier gate blocks ceph endpoints
- Integration: invitation → first login → active membership
- Integration: fee schedule price visible in new invoice

---

## 13. Edge Cases

- Staff member invited to multiple branches — separate memberships, each independent
- Organization with zero active branches — dashboard returns empty
- Fee schedule entry for CDT code not in PRD list — allow (practice may have custom codes)
- PIN reset while locked — owner can manually clear `pin_locked_until`
- Membership deactivated while user has active session — session valid until expiry (ADR-007)

---

## 14. Dependencies

### Internal
- `person` (platform) — staff Person records
- `auth` (Better-Auth) — invitation emails, sessions
- `dental-billing` consumer — fee schedule lookup
- `dental-scheduling` consumer — branch working hours

### External
- Better-Auth invitation email flow
- OneSignal (membership notifications)

---

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| assertBranchAccess fails | 403 | "Access denied for this branch" |
| PIN locked | 403 + lockout expiry | "Account locked. Try again at [time]" |
| Duplicate membership | 409 | "Staff already has a membership at this branch" |
| Invalid CDT code format | 422 | "Invalid CDT code" |

---

## 16. Performance Expectations

- `assertBranchAccess`: < 50ms (cached session lookup)
- Fee schedule load: < 200ms (≤500 CDT entries/branch)
- Staff list: < 500ms (≤100 members/branch)
- Dashboard summary: < 2s (aggregated query)
- Concurrent: up to 100 concurrent branch members per branch

---

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|-------|-------|------|--------|------|
| dental-org.membership.created | INFO | Staff activated | membershipId, branchId, role | No |
| dental-org.membership.deactivated | INFO | Staff deactivated | membershipId, branchId | No |
| dental-org.access.denied | WARN | assertBranchAccess fails | branchId, personId (redacted) | No |
| dental-org.pin.locked | WARN | PIN lockout triggered | membershipId, attempts | No |

---

## 18. Feature Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| dental_org_ceph_tier_gate | ops | true | Gate ceph features by imagingTier |
| dental_org_pin_auth_enabled | ops | true | Enable PIN-based local auth |

---

## 19. Vertical Slice Plan

| Slice ID | Name | Description | Dependencies | Priority |
|----------|------|-------------|-------------|----------|
| ORG-S1 | Org + Branch creation | POST org, POST branch | person | P0 |
| ORG-S2 | Membership + assertBranchAccess | Invite staff, gate all clinical endpoints | auth | P0 |
| ORG-S3 | Fee schedule | CDT price management | — | P1 |
| ORG-S4 | Consent templates | Branch consent template CRUD | — | P1 |
| ORG-S5 | PIN auth + lockout | PIN set, verify, lockout | — | P2 |
| ORG-S6 | Dashboard + audit log | Practice summary, audit viewer | dental-audit | P2 |

---

## 20. AI Instructions

1. Do not implement the entire module at once — use vertical slices above.
2. `assertBranchAccess` must be called at the TOP of every clinical handler.
3. Use Hono + tRPC patterns from CONTRIBUTING.md; Drizzle ORM for all DB ops.
4. Branch-scope all queries: always include `branch_id` in WHERE clauses.
5. Keep terminology consistent with DOMAIN_GLOSSARY.md (Membership, Branch, Organization).
6. PIN auth is in addition to, not instead of, Better-Auth session auth.
7. Follow ARCHITECTURE.md, CONTRIBUTING.md, CLAUDE.md, VERTICAL_TDD.md.
