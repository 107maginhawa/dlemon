<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-module | run: 7 -->

# Enforcement Report: dental-billing

**Module:** `dental-billing`
**Run:** 7 (Wave3 regression verification)
**Generated:** 2026-05-29
**Spec:** `docs/product/modules/dental-billing/MODULE_SPEC.md`
**Handler root:** `services/api-ts/src/handlers/dental-billing/`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Compliance Score | 62 / 100 |
| v1 Status | PARTIAL |
| Service Layer | ABSENT (handler → repo pattern, no dedicated service class) |
| Total Findings | 13 |
| P0 | 2 |
| P1 | 5 |
| P2 | 4 |
| P3 | 2 |

---

## Dimension Scores

| Dimension | Score (0-10) | Notes |
|-----------|:---:|-------|
| 1. Public API Completeness | 6 | One handler unregistered; one missing role; error code drift |
| 2. Workflow Implementation | 5 | WF-054 cron absent; WF-052 email absent; WF-042 absent |
| 3. Domain Term Consistency | 7 | `balanceCents` vs `outstanding_cents`; notes absent; BR-011 mislabel |
| 4. State Machine Enforcement | 8 | All major transitions guarded; minor error code mismatch |
| 5. Event Publishing | 3 | DE-007 and DE-008 entirely unpublished; DE-009 partially (audit only) |
| 6. Auth / Route Protection | 8 | All routes behind authMiddleware; two RBAC role gaps |

> **P0 cap applies:** Score capped at 3 per P0 finding (2 P0s x -3 = -6 from dimensions 5 and 2)

---

## Findings

### P0 — Critical (Fix Immediately)

---

#### EM-BIL-23495b6c
**Severity:** P0
**Title:** DE-007 `InvoiceCreated` domain event not published in `createDentalInvoice`
**Spec Section:** §10b Domain Events, MODULE_SPEC §17 Observability Hooks, EVENT_CONTRACTS.md DE-007
**Confidence:** HIGH

**Description:**
`createDentalInvoice.ts` successfully creates the invoice and returns 201, but does not publish the `InvoiceCreated` (DE-007) domain event. The EVENT_CONTRACTS declares `notifs` and `dental-audit` as consumers of this event. Downstream consumers (patient notification, audit trail) are silently starved. No `logAuditEvent` call exists in the create path.

**Primary file:** `services/api-ts/src/handlers/dental-billing/createDentalInvoice.ts`

**Evidence:**
- Lines 18-106: entire handler has no `publishEvent`, `emitEvent`, `logAuditEvent`, or observability call
- `services/api-ts/src/generated/openapi/registry.ts:58` — handler is imported
- DOMAIN_MODEL SM-INVOICE row: `draft | sent | Staff/Dentist | — | DE-007`

**Fix:** Add `logAuditEvent` call (and forward event to notifs module) after line 103 (markTreatmentsAsBilled). Follow the pattern in `voidDentalInvoice.ts` lines 57-64.

---

#### EM-BIL-add117d4
**Severity:** P0
**Title:** DE-008 `InvoicePaid` domain event not published in `recordDentalPayment`
**Spec Section:** §10b Domain Events, WF-014 step 5, EVENT_CONTRACTS.md DE-008
**Confidence:** HIGH

**Description:**
`recordDentalPayment.ts` records the payment and updates invoice totals but emits no `InvoicePaid` event. The spec (WF-014 §4.2) requires: "Audit event: `billing.payment.recorded` with actor, amount, method." The `notifs` module depends on DE-008 to send receipts to patients. The audit trail for payments is completely absent.

**Primary file:** `services/api-ts/src/handlers/dental-billing/recordDentalPayment.ts`

**Evidence:**
- Lines 15-82: no `logAuditEvent` or publish call despite logger context being available
- Compare: `voidDentalInvoice.ts:57` correctly calls `logAuditEvent`
- EVENT_CONTRACTS.md: `DE-008 | InvoicePaid | Consumers: notifs, dental-audit`

**Fix:** After `addPayment` call (line 74), call `logAuditEvent` with `action: 'invoice.paid'` and emit the InvoicePaid event to notifs.

---

### P1 — Missing Method / Workflow / Guard

---

#### EM-BIL-4b60bbd3
**Severity:** P1
**Title:** `updateDentalPaymentPlan` handler implemented but not registered in routes
**Spec Section:** §19 Vertical Slice Plan BIL-S3, §3 WF-015
**Confidence:** HIGH

**Description:**
`updateDentalPaymentPlan.ts` exports a complete handler for `PATCH /dental/billing/plans/:planId/status` with FSM guard enforcement, but this handler is never imported in `registry.ts` and never bound in `routes.ts`. The route is unreachable at runtime. Tests in `dental-billing.payment-plan-fsm.test.ts` self-wire the route locally, so they pass in isolation but production traffic hits a 404.

**Primary file:** `services/api-ts/src/generated/openapi/routes.ts`

**Evidence:**
- `services/api-ts/src/handlers/dental-billing/updateDentalPaymentPlan.ts:16` — handler defined
- `grep updateDentalPaymentPlan registry.ts` → no output
- `grep updateDentalPaymentPlan routes.ts` → no output
- `dental-billing.payment-plan-fsm.test.ts:89` — test self-wires `/dental/billing/plans/:planId/status`

**Fix:** Import `updateDentalPaymentPlan` in `registry.ts` and add `app.patch('/dental/billing/plans/:planId/status', authMiddleware({roles:['user']}), ..., registry.updateDentalPaymentPlan)` in `routes.ts`.

---

#### EM-BIL-0decb164
**Severity:** P1
**Title:** `issueDentalInvoice` excludes `staff_full` role — violates WF-052 and spec §6
**Spec Section:** §6 Permissions, §4 WF-052 step 2
**Confidence:** HIGH

**Description:**
WF-052 explicitly lists "Roles: `dentist_owner`, `dentist_associate`, `staff_full`" as authorized to issue invoices. MODULE_SPEC §6 also grants `staff_full` for invoice creation. The handler only permits `['dentist_owner', 'dentist_associate']`. This means `staff_full` users (primary payment processors in clinics) cannot issue invoices despite the spec granting access.

**Primary file:** `services/api-ts/src/handlers/dental-billing/issueDentalInvoice.ts`

**Evidence:**
- Line 28: `assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner', 'dentist_associate'])`
- MODULE_SPEC §4 WF-052: "Roles: `dentist_owner`, `dentist_associate`, `staff_full`"
- MODULE_SPEC §6: "Create invoice | dentist_owner, dentist_associate, staff_full"

**Note:** ROLE_PERMISSION_MATRIX shows `staff_full` as denied for Issue invoice — a three-way inconsistency between MODULE_SPEC, ROLE_PERMISSION_MATRIX, and handler. Needs product owner decision before fix.

**Fix:** Align with MODULE_SPEC §6 + WF-052 by adding `'staff_full'` to line 28, or document the restriction as intentional and update both spec and workflow.

---

#### EM-BIL-e9b51d27
**Severity:** P1
**Title:** WF-054 overdue invoice cron job not wired to pg-boss scheduler
**Spec Section:** §3 WF-054, §4 WF-015 step 5, §14 Dependencies (pg-boss), §19 BIL-S6
**Confidence:** HIGH

**Description:**
`DentalInvoiceRepository.markOverdueInvoices()` exists and is unit-tested, but no pg-boss cron job registers and invokes it. Other modules (`booking`, `notifs`, `audit`, `email`) all have `jobs/` directories. `dental-billing` has none. Invoices past their `dueDate` will never auto-transition to `overdue` status in production.

**Primary file:** `services/api-ts/src/core/jobs.ts`

**Evidence:**
- `grep -r registerCron src/handlers/dental-billing` → no output
- No `dental-billing/jobs/` directory exists
- `dental-invoice.repo.ts:239` — `markOverdueInvoices()` defined but called nowhere in production
- Compare: `src/handlers/booking/jobs/index.ts:18` — `registerCron('booking.slotGenerator', ...)`

**Fix:** Create `services/api-ts/src/handlers/dental-billing/jobs/index.ts` with a daily cron job calling `invoiceRepo.markOverdueInvoices()`. Register it in `app.ts` alongside other module jobs.

---

#### EM-BIL-a72998a6
**Severity:** P1
**Title:** WF-052 does not send patient email on invoice issue
**Spec Section:** §4 WF-052 step 4, WF-013 step 5
**Confidence:** HIGH

**Description:**
WF-052 step 4 states: "Email sent to patient with invoice PDF link via `email` module." WF-013 step 5 also states: "Patient notified via email (notifs module)." The `issueDentalInvoice` handler returns the issued invoice without calling email or notifs. No email is queued. The patient never receives an invoice notification.

**Primary file:** `services/api-ts/src/handlers/dental-billing/issueDentalInvoice.ts`

**Evidence:**
- Lines 14-42: imports include only repo and auth utilities — no email/notifs import
- No `queueEmail`, `sendEmail`, or notifs call present in handler
- `src/core/email.ts:384` exposes `queueEmail` used by other modules

**Fix:** After `repo.issue(invoiceId)` (line 34), queue a transactional email to the patient with invoice details via the email module's `queueEmail` API.

---

### P2 — Domain Term / Consistency Issues

---

#### EM-BIL-08bcfc78
**Severity:** P2
**Title:** BR-009 guard returns HTTP 400 `VALIDATION_ERROR` instead of 422 `NO_BILLABLE_TREATMENTS`
**Spec Section:** §5 BR-009, §15 Error Handling, AC-BIL-001
**Confidence:** HIGH

**Description:**
Spec §15 declares: "No billable treatments | 422 | NO_BILLABLE_TREATMENTS". AC-BIL-001 tests for 422. The handler throws `new ValidationError(...)` which produces HTTP 400 with code `VALIDATION_ERROR`. Clients expecting 422 `NO_BILLABLE_TREATMENTS` will mishandle this as a generic validation error.

**Primary file:** `services/api-ts/src/handlers/dental-billing/createDentalInvoice.ts`

**Evidence:**
- Line 43: `throw new ValidationError('No billable treatments found for this visit')`
- `src/core/errors.ts:37`: `ValidationError` produces HTTP 400, code `VALIDATION_ERROR`
- Spec §15 + AC-BIL-001: HTTP 422, code `NO_BILLABLE_TREATMENTS`

**Fix:** Replace with `throw new BusinessLogicError('No billable treatments found for this visit', 'NO_BILLABLE_TREATMENTS')` to produce HTTP 422.

---

#### EM-BIL-a2ef0f37
**Severity:** P2
**Title:** `notes` field declared in spec §7 for `dental_invoice` is absent from schema
**Spec Section:** §7 Data Requirements
**Confidence:** HIGH

**Description:**
Spec §7 lists `notes` as a field of `dental_invoice`. The `dental-invoice.schema.ts` table definition has no `notes` column. The `dental_payment` table correctly includes `notes`. Callers cannot attach free-text notes to an invoice.

**Primary file:** `services/api-ts/src/handlers/dental-billing/repos/dental-invoice.schema.ts`

**Evidence:**
- Lines 20-47: `dental_invoice` table definition — no `notes` column
- `dental-payment.schema.ts:28`: `notes: text('notes')` present on payment, absent on invoice
- MODULE_SPEC §7: "dental_invoice: ... notes"

**Fix:** Add `notes: text('notes')` to the `dentalInvoices` table and generate a migration.

---

#### EM-BIL-3e4f008a
**Severity:** P2
**Title:** Domain term drift — spec uses `outstanding_cents`; API returns `balanceCents`
**Spec Section:** §7 Data Requirements ("computed response fields: ... outstanding_cents")
**Confidence:** HIGH

**Description:**
MODULE_SPEC §7 names the computed field `outstanding_cents (total_cents - paid_cents)`. The schema and all API responses use `balanceCents` / `balance_cents`. Any spec-compliant client expecting `outstanding_cents` receives undefined.

**Primary file:** `services/api-ts/src/handlers/dental-billing/getDentalInvoice.ts`

**Evidence:**
- `dental-invoice.schema.ts:35`: `balanceCents: integer('balance_cents')`
- `getDentalInvoice.ts:61`: response spreads `result.invoice` — returns `balanceCents`
- MODULE_SPEC §7: canonical term is `outstanding_cents`

**Fix:** Either rename `balanceCents` to `outstandingCents` across schema and handlers (requires migration), or add `outstandingCents: row.balanceCents` as an alias in all invoice response objects and document both names in spec §7.

---

#### EM-BIL-9b225f97
**Severity:** P2
**Title:** `createDentalPaymentPlan` allows `staff_full` but ROLE_PERMISSION_MATRIX denies it
**Spec Section:** §6 Permissions vs ROLE_PERMISSION_MATRIX §Billing Write Operations
**Confidence:** HIGH

**Description:**
MODULE_SPEC §6 says "Create payment plan | staff_full, dentist_owner" but the ROLE_PERMISSION_MATRIX shows `staff_full: ❌` for this action. The handler allows `['dentist_owner', 'dentist_associate', 'staff_full']`. Three-way inconsistency between MODULE_SPEC §6, ROLE_PERMISSION_MATRIX, and handler requires a product owner decision.

**Primary file:** `services/api-ts/src/handlers/dental-billing/createDentalPaymentPlan.ts`

**Evidence:**
- Line 30: `assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner', 'dentist_associate', 'staff_full'])`
- ROLE_PERMISSION_MATRIX: `Create payment plan | dentist_owner ✅ | dentist_associate (own) | staff_full ❌`
- MODULE_SPEC §6: "Create payment plan | staff_full, dentist_owner"

**Fix:** Decide authoritative source. If ROLE_PERMISSION_MATRIX is ground truth, remove `'staff_full'` and update MODULE_SPEC §6. If MODULE_SPEC §6 is correct, update the permission matrix.

---

### P3 — Optional / Deferred

---

#### EM-BIL-26da6fe2
**Severity:** P3
**Title:** `issueDentalInvoice` uses error code `INVALID_STATUS` instead of spec `INVALID_STATUS_TRANSITION`
**Spec Section:** §15 Error Handling
**Confidence:** HIGH

**Description:**
Spec §15 defines `INVALID_STATUS_TRANSITION` for invalid state transitions. `issueDentalInvoice.ts:31` throws `BusinessLogicError(..., 'INVALID_STATUS')`. Semantically similar but breaks client error discrimination.

**Primary file:** `services/api-ts/src/handlers/dental-billing/issueDentalInvoice.ts`

**Evidence:**
- Line 31: `'INVALID_STATUS'`
- MODULE_SPEC §15: `INVALID_STATUS_TRANSITION`

**Fix:** Change `'INVALID_STATUS'` to `'INVALID_STATUS_TRANSITION'`.

---

#### EM-BIL-d699d8db
**Severity:** P3
**Title:** Patient financial statement handler lives in `dental-patient` module, not `dental-billing`
**Spec Section:** §10 API Expectations (`GET /dental/patients/:id/statement`)
**Confidence:** MEDIUM

**Description:**
MODULE_SPEC §10 lists `GET /dental/patients/:id/statement` as a dental-billing API endpoint. The implementation lives in `dental-patient/identity/getDentalPatientStatement.ts` and directly queries dental-billing schemas without a billing facade. Route is functional but ownership is misaligned with spec, creating a latent coupling risk.

**Primary file:** `services/api-ts/src/handlers/dental-patient/identity/getDentalPatientStatement.ts`

**Evidence:**
- Line 15: imports `dentalInvoices, dentalInvoiceLineItems` directly from `dental-billing/repos/`
- Line 16: imports `dentalPayments` from `dental-billing/repos/`
- No billing facade intermediates the access

**Fix (P3):** Create `dental-billing/repos/statement.facade.ts` that `dental-patient` calls, or move the handler to dental-billing. Low urgency while both modules share the same service boundary.

---

## Dimension 1: Public API Completeness

Declared endpoints in MODULE_SPEC §10:

| Endpoint | Handler | Registered | Status |
|----------|---------|:---:|:---:|
| POST /dental/billing/invoices | `createDentalInvoice.ts` | Yes | FOUND |
| GET /dental/billing/invoices | `listDentalInvoices.ts` | Yes | FOUND |
| GET /dental/billing/invoices/:id | `getDentalInvoice.ts` | Yes | FOUND |
| PATCH /dental/billing/invoices/:id/issue | `issueDentalInvoice.ts` | Yes | FOUND (role gap) |
| POST /dental/billing/invoices/:id/payments | `recordDentalPayment.ts` | Yes | FOUND |
| POST /dental/billing/invoices/:id/void | `voidDentalInvoice.ts` | Yes | FOUND |
| POST /dental/billing/invoices/:id/payment-plans | `createDentalPaymentPlan.ts` | Yes | FOUND |
| GET /dental/patients/:id/statement | `getDentalPatientStatement.ts` | Yes | FOUND (wrong module) |
| PATCH /dental/billing/plans/:planId/status | `updateDentalPaymentPlan.ts` | NO | NOT REGISTERED |

Extra endpoints implemented beyond spec §10 (correctly added):
- `GET /dental/billing/invoices/:invoiceId/payments` — `listDentalPayments.ts`
- `GET /dental/billing/invoices/:invoiceId/plan` — `getDentalPaymentPlan.ts`
- `POST /dental/billing/invoices/:invoiceId/payments/:paymentId/void` — `voidDentalPayment.ts`
- `GET /dental/billing/invoices/:invoiceId/payments/:paymentId/receipt` — `getDentalPaymentReceipt.ts`
- `POST /dental/billing/invoices/:invoiceId/discount` — `applyDentalDiscount.ts`
- `GET /dental/billing/patients/:patientId/balance` — `getPatientBalance.ts`
- `GET /dental/billing/collections/summary` — `getCollectionsSummary.ts`

---

## Dimension 2: Workflow Implementation

| Workflow | Priority | Status | Notes |
|----------|----------|:---:|-------|
| WF-013 Create invoice from visit | P0 | PARTIAL | BR-009 works; DE-007 missing; consent check present |
| WF-014 Record payment | P0 | PARTIAL | Core payment works; DE-008 missing |
| WF-051 View invoice | P0 | FOUND | `getDentalInvoice.ts` |
| WF-052 Issue invoice | P0 | PARTIAL | Works; missing staff_full role, missing email |
| WF-015 Create payment plan | P1 | PARTIAL | Handler works; PATCH status route unregistered |
| WF-041 Void invoice | P1 | FOUND | BR-011 enforced; audit logged |
| WF-042 Fee schedule lookup | P1 | NOT FOUND | No dedicated dental-billing fee lookup endpoint |
| WF-053 Mark partial | P2 | FOUND | Handled atomically in `addPayment` SQL CASE |
| WF-054 Mark overdue cron | P2 | NOT WIRED | Method exists; pg-boss job not registered |

---

## Dimension 3: Domain Term Consistency

| Term | Spec Definition | Code Usage | Status |
|------|----------------|-----------|:---:|
| Invoice | draft to issued to paid/partial/overdue/voided | `dentalInvoiceStatusEnum` matches | OK |
| Line Item | CDT procedure charge | `dentalInvoiceLineItems` | OK |
| Payment Plan | Installment agreement | `dentalPaymentPlans` | OK |
| Installment | Auto-generated payment row | `dentalPaymentPlanInstallments` | OK |
| outstanding_cents | total_cents minus paid_cents | `balanceCents` in code | DRIFT |
| notes (invoice) | Free-text notes on invoice | Absent from invoice schema | MISSING |
| BR-011 | Active payment plan blocks void | Mislabeled as consent check in createDentalInvoice comment | MISLABELED |

---

## Dimension 4: State Machine Enforcement

SM-INVOICE transitions per spec §8:

| From | To | Guard | Status |
|------|-----|-------|:---:|
| draft | issued | Billable treatments present | FOUND (`issueDentalInvoice.ts:30`) |
| issued | paid | Payment >= total | FOUND (`addPayment` SQL CASE) |
| issued | partial | Partial payment | FOUND (`addPayment` SQL CASE) |
| partial | paid | Balance cleared | FOUND (`addPayment` SQL CASE) |
| draft/issued | voided | BR-011 no active plan, dentist_owner | FOUND (`voidDentalInvoice.ts:31,44`) |
| issued/partial | overdue | Past dueDate via cron | PARTIAL (method exists; cron not wired) |

---

## Dimension 5: Event Publishing

| Event | Trigger | Status |
|-------|---------|:---:|
| DE-007 InvoiceCreated | createDentalInvoice | NOT PUBLISHED (P0) |
| DE-008 InvoicePaid | recordDentalPayment | NOT PUBLISHED (P0) |
| DE-009 InvoiceVoided | voidDentalInvoice | PARTIAL (logAuditEvent called; notifs delivery not verified) |

---

## Dimension 6: Auth / Route Protection

All 14 registered dental-billing routes in `routes.ts` use `authMiddleware({ roles: ["user"] })`. Handler-level RBAC enforced via `assertBranchRole` or `assertBranchAccess`. No unprotected routes detected.

Two RBAC logic gaps exist (EM-BIL-0decb164, EM-BIL-9b225f97) — these are role permission gaps, not missing auth middleware.

---

## Unregistered Handler

- `updateDentalPaymentPlan.ts` — handler exists, NOT in `registry.ts`, NOT in `routes.ts` → P1 EM-BIL-4b60bbd3

---

## Stabilization Plan

| Priority | Finding ID | Action | When |
|----------|-----------|--------|------|
| P0 | EM-BIL-23495b6c | Publish DE-007 in createDentalInvoice | Fix now |
| P0 | EM-BIL-add117d4 | Publish DE-008 in recordDentalPayment | Fix now |
| P1 | EM-BIL-4b60bbd3 | Register updateDentalPaymentPlan route | Fix before new work |
| P1 | EM-BIL-0decb164 | Add staff_full to issueDentalInvoice (pending product decision) | Fix before new work |
| P1 | EM-BIL-e9b51d27 | Wire overdue cron to pg-boss | Fix before new work |
| P1 | EM-BIL-a72998a6 | Add email send to issueDentalInvoice | Fix before new work |
| P2 | EM-BIL-08bcfc78 | BusinessLogicError for BR-009 (422 + correct code) | Fix when touching handler |
| P2 | EM-BIL-a2ef0f37 | Add notes column to dental_invoice schema | Fix when touching schema |
| P2 | EM-BIL-3e4f008a | Align outstanding_cents vs balanceCents naming | Fix when touching schema |
| P2 | EM-BIL-9b225f97 | Reconcile staff_full payment plan permission | Decide and fix |
| P3 | EM-BIL-26da6fe2 | INVALID_STATUS to INVALID_STATUS_TRANSITION | Track |
| P3 | EM-BIL-d699d8db | Statement handler boundary or billing facade | Track |

---

## What's Next

1. Fix P0s: publish DE-007 in `createDentalInvoice.ts` and DE-008 in `recordDentalPayment.ts` following the `logAuditEvent` pattern in `voidDentalInvoice.ts`.
2. Register the orphaned route: add `updateDentalPaymentPlan` to `registry.ts` and `routes.ts`.
3. Wire the overdue cron: create `dental-billing/jobs/index.ts` with a daily `markOverdueInvoices` job.
4. Add email notification to `issueDentalInvoice`.
5. Fix `issueDentalInvoice` role gap (add staff_full pending product decision).
6. Reconcile payment plan permission with product owner before implementing.
7. Re-run `/oli-enforce-module --module=dental-billing` after P0+P1 fixes to verify score improves to 80+.
