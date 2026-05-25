<!--
oli: oli-audit-codebase v1.0 | generated: 2026-05-24 | cycle: fresh (--auto)
source: services/api-ts/src + apps/dentalemon/src | depth: deep
prev: archived as EXISTING_CODEBASE_ADOPTION_AUDIT.pre-2026-05-24.md (not yet renamed)
-->

# Existing Codebase Adoption Audit

**Project**: Monobase Healthcare — Dentalemon Dental Practice Management SaaS
**Audit Date**: 2026-05-24
**Auditor**: oli-audit-codebase (fresh, --auto)
**Codebase Health Score**: **7.4 / 10**

---

## Table of Contents

1. Executive Summary
2. Module Discovery
3. Domain Terms
4. Permission Matrix
5. Business Rules
6. API Surface
7. State Machines
8. UI / Screens Audit
9. Test Coverage
10. Security Audit (OWASP Top 10)
11. Observability Audit
12. Performance Audit
13. Inconsistencies
14. Stubs & TODO Inventory
15. Type Cast Density
16. Cross-Module Import Violations
17. Cross-Module Raw SQL
18. Repo Guardrails
19. Spec Coverage
20. Standards Gap Matrix
21. Stabilization & Adoption Plan

---

## 1. Executive Summary

Dentalemon is a **well-structured dental practice management platform** built on Monobase (Bun + Hono + Drizzle + PostgreSQL). The architecture is spec-first (TypeSpec → OpenAPI → generated routes), domain-isolated, and healthcare-aware (PHI caching headers, ASVS L2, branch-scoped access guards).

**Strengths:**
- TypeSpec-first API (231 endpoints, 165 paths) with generated validators
- Clear state machines with enforced transitions (visit, treatment, invoice, appointment)
- 22 documented business rules, 17 tested in integration tests
- CSRF guard, HSTS, CSP, PHI cache-control headers
- 135 backend tests + 51 Playwright E2E tests
- Structured Pino logging with X-Request-ID propagation

**Gaps requiring attention:**
- 183 `as any` casts in production handlers (P2)
- BR-019 (supervisor approval) and BR-020 (patient merge) not implemented (P1)
- Booking jobs have runtime `throw new Error('not implemented')` (P1)
- `dental-clinical` tightly coupled to `dental-visit` repos (P1)
- MODULE_SPECs at wrong path (`docs/modules/` not `docs/product/modules/`)
- `tdd_mode: false` and `agent_skills: {}` in config — graduation at risk

**Graduation threshold**: ≥9.0 (clinical dental product — PHI, treatment decisions, prescriptions, billing all carry legal/clinical risk)

---

## 2. Module Discovery

### 2a. Dental Domain Modules (primary scope)

| Module | Path | Test Files | Description |
|--------|------|-----------|-------------|
| dental-billing | `handlers/dental-billing/` | 11 | Invoices, payment plans, line items, payments |
| dental-clinical | `handlers/dental-clinical/` | 12 | Prescriptions, lab orders, consent forms, medical history, attachments, amendments |
| dental-imaging | `handlers/dental-imaging/` | 5 | Imaging studies, images, annotations, ceph analysis |
| dental-org | `handlers/dental-org/` | 18 | Organizations, branches, memberships |
| dental-patient | `handlers/dental-patient/` | 6 | Dental patient records |
| dental-pmd | `handlers/dental-pmd/` | 3 | Portable Medical Documents |
| dental-scheduling | `handlers/dental-scheduling/` | 7 | Appointments, working hours |
| dental-visit | `handlers/dental-visit/` | 16 | Visits, treatments, notes, charts, templates |

### 2b. Base Platform Modules (inherited from monobase)

| Module | Path | Description |
|--------|------|-------------|
| audit | `handlers/audit/` | Compliance event logging (Pino) |
| billing | `handlers/billing/` | Stripe Connect invoices (base) |
| booking | `handlers/booking/` | Generic time-based scheduling |
| comms | `handlers/comms/` | Real-time chat + WebRTC |
| email | `handlers/email/` | Transactional email (SMTP/Postmark) |
| emr | `handlers/emr/` | Electronic medical records |
| notifs | `handlers/notifs/` | Multi-channel notifications (OneSignal) |
| patient | `handlers/patient/` | Base patient records (PII) |
| person | `handlers/person/` | Central PII safeguard |
| provider | `handlers/provider/` | Provider profiles |
| reviews | `handlers/reviews/` | NPS review system |
| shared | `handlers/shared/` | `assertBranchAccess`, `assertBranchRole` guards |
| storage | `handlers/storage/` | S3/MinIO file storage |

### 2c. Frontend Apps

| App | Path | Framework | Description |
|-----|------|-----------|-------------|
| dentalemon | `apps/dentalemon/` | Vite + React + TanStack Router | Main dental workspace UI |
| account | `apps/account/` | Vite + React + TanStack Router | Auth, profile, settings (base) |
| sample-workspace | `apps/sample-workspace/` | Vite | Design reference (non-production) |

---

## 3. Domain Terms

### Core Entities

| Term | Type | Status Field | Notes |
|------|------|-------------|-------|
| DentalOrganization | Aggregate Root | active/inactive | Top-level tenant |
| DentalBranch | Entity | — | Clinic location; access scope unit |
| DentalMembership | Entity | `member_status` enum | Staff record linking person → branch |
| Patient | Entity | — | Cross-module; linked via `patient_id` UUID |
| Person | Value Object | — | PII container; person_id on patient |
| DentalVisit | Aggregate Root | `draft/active/completed/locked/discarded` | Clinical encounter |
| DentalTreatment | Entity | `diagnosed/planned/performed/verified/dismissed` | Procedure within visit |
| VisitNotes | Entity | `signed: boolean` | SOAP notes, append-only versions |
| VisitNoteVersion | Value Object | — | Immutable snapshot |
| ConsentForm | Entity | `pending/signed/revoked` | [VERIFY] |
| LabOrder | Entity | `pending/sent/completed/cancelled` | [VERIFY] |
| Prescription | Entity | FSM [VERIFY] | Requires `prescriberMemberId` |
| MedicalHistoryEntry | Entity | — | Append-only |
| Amendment | Entity | — | Audit correction record |
| ImagingStudy | Aggregate Root | `active/archived` | Radiology session |
| ImagingStudyImage | Entity | `active/archived` | Individual file |
| ImagingAnnotation | Entity | — | Per-image annotation |
| DentalInvoice | Aggregate Root | `draft/issued/partial/paid/overdue/voided` | Billing record |
| DentalInvoiceLineItem | Entity | — | Derived from treatments |
| DentalPaymentPlan | Entity | — | Installment plan |
| DentalAppointment | Entity | FSM [VERIFY] | Scheduled visit |
| PMDDocument | Aggregate Root | — | Portable export |
| TreatmentTemplate | Entity | — | Reusable treatment bundle |

### Key Status Enums

| Enum | Values |
|------|--------|
| `dental_visit_status` | `draft, active, completed, locked, discarded` |
| `dental_treatment_status` | `diagnosed, planned, performed, verified, dismissed` |
| `dental_invoice_status` | `draft, issued, partial, paid, overdue, voided` |
| `imaging_modality` | `periapical, bitewing, panoramic, cephalometric, cbct, intraoral, other` |
| `imaging_status` | `active, archived` |
| `member_role` (inferred) | `dentist_owner, dentist_associate, staff_full, staff_scheduling` |

---

## 4. Permission Matrix

### System Roles (Better-Auth)

| Role | Permissions |
|------|-------------|
| `admin` | `admin:*`, `patient:*`, `provider:*`, `communication:*`, `file:*`, `audit:read`, `system:manage`, `user:impersonate` |
| `provider` | `provider:read/update`, `patient:read/search`, `communication:send/read`, `file:upload/read/download` |
| `patient` | `patient:read/update/consent:manage`, `communication:send/read`, `file:upload/read` |
| `user` | Any authenticated user (lowest tier) |
| `support` | [INFERRED] Support role |

### Dental Branch Roles (Membership)

| Role | Description | Enforced By |
|------|-------------|-------------|
| `dentist_owner` | Full clinical + admin rights | `assertBranchRole` |
| `dentist_associate` | Clinical rights, no admin | `assertBranchRole` |
| `staff_full` | Admin without clinical | `assertBranchRole` |
| `staff_scheduling` | Scheduling-only | `assertBranchRole` |

### Access Guards

| Guard | File | Usage |
|-------|------|-------|
| `assertBranchAccess` | `shared/assert-branch-access.ts` | Verify membership exists for branch (BR-016) |
| `assertBranchRole` | `shared/assert-branch-role.ts` | Verify specific role for clinical action |
| `authMiddleware` | `middleware/auth.ts` | Session-based role check, no DB queries |

**Gap**: `authMiddleware` uses string role splitting (`role.split(',')`) — no structured role hierarchy enforcement. Role escalation risk if comma-separated role string is ever written from user input.

---

## 5. Business Rules

### Full Catalog (from `docs/prd/BUSINESS_RULES.md` + `business-rules.test.ts`)

| ID | Rule | Type | Status | Test Coverage |
|----|------|------|--------|---------------|
| BR-001 | Only one active visit per patient at a time (DB partial unique index) | Constraint | implemented | STRONG |
| BR-002 | Visit can only be activated if patient has no other active visit | State guard | implemented | STRONG |
| BR-003 | Completed visit cannot be re-opened | State guard | implemented | STRONG |
| BR-004 | Treatments can only be added to active visits | Validation | implemented | STRONG |
| BR-005 | Auto-discard empty visits on completion | Business logic | deferred | NONE |
| BR-006 | Treatment transitions are forward-only: diagnosed→planned→performed→verified; dismissed reachable from any non-terminal | State guard | partial | WEAK (FSM property test exists) |
| BR-007 | Completed treatment is immutable (CDT code, tooth, surface, price) | State guard | implemented | STRONG |
| BR-008 | Carried-over treatments are visual indicator only, not auto-charged | Business logic | implemented (UI) | NONE (backend) |
| BR-009 | Invoice requires at least one treatment line item | Validation | implemented | STRONG |
| BR-010 | Tax always 0 (stub, pending per-country rules) | Calculation stub | partial | NONE |
| BR-011 | Active payment plan blocks invoice void/uncollectible | Lifecycle guard | implemented | STRONG |
| BR-012 | Invoice state lifecycle: draft→issued→partial→paid/overdue/voided | State machine | implemented | STRONG |
| BR-013 | markUncollectible not applicable to dental invoices (status enum closed) | Deferred | deferred | NONE |
| BR-014 | Consent forms must be signed before treatment proceeds [VERIFY] | Compliance | [VERIFY] | [VERIFY] |
| BR-015 | Lab orders linked to visits, status managed by staff | Workflow | implemented | WEAK |
| BR-016 | Branch membership required for all clinical data access | Authorization | implemented | STRONG |
| BR-017 | Prescription creation requires prescriberMemberId (dentist role) | Authorization | implemented | STRONG |
| BR-018 | Invoice voiding from paid state permitted (admin correction) | State override | implemented | STRONG |
| BR-019 | Treatment amendments require supervisor approval | Authorization | **NOT IMPLEMENTED** | NONE |
| BR-020 | Patient record merge | Workflow | **NOT IMPLEMENTED** | NONE |
| BR-021 | PMD generation requires completed visit | Precondition | implemented | STRONG |
| BR-022 | PMD import creates patient/visit/treatment records | Import workflow | implemented | STRONG |

**Rule classification**: 17 explicit | 3 inferred/UI-only | 2 deferred | 2 not implemented

---

## 6. API Surface

### Summary

| Metric | Value |
|--------|-------|
| Total endpoints | 231 |
| Total paths | 165 |
| Generation method | TypeSpec → OpenAPI → Hono routes |
| Generated file | `services/api-ts/src/generated/openapi/routes.ts` |
| Manual overrides | 3 (int32 path param workaround + tooth history + admin audit) |

### Dental Module Endpoints (sampled)

| Module | Sample Endpoints |
|--------|-----------------|
| dental-visit | `POST /dental/visits`, `GET /dental/visits/:id`, `PATCH /dental/visits/:id`, `GET /dental/visits/history/:patientId/teeth/:toothNumber` |
| dental-treatment | `POST /dental/visits/:id/treatments`, `PATCH /dental/visits/:id/treatments/:tid`, `GET /dental/visits/:id/treatments` |
| dental-billing | `POST /dental/billing/invoices`, `POST /dental/billing/invoices/:id/issue`, `POST /dental/billing/invoices/:id/void`, `POST /dental/billing/invoices/:id/plan`, `POST /dental/billing/invoices/:id/payments` |
| dental-clinical | `POST /dental/visits/:id/consents`, `POST /dental/visits/:id/consents/:cid/sign`, `POST /dental/visits/:id/lab-orders`, `POST /dental/visits/:id/prescriptions` |
| dental-scheduling | `POST /dental/appointments`, `GET /dental/appointments/:id`, `PATCH /dental/appointments/:id`, `POST /dental/appointments/:id/cancel`, `POST /dental/appointments/:id/check-in` |
| dental-imaging | `POST /dental/imaging/studies`, `GET /dental/imaging/studies/:id`, `POST /dental/imaging/studies/:id/images` |

**Known issue**: 3 manual route registrations in `app.ts` override generated routes for int32 path params — TypeSpec generates `z.number().int()` but Hono path params are always strings. Structural impedance mismatch.

---

## 7. State Machines

### Visit FSM

```
draft ──→ active ──→ completed ──→ locked
               │
               └──→ discarded  (BR-005: server-side auto-discard, deferred)
```

- Enforced via `VISIT_TRANSITIONS` constant in `visit.schema.ts`
- DB constraint: partial unique index prevents two active visits per patient (BR-001)
- `lockedAt` timestamp tracked

### Treatment FSM

```
diagnosed ──→ planned ──→ performed ──→ verified
    │             │            │
    └─────────────┴────────────┴──→ dismissed
```

- Enforced via `TREATMENT_TRANSITIONS` constant in `treatment.schema.ts`
- BR-006: forward-only, no reversals
- BR-007: `performed`/`verified` = immutable
- FSM property test: `treatment.fsm.property.test.ts` (fast-check)
- **Gap**: BR-006 status is `partial` — transition enforcement in handlers needs verification

### Invoice FSM

```
draft ──→ issued ──→ partial ──→ paid
                 └──→ overdue
                 └──→ voided  ←── (also from paid, BR-018)
```

- No `uncollectible` status (dental-specific, BR-013)
- Active payment plan blocks void (BR-011)

### Appointment FSM

- `appointment.fsm.property.test.ts` exists (fast-check)
- States: [VERIFY from dental-appointment.schema.ts]

### Prescription FSM

- `prescription.fsm.property.test.ts` exists (fast-check)
- States: [VERIFY from prescription.schema.ts]

---

## 8. UI / Screens Audit

### App: dentalemon (apps/dentalemon/)

**Tech stack**: Vite + React + TanStack Router + Tailwind CSS + Shadcn/Radix UI

**Shared components** (`src/components/`):
- Primitives: alert, badge, button, calendar, card, checkbox, combobox, command, dialog, dropdown-menu, form, input, label, loading, pagination, popover, progress, scroll-area, select, separator, sheet, skeleton, slider, switch, table, tabs, textarea, toast, tooltip
- Custom: alert-dialog, avatar, datetime-filter, empty-state, image-cropper-dialog, phone-input, app-sidebar, logo

**Component tests**:
- `datetime-filter.test.tsx` ✅
- `empty-state.test.ts` ✅
- `image-cropper-dialog.test.tsx` ✅
- `phone-input.test.tsx` ✅

**Mock data contamination**: `sample-workspace` app exists separately — production app uses SDK hooks (ADR-002: no mock-api.ts). Clean.

**Wireframes**: 28 HTML wireframes in `docs/context/wireframes/` (covers all PRD modules)

**Gaps**:
- UI blueprint specs (`docs/product/modules/*/ui-prototype/`) — MISSING (Step 7 not yet run)
- No accessibility test suite detected
- No `aria-label` audit performed

---

## 9. Test Coverage

### Summary

| Test Type | Count | Notes |
|-----------|-------|-------|
| Backend unit/integration | 135 | Bun test, real DB |
| Playwright E2E | 51 | `apps/dentalemon` |
| Contract (Hurl) | 22 scenarios | `specs/api/tests/contract/` |
| FSM property tests | 4 | fast-check: visit, treatment, appointment, prescription |
| Component tests | 4 | Frontend components |
| AC (Acceptance Criteria) | ~5 | `ac-g2s1.test.ts`, `ac-clinical.test.ts`, `ac-scheduling.test.ts` |

### Per Dental Module

| Module | Test Files | Quality | Gaps |
|--------|-----------|---------|------|
| dental-org | 18 | STRONG | — |
| dental-visit | 16 | STRONG | BR-008 backend coverage missing |
| dental-clinical | 12 | STRONG | BR-014 consent-before-treatment unclear |
| dental-billing | 11 | STRONG | BR-010 tax stub untested |
| dental-scheduling | 7 | MODERATE | — |
| dental-patient | 6 | MODERATE | — |
| dental-imaging | 5 | WEAK | Annotation tests missing |
| dental-pmd | 3 | WEAK | Only happy path covered |

### Business Rule Coverage Map

| Rule | Test File | Assertion Quality |
|------|-----------|------------------|
| BR-001 | `business-rules.test.ts` | STRONG |
| BR-002 | `business-rules.test.ts` | STRONG |
| BR-003 | `business-rules.test.ts` | STRONG |
| BR-004 | `business-rules.test.ts` | STRONG |
| BR-005 | — | NONE (deferred) |
| BR-006 | `treatment.fsm.property.test.ts` | WEAK (property, not integration) |
| BR-007 | `business-rules.test.ts` | STRONG |
| BR-008 | — | NONE (UI-only) |
| BR-009 | `business-rules.test.ts` | STRONG |
| BR-010 | — | NONE (stub) |
| BR-011 | `business-rules.test.ts` | STRONG |
| BR-012 | `business-rules.test.ts` | STRONG |
| BR-013 | — | NONE (deferred) |
| BR-014 | `clinical-consent-lab.test.ts` | [VERIFY] |
| BR-015 | `business-rules.test.ts` | WEAK |
| BR-016 | multiple | STRONG |
| BR-017 | `business-rules.test.ts` | STRONG |
| BR-018 | `business-rules.test.ts` | STRONG |
| BR-019 | — | NONE (not implemented) |
| BR-020 | — | NONE (not implemented) |
| BR-021 | `business-rules.test.ts` | STRONG |
| BR-022 | `business-rules.test.ts` | STRONG |

---

## 10. Security Audit (OWASP Top 10)

| OWASP | Risk | Finding | Severity |
|-------|------|---------|----------|
| A01 Broken Access Control | Dental data | `assertBranchAccess` + `assertBranchRole` enforced per handler | LOW |
| A01 Broken Access Control | Role splitting | `user.role.split(',')` — comma-injection if role field written from user input | MEDIUM |
| A02 Crypto Failures | PHI at rest | No column-level encryption detected (relies on PG-level) | MEDIUM |
| A02 Crypto Failures | PHI in transit | HSTS production + PHI Cache-Control: no-store | LOW |
| A03 Injection | SQL injection | Drizzle ORM throughout; no raw string interpolation | LOW |
| A04 Insecure Design | Email verify | `requireEmailVerification: false` hardcoded (not NODE_ENV-gated) | MEDIUM |
| A05 Misconfiguration | CSP | Production-only CSP; dev runs without CSP | LOW (dev) |
| A06 Vulnerable Components | Dependencies | `bun audit` not in CI scripts | MEDIUM |
| A07 Auth Failures | Session expiry | ADR-007: session expiry UX undefined | MEDIUM |
| A08 Data Integrity | Treatment immutability | BR-007 enforced; `performed`/`verified` mutations blocked | LOW |
| A09 Logging Failures | PHI in logs | User email + userId logged at `info` level in auth handlers | **HIGH** |
| A10 SSRF | Outbound requests | No detected user-controlled outbound fetch | LOW |
| CSRF | State mutations | Content-type-agnostic CSRF guard + Origin validation | LOW |
| XSS | Frontend | React escapes by default; no `dangerouslySetInnerHTML` detected | LOW |

**Top security findings:**
- 🔴 **A09 — PHI in logs**: User email and IDs logged at `info` level. Needs structured PHI redaction at Pino level.
- 🟡 **A04 — Email verification disabled**: `requireEmailVerification: false` not gated by NODE_ENV.
- 🟡 **A02 — No at-rest encryption**: PHI stored in plain PostgreSQL columns. Database-level TDE or column encryption needed for HIPAA alignment.
- 🟡 **A01 — Role comma-splitting**: Stored as comma-separated string; injection risk if any code path accepts role writes from user input.

---

## 11. Observability Audit

| Dimension | Finding | Score |
|-----------|---------|-------|
| Structured logging | Pino with `logger.info/warn/error` — 164 calls in handlers | ✅ |
| Request correlation | X-Request-ID generated at middleware, propagated to logger | ✅ |
| Audit trail | Dedicated `audit` module with Pino structured logging | ✅ |
| Health checks | `registerHealthRoutes` registered | ✅ |
| Error tracking | `AppError` class with `statusCode` + `code` fields | ✅ |
| Metrics/APM | No Prometheus/OpenTelemetry detected | ❌ |
| Distributed tracing | No W3C traceparent header | ❌ |
| PHI in logs | Email/userId logged at info level | ⚠️ |

**Observability score: 6/10** — Good foundation (Pino + requestId + audit), missing APM/metrics, PHI leakage risk.

---

## 12. Performance Audit

| Pattern | Finding | Risk |
|---------|---------|------|
| N+1 queries | `acceptTreatmentPlan.ts:102` — array iteration with DB call inside | MEDIUM |
| Missing indexes | All FK columns indexed; partial unique index for active-visit | LOW |
| Unbounded queries | `listDentalVisits`, `listDentalTreatments` — pagination [VERIFY] | MEDIUM |
| Sync blocking | None detected in critical paths | LOW |
| Connection pooling | `pg` + `postgres` clients — verify pool config | LOW |
| Background jobs | pg-boss for async jobs (email, notifs, audit, booking) | ✅ |

---

## 13. Inconsistencies

| ID | Finding | Severity |
|----|---------|----------|
| IC-001 | Invoice status `issued` in schema vs `sent` in BR-012 spec doc — naming mismatch | MEDIUM |
| IC-002 | `discarded` in visit enum but BR-005 (auto-discard) is deferred — dead code path | LOW |
| IC-003 | `booking/jobs/index.ts` throws `not implemented` on two paths reachable from production scheduling | HIGH |
| IC-004 | `requireEmailVerification: false` hardcoded — comment says "for testing" but applies to all envs | HIGH |
| IC-005 | `sample-workspace` app exists alongside `dentalemon` — may contain stale patterns | MEDIUM |
| IC-006 | `emr` module handlers but `dental-emr` MODULE_SPEC — base vs dental EMR overlap unclear | LOW |

---

## 14. Stubs & TODO Inventory

### Runtime Stubs (P1)

| File | Stub | Risk |
|------|------|------|
| `booking/jobs/index.ts:61` | `throw new Error('triggerSlotGeneration with ownerId not implemented')` | P1 |
| `booking/jobs/index.ts:64` | `throw new Error('Full job trigger not implemented')` | P1 |

### Unimplemented Business Rules (P1)

| Rule | Status |
|------|--------|
| BR-019 — supervisor approval for amendments | NOT IMPLEMENTED |
| BR-020 — patient record merge | NOT IMPLEMENTED |

### Deferred Features (P2–P3)

| Item | Priority |
|------|---------|
| BR-005 auto-discard empty visits | P3 |
| BR-013 markUncollectible | P3 |
| BR-010 tax calculation | P3 |
| ADR-006 optimistic locking enforcement | P2 |
| ADR-007 session expiry UX | P2 |

---

## 15. Type Cast Density

| Metric | Count |
|--------|-------|
| Total `as any` / `as unknown` / `@ts-ignore` (all files) | **1,659** |
| Production handlers (non-test) `as any` | **183** |

**Root cause**: TypeSpec-generated validators incompatible with Hono's context typing — forces `as any` at handler boundaries (e.g. `c.req.valid('json') as any`).

**Classification**:
- ~80% external boundary casts (Hono context, generated types) — fixable with typed helpers
- ~20% internal logic casts — genuine type safety gap

**Recommendation**: Create typed Hono context helpers. Target: <20 production `as any` casts.

---

## 16. Cross-Module Import Violations

| Importer | Imported | Symbol | Coupling Type |
|----------|----------|--------|---------------|
| dental-clinical | dental-visit | `VisitRepository` | HIGH — repo access across module |
| dental-clinical | patient | `PatientRepository` | MEDIUM — read-only |
| dental-billing | dental-visit | schema tables | HIGH — schema access |
| dental-billing | patient | `patients` schema | MEDIUM |
| dental-billing | dental-org | `dentalBranches`, `dentalMemberships` schema | MEDIUM |
| dental-visit | dental-org | schema tables | MEDIUM |
| dental-visit | patient | `patients` schema | MEDIUM |
| all dental-* | shared | `assertBranchAccess`, `assertBranchRole` | OK — shared utilities |

**Bi-directional**: None detected. ✅

**dental-imaging**: Uses explicit loose-coupling pattern — UUID references, no DB-level FKs, documented in schema comments. Model pattern.

**P1 issue**: `dental-clinical → dental-visit` repo access (not just schema). Clinical module reaches directly into visit module's repository layer instead of going through a public service interface.

---

## 17. Cross-Module Raw SQL

| File | Usage | Risk |
|------|-------|------|
| `visit.schema.ts` | `sql\`status = 'active'\`` | LOW — partial index filter, own table |
| `business-rules.test.ts` | `sql` import for test DB seeding | LOW — tests only |

**Finding**: Raw SQL is minimal and own-module scoped. No cross-module raw SQL detected. **CLEAN.**

---

## 18. Repo Guardrails

| Artifact | Exists | Accurate | Notes |
|----------|--------|---------|-------|
| `CLAUDE.md` | ✅ | ✅ | Comprehensive — TypeSpec workflow, module structure, patterns, testing protocol |
| `CONTRIBUTING.md` | ✅ | ✅ | Development workflow, code generation, database workflow |
| `README.md` | ✅ | ✅ | Installation, commands, tech stack |
| `ARCHITECTURE.md` (root) | ❌ | — | Missing; partial coverage in `docs/architecture/` |
| `docs/development/VERTICAL_TDD.md` | ✅ | ✅ | Mandatory TDD protocol documented |
| `docs/prd/BUSINESS_RULES.md` | ✅ | ✅ | 22 rules with coverage map |
| `docs/prd/v3-dentalemon.md` | ✅ | [VERIFY] | Main PRD |
| `docs/architecture/DOMAIN_MODEL.md` | ✅ | [VERIFY] | May be stale |
| `.planning/config.json` | ✅ | ⚠️ | `tdd_mode: false`, `agent_skills: {}` — must fix before graduation |

**Critical config gaps:**
```json
{
  "workflow": {
    "tdd_mode": false        // ← MUST be true for graduation
  },
  "agent_skills": {}         // ← MUST include oli-execution-gate
}
```

---

## 19. Spec Coverage

| Spec Type | Expected Path | Actual Path | Status |
|-----------|--------------|-------------|--------|
| MODULE_SPEC (10 modules) | `docs/product/modules/*/MODULE_SPEC.md` | `docs/modules/*/MODULE_SPEC.md` | ⚠️ WRONG PATH |
| PRD_AUDIT_REPORT | `docs/product/PRD_AUDIT_REPORT.md` | — | ❌ MISSING |
| DOMAIN_GLOSSARY | `docs/product/DOMAIN_GLOSSARY.md` | — | ❌ MISSING |
| ROLE_PERMISSION_MATRIX | `docs/product/ROLE_PERMISSION_MATRIX.md` | `docs/architecture/ROLE_MATRIX.md` | ⚠️ WRONG PATH |
| MODULE_MAP | `docs/product/MODULE_MAP.md` | — | ❌ MISSING |
| WORKFLOW_MAP | `docs/product/WORKFLOW_MAP.md` | — | ❌ MISSING |
| DOMAIN_MODEL | `docs/product/DOMAIN_MODEL.md` | `docs/architecture/DOMAIN_MODEL.md` | ⚠️ WRONG PATH |
| API_CONTRACTS | `docs/product/modules/*/API_CONTRACTS.md` | — | ❌ MISSING |
| UI Blueprints | `docs/product/modules/*/ui-prototype/` | — | ❌ MISSING |
| CONSISTENCY_REPORT | `docs/product/CONSISTENCY_REPORT.md` | — | ❌ MISSING |

**Assessment**: Rich institutional knowledge exists (MODULE_SPECs, ADRs, BUSINESS_RULES.md, PRD) but not organized into the `docs/product/` structure the oli pipeline expects. Steps 2–8 will normalize this.

---

## 20. Standards Gap Matrix

| ID | Gap | Priority | Module |
|----|-----|----------|--------|
| G-001 | Booking jobs have runtime `throw new Error('not implemented')` | **P1** | booking |
| G-002 | BR-019: supervisor approval for treatment amendments not implemented | **P1** | dental-clinical |
| G-003 | `dental-clinical` imports `VisitRepository` from `dental-visit` — cross-module repo coupling | **P1** | dental-clinical, dental-visit |
| G-004 | `requireEmailVerification: false` hardcoded (not NODE_ENV-gated) | **P1** | auth |
| G-005 | PHI potentially logged — email/userId at `info` level in auth handlers | **P1** | auth, all handlers |
| G-006 | 183 `as any` production casts | **P2** | all handlers |
| G-007 | MODULE_SPECs at wrong path (`docs/modules/` not `docs/product/modules/`) | **P2** | docs |
| G-008 | `tdd_mode: false` in `.planning/config.json` | **P2** | .planning |
| G-009 | `agent_skills: {}` — oli-execution-gate not configured | **P2** | .planning |
| G-010 | ADR-006: optimistic locking version column not enforced | **P2** | dental-visit, dental-clinical |
| G-011 | No `ARCHITECTURE.md` at root | **P2** | docs |
| G-012 | No at-rest encryption for PHI columns | **P2** | database |
| G-013 | No Prometheus/OpenTelemetry metrics | **P2** | core |
| G-014 | `bun audit` not in CI scripts | **P2** | CI |
| G-015 | BR-020: patient record merge not implemented | **P2** | dental-patient |
| G-016 | Unbounded list queries need pagination verification | **P2** | dental-visit, dental-billing |
| G-017 | N+1 query in `acceptTreatmentPlan.ts:102` | **P2** | dental-visit |
| G-018 | ADR-007: session expiry UX undefined | **P3** | frontend |
| G-019 | BR-005 auto-discard deferred | **P3** | dental-visit |
| G-020 | Tax stub (BR-010) | **P3** | dental-billing |
| G-021 | dental-pmd test coverage weak (3 files) | **P3** | dental-pmd |
| G-022 | dental-imaging annotation tests missing | **P3** | dental-imaging |

### Priority Summary

| Priority | Count | Graduation Impact |
|----------|-------|------------------|
| P0 | 0 | — |
| P1 | 5 | Must fix |
| P2 | 12 | Must fix for ≥9.0 |
| P3 | 5 | Improve score |

---

## 21. Stabilization & Adoption Plan

### Immediate (P1 — before any new code)

1. **G-001**: Gate booking jobs `not implemented` paths or remove dead code
2. **G-004**: Gate `requireEmailVerification` with `NODE_ENV !== 'production'`
3. **G-005**: Audit all `logger.info` calls; add Pino redaction config for PHI fields
4. **G-003**: Extract `VisitRepository` cross-module access into shared service interface
5. **G-002**: Design + implement BR-019 supervisor approval gate

### Adoption Phases

**Phase 1 — Guardrails** (1 week)
- Root `ARCHITECTURE.md`
- Fix G-004, G-005 (security)
- Add `bun audit` to CI
- Update `.planning/config.json`: `tdd_mode: true` + `agent_skills`

**Phase 2 — Document** (1 week)
- `/oli-prd-audit` → PRD_AUDIT_REPORT + DOMAIN_GLOSSARY + MODULE_MAP
- `/oli-workflow-map` → WORKFLOW_MAP
- `/oli-module-specs --all` → normalized MODULE_SPECs at `docs/product/modules/`
- `/oli-api-contracts --all` → API_CONTRACTS per module

**Phase 3 — Stabilize** (2 weeks)
- Fix G-001, G-002, G-003, G-010, G-017
- Pagination audit (G-016)
- Add metrics endpoint (G-013)

**Phase 4 — Adopt TDD**
- All new code follows Vertical TDD (TypeSpec → backend tests → impl → contract → frontend)
- Improve dental-pmd + dental-imaging coverage
- Eliminate `as any` casts via typed Hono helpers (G-006)

**Phase 5 — Migrate**
- Column-level encryption for PHI fields (G-012)
- Session expiry UX (G-018)
- BR-005 auto-discard (G-019)
- Tax calculation rules (G-020)

### First 3 Recommended Vertical Slices

1. **PHI Logging Audit + Fix** (G-005)
   - Highest clinical/legal risk; PHI in logs = HIPAA incident
   - Scope: audit `logger.info` calls → add Pino redaction config → add test

2. **BR-019: Supervisor Amendment Approval** (G-002)
   - Clinical compliance gap; amendment without oversight = liability
   - Scope: TypeSpec update → backend guard → contract test → frontend approval UI

3. **Typed Hono Context Wrapper** (G-006)
   - Eliminates 183 `as any` casts at source; improves type safety across all dental handlers
   - Scope: typed `ctx.req.valid()` wrapper → adopt across dental-* handlers

---

## Codebase Health Score: 7.4 / 10

| Dimension | Score | Notes |
|-----------|-------|-------|
| Module structure clarity | 8 | Clear dental-* separation; loose-coupling pattern in imaging |
| Type safety | 5 | 183 production `as any` casts |
| State machine clarity | 9 | Well-defined enums + transition constants + FSM property tests |
| Business rules documentation | 8 | 22 rules, coverage map, 17/22 tested |
| Domain model clarity | 8 | Clear entities, cross-module FK comments |
| Security posture | 7 | CORS/CSP/CSRF/PHI headers; PHI logging + email-verify gaps |
| Observability coverage | 6 | Pino + requestId; no APM/metrics |
| Performance health | 7 | Low N+1 overall; 1 confirmed, unbounded queries TBD |
| Stub density | 6 | 2 runtime stubs + 2 unimplemented clinical BRs |
| Cross-module coupling | 6 | dental-clinical → dental-visit repo coupling (P1) |
| Test coverage breadth | 7 | 135 backend + 51 E2E; pmd/imaging weak |
| API contract coverage | 9 | TypeSpec-first, 231 endpoints generated |
| Auth/AuthZ model | 8 | Better-Auth + branch guards; role-string comma-splitting risk |
| Error handling | 8 | AppError class, structured responses |
| Data model integrity | 8 | FK constraints, partial unique indexes, enums |
| Frontend component quality | 7 | Shadcn UI; 4 component tests; no a11y audit |
| Raw SQL leakage | 9 | Drizzle throughout; SQL only in own-module index filters |
| Repo guardrails | 8 | CLAUDE.md + CONTRIBUTING.md; missing root ARCHITECTURE.md |
| Spec coverage | 5 | Specs exist but at wrong paths; API_CONTRACTS + UI blueprints missing |
| **AVERAGE** | **7.4** | **Graduation target: ≥9.0** |

---

## What's Next

```
/oli-prd-audit docs/prd/v3-dentalemon.md    → Step 2: MODULE_MAP + DOMAIN_GLOSSARY
/oli-workflow-map                            → Step 3: WORKFLOW_MAP
/oli-domain-model --depth lean              → Step 4: entity normalization (10 modules)
/oli-module-specs --all                     → Step 5: normalized MODULE_SPECs
/oli-api-contracts --all                    → Step 6: API_CONTRACTS per module
/oli-ui-blueprint --blueprint --all         → Step 7: UI blueprints
/oli-spec-consistency                       → Step 8: GATE
/oli-magic                                  → Step 9: classify + plan waves
/gsd-execute-phase                          → Step 10: execute with TDD
/oli-audit-compliance --all                 → Step 11: re-check
/oli-confidence-stack                       → Step 12: test confidence
/oli-trace                                  → Step 13: traceability
/oli-magic --update                         → Step 14: graduation check
```
