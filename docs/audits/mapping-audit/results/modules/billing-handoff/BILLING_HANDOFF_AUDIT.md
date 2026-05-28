# Clinical→Billing Handoff Audit — Module #12

**Date:** 2026-05-26
**Auditor:** Read-only automated audit (module #12 of 18)
**Prior context:** CF-05 (J04 revenue chain BROKEN-expected) and CF-12 (BR-011 consent gate unenfored at invoice) captured in prior audits. This audit traces root causes and current state.

---

## Scope

**Critical path audited:** treatment performed → invoice creation → payment

Backend:
- `services/api-ts/src/handlers/dental-visit/updateDentalTreatment.ts`
- `services/api-ts/src/handlers/dental-billing/createDentalInvoice.ts`
- `services/api-ts/src/handlers/dental-billing/repos/dental-invoice.repo.ts`
- `services/api-ts/src/handlers/dental-billing/repos/dental-invoice.schema.ts`
- `services/api-ts/src/handlers/dental-visit/repos/treatment.repo.ts`
- `services/api-ts/src/handlers/dental-clinical/repos/consent-form.repo.ts`
- `services/api-ts/src/handlers/dental-billing/billing-gate-http.test.ts`

Frontend:
- `apps/dentalemon/src/features/workspace/hooks/use-mark-treatment-done.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-workspace-payment.ts`
- `apps/dentalemon/src/features/workspace/components/workspace-payment-modal.tsx`
- `apps/dentalemon/src/features/workspace/components/treatment-plan-tab.tsx`
- `apps/dentalemon/src/features/billing/components/billing-list.tsx`
- `apps/dentalemon/src/features/billing/components/invoice-detail.tsx`

Tests:
- `apps/dentalemon/tests/e2e/journeys/04-revenue-chain.journey.spec.ts`
- `apps/dentalemon/tests/e2e/clinical-billing-handoff.spec.ts`
- `apps/dentalemon/src/features/workspace/components/workspace-payment-modal.test.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-workspace-payment.test.ts`

---

## Findings Summary

| # | Severity | Gate | Finding | File |
|---|----------|------|---------|------|
| HANDOFF-F1 | P1 | G4/G5 | `WorkspacePaymentModal` receives ALL treatments regardless of status — `diagnosed`, `planned`, `dismissed` shown as payable line items. Backend correctly filters to `performed/verified` only, but the modal does not visually distinguish or exclude non-billable items. User sees a subtotal that will not match the invoice. | `workspace-payment-modal.tsx` / workspace route |
| HANDOFF-F2 | P1 | G6 | `useCreateInvoice` sends only `{ patientId, visitId, dueDate }` to `POST /dental/billing/invoices`. The backend requires `branchId` and `dentistMemberId` as required fields. The hook omits both. Calls will fail with a 400 validation error in any environment where the SDK's generated validator enforces required fields. | `use-workspace-payment.ts` |
| HANDOFF-F3 | P1 | G8 | `clinical-billing-handoff.spec.ts` (J37) does not sign a consent form before invoicing. The spec calls `POST /dental/billing/invoices` directly without first seeding or signing a consent form. `createDentalInvoice` now enforces BR-011 (CONSENT_REQUIRED). The spec will return 422 and fail. | `clinical-billing-handoff.spec.ts` |
| HANDOFF-F4 | P1 | G7 | J04 revenue chain journey (`04-revenue-chain.journey.spec.ts`) now has `expectedVerdict: 'PASS'` and relies on Maria Santos (P1) seed having a signed consent form. If `bun run db:reseed` is not run or the seed drifts, PATCH#2 returns 422 TREATMENT_CONSENT_REQUIRED and the journey reverts to BROKEN. The fix is seed-fragile — no CI guard ensures the seed is fresh before the journey harness runs. | `04-revenue-chain.journey.spec.ts` / `seed-demo.ts` |
| HANDOFF-F5 | P1 | G6 | `createDentalInvoice` queries `consent_form` by `visitId` but `billing-gate-http.test.ts` STOP CONDITION comment (still present in the file) says "createDentalInvoice does NOT check for a signed consent form." The comment is stale — enforcement was implemented — but the comment creates false confidence that the gate is absent, potentially misleading future developers. | `billing-gate-http.test.ts` line 7–11 |
| HANDOFF-F6 | P2 | G8 | `workspace-payment-modal.test.ts` skips the primary `PAY-01` test (`it.skip 'creates invoice when "Create Invoice" clicked'`) because `InvoiceDetail` crashes with `TypeError` when `lineItems` is absent on the invoice mock. The skip means the most important frontend billing interaction has zero unit test coverage. | `workspace-payment-modal.test.ts` |
| HANDOFF-F7 | P2 | G4 | `WorkspacePaymentModal.handleCreateInvoice` catches errors from `createInvoice.mutateAsync` but surfaces them only via `createInvoice.isError` and `createInvoice.error` — there is no `.catch()` or `toast()` call in the handler. The error is rendered as inline text below the button (`{createInvoice.error.message}`), which is hidden if the modal's scrollable area is not at the bottom. Users may click "Create Invoice" and see no visible feedback on failure. | `workspace-payment-modal.tsx` lines 317–327 |
| HANDOFF-F8 | P2 | G6 | `dental_invoice_line_item` schema has `treatmentId` as nullable (`uuid('treatment_id').references(...)` without `.notNull()`). This allows orphaned line items with no treatment link, breaking the clinical→billing traceability chain. Any manually-created or migrated invoice can have line items with no source treatment. | `dental-invoice.schema.ts` |
| HANDOFF-F9 | P2 | G8 | `AC-INV-04` ("Completed visit → footer 'View Invoice'") has no unit test and no E2E test (traceability matrix marks both ❌). After invoice creation, the workspace footer does not show a "View Invoice" link. This is a confirmed gap with zero test coverage. | `tooth-slideout.tsx` / traceability matrix |
| HANDOFF-F10 | P3 | G8 | `AC-PAY-01` ("Record full payment → status=paid") is marked `⚠️` in the E2E column: `clinical-billing-handoff.spec.ts` covers this path but the spec will fail due to HANDOFF-F3 (missing consent signing). Once F3 is fixed, AC-PAY-01 coverage is restored. | `clinical-billing-handoff.spec.ts` |

---

## J04 Root Cause Analysis

**CF-05 was: J04 revenue chain BROKEN-expected.**

The journey is now resolved with `expectedVerdict: 'PASS'`, but two separate issues caused it and one residual risk remains:

### Root Cause 1 — Two-Step State Machine Violation (FIXED)
`updateDentalTreatment` enforces `TREATMENT_TRANSITIONS`: `diagnosed → planned → performed`. A single PATCH from `diagnosed` to `performed` returns 422. The original frontend hook sent one PATCH to `performed`, which always failed. Fix: `use-mark-treatment-done.ts` now fires two sequential PATCHes (PATCH#1: `diagnosed→planned`, PATCH#2: `planned→performed`).

### Root Cause 2 — Unsigned Seed Consent Blocking PATCH#2 (FIXED)
`updateDentalTreatment` enforces BR (P0-003): a signed consent form must exist on the visit before a treatment can be marked `performed`. The demo seed for Maria Santos (P1) had an unsigned consent form. Fix: `seed-demo.ts` now seeds a signed consent form for Maria Santos' active visit.

### Residual Risk — Seed Fragility (HANDOFF-F4, P1)
J04's `expectedVerdict: 'PASS'` depends on the seed being run in `mixed` mode with Maria Santos having a signed consent. If the seed is re-run without the fix, or if a fresh environment is set up without `db:reseed`, PATCH#2 returns 422 and J04 silently reverts to BROKEN. There is no CI gate enforcing the seed state before the journey harness executes.

---

## Gate-by-Gate Analysis

### Gate 2 — Roles and Permissions

- `updateDentalTreatment`: uses `assertBranchRole(['dentist_owner', 'dentist_associate'])`. Correct — only clinicians can advance treatment status. `staff_full` and `hygienist` cannot mark treatments performed.
- `createDentalInvoice`: uses `assertBranchRole(['dentist_owner', 'dentist_associate', 'staff_full'])`. Intentional — front-desk staff can create invoices but cannot perform treatments. Role boundary is correct.
- `listDentalInvoices`: accessible to any branch member (uses `assertBranchAccess`). Appropriate for billing visibility.
- No role violations found at this gate.

**Gate 2 score: PASS**

### Gate 3 — Routes and Navigation

- `PATCH /dental/visits/{visitId}/treatments/{treatmentId}` — registered and reachable.
- `POST /dental/billing/invoices` — registered and reachable.
- `GET /dental/billing/invoices` — registered and reachable for invoice list.
- `GET /dental/billing/invoices/{invoiceId}` — registered and reachable.
- `POST /dental/billing/invoices/{invoiceId}/payments` — registered and reachable.
- No "Continue to Payment" button in the workspace navigates to a dedicated billing route — the payment modal is inline. This is by design (PAY-01). No broken route navigation found.
- **Gap:** No route exists for `POST /dental/billing/invoices/{invoiceId}/issue` in the frontend SDK call path — the E2E spec hits it directly via `page.evaluate`. If the issue step is ever needed from the UI, there is no hook or component for it.

**Gate 3 score: PASS with gap**

### Gate 4 — Frontend Interaction Integrity

**HANDOFF-F1 (P1):** The workspace route passes ALL treatments to `WorkspacePaymentModal.lineItems` without status filtering:

```typescript
lineItems={treatments.map((t) => ({
  id: t.id,
  description: t.description ?? t.procedureName ?? '—',
  cdtCode: t.cdtCode ?? t.procedureCode,
  toothNumber: t.toothNumber ?? undefined,
  priceCents: Math.round((t.priceAmount ?? 0) * 100),
  status: t.status ?? 'pending',
}))}
```

This means `diagnosed` and `planned` treatments appear in the modal's line item list and contribute to the subtotal. When the user clicks "Create Invoice", the backend will only bill `performed/verified` treatments. The displayed subtotal will exceed the actual invoice total — a discrepancy with no user-visible warning.

**HANDOFF-F7 (P2):** Error feedback from invoice creation is rendered inline below the footer button. If the scroll position is not at the bottom, the error text (`{createInvoice.error.message}`) is not visible.

**`useMarkTreatmentDone`:** Two-step flow is correctly implemented. Partial-failure self-healing is documented and works: if PATCH#1 succeeds and PATCH#2 fails, the treatment lands in `planned`; re-clicking Mark-Done completes it.

**Gate 4 score: PARTIAL — F1 is a P1 UX/data-integrity issue**

### Gate 5 — Forms, Modals, and Table Actions

**`WorkspacePaymentModal`:**
- Opens via "Continue to Payment" button in workspace top bar.
- Shows invoice status banner if an existing non-voided invoice already exists (PAY-02). Correct.
- "Create Invoice" button is disabled when `lineItems.length === 0` (BR-009 guard). Correct.
- `subtotalCents` is computed from `lineItems` prop (all statuses), not from actual billable treatments. Mismatch with backend invoice total (HANDOFF-F1).
- No confirmation step before creating invoice — single click commits. No destructive-action guard.

**`treatment-plan-tab.tsx`:**
- Shows treatments with status. "Mark Done" button is present and calls `useMarkTreatmentDone`. Correct wiring.
- No visual distinction between `diagnosed`, `planned`, `performed` beyond status label text.

**Gate 5 score: PARTIAL — F1 and missing confirmation step**

### Gate 6 — Backend API Contract Alignment

**`createDentalInvoice` current implementation:**
1. Auth: `assertBranchRole(['dentist_owner', 'dentist_associate', 'staff_full'])` — correct.
2. BR-011 consent gate: queries `consent_form WHERE visitId = ? AND signed = true LIMIT 1`. Returns 422 `CONSENT_REQUIRED` if absent. Implemented and tested in `billing-gate-http.test.ts`.
3. Fetches performed/verified treatments: filters `status === 'performed' || status === 'verified'`. Correct.
4. Empty billable set: throws `ValidationError('No billable treatments found')` → 400. Correct.
5. Double-billing prevention (S1-T7): checks `t.billedInvoiceId` on each billable treatment. If any treatment is already billed, throws `TREATMENT_ALREADY_BILLED` → 422. Implemented.
6. After invoice creation: calls `treatmentRepo.setBilledInvoiceId(billable.map(t => t.id), invoice.id)` to atomically mark treatments as billed. Correct.

**HANDOFF-F2 (P1) — `useCreateInvoice` missing required fields:**

The hook's `CreateInvoiceInput` interface:
```typescript
export interface CreateInvoiceInput {
  patientId: string;
  visitId?: string;
  dueDate?: string;
}
```

The `POST /dental/billing/invoices` body schema requires `branchId` (uuid, required) and `dentistMemberId` (uuid, required). The hook sends neither. The SDK's generated validator will reject the call with a 400. The frontend modal has no access to `branchId` or `dentistMemberId` from its props — these context values are not threaded through the component tree to `WorkspacePaymentModal`.

**HANDOFF-F5 (P1) — Stale STOP CONDITION comment:**
`billing-gate-http.test.ts` still carries the original STOP CONDITION comment at lines 7–11 stating that BR-011 is NOT enforced. The enforcement has been implemented in `createDentalInvoice.ts`. The comment contradicts the current code and will mislead developers.

**HANDOFF-F8 (P2) — Nullable `treatmentId` in line items:**
`dental_invoice_line_item.treatmentId` is a nullable FK. Any line item can exist without a treatment reference, breaking the traceability chain from invoice to clinical record.

**`updateDentalTreatment` contract:**
- TREATMENT_TRANSITIONS enforced: `diagnosed→planned→performed→verified`, `any (non-terminal)→dismissed`.
- BR-007: verified treatment fields are immutable.
- P0-003 consent gate: enforced before `performed` transition.
- Audit log: `logAuditEvent` called. Complete.

**Gate 6 score: PARTIAL — F2 is a P1 breaking contract mismatch; F5 is misleading documentation**

### Gate 7 — Role-Based Journey Map

**J04 — Revenue Chain (NOW PASSING):**

Current state: `expectedVerdict: 'PASS'`. Journey drives Mark-Done through the DOM (PATCH#1 + PATCH#2), then creates invoice via `apiReader.post` (anti-cheating rule compliance — no invoice creation UI exists in the workspace), then asserts `performed` status and invoice existence via independent reads.

The invoice creation step in J04 uses `apiReader.post` with `{ visitId, patientId, branchId, dentistMemberId, taxRate: 0 }`. This is correct — it provides all required fields. The journey spec passes because it supplies the fields the frontend hook omits (HANDOFF-F2 does not affect J04 since J04 bypasses the frontend modal for the invoice step).

**J37 — Clinical-Billing Handoff (`clinical-billing-handoff.spec.ts`):**

This spec covers the full flow: signup → org/branch/member seed → patient → visit → treatment two-step → invoice → payment → paid. However, `createAndCompleteVisit()` does not seed or sign a consent form. With BR-011 now enforced, `POST /dental/billing/invoices` returns 422 `CONSENT_REQUIRED`. The spec will fail at the invoice creation step (HANDOFF-F3, P1).

**Nominal path if all fixes applied:**
1. Patient registered, consent form signed
2. Visit created and activated
3. Treatment created (`status: 'diagnosed'`)
4. PATCH#1: `diagnosed → planned` (200)
5. PATCH#2: `planned → performed` (200, consent present)
6. `POST /dental/billing/invoices` with `{ visitId, patientId, branchId, dentistMemberId }` (201)
7. Line items verified — CDT code and price match treatment record
8. `POST /invoices/{id}/issue` (200)
9. `POST /invoices/{id}/payments` with full `amountCents` (201)
10. Invoice `status = 'paid'` confirmed via GET

Steps 6 and 7 are unreachable from the frontend workspace modal due to HANDOFF-F2.

**Gate 7 score: PARTIAL — J04 PASS; J37 will fail; frontend cannot complete the invoice creation step**

### Gate 8 — Test Confidence Gap

| Layer | Coverage | Status |
|-------|----------|--------|
| Treatment state machine unit (backend) | `updateDentalTreatment.test.ts` covers all transitions | PASS |
| BR-011 consent gate (backend unit) | `billing-gate-http.test.ts` — BR-009 and BR-011 tests present and complete | PASS |
| BR-009 billable treatment guard (backend unit) | `billing-gate-http.test.ts` — planned, performed, mix cases | PASS |
| Double-billing prevention (backend unit) | No dedicated unit test for `TREATMENT_ALREADY_BILLED` path | GAP |
| `use-mark-treatment-done` hook (frontend unit) | Test file present; covers two-step, partial-failure self-healing | PASS |
| `useCreateInvoice` hook (frontend unit) | `use-workspace-payment.test.ts` present; mock-only | PARTIAL |
| `WorkspacePaymentModal` PAY-01 create invoice (frontend unit) | `it.skip` — test skipped due to InvoiceDetail TypeError | FAIL (HANDOFF-F6) |
| `WorkspacePaymentModal` PAY-02 view invoice (frontend unit) | Covered in non-skip tests | PASS |
| J04 revenue chain (E2E journey) | `expectedVerdict: 'PASS'` but seed-fragile | CONDITIONAL |
| J37 clinical-billing handoff E2E | Fails — no consent form seeded (HANDOFF-F3) | FAIL |
| AC-INV-04 "View Invoice" after completion | No test at any layer | GAP (HANDOFF-F9) |
| AC-PAY-03 payment plan blocks invoice void | No E2E test | GAP |
| `voidDentalInvoice` | Not E2E tested | GAP |

**Gate 8 score: PARTIAL — 2 active test failures + 4 gaps**

---

## Critical Issues Detail

### HANDOFF-F2 — `useCreateInvoice` missing required fields (P1)

**File:** `apps/dentalemon/src/features/workspace/hooks/use-workspace-payment.ts`

The `CreateInvoiceInput` interface omits `branchId` and `dentistMemberId`. These are required by `createDentalInvoice.ts` and the OpenAPI schema. The `WorkspacePaymentModal` receives `patientId` and `visitId` as props but not `branchId` or `dentistMemberId`. The frontend invoice creation path is broken end-to-end from the UI.

**Impact:** Every attempt to create an invoice from the workspace payment modal will return 400 (missing required fields). The revenue chain cannot complete from the frontend UI.

**Fix:** Add `branchId: string` and `dentistMemberId: string` to `CreateInvoiceInput`. Thread `branchId` and `dentistMemberId` through the workspace route → `WorkspacePaymentModal` props → `useCreateInvoice` call.

---

### HANDOFF-F3 — `clinical-billing-handoff.spec.ts` missing consent signing step (P1)

**File:** `apps/dentalemon/tests/e2e/clinical-billing-handoff.spec.ts`

`createAndCompleteVisit()` transitions a treatment through `diagnosed→planned→performed` without seeding or signing a consent form. With BR-011 enforced at `updateDentalTreatment` (PATCH#2 for `performed`) and at `createDentalInvoice`, both steps will return 422 `CONSENT_REQUIRED`/`TREATMENT_CONSENT_REQUIRED`.

**Impact:** J37 (the dedicated clinical-billing handoff E2E spec) always fails. AC-PAY-01 full-payment coverage is lost.

**Fix:** Add a consent form seeding and signing step in `createAndCompleteVisit()` between visit activation and the PATCH to `performed`.

```typescript
// After visit activate, before treatment PATCH to performed:
await page.evaluate(async ({ api, visitId, patientId }) => {
  const cf = await fetch(`${api}/dental/visits/${visitId}/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ patientId, templateId: 'general-consent-v1', templateName: 'General Treatment Consent' }),
  }).then(r => r.json());
  await fetch(`${api}/dental/consent/${cf.id}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ signatureData: 'data:image/png;base64,test' }),
  });
}, { api: API, visitId, patientId });
```

---

### HANDOFF-F1 — Modal displays non-billable treatments in subtotal (P1)

**File:** `apps/dentalemon/src/features/workspace/components/workspace-payment-modal.tsx` (caller: workspace route)

The route passes all treatments (all statuses) as `lineItems`. The modal's subtotal is `lineItems.reduce((sum, item) => sum + item.priceCents, 0)`. A visit with one `diagnosed` ($150) and one `performed` ($200) treatment displays a subtotal of $350. The created invoice is $200. The user sees a $150 discrepancy with no explanation.

**Fix option A:** Filter in the route: pass only `status === 'performed' || status === 'verified'` treatments to `lineItems`.
**Fix option B:** Add status filtering inside `WorkspacePaymentModal` with a visual note explaining non-billable treatments are excluded.

---

## Recommended Fix Priority

| Priority | Finding | Action | Effort |
|----------|---------|--------|--------|
| P1 — fix before deploy | HANDOFF-F2 | Thread `branchId`+`dentistMemberId` through workspace → modal → hook | Low |
| P1 — fix before deploy | HANDOFF-F3 | Add consent seed+sign step in `createAndCompleteVisit()` | Low |
| P1 — fix before deploy | HANDOFF-F1 | Filter `lineItems` to `performed/verified` only before passing to modal | Low |
| P1 — fix before deploy | HANDOFF-F4 | Add CI gate to verify seed has signed consent before journey harness | Low |
| P1 — fix before deploy | HANDOFF-F5 | Delete stale STOP CONDITION comment in `billing-gate-http.test.ts` | Trivial |
| P2 — fix before release | HANDOFF-F6 | Fix `InvoiceDetail` mock in payment modal test to include `lineItems`; unskip PAY-01 test | Low |
| P2 — fix before release | HANDOFF-F7 | Add toast notification on invoice creation error | Low |
| P2 — fix before release | HANDOFF-F8 | Add `.notNull()` to `dental_invoice_line_item.treatmentId` FK | Low (migration required) |
| P2 — fix before release | HANDOFF-F9 | Implement and test "View Invoice" footer link in tooth slideout | Medium |

---

## Overall Confidence Score: 5/10

**Rationale:**

**Strengths:**
- Backend state machine is complete and correctly enforced (`TREATMENT_TRANSITIONS`, BR-007 immutability, P0-003 consent gate).
- BR-011 consent gate on invoice creation is implemented and has full unit test coverage in `billing-gate-http.test.ts`.
- Double-billing prevention (S1-T7) is implemented with `billedInvoiceId` tracking.
- J04 revenue chain journey is marked `PASS` and drives the flow through the real DOM.
- `use-mark-treatment-done` two-step hook is implemented, tested, and self-healing.
- Invoice schema has proper FK relationships (`treatmentId → dental_treatment`, `invoiceId → dental_invoice`).

**Critical gaps lowering the score:**
- HANDOFF-F2: Frontend cannot actually create an invoice from the workspace modal — `branchId` and `dentistMemberId` are missing from the hook. The most important user-facing billing action is broken in the UI.
- HANDOFF-F3: The dedicated E2E spec for this exact module (`clinical-billing-handoff.spec.ts`) fails due to missing consent signing — the test that should prove this handoff works does not run to completion.
- HANDOFF-F1: Subtotal displayed to user does not match the invoice amount — a data integrity UX defect visible to every user on every payment.
- HANDOFF-F6: The primary unit test for the payment modal is skipped.

The backend is robust. The frontend-to-backend wire is broken at the invoice creation call. J04 passing proves the concept works via API, not via UI. Confidence is limited to 5/10 until HANDOFF-F1, F2, and F3 are resolved.
