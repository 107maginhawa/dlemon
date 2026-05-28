# JOURNEY_COVERAGE_REPORT — dental-billing

**Module:** dental-billing
**Skill:** oli-ui-journey
**Standard:** docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md §8.4
**Reviewed:** 2026-05-27
**Files Reviewed:**
- `apps/dentalemon/src/routes/_dashboard/billing.tsx`
- `apps/dentalemon/src/features/billing/components/billing-list.tsx`
- `apps/dentalemon/src/features/billing/components/invoice-detail.tsx`
- `apps/dentalemon/src/features/billing/components/payment-plan-view.tsx`
- `apps/dentalemon/src/features/billing/hooks/use-invoices.ts`
- `apps/dentalemon/src/features/billing/hooks/use-invoice-detail.ts`
- `apps/dentalemon/src/features/workspace/components/workspace-payment-modal.tsx`
- `apps/dentalemon/src/features/workspace/hooks/use-workspace-payment.ts`
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx` (billing entry point)
- `apps/dentalemon/src/utils/rbac.ts`
- `apps/dentalemon/src/utils/guards.ts`

---

## Executive Summary

The dental-billing UI journey has a functional core: invoice list, invoice detail sheet, payment recording, and payment plan viewing are all present and connected. The workspace → invoice creation flow (WF-013) exists via `WorkspacePaymentModal`. However, five workflow-level gaps block or degrade the billing journey for a production clinic:

1. **WF-013 invoice creation ignores billability** — all treatments are passed to `WorkspacePaymentModal` regardless of `performed`/`verified` status; `pendingCount` counts `diagnosed|planned` items, not billable ones, making the payment CTA semantically wrong.
2. **WF-041 void has no confirmation dialog and no reason field** — destructive action fires immediately with no UX guard, violating MODULE_SPEC WF-041 step 2 and IDEAL_STANDARD §8.4.
3. **WF-015 create payment plan has no UI** — `PaymentPlanView` is read-only; there is no form to create a new plan from the invoice detail, making WF-015 unreachable from the front end.
4. **RBAC mismatch: staff_full blocked from billing module** — MODULE_SPEC says `staff_full` records payments, but `rbac.ts` sets `billing: false` for `staff_full`, blocking the entire billing route for the role that performs most payment recording.
5. **Receipt preview is absent** — payment recording captures a receipt number as a manual string but produces no receipt document or preview; IDEAL_STANDARD §8.4 "Receipt preview" (V1 Required) is unmet.

---

## V1 Readiness Rating

**ORANGE** — Core billing list and invoice detail are present, but the create-invoice flow has a billability defect, the role matrix blocks the primary payment-recording role from the billing page, void is unsafe, WF-015 has no UI, and there is no receipt generation. These gaps would cause operational errors in a live clinic.

---

## Workflow Coverage Matrix

| Workflow | Priority | Entry Point | Journey Status | Notes |
|----------|----------|-------------|----------------|-------|
| WF-013 Create invoice from visit | P0 | Workspace → Payment button | PARTIAL | All treatments passed regardless of billability status |
| WF-014 Record payment | P0 | Billing list → Invoice detail → Record Payment | PARTIAL | Blocked for `staff_full` due to RBAC bug |
| WF-051 View invoice | P0 | Billing list → row click | COVERED | |
| WF-052 Issue invoice (draft→issued) | P0 | Invoice detail footer | COVERED | |
| WF-015 Create payment plan | P1 | Invoice detail → Add Payment Plan | MISSING | `PaymentPlanView` is read-only; no create form exists |
| WF-041 Void invoice | P1 | Invoice detail footer → Void | PARTIAL | Button present but no confirmation dialog, no reason field |
| WF-042 Fee schedule lookup | P1 | Settings module | COVERED | |
| WF-053 Mark partial (plan) | P2 | System-driven | DEFERRED | |
| WF-054 Mark overdue (cron) | P2 | pg-boss cron | DEFERRED | |

---

## §8.4 Standard Gap Matrix

| §8.4 Expectation | Priority | Status | Evidence |
|------------------|----------|--------|----------|
| From work to invoice | V1 Required | PARTIAL | `WorkspacePaymentModal` passes all treatments including `diagnosed`/`planned`; only `performed`/`verified` should reach the invoice (BR-009) |
| Clear balance | V1 Required | COVERED | Invoice detail shows "Balance Remaining" in red; patient profile shows total balance |
| Payment-first checkout | V1 Required | COVERED | Workspace checkout button and `WorkspacePaymentModal` present |
| Discount reason | V1 Required | MISSING | `discountCents` is displayed read-only; no form to apply or adjust a discount with a required reason field |
| Receipt preview | V1 Required | MISSING | Payment form collects receipt number as free text; no receipt document, preview, or PDF generation |

---

## Critical Findings

### CR-01: RBAC blocks staff_full from billing module — primary payment-recording role locked out

**Files:** `apps/dentalemon/src/utils/rbac.ts:38`, `apps/dentalemon/src/routes/_dashboard/billing.tsx:19`

**Issue:** MODULE_SPEC §6 explicitly grants `staff_full` permission to record payments (P0 WF-014). `rbac.ts` sets `billing: false` for `staff_full`. The `requireRole('billing')` guard on the billing route redirects `staff_full` to `/dashboard`. This is a direct spec violation — the role responsible for most payment recording cannot access the billing page.

**Fix:**
```typescript
// apps/dentalemon/src/utils/rbac.ts
staff_full: {
  dashboard: true,
  workspace: true,
  patients: true,
  calendar: true,
  billing: true,   // was false — staff_full records payments (WF-014, MODULE_SPEC §6)
  reports: false,
  staff: false,
  settings: false,
},
```

---

### CR-02: Void fires immediately — no confirmation dialog, no reason field

**Files:** `apps/dentalemon/src/features/billing/components/invoice-detail.tsx:212-228`, `562-570`

**Issue:** `handleVoid()` calls `POST .../void` immediately when the "Void" button is clicked. No confirmation is shown. MODULE_SPEC WF-041 step 2 explicitly requires: "Confirmation dialog (destructive action): requires reason text." The backend void endpoint expects a reason; none is sent. Invoices can be voided by accident with a single click, with no reason stored in the audit trail.

**Fix:** Add a confirmation state with a required reason input before the void API call:
```tsx
// state additions:
const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
const [voidReason, setVoidReason] = useState('');

// footer button change:
{canVoid(invoice.status) && role === 'dentist_owner' && (
  <button type="button" onClick={() => setVoidConfirmOpen(true)}>Void</button>
)}

// confirmation form (inline or dialog):
{voidConfirmOpen && (
  <div>
    <label>Reason for voiding *</label>
    <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} />
    <button onClick={handleVoid} disabled={!voidReason.trim() || saving}>Confirm Void</button>
    <button onClick={() => { setVoidConfirmOpen(false); setVoidReason(''); }}>Cancel</button>
  </div>
)}

// handleVoid — include reason:
const res = await fetch(`${API}/dental/billing/invoices/${invoiceId}/void`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ reason: voidReason }),
});
```

---

### CR-03: WF-013 passes non-billable treatments to invoice creation (BR-009 violated in UI)

**Files:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:199-201`, `531-538`

**Issue:** `pendingCount` counts treatments with status `diagnosed` or `planned` (lines 199-201). The CTA reads "Continue to Payment (N pending)" where N is the count of unbillable items. `WorkspacePaymentModal` receives all treatments as line items. BR-009 requires ≥1 `performed`/`verified` treatment for invoice creation. The backend returns 422 `NO_BILLABLE_TREATMENTS` if the user submits; the UI provides no pre-flight guard — "Create Invoice & Pay" appears enabled even when zero treatments are billable.

**Fix:**
```typescript
// _workspace/$patientId.tsx
const billableTreatments = treatments.filter(
  (t) => t.status === 'performed' || t.status === 'verified' ||
         t.status === 'done' || t.status === 'completed'
);
const pendingBillableCount = billableTreatments.length;

// Pass billable only to modal:
lineItems={billableTreatments.map((t) => ({ ... }))}

// Disable CTA when none billable:
disabled={billableTreatments.length === 0 && !isReadOnly}
```
Add empty state copy: "Mark treatments as complete before generating an invoice."

---

## Warning Findings

### WR-01: WF-015 create payment plan has no UI (entire P1 workflow unreachable)

**Files:** `apps/dentalemon/src/features/billing/components/invoice-detail.tsx:532-580`, `apps/dentalemon/src/features/billing/components/payment-plan-view.tsx`

**Issue:** MODULE_SPEC WF-015 (P1) requires an "Add Payment Plan" action from a draft/issued invoice. The `InvoiceDetail` footer has Issue, Record Payment, View Payment Plan, and Void buttons — no "Add Payment Plan." `PaymentPlanView` is entirely read-only. WF-015 is unreachable from the UI.

**Fix:** Add an "Add Payment Plan" button to `InvoiceDetail` footer (visible when `status === 'issued' || status === 'draft'`) that opens a form collecting installment count, frequency, and start date, then calls `POST /dental/billing/invoices/:id/payment-plans`.

---

### WR-02: Receipt preview/generation absent (§8.4 "Receipt preview" V1 Required)

**Files:** `apps/dentalemon/src/features/billing/components/invoice-detail.tsx:408-430`

**Issue:** After recording a payment, the table lists receipt number, date, method, and amount — but there is no "Print Receipt" or "Preview Receipt" action. IDEAL_STANDARD §8.4 requires this as V1 Required. A clinic must hand a physical or digital receipt to the patient at checkout.

**Fix:** Add a "Print Receipt" button per payment row that opens a printable view with clinic name, patient name, date, amount, method, and receipt number. Alternatively, auto-generate receipt numbers (e.g., `RCP-YYYY-NNNN`) server-side to reduce manual entry errors.

---

### WR-03: Discount/write-off has no UI (§8.4 "Discount reason" V1 Required; BILL-BR-004 unenforced)

**Files:** `apps/dentalemon/src/features/billing/components/invoice-detail.tsx:384-389`

**Issue:** `discountCents` is displayed read-only when > 0. No UI exists to apply, adjust, or record a discount. IDEAL_STANDARD §8.4 and MODULE_SPEC data schema include `discount_reason`. BILL-BR-004 (discounts require permission and reason) has no enforcement path in the UI. Discounts can only exist if set via backend/seed.

**Fix:** Add a "Discount" action (role-gated) in invoice detail, opening an inline form: amount (cents) + required reason text. Calls `PATCH /dental/billing/invoices/:id` with `{ discountCents, discountReason }`.

---

### WR-04: Void button shown to non-owner roles (owner-only action visible to dentist_associate)

**Files:** `apps/dentalemon/src/features/billing/components/invoice-detail.tsx:562-570`

**Issue:** MODULE_SPEC §6 and WF-041 restrict void to `dentist_owner` only. `canVoid(status)` checks status only — not role. `dentist_associate` has billing module access and will see the Void button. The guard is route-level only, not action-level.

**Fix:**
```tsx
const role = useOrgContextStore(s => s.role);
{canVoid(invoice.status) && role === 'dentist_owner' && (
  <button ...>Void</button>
)}
```

---

### WR-05: "Collected This Month" uses invoice createdAt instead of payment date

**Files:** `apps/dentalemon/src/features/billing/components/billing-list.tsx:95-107`

**Issue:** `collectedThisMonth` sums `paidCents` for invoices whose `createdAt` falls in the current month. An invoice created last month but paid this month is excluded; an invoice created this month but still unpaid contributes `paidCents: 0` (harmless). The metric is misleading for staff reviewing monthly collections.

**Fix:** Use a `paidAt` or `lastPaymentAt` date from the invoice DTO if available. If not, label the card "Invoiced This Month" to avoid the implication that it represents received cash.

---

### WR-06: InvoiceDetail uses manual fetch instead of SDK/TanStack Query — cache incoherence

**Files:** `apps/dentalemon/src/features/billing/components/invoice-detail.tsx:177-192`, `apps/dentalemon/src/features/billing/hooks/use-invoice-detail.ts`

**Issue:** `InvoiceDetail` manages its own `fetch` calls with `useState` for loading/error. `useInvoiceDetail` hook already exists at `hooks/use-invoice-detail.ts` wrapping the same endpoint. Side effects:
- No cache sharing with other components showing the same invoice
- `onUpdated` callback in `WorkspacePaymentModal` is a no-op (`() => {}`) — after recording a payment via the workspace flow, billing list cache is stale
- `billing.tsx` `handleUpdated` invalidates `['invoices']` list cache but `InvoiceDetail` holds its own copy; detail may show stale totals

**Fix:** Refactor `InvoiceDetail` to use `useInvoiceDetail(invoiceId)` and `useQueryClient().invalidateQueries` for mutations.

---

## Info Findings

### IN-01: 'issued' filter tab labeled "Outstanding" — partial coverage mismatch

**Files:** `apps/dentalemon/src/features/billing/components/billing-list.tsx:117-124`

**Issue:** `FILTER_LABELS` maps `issued → 'Outstanding'` but the API filter is status-exact `issued`. The "Outstanding" tab excludes `partial` and `overdue` invoices, which staff reasonably expect to see under "Outstanding."

**Fix:** Either rename to "Issued" to match the status, or implement a compound filter (`issued | partial | overdue`) for the "Outstanding" tab.

---

### IN-02: Payment plan status snake_case vs camelCase mismatch in PaymentPlanView

**Files:** `apps/dentalemon/src/features/billing/components/payment-plan-view.tsx:62-75`, `91-99`

**Issue:** `getPlanStatusClass` handles `'on_track'` (snake_case) but `formatPlanStatus` handles `'onTrack'` (camelCase). If the API returns `on_track`, the badge is styled correctly but displays the raw string rather than "On Track."

**Fix:** Normalize both to the actual API response format.

---

### IN-03: Redundant `queryClient.invalidateQueries` on tab change

**Files:** `apps/dentalemon/src/features/billing/components/billing-list.tsx:139-143`

**Issue:** `handleTabChange` both updates `activeTab` state (changing the query key, sufficient to trigger a new fetch) and manually calls `invalidateQueries`. This forces a network request on every tab switch even for recently-fetched data.

**Fix:** Remove the `invalidateQueries` call from `handleTabChange`.

---

### IN-04: `recordedByMemberId` hardcoded to empty string in payment payload

**Files:** `apps/dentalemon/src/features/billing/components/invoice-detail.tsx:248`

**Issue:** `buildPaymentPayload` is called with `recordedByMemberId: ''`. The payment API likely uses this for audit trail. Sending an empty string produces an audit record with no actor.

**Fix:** Resolve `memberId` from session context (org-context Zustand store or auth context) before constructing the payload.

---

## Navigation Integrity Check

| Navigation Path | Status | Notes |
|-----------------|--------|-------|
| Dashboard sidebar → Billing | BLOCKED for staff_full (CR-01) | |
| Billing list → invoice row click → InvoiceDetail | COVERED | |
| InvoiceDetail → Issue Invoice | COVERED (draft only) | |
| InvoiceDetail → Record Payment → inline form | COVERED | |
| InvoiceDetail → View Payment Plan → PaymentPlanView | COVERED (read-only) | |
| InvoiceDetail → Add Payment Plan | MISSING (WR-01) | |
| InvoiceDetail → Void → confirm + reason | BROKEN — immediate fire, no confirm, no reason (CR-02) | |
| Workspace → Payment button → WorkspacePaymentModal | COVERED | |
| WorkspacePaymentModal → Create Invoice & Pay | PARTIAL — non-billable treatments included (CR-03) | |
| WorkspacePaymentModal → View Invoice → InvoiceDetail | COVERED | |
| Post-payment → receipt preview | MISSING (WR-02) | |
| Patient profile → balance summary | COVERED | |

---

## Dead Interactions

| Component | Dead Interaction | Root Cause |
|-----------|-----------------|------------|
| `billing.tsx` `handleUpdated` | Invalidates `['invoices']` list cache; InvoiceDetail uses imperative fetch state, may show stale totals after payment | Cache split (WR-06) |
| `WorkspacePaymentModal` `onUpdated` | No-op `() => {}` — billing list not refreshed after workspace payment | WR-06 |
| `PaymentPlanView` | Cannot create plan — no form | WR-01 |

---

## Role-Based Journey Gap Summary

| Role | Can Access Billing Route | Can Record Payment | Can Void | Can Create Invoice | Gap |
|------|--------------------------|--------------------|----------|-------------------|-----|
| dentist_owner | YES | YES | YES (button shown, no confirm) | YES | CR-02: void unsafe |
| dentist_associate | YES | YES | YES (should NOT — WR-04) | YES | WR-04: owner-only action visible |
| staff_full | NO (RBAC blocks) | NO — locked out | N/A | N/A | CR-01: P0 blocker |
| staff_scheduling | NO | NO | NO | NO | Correct per spec |

---

## Remediation Priority

| ID | Gap | Priority | Blocks V1? |
|----|-----|----------|------------|
| CR-01 | staff_full locked out of billing module | P0 | YES |
| CR-02 | Void no confirmation / no reason | P0 | YES |
| CR-03 | Non-billable treatments passed to invoice creation | P0 | YES |
| WR-01 | WF-015 create payment plan — no UI | P1 | YES |
| WR-02 | Receipt preview absent | P1 | YES |
| WR-03 | Discount/write-off UI absent | P1 | YES |
| WR-04 | Void button visible to non-owner roles | P1 | YES |
| WR-05 | "Collected this month" uses wrong date | P2 | NO |
| WR-06 | InvoiceDetail bypasses SDK/TanStack Query | P2 | NO |
| IN-01 | "Outstanding" tab label mismatch | P3 | NO |
| IN-02 | Plan status snake_case / camelCase mismatch | P3 | NO |
| IN-03 | Redundant invalidateQueries on tab change | P3 | NO |
| IN-04 | recordedByMemberId hardcoded to empty string | P2 | NO |

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (oli-ui-journey / gsd-code-reviewer)_
_Skill: oli-ui-journey --module dental-billing --auto_
