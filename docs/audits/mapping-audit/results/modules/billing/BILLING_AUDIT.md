# Billing Module Audit

**Module:** dental-billing  
**Audit Date:** 2026-05-26  
**Auditor:** Senior Code Reviewer (automated mapping audit)  
**Audit Gates Applied:** Gate 2 (Roles), Gate 3 (Routes), Gate 4 (Interactions), Gate 5 (Forms/Modals/Tables), Gate 6 (API Contract), Gate 7 (Role Journeys), Gate 8 (Test Confidence)

---

## Scope

### Files Audited

**Frontend**
- `apps/dentalemon/src/routes/_dashboard/billing.tsx`
- `apps/dentalemon/src/features/billing/components/billing-list.tsx`
- `apps/dentalemon/src/features/billing/components/invoice-detail.tsx`
- `apps/dentalemon/src/features/billing/components/payment-plan-view.tsx`
- `apps/dentalemon/src/features/billing/hooks/use-invoices.ts`
- `apps/dentalemon/src/features/billing/hooks/use-invoice-detail.ts`
- `apps/dentalemon/src/utils/guards.ts`
- `apps/dentalemon/src/utils/rbac.ts`

**Backend**
- `services/api-ts/src/handlers/dental-billing/createDentalInvoice.ts`
- `services/api-ts/src/handlers/dental-billing/issueDentalInvoice.ts`
- `services/api-ts/src/handlers/dental-billing/recordDentalPayment.ts`
- `services/api-ts/src/handlers/dental-billing/listDentalInvoices.ts`
- `services/api-ts/src/handlers/dental-billing/createDentalPaymentPlan.ts`
- `services/api-ts/src/handlers/dental-billing/repos/dental-invoice.schema.ts`
- `services/api-ts/src/handlers/dental-billing/repos/dental-invoice.repo.ts`

**Tests**
- `services/api-ts/src/handlers/dental-billing/dental-billing.test.ts`
- `services/api-ts/src/handlers/dental-billing/dental-billing-module2.test.ts`
- `services/api-ts/src/handlers/dental-billing/dental-billing-module3.test.ts`
- `services/api-ts/src/handlers/dental-billing/dental-billing-module4.test.ts`
- `services/api-ts/src/handlers/dental-billing/billing-gate-http.test.ts`
- `services/api-ts/src/handlers/dental-billing/ac-billing.test.ts`
- `services/api-ts/src/handlers/dental-billing/invoice.fsm.property.test.ts`
- `apps/dentalemon/tests/e2e/billing.spec.ts`
- `apps/dentalemon/tests/e2e/invoice-detail.spec.ts`
- `apps/dentalemon/tests/e2e/payment-plan.spec.ts`
- `specs/api/tests/contract/dental-billing.hurl`

**Spec**
- `specs/api/src/modules/dental-billing.tsp`
- `specs/api/dist/openapi/openapi.json` (dental/billing paths)

### Known Pre-Existing Findings (not re-reported)
- CF-05: Revenue chain J04 marked BROKEN-expected
- CF-09: Void Invoice fires without confirmation dialog
- CF-12: BR-011 consent gate not surfaced to user in frontend
- CF-35: Raw `fetch()` in `invoice-detail.tsx`

---

## Findings Summary

| ID | Severity | Gate | Finding | File |
|----|----------|------|---------|------|
| BILLING-F1 | P1 | Gate 2 | `dentist_associate` has billing access in RBAC matrix but backend `issueDentalInvoice` and `voidDentalInvoice` role gates explicitly deny associates — frontend will allow route entry but all write actions silently fail 403 | `apps/dentalemon/src/utils/rbac.ts` |
| BILLING-F2 | P1 | Gate 5 | `PaymentPlanView` uses raw `fetch()` for plan load — not SDK, no type safety, no auth error propagation, shares CF-35 root cause | `apps/dentalemon/src/features/billing/components/payment-plan-view.tsx` |
| BILLING-F3 | P1 | Gate 6 | `getPatientBalance`, `getDentalPaymentReceipt`, and `getCollectionsSummary` endpoints registered in OpenAPI and fully implemented backend — zero frontend consumers; no hook, no UI surface | OpenAPI + `services/api-ts/src/handlers/dental-billing/` |
| BILLING-F4 | P1 | Gate 8 | `payment-plan.spec.ts` uses hardcoded fixture UUIDs (`branchId: '00000000-0000-4000-8000-000000000001'`, `dentistMemberId: '00000000-0000-4000-8000-000000000002'`) — tests will pass only if seed data matches; no real org/branch/member created in test setup, making the test fragile and misleading | `apps/dentalemon/tests/e2e/payment-plan.spec.ts` |
| BILLING-F5 | P2 | Gate 5 | Installment rounding uses `Math.floor` — last installment absorbs no remainder correction; for non-divisible amounts the final installment will be short (e.g., ₱100 / 3 = ₱33 × 3 = ₱99 collected, ₱1 lost). No UI warning about rounding. | `services/api-ts/src/handlers/dental-billing/createDentalPaymentPlan.ts` |
| BILLING-F6 | P2 | Gate 4 | `BillingList` summary cards compute `collectedThisMonth` using invoice `createdAt`, not payment `recordedAt` — a payment recorded in month N for an invoice created in month N-1 is counted in the wrong month | `apps/dentalemon/src/features/billing/components/billing-list.tsx` |
| BILLING-F7 | P2 | Gate 3 | No billing tab exists under `_workspace` routes — the patient workspace has no billing sub-tab to view or create invoices in context of a specific visit; billing is only accessible from the top-level `/billing` dashboard route | `apps/dentalemon/src/routes/_workspace/` (absent) |
| BILLING-F8 | P2 | Gate 8 | Frontend component tests for `billing-list`, `invoice-detail`, and `payment-plan-view` test only pure helper functions (format, calc, validate); zero render tests, zero interaction tests, zero fetch/mutation path tests | `apps/dentalemon/src/features/billing/components/*.test.ts` |
| BILLING-F9 | P3 | Gate 6 | `listDentalInvoices` has no pagination response envelope — returns raw array; `use-invoices.ts` compensates with `raw?.data ?? []` fallback, creating a mismatch between OpenAPI schema (array) and the defensive code (implies possible object wrapper) | `apps/dentalemon/src/features/billing/hooks/use-invoices.ts` |
| BILLING-F10 | P3 | Gate 8 | `billing.spec.ts` FR4.1b test asserts `page.getByLabel(/invoice status filter/i)` — the `BillingList` component uses a `<select>` with `aria-label="Invoice status filter"` but the label match is locale-sensitive and brittle | `apps/dentalemon/tests/e2e/billing.spec.ts` |

---

## Gate-by-Gate Analysis

### Gate 2 — Roles and Permission Map

**Access Matrix (from `rbac.ts`):**

| Role | billing module access | canViewFinancials |
|------|----------------------|-------------------|
| dentist_owner | true | true |
| dentist_associate | **true** | true |
| staff_full | false | false |
| staff_scheduling | false | false |

**Backend Role Gates (from `dental-billing.test.ts` + `billing-gate-http.test.ts`):**

| Endpoint | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|----------|--------------|-------------------|-----------|-----------------|
| createDentalInvoice | allowed | allowed | 403 | 403 |
| issueDentalInvoice | allowed (pass) | **403** | 403 | 403 |
| voidDentalInvoice | allowed (pass) | **403** | 403 | 403 |
| recordDentalPayment | allowed | allowed | allowed (write) | unknown |
| applyDentalDiscount | allowed | unknown | unknown | unknown |
| createDentalPaymentPlan | allowed | allowed | unknown | unknown |

**Finding BILLING-F1 (P1):** The RBAC matrix grants `dentist_associate` access to the `billing` module (`billing: true`). This means associates can navigate to `/billing`, see invoice lists, and open invoice detail sheets. However, backend role gates deny associates from issuing invoices (403) and voiding invoices (403). The frontend has no role-aware UI suppression — the "Issue" and "Void" buttons will render and be clickable for associates, fire requests, and silently fail with a 403 that is rendered as a generic error or ignored. This is a workflow gap: the associate cannot complete the core billing journey but is given UI affordances that suggest they can.

**No audit gap for:** `staff_full` and `staff_scheduling` are correctly denied at the route level (billing: false in RBAC matrix) and at the backend level.

---

### Gate 3 — Routes and Navigation

**Registered routes:**
- `/_dashboard/billing` — top-level billing page, guarded by `requireRole('billing')`

**Guard implementation:**
`requireRole('billing')` reads role from `useOrgContextStore.getState().role` and calls `canAccess(role, 'billing')`. Redirects to `/dashboard` on denial. No auth check — assumes `requireAuth` was applied at layout level.

**Missing routes (BILLING-F7):**
No `_workspace/billing` or `_workspace/invoices` tab route exists. Workspace routes handle clinical encounter workflows; billing is entirely disconnected from the workspace flow. A dentist completing a treatment in the workspace must exit to the `/billing` dashboard to create an invoice. There is no "Bill this visit" shortcut from the workspace.

**No deep-link support:** Linking directly to a specific invoice (e.g., `/billing?invoiceId=xxx`) is not implemented — the route only supports opening the billing page; invoice selection is handled through `useState` local state with no URL synchronization.

---

### Gate 4 — Frontend Interaction Integrity

**BillingList:**
- Uses `useInvoices` (SDK-backed, TanStack Query). Correct pattern.
- Status filter tabs change a `selectedStatus` local state; `useInvoices` receives it as a query param. Correct.
- Row click fires `onInvoiceClick(invoice)` callback — bubbles to `BillingPage` which sets `selectedInvoiceId` and opens `InvoiceDetail` sheet. Correct.
- Summary cards (`collectedThisMonth`) computed locally from `createdAt` — see BILLING-F6.

**InvoiceDetail:**
- Uses raw `fetch()` for all operations (load invoice, issue, void, record payment) — pre-existing CF-35.
- `canVoid()` returns true for `'paid'` status: **NOT** — checked: `canVoid` only returns true for `issued | partial | overdue`. Backend allows voiding paid invoices ("admin correction"), but the frontend `canVoid` helper incorrectly returns false for `paid`. This means the "Void" button is hidden for paid invoices even though the backend accepts it. Documented as BILLING-F1 scope (associate) and CF-09 scope (no confirm dialog), but the paid-void frontend suppression is a distinct behavior mismatch.

**PaymentPlanView (BILLING-F2):**
- Uses raw `fetch(apiBaseUrl + '/dental/billing/invoices/' + invoiceId + '/plan')` inside a `useEffect`.
- No SDK hook, no TanStack Query caching, no retry logic, no loading skeleton coordination with parent.
- Auth errors (401) silently set `error` state with raw text — no redirect or re-auth.

**Confirmation dialogs:**
- Void invoice: no confirmation dialog (pre-existing CF-09, not re-reported here).
- Issue invoice: no confirmation dialog — irreversible state transition fires immediately on button click.

---

### Gate 5 — Forms, Modals, Tables

**Invoice List Table:**
- Columns: invoice number, patient name, visit date, due date, total, paid, balance, status, created at.
- Status badges present, correctly styled per status.
- Pagination: `listDentalInvoices` handler has page/limit support via `parsePagination`; however, `use-invoices.ts` does not pass page/limit parameters — fetches all invoices unbounded. No pagination UI in `BillingList`.

**Payment Form (inside InvoiceDetail):**
- Fields: amount (cents), method (select), receipt number, recorded-by member ID.
- Client-side validation via `validatePaymentForm()` — validates amount > 0, method required, receipt number required.
- `recordedByMemberId` is required in `buildPaymentPayload` but there is no UI field for it — the component must source this from context/store. If not found, the payload will contain an empty or undefined `recordedByMemberId`.
- `PAYMENT_METHODS` is `['cash', 'card', 'bank_transfer']` — matches backend.

**Installment Rounding (BILLING-F5):**
`createDentalPaymentPlan` computes `amountPerInstallmentCents = Math.floor(totalCents / numberOfInstallments)`. The remainder `totalCents % numberOfInstallments` is silently dropped. For a ₱1,000 balance split into 3 installments: 3 × ₱333 = ₱999 collected, ₱1 lost. The plan's `totalCents` will not equal `sum(installments[].amountCents)`. No UI warning. The Hurl contract test verifies `amountCents` is an integer but does not assert total integrity.

**PaymentPlanView modal:**
- Read-only view. No actions (no "Record Installment Payment" button).
- Installment table shows due date, amount, status — correct per wireframe.

---

### Gate 6 — Backend API Contract Alignment

**OpenAPI dental billing endpoints (from `openapi.json`):**

| Method | Path | OperationId | Frontend Consumer |
|--------|------|-------------|------------------|
| POST | /dental/billing/invoices | createDentalInvoice | `billing.spec.ts` (API-only, no UI hook) |
| GET | /dental/billing/invoices | listDentalInvoices | `use-invoices.ts` (SDK, correct) |
| GET | /dental/billing/invoices/{invoiceId} | getDentalInvoice | `invoice-detail.tsx` (raw fetch, CF-35) |
| POST | /dental/billing/invoices/{invoiceId}/issue | issueDentalInvoice | `invoice-detail.tsx` (raw fetch, CF-35) |
| POST | /dental/billing/invoices/{invoiceId}/void | voidDentalInvoice | `invoice-detail.tsx` (raw fetch, CF-35) |
| POST | /dental/billing/invoices/{invoiceId}/discount | applyDentalDiscount | Not found in frontend |
| POST | /dental/billing/invoices/{invoiceId}/payments | recordDentalPayment | `invoice-detail.tsx` (raw fetch, CF-35) |
| GET | /dental/billing/invoices/{invoiceId}/payments | listDentalPayments | `invoice-detail.tsx` (inferred raw fetch) |
| POST | /dental/billing/invoices/{invoiceId}/plan | createDentalPaymentPlan | `invoice-detail.spec.ts` (API-only) |
| GET | /dental/billing/invoices/{invoiceId}/plan | getDentalPaymentPlan | `payment-plan-view.tsx` (raw fetch, BILLING-F2) |
| GET | /dental/billing/collections/summary | getCollectionsSummary | **DEAD — no frontend consumer** (BILLING-F3) |
| GET | /dental/billing/patients/{patientId}/balance | getPatientBalance | **DEAD — no frontend consumer** (BILLING-F3) |
| GET | /dental/billing/invoices/{invoiceId}/payments/{paymentId}/receipt | getDentalPaymentReceipt | **DEAD — no frontend consumer** (BILLING-F3) |

**Finding BILLING-F3 (P1):** Three fully implemented backend endpoints have zero frontend consumers:
1. `getCollectionsSummary` — clinic-level collections analytics. Backend tested in `dental-billing-module3.test.ts`. `BillingList` summary cards replicate a subset of this functionality client-side using stale/local calculation — the authoritative server-side summary is never used.
2. `getPatientBalance` — per-patient outstanding balance with overdue breakdown. No hook, no component, no display anywhere in the UI.
3. `getDentalPaymentReceipt` — payment receipt retrieval. No download/print receipt feature in any component.

**applyDentalDiscount gap:** `POST /dental/billing/invoices/{invoiceId}/discount` is registered and implemented backend, but no frontend component provides a "Apply Discount" action. `invoice-detail.tsx` has no discount button or form.

---

### Gate 7 — Role-Based Journey Map

**Journey J1: dentist_owner creates and issues an invoice**
1. Navigate to `/billing` — ALLOWED (billing: true in RBAC) ✓
2. BillingList renders invoice list — ✓
3. Click row → InvoiceDetail sheet opens — ✓
4. Click "Issue" on a draft invoice — raw fetch to `/dental/billing/invoices/{id}/issue` — backend allows dentist_owner ✓
5. InvoiceDetail refreshes — calls `onUpdated()` which invalidates `['invoices']` query key ✓
6. **Gap:** "Issue" button has no confirmation dialog — irreversible transition fires immediately

**Journey J2: dentist_owner records payment**
1. Open invoice detail for issued/partial/overdue invoice ✓
2. Fill payment form (amount, method, receipt) ✓
3. Submit → raw fetch to `/dental/billing/invoices/{id}/payments` ✓
4. Change amount displayed if tendered > total ✓
5. `onUpdated()` invalidates invoice list cache ✓
6. **Gap:** `recordedByMemberId` in payload — unclear how this is sourced in the component

**Journey J3: dentist_associate attempts to issue invoice (BILLING-F1)**
1. Navigate to `/billing` — ALLOWED (billing: true for associate) ✓
2. BillingList loads, shows invoices ✓
3. Click row → InvoiceDetail sheet opens ✓
4. "Issue" button renders (no role-based suppression) ✓
5. Click "Issue" → 403 from backend — error rendered as generic error message
6. **Broken:** Associate cannot complete the invoice issuance journey; UI gives false affordance

**Journey J4: Create payment plan (from invoice-detail.spec.ts)**
1. InvoiceDetail has "View Payment Plan" button → opens PaymentPlanView modal ✓
2. PaymentPlanView loads plan via raw fetch ✓
3. **Gap:** No "Create Payment Plan" UI in InvoiceDetail — the plan creation happens via API directly in tests, not via a UI form. There is no UI for creating a new payment plan from the invoice detail sheet.

**Journey J5: View patient balance**
- No journey — `getPatientBalance` endpoint has no frontend consumer (BILLING-F3).

**Journey J6: Print/download payment receipt**
- No journey — `getDentalPaymentReceipt` endpoint has no frontend consumer (BILLING-F3).

---

### Gate 8 — Test Confidence Gap Analysis

**Backend unit tests — HIGH confidence:**
- `dental-billing.test.ts`: covers createInvoice, listInvoices, getInvoice, issueDentalInvoice, voidDentalInvoice, recordPayment, createPaymentPlan, getDentalPaymentPlan. Role gates tested for dentist_owner/staff_full/staff_scheduling/dentist_associate on issue and void.
- `dental-billing-module2.test.ts`: covers edge cases (EC3 discount stacking, EC6 multiple plans per patient).
- `dental-billing-module3.test.ts`: covers ACTIVE_PAYMENT_PLAN guard, ALREADY_VOIDED, ALREADY_PAID, NO_BALANCE, installment rounding — strong branch coverage.
- `dental-billing-module4.test.ts`: PaymentPlan FSM guard — completed/defaulted terminal states, valid transitions.
- `billing-gate-http.test.ts`: BR-009 (no billable treatments), signed consent, role isolation.
- `ac-billing.test.ts`: AC-001/AC-002/AC-003 discount reason persistence.
- `invoice.fsm.property.test.ts`: property-based FSM testing.
- `payment-plan.fsm.property.test.ts`: property-based FSM testing.

**Hurl contract tests — PARTIAL:**
- `dental-billing.hurl`: 16 steps covering full invoice lifecycle (create → issue → discount → payment → void) + payment plan creation + installment structure verification (G2-S4) + collections summary, patient balance, receipt, void auth checks (G2.5-S6).
- **Gap:** No Hurl scenarios for `applyDentalDiscount` boundary cases, `listDentalInvoices` filter combinations, or `getDentalPaymentPlan` after partial payment recording.

**Frontend component tests — LOW confidence (BILLING-F8):**
- `billing-list.test.ts`: tests 5 pure helper functions (formatInvoiceStatus, getStatusBadgeClass, formatCents, getBalanceClass, summarizeInvoices). No render tests.
- `invoice-detail.test.ts`: tests 6 pure helper functions (canIssue, canVoid, canRecord, validatePaymentForm, buildPaymentPayload, calcChangeAmount). No render tests.
- `payment-plan-view.test.ts`: tests 4 pure helper functions (formatFrequency, getPlanStatusClass, calcProgress, isInstallmentOverdue). No render tests.
- `use-invoices.test.ts` / `use-invoice-detail.test.ts`: exist but content was not fully indexed — likely mock-based query hook tests.

No component integration tests exist. The raw fetch paths in `invoice-detail.tsx` and `payment-plan-view.tsx` are untested at the component level.

**E2E tests — MODERATE confidence:**
- `billing.spec.ts`: FR4.1 (page loads), FR4.1b (filter visible, status badge visible after seeding), FR4.2/FR4.3 referenced but test bodies not confirmed to exercise payment modal and payment plan UI navigation end-to-end.
- `invoice-detail.spec.ts`: AC-INV-01 through AC-INV-04, AC-PAY-01, AC-PAY-02. Covers create → issue → record payment → assert balance. AC-PAY-03 (void with active plan → rejected). This is the strongest E2E coverage in the module.
- `payment-plan.spec.ts` (BILLING-F4): Tests plan creation and BR-011 guard via API calls inside `page.evaluate`. Uses hardcoded UUIDs (`branchId: '00000000-0000-4000-8000-000000000001'`, `dentistMemberId: '00000000-0000-4000-8000-000000000002'`) for visit creation — these will only succeed if seed data places those exact records in the database. The setup function creates a patient but does not create org/branch/member. Tests may pass in seeded CI but will fail on a clean database.

**Uncovered scenarios:**
- Associate denied 403 on issue/void (no frontend E2E test)
- Discount application from the UI (no UI feature exists)
- Payment receipt download (no UI feature exists)
- Patient balance display (no UI feature exists)
- Collections summary widget using server data (no UI feature exists)
- `BillingList` with >N invoices (no pagination test)
- Invoice deep-link / URL state persistence

---

## Critical Issues Detail

### BILLING-F1 — dentist_associate billing access vs. backend role gates (P1)

**Root cause:** RBAC matrix in `rbac.ts:29` sets `billing: true` for `dentist_associate`. Backend `issueDentalInvoice` and `voidDentalInvoice` both require `dentist_owner` role (confirmed by test: `dentist_associate → 403`). Frontend has no role-based conditional rendering to hide Issue/Void buttons for associates.

**Impact:** Associates navigate to billing, open invoices, click Issue or Void, and receive 403. The UI surfaces a generic error. Associates cannot complete the revenue chain journey. This is a UX trust issue: users believe they have access (route allows entry) but cannot act.

**Recommended fix:** Either (a) grant associates backend issue/void rights (business decision), or (b) set `billing: false` for associates in the RBAC matrix to deny route entry, or (c) add role-aware button suppression in `InvoiceDetail` using `canAccess(role, 'billing_write')` or equivalent.

---

### BILLING-F2 — PaymentPlanView raw fetch (P1)

**Root cause:** `payment-plan-view.tsx` uses `fetch(API + '/dental/billing/invoices/' + invoiceId + '/plan')` inside `useEffect`. No SDK hook exists for `getDentalPaymentPlan` in the frontend; the SDK has the endpoint but no generated React hook was wired.

**Impact:** No TanStack Query caching — every modal open triggers a fresh fetch. Auth errors (401 session expiry) silently set an error string instead of triggering a re-auth flow. Type safety is lost (cast to `any`). Shares root cause with CF-35 (invoice-detail raw fetch) — both components should be migrated to SDK hooks.

**Recommended fix:** Create `use-payment-plan.ts` hook using `getDentalPaymentPlanOptions` from the SDK (pattern mirrors `use-invoice-detail.ts`). Migrate `PaymentPlanView` to use the hook.

---

### BILLING-F3 — Dead backend endpoints: collections summary, patient balance, receipt (P1)

**Root cause:** Three endpoints (`getCollectionsSummary`, `getPatientBalance`, `getDentalPaymentReceipt`) are fully implemented with backend tests and Hurl contract coverage, but no frontend component consumes them. The `BillingList` summary cards recompute a subset of `getCollectionsSummary` data client-side from the raw invoice list, producing stale/inaccurate results (e.g., `collectedThisMonth` uses `createdAt` not payment date).

**Impact:**
- Clinic revenue analytics are computed client-side from a possibly-incomplete list (no date range filter applied by default).
- Patient balance is never surfaced in the UI — a front desk user cannot see a patient's total outstanding balance.
- Payment receipts cannot be generated or printed from the UI.
- Backend effort for these endpoints provides no user value.

**Recommended fix:** Add collections summary widget to `BillingList` using `getCollectionsSummary`. Add patient balance display to `InvoiceDetail` or patient profile. Add receipt download button in payment history section.

---

### BILLING-F4 — payment-plan.spec.ts hardcoded fixture UUIDs (P1)

**Root cause:** `payment-plan.spec.ts` `createAndCompleteVisit()` passes `branchId: '00000000-0000-4000-8000-000000000001'` and `dentistMemberId: '00000000-0000-4000-8000-000000000002'` as fixed values. The test `setup()` creates a patient via a non-dental `/patients` endpoint (not `/dental/patients`) and does not create a dental org, branch, or membership. Visit creation will fail unless the seed database already contains those exact UUIDs.

**Impact:** Tests are unreliable on a clean database. They may pass in seeded CI because the demo seed happens to include those UUIDs, giving false confidence. If the seed changes, tests silently break.

**Recommended fix:** Mirror the `setupDentalOrg` fixture pattern from `invoice-detail.spec.ts` — create org, branch, membership dynamically and capture real IDs. Remove all hardcoded UUID constants.

---

## Overall Confidence Score: 5/10

**Rationale:**

| Dimension | Score | Reason |
|-----------|-------|--------|
| Backend correctness | 9/10 | Extensive unit tests, property-based FSM tests, Hurl contract coverage. Role gates well-tested. BR-009, BR-011 enforced. |
| API contract alignment | 6/10 | 3 dead endpoints (BILLING-F3). `applyDentalDiscount` has no UI. Frontend raw-fetch paths bypass SDK type safety. |
| Role/permission integrity | 5/10 | RBAC matrix inconsistency for dentist_associate (BILLING-F1). Backend gates correct but frontend does not mirror them. |
| Frontend interaction | 5/10 | Raw fetch in both `invoice-detail.tsx` (CF-35) and `payment-plan-view.tsx` (BILLING-F2). No confirmation on Issue (irreversible). No "Create Payment Plan" UI. No discount UI. |
| Test confidence | 4/10 | Backend strong. Frontend component tests cover only pure helpers. E2E tests have fragile fixture reliance (BILLING-F4). |
| Journey completeness | 4/10 | Associate journey broken (F1). No workspace billing tab (F7). Collections/balance/receipt journeys entirely absent (F3). |

The backend billing engine is production-quality. The frontend surface is incomplete: three significant backend features have no UI, the associate role creates a misleading access pattern, and two key components bypass the SDK. The module can complete the basic `dentist_owner → create invoice → issue → record payment` journey but fails on analytics, receipts, patient balance, and associate workflows.
