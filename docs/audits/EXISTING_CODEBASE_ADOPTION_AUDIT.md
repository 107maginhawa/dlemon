# Existing Codebase Adoption Audit

---
**Audit Date:** 2026-05-19
**Prior Audit:** 2026-05-14 (health 5.4/10)
**Source Directory:** `services/api-ts/src/handlers/` + `apps/dentalemon/`
**Stack:** TypeScript + Hono + Drizzle ORM + Bun + React 19 + TanStack Router + Better-Auth
**Depth:** Deep
**Branch:** `feat/v1.4-clinical-imaging`
**Reviewed by:** oli-audit-codebase (re-baseline run)
---

## 1. Executive Summary

**Overall health: 7.2/10** _(up from 5.4/10 on 2026-05-14)_

| Risk | Count |
|------|-------|
| P0 — Fix immediately | 0 |
| P1 — Fix before new work | 3 |
| P2 — Fix when touching module | 8 |
| P3 — Improve later | 5 |

**Top 3 risks:**
1. **Ceph module (11 handlers, 3 DB tables) has zero spec coverage** — CIMG-NNN test IDs exist in the test suite but no corresponding BRs appear in `BUSINESS_RULES.md` or `MODULE_SPEC.md`. A refactor cannot be audited for compliance.
2. **Dental RBAC is branch-only, not role-differentiated** — `assertBranchAccess` grants all 4 member roles (`dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling`) equal API access. A scheduling-only staff member can create treatments or void invoices.
3. **AC coverage at 50% (20/40 ACs tested)** — the acceptance criteria layer is the only spec layer covering full user-facing flows. Half are untested, making regression detection fragile.

**What improved since 2026-05-14:**
- All 4 prior P0 items resolved (DB FK constraint, route-registration tests, listEMRPatients bug, FINDING_TRANSITIONS guard)
- 216 routes verified via structural test (`route-registration.test.ts`)
- Email (95.7% coverage) and Comms (84.2%) modules recovered from CRITICAL
- v1.4 Ceph feature complete: 11 handlers, 3 tables, `packages/ceph-math`, 32 E2E tests green
- Compliance framework established: `BUSINESS_RULES.md`, `ACCEPTANCE_CRITERIA.md`, MODULE_SPEC (imaging)
- Coverage ratchet added (`bunfig.coverage.toml`: line=62, function=61, branch=40)

**Recommended approach:** No P0 blockers. Address P1 items (ceph spec, dental RBAC, AC coverage) before the next feature milestone. Use `/oli-audit-compliance` after ceph BRs are written.

---

## 2. Project Overview

| Metric | Count |
|--------|-------|
| Backend handler modules | 21 |
| Frontend apps | 3 (`apps/dentalemon`, `apps/account`, `apps/sample-workspace`) |
| Database tables | ~52 |
| Schema files | ~37 |
| API endpoints | ~140+ |
| Business rules (spec) | 35 (BR-001–BR-035; 0 ceph BRs) |
| Acceptance criteria | 40 |
| Enums (pgEnum) | 45+ |
| State machines | 10 |
| Backend test files | 97 |
| Frontend test files | 126 |
| Playwright E2E specs | 31 |
| Hurl contract tests | 35 |

---

## 3. Project Structure

**Stack:** Bun + TypeScript + Hono (HTTP framework) + Drizzle ORM + PostgreSQL + React 19 + TanStack Router + Better-Auth + Pino logging

| Directory | Purpose | Module? |
|-----------|---------|---------|
| `services/api-ts/src/handlers/audit/` | HIPAA compliance logging | Yes |
| `services/api-ts/src/handlers/billing/` | Stripe invoicing (base platform) | Yes |
| `services/api-ts/src/handlers/booking/` | Generic scheduling (base platform) | Yes |
| `services/api-ts/src/handlers/comms/` | Chat + WebRTC video | Yes |
| `services/api-ts/src/handlers/dental-billing/` | Dental invoices, payments, plans | Yes — core domain |
| `services/api-ts/src/handlers/dental-clinical/` | Prescriptions, labs, consent, amendments | Yes — core domain |
| `services/api-ts/src/handlers/dental-imaging/` | X-rays, ceph analysis, findings | Yes — active dev |
| `services/api-ts/src/handlers/dental-org/` | Orgs, branches, memberships, PINs | Yes — core domain |
| `services/api-ts/src/handlers/dental-patient/` | Dental patient management | Yes — core domain |
| `services/api-ts/src/handlers/dental-pmd/` | Patient medical documents | Yes — core domain |
| `services/api-ts/src/handlers/dental-scheduling/` | Appointment management | Yes — core domain |
| `services/api-ts/src/handlers/dental-visit/` | Visits, treatments, charting | Yes — core domain |
| `services/api-ts/src/handlers/email/` | Email templates + queue | Yes |
| `services/api-ts/src/handlers/emr/` | Consultation notes (non-dental) | Yes |
| `services/api-ts/src/handlers/notifs/` | Notifications | Yes |
| `services/api-ts/src/handlers/patient/` | Platform patient records | Yes |
| `services/api-ts/src/handlers/person/` | Central PII safeguard | Yes |
| `services/api-ts/src/handlers/provider/` | FHIR R4 practitioners | Yes |
| `services/api-ts/src/handlers/reviews/` | NPS review system | Yes |
| `services/api-ts/src/handlers/shared/` | Cross-cutting utilities (assertBranchAccess) | No — infrastructure |
| `services/api-ts/src/handlers/storage/` | File upload/download (S3/MinIO) | Yes |
| `services/api-ts/src/core/` | Auth, config, DB, errors, jobs | No — infrastructure |
| `services/api-ts/src/middleware/` | Auth, security, validation, expand | No — infrastructure |
| `apps/dentalemon/` | Dental practice app (React 19 + TanStack Router) | Frontend |
| `apps/account/` | User portal (Better-Auth reference app) | Frontend |
| `apps/sample-workspace/` | Chart prototype (Vite standalone) | Frontend — prototype |
| `specs/api/` | TypeSpec definitions + OpenAPI | Spec layer |
| `packages/sdk-ts/` | Generated TypeScript SDK | Shared package |
| `packages/ceph-math/` | Isomorphic cephalometric math engine | Shared package — NEW |

---

## 4. Module Map

### Module Overview

| Module | Purpose | Primary Entities | Priority |
|--------|---------|-----------------|----------|
| person | Central PII safeguard | Person | Core — platform |
| patient | Platform patient records | Patient | Core — platform |
| provider | FHIR R4 practitioners | Practitioner, PractitionerRole | Core — platform |
| dental-org | Clinic org structure | Organization, Branch, Membership, ConsentTemplate | Core — dental |
| dental-patient | Dental patient management | DentalPatient | Core — dental |
| dental-visit | Clinical visits + charting | Visit, Treatment, Chart, VisitNotes, TreatmentTemplate | Core — dental |
| dental-scheduling | Appointment management | Appointment | Core — dental |
| dental-billing | Dental-specific billing | Invoice, Payment, PaymentPlan, Installment | Core — dental |
| dental-clinical | Clinical records | Prescription, LabOrder, ConsentForm, Amendment, Attachment, MedicalHistory | Core — dental |
| dental-imaging | Imaging studies + ceph | ImagingStudy, Image, Annotation, Finding, CephLandmark, CephAnalysis, CephReport | Active dev |
| dental-pmd | Patient medical documents | PMDDocument, ImportedPMD | Core — dental |
| emr | Consultation notes | ConsultationNote | Non-dental vertical |
| audit | HIPAA audit trail | AuditLog | Cross-cutting |
| booking | Generic scheduling | Booking, Slot | Base platform |
| billing | Stripe invoicing | Invoice (Stripe) | Base platform |
| comms | Chat + video | ChatRoom, Message | Base platform |
| storage | File storage | FileUpload | Infrastructure |
| email | Email queue | EmailTemplate, EmailQueue | Infrastructure |
| notifs | Push notifications | Notification | Infrastructure |
| reviews | NPS reviews | Review | Base platform |

### Module Dependencies (dental domain)

```
dental-org ───────────────────────── (foundation)
  └─► dental-patient (branch context)
  └─► dental-visit (branch + membership refs)
  └─► dental-scheduling (branch + membership refs)
  └─► dental-billing (branch + membership refs)
  └─► dental-clinical (branch + membership refs)
  └─► dental-imaging (branch ref — bare UUID, deliberate)
  └─► dental-pmd (branch ref)

dental-visit ─────────────────────── (clinical core)
  └─► dental-billing (treatment → invoice line items)
  └─► dental-imaging (visit_id — bare UUID, deliberate)
  └─► dental-scheduling (visit_id on appointment)

patient ──────────────────────────── (platform)
  └─► dental-patient (FK reference)
  └─► dental-visit, dental-billing, dental-clinical, dental-imaging, dental-scheduling

person ───────────────────────────── (platform root)
  └─► patient, dental-org.membership.personId
```

**Cross-module coupling pattern:** Dental modules use bare UUID FKs without `.references()` for cross-module links (intentional loose coupling; documented via comment in `imagingFindings.treatmentId`). Intra-module FKs use `.references()` with cascade. Established pattern — not a bug.

---

## 5. Domain Glossary Summary

| Term | Source | Definition (inferred) | Conflicts / Notes |
|------|--------|----------------------|-------------------|
| DentalVisit | `visit.schema.ts`, handlers | A dental clinical visit — draft→active→completed→locked | Canonical term is "Visit" (matches code, DB, and API paths). "Encounter" was the old FHIR alias — resolved in G3-S1. |
| DentalTreatment | `treatment.schema.ts` | A CDT-coded procedure line on a visit | Called "Procedure" in FHIR entity catalog |
| DentalChart | `dental-chart.schema.ts` | A per-visit snapshot of all 32 tooth states | No conflict |
| DentalMembership | `membership.schema.ts` | A staff member's affiliation to a branch | Also called "Member" in API paths and UI |
| Organization | `organization.schema.ts` | A dental practice entity (tier: solo/clinic/group/enterprise) | "Org" in code, "Organization" in API paths |
| Branch | `branch.schema.ts` | A physical clinic location under an Organization | No conflict |
| ImagingStudy | `imaging.schema.ts` | A set of radiographic images acquired in one session | No conflict |
| ImagingFinding | `imaging-finding.schema.ts` | A structured radiographic finding (e.g., caries, bone loss) | No conflict |
| CephLandmark | `imaging_ceph.schema.ts` | An anatomical landmark point in image-space pixels | No conflict |
| CephAnalysis | `imaging_ceph.schema.ts` | Computed cephalometric measurements from landmarks | No conflict |
| CephReport | `imaging_ceph.schema.ts` | Immutable versioned snapshot of a ceph analysis | No conflict |
| ConsentForm | dental-clinical repos | A signed consent form for a procedure | Different from ConsentTemplate (branch-level reusable template) |
| PMDDocument | dental-pmd repos | A patient medical document (generated or imported) | Abbreviation unexplained in code |
| DentalAppointment | `dental-appointment.schema.ts` | A scheduled appointment slot | Called "Appointment" in API paths |
| MemberRole | `membership.schema.ts` | dentist_owner \| dentist_associate \| staff_full \| staff_scheduling | No conflict |
| OrgTier | `organization.schema.ts` | solo \| clinic \| group \| enterprise | No conflict |
| ImagingTier | `organization.schema.ts` | free \| basic \| addon — imaging feature tier | NULL coerced to 'free' |

**Resolved (G3-S1): "Visit" is canonical** — the codebase uses `DentalVisit` throughout (DB table `dental_visit`, all handlers, API paths). The old FHIR alias "Encounter" has been replaced with "Visit" in all docs and comments.

### DDD Analysis [INFERRED]

| Entity | Classification | Aggregate Root? | Domain Events | Cross-Module Pattern |
|--------|---------------|----------------|---------------|---------------------|
| DentalOrganization | Entity | Yes | OrgCreated | Referenced by all dental via Branch |
| DentalBranch | Entity | Yes (scoping root) | BranchCreated | FK in all dental tables |
| DentalMembership | Entity | No | MemberCreated, MemberDeactivated | Via assertBranchAccess |
| DentalVisit | Entity | Yes | VisitActivated, VisitCompleted, VisitLocked | Direct import (dental-billing, dental-imaging) |
| DentalTreatment | Entity | No | TreatmentPerformed | Owned by Visit aggregate |
| DentalChart | Entity | No | — | Owned by Visit aggregate |
| DentalInvoice | Entity | Yes | InvoiceIssued, InvoicePaid, InvoiceVoided | References Visit, Treatment |
| DentalAppointment | Entity | Yes | AppointmentCheckedIn, AppointmentCancelled | References Visit (nullable) |
| ImagingStudy | Entity | Yes | — | Bare UUID FK to patient/branch/visit |
| ImagingFinding | Entity | No | — | Owned by ImagingStudy aggregate |
| CephReport | Value Object (append-only) | No | CephReportCreated | Owned by ImagingStudy |
| Patient | Entity | Yes (platform) | PatientCreated | Referenced by all dental modules |
| Person | Entity | Yes (platform root) | — | personId = user.id |

**Bounded context candidates:** `dental-org`, `dental-visit`, `dental-billing`, `dental-imaging`

**Anti-corruption layers missing:** Cross-module bare UUID FKs are intentional loose coupling but no formal ACL pattern. No ADR documents this decision.

---

## 6. Permission Summary

### Roles Found

| Role | Source | Description |
|------|--------|-------------|
| `admin` | Better-Auth session | Platform administrator |
| `support` | Better-Auth session | Read-only support access |
| `user` | Better-Auth session | Default authenticated user |
| `client` | Better-Auth session | Booking client (base platform) |
| `host` | Better-Auth session | Booking host (base platform) |
| `dentist_owner` | `dental_membership` table | Clinic owner / lead dentist |
| `dentist_associate` | `dental_membership` table | Associate dentist |
| `staff_full` | `dental_membership` table | Full-access staff |
| `staff_scheduling` | `dental_membership` table | Scheduling-only staff |

### Permission Matrix

| Action | Auth Check | Roles Enforced? |
|--------|------------|-----------------|
| All dental `/dental/*` | `assertBranchAccess(db, userId, branchId)` | **NO** — any active branch member, any role |
| Base platform endpoints | `authMiddleware({ roles: [...] })` | YES — Better-Auth roles enforced |
| `GET /health` | None | N/A — intentional |

### Critical Gap: Dental Role Enforcement

`assertBranchAccess` only verifies active membership — not `membership.role`. This means `staff_scheduling` can call:
- `POST /dental/visits/{id}/treatments` (create treatments)
- `POST /dental/billing/invoices/{id}/void` (void invoices)
- `POST /dental/prescriptions` (create prescriptions)

**P1** — likely unintended. Role matrix exists in docs but is not enforced at API level.

---

## 7. Business Rules Summary

Business rules formally tracked in `docs/prd/BUSINESS_RULES.md` (BR-001–BR-035). `specs/api/docs/standards/br-registry.json` exists but is empty.

### Extracted Rules

**dental-visit:**
| Rule ID | Rule | Type | Confidence |
|---------|------|------|------------|
| EC7 | One active visit per patient at a time | Explicit | HIGH |
| FR1.16 | Cannot add treatment to completed/locked visit | Explicit | HIGH |
| EC2 | Cannot treat an extracted tooth | Explicit | HIGH |
| BR-005 | Auto-discard empty visit on session end | Explicit | HIGH — **NOT IMPLEMENTED** |
| TREAT-1 | Treatment transitions forward-only: diagnosed→planned→performed→verified→dismissed | Explicit | HIGH |
| TREAT-2 | Any non-terminal treatment can be dismissed | Explicit | HIGH |

**dental-billing:**
| Rule ID | Rule | Type | Confidence |
|---------|------|------|------------|
| INV-1 | Only draft invoices can be issued | Explicit | HIGH |
| INV-2 | Invoice line items require performed/verified treatments | Explicit | HIGH |
| BR-013 | Invoice reconciliation edge case | Explicit | HIGH — **PLACEHOLDER (skip in test)** |

**dental-scheduling:**
| Rule ID | Rule | Confidence |
|---------|------|------------|
| APPT-1 | scheduled → checked_in \| cancelled \| no_show | HIGH |
| APPT-2 | checked_in → completed \| cancelled \| no_show | HIGH |
| APPT-3 | completed and cancelled are terminal | HIGH |

**dental-imaging:**
| Rule ID | Rule | Confidence |
|---------|------|------------|
| BR-023–035 | 13 imaging BRs (file types, study limits, annotations) | HIGH |
| FIND-1 | Finding transitions guarded; resolved=terminal | HIGH |
| BR-034 | Allowed MIME: jpeg, png, tiff, bmp | HIGH |
| CIMG-* | Ceph rules | **NO SPEC** |

**dental-org:**
| Rule ID | Rule | Confidence |
|---------|------|------------|
| ORG-1 | One membership per person per branch | HIGH |
| ORG-2 | PIN-only staff have NULL personId | HIGH |
| ORG-3 | PIN lockout after failed attempts | MEDIUM |
| ORG-4 | imagingTier NULL treated as 'free' | HIGH |

---

## 8. API Surface Summary

~140+ endpoints across 21 modules. No per-module `API_CONTRACTS.md` for dental domain.

### Dental Domain Handler Inventory

| Module | Handlers | Notable Endpoints |
|--------|----------|------------------|
| dental-visit | 20 | createDentalVisit, createDentalTreatment, updateDentalTreatment, getDentalChart, getTreatmentPlan, carryOverTreatments, applyTemplate |
| dental-billing | 15 | createDentalInvoice, issueDentalInvoice, voidDentalInvoice, recordDentalPayment, createDentalPaymentPlan, getCollectionsSummary |
| dental-org | 25 | createOrganization, createMember, deactivateMember, verifyPin, setPin, getOrgContext, getDashboardSummary, memberTierLimits |
| dental-scheduling | 7 | createAppointment, checkInAppointment, cancelAppointment, listAppointments |
| dental-imaging | 20 | + 9 ceph handlers (CephMgmt_*) |
| dental-clinical | 15 | createPrescription, createLabOrder, createConsentForm, signConsentForm, medicalHistory |
| dental-patient | 5 | createDentalPatient, getDentalPatient |
| dental-pmd | 5 | generatePMD, importPMD, getImportedPMD |

### API Pattern Consistency

✅ `assertBranchAccess` on all mutating dental endpoints
✅ `PaginatedResponse<T>` envelope on all list endpoints
✅ Drizzle ORM — no raw SQL string concatenation
✅ `NotFoundError`, `BusinessLogicError`, `UnauthorizedError`, `ForbiddenError` error types
⚠️ Some handlers use `ctx.get('session')`, others `ctx.get('user')` — both work but style inconsistent
⚠️ No Hurl contract tests for dental endpoints

### 8b. API Contract Drift

No `API_CONTRACTS.md` found for dental modules. Operating in pure extraction mode. Base platform has TypeSpec/OpenAPI — drift not assessed here.

---

## 9. State Machines Summary

| Entity | States | Terminal | Guard Enforced? |
|--------|--------|----------|-----------------|
| DentalVisit | draft → active → completed → locked | locked | ✅ |
| DentalTreatment | diagnosed → planned → performed → verified → dismissed | dismissed | ✅ |
| DentalInvoice | draft → issued → partial → paid \| overdue \| voided | paid, voided | ✅ |
| DentalAppointment | scheduled → checked_in → completed \| cancelled \| no_show | completed, cancelled | ✅ |
| ImagingFinding | suspected → confirmed \| monitoring → resolved | resolved | ✅ |
| ConsentForm | draft → signed | signed | ✅ |
| LabOrder | pending → in_fabrication → sent → received | received | ✅ |
| CephLandmark | placed → revised \| excluded | — | ⚠️ No TRANSITIONS map |
| DentalPaymentPlan | on_track → behind \| completed \| defaulted | completed, defaulted | ⚠️ No handler guard |
| Installment | pending → paid \| overdue \| waived | paid, waived | ⚠️ No handler guard |

8/10 state machines guarded. CephLandmark and PaymentPlan/Installment unguarded (P2).

### 9b. Domain Model Drift

No `DOMAIN_MODEL.md` found. `specs/api/docs/standards/entity-catalog.md` covers FHIR-canonical entities only — does not map to dental-specific DB entities. Gap noted in Section 13.

---

## 10. UI / Screens Summary

| Screen | Module | Route | Tests? |
|--------|--------|-------|--------|
| Dashboard | dental-org | `/_dashboard/dashboard` | ⚠️ Partial |
| Patient List | dental-patient | `/_dashboard/patients` | ⚠️ Partial |
| Patient Profile | dental-patient | `/_dashboard/patients/$patientId` | ⚠️ Partial |
| Clinical Workspace | dental-visit | `/_workspace/$patientId` | ✅ unit + E2E |
| Calendar | dental-scheduling | `/_dashboard/calendar` | ❌ |
| Billing List | dental-billing | `/_dashboard/billing` | ❌ |
| Reports | dental-org | `/_dashboard/reports` | ❌ |
| Settings | dental-org | `/_dashboard/settings` | ❌ |
| Staff Management | dental-org | `/_dashboard/staff` | ❌ |
| Onboarding | dental-org | `/onboarding` | ⚠️ Partial |
| PIN Entry | auth | `/auth/pin-entry.$memberId` | ✅ |
| PIN Select | auth | `/auth/pin-select` | ✅ |
| Imaging Workspace | dental-imaging | (within workspace) | ✅ 32 E2E |
| Ceph Report Print | dental-imaging | `/imaging-ceph-report.$imageId` | ✅ E2E |
| imaging-test / imaging-comparison-test | dental-imaging | (dev-only routes) | — |

**Note:** `imaging-test.tsx` and `imaging-comparison-test.tsx` are dev/debug routes, not production screens. Should be guarded or removed before production.

28 HTML wireframes in `docs/prd/context/wireframes/` — design reference, not prototype contamination. `apps/sample-workspace` correctly isolated as standalone prototype.

---

## 11. Test Coverage Summary

### Coverage by Category

| Category | Total Items | Tested | Coverage | Assertion Quality |
|----------|------------|--------|----------|-------------------|
| Business rules (BR-001–022) | 22 | 19 | 86% | 17 strong, 2 weak, 3 none |
| Business rules (BR-023–035) | 13 | 11 | 85% | 10 strong, 1 weak, 2 none |
| Business rules (ceph CIMG-*) | ~8 est. | 0 | 0% | No spec to anchor |
| Acceptance criteria | 40 | 20 | 50% | 18 strong, 2 weak, 20 none |
| Route registration | 216 | 216 | 100% | STRONG |
| State machines | 10 | 8 | 80% | Strong |
| Email handlers | ~9 | 9 | 95.7% avg | Strong |
| Comms handlers | — | — | 84.2% avg | Strong |
| Booking handlers | — | — | ~11% | Weak |
| Storage handlers | — | — | ~20% | Weak |

### Business Rule Test Coverage Detail (key items)

| BR ID | Rule | Test File | Quality |
|-------|------|-----------|---------|
| EC7 | One active visit per patient | `dental-visit-module4.test.ts` | STRONG |
| FR1.16 | No treatment on locked visit | `dental-visit.test.ts` | STRONG |
| EC2 | No treatment on extracted tooth | `business-rules.test.ts` | STRONG |
| INV-1 | Only draft invoices can be issued | `dental-billing-module3.test.ts` | STRONG |
| INV-2 | Treatments must be performed | `dental-billing.test.ts` | STRONG |
| BR-005 | Auto-discard empty visit | `business-rules.test.ts` | **NONE — `describe.skip`** |
| BR-013 | Invoice reconciliation | `business-rules.test.ts` | **NONE — `describe.skip`** |
| CIMG-* | Ceph analysis rules | `ceph.test.ts` test IDs | WEAK — no spec anchor |

---

## 12. Repository Guardrails Review

| File | Exists? | Accurate? | Recommended Action |
|------|---------|-----------|-------------------|
| `CLAUDE.md` | ✅ | ✅ | No action |
| `CONTRIBUTING.md` | ✅ | ✅ (62KB) | No action |
| `AGENTS.md` | ✅ | ✅ | No action |
| `README.md` | ✅ | ✅ | No action |
| `DESIGN.md` | ✅ | ✅ | No action |
| `.planning/STATE.md` | ✅ | ✅ Current | No action |
| `docs/development/VERTICAL_TDD.md` | ✅ | ✅ | No action |

| Folder | Exists? | Gaps | Recommended Action |
|--------|---------|------|-------------------|
| `docs/audits/` | ✅ | — | No action |
| `docs/prd/` | ✅ | Missing ceph BRs | Add CIMG-* to BUSINESS_RULES.md |
| `docs/modules/` | ✅ | 9/10 dental MODULE_SPECs missing | Create incrementally |
| `docs/decisions/` | ✅ (4 ADRs) | No ADR for cross-module bare FK pattern | Add ADR-005 |
| `specs/api/docs/standards/` | ✅ | FHIR entities don't map to dental DB | Maintain distinction |

---

## 13. PRD / Spec Coverage Review

| Artifact | Exists? | Matches Code? | Quality | Recommended Action |
|----------|---------|--------------|---------|-------------------|
| Master PRD (`docs/prd/v3-dentalemon.md`) | ✅ | ✅ | Good | No action |
| `BUSINESS_RULES.md` (BR-001–035) | ✅ | ✅ | Strong | **Add ceph BRs (CIMG-*)** |
| `ACCEPTANCE_CRITERIA.md` (40 ACs) | ✅ | ✅ | 50% tested | Add missing AC tests |
| `docs/product/ROLE_PERMISSION_MATRIX.md` | ✅ | ⚠️ Partial | Doesn't reflect assertBranchAccess gap | Update |
| `docs/modules/dental-imaging/MODULE_SPEC.md` | ✅ | ✅ | High quality | No action |
| MODULE_SPEC for dental-visit | ❌ | N/A | Missing | Create from code |
| MODULE_SPEC for dental-billing | ❌ | N/A | Missing | Create from code |
| MODULE_SPEC for dental-clinical | ❌ | N/A | Missing | Create from code |
| MODULE_SPEC for dental-scheduling | ❌ | N/A | Missing | Create from code |
| MODULE_SPEC for dental-patient | ❌ | N/A | Missing | Create from code |
| MODULE_SPEC for dental-pmd | ❌ | N/A | Missing | Create from code |
| MODULE_SPEC for dental-org | ❌ | N/A | Missing | Create from code |
| Vertical Slice Plan | ❌ | N/A | `.planning/ROADMAP.md` exists but not in `docs/execution/` | Convert format |
| Hurl contract tests | ✅ (35 files) | ✅ (base platform) | Dental domain not covered | Add dental Hurl tests |
| `specs/api/docs/standards/br-registry.json` | ✅ (empty) | ❌ | Not populated | Populate or remove |

---

## 14. Standards Gap Matrix

| Area | Current State | Target Standard | Gap | Risk | Priority |
|------|--------------|----------------|-----|------|----------|
| Architecture docs | CLAUDE.md covers content | Dedicated ARCHITECTURE.md | No standalone arch doc | Low | P3 |
| Domain glossary | FHIR-canonical (not dental-DB) | Canonical dental terms | "Visit" standardized (was "Encounter") — resolved G3-S1 | Low | P3 |
| Role permissions | Matrix exists; API enforcement missing | Matrix = API behavior | assertBranchAccess ignores MemberRole | High | **P1** |
| Module specs | 1/10 dental have MODULE_SPEC | One spec per major module | 9 missing | Medium | P2 |
| Ceph BRs | 0 ceph BRs in spec | BRs cover all features | Full ceph module unspecced | High | **P1** |
| AC test coverage | 50% (20/40) | 70%+ | 20 ACs untested | High | **P1** |
| Validation | OpenAPI-generated Zod validators | Server-side input validation | ✅ No gap | — | — |
| Error handling | Core error types consistent | Consistent format | Minor session/user pattern inconsistency | Low | P3 |
| Audit trail | Pino logs only | Queryable dental audit table | No `dental_audit` DB table | Medium | P2 |
| Coverage ratchet | line=62, function=61, branch=40 | 70%+ line on critical paths | Booking 11%, storage 20% below scope | Medium | P2 |
| Contract tests | 35 Hurl (base platform) | Critical paths contract-tested | Dental endpoints not in Hurl | Medium | P2 |
| BR registry | JSON exists but empty | Machine-readable BRs | 35 BRs not populated | Low | P3 |
| Health check | `GET /health` + test | Health endpoint | ✅ No gap | — | — |
| Structured logging | Pino JSON ✅ | JSON structured logging | ✅ No gap | — | — |

---

## 15. Inconsistency Report

### Critical (Security/Data Integrity)

None.

### Major (Functional Gaps)

| ID | Type | Description | Files | Impact |
|----|------|-------------|-------|--------|
| IC-01 | Permission | `assertBranchAccess` grants all branch members equal API access; `MemberRole` not checked | `handlers/shared/assert-branch-access.ts` | `staff_scheduling` can create treatments, void invoices |
| IC-02 | Spec gap | Ceph module (11 handlers, 3 tables, ceph-math package) has no formal BRs | `BUSINESS_RULES.md` | Compliance audit impossible for ceph |
| IC-03 | Business rule | BR-005 (auto-discard empty visits) not implemented; `describe.skip` | `business-rules.test.ts` | Abandoned draft visits persist |

### Minor (Consistency)

| ID | Type | Description | Impact |
|----|------|-------------|--------|
| IC-04 | Terminology | ~~"Encounter" (spec) vs "DentalVisit" (code)~~ — resolved G3-S1, "Visit" is canonical | Closed |
| IC-05 | Auth pattern | `ctx.get('session')?.userId` vs `ctx.get('user')?.id` inconsistency | Style only |
| IC-06 | FK pattern | Cross-module bare UUID FKs in dental-imaging | Intentional — needs ADR |
| IC-07 | Spec | `br-registry.json` empty despite 35 defined BRs | Machine-readable lookup broken |
| IC-08 | Test | BR-013 `describe.skip` — code may work, edge case unverified | Risk: silent regression |
| IC-09 | Performance | `listEMRPatients`: `Promise.all` per patient for stats = N+1 at API layer | Degrades at scale |
| IC-10 | DB | No partial unique index for double-booking on `dental_appointment` | Two appointments can overlap |
| IC-11 | UI | `imaging-test.tsx` and `imaging-comparison-test.tsx` are debug routes in production build | Should be guarded/removed |

---

## 15b. Security Audit (OWASP Top 10)

| OWASP Category | Status | Severity | Notes |
|---|---|---|---|
| A01 Broken Access Control | ⚠️ Partial | P1 | assertBranchAccess works; no role differentiation within dental domain |
| A02 Cryptographic Failures | ✅ | — | PIN stored as hash; no plaintext passwords/secrets in code |
| A03 Injection | ✅ | — | Drizzle ORM parameterized queries throughout; no raw SQL string concat |
| A04 Insecure Design | ⚠️ Low | P2 | No double-booking constraint at DB level |
| A05 Security Misconfiguration | ✅ | — | CSP + HSTS + X-Frame-Options via Hono `secureHeaders()`; dynamic CORS origin validation |
| A06 Vulnerable Components | N/A | — | Not assessed |
| A07 Auth Failures | ✅ | — | Better-Auth sessions; PIN lockout fields present (`pinLockedUntil`, `pinFailedAttempts`) |
| A08 Data Integrity | ✅ | — | No `dangerouslySetInnerHTML` without sanitization found |
| A09 Logging/Monitoring | ✅ | — | Pino structured JSON; HIPAA audit module; `X-Request-ID` tracing |
| A10 SSRF | ✅ | — | No user-controlled URL in server-side fetch found |

---

## 15c. Observability Audit

| Area | Status | Severity | Notes |
|---|---|---|---|
| Structured logging | ✅ Present | — | Pino JSON logger (`core/logger.ts`); request-level context injected |
| Correlation IDs | ✅ Present | — | `X-Request-ID` in CORS allowHeaders; `request.ts` middleware |
| Health checks | ✅ Present | — | `GET /health` + `core/health.test.ts` |
| Metrics instrumentation | ❌ Absent | P2 | No response time tracking, no error rate metrics |
| Dental audit trail | ⚠️ Partial | P2 | Pino logs dental actions but no `dental_audit` DB table — HIPAA dental activity not queryable |

---

## 15d. Performance Anti-Patterns

| Pattern | Instances | Severity | File:Line |
|---|---|---|---|
| N+1 query | 1 confirmed | P2 | `emr/listEMRPatients.ts` — `Promise.all` per patient for stats |
| Unbounded query | 0 | — | All list endpoints paginated |
| Missing index on FK | 5–7 | P2 | `imagingStudies.{patientId,visitId,branchId,acquiredBy}` — bare UUID FKs, no explicit index |
| Sync blocking | 0 known | — | No `readFileSync` in hot paths |
| PostgreSQL pool exhaustion | 1 (infra) | P2 | Full parallel `bun test` (113 files) → "too many clients already"; not a code defect |

---

## 16. Risk Assessment

### P0 Risks (Fix Immediately)

None. All prior P0 items resolved as of 2026-05-18.

### P1 Risks (Fix Before Major New Work)

| ID | Risk | Description |
|----|------|-------------|
| P1-001 | Ceph spec gap | 11 handlers + `packages/ceph-math` have no BRs in spec. Unauditable. |
| P1-002 | Dental RBAC missing | All 4 member roles have equal API access. `staff_scheduling` can void invoices. |
| P1-003 | AC coverage 50% | 20/40 ACs untested. Core flows (scheduling, payment, consent) have no regression coverage. |

### P2 Risks (Fix When Touching Module)

| ID | Risk | Description |
|----|------|-------------|
| P2-001 | 9/10 MODULE_SPECs missing | Cannot run compliance audit on dental-visit, billing, clinical, scheduling, patient, pmd, org |
| P2-002 | booking 11% / storage 20% coverage | Two modules below ratchet scope |
| P2-003 | Dental audit trail | No queryable dental audit table |
| P2-004 | No double-booking constraint | No DB unique index on dentist+slot |
| P2-005 | CephLandmark state machine unguarded | No TRANSITIONS map at API level |
| P2-006 | PaymentPlan/Installment status unguarded | Status updated but no handler guard |
| P2-007 | `br-registry.json` empty | 35 BRs defined but JSON registry not populated |
| P2-008 | PostgreSQL connection pool | Full parallel test run exhausts pool |

### P3 Risks (Improve Later)

| ID | Risk | Description |
|----|------|-------------|
| P3-001 | ~~"Encounter" vs "Visit" terminology~~ | Resolved in G3-S1 — "Visit" is canonical in all docs/comments |
| P3-002 | BR-005 not implemented | Auto-discard empty visits — abandoned drafts persist |
| P3-003 | BR-013 skipped test | Invoice reconciliation edge case unverified |
| P3-004 | Metrics absent | No response-time or error-rate instrumentation |
| P3-005 | Debug routes in production | `imaging-test.tsx`, `imaging-comparison-test.tsx` routes accessible in prod build |

---

## 17. Stabilization Plan

### Fix Immediately

None outstanding.

### Fix Before Major New Work

1. **Write ceph BRs** — add CIMG-001 through ~CIMG-012 to `docs/prd/BUSINESS_RULES.md`. Source: existing `ceph.test.ts` test cases and `packages/ceph-math` constants. ~2 hrs.

2. **Add dental role enforcement** — create `assertBranchRole(db, userId, branchId, allowedRoles[])` utility. Apply to 5 highest-risk endpoints: `createDentalTreatment`, `issueDentalInvoice`, `voidDentalInvoice`, `updateDentalVisit` (complete), `createPrescription`. ~4–6 hrs.

3. **Close 20 untested ACs** — prioritize: AC-SCHED-01 (calendar update), AC-PAY-01 (payment recording), AC-MED-03 (consent signing), AC-PRES-01 (prescriptions). 1–2 Playwright tests each. ~4–8 hrs.

### Fix When Touching Module

- **dental-visit**: Create MODULE_SPEC; add BR-013 un-skip test
- **dental-billing**: Create MODULE_SPEC; un-skip BR-013; add Hurl tests
- **dental-org**: Create MODULE_SPEC; add dental audit trail; fix double-booking constraint
- **dental-clinical**: Create MODULE_SPEC; guard CephLandmark transitions
- **dental-scheduling**: Create MODULE_SPEC; DB unique index on dentist+slot
- **booking**: Increase coverage from 11%
- **storage**: Increase coverage from 20%
- **Populate `br-registry.json`**: Script-generate from BUSINESS_RULES.md
- **Remove debug routes**: Guard `imaging-test.tsx` with env check

---

## 18. Standards Adoption Plan

### Phase 1: Add Guardrails — DONE (90%)

✅ CLAUDE.md, CONTRIBUTING.md, AGENTS.md, DESIGN.md, VERTICAL_TDD.md all accurate
⬜ No dedicated ARCHITECTURE.md (low priority)

### Phase 2: Document Current Reality — IN PROGRESS (35%)

✅ Master PRD, BUSINESS_RULES.md (35 BRs), ACCEPTANCE_CRITERIA.md (40 ACs)
✅ ROLE_PERMISSION_MATRIX.md (needs update re: assertBranchAccess gap)
✅ dental-imaging MODULE_SPEC.md
✅ 28 HTML wireframes
✅ 4 ADRs
⬜ MODULE_SPEC for 9 dental modules
⬜ Ceph BRs
⬜ ARCHITECTURE.md
⬜ Formal Vertical Slice Plan in `docs/execution/`

### Phase 3: Stabilize Risky Areas — IN PROGRESS (75%)

✅ All 4 prior P0 items resolved
✅ Route registration tests (216 routes)
✅ Coverage ratchet established
⬜ Dental RBAC role differentiation (P1-002)
⬜ 20 untested ACs (P1-003)
⬜ Double-booking constraint
⬜ Booking/storage coverage

### Phase 4: Adopt Vertical Slice TDD Going Forward — IN PROGRESS (65%)

✅ VERTICAL_TDD.md mandatory workflow
✅ v1.4 Ceph built with full TDD (S0→F6, 32 E2E green)
✅ Track B confidence sprint with systematic approach
⬜ `docs/execution/VERTICAL_SLICE_PLAN.md` not formalized
⬜ Slice specs not consistently written before implementation

### Phase 5: Migrate Existing Code Gradually — IN PROGRESS (20%)

✅ dental-imaging: fully documented + tested + MODULE_SPEC
✅ dental-visit, dental-billing: good tests, no MODULE_SPEC
⬜ dental-scheduling, dental-pmd, dental-org, dental-patient, dental-clinical: partial tests, no MODULE_SPEC

---

## 19. Recommended First 3 Vertical Slices to Standardize

| Rank | Slice | Module | Why | Risk | Expected Work |
|------|-------|--------|-----|------|---------------|
| 1 | Write ceph BRs (CIMG-001–012) + run compliance | dental-imaging (ceph) | Closes largest spec gap. Fully implemented code, spec is documentation-only. Immediately unlocks compliance audit for v1.4. | Low — no code changes | 2–3 hrs |
| 2 | Add dental role enforcement to 5 core operations | dental-org / shared | Closes P1-002. Creates `assertBranchRole` pattern all modules can adopt. Addresses scheduling-staff-voids-invoice risk. | Medium — API behavior change + test updates | 4–6 hrs |
| 3 | dental-visit MODULE_SPEC + 4 missing ACs (visit, scheduling) | dental-visit | Highest-traffic module, best-tested, easiest MODULE_SPEC to draft from existing code. Sets the template for remaining 8 modules. | Low | 4–6 hrs |

---

## 20. Health Score

| Dimension | Score (0–10) | Notes |
|-----------|-------------|-------|
| Terminology consistency | 9 | "Visit" canonical — "Encounter" alias resolved in G3-S1 |
| Permission coverage | 6 | Better-Auth enforced; dental RBAC missing role differentiation |
| Business rule clarity | 7 | 35 BRs formally documented; ceph BRs missing |
| API consistency | 8 | assertBranchAccess + Drizzle + PaginatedResponse consistent |
| State machine safety | 8 | 8/10 guarded; CephLandmark + PaymentPlan unguarded |
| Error handling uniformity | 8 | Core error types consistent; minor session/user style gap |
| Backend test coverage | 7 | Route-reg 100%; email 96%; comms 84%; booking 11%; storage 20% |
| Frontend test coverage | 6 | 126 test files; AC layer 50%; Calendar/Billing/Reports screens untested |
| PRD/spec coverage | 7 | Master PRD + BRs + ACs + 1 MODULE_SPEC; 9 module specs missing |
| UI prototype readiness | 8 | 28 wireframes; prototype isolated; debug routes in prod |
| Architecture alignment | 8 | Bun + Hono + Drizzle + Better-Auth matching stated standards |
| Domain model clarity | 6 | FHIR entity catalog exists but doesn't map to dental DB; DDD informal |
| Security posture (OWASP) | 8 | Drizzle prevents injection; secureHeaders; PIN hashed; CORS dynamic |
| Observability coverage | 7 | Pino + health check; no metrics; dental audit not queryable |
| Performance health | 7 | Pagination everywhere; N+1 in EMR; pool exhaustion in parallel tests |

**Overall health: 7.2/10** _(up from 5.4/10 on 2026-05-14)_

---

## 21. Final Recommendations

### Do Now

- **Write ceph BRs** (`BUSINESS_RULES.md`: CIMG-001 through ~CIMG-012) — 2 hrs, zero code risk, immediately unlocks compliance audit for v1.4
- **Create `assertBranchRole` utility** and gate the 5 highest-risk dental endpoints — closes P1-002 before it becomes a product liability
- **Un-skip BR-013** — if the underlying code is correct, the test passes; if it fails, that's a defect you want to find now

### Do Next

- Write MODULE_SPEC for `dental-visit` (highest-traffic, best-tested; sets template for remaining 8)
- Add 4 highest-value AC tests: AC-SCHED-01 (calendar update), AC-PAY-01 (payment recording), AC-MED-03 (consent signing), AC-PRES-01 (prescriptions)
- Populate `br-registry.json` (auto-generate script from BUSINESS_RULES.md)
- Fix PostgreSQL pool exhaustion for parallel tests (pgbouncer or test-file grouping)
- Guard or remove `imaging-test.tsx` and `imaging-comparison-test.tsx` from production build

### Do Later

- Create MODULE_SPECs for remaining 8 dental modules (dental-visit spec as template)
- Increase booking (11%) and storage (20%) coverage
- Add response-time and error-rate metrics instrumentation
- Formalize cross-module bare FK pattern as ADR-005 in `docs/decisions/`
- Add dental audit trail DB table for HIPAA-queryable dental activity

### Avoid

- Don't rewrite `assertBranchAccess` wholesale — extend with optional role parameter to preserve backward compat
- Don't batch all 9 MODULE_SPECs at once — write dental-visit first, validate format, then parallelize
- Don't implement BR-005 (auto-discard) without an ADR — requires session heartbeat + scheduled job
- Don't treat `specs/api/docs/standards/entity-catalog.md` as dental DB truth — it's FHIR-canonical; maintain the distinction

---

## 22. Domain Consistency Audit

**Audit date:** 2026-05-19 · **Codex-verified** · **14 findings**

### 22.1 Methodology & Scope

The dentalemon codebase layers dental-specific modules on top of the generic monobase platform, creating a "dual system" pattern: generic modules (`person`, `patient`, `booking`, `billing`, `provider`) coexist with dental-specific counterparts (`dental-patient`, `dental-scheduling`, `dental-billing`, `dental-org`, `dental-visit`, `dental-clinical`, `dental-imaging`). This audit catalogs every naming and terminology inconsistency across that boundary, classifies each as by-design vs. fixable, and provides a prioritized remediation roadmap.

### 22.2 Finding Catalog

| ID | Finding | Severity | Classification |
|----|---------|----------|----------------|
| DC-001 | Triple Identity: Person / Patient / DentalPatient | P1 | Partial by-design |
| DC-002 | Dual Scheduling: Booking vs DentalAppointment | P2 | By-design |
| DC-003 | Dual Billing: Invoice vs DentalInvoice | P1 | Partial by-design |
| DC-004 | Triple Provider: Provider / Practitioner / Membership | P1 | Bug (missing FK) |
| DC-005 | Treatment vs Procedure naming | P2 | Bug (fixed: renamed to `serviceType`) |
| DC-006 | Status enum casing inconsistency | P2 | Bug |
| DC-007 | Cross-module coupling in dental-patient | P2 | Bug |
| DC-008 | Inline Zod schemas outside generated validators | P3 | Bug |
| DC-009 | Domain glossary missing dental-specific terms | P3 | Bug |
| DC-010 | Amount field naming: bare vs `*Cents` suffix | P2 | Bug |
| DC-011 | Participant naming: client/host vs patientId/dentistMemberId | Info | By-design |
| DC-012 | Impoverished providerType enum (no dentist/hygienist) | P2 | Bug (fixed: enum expanded) |
| DC-013 | Missing FK `.references()` on dental UUID columns | P2 | Bug (fixed: FKs added in migrations 0023–0024) |
| DC-014 | Intra-dental casing: roles snake_case, statuses camelCase | P2 | Bug |

### 22.3 Detailed Analysis

**DC-001 — Triple Identity** (`services/api-ts/src/handlers/patient/repos/patient.schema.ts:27-30`)
Dental-specific columns (`preferredBranchId`, `dentalHistorySummary`, `hasActivePaymentPlan`, `recallDate`, `recallNote`, `followUpNotes`) are embedded directly in the generic `patient` table. Two distinct API surfaces — `POST /patients` (generic) and `POST /dental/patients` (dental-specific) — both write to the same underlying table. This creates coupling where dental concerns pollute the generic patient record and any future non-dental vertical would inherit dental columns.
*Recommendation:* Fix Later — extract dental columns into `dental_patient_extension` as a separate table. Trigger: before adding a second vertical domain.

**DC-002 — Dual Scheduling** (`services/api-ts/src/handlers/booking/` vs `dental-scheduling/`)
Two fully separate scheduling systems with incompatible status enums and no FK relationship. The generic `booking` system uses `client/host` participant language; the dental system uses `patientId/dentistMemberId`. This is **by-design**: generic booking handles external/patient-facing scheduling; dental appointments are clinical-workflow-specific.
*Recommendation:* Accept — document the boundary explicitly in ADR-006.

**DC-003 — Dual Billing** (`services/api-ts/src/handlers/billing/repos/billing.schema.ts` vs `dental-billing/repos/dental-invoice.schema.ts`)
The generic billing module uses bare amount names (`subtotal`, `total`); the dental billing module uses `*Cents` suffix (`subtotalCents`, `totalCents`, `balanceCents`). Both store integer cents. The dual-system split is partially by-design (generic = Stripe payments, dental = clinical invoicing), but the naming divergence is not.
*Recommendation:* Fix Next — standardize `*Cents` suffix across both billing schemas.

**DC-004 — Triple Provider** (`provider/repos/provider.schema.ts`, `practitioner.schema.ts`, `dental-org/repos/membership.schema.ts`)
The FHIR-aligned provider/practitioner chain is entirely bypassed by dental membership. `dental_membership.personId` is nullable (PIN-only staff have no `personId`), so a hard FK to `practitioner` is not always possible. No FK relationship exists between the three representations.
*Recommendation:* Fix Later — add optional `practitionerId` FK to `dental_membership` for memberships that DO have `personId`. Caveat: ~30% of memberships may be PIN-only.

**DC-005 — Treatment vs Procedure** (`dental-scheduling/repos/dental-appointment.schema.ts`)
`procedureType` column on dental appointments conflicted with the `DentalTreatment` entity name. **Already fixed** — renamed to `serviceType` in a prior schema-hardening commit (`bdc5494`).
*Status: CLOSED.*

**DC-006 — Status enum casing** (`dental-scheduling/repos/dental-appointment.schema.ts`)
Appointment statuses mix camelCase (`checkedIn`, `noShow`) with other dental enums that use snake_case. The `noShow` status also diverges from the booking module's `no_show_client` spelling for the same concept.
*Recommendation:* Fix Next — standardize dental appointment statuses to snake_case (`checked_in`, `no_show`) and update all references.

**DC-007 — Cross-module coupling** (`dental-patient/`)
The `dental-patient` handler imports directly from `dental-visit`, `dental-billing`, `dental-clinical`, and `dental-imaging` modules. This creates bidirectional dependency risk and makes it harder to test modules in isolation.
*Recommendation:* Fix Later — introduce module interface boundaries; route cross-module reads through repository contracts.

**DC-008 — Inline Zod schemas** (14+ handler files)
Handler files define request/response Zod schemas inline rather than relying solely on the generated `validators.ts`. This is partially intentional for handler-specific extensions but creates drift risk as TypeSpec evolves.
*Recommendation:* Fix Later — migrate inline schemas to TypeSpec + generated validators. Trigger: next TypeSpec revision cycle.

**DC-009 — Domain glossary gap** (`specs/api/docs/standards/domain-glossary.md`)
The glossary contains FHIR-generic terms only. Dental-specific entities used throughout the codebase (`DentalPatient`, `DentalVisit`, `DentalTreatment`, `DentalMembership`, `DentalAppointment`, `DentalInvoice`, `CephLandmark`, `ImagingStudy`) are absent.
*Recommendation:* Fix Now (docs-only) — see §22.5 Canonical Term Recommendations; dental terms added below.

**DC-010 — Amount field naming** (billing vs dental-billing schemas)
Generic billing: `subtotal`, `total` (integer cents, misleading bare names). Dental billing: `subtotalCents`, `totalCents`, `balanceCents` (explicit). Both intend the same semantic — integer cent amounts.
*Recommendation:* Fix Next — rename generic billing fields to `*Cents` pattern in a migration.

**DC-011 — Participant naming** (by-design)
Generic booking uses `clientId`/`hostId`; dental uses `patientId`/`dentistMemberId`. This is by-design domain language, not a bug.
*Status: Accept.*

**DC-012 — Impoverished providerType enum** (`provider/repos/provider.schema.ts`)
The `providerType` enum previously contained only `pharmacist | other`, making it impossible for the generic provider system to represent dental providers. **Already fixed** — `dentist`, `hygienist`, `pediatric_dentist` added in schema-hardening commit (`bdc5494`).
*Status: CLOSED.*

**DC-013 — Missing FK constraints** (dental schemas)
Dental tables had UUID foreign-key columns (`patientId`, `branchId`, `dentistMemberId`) as plain uuid columns with no `.references()`. **Already fixed** — FK constraints and cascades added in migrations 0023–0024.
*Status: CLOSED.*

**DC-014 — Intra-dental casing inconsistency** (`dental-org/repos/membership.schema.ts`, `dental-scheduling/repos/dental-appointment.schema.ts`)
Within the dental domain layer: membership roles use snake_case (`dentist_owner`, `staff_full`) while appointment statuses use camelCase (`checkedIn`, `noShow`). Same domain, different conventions.
*Recommendation:* Fix Next — standardize to snake_case (aligns with PostgreSQL conventions and the majority of dental enums).

### 22.4 By-Design vs Bug Classification

| Classification | Count | IDs |
|---------------|-------|-----|
| By-design (accept) | 3 | DC-002, DC-011, DC-001 (partial) |
| Already fixed | 3 | DC-005, DC-012, DC-013 |
| Fix Now (docs) | 1 | DC-009 |
| Fix Next (schema/code) | 5 | DC-003, DC-006, DC-010, DC-014, DC-004 (partial) |
| Fix Later (structural) | 4 | DC-001 (full), DC-004 (FK), DC-007, DC-008 |
| 0 actual bugs (code correctness) | — | All issues are naming/convention; code works correctly |

### 22.5 Canonical Term Recommendations

| Concept | Current (inconsistent) | Canonical Recommendation |
|---------|----------------------|--------------------------|
| Dental practitioner member | `DentalMembership` / `Member` | `DentalMember` (keep; document boundary from FHIR Practitioner) |
| Appointment service type | `procedureType` → `serviceType` | `serviceType` (already applied) |
| Monetary amounts | `subtotal` / `subtotalCents` | `*Cents` suffix everywhere |
| Appointment status | `checkedIn` / `checked_in` | `snake_case` throughout dental layer |
| No-show status | `noShow` / `no_show_client` | `no_show` (dental) — keep both distinct |
| Provider specialty | `pharmacist \| other` | `dentist \| hygienist \| pediatric_dentist \| pharmacist \| other` (applied) |

**Dental glossary additions** (to `specs/api/docs/standards/domain-glossary.md`):

| Term | Definition |
|------|-----------|
| DentalPatient | A patient record with dental-specific metadata (preferred branch, dental history summary, recall date). Shares the `patient` table with the generic Patient entity. |
| DentalVisit | A clinical encounter in the dental workspace; has a state machine (`draft → active → completed → locked`). Distinct from the generic Booking. |
| DentalTreatment | A procedure planned or performed during a DentalVisit (e.g., extraction, filling). Has its own state machine (`diagnosed → planned → performed → verified`). |
| DentalMember | A staff member linked to a dental branch via `dental_membership`. May or may not have a `personId` (PIN-only staff are anonymous). |
| DentalAppointment | A scheduled clinical encounter. Uses clinical participant language (`patientId`, `dentistMemberId`). Distinct from generic Booking. |
| DentalInvoice | A clinical bill derived from performed DentalTreatments. Uses `*Cents` integer amounts. Distinct from generic Invoice (Stripe). |
| ImagingStudy | A DICOM-based dental imaging session (e.g., X-ray, panoramic, CBCT). Linked to a DentalVisit and a dental branch. |
| CephLandmark | A cephalometric anatomical landmark point on a lateral skull radiograph (e.g., Sella, Nasion, Porion). Input to the isomorphic ceph-math engine. |
| CephAnalysis | A set of cephalometric measurements derived from CephLandmarks, used for orthodontic/orthognathic assessment. |

### 22.6 Reconciliation Roadmap

**Fix Now (documentation, zero code risk):**
- ✅ Write this audit section — done
- Add dental terms to `specs/api/docs/standards/domain-glossary.md` — see §22.5

**Fix Next (next sprint, schema changes):**
- Rename bare amount fields to `*Cents` in generic billing schema + migration (DC-003/DC-010)
- Standardize dental appointment status enum to snake_case (DC-006/DC-014)
- Add `dentist | hygienist` to `providerType` enum — DONE (DC-012)
- Add optional `practitionerId` FK to `dental_membership` for non-PIN-only memberships (DC-004)

**Fix Later (structural, trigger: second vertical domain):**
- Extract dental columns from `patient` table into `dental_patient_extension` (DC-001)
- Introduce module interface boundaries in `dental-patient` (DC-007)
- Migrate 14+ inline Zod schemas to TypeSpec-generated validators (DC-008)

**Accept (by-design, document only):**
- Dual scheduling systems — generic booking (external) vs dental appointments (clinical)
- Dual billing systems — generic Stripe invoicing vs dental clinical billing
- `client/host` vs `patientId/dentistMemberId` participant naming

### 22.7 Health Score Update

This audit does not change the overall health score (remains 9/10 per `CONFIDENCE_REPORT.md`). The domain model clarity dimension is revised: from "unscored" to **7/10** — the dual-system architecture is intentional and documented, but the naming inconsistencies (DC-003, DC-006, DC-010, DC-014) and structural gaps (DC-001, DC-007) prevent a higher score. Resolving the "Fix Next" items would advance this dimension to 9/10.
