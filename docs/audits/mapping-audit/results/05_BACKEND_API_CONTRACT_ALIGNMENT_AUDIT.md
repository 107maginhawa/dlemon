# Backend/API Contract Alignment Audit
**Date**: 2026-05-26  
**Auditor**: Journey Test Audit Orchestrator — Pass 06  
**Scope**: apps/dentalemon ↔ services/api-ts dental handlers  
**Mode**: Read-only. No code modified.

---

## 1. API Catalogue (Dental Handler Surface)

OpenAPI spec at `specs/api/dist/openapi/openapi.json` declares **100 dental paths**.

### 1A. Dental Billing

| Method | Path | Handler | Auth | Roles (assertBranchRole) | Backend Tests |
|---|---|---|---|---|---|
| POST | `/dental/billing/invoices` | `createDentalInvoice.ts` | session | dentist_owner, dentist_associate (inferred) | `dental-billing-module*.test.ts`, `billing-gate-http.test.ts` |
| GET | `/dental/billing/invoices` | `listDentalInvoices.ts` | session | assertBranchAccess (any member) | `dental-billing-module*.test.ts` |
| GET | `/dental/billing/invoices/{invoiceId}` | `getDentalInvoice.ts` | session | assertBranchAccess | `dental-billing-module*.test.ts` |
| POST | `/dental/billing/invoices/{invoiceId}/issue` | `issueDentalInvoice.ts` | session | BILLING_WRITE (inferred) | `dental-billing-module*.test.ts` |
| POST | `/dental/billing/invoices/{invoiceId}/void` | `voidDentalInvoice.ts` | session | dentist_owner (inferred) | `dental-billing-module*.test.ts` |
| POST | `/dental/billing/invoices/{invoiceId}/payments` | `recordDentalPayment.ts` | session | BILLING_WRITE | `dental-billing-module*.test.ts` |
| POST | `/dental/billing/invoices/{invoiceId}/payments/{paymentId}/void` | `voidDentalPayment.ts` | session | dentist_owner | Not confirmed |
| GET | `/dental/billing/invoices/{invoiceId}/payments/{paymentId}/receipt` | `getDentalPaymentReceipt.ts` | session | assertBranchAccess | `dental-billing-module2.test.ts` |
| POST | `/dental/billing/invoices/{invoiceId}/plan` | `createDentalPaymentPlan.ts` | session | BILLING_WRITE | `dental-billing-module*.test.ts` |
| POST | `/dental/billing/invoices/{invoiceId}/discount` | `applyDentalDiscount.ts` | session | dentist_owner | None confirmed |
| GET | `/dental/billing/patients/{patientId}/balance` | `getPatientBalance.ts` | session | assertBranchAccess | `dental-billing-module2.test.ts` |
| GET | `/dental/billing/collections/summary` | `getCollectionsSummary.ts` | session | assertBranchAccess | `dental-billing-module2.test.ts` |

**Known backend gap (documented in test file)**: `createDentalInvoice` does NOT enforce BR-011 (signed consent required before invoice). Stop-condition documented — cannot test until handler enforces rule.

### 1B. Dental Clinical (under `/dental/visits/{visitId}/...`)

| Method | Path | Handler | Roles (assertBranchRole) | Backend Tests |
|---|---|---|---|---|
| GET | `/dental/visits/{visitId}/lab-orders` | `listLabOrders.ts` | assertBranchAccess | `clinical-consent-lab.test.ts`, `repos/lab-order.test.ts` |
| POST | `/dental/visits/{visitId}/lab-orders` | `createLabOrder.ts` | dentist_owner, dentist_associate | `clinical-consent-lab.test.ts` |
| PATCH | `/dental/visits/{visitId}/lab-orders/{orderId}` | `updateLabOrder.ts` | dentist_owner, dentist_associate | `clinical-consent-lab.test.ts` |
| GET | `/dental/visits/{visitId}/prescriptions` | `listPrescriptions.ts` | assertBranchAccess | `clinical-prescription-history.test.ts` |
| POST | `/dental/visits/{visitId}/prescriptions` | `createPrescription.ts` | dentist_owner, dentist_associate | `clinical-prescription-history.test.ts` |
| GET | `/dental/visits/{visitId}/consents` | `listConsentForms.ts` | assertBranchAccess | `clinical-consent-lab.test.ts`, `repos/consent-form.test.ts` |
| POST | `/dental/visits/{visitId}/consents` | `createConsentForm.ts` | assertBranchAccess (any member) | `clinical-consent-lab.test.ts` |
| POST | `/dental/visits/{visitId}/consents/{consentId}/sign` | `signConsentForm.ts` | assertBranchAccess | `clinical-consent-lab.test.ts` |
| POST | `/dental/visits/{visitId}/attachments` | `createAttachment.ts` | dentist_owner, dentist_associate, hygienist | `clinical-attachment-amendment.test.ts` |
| GET | `/dental/visits/{visitId}/amendments` | `listAmendments.ts` | assertBranchAccess | `clinical-attachment-amendment.test.ts` |
| GET | `/dental/clinical/medical-history` | `listMedicalHistory.ts` | assertBranchAccess (via patient.preferredBranchId) | `repos/medical-history.test.ts` |

### 1C. Dental Org & Members

| Method | Path | Handler | Roles | Backend Tests |
|---|---|---|---|---|
| GET | `/dental/org/members?branchId=` | `listMembers.ts` | assertBranchAccess | `dental-org` tests (inferred) |
| POST | `/dental/org/members?branchId=` | `createMember.ts` | dentist_owner | `add-staff.spec.ts` (E2E) |
| DELETE | `/dental/org/members/:memberId` | `deactivateMember.ts` | dentist_owner | `deactivateMember.test.ts` |
| POST | `/dental/org/members/:memberId/reset-pin` | PIN reset | dentist_owner | `add-staff.spec.ts` (E2E) |
| POST | `/dental/org/members/:memberId/security-question` | `pinRecovery.ts` | Any member | Not confirmed |
| POST | `/dental/org/members/:memberId/recover-pin` | `pinRecovery.ts` | Any member | Not confirmed |
| POST | `/dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/verify-pin` | `DentalMembershipManagement_verifyPin.ts` | Any member | Inferred |
| GET | `/dental/organizations/{orgId}/branches/{branchId}/members` | `DentalMembershipManagement_list.ts` | Any member | Inferred |

### 1D. Dental Scheduling

| Method | Path | Handler | Roles | Backend Tests |
|---|---|---|---|---|
| GET | `/dental/appointments?date=&branchId=` | list | Any member | `dental-scheduling.test.ts`, `ac-scheduling.test.ts` |
| POST | `/dental/appointments` | create | Any member (inferred) | `dental-scheduling.test.ts` |
| PATCH | `/dental/appointments/{appointmentId}` | update | CLINICAL_WRITE (inferred) | `dental-scheduling-transitions.test.ts` |
| POST | `/dental/appointments/{appointmentId}/check-in` | check-in | Any member | `dental-scheduling.test.ts` |

**NOT in OpenAPI**: `/dental/branches/{branchId}/queue-board` (GET) — frontend polls this; no spec entry found.  
**NOT in OpenAPI**: `/dental/queue-items/{itemId}/status` (PATCH) — frontend updates status; no spec entry found.

### 1E. Dental Patients

| Method | Path | Handler | Roles | Backend Tests |
|---|---|---|---|---|
| GET | `/dental/patients` | list | Any member | `dental-patient.test.ts` (inferred) |
| POST | `/dental/patients` | create | CLINICAL_WRITE | `patient-registration.spec.ts` (E2E) |
| GET | `/dental/patients/{id}` | get | assertBranchAccess | Multiple |
| PATCH | `/dental/patients/{id}` | update | CLINICAL_WRITE | Multiple |
| POST | `/dental/patients/{id}/archive` | archive | CLINICAL_WRITE | `ac-scheduling.test.ts` |
| POST | `/dental/patients/{id}/restore` | restore | CLINICAL_WRITE | Inferred |
| POST | `/dental/patients/bulk-archive` | bulk archive | CLINICAL_WRITE | Inferred |
| GET | `/dental/patients/export` | export JSON | Any member | Inferred |
| GET | `/dental/patients/{patientId}/visits` | list visits | Any member | `dental-visit.test.ts` |
| GET | `/dental/patients/{patientId}/treatment-plan` | get plan | Any member | `dental-visit.test.ts` |

**NOT in OpenAPI**: `/dental/patients/{patientId}/recalls` (GET/POST/PATCH) — frontend calls these; no spec entry found.  
**NOT in OpenAPI**: `/dental/patients/{patientId}/treatment-plans` (plural) — frontend calls this; spec only has `/dental/patients/{patientId}/treatment-plan` (singular).

---

## 2. Frontend API Usage Matrix (Key Calls)

| Frontend Source | Action | API Called | Payload | Error Handling | Test Coverage |
|---|---|---|---|---|---|
| `use-staff-members.ts` | List members | `GET /dental/org/members?branchId=` | — | throws on !res.ok | `add-staff.spec.ts` |
| `use-staff-members.ts` | Create member | `POST /dental/org/members?branchId=` | `{displayName, role, pin}` | throws on !res.ok | `add-staff.spec.ts` |
| `use-staff-members.ts` | Deactivate member | `DELETE /dental/org/members/:memberId` | — | throws on !res.ok | `deactivateMember.test.ts` |
| `invoice-detail.tsx` | Get invoice | `GET /dental/billing/invoices/:invoiceId` | — | setError, loading | `billing.spec.ts` |
| `invoice-detail.tsx` | Issue invoice | `POST /dental/billing/invoices/:invoiceId/issue` | — | setError | `billing.spec.ts` |
| `invoice-detail.tsx` | Void invoice | `POST /dental/billing/invoices/:invoiceId/void` | — | setError | None confirmed |
| `invoice-detail.tsx` | Record payment | `POST /dental/billing/invoices/:invoiceId/payments` | `{amountCents, method, receiptNumber, recordedByMemberId: ''}` | setPaymentErrors | `billing.spec.ts` |
| `use-dashboard-summary.ts` | Appointments today/tomorrow | `GET /dental/appointments?date=&branchId=` | — | silent error (sets empty) | `use-dashboard-summary.test.ts` |
| `use-dashboard-summary.ts` | Dashboard summary | `GET /dental/dashboard/summary?branchId=` | — | silent error | `use-dashboard-summary.test.ts` |
| `use-dashboard-summary.ts` | Overdue invoices | `GET /dental/billing/invoices?status=overdue&branchId=` | — | silent error | `use-dashboard-summary.test.ts` |
| `use-recalls.ts` | List recalls | `GET /dental/patients/:patientId/recalls` | — | throws on !res.ok | None confirmed |
| `use-recalls.ts` | Create recall | `POST /dental/patients/:patientId/recalls` | `{type, scheduledDate, notes}` | throws | None confirmed |
| `use-recalls.ts` | Update recall status | `PATCH /dental/patients/:patientId/recalls/:recallId` | `{status}` | throws | None confirmed |
| `use-queue-board.ts` | Get queue | `GET /dental/branches/:branchId/queue-board` | — | throws on !res.ok | None confirmed |
| `use-queue-board.ts` | Update queue status | `PATCH /dental/queue-items/:itemId/status` | `{status}` | throws | None confirmed |
| `use-branch-settings.ts` | Get settings | `GET /dental/branches/:branchId/settings` | — | throws | None confirmed |
| `use-branch-settings.ts` | Save settings | `PATCH /dental/branches/:branchId/settings` | settings body | throws | None confirmed |
| `use-treatment-plans.ts` | List treatment plans | `GET /dental/patients/:patientId/treatment-plans` | — | throws on !res.ok | None confirmed |
| `use-treatment-plans.ts` | Create treatment plan | `POST /dental/patients/:patientId/treatment-plans` | plan body | throws | None confirmed |
| `ConsentSheet` | Create consent | `createConsentForm` (SDK) → `POST /dental/visits/:visitId/consents` | `{templateId, templateName}` | setError | `consent-sheet.test.ts` |
| `ConsentSheet` | Sign consent | `signConsentForm` (SDK) → `POST /dental/visits/:visitId/consents/:id/sign` | `{signatureData}` | setError | `consent-sheet.test.ts` |
| `AppointmentModal` | Create appointment | `createAppointment` (SDK) → `POST /dental/appointments` | full payload | setErrors | `appointment-modal.test.ts` |

---

## 3. Frontend/Backend Drift Report

| ID | Issue | Frontend File | Backend File/API | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|
| AD-01 | **`/dental/patients/{patientId}/treatment-plans` (plural) not in OpenAPI** — spec has singular `/treatment-plan`; frontend calls plural path which would 404 in production | `features/workspace/hooks/use-treatment-plans.ts` | OpenAPI spec | Spec output: treatment-plan path is singular; frontend uses `treatment-plans` | P0 | Integration: `GET /dental/patients/{id}/treatment-plans` → 200 (not 404) |
| AD-02 | **`/dental/patients/{patientId}/recalls` not in OpenAPI** — frontend calls GET/POST/PATCH but spec has no recall paths; backend handler existence unconfirmed | `features/workspace/hooks/use-recalls.ts` | OpenAPI spec | Spec output: `recall: []` (zero matches) | P0 | Integration: `GET /dental/patients/{id}/recalls` → 200; `POST /dental/patients/{id}/recalls` → 201 |
| AD-03 | **`/dental/branches/{branchId}/queue-board` not in OpenAPI** — QueueBoard polls every 15s; spec has no queue-board path | `features/scheduling/hooks/use-queue-board.ts` | OpenAPI spec | Spec output: `queue: []` (zero matches) | P1 | Integration: `GET /dental/branches/{id}/queue-board` → 200 |
| AD-04 | **`/dental/queue-items/{itemId}/status` (PATCH) not in OpenAPI** — QueueBoard updates status; spec has no queue-items path | `features/scheduling/hooks/use-queue-board.ts` | OpenAPI spec | Spec output: `queue: []` | P1 | Integration: `PATCH /dental/queue-items/{id}/status` → 200 |
| AD-05 | **`recordedByMemberId` hardcoded as `''` in payment recording** — backend stores this for audit trail; empty string loses auditor identity | `features/billing/components/invoice-detail.tsx:248` | `recordDentalPayment.ts` | Code: `recordedByMemberId: ''` | P1 | Integration: record payment → response.recordedByMemberId === current memberId (not '') |
| AD-06 | **BR-011 (consent required before invoice) NOT enforced at backend** — frontend ConsentSheet exists but backend createDentalInvoice does not gate on signed consent | `billing-gate-http.test.ts` (stop condition note) | `createDentalInvoice.ts` | Test file explicitly documents: "production code does not enforce this rule" | P1 | Backend unit: create invoice without signed consent → 422/400 (currently passes) |
| AD-07 | **ConsentSheet uses `createConsentForm(visitId)` but backend expects `patientId` in route path** — frontend calls `POST /dental/visits/{visitId}/consents`; check if visitId vs patientId routing is correct | `features/workspace/components/consent-sheet.tsx` | `createConsentForm.ts` | Frontend passes `visitId` as path; backend route is `/dental/visits/{visitId}/consents` — aligned but verify SDK type | P2 | Contract: POST consent with invalid visitId → 404 (not 500) |
| AD-08 | **Backend `createLabOrder` requires `dentist_owner` or `dentist_associate`** — but frontend shows Lab button to all roles in workspace top bar (no frontend gate) | `features/workspace/components/workspace-top-bar.tsx` | `createLabOrder.ts:29` | assertBranchRole: `['dentist_owner', 'dentist_associate']` | P1 | Permission: staff_full clicks Lab → gets 403; UI should block earlier |
| AD-09 | **Backend `createPrescription` requires `dentist_owner` or `dentist_associate`** — frontend Rx button visible to all roles | `features/workspace/components/workspace-top-bar.tsx` | `createPrescription.ts:31` | assertBranchRole: `['dentist_owner', 'dentist_associate']` | P1 | Permission: staff_scheduling clicks Rx → 403; UI should hide button |
| AD-10 | **Backend `createAttachment` allows `hygienist`** — but frontend ROLE_MATRIX documents only 4 roles; `hygienist` has no canAccess() definition in `utils/rbac.ts` | `features/workspace/components/workspace-top-bar.tsx` | `createAttachment.ts:29` | Backend: `['dentist_owner', 'dentist_associate', 'hygienist']`; Frontend RBAC: no hygienist entry | P1 | Permission: hygienist member clicks Attachments → 200 (not 403); but frontend may show wrong default |
| AD-11 | **Dashboard `GET /dental/appointments?date=&branchId=` may not exist in spec** — spec shows `/dental/appointments` without date query param documented | `features/dashboard/hooks/use-dashboard-summary.ts:69` | OpenAPI spec | OpenAPI shows `/dental/appointments` path (ambiguous method) | P2 | Contract: `GET /dental/appointments?date=2026-05-26&branchId=...` → 200 with appointments array |
| AD-12 | **Frontend InvoiceDetail uses raw fetch(), not SDK** — bypasses OpenAPI type safety; field names may drift if spec changes | `features/billing/components/invoice-detail.tsx` | OpenAPI spec | All billing calls in invoice-detail.tsx use raw `fetch(\`\${API}/dental/billing/...\`)` | P2 | Contract: Hurl contract suite covers GET/POST/void for invoices |
| AD-13 | **Frontend `use-branch-settings.ts` calls `/dental/branches/:branchId/settings`** — spec has this path; confirm method alignment | `features/settings/hooks/use-branch-settings.ts` | `getBranchSettings.ts` | GET (get) and PATCH (save) — spec confirms both exist | P2 | Integration: PATCH settings → saved → GET returns updated values |
| AD-14 | **Backend `voidDentalPayment` handler exists** — but no frontend UI surface found for voiding an individual payment (only void invoice visible) | None confirmed | `voidDentalPayment.ts` | Backend endpoint: `POST /dental/billing/invoices/{invoiceId}/payments/{paymentId}/void` | P2 | N/A — backend capability exceeds frontend surface (not a bug, but document gap) |
| AD-15 | **Backend dental-billing role enforcement not tested for `forbidden` case** — billing module tests always use `dentist_owner` role; no test for staff_scheduling attempting billing operations | `dental-billing-module2.test.ts` | `createDentalInvoice.ts` | All test users set as `role: 'dentist_owner'` | P1 | Backend integration: staff_scheduling → POST /dental/billing/invoices → 403 |

---

## 4. API Test Gap Matrix

| API Group | Existing Backend Tests | Missing Tests | Priority |
|---|---|---|---|
| Dental Billing — create invoice | Happy path (✅), planned treatment blocked (✅), BR-009 (✅) | Role-based forbidden (staff_scheduling → 403), BR-011 consent gate (explicitly deferred) | P1 |
| Dental Billing — void invoice | Happy path (inferred ✅) | Role check (non-owner → 403), double-void (conflict), receipt after void | P1 |
| Dental Billing — record payment | Happy path (✅) | `recordedByMemberId=''` accepted/rejected, duplicate payment, over-payment | P1 |
| Dental Clinical — consent create/sign | Happy path (✅) | Sign without template (400), sign already-signed (409), role forbidden (staff_scheduling → 403) | P1 |
| Dental Clinical — lab order | Happy path (✅) | Role forbidden (hygienist → 403), invalid visitId (404) | P1 |
| Dental Clinical — prescription | Happy path (✅) | Role forbidden (non-dentist → 403), FSM state validation | P1 |
| Dental Scheduling — queue board | None found | Happy path, status transitions, non-member access (403) | P0 — no test at all |
| Dental Scheduling — appointment create | Happy path (✅) | Role forbidden, duplicate time slot (conflict) | P2 |
| Dental Patients — recalls | None found | Happy path GET/POST/PATCH, non-member access (403) | P0 — no test at all; endpoint not in spec |
| Dental Patients — treatment-plans | None found (treatment-plan singular has tests) | GET treatment-plans plural, endpoint alignment | P0 — URL mismatch with spec |
| Dental Org — deactivate member | Happy path (✅ `deactivateMember.test.ts`) | Self-deactivation (should fail), non-owner (403), last member | P2 |
| Dental Org — create member with PIN | Happy path (✅ `add-staff.spec.ts`) | Duplicate display name, invalid role value, PIN format validation | P2 |

---

## 5. Gate 6 Verdict

**GATE 6: PASS (with critical API contract drift requiring stabilization)**

Backend API surface is substantial (100 dental OpenAPI paths + additional custom paths). Key items for stabilization plan:

- **AD-01**: `treatment-plans` vs `treatment-plan` URL mismatch — **would cause 404 in production**
- **AD-02**: Recalls endpoints called by frontend but absent from OpenAPI spec — existence unconfirmed
- **AD-03/04**: Queue board endpoints not in spec — polled every 15s; zero contract coverage
- **AD-05**: `recordedByMemberId=''` breaks audit trail for all payments
- **AD-06**: BR-011 (consent gate for invoicing) explicitly not enforced at backend — clinical risk
- **AD-08/09**: Backend role gates (403) exist for lab/rx but no frontend guard — users get silent 403s
