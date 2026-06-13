# Appendix E — Commercial + Recall (Chunk E)

> Researcher chunk: **payment/invoice/billing** (dental-billing) + **recalls/recare** (recalls
> live under `dental-patient`, dispatched by a cron + surfaced in dental-scheduling's due-list and
> the workspace recalls sheet). Read-only research. Every claim carries a `file:line`/doc-id or
> `[ASSUMPTION]`. Surrogate spec for claims = `dental-billing-gap-plan.md`; recalls spec surrogate =
> `dental-scheduling-gap-plan.md` §SCH-G9 + the dental-patient recall code (no standalone recall
> MODULE_SPEC).
>
> **Scope correction (verified):** "Stripe Connect" is NOT in the dental vertical.
> `services/api-ts/src/handlers/billing/` (merchant accounts, `handleStripeWebhook`,
> `captureInvoicePayment`, `refundInvoicePayment`) is the frozen upstream base-template primitive —
> **0 Stripe imports in `dental-billing/`** (`grep -ril stripe services/api-ts/src/handlers/dental-billing/` → none)
> and every `/billing/*` + `/me/invoices` + merchant op shows **FE: 0** in contract-spine. Dental
> payments are cash/card/bank, recorded manually. Stripe is out of scope for this chunk
> (dental-billing-gap-plan.md §2 "Out of scope" confirms).

---

## (2) Baseline inventory — implemented workflows + business rules

Coverage cells ground-truthed against `contract-spine.json` (regenerated 2026-06-09) + grep + the
24-file billing / recall test corpus.

### E.1 — Billing (dental-billing)

| Workflow | FE entry (`file:line`) | Backend handler / endpoint | Rules | Coverage |
|----------|------------------------|----------------------------|-------|----------|
| Create invoice from visit (WF-013) | `workspace-payment-modal.tsx:181` `handleCreateInvoice`; `use-workspace-payment.ts:60` (memberId from org-context) | `createDentalInvoice.ts` · `POST /dental/billing/invoices` (FE:2) | BR-009, BR-014, EM-BILL-001 (taxRate server-controlled :69-74), S1-T7 double-bill guard :53-60 | backend `dental-billing.test.ts`, `.invoice-lifecycle.test.ts`, `billing-gate-http.test.ts` (BR-009/014); contract `dental-billing.hurl`; FE `workspace-payment-modal.test.ts`; E2E `billing.spec.ts`, `journeys/04-revenue-chain.journey.spec.ts` |
| Issue invoice draft→issued (WF-052) | `invoice-detail.tsx` | `issueDentalInvoice.ts` · `PATCH …/issue` (FE:1) | BR-012, V-BIL-003 (owner/associate only) | backend `.invoice-lifecycle.test.ts`; FE `invoice-detail.mutations.test`; E2E `invoice-detail.spec.ts` |
| Record payment (WF-014) | `invoice-detail.tsx:215` `buildPaymentPayload`; `workspace-payment-modal.tsx:303` | `recordDentalPayment.ts` · `POST …/payments` (FE:1) | BR-012, V-BIL-004 (`PAYMENT_EXCEEDS_BALANCE` :63), V-BIL-005 (`INVOICE_IMMUTABLE` :44-50), V-BIL-105 (draft→422 :55), N-BIL-01 (receipt idempotency :82-104), V-BIL-011 (DE-008 `invoice.paid` only on full :149) | backend `acceptance.billing-payments.test.ts` (AC-PAY-01..05), `.invoice-lifecycle.test.ts`, `dental-payer-payment.test.ts`; FE `invoice-detail.mutations.test`; E2E `journeys/04-revenue-chain` |
| Void invoice (WF-041) | `invoice-detail.void.test.ts` → `invoice-detail.tsx` | `voidDentalInvoice.ts` · `POST …/void` (FE:1) | BR-011 (active-plan block :46-51), owner-only :35, reason min5/max500 | backend `.invoice-lifecycle.test.ts`, `invoice.fsm.property.test.ts`; FE `invoice-detail.void.test`; E2E `invoice-detail.spec.ts` |
| Mark uncollectible (WF write-off) | `invoice-detail.uncollectible.test.ts` | `markUncollectible.ts` · `POST …/uncollectible` (FE:1) | BR-013 (owner-only, outstanding→uncollectible), BR-011 | backend `.invoice-lifecycle.test.ts`; FE `invoice-detail.uncollectible.test` |
| Apply discount | **none (BIL-G1)** | `applyDentalDiscount.ts` · `POST …/discount` (FE:0) | BR-015 (rate 0–100, V-BIL-001), owner-only, reason-required, audit failClosed :80 | backend covered; **FE/E2E UNTESTED — no UI** |
| Create payment plan (WF-015) | **none (BIL-G4)** | `createDentalPaymentPlan.ts` · `POST …/plan` (FE:0) | BR-015 (installment 2–24, `INVALID_INSTALLMENT_COUNT` :45), BR-011 | backend `dental-billing.payment-plan-fsm.test.ts`, `payment-plan.fsm.property.test.ts`, `acceptance.billing-payments.test.ts` (AC-PAY-04/05); **FE UNTESTED** |
| View payment plan | `payment-plan-view.tsx` | `getDentalPaymentPlan.ts` · `GET …/plan` (FE:1) | — | FE `payment-plan-view.test`; E2E `payment-plan.spec.ts` |
| Update payment plan | **none** | `updateDentalPaymentPlan.ts` (FE:0) | FSM `on_track⟷behind→completed\|defaulted` | backend `.payment-plan-fsm.test.ts`; **FE UNTESTED** |
| Void payment / refund | **none (BIL-G3)** | `voidDentalPayment.ts` · `POST …/payments/:id/void` (FE:0) | owner-only, V-BIL-013, audit failClosed :73, `removePayment` reverses status :179 | backend `dental-payer-payment.test.ts`, `audit-write-reliability.test.ts`; **FE UNTESTED** |
| Receipt (printable) | **none (BIL-G5)** | `getDentalPaymentReceipt.ts` · `GET …/receipt` (FE:0) | EC5 voided-receipt metadata | backend covered; **FE UNTESTED — V1-Required** |
| List invoices / detail | `billing-list.tsx`, `invoice-detail.tsx`, `patient-profile-page.tsx` | `listDentalInvoices` (FE:5, branchId required EM-BIL-001), `getDentalInvoice` (FE:2) | EM-BIL-001 (branchId required→400) | backend; FE `billing-list.test`; E2E `billing.spec.ts` |
| Patient balance | client-side sum `patient-profile-page.tsx:171` (**BIL-G6 dup source**) | `getPatientBalance.ts` · `GET …/balance` (FE:0) | BILL-BR-006 | backend; **FE consumer UNTESTED — canonical endpoint unwired** |
| Collections / AR aging | `CollectionsView` | `getArAging` (FE:1), `getCollectionsSummary` (FE:0, BIL-G7), `generateStatementBatch` (FE:1) | **EM-BIL-002** (omitted branchId → caller-branch scope) | backend `.cross-tenant-reports.test.ts` (×5), `.ar-aging-statements.test.ts`; E2E `billing.spec.ts` |
| Insurance / HMO revenue cycle | worklist renders, **no create (BIL-G2)** | `createInsuranceClaim`/`addInsuranceClaimLine`/`updateInsuranceClaimLine`/`getInsuranceClaim`/`estimateClaimCoverage` (FE:0/1-hook); `listInsuranceClaims`/`updateInsuranceClaimStatus`/`recordClaimRemittance`/`getPayerArAging` wired | EM-BIL-002 (claim worklist scope), claim FSM 10-state | backend `revenue-cycle-acceptance.test.ts`, `dental-insurance-claim.test.ts`, `claim.fsm.property.test.ts`; FE `claims-worklist.test`; E2E `insurance-claims.spec.ts` (cannot create) |

### E.2 — Recalls (recare) — owned by `dental-patient`, surfaced in scheduling + workspace

| Workflow | FE entry (`file:line`) | Backend handler / endpoint | Rules | Coverage |
|----------|------------------------|----------------------------|-------|----------|
| Create recall | `recalls-sheet.tsx:135` `handleCreate`; `use-recalls.ts` | `createRecall.ts` · `POST /dental/patients/:id/recalls` (FE:2) | EF-PAT-004 (branch access via `patient.preferredBranchId` :29), EF-PAT-001 (archived block :32), P1-24 (intervalMonths) | backend `dental-patient-recall.test.ts`, `recalls-route-registration.test.ts`; FE `recalls-sheet.test.ts:114`; contract `dental-patient.hurl` |
| List patient recalls | `recalls-sheet.tsx` via `use-recalls.ts` | `listPatientRecalls.ts` · `GET …/recalls` (FE:1) | EF-PAT-004 | FE `recalls-sheet.test.ts:91` |
| Update recall (FSM) | `recalls-sheet.tsx:300` transition buttons; `RECALL_TRANSITIONS:31` mirrors backend `RECALL_FSM` | `updateRecall.ts` · `PATCH …/recalls/:id` (FE:3) | RECALL_FSM (`recall.schema.ts:12`), BR-003 (terminal completed/cancelled), P1-24 next-cycle seed :74-88 | backend `dental-patient-recall.test.ts`, `recall-dates.test.ts`; FE `recalls-sheet.test.ts:141` |
| Recall due-list (front desk) | `recall-due-list.tsx`; `use-recall-due-list.ts:36` (2000-01-01 floor workaround) | `listDueRecalls.ts` · `GET /dental/recalls/due` (FE:1) | V-PAT-002 branch-scope (:35), **SCH-G9** (from defaults today :43 → drops overdue) | backend `recall-dates.test.ts`; FE `use-recall-due-list.test.ts`, `recall-due-list.test.ts`; E2E `recall-due-list.spec.ts`, `journeys/02-periodic-recall.journey.spec.ts` |
| Recall dispatch (cron) | n/a (system) | `jobs/recallDispatch.ts`, `jobs/recallDueScan.ts` | P1-24 (consent-gate :72-83, branch-tz due-ness :57, idempotent enqueue keyed on relatedEntity+type+channel+scheduledAt :91), max-attempts/reattempt :61-70 | backend `recallDispatch.test.ts`; **no contract/E2E (cron)** |

### Deferred / interim markers in this chunk
- **ADR-008** — tax stubbed at 0% (BR-010 `partial`, `dental_billing_tax_enabled=false`); `taxRate` server-controlled (EM-BILL-001).
- **GAP-001** — `localId` persisted for offline-first idempotent sync on invoice create (`createDentalInvoice.ts:93`) — **persisted but NOT deduped** (see E-NEW-02).
- **ADR-006** — domain events are audit-log-only markers (DE-007/008/009); no event bus.
- `dental_billing_uncollectible` flag is documentation-only (no runtime gate).

---

## (3) Per-family sequencing analysis + ordering-gap list

### Family 1 — Invoice → Payment → Void / Write-off

Ordered sequence (pre/postconditions):
```
[visit completed] → treatments performed/verified  (pre: BR-009 ≥1 billable)
  → [GATE BR-014: signed, non-revoked consent for visit]  (createDentalInvoice.ts:38)
  → [GATE S1-T7: no treatment already billed]              (:53)
  → invoice draft  (status=draft, balance=total)
  → PATCH issue → issued  (V-BIL-003 owner/associate)
  → POST payment  (pre: status ∈ issued|partial|overdue; ≤ balance; >0)
       partial if 0<paid<total ; paid if paid≥total (addPayment :158 atomic CASE)
  → [terminal] paid | voided(BR-011 owner, no active plan) | uncollectible(BR-013 owner, outstanding)
  overdue: cron markOverdueInvoices on issued|partial past due (repo :259)
```

**Ordering gaps:**
- **SEQ-E1 (covered):** payment before issue → `draft` payment is rejected 422 `INVALID_STATUS_TRANSITION`
  (`recordDentalPayment.ts:55`). Good. Pinned by `.invoice-lifecycle.test.ts`.
- **SEQ-E2 (covered):** invoice before consent → BR-014 `CONSENT_REQUIRED` ordering is correct — the
  consent gate fires **before** treatment fetch (`createDentalInvoice.ts:38` precedes :45). Pinned
  `billing-gate-http.test.ts`.
- **SEQ-E3 (covered):** double-bill — `TREATMENT_ALREADY_BILLED` guards re-invoicing the same
  performed treatment (:53-60).
- **SEQ-E4 (PARTIAL — doc drift, E-KNOWN-doc):** MODULE_SPEC §4 WF-014 step 4 says partial requires an
  *active payment plan*. The implementation transitions to `partial` on **any** under-full payment with
  **no plan requirement** (`addPayment` repo CASE :160; `acceptance.billing-payments.test.ts` AC-PAY-01
  asserts partial-without-plan as intended). The **code is the source of truth**; the spec prose is
  stale. P3 doc-only.
- **SEQ-E5 (covered):** concurrent payments — `addPayment`/`removePayment` compute new totals with
  atomic SQL arithmetic (`GREATEST(0, …)`), avoiding read-modify-write races (repo :150 comment).
- **SEQ-E6 (covered):** receipt-replay ordering — N-BIL-01 scopes idempotent replay to *this* invoice
  and rejects cross-invoice receipt reuse with 409 (`recordDentalPayment.ts:82-104`).

### Family 2 — Recall lifecycle (manual + cron interleave)

```
createRecall → pending  (intervalMonths optional)
  pending → sent     (manual updateRecall  OR  cron recallDispatch markDispatched)
  sent → completed | cancelled
  completed (terminal) → if intervalMonths>0: seed next-cycle pending  (updateRecall.ts:74)
  cron recallDispatch: pending(due) | sent(reattempt<max) → enqueue notif + flip sent
```

**Ordering gaps:**
- **SEQ-E7 (KNOWN — SCH-G9):** `listDueRecalls` `from` defaults to **today**, so OVERDUE recalls
  (dueDate < today) are silently dropped (`listDueRecalls.ts:43`). FE works around with a
  `2000-01-01` floor (`use-recall-due-list.ts:36`); a different consumer misses exactly the patients
  who most need outreach. Backend contract should default-include overdue or document the floor.
  KNOWN = `dental-scheduling-gap-plan.md` SCH-G9 (P3).
- **SEQ-E8 (NEW — E-NEW-01):** the **manual FSM and the cron both flip `pending→sent`** with no
  coordination. A staff "Mark Sent" (`updateRecall` :63 sets `sentAt`) races the cron's
  `markDispatched` (:104 sets `lastSentAt`+`sendAttempts`). The two write different columns; the manual
  path does **not** enqueue a notification and does **not** bump `sendAttempts`, so a manual flip can
  *consume* the `sent` state and suppress the cron's first real outreach (the cron only re-attempts
  `sent` rows after `recallReattemptDays`). Out-of-order: clinic marks sent manually → patient never
  actually receives the automated due notice. P2 (workflow-correctness; recare outreach silently
  skipped).
- **SEQ-E9 (NEW — E-NEW-03):** next-cycle seeding on completion is **not idempotent**. `updateRecall`
  re-creates a pending recall every time a recurring recall reaches `completed` (:77). `completed` is
  terminal in the FSM (one transition), so the *online* path is safe — but an **offline-sync replay**
  of the same `status:completed` PATCH (no `localId` on recalls — see E-NEW-04) would re-run the
  seeding branch and duplicate the next-cycle row. The handler comment acknowledges "a duplicate
  same-type/same-dueDate row is harmless" (:73) — true for display, but it inflates the due-list and
  triggers duplicate cron outreach. P3.

### Cross-family ordering invariant
`visit→consent→perform→complete→invoice→issue→pay` holds end-to-end and is gate-enforced at each
hop. The single cross-family interaction with recalls is **none** (D4 decision: next-cycle recall
triggers on recall-completed, *not* on visit-completed — `updateRecall.ts:74` comment "no cross-module
visit coupling"). This is an intentional decoupling, not a gap.

---

## (4) Gap & candidate register

Schema: `| id | finding | chunk | class | lenses{S,R,O,C} | KG-node | MODULE/WF | BR | spine-op/handler | severity | blast-radius |`

| id | finding | chunk | class | lenses | KG-node | MODULE/WF | BR | spine-op/handler | sev | blast |
|----|---------|-------|-------|--------|---------|-----------|----|-----------------|-----|-------|
| E-KNOWN-01 | No discount-apply UI; `applyDentalDiscount` owner-only/reason-required unwired | E | KNOWN | R,C | invoice | dental-billing/WF (BIL-G1) | BR-015 | applyDentalDiscount (FE:0) | P1 | money |
| E-KNOWN-02 | Insurance/HMO revenue cycle unreachable — no create-claim affordance | E | KNOWN | S,R,C | claim | dental-billing (BIL-G2) | EM-BIL-002 | createInsuranceClaim+4 (FE:0) | P1 | money |
| E-KNOWN-03 | No payment void/refund UI; `voidDentalPayment` owner-only unwired | E | KNOWN | R | payment | dental-billing (BIL-G3) | V-BIL-013 | voidDentalPayment (FE:0) | P2 | money |
| E-KNOWN-04 | No payment-plan create/update UI (only view wired) | E | KNOWN | C | payment_plan | dental-billing/WF-015 (BIL-G4) | BR-015 | createDentalPaymentPlan (FE:0) | P2 | money |
| E-KNOWN-05 | No printable receipt; `getDentalPaymentReceipt` unwired (V1-Required) | E | KNOWN | C | payment | dental-billing (BIL-G5) | EC5 | getDentalPaymentReceipt (FE:0) | P2 | cosmetic |
| E-KNOWN-06 | Duplicate balance source (client sum vs `getPatientBalance`) | E | KNOWN | C | invoice | dental-billing (BIL-G6) | BILL-BR-006 | getPatientBalance (FE:0) | P2 | money |
| E-KNOWN-07 | AR-aging seed has no aged receivables — buckets/overdue styling undemoable | E | KNOWN | C | invoice | dental-billing (BIL-G8) | — | getArAging | P3 | cosmetic |
| E-KNOWN-08 | `getCollectionsSummary` 0 consumers (CollectionsView derives from aging) | E | KNOWN | — | invoice | dental-billing (BIL-G7) | — | getCollectionsSummary (FE:0) | P3 | cosmetic |
| E-KNOWN-09 | Recall due-list `from` defaults today → overdue dropped; FE floors 2000-01-01 | E | KNOWN | S,C | recall | dental-scheduling (SCH-G9) | — | listDueRecalls | P3 | data-loss |
| E-KNOWN-10 | EM-BIL-002 cross-tenant report scope (omitted branchId) — **FIXED + pinned** | E | KNOWN | R | invoice/claim | dental-billing | EM-BIL-002 | getArAging+4 | — (resolved) | cross-tenant |
| E-NEW-01 | Manual `updateRecall status:sent` races cron `recallDispatch`; manual flip suppresses automated outreach (no notif, no sendAttempts bump) | E | NEW | S,O | recall | dental-patient (recall) | **BR-#### proposed** | updateRecall / recallDispatch.ts:104 | P2 | data-loss |
| E-NEW-02 | `voidDentalInvoice` audit (`invoice.voided`) is fire-and-forget — **NOT** `failClosed` unlike payment-void/discount/payment; an invoice void can commit without its audit row | E | NEW | R,C | audit | dental-billing/WF-041 | strengthens P1-C | voidDentalInvoice.ts:61 | P2 | money |
| E-NEW-03 | Next-cycle recall seeding not idempotent under offline-replay of `completed` PATCH | E | NEW | O,C | recall | dental-patient (recall) | **BR-#### proposed** | updateRecall.ts:74 | P3 | data-loss |
| E-NEW-04 | Recalls carry no `localId`/idempotency key (offline-first writes not dedupable) | E | NEW | O | recall | dental-patient (recall) | strengthens GAP-001 | createRecall (no localId) | P3 | data-loss |
| E-NEW-05 | `createDentalInvoice` persists `localId` but never dedupes on it — offline-replay/double-tap can create a duplicate invoice (partially mitigated by S1-T7 TREATMENT_ALREADY_BILLED, which fails the *second* commit only after the first treatments are billed) | E | NEW | O,S | invoice | dental-billing/WF-013 | strengthens GAP-001 | createDentalInvoice.ts:80-94 | P2 | money |
| E-NEW-06 | No partial-refund / payment-correction path: a wrong-*amount* payment can only be fully voided (`voidDentalPayment`) then re-recorded — no adjust-in-place; combined with no FE void (E-KNOWN-03) a mis-keyed amount is unfixable in-product | E | NEW | C | payment | dental-billing | **BR-#### proposed** | voidDentalPayment+recordDentalPayment | P3 | money |
| E-NEW-07 | Recall has no consent-state re-check on the *manual* sent flip — only the cron consent-gates (`recallDispatch.ts:72`). A staff manual "Mark Sent" implies outreach without checking PersonConsent; if it ever drives a send it bypasses the gate | E | NEW | R,C | recall | dental-patient (recall) | strengthens BR-014-class | updateRecall.ts:63 | P3 | PHI-leak |

### Lens notes (per the four lenses)
- **Security/RBAC/multi-tenant (R):** the EM-BIL-002 class (the plan's headline) is **resolved + pinned**
  across all 5 report endpoints (`.cross-tenant-reports.test.ts`). All billing **write** ops gate via
  `assertBranchRole` on the *invoice's stored branchId* (not a caller-supplied one) —
  `recordDentalPayment.ts:36`, `voidDentalInvoice.ts:35`. Recalls branch-scope via the patient's
  `preferredBranchId` (`createRecall.ts:29`) and `listDueRecalls` via `assertBranchAccess` on the query
  branchId (:35). **No new cross-tenant or branch-leak found** in this chunk. The recall table has **no
  `branch_id` column** (`recall.schema.ts`) — branch is derived through the patient join; this is
  consistent and safe (a recall cannot outlive/cross its patient's branch) but means recall queries are
  patient-FK-bound, not directly branch-indexable (perf note, not a leak).
- **Offline P2P sync (O):** recalls and dental invoices are **not** part of the chart/visit cadence
  merge surface, but both have offline-replay exposure (E-NEW-03/04/05). The invoice `localId`
  persistence is the clearest GAP-001 follow-through that stops half-done (persisted, not deduped).
- **Clinical-correctness (C):** money-integrity is strong (atomic arithmetic, FSM-guarded, server-side
  tax). The clinical recare cadence (intervalMonths → next-cycle) is sound and timezone-correct
  (`recall-dates.ts`). No standards violation found.
- **Sequencing (S):** the invoice/payment FSM ordering is fully gated; the one real ordering risk is
  the manual-vs-cron recall race (E-NEW-01).

---

## (5) TDD-ready slices (accepted NEW candidates, value-ordered)

> Conventions: backend tests run **from `services/api-ts/`** via
> `bun run scripts/test-with-db.ts <file>` with
> `DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test` (per-file, never
> `bun test <path>`). Contract via `scripts/run-contract-tests.ts` (restart API first). FE unit must
> not assert rendered-chart DOM (DentalChart globally stubbed) — n/a here, no chart. E2E self-seeds
> via `tests/e2e/helpers/e2e-seed.ts`. Gate per slice: api-ts `bunx tsc` + `bun run check:boundaries`
> + backend + contract + FE tsc/unit + E2E.

---

### SL-E01 — Fail-closed audit on invoice void (E-NEW-02)
**Value/risk:** highest — a money/compliance write that can silently lose its audit row; one-line fix
mirroring an already-shipped pattern. **depends:** none.

- **Slice type:** backend-only (skip FE steps 7–8; no UI change).
- **Steps:** TypeSpec n/a → no codegen → backend test (RED) → impl (GREEN) → contract (regression only) → verify.
- **RED tests first:**
  - backend `services/api-ts/src/handlers/dental-billing/audit-write-reliability.test.ts` — **add** a
    case: `spyOn` the audit insert to throw → `POST …/invoices/:id/void` returns **5xx** (mirrors the
    existing payment-void case at :140). RED before because `voidDentalInvoice.ts:61` has no
    `{ failClosed: true }`.
  - backend (same file) — `invoice.voided` audit row carries `{ reason }` + before/after status snapshot
    (AUD-BR-004 parity).
- **Impl:** add `{ failClosed: true }` to `logAuditEvent` in `voidDentalInvoice.ts:61`; populate
  before/after snapshot + reason at the repo choke point (reuse the P2-A sanitization path).
- **ACs/BRs:** strengthens MASTER-GAP-MATRIX **P1-C** (audit-write reliability) + **P2-A** (snapshots).
- **FSM/transition changes:** none.
- **Gate:** api-ts `bunx tsc` + backend (`audit-write-reliability.test.ts`, `.invoice-lifecycle.test.ts`
  no regression) + `check:boundaries`.

---

### SL-E02 — Idempotent invoice create on `localId` (E-NEW-05)
**Value/risk:** high — duplicate-invoice / double-charge under offline-replay or double-tap; the
GAP-001 follow-through. **depends:** none.

- **Slice type:** backend-only (FE already sends — verify hook passes `localId`; no new UI).
- **RED tests first:**
  - backend new file `services/api-ts/src/handlers/dental-billing/createDentalInvoice.idempotency.test.ts`
    — two identical `POST /dental/billing/invoices` with the same `localId` (and same visit) → **one**
    invoice row, second call returns the **same** invoice (200/201 idempotent), not a 2nd row and not a
    spurious `TREATMENT_ALREADY_BILLED`. RED before because `createOne` persists but never looks up
    `localId`.
  - contract `specs/api/tests/contract/dental-billing.hurl` — append: POST invoice with `localId` twice
    → second returns the same `id`.
- **Impl:** in `createDentalInvoice.ts` before create, `findByLocalId(branchId, localId)` (new repo
  method on `dental-invoice.repo.ts`); if found, short-circuit-return it (scoped by branch to avoid
  cross-tenant echo, mirroring N-BIL-01's invoice-scoping discipline). Add a partial unique index on
  `(branch_id, local_id) where local_id is not null` (migration via `db:generate`).
- **ACs/BRs:** strengthens **GAP-001**; proposes **BR-#### "an invoice create replay keyed on
  (branchId, localId) is idempotent — never a duplicate money record."**
- **FSM changes:** none. **Migration:** yes (partial unique index) — review SQL, runs on boot.
- **Gate:** api-ts `bunx tsc` + backend (per-file) + contract (restart API) + `check:boundaries`.

---

### SL-E03 — Reconcile manual recall `sent` flip with the cron (E-NEW-01)
**Value/risk:** medium — recare outreach silently skipped when staff manually marks sent.
**depends:** none.

- **Slice type:** backend-first; small FE follow (recalls-sheet copy/affordance) optional.
- **RED tests first:**
  - backend `services/api-ts/src/handlers/dental-patient/dental-patient-recall.test.ts` — **add**: a
    recall manually transitioned `pending→sent` via `updateRecall` is **still picked up** by
    `recallDispatch` for its first real outreach **OR** the manual flip is **disallowed** for
    recurring/consent-gated recalls (decision below). RED before because the manual path sets `sentAt`
    only and the cron skips `sent` rows until `recallReattemptDays`.
  - backend `recallDispatch.test.ts` — assert no double-send when both paths run.
- **Impl (decision — `[ASSUMPTION]` pending product):** preferred — make the **cron the single
  outreach authority**: `updateRecall` rejects a direct `→sent` (or treats it as "snooze" without
  marking dispatched), leaving the cron to consent-gate + enqueue + flip. Alternative: have the manual
  flip also enqueue via the same `enqueueScheduledIfAbsent` path.
- **ACs/BRs:** proposes **BR-#### "a recall reaches `sent` only via the consent-gated dispatch path;
  manual status edits cannot bypass the recare outreach gate."** Strengthens P1-24 + the BR-014 consent
  discipline (relates E-NEW-07).
- **FSM changes:** possibly narrow `RECALL_FSM.pending` to drop the manual `→sent` (and update the FE
  `RECALL_TRANSITIONS:31` mirror + `recalls-sheet.test.ts`). Add/extend the recall FSM property test if
  one is introduced.
- **Gate:** api-ts `bunx tsc` + backend (recall + dispatch per-file) + FE tsc/unit
  (`recalls-sheet.test.ts`) + `check:boundaries`.

---

### SL-E04 — Recall `localId` + idempotent next-cycle seeding (E-NEW-03, E-NEW-04)
**Value/risk:** low — offline-replay duplicate recall rows; cosmetic-leaning but pollutes due-list +
duplicate outreach. **depends:** SL-E03 (FSM/outreach decided first).

- **Slice type:** backend-only.
- **RED tests first:**
  - backend `dental-patient-recall.test.ts` — replaying a `status:completed` PATCH (same recall) seeds
    the next-cycle row **once**, not per replay. RED before because `updateRecall.ts:74` re-seeds every
    completion.
  - backend — `createRecall` with a repeated `localId` is idempotent (one row).
- **Impl:** add `local_id` to `recall.schema.ts` + a guard in the seeding branch keyed on
  `(patientId, type, dueDate)` (or a `seededFrom` FK) so a re-completion no-ops; dedup `createRecall`
  on `localId`.
- **ACs/BRs:** strengthens **GAP-001**; proposes **BR-#### "recall create + next-cycle seeding are
  idempotent under sync replay."**
- **FSM/migration:** add column (`db:generate`); no FSM change beyond SL-E03.
- **Gate:** api-ts `bunx tsc` + backend (per-file) + `check:boundaries`.

---

### SL-E05 — `listDueRecalls` includes overdue by default (E-KNOWN-09 / SCH-G9)
**Value/risk:** low (KNOWN, already FE-mitigated) — ratify the contract so a second consumer can't miss
overdue patients. **depends:** none.

- **Slice type:** backend + contract; FE removes the `2000-01-01` floor workaround.
- **RED tests first:**
  - contract `specs/api/tests/contract/dental-patient.hurl` — `GET /dental/recalls/due` with no `from`
    returns a recall whose `dueDate < today`. RED before because `listDueRecalls.ts:43` floors at today.
  - FE `use-recall-due-list.test.ts` — remove the `RECARE_DUE_FROM_FLOOR` workaround; assert overdue
    surfaces without it.
- **Impl:** default `from` to a far-past floor server-side (or `dueDate <= to` with no lower bound when
  `from` omitted); drop the FE floor.
- **ACs/BRs:** closes **SCH-G9** (P3). Decision `[ASSUMPTION]`: change backend default vs ratify the FE
  floor as the contract (per `dental-scheduling-gap-plan.md §6.5`).
- **Gate:** api-ts `bunx tsc` + contract (restart API) + FE tsc/unit.

> **KNOWN gaps NOT sliced here** (already catalogued in the gap-plans as FE-wiring work, several
> product-decision-gated): BIL-G1 discount UI, BIL-G2 claims-create surface, BIL-G3 payment-void UI,
> BIL-G4 payment-plan UI, BIL-G5 receipt, BIL-G6 balance consolidation, BIL-G7/G8 seed/collections.
> These are additive FE wiring onto existing RBAC-gated/audited/tested backends — owned by
> `dental-billing-gap-plan.md §3` fix-order, not re-derived here.

---

## Open questions / `[ASSUMPTION]` list
1. **SL-E03 outreach authority** — should manual `→sent` be **disallowed** (cron is the only sender) or
   should the manual path also enqueue the consent-gated notification? (Product decision; affects the
   recall FSM + recalls-sheet affordance.)
2. **SL-E05 recall-default** — change the backend `listDueRecalls` `from` default to include overdue, or
   ratify the FE `2000-01-01` floor as the contract? (Mirrors `dental-scheduling-gap-plan.md §6.5`.)
3. **SEQ-E4 doc drift** — confirm partial-payment-without-a-plan is intended (code + AC-PAY-01 say yes);
   if so, fix MODULE_SPEC §4 WF-014 prose (P3 doc-only).
4. **E-NEW-06 / E-NEW-07** — are partial-refund / payment-amount-correction and a manual-recall consent
   re-check in V1 scope, or deferred? (Both are P3; folded into the cron-authority decision for recalls.)
5. **BIL-G2 phase intent** `[NEEDS CONFIRMATION per dental-billing-gap-plan §8]` — is the insurance/HMO
   claims FE a planned later phase (then "scheduled") or an oversight (then a real P1 gap)?
