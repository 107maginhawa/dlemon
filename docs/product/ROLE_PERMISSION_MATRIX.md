<!--
oli: oli-prd-audit v1.0 | generated: 2026-05-24 | source: docs/prd/v3-dentalemon.md §6.6, ROLE_MATRIX.md, auth.ts
-->

# Role Permission Matrix — Dentalemon

> Sources: PRD §6.6, §9.3, `docs/architecture/ROLE_MATRIX.md`, `src/utils/auth.ts`. Tags: [PRD] = from PRD, [CODE] = from codebase.

---

## Actors

| Actor | System Role | Context Role | Auth Method |
|-------|------------|--------------|-------------|
| Alex — Dentist-Owner | `user` | `dentist_owner` (DentalMembership) | Email+password, passkey |
| Jamie — Dentist Associate | `user` | `dentist_associate` (DentalMembership) | Email+password, passkey |
| Sam — Front Desk (Full) | `user` | `staff_full` (DentalMembership) | Email+password |
| Pat — Scheduler | `user` | `staff_scheduling` (DentalMembership) | Email+password |
| Taylor — Patient | `user` | — (no DentalMembership) | Email+password, magic link |
| Platform Admin | `admin` | — | Email+password (admin-created) |
| Referring Provider | External | API key (limited) | API key |

---

## Module Permission Matrix

### PRD-defined Role Access (FR6.2)

| Module | Dentist-Owner | Dentist Associate | Staff – Full | Staff – Scheduling |
|--------|:------------:|:-----------------:|:------------:|:------------------:|
| Dashboard | Full | Own patients only | Schedule + follow-ups (no financials) | No access |
| Clinical Workspace | Full R/W | Full R/W | View-only + process payments | No access |
| Patient Records | Full CRUD | Read + Register | Read + Register | Read only |
| Scheduling | Full | Full | Full | Full |
| Billing | Full | Own patients + record payments | Record payments only | No access |
| Reports | Full | No access | No access | No access |
| Staff & Roles | Full | No access | No access | No access |
| Settings | Full | No access | No access | No access |

### Default Landing Page by Role

| Role | Landing Page |
|------|-------------|
| Dentist-Owner | Dashboard |
| Dentist Associate | Dashboard (filtered to own patients) |
| Staff – Full | Patient List |
| Staff – Scheduling | Calendar |
| Patient | Patient portal (Phase 2) |

---

## Detailed Permission Statements

### Clinical Write Operations

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|-----------|:---:|:---:|:---:|:---:|
| Create/edit visit | ✅ | ✅ | ❌ | ❌ |
| Add treatment | ✅ | ✅ | ❌ | ❌ |
| Update treatment status | ✅ | ✅ | ❌ | ❌ |
| Write prescription | ✅ | ✅ (prescriberMemberId req) | ❌ | ❌ |
| Create lab order | ✅ | ✅ | ❌ | ❌ |
| Sign visit notes | ✅ | ✅ | ❌ | ❌ |
| Create consent form | ✅ | ✅ | ❌ | ❌ |
| Upload attachment | ✅ | ✅ | ✅ | ❌ |
| Create amendment | ✅ | ✅ | ❌ | ❌ |

### Billing Write Operations

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|-----------|:---:|:---:|:---:|:---:|
| Create invoice | ✅ | Own patients only | ❌ | ❌ |
| Issue invoice | ✅ | Own patients only | ❌ | ❌ |
| Record payment | ✅ | ✅ | ✅ | ❌ |
| Void invoice | ✅ | ❌ | ❌ | ❌ |
| Create payment plan | ✅ | Own patients only | ❌ | ❌ |

### Administrative Operations

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|-----------|:---:|:---:|:---:|:---:|
| Create/edit staff | ✅ | ❌ | ❌ | ❌ |
| Assign roles | ✅ | ❌ | ❌ | ❌ |
| View audit log | ✅ | ❌ | ❌ | ❌ |
| Configure fee schedule | ✅ | ❌ | ❌ | ❌ |
| Configure branch hours | ✅ | ❌ | ❌ | ❌ |
| Export reports | ✅ | ❌ | ❌ | ❌ |
| Generate PMD | ✅ | ✅ | ❌ | ❌ |

---

## System-Level Roles (Better-Auth)

| Role | Capability |
|------|-----------|
| `admin` | Full platform access; user impersonation; system management |
| `user` | Authenticated session; capabilities further scoped by DentalMembership role |
| `support` | [INFERRED] Read-only audit access for support team |

## Better-Auth Access Control Statements

```typescript
// From src/utils/auth.ts
patient:  ['patient:read', 'patient:update', 'patient:consent:manage',
           'communication:send/read', 'file:upload/read']
provider: ['provider:read/update', 'patient:read/search',
           'communication:send/read', 'file:upload/read/download']
admin:    ['admin:*', 'patient:*', 'provider:*', 'communication:*',
           'file:*', 'audit:read', 'system:manage', 'user:impersonate']
```

---

## Gaps & Open Questions

| Gap | Priority |
|-----|---------|
| Associate "own patients" definition not enforced at DB level — verified by membership check only | P2 |
| Patient portal permissions undefined (Phase 2 scope) | P3 |
| Referring provider (external) API key scope not specified | P2 |
| Admin role can impersonate — no break-glass audit trail specified | P1 |
