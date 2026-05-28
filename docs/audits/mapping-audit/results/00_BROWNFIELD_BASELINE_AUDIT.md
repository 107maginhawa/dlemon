# Brownfield Baseline Audit
**Date**: 2026-05-26  
**Auditor**: Journey Test Audit Orchestrator — Pass 01  
**Mode**: Read-only. No code modified.

---

## 1. Project Structure Summary

| Dimension | Value |
|---|---|
| **Project Name** | Monobase Healthcare / Dentalemon |
| **Version** | 0.1.0.1 |
| **Package Manager** | Bun 1.2.21 |
| **Monorepo Tool** | Bun workspaces (no Turborepo) |
| **Backend Framework** | Hono (TypeScript) |
| **Database ORM** | Drizzle ORM |
| **Database** | PostgreSQL |
| **Auth** | Better-Auth 3.x |
| **Frontend Framework** | Vite + TanStack Router (React 19) |
| **UI Library** | shadcn/ui (Radix primitives) + Tailwind CSS |
| **State/Data Fetching** | TanStack Query + TanStack Form |
| **API Design** | TypeSpec → OpenAPI → generated validators (spec-first) |
| **Test Framework (unit)** | Bun test |
| **Test Framework (E2E)** | Playwright |
| **Test Framework (contract)** | Hurl + Schemathesis |
| **Desktop Wrapper** | Tauri 2 (Rust) — optional, P2P sync via Cadence |

### Source Directories

| Path | Purpose |
|---|---|
| `apps/account/` | Reference user/auth/profile/settings app (Vite + TanStack Router) |
| `apps/dentalemon/` | **Primary** dental practice management app |
| `services/api-ts/` | TypeScript API implementation (Hono + Drizzle) |
| `services/api-ts-embedded/` | Rust crate bundling api-ts into QuickJS for Tauri |
| `services/cadence/` | Rust P2P sync engine (offline-first, not yet activated) |
| `specs/api/` | TypeSpec definitions → OpenAPI + TS types (`@monobase/api-spec`) |
| `packages/sdk-ts/` | Generated TanStack Query hooks + hand-written SDK client |
| `packages/eslint-config/` | Shared ESLint flat configs |
| `scripts/` | Seed, reset, contract test, audit-traceability scripts |

### Key API Stats

| Metric | Count |
|---|---|
| Total OpenAPI endpoints | 231 |
| Total paths | 165 |
| Contract (Hurl) test files | 35 |
| OpenAPI tags / module groups | 15+ |

---

## 2. Module Map

### 2A. Dental Business Modules (Primary)

| Module | Handler Path | Primary Entities | Related Frontend Route | Status |
|---|---|---|---|---|
| **dental-org** | `services/api-ts/src/handlers/dental-org/` | Organization, Branch, DentalMembership, ConsentTemplate, WorkingHours, PinAuth | `_dashboard/settings`, `_dashboard/staff`, `auth/pin-*` | ✅ Implemented |
| **dental-patient** | `services/api-ts/src/handlers/dental-patient/` | Patient, PatientAlert, PatientContact, PatientInsurance | `_dashboard/patients`, `_dashboard/patients/$patientId` | ✅ Implemented |
| **dental-scheduling** | `services/api-ts/src/handlers/dental-scheduling/` | Appointment, AppointmentCheckIn | `_dashboard/calendar` | ✅ Implemented |
| **dental-billing** | `services/api-ts/src/handlers/dental-billing/` | Invoice, Payment, PaymentPlan, Discount, CollectionSummary, PatientBalance | `_dashboard/billing`, `_workspace/$patientId` | ✅ Implemented |
| **dental-clinical** | `services/api-ts/src/handlers/dental-clinical/` | MedicalHistory, Treatment, Prescription, Attachment, LabOrder, Occlusion, PostOp | `_workspace/$patientId` | ✅ Implemented |
| **dental-imaging** | `services/api-ts/src/handlers/dental-imaging/` | ImagingStudy, Image, Finding, Measurement, CephLandmark, CephReport | `_workspace/$patientId`, `imaging-ceph-report.$imageId` | ✅ Implemented |
| **dental-perio** | `services/api-ts/src/handlers/dental-perio/` | PerioChart (BOP%, mean depth, deep pocket count) | `_workspace/$patientId` | ✅ Implemented |
| **dental-pmd** | `services/api-ts/src/handlers/dental-pmd/` | PMD (immutable signed clinical record, supersession chain) | `_workspace/$patientId` | ✅ Implemented |
| **dental-visit** | `services/api-ts/src/handlers/dental-visit/` | VisitRecord | `_workspace/$patientId` | ✅ Implemented |
| **dental-audit** | `services/api-ts/src/handlers/dental-audit/` | AuditEvent (queryable audit log) | `_dashboard/reports` | ✅ Implemented |
| **Recall / Task** | — | None | None | ❌ Missing |
| **Inventory** | — | None | None | ❌ Missing |
| **Insurance/Claims** | — | CDT code on treatment, ICD-10 on medical history; no InsuranceProfile/ClaimDraft | None | ⚠️ Partial |
| **Queue Board** | — | Appointment check-in exists; no QueueItem entity | `_workspace/queue-board` | ⚠️ Partial |

### 2B. Base Platform Modules (Monobase)

| Module | Handler Path | Purpose | Status |
|---|---|---|---|
| **person** | `src/handlers/person/` | User profile, PII safeguard | ✅ |
| **booking** | `src/handlers/booking/` | Time-based scheduling (slots, hosts, events) | ✅ |
| **billing** | `src/handlers/billing/` | Stripe Connect invoices | ✅ |
| **audit** | `src/handlers/audit/` | Pino structured compliance logging | ✅ |
| **notifs** | `src/handlers/notifs/` | Multi-channel notifications (OneSignal) | ✅ |
| **comms** | `src/handlers/comms/` | Real-time chat + WebRTC video | ✅ |
| **storage** | `src/handlers/storage/` | S3/MinIO file upload/download | ✅ |
| **email** | `src/handlers/email/` | Transactional email (SMTP/Postmark) | ✅ |
| **reviews** | `src/handlers/reviews/` | NPS review system | ✅ |

### 2C. Cross-Module Workflows

| Workflow | Modules Involved | Description |
|---|---|---|
| **Clinical → Billing Handoff** | dental-clinical + dental-billing | Treatment performed → invoice generation |
| **Dental Onboarding** | dental-org + person + auth | Org creation → branch → staff membership |
| **Patient Workspace** | dental-patient + dental-clinical + dental-billing + dental-imaging + dental-perio + dental-pmd | Full clinical workspace carousel for a patient |
| **New Patient Visit** | dental-scheduling + dental-patient + dental-clinical + dental-billing | Complete new patient exam journey |

---

## 3. Existing Specs/Docs Found

| Artifact | Path | Exists | Quality |
|---|---|---|---|
| ARCHITECTURE.md | `docs/architecture/ARCHITECTURE.md` | ✅ | Good |
| DOMAIN_MODEL.md | `docs/architecture/DOMAIN_MODEL.md` | ✅ | Exists (not audited) |
| ROLE_MATRIX.md | `docs/architecture/ROLE_MATRIX.md` | ✅ | Exists, used as source |
| ERROR_ENVELOPE.md | `docs/architecture/ERROR_ENVELOPE.md` | ✅ | Exists |
| OpenAPI spec | `specs/api/dist/openapi/openapi.json` | ✅ | 231 endpoints, canonical |
| TypeSpec sources | `specs/api/src/modules/` | ✅ | API-first source |
| Contract tests | `specs/api/tests/contract/*.hurl` | ✅ | 35 Hurl files |
| MODULES.md | `docs/context/MODULES.md` | ✅ | 9 dental + 9 base + infra |
| AUDIT_COVERAGE_MANIFEST.md | `docs/audits/AUDIT_COVERAGE_MANIFEST.md` | ✅ | Prior audit coverage |
| BROWNFIELD_STATUS.md | `docs/audits/BROWNFIELD_STATUS.md` | ✅ | Dashboard (stale) |
| DENTAL_SYSTEM_AUDIT_REPORT.md | `docs/audits/DENTAL_SYSTEM_AUDIT_REPORT.md` | ✅ | Prior system audit |
| DENTAL_GAP_REGISTRY.md | `docs/audits/DENTAL_GAP_REGISTRY.md` | ✅ | Gap tracking |
| IDEAL_COMPLIANCE_GAPS.md | `docs/audits/IDEAL_COMPLIANCE_GAPS.md` | ✅ | Standard gap analysis |
| TRACEABILITY_MATRIX.md | `docs/audits/archive/TRACEABILITY_MATRIX.md` | ✅ (archived) | Requirements traceability |
| TDD_PROOF artifacts | `docs/execution/slices/` | ✅ | 8 slices (P0-A→D + P1-001→004) |
| MASTER_PRD.md | `docs/product/MASTER_PRD.md` | ❌ | Not found |
| ROLE_PERMISSION_MATRIX.md | `docs/product/ROLE_PERMISSION_MATRIX.md` | ❌ | Not found (exists at `docs/architecture/ROLE_MATRIX.md`) |
| WORKFLOW_MAP.md | `docs/product/WORKFLOW_MAP.md` | ❌ | Not found |
| OLI audit artifacts | `docs/context/oli.md`, `docs/context/oli-execution-gate.md` | ✅ | Loaded via skill |
| VERTICAL_TDD.md | `docs/development/VERTICAL_TDD.md` | ✅ | Development protocol |
| CONTRIBUTING.md | `CONTRIBUTING.md` | ✅ | Dev workflow |
| CLAUDE.md | `CLAUDE.md` | ✅ | AI agent guidance |

**Note**: `MASTER_PRD.md` and `ROLE_PERMISSION_MATRIX.md` are not at the documented expected paths. The role matrix is at `docs/architecture/ROLE_MATRIX.md` instead.

---

## 4. Role Inventory

### 4A. System-Level Roles (Better-Auth)

| Role | Source | Capability | Enforced Where |
|---|---|---|---|
| `admin` | `session.user.role` | Full platform access, impersonation, system management | Middleware (`auth.ts`) |
| `user` | `session.user.role` | Authenticated session; scoped by DentalMembership role | Middleware |
| `support` | `session.user.role` | [INFERRED] Read-only audit access | Middleware |
| `client` | `session.user.role` | Booking client context | Middleware |
| `host` | `session.user.role` | Booking host context | Middleware |

### 4B. DentalMembership Roles (Branch-Scoped)

| Role | Access Tier | Permissions |
|---|---|---|
| `dentist_owner` | Owner | All operations: clinical write, billing write, configuration, user management |
| `dentist_associate` | Clinical Write | Clinical write, billing read only |
| `staff_full` | Full Staff | Clinical write, billing write, NO configuration |
| `staff_scheduling` | Scheduling Only | Scheduling read/write, clinical read, NO billing write |

**RBAC Implementation**:
- Read handlers: `assertBranchAccess` (membership check only)
- Write handlers: `assertBranchRole` (membership + role tier check)
- Invalid roles in tests: `superuser`, `superadmin` (tested as rejection cases)

### 4C. Role Gaps / Risks

| Gap | Evidence | Severity |
|---|---|---|
| `support` role inferred — no code found | Not found in handler code | P1 |
| PIN auth role (`pin-entry`) — unclear if bypasses session RBAC | `auth/pin-entry.$memberId.tsx` route exists | [NEEDS MANUAL CONFIRMATION] |
| Frontend role guards not audited — unknown if UI conditionals match backend tiers | No frontend role gate review yet | P1 |
| `dentist_associate` barely appears in tests | Role definition found in ROLE_MATRIX only | P1 |

---

## 5. Frontend Surface Summary

### 5A. apps/account — Reference App

| Route | Path | Purpose | Roles |
|---|---|---|---|
| Index redirect | `routes/index.tsx` | Redirect to dashboard or auth | Any |
| Auth | `routes/auth/$authView.tsx` | Login/register/reset | Unauthenticated |
| Onboarding | `routes/onboarding.tsx` | User onboarding flow | Authenticated |
| Email verify | `routes/verify-email.tsx` | Email verification | Authenticated |
| Dashboard layout | `routes/_dashboard.tsx` | Shell layout | Authenticated |
| Dashboard home | `routes/_dashboard/dashboard.tsx` | Summary dashboard | Authenticated |
| Bookings | `routes/_dashboard/bookings/index.tsx` | Booking list | Authenticated |
| Booking detail | `routes/_dashboard/bookings/$bookingId.tsx` | Single booking | Authenticated |
| Host directory | `routes/_dashboard/bookings/host.$personId.tsx` | Host's booking slots | Authenticated |
| Host slot | `routes/_dashboard/bookings/host.$personId.$slotId.tsx` | Specific slot | Authenticated |
| Devices | `routes/_dashboard/devices.tsx` | Device management | Authenticated |
| Licenses | `routes/_dashboard/licenses.tsx` | License management | Authenticated |
| Notifications | `routes/_dashboard/notifications.tsx` | Notification center | Authenticated |
| Storage | `routes/_dashboard/storage.tsx` | File storage | Authenticated |
| Settings: Account | `routes/_dashboard/settings/account.tsx` | Profile settings | Authenticated |
| Settings: Billing | `routes/_dashboard/settings/billing.tsx` | Billing/Stripe | Authenticated |
| Settings: Schedule | `routes/_dashboard/settings/schedule.tsx` | Schedule config | host |
| Settings: Security | `routes/_dashboard/settings/security.tsx` | Password/2FA | Authenticated |

### 5B. apps/dentalemon — Primary Dental App

| Route | Path | Purpose | Roles |
|---|---|---|---|
| Index redirect | `routes/index.tsx` | Redirect to dashboard or pin-select | Any |
| Auth | `routes/auth/$authView.tsx` | Better-Auth login/register | Unauthenticated |
| PIN Select | `routes/auth/pin-select.tsx` | Select member for PIN auth | Authenticated (org context) |
| PIN Entry | `routes/auth/pin-entry.$memberId.tsx` | Enter PIN for member | Authenticated |
| Onboarding | `routes/onboarding.tsx` | User onboarding | New user |
| Dashboard layout | `routes/_dashboard.tsx` | Main layout shell + sidebar | Authenticated |
| Dashboard | `routes/_dashboard/dashboard.tsx` | Practice summary | All members |
| Calendar | `routes/_dashboard/calendar.tsx` | Appointment calendar | All members |
| Patients list | `routes/_dashboard/patients.tsx` | Patient directory | All members |
| Patient detail | `routes/_dashboard/patients_/$patientId.tsx` | Patient info page | All members |
| Billing | `routes/_dashboard/billing.tsx` | Invoice / payments list | dentist_owner, staff_full |
| Reports | `routes/_dashboard/reports.tsx` | Reports/analytics | dentist_owner [NEEDS CONFIRMATION] |
| Settings | `routes/_dashboard/settings.tsx` | Practice settings | dentist_owner |
| Staff | `routes/_dashboard/staff.tsx` | Staff/membership management | dentist_owner |
| Dental Onboarding | `routes/_dashboard/dental-onboarding.tsx` | Org/branch setup wizard | dentist_owner |
| Workspace layout | `routes/_workspace.tsx` | Patient clinical workspace shell | All members |
| Patient workspace | `routes/_workspace/$patientId.tsx` | Full clinical workspace (carousel) | All members |
| Queue board | `routes/_workspace/queue-board.tsx` | Daily patient queue | All members |
| Ceph report | `routes/imaging-ceph-report.$imageId.tsx` | Ceph analysis report page | dentist_owner, dentist_associate [NEEDS CONFIRMATION] |

### 5C. Key UI Component Areas (dentalemon)

| Area | Path | Components |
|---|---|---|
| Shared UI primitives | `src/components/` | alert, avatar, badge, button, calendar, card, checkbox, combobox, datetime-filter, dialog, dropdown-menu, empty-state, form, input, pagination, phone-input, select, sheet, sidebar, skeleton, sonner, switch, table, tabs, textarea, tooltip |
| Patient workspace features | `src/features/workspace/` | Carousel, clinical tabs (chart, perio, imaging, billing, PMD) |
| Dental-specific features | `src/features/dental-*/` | Patient forms, appointment editor, invoice forms, perio chart, imaging viewer |
| App sidebar | `src/components/app-sidebar.tsx` | Navigation sidebar |

---

## 6. Backend / API Surface Summary

### 6A. API Tag Groups

| OpenAPI Tag | Path Prefix | Dental Handler | Count (approx) |
|---|---|---|---|
| `Dental:Org` | `/dental/orgs`, `/dental/branches`, `/dental/members`, `/dental/dashboard` | dental-org | ~25 |
| `Dental:Patient` | `/dental/patients` | dental-patient | ~15 |
| `Dental:Scheduling` | `/dental/appointments` | dental-scheduling | ~8 |
| `Dental:Billing` | `/dental/billing` | dental-billing | ~20 |
| `Dental:Clinical` | `/dental/clinical` | dental-clinical | ~40 |
| `Dental:Imaging` | `/dental/imaging` | dental-imaging | ~30 |
| `Comms` | `/comms` | comms | ~10 |
| `Booking` | `/bookings`, `/slots`, `/hosts` | booking | ~20 |
| `Person` | `/person` | person | ~10 |
| `Billing` | `/billing` | billing | ~15 |
| `Storage` | `/storage` | storage | ~5 |
| `Notifs` | `/notifs` | notifs | ~5 |
| `Email` | `/email` | email | ~3 |
| `Reviews` | `/reviews` | reviews | ~5 |
| `Audit` | `/audit` | audit | ~5 |

### 6B. Middleware Stack

| Middleware | File | Purpose |
|---|---|---|
| Auth | `src/middleware/auth.ts` | Session validation, role-based access (reads from session, no DB query) |
| Security | `src/middleware/security.ts` | Security headers (tested: `security.test.ts`) |
| Validation | `src/middleware/validation.ts` | Request body/param validation |
| Expand | `src/middleware/expand.ts` | Response expansion (include related entities) |
| Dependency | `src/middleware/dependency.ts` | DI container |
| Metrics | `src/middleware/metrics-middleware.ts` | Performance metrics |
| Request | `src/middleware/request.ts` | Request context setup |

**Key pattern**: Auth middleware reads roles from `session.user.role`. DentalMembership RBAC is enforced in handlers via `assertBranchAccess` / `assertBranchRole` (not in middleware).

### 6C. Known Missing Backend Areas

| Gap | Severity |
|---|---|
| Recall / Task handler — no entity, no endpoint | P1 |
| Inventory handler — no entity, no endpoint | P1 |
| InsuranceProfile / ClaimDraft entity — no handler | P1 |
| Offline-first sync metadata (syncStatus, localId, SyncLog) | P2 |
| QueueItem entity — no dedicated handler | P2 |

---

## 7. Test Structure Summary

### 7A. Test Counts

| Layer | Location | Files | Notes |
|---|---|---|---|
| Backend unit/integration | `services/api-ts/src/handlers/**/*.test.ts` | ~97 | Covers 9/11 dental modules |
| Frontend unit/component | `apps/dentalemon/src/**/*.test.ts(x)` | ~126 | Strong for workspace; thin for billing, calendar |
| Playwright E2E (dentalemon) | `apps/dentalemon/tests/e2e/` | 40+ specs | See list below |
| Playwright E2E (account) | `apps/account/tests/e2e/` | 6 specs | billing, booking, comms, dental-license, onboarding, person |
| Contract/Hurl | `specs/api/tests/contract/*.hurl` | 35 | Full TypeSpec pipeline coverage |
| Journey E2E | `apps/dentalemon/tests/e2e/journeys/` | 7 journey specs | 01-07 clinical journeys |
| TDD proof artifacts | `docs/execution/slices/` | 8 | P0-A→D, P1-001→004 |

### 7B. Playwright E2E Spec List (dentalemon/main)

| Spec File | Journey Covered |
|---|---|
| `action-contracts.spec.ts` | API action shape contracts |
| `add-staff.spec.ts` | Add member workflow |
| `api-error-paths.spec.ts` | API error handling |
| `attachments.spec.ts` | File attachment upload/retrieve |
| `auth-gates.spec.ts` | Auth protection |
| `auth-pin.spec.ts` | PIN auth flow |
| `billing-queue-morgan.spec.ts` | Billing queue (Morgan persona) |
| `billing.spec.ts` | Invoice/payment flow |
| `calendar-riley.spec.ts` | Calendar (Riley persona) |
| `calendar.spec.ts` | Calendar general |
| `clinical-billing-handoff.spec.ts` | Treatment → invoice |
| `consent-signing.spec.ts` | Consent template signing |
| `dental-onboarding.spec.ts` | Practice onboarding |
| `first-launch.spec.ts` | First launch experience |
| `imaging-annotation.spec.ts` | Image annotation |
| `imaging-ceph-export.spec.ts` | Ceph report export |
| `imaging-ceph.spec.ts` | Ceph analysis |
| `imaging-comparison.spec.ts` | Image comparison |
| `imaging-findings.spec.ts` | Imaging findings |
| `imaging-measurement.spec.ts` | Ceph measurements |
| `invoice-detail.spec.ts` | Invoice detail view |
| `ipad-calendar.spec.ts` | iPad calendar layout |
| `ipad-imaging.spec.ts` | iPad imaging layout |
| `ipad-perio-charting.spec.ts` | iPad perio chart layout |
| `ipad-workspace.spec.ts` | iPad workspace layout |
| `journeys/01-new-patient-exam.journey.spec.ts` | New patient full exam |
| `journeys/02-periodic-recall.journey.spec.ts` | Recall visit |
| `journeys/03-perio-charting.journey.spec.ts` | Perio chart journey |
| `journeys/04-revenue-chain.journey.spec.ts` | Treatment → billing chain |
| `journeys/05-status-integrity.journey.spec.ts` | Status machine integrity |
| `journeys/06-phased-plan-sequencing.journey.spec.ts` | Treatment plan sequencing |
| `journeys/07-granularity-dentition.journey.spec.ts` | Dentition granularity |
| `patient-checkin.spec.ts` | Appointment check-in |
| `patient-registration.spec.ts` | New patient registration |
| `payment-plan.spec.ts` | Payment plan flow |
| `pmd-generation.spec.ts` | PMD document generation |
| `prescribe-medication.spec.ts` | Prescription flow |
| `returning-patient-visit.spec.ts` | Returning patient visit |
| `safety-floor.spec.ts` | Safety/guard floor tests |
| `walk-in.spec.ts` | Walk-in patient |
| `workspace-empty-states.spec.ts` | Empty state handling |
| `workspace-readonly.spec.ts` | Read-only workspace mode |
| `lab-order-tracking.spec.ts` | Lab order tracking |
| `payment-plan.spec.ts` | Payment plan creation |

### 7C. Hurl Contract Test Files (35)

Covers: audit, auth (signup/signin/reset/verification), billing (lifecycle + standard), booking (edge/event/exceptions/flow/search), comms (edge + standard), CORS, dental (billing/clinical/imaging/org/patient/pmd/scheduling/visit), email, errors, expand (edge + standard), health (verbose + standard), notifs, person (lifecycle + validation), reviews, storage (edge + standard).

### 7D. Test Quality Assessment (Preliminary)

| Layer | Status | Known Gaps |
|---|---|---|
| Backend unit | STRONG for 9/11 modules | Recall, Inventory modules missing entirely |
| Contract (Hurl) | STRONG | Full pipeline; Schemathesis fuzz available |
| Frontend unit | MIXED | Strong for workspace; thin for billing/calendar components |
| E2E Journeys | STRONG (existence) | Actual pass/fail status not confirmed — may run against stubs |
| Role denial tests | PARTIAL | `assertBranchRole` tested in dental-org; frontend role gates not confirmed tested |
| Error path tests | PARTIAL | `api-error-paths.spec.ts` exists but depth unknown |
| Empty state tests | PARTIAL | `workspace-empty-states.spec.ts` exists; completeness unknown |
| iPad layout | EXISTS | `ipad-workspace.spec.ts`, `ipad-calendar.spec.ts`, etc. |

---

## 8. Key Risks

| # | Risk | Evidence | Severity |
|---|---|---|---|
| R-01 | **E2E specs in worktree not on main** | Many specs found in `.worktrees/workspace-reconciliation/` — unclear if merged | P0 |
| R-02 | **Test file inside routes dir** | `apps/dentalemon/src/routes/_workspace/$patientId.test.ts` — unusual placement | P1 |
| R-03 | **Frontend role gates unconfirmed** | UI role conditionals not audited; `staff_scheduling` may see billing UI | P1 |
| R-04 | **PIN auth session interaction unclear** | `pin-entry.$memberId.tsx` — does PIN login replace or layer on top of Better-Auth session? | P1 |
| R-05 | **`dentist_associate` coverage thin** | Role defined in ROLE_MATRIX but rarely appears in test fixtures | P1 |
| R-06 | **Queue board has no backend entity** | `_workspace/queue-board.tsx` exists; no QueueItem handler found | P1 |
| R-07 | **`MASTER_PRD.md` missing at documented path** | Documented path `docs/product/MASTER_PRD.md` returns 404 | P2 |
| R-08 | **Recall/Task module fully missing** | No entity, no handler, no frontend route | P1 |
| R-09 | **Inventory module fully missing** | No entity, no handler, no frontend route | P1 |
| R-10 | **Offline/local-first not activated** | Cadence sync engine exists but `TODO` stubs in Tauri wrapper | P2 |
| R-11 | **Ceph report route roles unclear** | `imaging-ceph-report.$imageId.tsx` — who can access? No role guard confirmed | P1 |
| R-12 | **Prior domain consistency audit: 14 findings open** | `docs/audits/` has findings from prior audits — status not confirmed resolved | P1 |
| R-13 | **Dual-layer RBAC complexity** | System roles (Better-Auth) + DentalMembership roles — integration points need mapping | P1 |
| R-14 | **Reports page role access unconfirmed** | `_dashboard/reports.tsx` — dentist_owner only or all members? Backend not checked | P1 |

---

## 9. Module Audit Queue

> This queue drives the per-module execution of audits 02–08.  
> Ordered by: Auth/Permission first → App Shell → Business Modules (critical path first) → Cross-Module → Shared → Infrastructure.

| Order | Module/Area | Type | Source Paths (Frontend) | Source Paths (Backend) | Frontend Routes | Backend APIs | Roles Involved | Tests Found | Priority |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Auth / Login / Session / PIN Auth** | Auth/Permission | `apps/dentalemon/src/routes/auth/`, `apps/account/src/routes/auth/` | `services/api-ts/src/core/auth.ts`, `src/middleware/auth.ts`, `src/utils/auth.ts`, `src/handlers/dental-org/DentalMembership*` | `/auth/$authView`, `/auth/pin-select`, `/auth/pin-entry.$memberId` | `/api/auth/*` (Better-Auth), `/dental/members/*/pin/verify` | unauthenticated, all roles | `auth.test.ts`, `auth-gates.spec.ts`, `auth-pin.spec.ts`, `dental-auth-module7.test.ts` | P0 |
| 2 | **App Shell / Layout / Sidebar / Navigation** | App Shell | `apps/dentalemon/src/components/app-sidebar.tsx`, `src/routes/_dashboard.tsx`, `src/routes/_workspace.tsx` | — | `_dashboard.tsx`, `_workspace.tsx` | None | All authenticated | `app-sidebar` tests if any | P0 |
| 3 | **Dental Org — Org, Branch, Membership, Settings** | Business Module | `apps/dentalemon/src/routes/_dashboard/settings.tsx`, `staff.tsx`, `dental-onboarding.tsx` | `handlers/dental-org/` | `/settings`, `/staff`, `/dental-onboarding` | `/dental/orgs`, `/dental/branches/*`, `/dental/members/*`, `/dental/dashboard/summary` | dentist_owner, dentist_associate, staff_full, staff_scheduling | `createMember.test.ts`, `createOrganization.test.ts`, `deactivateMember.test.ts`, `getBranchesByUser.test.ts`, `dental-org-module6.test.ts`, `dental-settings-module11.test.ts`, `add-staff.spec.ts`, `dental-onboarding.spec.ts`, `dental-org.hurl` | P0 |
| 4 | **Dental Patient — Patient Management** | Business Module | `apps/dentalemon/src/routes/_dashboard/patients.tsx`, `patients_/$patientId.tsx` | `handlers/dental-patient/` | `/patients`, `/patients/$patientId` | `/dental/patients/*` | All members | `dental-patient-module10.test.ts`, `dental-patient.hurl`, `patient-registration.spec.ts` | P0 |
| 5 | **Dental Scheduling — Calendar, Appointments** | Business Module | `apps/dentalemon/src/routes/_dashboard/calendar.tsx`, `_workspace/queue-board.tsx` | `handlers/dental-scheduling/` | `/calendar`, `/queue-board` | `/dental/appointments/*` | All members | `dental-scheduling.hurl`, `calendar.spec.ts`, `ipad-calendar.spec.ts`, `patient-checkin.spec.ts` | P0 |
| 6 | **Dental Billing — Invoices, Payments, Collections** | Business Module | `apps/dentalemon/src/routes/_dashboard/billing.tsx`, `_workspace/$patientId` (billing tab) | `handlers/dental-billing/` | `/billing`, workspace billing tab | `/dental/billing/*` | dentist_owner, staff_full | `dental-billing-module2.test.ts`, `dental-billing-module3.test.ts`, `dental-billing-module4.test.ts`, `dental-billing.hurl`, `billing.spec.ts`, `invoice-detail.spec.ts`, `payment-plan.spec.ts` | P0 |
| 7 | **Dental Clinical — Treatments, Medical History, Prescriptions, Attachments** | Business Module | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` (clinical tabs) | `handlers/dental-clinical/` | `/workspace/$patientId` | `/dental/clinical/*` | dentist_owner, dentist_associate, staff_full | `dental-clinical-module9.test.ts`, `dental-clinical.hurl`, `prescribe-medication.spec.ts`, `attachments.spec.ts`, `consent-signing.spec.ts` | P0 |
| 8 | **Dental Imaging — Studies, Ceph Analysis** | Business Module | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` (imaging tab), `imaging-ceph-report.$imageId.tsx` | `handlers/dental-imaging/` | workspace imaging tab, `/imaging-ceph-report/$imageId` | `/dental/imaging/*` | dentist_owner, dentist_associate | `imaging-coverage.test.ts`, `dental-imaging.hurl`, `imaging-ceph.spec.ts`, `ipad-imaging.spec.ts` | P1 |
| 9 | **Dental Perio — Periodontal Chart** | Business Module | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` (perio tab) | `handlers/dental-perio/` | workspace perio tab | `/dental/clinical/perio/*` | dentist_owner, dentist_associate, staff_full | `dental-perio.test.ts`, `ipad-perio-charting.spec.ts`, journey 03 | P1 |
| 10 | **Dental PMD — Patient Medical Documents** | Business Module | `apps/dentalemon/src/routes/_workspace/$patientId.tsx` (PMD tab) | `handlers/dental-pmd/` | workspace PMD tab | `/dental/clinical/pmd/*` | dentist_owner, dentist_associate | `dental-pmd.test.ts`, `dental-pmd.hurl`, `pmd-generation.spec.ts` | P1 |
| 11 | **Patient Workspace — Clinical Carousel / Workspace Shell** | Cross-Module Workflow | `apps/dentalemon/src/routes/_workspace.tsx`, `_workspace/$patientId.tsx`, features/workspace | Multiple dental handlers | `/workspace/$patientId` | All dental APIs | All members | `_workspace/$patientId.test.ts`, `ipad-workspace.spec.ts`, `workspace-empty-states.spec.ts`, `workspace-readonly.spec.ts`, journey specs 01-07 | P0 |
| 12 | **Clinical → Billing Handoff** | Cross-Module Workflow | workspace clinical + billing tabs | dental-clinical + dental-billing | workspace | `/dental/clinical/*`, `/dental/billing/*` | dentist_owner, staff_full | `clinical-billing-handoff.spec.ts`, journey 04 | P0 |
| 13 | **Dashboard / Reports** | Business Module | `apps/dentalemon/src/routes/_dashboard/dashboard.tsx`, `reports.tsx` | `handlers/dental-org/dental-dashboard-module5.test.ts`, `handlers/dental-audit/` | `/dashboard`, `/reports` | `/dental/dashboard/summary`, `/audit/*` | All members (dashboard), dentist_owner (reports) | `dental-dashboard-module5.test.ts` | P1 |
| 14 | **Dental Onboarding Flow** | Cross-Module Workflow | `apps/dentalemon/src/routes/onboarding.tsx`, `_dashboard/dental-onboarding.tsx` | dental-org | `/onboarding`, `/dental-onboarding` | `/dental/orgs`, `/dental/branches` | New user, dentist_owner | `dental-onboarding.spec.ts`, `first-launch.spec.ts` | P1 |
| 15 | **Base Platform — Person, Booking, Comms, Storage, Notifs** | Shared Backend | `apps/account/src/features/booking/`, `comms/`, `storage/`, `notifs/` | `handlers/booking/`, `comms/`, `storage/`, `notifs/`, `person/` | account app routes | Base API paths | All authenticated | `booking-coverage.test.ts`, `comms.spec.ts`, `booking.spec.ts`, `booking-*.hurl` | P2 |
| 16 | **Shared Frontend Components / UI** | Shared Frontend | `apps/dentalemon/src/components/`, `apps/account/src/components/` | — | — | — | All | `datetime-filter.test.tsx`, `phone-input.test.tsx`, `empty-state.test.ts`, `image-cropper-dialog.test.tsx` | P2 |
| 17 | **Permission / RBAC Middleware** | Auth/Permission | — (backend only) | `services/api-ts/src/middleware/auth.ts`, `src/utils/auth.ts`, `src/handlers/*/utils/authorization.ts` | — | All dental endpoints | All roles | `auth.test.ts`, `security.test.ts`, RBAC test suites in dental-org | P0 |
| 18 | **CI / Test Setup / Contract Layer** | Infrastructure/Test | `.github/workflows/`, `scripts/` | `specs/api/tests/contract/`, `scripts/run-contract-tests.ts`, `scripts/audit-traceability.ts` | — | — | — | All Hurl files, `contract.yml` | P1 |

---

## 10. Recommended Next Step

**Run Audit 02 (Role-Permission Map)** starting with the highest-priority modules:

1. **Module 17 — Permission / RBAC Middleware** (cross-cutting baseline for all other modules)
2. **Module 1 — Auth / Login / Session / PIN Auth** (security foundation)
3. **Module 3 — Dental Org** (first business module with membership/role management)

These three modules establish the complete role and permission map before diving into feature modules.

**Gate 2 Criteria** (must pass before proceeding to audit 03):
- All roles discovered and documented
- All role enforcement mechanisms identified (frontend + backend)
- All gaps and mismatches flagged
- Role-to-route mapping table exists for every detected route
