# AHA Fix-Ready Plan: Dental Billing

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dental Billing |
| Module slug | dental-billing |
| Source gap plan | `docs/aha/module-gap-plans/dental-billing-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (§19 Gap Organizer Rules); no Superpowers invocation was needed to sequence these batches |
| Organizer decision | READY |
| Reason | All P1 gaps (GAP-1/2/3) and the V1-REQUIRED P2s (GAP-4) are decision-free, have complete tested backends (FE work = wiring), and have exact evidence (contract-spine 0-consumer + source line citations). The only blockers (claims GAP-7, attribution GAP-6, overpayment doc conflict, receipt email, auto-discounts) are cleanly separable into a decision queue and do not gate any active batch. |
| Limitations | (1) Organizer verified scheduler (`core/jobs.ts` registerCron/registerInterval, app.ts registration block at ~`app.ts:286-292`) and billing FE component layout in source, but did not run tests. (2) Plan-"Behind" sweep (FIX-002) semantics carry `[NEEDS CONFIRMATION]` from the gap plan — a small repo method may need creating; 04 may defer it without affecting FIX-001. (3) Cross-module bundle ownership (claims decision, shared print utility, scheduler-cron siblings) was pre-decided by the orchestrator and is encoded here, not re-derived. |

**Corrections/clarifications vs raw gap plan (do not edit the gap plan):**

- The gap plan's GAP-1 body text ("no job scheduler exists in api-ts") is superseded by its own 2026-06-11 erratum and re-verified by this organizer: a platform scheduler exists at `services/api-ts/src/core/jobs.ts` (pg-boss-backed `registerCron`/`registerInterval`), with module registrations in `services/api-ts/src/app.ts` (email, notifs, audit, booking, retention, dental-scheduling, dental-patient). GAP-1 therefore shrinks to **registering a `dental-billing` cron on the existing scheduler** — the gap plan's §22 "boot-interval runner" idea and §25 Q5 (scheduler mechanism) are both **resolved**: use `core/jobs.ts`; build nothing new. `[DO NOT OVERBUILD]`
- Established registration pattern confirmed in source: `handlers/<module>/jobs/index.ts` exporting `register<Module>Jobs(scheduler)` (see `handlers/dental-patient/jobs/index.ts`, `handlers/retention/jobs/`), with job tests beside them (`handlers/retention/jobs/jobs.test.ts`, `handlers/audit/jobs/jobs.test.ts`). FIX-001 follows this pattern exactly.

## 2. Fix Strategy Summary

- **Fix first:** Batch A (GAP-1 overdue cron) — it is the only P1 with a *silently lying UI today* (billing-list "overdue" filter + FR4.8 badges can never populate), it is backend-isolated, and it is the smallest TDD slice.
- **Then:** Batch B (discount + payment-void affordances in `invoice-detail.tsx` — same component, same owner-gated-action pattern), Batch C (payment-plan create — the headline PH installment feature), Batch D (cheap pins + seed, anytime/parallel), Batch E (shared print/PDF utility + receipt — platform batch, separate 04 pass).
- **Do not fix:** anything claims-related (GAP-7 — owned product decision, see §8), `recordedByMemberId` derivation (GAP-6 — decision pending), receipt email, auto PWD/Senior discounts, tax engine, billing notifications, any new scheduler/job framework.
- **Major risks:** (1) Batch E touches a shared FE utility that dental-patient (statement) and case-presentation (estimate) will consume — isolate it as its own pass and land it before those modules' print work; (2) FIX-006 flag-sync pin crosses into dental-patient's archive guard (`patient.repo.ts:140-145`) — test-only, but coordinate; (3) plan-"Behind" sweep (FIX-002) may need a small new repo method — keep it severable from FIX-001.
- **One pass or multiple:** multiple. A→B→C are sequential module passes; D can run anytime; E is a separate shared/platform pass.
- **Shared/platform/database work:** yes, two well-bounded items — one registration line in `app.ts` (Batch A, trivial) and the shared print utility (Batch E, isolated by design). **No database/schema changes anywhere** (the `overdue` enum value and all backing tables already exist).
- **Product decisions / environment blockers:** 5 decision items queued in §8 (one of them — claims — is a cross-module decision this module owns). No environment blockers.
- **Backend changes are ~zero outside Batch A** — every FE affordance wires to an already-implemented, already-tested, already-SDK-generated endpoint (contract-spine confirms the 0-consumer orphans).

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: overdue lifecycle dead — `markOverdueInvoices` has 0 callers; no `dental-billing` job registered on the platform scheduler | P1 | V1 REQUIRED | A | "Overdue" filter/badges/J44 follow-ups silently never fire; staff trust a dead surface | `repos/dental-invoice.repo.ts:271-277` (0 callers, repo-wide grep); scheduler exists `core/jobs.ts` + `app.ts:286-292` registrations; gap plan §5/§10/§11 + erratum |
| FIX-002 | GAP-1 (shared cause): payment-plan "Behind" auto-status (7+ days past due) never flips | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | A (severable) | Same cron, same root cause; plan status enum already has Behind; FR4.3 | Gap plan §4 row FR4.3 "Behind" / §8; no sweep logic found in handlers or repos |
| FIX-003 | GAP-2: no discount UI — owner cannot apply PWD/Senior/manual discount from product | P1 | V1 REQUIRED | B | PH statutory compliance (PWD/Senior) impossible in-product; backend owner-only+reason complete | `applyDentalDiscount` 0 FE consumers (contract-spine + grep); `applyDentalDiscount.ts` tested + hurl |
| FIX-004 | GAP-5: no payment-void UI — mis-keyed payment uncorrectable from product | P2 | V1 RECOMMENDED | B | Same component (`invoice-detail.tsx` payments area), same owner-gated pattern as FIX-003; money-correction path | `voidDentalPayment` 0 FE consumers; `voidDentalPayment.ts:32-73` reversal-preserving, tested |
| FIX-005 | GAP-3: no payment-plan create/update UI — headline PH installment feature unreachable (view-only `payment-plan-view.tsx`) | P1 | V1 REQUIRED | C | ₱60k-braces installment plan is the PRD's flagship FR4.3 use case; backend FSM fully tested | `createDentalPaymentPlan`/`updateDentalPaymentPlan` 0 FE consumers; `dental-billing.payment-plan-fsm.test.ts` + property tests |
| FIX-006 | `patients.hasActivePaymentPlan` flag-sync unverified across plan create/complete/default (EC1 archive guard depends on it) | P2 | V1 RECOMMENDED `[CROSS-MODULE RISK]` `[TEST GAP]` | C | Plan-create UI (FIX-005) makes this path reachable by real users for the first time; one integration pin protects the archive guard | `patient.repo.ts:140-145` guard; gap plan §21 row 2 |
| FIX-007 | GAP-4: no receipt render/print — cash-practice trust artifact missing (incl. EC5 VOIDED watermark on reprint) | P2 | V1 REQUIRED | E | BIR/official-receipt expectation in PH cash practice; backend `getDentalPaymentReceipt` ready; **canonical first consumer of the shared print utility** | `getDentalPaymentReceipt` 0 FE consumers; gap plan §5 GAP-4, §4 EC5 row |
| FIX-008 | Shared print/PDF utility (platform) — printable-view + print-stylesheet primitive consumed first by the billing receipt | P2 | V1 REQUIRED `[SHARED DEPENDENCY]` | E | Pre-decided cross-module bundle: dental-patient statement and case-presentation estimate will consume the same utility; building it once here prevents 3 divergent print implementations | Orchestrator bundle decision; gap plan §22 "print stylesheet per §10.2" |
| FIX-009 | GAP-10: zero-branch-membership caller unpinned on the 5 report endpoints (EM-BIL-002 residual) | P3 | V1 RECOMMENDED `[TEST GAP]` | D | Cheap permission pin protecting a previously-exploited class (cross-tenant reports) | `dental-billing.cross-tenant-reports.test.ts` seeds only single-branch caller; gap plan §5 GAP-10 |
| FIX-010 | GAP-11: balance dual-source drift — FE sums per-invoice `balanceCents`, `getPatientBalance` endpoint orphan | P3 | V1 RECOMMENDED | D | One equality pin (Σ client-visible balances == endpoint) closes the drift class without FE rework | `use-patient-billing.ts:19-31`; endpoint 0 consumers |
| FIX-011 | GAP-9: seed has no aged receivables — AR-aging report demos empty | P3 | V1 RECOMMENDED | D | Demo/trust value; also gives FIX-001's E2E something real to age | Gap plan §5 GAP-9 (prior BIL-G8, unchanged) |
| FIX-012 | GAP-8: `getCollectionsSummary` orphan (dashboard derives from invoice list) | P3 | V1 RECOMMENDED | D | Minimal action only: **document backend-only** (note in module spec / contract-spine annotation). Do not build a new KPI surface for this. `[DO NOT OVERBUILD]` | contract-spine 0 consumers; `use-dashboard-summary.ts` alt path works |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| **Batch A** — overdue/plan cron (backend) | Register `dental-billing` cron job(s) on the existing `core/jobs.ts` scheduler; make the `overdue` FSM transition reachable in production | FIX-001, FIX-002 (severable) | Low — repo method exists+tested; one new `jobs/` dir + one `app.ts` line; pattern proven by 7 existing module registrations | **Run first in current `04` pass.** FIX-002 may be deferred mid-batch if it needs more than a small repo method |
| **Batch B** — invoice-detail money affordances (FE) | Wire discount-apply and payment-void actions into `invoice-detail.tsx` (owner-gated, reason-required) | FIX-003, FIX-004 | Low — wiring to tested backends; existing component has 5 test files to extend | Run in current `04` pass, after Batch A |
| **Batch C** — payment-plan create (FE + 1 cross-module pin) | "Create payment plan" affordance (2–24 installments, frequency, start date) on eligible invoices; flag-sync integration pin | FIX-005, FIX-006 | Low-Medium — new dialog/component; FIX-006 test touches dental-patient archive-guard behavior (test-only) | Run in current or next `04` pass, after Batch B |
| **Batch D** — pins + seed hardening | Zero-membership report pin ×5, balance equality pin, aged-receivable seed, collections-summary documentation | FIX-009, FIX-010, FIX-011, FIX-012 | Very low — tests/seed/docs only, no product code | Anytime; can run parallel to A–C or be appended to any pass |
| **Batch E** — shared print/PDF utility + receipt `[SHARED DEPENDENCY]` | Build the platform print utility (printable view + print stylesheet) with the billing payment receipt (incl. VOIDED watermark) as its canonical first consumer | FIX-007, FIX-008 | Medium — shared FE primitive with declared future consumers (dental-patient statement, case-presentation estimate); blast radius beyond this module | **Split into a separate `04` pass**, clearly labeled shared/platform. Land **before** dental-patient or case-presentation start their print/PDF work (their fix plans depend on this batch) |

Batch ordering: A → B → C → E, with D anytime. E is sequenced after the module-local batches only because A–C carry the P1s; E must still precede the *other modules'* print consumers.

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | RED caller test: issued invoice with past `dueDate` → run job handler → status `overdue`; paid/draft/voided/uncollectible untouched; second run is a no-op (idempotent) | backend/unit + integration | The transition fires from the registered job, not just that the repo method works in isolation; also assert the job is registered under a `dental-billing.*` name | New `services/api-ts/src/handlers/dental-billing/jobs/jobs.test.ts` (pattern: `handlers/retention/jobs/jobs.test.ts`, `handlers/audit/jobs/jobs.test.ts`) |
| FIX-001 (during) | Overdue filter populates after job run | E2E/Playwright | End-user trust proof: billing-list "overdue" filter shows the aged invoice | Extend `apps/dentalemon/tests/e2e/billing.spec.ts` (or seed-driven assertion w/ FIX-011) |
| FIX-002 | Plan with installment 7+ days past due → sweep → status `Behind`; current plan untouched | backend/unit | Behind automation per FR4.3; severable from FIX-001 | Same new `jobs.test.ts` file |
| FIX-003 | Owner sees "Apply discount" on pre-issue/eligible states; non-owner does NOT see it; reason required (submit blocked without it); totals update after mutation | frontend/component | Affordance exists, is role-gated, reason-enforced, and the rendered totals agree with the server response (coherence oracle) | New `apps/dentalemon/src/features/billing/components/invoice-detail.discount.test.tsx` (siblings: `invoice-detail.void.test.ts`, `invoice-detail.mutations.test.ts`) |
| FIX-003 (during) | 10% discount applied end-to-end, invoice totals reflect it | E2E/Playwright | Core money journey via real API | Extend `billing.spec.ts` |
| FIX-004 | Owner-only void action on payments sub-table; reason required; voided payment stays visible as reversal row; balance restored | frontend/component | Correction path works and history is preserved (no row disappears) | New `invoice-detail.payment-void.test.tsx` next to existing invoice-detail tests |
| FIX-005 | Create-plan dialog: 2–24 bounds surfaced as validation (1 and 25 rejected), frequency + start date required; installments render in `payment-plan-view` after create; backend FSM 4xx surfaced legibly | frontend/component | The headline feature is reachable and bound-checked at the UI; SdkError envelope rendered (per known FE error-parsing pitfall) | New `apps/dentalemon/src/features/billing/components/payment-plan-create.test.tsx`; extend `payment-plan-view.test.ts` |
| FIX-005 (during) | Create 6×monthly plan on an issued invoice → plan visible | E2E/Playwright | PH flagship journey | Extend `billing.spec.ts` or `journeys/04-revenue-chain.journey.spec.ts` |
| FIX-006 | Plan create sets `patients.hasActivePaymentPlan` true → archive blocked (EC1); plan completed/defaulted/cancelled → flag cleared → archive allowed | integration (cross-module) | The archive guard's data dependency is actually maintained by billing's plan lifecycle | Extend `services/api-ts/src/handlers/dental-billing/` integration tests or `dental-patient.test.ts` archive-guard block (whichever already seeds both modules) |
| FIX-007 | Receipt renders payment, invoice, patient, branch/clinic fields from `getDentalPaymentReceipt`; voided payment reprint shows VOIDED watermark; print view applies print stylesheet | frontend/component | The artifact is complete and honest (EC5) | New `apps/dentalemon/src/features/billing/components/payment-receipt.test.tsx` |
| FIX-008 | Print utility: given a printable payload, renders a print-ready document; print stylesheet/page rules applied; consumer contract (props) pinned | frontend/component (shared) | The shared primitive's contract is pinned BEFORE other modules consume it — regression surface for dental-patient/case-presentation | New test beside the utility (location chosen in 04, e.g. `apps/dentalemon/src/components/print/__tests__/` or `src/lib/print/`) |
| FIX-009 | Caller with zero branch memberships → all 5 report endpoints return empty result (not 500, not whole-DB) | backend/permission | EM-BIL-002 residual edge pinned | Extend `services/api-ts/src/handlers/dental-billing/dental-billing.cross-tenant-reports.test.ts` |
| FIX-010 | Σ per-invoice `balanceCents` (the FE's source) == `getPatientBalance` response for a patient with mixed paid/partial/issued invoices | integration | Dual-source drift class closed without FE rework | Extend `services/api-ts/src/handlers/dental-billing/dental-billing.test.ts` |
| FIX-011 | Seed coherence: after reseed, AR-aging buckets (30/60/90) each non-empty | data/seed assertion | Demo honesty; gives overdue/aging surfaces real data | Seed script + seed-coherence assertion (pattern per `docs/product/SEED_MANIFEST.md` conventions) |
| FIX-012 | n/a — documentation only (module spec note + contract-spine annotation that `getCollectionsSummary` is backend-only by choice) | — | — | `docs/product/modules/dental-billing/` note |

All FE affordance tests (FIX-003/004/005/007) must be written RED first: assert the action exists and is role-gated **before** building it. Backend in Batches B/C/E is untouched — if 04 finds itself editing handlers there, scope has drifted.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | NEW `services/api-ts/src/handlers/dental-billing/jobs/index.ts` (+ `overdueSweep.ts`); `services/api-ts/src/app.ts` (one `registerDentalBillingJobs(jobs)` line in the existing registration block ~:286-292); calls existing `repos/dental-invoice.repo.ts:271-277` | module-local (one-line shared/platform touch in `app.ts`) | Tiny — additive registration; scheduler already runs 7 module job sets |
| FIX-002 | Same `jobs/` dir; possibly a small new repo method in `repos/dental-payment-plan` (sweep query) | module-local | Small; severable |
| FIX-003 | `apps/dentalemon/src/features/billing/components/invoice-detail.tsx` + `invoice-detail.helpers.ts`; billing hooks dir (mutation hook via existing SDK op) | module-local | Component has 5 existing test files — extend, don't fork |
| FIX-004 | Same `invoice-detail.tsx` payments sub-table + hooks | module-local | Same component as FIX-003 (why they share a batch) |
| FIX-005 | NEW `apps/dentalemon/src/features/billing/components/payment-plan-create.tsx` (dialog); `payment-plan-view.tsx`; `invoice-detail.tsx` entry point; billing hooks | module-local | New component; entry point on eligible invoice states only (per plan FSM) |
| FIX-006 | Test files only (api-ts integration) | cross-module (test-only) | Zero product code; asserts existing behavior across dental-billing ↔ dental-patient |
| FIX-007 | NEW `apps/dentalemon/src/features/billing/components/payment-receipt.tsx`; payments sub-table receipt action in `invoice-detail.tsx`; consumes FIX-008 utility + existing `getDentalPaymentReceipt` SDK op | module-local (consumer of shared) | Billing-only UI, but pins the shared utility's contract |
| FIX-008 | NEW shared FE utility — candidate `apps/dentalemon/src/components/print/` or `src/lib/print/` (04 decides per `docs/product/SHARED_COMPONENTS.md` conventions) + print stylesheet | **shared/platform** | **Three declared consumers**: billing receipt (now), dental-patient statement (later), case-presentation estimate (later). Contract changes after Batch E lands will ripple to those modules — pin with tests |
| FIX-009 | `dental-billing.cross-tenant-reports.test.ts` only | module-local (test-only) | None |
| FIX-010 | `dental-billing.test.ts` only | module-local (test-only) | None |
| FIX-011 | api-ts seed scripts (seed-demo / seed-supplement) | shared (seed data) | Demo data only; keep deterministic-UUID gotchas in mind (known `detUuid` collision pitfall) |
| FIX-012 | `docs/product/modules/dental-billing/` | docs only | None |

No database/schema files are touched by any active fix. No TypeSpec changes are needed for any active fix (all endpoints already exist in the spec and SDK).

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001/002 | shared/platform | Existing job scheduler `services/api-ts/src/core/jobs.ts` (`registerCron`) | **Resolved — scheduler already exists; register on it.** Do NOT create any new scheduler/queue infrastructure `[DO NOT OVERBUILD]`. Sibling: dental-visit plans a visit-**lock cron** on the same scheduler (see `docs/aha/module-fix-plans/dental-visit-fix-ready-plan.md` when produced) — both plans are registrations only; neither creates infrastructure. Keep job names namespaced (`dental-billing.*` vs `dental-visit.*`) to avoid collision | No (dependency already satisfied) |
| FIX-006 | cross-module | `patients.hasActivePaymentPlan` consumed by archive guard `handlers/dental-patient/.../patient.repo.ts:140-145` | EC1 archive-block correctness depends on billing maintaining the flag through the plan lifecycle | No — test-only pin; coordinate if it goes RED (a RED here is a real cross-module bug, fix in the same batch) |
| FIX-007/008 | shared/platform (this module **owns** it) | Shared print/PDF utility — billing is the canonical first consumer | dental-patient (statement) and case-presentation (estimate) fix plans must consume this utility instead of building their own; Batch E must land before their print work starts | Batch E is itself the prerequisite for *other* modules; nothing blocks it here |
| FIX-011 | shared (seed) | Root seed scripts shared across modules | Aged invoices may interact with other modules' seed expectations (e.g., dashboard KPIs) | No; keep additive |
| (blocked) GAP-7 | product decision + cross-module | Claims vertical decision — **owned by this module**, also governs dental-patient GAP-3 | One decision, two modules; see §8 item 1 | Yes — nothing claims-related may enter any active batch until decided |
| (blocked) GAP-6 | product decision + cross-module | `recordedByMemberId` server-derivation would change the TypeSpec contract (optional→derived) and FE org-context usage (`invoice-detail.tsx:70`) | Touches spec + SDK + FE; must not be slipped into Batch B opportunistically | Yes — decision Q2 first |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| **CLAIMS VERTICAL (cross-module, owned here):** park the half-shipped claims FE behind an honest Phase-2 label, or finish create/lines/detail now? (billing GAP-7 — **the same single decision also governs dental-patient GAP-3**; PRD §2.5 declares claims Phase-2; backend 100% built+tested; 4 ops 0 consumers; `claims-worklist.tsx` live without a create path) | `[NEEDS PRODUCT DECISION]` | None active (deliberately) — would spawn new fixes in BOTH this plan and `docs/aha/module-fix-plans/dental-patient-fix-ready-plan.md` | Misleading worklist surface + carrying cost vs. early Phase-2 head start; insurance/claims source-of-truth spans dental-billing and dental-patient — deciding twice risks two divergent claim subsystems | Escalate to the cross-module decision queue as ONE item. If "park": minimal honest-labeling fix lands here. If "finish": joint batch planned across both modules' next 03/04 cycle. **No claims implementation in any active batch of either plan until decided** |
| Ratify server-derivation of `recordedByMemberId` (GAP-6, pending since 2026-06-08): derive from session membership vs validate body value ∈ caller's memberships | `[NEEDS PRODUCT DECISION]` | Blocked item (would become a new FIX in a later batch) | Fix shape differs (TypeSpec change + FE change vs server-side validation only); payment-attribution integrity | Decide derive-vs-validate; then plan as its own small backend batch with forged-memberId RED test |
| Overpayment: PRD FR4.2 says credit balance; implementation + BR tests pin 422 `PAYMENT_EXCEEDS_BALANCE` | `[NEEDS PRODUCT DECISION]` | None (doc-only outcome likely) | PRD↔BR conflict; current reject is safer; PRD likely stale | Product confirms 422-reject is canonical → fix the PRD text; do NOT change code on the strength of the stale PRD line |
| Automatic PWD/Senior discount detection for PH launch, or manual discount (FIX-003) sufficient for V1? | `[NEEDS PRODUCT DECISION]` | FIX-003 scope boundary | Auto-detection needs the unbuilt locale regulatory layer (FR11.2) | Proceed with manual discount now (decision-free); auto engine stays V2 DEFERRED unless product pulls it in |
| Receipt email delivery in V1 or print-only first? | `[NEEDS PRODUCT DECISION]` | FIX-007 scope boundary | Email path adds template + notifs wiring | Batch E ships **print-only**; email is a follow-on if ratified |
| Plan-"Behind" sweep exact semantics (7+ days past due definition; which statuses sweep from) | `[NEEDS CONFIRMATION]` | FIX-002 | Gap plan marked Behind automation "Unclear"; FR4.3 gives the 7-day rule but repo support unverified | 04 confirms in MODULE_SPEC §8 FSM before writing the RED test; defer FIX-002 if it balloons |
| Offline payment replay uses `receiptNumber` deterministically (payment idempotency without localId) | `[NEEDS CONFIRMATION]` | None active | Affects future offline payments only | Park for the offline-sync group audit (prompt 05); no billing action now |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Claims FE completion OR honest Phase-2 relabel/hide of `claims-worklist.tsx` (GAP-7) + dead `estimateClaimCoverage` mutation cleanup | `[NEEDS PRODUCT DECISION]` | Park-vs-finish is one cross-module product decision (owned here, governs dental-patient GAP-3) | §8 item 1 decided |
| `recordedByMemberId` server-derivation/validation (GAP-6) | `[NEEDS PRODUCT DECISION]` | Derive-vs-validate shape undecided; touches TypeSpec + SDK + FE org-context | §8 item 2 ratified |
| PRD FR4.2 overpayment-credit text reconciliation | `[NEEDS PRODUCT DECISION]` | Doc fix direction depends on canonical-behavior call | §8 item 3 decided (then a docs-only change) |
| Receipt email delivery | `[NEEDS PRODUCT DECISION]` | V1 print-only vs email undecided; needs notifs/email wiring | §8 item 5 decided; Batch E (print) landed |
| Device-prefix offline receipt numbering (GAP-13 / FR4.11/EC11) | `[NEEDS CONFIRMATION]` → likely V2 | No offline payment recording exists yet | Offline-sync group audit confirms the scheme is needed |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Automatic PWD/Senior discount engine + locale regulatory layer (FR11.2) | Gap plan §5 (FR4.7/EC3) / §23 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Manual discount (FIX-003) satisfies the compliance need now; auto-detection requires the unbuilt regulatory layer |
| Claims create/lines/detail FE completion | GAP-7 / §23 | V2 DEFERRED (unless §8 decision says finish) | PRD §2.5 places claims in Phase 2 |
| Per-country tax calculation | §23 | V2 DEFERRED | BR-010/ADR-008 explicitly stub tax at 0% behind a flag |
| Invoice-issued / overdue patient notifications (email/push) | §8 "issue→notify" + §23 | V2 DEFERRED | PRD Phase-2 addendum lists billing notifications |
| Payment-plan interest, automated plan reminders, multi-visit statements, aging-bucket expansion | §23 | V2 DEFERRED | PRD §6.4 addendum Phase-2 list |
| Device-prefix offline receipt numbering | GAP-13 | V2 DEFERRED `[NEEDS CONFIRMATION]` | No offline payment recording exists yet |
| Wiring `getCollectionsSummary` into a new dashboard KPI strip | GAP-8 | `[DO NOT OVERBUILD]` | Dashboard already computes collections from the invoice list; FIX-012 documents backend-only instead |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Any new job scheduler, queue framework, or interval-runner abstraction | GAP-1 / §23 / erratum | `[DO NOT OVERBUILD]` — `core/jobs.ts` (pg-boss) already exists and runs 7 module job sets; FIX-001 is a registration, nothing more. (This supersedes the gap plan's pre-erratum "boot-time interval runner" suggestion.) |
| Claims feature expansion (new claims endpoints, payer integrations, coverage-estimate UI) | GAP-7 / §6 | Phase-2 per PRD §2.5; existing backend is already the early Phase-2 implementation — do not grow it before the §8 decision |
| Tax calculation engine | §23 | BR-010 stubs tax at 0% deliberately |
| Stripe Connect path for dental billing flows | §23 | Base `billing` module superseded by dental-billing for dental flows (MODULE_MAP) |
| Per-module bespoke print/PDF implementations (in dental-patient or case-presentation) | Bundle decision | The shared utility (FIX-008) is the single print primitive; duplicating it is the exact failure Batch E exists to prevent |
| Re-litigation of verified-GREEN areas: EM-BIL-002 scoping, fail-closed audit, FSMs, RBAC matrix, idempotency | §26 "do not re-litigate" | All verified with source+test evidence in the 2026-06-11 audit round |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | The missing piece IS the registration — repo logic exists and is tested; wiring the cron removes the dead-lifecycle class entirely |
| FIX-002 | Root cause (semantics `[NEEDS CONFIRMATION]`) | Same absent-registration cause; sweep logic itself may not exist yet |
| FIX-003/004/005/007 | Root cause | Gap class = "complete tested backend, UI never built" (contract-spine-proven). Building the affordance is the root fix, not a patch |
| FIX-006 | Test gap (pin) | Asserts an existing cross-module invariant; a RED result would reveal a real root-cause bug to fix in-batch |
| FIX-008 | Root cause (preventive) | Single shared primitive prevents the three-divergent-print-implementations failure mode before it occurs |
| FIX-009/010 | Test gap (pin) | Regression pins on previously-exploited (EM-BIL-002) and drift-prone (dual balance source) classes |
| FIX-011 | Symptom-adjacent (data) | Empty demo is a seed-data gap, not a code bug; fix is seed-side only |
| FIX-012 | Documentation | Orphan endpoint is a deliberate-alternative-path situation; documenting beats wiring |

## 13. Recommended First Fix Batch

- **Batch name:** Batch A — overdue/plan cron (backend)
- **Included Fix IDs:** FIX-001 (overdue sweep cron), FIX-002 (plan-"Behind" sweep — severable; defer if semantics or repo support balloon)
- **Why this batch comes first:** It is the only P1 where the product actively lies today (an "overdue" filter and badges that can never populate); it is fully backend-isolated with zero FE work, the smallest TDD slice, follows a 7×-proven registration pattern, and its landing makes Batch B/C/E E2E assertions (overdue badges, aged receipts) honest. No decisions, no schema changes, no new infrastructure.
- **Tests to write first (RED):**
  1. `services/api-ts/src/handlers/dental-billing/jobs/jobs.test.ts` — issued invoice with past dueDate → job handler run → status `overdue`; paid/draft/voided/uncollectible invoices untouched; second run idempotent.
  2. (FIX-002, if confirmed) same file — installment 7+ days past due → plan status `Behind`.
  3. (during, not first) E2E: billing-list "overdue" filter shows the aged invoice.
- **Explicit out-of-scope items:** any new scheduler/queue infrastructure (use `core/jobs.ts` `registerCron` only); plan reminders/notifications; overdue patient notifications; anything claims-related; GAP-6 attribution change; FE changes of any kind; dental-visit's sibling lock cron (separate module's plan — only the namespacing convention is shared).

## 14. Instructions for 04 Fix Prompt

- **Module/group name:** Dental Billing
- **Module slug:** `dental-billing`
- **Fix-ready plan path:** `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md`
- **Batch to execute first:** Batch A (FIX-001, FIX-002-severable)
- **Tests to prioritize:** RED job-caller test in new `services/api-ts/src/handlers/dental-billing/jobs/jobs.test.ts` (pattern: `handlers/retention/jobs/jobs.test.ts`); only after GREEN, the E2E overdue-filter assertion. Run backend tests via the established `scripts/test-with-db.ts` flow (never `bun test <path>` directly; never point the live server at `monobase_test`).
- **Files likely to touch (Batch A):** NEW `services/api-ts/src/handlers/dental-billing/jobs/index.ts` (+ sweep handler file); `services/api-ts/src/app.ts` one registration line in the existing block (~:286-292); existing `repos/dental-invoice.repo.ts:271-277` is called, not modified.
- **Shared/database cautions:** `app.ts` is shared — additive one-line change only. **No schema/migration changes** (the `overdue` enum and plan-status enum already exist). Namespace job names `dental-billing.*`; dental-visit will register its own `dental-visit.*` lock cron on the same scheduler (cross-ref its fix plan) — neither module creates scheduler infrastructure. Batch E (print utility) is a separate clearly-labeled shared/platform pass: pin the utility's contract with tests because dental-patient (statement) and case-presentation (estimate) fix plans depend on it landing first.
- **Items NOT to implement:** anything in §9 (blocked), §10 (deferred), §11 (do-not-build) — especially: no claims work of any kind (cross-module decision owned here, pending), no `recordedByMemberId` change, no receipt email, no auto PWD/Senior engine, no tax engine, no new job framework, no Stripe path, no unrelated refactors in `invoice-detail.tsx` while wiring Batch B.
- **After Batch A:** stop, save `docs/aha/module-fix-plans/dental-billing-fix-report.md`, and await instruction before Batch B.

---

Next recommended step:
Module/group: Dental Billing
Module slug: dental-billing
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md
Recommended batch: Batch A — overdue/plan cron (FIX-001, FIX-002-severable)
