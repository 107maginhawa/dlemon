# dental-org — File Enforcement
<!-- oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary
- Files scanned: 57 (19 handler/impl, 11 PascalCase shims/re-exports, 14 repos/schemas/facades, 13 test)
- Findings: 8 (P0: 0, P1: 4, P2: 3, P3: 1)
- Service files present: `.service.ts` ❌ (none), `.repo.ts` ✅ (`organization.repo.ts`, `membership.repo.ts`, `branch.repo.ts`)

## Findings

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EF-ORG-001 | P1 | Direct `db.select().from(...)` / `db.update(...)` in `branchSettings.ts` (84 lines) — contains 3 raw DB calls (lines 29, 45, 73, 79) without going through a repo. `branch.repo.ts` exists (47 lines) but `branchSettings.ts` bypasses it entirely, importing schema tables directly. | `branchSettings.ts` | 29, 45, 73, 79 |
| EF-ORG-002 | P1 | Direct `db.select().from(...)` / `db.update(...)` in `pinRecovery.ts` (114 lines) — contains raw DB calls (lines 48, 57) on `dentalMemberships` table directly, bypassing `membership.repo.ts`. | `pinRecovery.ts` | 48, 57 |
| EF-ORG-003 | P1 | Direct `db.select().from(...)` in `getBranchesByUser.ts` (39 lines) — queries `dentalMemberships` and `dentalBranches` inline (lines 22, 35) without repo delegation. Both repos exist. | `getBranchesByUser.ts` | 22, 35 |
| EF-ORG-004 | P1 | Direct `db.select().from(...)` in `consentTemplates.ts` (166 lines) — contains 4 raw DB calls (lines 36, 53, 115, 155) querying `dentalMemberships` and `dentalConsentTemplates`. No `consent-template.repo.ts` exists (only `consent-template.schema.ts`). Missing `.repo.ts` for the consent-template domain. | `consentTemplates.ts` | 36, 53, 115, 155 |
| EF-ORG-005 | P2 | `DentalMembershipManagement_create.ts` (74 lines) and `DentalMembershipManagement_verifyPin.ts` (91 lines) and `DentalMembershipManagement_setPin.ts` (52 lines) are **not** 9-line delegation shims — they contain full handler implementations with business logic, DB repo calls, and PIN/tier enforcement inline. These are PascalCase full implementations, not shims. The pattern is inconsistent: some `DentalXxx_*.ts` files are proper shims (e.g. `DentalBranchManagement_create.ts` at 37 lines delegates to `createBranch`), while others duplicate logic. Violates the PascalCase = shim-only convention. | `DentalMembershipManagement_create.ts`, `DentalMembershipManagement_verifyPin.ts`, `DentalMembershipManagement_setPin.ts` | — |
| EF-ORG-006 | P2 | `resetMemberPin.ts` (line 44) and `updateMember.ts` (line 47) contain direct `.from(dentalMemberships)` DB queries that bypass `membership.repo.ts`. `membership.repo.ts` (165 lines) exists and already abstracts membership queries. | `resetMemberPin.ts`, `updateMember.ts` | 44, 47 |
| EF-ORG-007 | P2 | `consent-template.schema.ts` exists (24 lines) but there is no `consent-template.repo.ts`. `consentTemplates.ts` (166 lines) does all DB work inline. Given consent templates are a distinct domain entity with CRUD operations, a repo is needed. | `repos/consent-template.schema.ts` | — |
| EF-ORG-008 | P3 | Stub files with 1-line re-exports exist for several handlers: `createConsentTemplate.ts` (1 line, re-exports from `consentTemplates.ts`), `deleteConsentTemplate.ts` (1 line), `getBranchSettings.ts` (1 line), `getWorkingHours.ts` (1 line), `listConsentTemplates.ts` (1 line), `recoverPin.ts` (1 line). These are re-export stubs rather than proper handler files. Acceptable as long as the canonical implementation in the consolidated file is well-structured, but causes confusion in the file listing — the module appears to have more handler files than it does. | `createConsentTemplate.ts`, `deleteConsentTemplate.ts`, `getBranchSettings.ts`, `getWorkingHours.ts`, `listConsentTemplates.ts`, `recoverPin.ts` | 1 |

## Notes on dental-audit Scope

No files in `services/api-ts/src/handlers/dental-org/` have dental-audit scope in their filenames. The `auth-security-hardening.test.ts` (356 lines) covers auth security scenarios for the org module — it belongs to dental-org. The `logAuditEvent` import in `DentalMembershipManagement_verifyPin.ts` calls into `handlers/audit/repos/audit.facade` — this is a cross-module facade call (permitted pattern), not an audit handler file living in dental-org.

## Notes on PascalCase Files

| File | Lines | Type | Status |
|------|-------|------|--------|
| `DentalBranchManagement_create.ts` | 37 | Shim | Delegates to `createBranch` — ALLOWED |
| `DentalBranchManagement_get.ts` | 31 | Shim | Delegates to `getBranch` — ALLOWED |
| `DentalBranchManagement_list.ts` | 27 | Shim | Delegates to `listBranches` — ALLOWED |
| `DentalMembershipManagement_create.ts` | 74 | **Full impl** | Contains tier-limit logic, repo calls — NOT a shim (EF-ORG-005) |
| `DentalMembershipManagement_deactivate.ts` | 52 | Shim-like | Delegates — ALLOWED |
| `DentalMembershipManagement_list.ts` | 46 | Shim-like | Delegates — ALLOWED |
| `DentalMembershipManagement_setPin.ts` | 52 | **Full impl** | Contains PIN hashing + repo calls — NOT a shim (EF-ORG-005) |
| `DentalMembershipManagement_verifyPin.ts` | 91 | **Full impl** | Contains PIN verify + lockout + audit log — NOT a shim (EF-ORG-005) |
| `DentalOrganizationManagement_create.ts` | 35 | Shim | Delegates to `createOrganization` — ALLOWED |
| `DentalOrganizationManagement_get.ts` | 29 | Shim | Delegates to `getOrganization` — ALLOWED |
| `DentalOrganizationManagement_update.ts` | 45 | Shim-like | Delegates — ALLOWED |

## File Inventory

### Root Handler Files

| File | Lines | Notes |
|------|-------|-------|
| `auth-security-hardening.test.ts` | 356 | Test only — dental-org scope |
| `branchSettings.ts` | 84 | Direct DB access — P1 (EF-ORG-001) |
| `consentTemplates.ts` | 166 | Direct DB access, missing consent repo — P1 (EF-ORG-004) |
| `createConsentTemplate.ts` | 1 | Re-export stub (EF-ORG-008) |
| `createMember.ts` | 94 | OK |
| `createOrganization.ts` | 52 | OK |
| `deactivateMember.ts` | 33 | OK |
| `deleteConsentTemplate.ts` | 1 | Re-export stub (EF-ORG-008) |
| `getBranchesByUser.ts` | 39 | Direct DB access — P1 (EF-ORG-003) |
| `getBranchSettings.ts` | 1 | Re-export stub (EF-ORG-008) |
| `getDashboardSummary.ts` | 42 | OK |
| `getOrgContext.ts` | 51 | OK |
| `getWorkingHours.ts` | 1 | Re-export stub (EF-ORG-008) |
| `listConsentTemplates.ts` | 1 | Re-export stub (EF-ORG-008) |
| `listMembers.ts` | 44 | OK |
| `memberTierLimits.ts` | (implied by test) | Business logic utility — OK |
| `pinRecovery.ts` | 114 | Direct DB access — P1 (EF-ORG-002) |
| `recoverPin.ts` | 1 | Re-export stub (EF-ORG-008) |
| `resetMemberPin.ts` | ~50 | Direct DB access (EF-ORG-006) |
| `updateMember.ts` | ~50 | Direct DB access (EF-ORG-006) |
| `verifyPin.ts` | (implied by test) | OK if delegates to repo |

### PascalCase Files (see Notes section above)

| File | Lines |
|------|-------|
| `DentalBranchManagement_create.ts` | 37 |
| `DentalBranchManagement_get.ts` | 31 |
| `DentalBranchManagement_list.ts` | 27 |
| `DentalMembershipManagement_create.ts` | 74 |
| `DentalMembershipManagement_deactivate.ts` | 52 |
| `DentalMembershipManagement_list.ts` | 46 |
| `DentalMembershipManagement_setPin.ts` | 52 |
| `DentalMembershipManagement_verifyPin.ts` | 91 |
| `DentalOrganizationManagement_create.ts` | 35 |
| `DentalOrganizationManagement_get.ts` | 29 |
| `DentalOrganizationManagement_update.ts` | 45 |

### Repo / Schema / Facade Files

| File | Lines | Notes |
|------|-------|-------|
| `repos/branch.repo.ts` | 47 | ✅ |
| `repos/branch.schema.ts` | 50 | ✅ |
| `repos/consent-template.schema.ts` | 24 | No matching `.repo.ts` (EF-ORG-007) |
| `repos/membership.repo.ts` | 165 | ✅ |
| `repos/membership.schema.ts` | 67 | ✅ |
| `repos/org-billing.facade.ts` | 38 | ✅ facade |
| `repos/org-imaging.facade.ts` | 56 | ✅ facade |
| `repos/org-scheduling.facade.ts` | 44 | ✅ facade |
| `repos/organization.repo.ts` | 67 | ✅ |
| `repos/organization.schema.ts` | 36 | ✅ |

### Test Files

| File | Lines | Notes |
|------|-------|-------|
| `auth-security-hardening.test.ts` | 356 | Security test |
| `createMember.test.ts` | 175 | Unit |
| `createOrganization.test.ts` | 134 | Unit |
| `deactivateMember.test.ts` | 143 | Unit |
| `dental-org.clinic-settings.test.ts` | 400 | Integration |
| `dental-org.dashboard-summary-extended.test.ts` | 256 | Integration |
| `dental-org.pin-recovery.test.ts` | 292 | Integration |
| `dental-org.staff-activity-visibility.test.ts` | 116 | Integration |
| `em-org-ownership.test.ts` | 249 | Integration |
| `getBranchesByUser.test.ts` | 100 | Unit |
| `getOrgContext.test.ts` | 219 | Unit |
| `listMembers.test.ts` | 189 | Unit |
| `memberTierLimits.test.ts` | 178 | Unit |
| `resetMemberPin.test.ts` | 195 | Unit |
| `updateMember.test.ts` | 205 | Unit |
| `verifyPin.test.ts` | 337 | Unit |
| `repos/branch.test.ts` | 178 | Repo unit |
| `repos/dental-staff.test.ts` | 168 | Repo unit |
| `repos/membership.test.ts` | 434 | Repo unit |
| `repos/organization.test.ts` | 177 | Repo unit |
