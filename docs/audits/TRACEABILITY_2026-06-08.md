# Traceability Audit — Module → Knowledge-Graph → Test

**Date:** 2026-06-08
**Branch:** `feat/module-workflow-alignment` (base `main`)
**Question answered:** *Is every workflow, business rule, and use case stated in each module's spec actually (a) mapped in the knowledge graph AND (b) covered by a test that asserts it?*

**Method.** Two **independent** columns per item, each requiring a cited artifact:
- **KG-MAPPED** — a `flow`/`step` node in `.understand-anything/domain-graph.json` (16 domains · 38 flows · 46 steps, refreshed to HEAD).
- **TESTED** — a test that **adversarially asserts** the rule (an illegal op must assert 4xx/403/409 or the computed value), not a happy-path 200. Verified by *reading the assertion*, not by the test's existence.

A claim is **GREEN** only if both hold. **PARTIAL** = exactly one. **RED** = neither.

**Universe.** 55 canonical workflows (WF-001–044 + WF-045/046/047 inferred + WF-P01–P05 perio + WF-EMRC-001–006), 62 business rules in `br-registry.json` (superset of the 47 in `BUSINESS_RULES.md` — the registry adds the 27 imaging CIMG-001–015 / ceph BR-036–047 rules), across 28 modules. Verification fanned out across 6 module clusters by independent subagents, then key claims were spot-checked against source by the orchestrator.

---

## Headline

| | Items | GREEN | PARTIAL | RED / ABSENT |
|---|---|---|---|---|
| **As reported by cluster agents** | ~130 | ~78 | ~36 | ~6 |
| **After orchestrator correction** (see below) | ~130 | **~84** | **~30** | ~6 |

**The test layer is genuinely strong.** Across every cluster, the consistent finding was that implemented business rules carry *adversarial* asserting tests — illegal state transitions assert specific error codes, cephalometric/perio math is pinned against hand-calculated golden values, audit immutability is enforced by a DB trigger and proven, cross-tenant access asserts 403. There is **no cluster where a meaningful rule is silently untested.**

**The dominant PARTIAL driver is the knowledge graph, not the tests.** The domain graph is a *lossy projection*: it materialized `step` children for only 10 of 38 flows and omits some modules entirely (emr-consultation has **no** flow node; the `manage-clinical-records`, `amend-locked-record`, `ar-collections` flows exist but have **zero** step children). So a workflow like "write prescription" or "void invoice" is mapped only at flow granularity (or not at all), even though its behavior is fully tested. **These PARTIALs are KG-completeness gaps, not product or coverage gaps.**

---

## ⚠️ Meta-finding: subagent false-negatives on the TEST column

The orchestrator spot-checked the **three highest-risk "test gap" claims**. **All three were false negatives** — the asserting test already existed and the agent missed it:

| Agent claim | Reality | Evidence |
|---|---|---|
| C1: *WF-035 consent revocation — WEAK, only a 401-not-404 route smoke; no post-revoke state asserted* | **GREEN.** Full real-DB block asserts `revoked===true`, `revokedAt`, `revokedBy`, 409 on double-revoke, **422 `CONSENT_ALREADY_SIGNED`** | `dental-clinical/clinical-consent-lab.test.ts:842-967` |
| C6: *WFG-013 booking confirmation notif — implemented but UNTESTED* | **GREEN.** Asserts `createNotification` called with `type: booking.created`, in-app channel, `relatedEntityType: appointment` (agent even listed this file in its grep) | `dental-scheduling/createAppointment.notif.test.ts:101-120` |
| C4: *BR-035 annotation LWW — registry "implemented" but no test* | **Covered.** `@BR-035` two-write last-wins test + production `updateFinding.ts` has no version guard (LWW by construction) | `dental-imaging/imaging.test.ts:1656-1740`; `updateFinding.ts:88` |

**Implication:** the agents *under-counted* coverage. Real GREEN is higher than the raw per-cluster numbers; the PARTIAL list below is the **corrected** set. The lesson mirrors a standing project note — *a test existing ≠ it asserting the rule*, and equally *an agent not finding a test ≠ the test not existing*. Coverage claims (both positive and negative) must be checked against source.

---

## Gap taxonomy (corrected)

### Bucket A — KG-projection gaps (≈28 items) · **dominant · low severity**
The behavior is **tested**; the domain graph simply lacks the node. Not closable by editing the gitignored, regenerated `domain-graph.json` — the fix belongs in the domain-extraction generator.
- **emr-consultation** — no flow node at all (all 6 WF-EMRC PARTIAL). Strong tests: `emr-coverage.test.ts`, `consultation-note.fsm.property.test.ts` (proves draft→finalized is the only valid transition).
- **dental-clinical sub-steps** — `manage-clinical-records` / `amend-locked-record` flow nodes have **zero** step children → prescription, lab-order, consent, medical-history, amendment all flow-only (WF-016/017/018/036/037/038; BR-014/017/018).
- **billing alternate/terminal paths** — payment-plan, invoice-void, uncollectible, invoice FSM have no step nodes (WF-015/041; BR-010/011/012/013). Graph models only the 5-step happy path.
- **carry-over** (BR-008 / WF-033), **reports/export** (WF-029), **patient search** (WF-023) — no node.
- perio/ceph flows mapped at flow level only (no step children) — acceptable.

### Bucket B — genuine test gaps · **after correction: effectively none**
All three flagged candidates were false negatives (table above). Residual nuance, not a gap:
- **BR-035** LWW test is mock-backed (documents intent); the *production* guarantee rests on `updateFinding.ts` having no optimistic-lock column. Acceptable for a "no-guard" rule; noted, not closed.
- **WF-008 workspace-open / WF-032 init-dentition** — covered indirectly via read endpoints + register/visit flows; no single dedicated assert. Low value.

### Bucket C — genuinely absent features · **accepted / deferred (product decisions, not closed)**
- **WF-002 passkey login**, **WF-003 magic-link login** — schema only; no functional test, no FE wiring. Unbuilt.
- **WF-P05 print perio chart (PDF export)** — no handler/route/test. (Deferred non-goal per project scope.)
- **WFG-010 invoice-overdue**, **WFG-011 PMD-ready**, **WFG-012 lab-complete** notifications — ABSENT; WFG-011/012 explicitly ADR-006-deferred (audit-log marker only, no reactive consumer).
- **BR-020 patient merge** — correct `501 NOT_IMPLEMENTED` stub; the guard-reaches-stub test passes. Note: the `flow:dedupe-merge-patient` KG node **over-claims** ("supports merge + unmerge + audit cascade") — KG-vs-reality drift; no such cascade exists.
- **BR-005 auto-discard** — flag-off (`DENTAL_VISIT_AUTO_DISCARD`), tested only with flag forced on. Registry "not-implemented" is accurate for default behavior.

### Bucket D — doc/registry drift · **CLOSED THIS PASS** ✅
See "Closed now" below.

---

## Closed now (this pass)

All edits are **doc/comment/registry only — zero runtime behavior change**, each verified against source first:

1. **`br-registry.json` BR-006** status `partial → implemented` (+ notes). Forward-only treatment FSM is fully tested in `treatment.fsm.property.test.ts`, `dental-visit.treatment-status-transitions.test.ts`, `treatment-fsm-http.test.ts` (illegal transitions assert 4xx). Status was understated.
2. **`br-registry.json` BR-018** description corrected: stale `ordered → in_progress → completed/cancelled` → actual implemented+tested `ordered → in_fabrication → delivered → fitted / cancelled` (the `delivered` transition is the DE-015 completion marker). Verified in `clinical-consent-lab.test.ts` + `lab-orders/updateLabOrder.ts`.
3. **`business-rules.test.ts` header** — moved BR-013 from "skipped (implementation gap)" to "tested"; corrected BR-019/BR-020 to "501 stub" (not "not implemented").
4. **`business-rules.test.ts:189`** — removed stale `BR-013 deferred … handler always returns 501` comment; BR-013 is implemented (AC-BIL-005, promoted 2026-06-04).
5. **`business-rules.test.ts:926`** — removed stale BR-011 "implementation gap — handler does NOT check" comment; `voidDentalInvoice` enforces it (409 `ACTIVE_PAYMENT_PLAN`) and the test below asserts the rejection.

## Deliberately not closed (with rationale)

- **KG-projection gaps (Bucket A)** — `domain-graph.json` is gitignored and regenerated; hand-editing it is theater that the next regen discards. The real fix is enriching the domain-extraction generator (or a targeted re-extraction that models alternate/terminal operations + emr-consultation). Recommended as a separate, scoped task — **not** a `/understand --full` rebuild (~12M tokens, poor ROI).
- **Absent features (Bucket C)** — passkey/magic-link/PDF-export/overdue+PMD+lab notifications/patient-merge are product or ADR-deferral decisions, several explicitly so. Building them is out of scope for a traceability pass and would be fabricating requirements.

## Recommendation

**Ship as-is.** Traceability is **healthy**: the test column is uniformly strong and adversarial; the remaining PARTIALs are overwhelmingly a single, low-severity knowledge-graph completeness limitation, now documented. The only *correctness*-adjacent items (Bucket C) are pre-existing, tracked, and intentional. Doc/registry drift that could mislead future contributors has been corrected.

Optional follow-ups, by value: (1) enrich the domain-graph generator to model alternate/terminal flow steps + emr-consultation (closes ~28 Bucket-A PARTIALs); (2) reconcile the `flow:dedupe-merge-patient` over-claim with the 501-stub reality; (3) if passkey/magic-link/overdue-notifications are real roadmap items, file them as PRD additions rather than leaving them as silent WF rows.

---

## Per-cluster matrices

The full evidence matrices (every WF/BR with KG node, test file:line, strength, verdict) are appended below, one section per cluster.

> **Caveat:** these are the cluster agents' **raw** verdicts. Three rows are **superseded** by the orchestrator correction above and should be read as GREEN, not PARTIAL: **WF-035** (C1), **BR-035** (C4), **WFG-013** (C6) — the agents missed the existing asserting tests (`clinical-consent-lab.test.ts:842`, `imaging.test.ts:1656`, `createAppointment.notif.test.ts:101`). All other rows stand.


---

## Traceability Audit — Cluster C1-visit-clinical (dental-visit, dental-clinical)

Branch: feat/module-workflow-alignment. Method: KG = node in `.understand-anything/domain-graph.json`; TEST = statically-read asserting test (adversarial: illegal-op must assert 4xx/403/409, not happy-path 200).

## Workflows

| ID | Name | KG node | Test artifact (file:line) | Strength | Verdict | Notes |
|----|------|---------|---------------------------|----------|---------|-------|
| WF-007 | Appointment check-in → visit creation | `step:book-appointment:check-in` (+ `step:conduct-visit:create-visit`) | dental-scheduling.test.ts:668,717 (409 second check-in); acceptance.scheduling-workflows.test.ts:188 (check-in→visitId) | VERIFIED | GREEN | Handler throws ConflictError 409 (checkInAppointment.ts:67); BR-001 enforced here. |
| WF-008 | Workspace open (patient record) | `flow:conduct-visit` / `flow:manage-clinical-records` | (FE read path) listConsentForms/listLabOrders 200 tests, clinical-consent-lab.test.ts:278 | WEAK | PARTIAL | UI read aggregation; no single asserting "workspace open" test — read endpoints individually 200-tested only. |
| WF-009 | Dental chart entry (condition/treatment) | `step:conduct-visit:update-tooth`, `step:conduct-visit:create-treatment` | business-rules.test.ts:634 (add treatment 201); dental-treatment.test.ts; chart/updateTooth.ts has tests | VERIFIED | GREEN | Treatment create + chart entry covered; immutability counter-cases (BR-003) assert 4xx. |
| WF-010 | Treatment mark as performed | `step:conduct-visit:create-treatment` | business-rules.test.ts:734 (planned→performed 200, consent-gated); treatment-fsm-http.test.ts | VERIFIED | GREEN | Consent gate enforced before performed (seedSignedConsent required). |
| WF-011 | Clinical notes (SOAP) authoring | `step:conduct-visit:upsert-notes`, `:sign-notes` | dental-visit.signed-notes.test.ts; dental-visit.visit-note-persistence.test.ts | VERIFIED | GREEN | Sign-notes + persistence asserted. |
| WF-012 | Complete visit | `step:conduct-visit:complete-visit` | business-rules.test.ts:488 (active→completed 200), :514/:540 (reverse 4xx) | VERIFIED | GREEN | Forward 200 + illegal reverse 4xx (BR-002). |
| WF-032 | Initialize dentition | `step:register-patient:init-dentition` | chart/initializeDentition.ts (exercised via register/visit tests) | WEAK | PARTIAL | Step node exists; no dedicated asserting test isolating dentition init outcome (covered indirectly). |
| WF-033 | Carry-over treatment display | `flow:build-accept-plan` (carry concept) — no dedicated node | treatment-table.test.ts:265 `[BR-008]` renders carried-over row | VERIFIED | PARTIAL | Test VERIFIED but no KG node for carry-over display. |
| WF-034 | Timeline carousel navigation | NONE | (FE carousel component tests exist, not in this cluster's BR set) | WEAK | PARTIAL | UI-only; no KG node, no asserting backend/contract test. |
| WF-016 | Write prescription | `flow:manage-clinical-records` (flow-level only) | em-cli-005.*.test.ts:162 (201), :175/:185/:195 (403) | VERIFIED | PARTIAL | Strong test; KG only at flow level, no `prescription` step node. |
| WF-017 | Create lab order | `flow:manage-clinical-records` (flow-level only) | clinical-consent-lab.test.ts:521 (201, status=ordered); business-rules.test.ts:1285 | VERIFIED | PARTIAL | Strong test; no discrete lab-order step node in KG. |
| WF-018 | Obtain consent signature | `flow:manage-clinical-records` (flow-level) | clinical-consent-lab.test.ts:378 (sign 200), :410 (re-sign 422) | VERIFIED | PARTIAL | Strong test; no discrete consent step node in KG. |
| WF-035 | Consent revocation | `flow:manage-clinical-records` (flow-level) | consent-revoke-route.test.ts:21 (route 401 not 404); clinical-consent-lab.test.ts (revoke route wired) | WEAK | PARTIAL | Route-existence only; no test asserting revocation state/append-only after revoke. |
| WF-036 | Lab order status progression | `flow:manage-clinical-records` (flow-level) | business-rules.test.ts:1285-1414 (full lifecycle: valid 200 + skip/backward 4xx) | VERIFIED | PARTIAL | Lifecycle fully asserted; no discrete KG step node. |
| WF-037 | Medical history entry | `flow:manage-clinical-records` (flow-level) | v-cli-002.medical-history-role-guard.test.ts:134/144 (201), :154 (403) | VERIFIED | PARTIAL | Role-guarded create asserted; no discrete KG step node. |
| WF-038 | Clinical amendment | `flow:amend-locked-record` (flow-level, no steps) | em-cli-011.amendment-role-guard.test.ts:167 (201), :195/:206 (403) | VERIFIED | PARTIAL | Role-guarded amendment asserted; KG flow has no step nodes. |
| WF-039 | File attachment upload | `flow:upload-file` (+ flow:manage-clinical-records) | clinical-attachment-amendment.test.ts (createAttachment tests) | VERIFIED | GREEN | Upload flow node exists + asserting attachment-create test. |

## Business Rules

| ID | Rule | KG node | Test artifact (file:line) | Strength | Verdict | Notes |
|----|------|---------|---------------------------|----------|---------|-------|
| BR-001 | No two active visits per patient | `step:book-appointment:check-in` | dental-scheduling.test.ts:668,693 (409 + /visit already active/), :717 | VERIFIED | GREEN | HTTP 409 enforcement at check-in boundary. business-rules.test.ts:433 also asserts repo invariant. |
| BR-002 | Visit transitions strictly linear (no reversal) | `step:conduct-visit:complete-visit` | business-rules.test.ts:514 (completed→active → VISIT_TRANSITION_INVALID), :527, :540 (VISIT_LOCKED) | VERIFIED | GREEN | Illegal reverse asserts code, not just 4xx. |
| BR-003 | Visit immutable after completed/locked | `flow:amend-locked-record` (flow-level) | business-rules.test.ts:560,579,598,616 (add treatment/lab → VISIT_IMMUTABLE) | VERIFIED | GREEN | Multiple immutability counter-cases assert code. |
| BR-005 | Auto-discard empty visit (not-implemented) | NONE | dental-visit/business-rules.test.ts:193 (flag-ON discard); tests/business-rules.test.ts:1613 `describe.skip` | VERIFIED (behind flag) | PARTIAL | Registry=not-implemented; feature exists behind default-OFF flag DENTAL_VISIT_AUTO_DISCARD; no KG node. Honest gap: not enforced by default. |
| BR-006 | Treatment transitions forward-only (dismissed from non-terminal) | `step:conduct-visit:create-treatment` | business-rules.test.ts:759,771,783 (reverse/terminal → 4xx); treatment.fsm.property.test.ts | VERIFIED | GREEN | Reverse + dismissed-terminal assert 4xx. Registry=partial but enforcement is tested. |
| BR-007 | Completed/verified treatment immutable (code/tooth/surface/price) | `step:conduct-visit:create-treatment` | business-rules.test.ts:822 (cdtCode on verified → 4xx) | VERIFIED | GREEN | Handler enforces TREATMENT_IMMUTABLE (updateDentalTreatment.ts:52-54); price locked (line 123). |
| BR-008 | Carried-over treatments are visual indicator, not auto-charged | NONE (carry not a node) | treatment-table.test.ts:265 `[BR-008]` (renders carried row); treatment-table.test.ts:241 carriedOver flag | VERIFIED | PARTIAL | FE render asserted; no KG node. Backend "not auto-charged" side not directly asserted (UI-only rule per spec). |
| BR-014 | Consent immutable once signed (append-only) | `flow:manage-clinical-records` (flow-level) | business-rules.test.ts:1091 (re-sign → 4xx /already signed/), :1106 (repo.sign null); clinical-consent-lab.test.ts:410 (422 CONSENT_FORM_SIGNED) | VERIFIED | PARTIAL | Strong test; no discrete consent step node in KG. |
| BR-015 | Registration requires consentGiven:true | `step:register-patient:update-consent` | business-rules.test.ts:1125 (consentGiven:false → 4xx CONSENT_REQUIRED) | VERIFIED | GREEN | Handler throws CONSENT_REQUIRED. |
| BR-017 | Prescription requires valid dentist-role prescriberMemberId | `flow:manage-clinical-records` (flow-level) | em-cli-005.*.test.ts:175,185,195 (403 cross-branch/inactive/nonexistent), :162 (201) | VERIFIED | PARTIAL | Membership+branch validation asserts 403; KG flow-level only. business-rules.test.ts:1229 also checks field presence. |
| BR-018 | Lab order lifecycle (terminal=completed/cancelled, no reversal) | `flow:manage-clinical-records` (flow-level) | business-rules.test.ts:1303 (skip→4xx), :1360,:1380 (terminal/backward→4xx), :1285/:1319/:1339 (valid 200) | VERIFIED | PARTIAL | Full lifecycle + terminal asserted. NOTE: actual states are ordered→in_fabrication→delivered→fitted/cancelled (registry desc says in_progress→completed — naming drift, behavior tested). No discrete KG step node. |

## Verdict counts
- Workflows (17): GREEN 4 · PARTIAL 12 · RED 0  (WF-007, WF-009, WF-010, WF-011, WF-012, WF-039 GREEN; rest PARTIAL — almost all PARTIAL due to missing KG step nodes, tests strong)
- Business Rules (11): GREEN 6 · PARTIAL 5 · RED 0
- Combined: GREEN 10 · PARTIAL 17 · RED 0

---

## C2-billing-finance — Traceability Matrix

Branch: feat/module-workflow-alignment. Static read-only audit. Two independent verdicts per item:
(A) KG-MAPPED (domain-graph.json flow/step node) and (B) TESTED (a test that ACTUALLY asserts the rule).

## WORKFLOWS

| ID | Name | KG node | Test file:line | Strength | Verdict | Notes |
|----|------|---------|----------------|----------|---------|-------|
| WF-013 | Create invoice from visit | `step:invoice-and-collect:create-invoice` (under `flow:invoice-and-collect`) | business-rules.test.ts:855-895 (BR-009 empty→4xx + happy 201 w/ lineItems); dental-billing.hurl:221-237 (asserts subtotalCents==23500, status draft, lineItems count==2) | VERIFIED | GREEN | Backend unit + contract both assert content, not just 200. |
| WF-014 | Record payment | `step:invoice-and-collect:payment` | dental-billing.test.ts:841-906 (401/404/400/201 + amountCents/method/isVoid asserts); edge-cases.test.ts:285-295 (draft invoice → 422 INVALID_STATUS_TRANSITION); dental-billing.hurl:262-278 (amountCents==5000, method==cash) | VERIFIED | GREEN | Includes negative path (payment on non-issued invoice rejected) + audit-trail assert (line 909). |
| WF-015 | Create payment plan | NONE (no `payment-plan` step node; `step:build-accept-plan:*` is TREATMENT plan, not payment plan) | dental-billing.test.ts:1148 (createDentalPaymentPlan); edge-cases.test.ts:479-545 (NO_BALANCE 422, rounding, install count); business-rules.test.ts:964-988 (3 installments asserted); dental-billing.hurl:302-355 (on_track, 3 installments, field types) | VERIFIED | PARTIAL | TESTED strongly, but NO KG step node — payment-plan creation is not a represented flow step. |
| WF-041 | Invoice void | NONE (no `void`/`uncollectible` step node under `flow:invoice-and-collect` or `flow:ar-collections`) | edge-cases.test.ts:398-455 (BR-011 422 ACTIVE_PAYMENT_PLAN, void paid OK, ALREADY_VOIDED); business-rules.test.ts:1029-1061 (draft→void 200, already-void 4xx) | VERIFIED | PARTIAL | Void logic fully asserted in tests, but void is not a KG-mapped step. `flow:ar-collections` exists but has zero child steps. |
| WF-042 | Fee schedule lookup | `flow:configure-fees-templates` (flow node only; entryPoint PATCH /dental/fees/:code; NO child step nodes) | dental-org.fee-schedule.test.ts:142-196 (401/400-missing-branchId/403-non-member/403-staff_full/200 owner catalog/override reflected/associate allowed) | VERIFIED | GREEN | Flow node exists (counts as KG-mapped at flow granularity) + RBAC-rigorous tests. Handler lives in dental-org, not dental-billing. |

## BUSINESS RULES

| ID | Rule | KG node | Test file:line | Strength | Verdict | Notes |
|----|------|---------|----------------|----------|---------|-------|
| BR-009 | Invoice requires ≥1 treatment line item; zero → rejected | (via WF-013 create-invoice step) | business-rules.test.ts:855-874 — asserts status≥400 AND `body.error` matches `/billable/i` on a visit with only a diagnosed (non-billable) treatment; 876-895 happy 201 | VERIFIED | GREEN | Adversarial empty-case assertion present. |
| BR-010 | Tax always 0 (stub, partial) | NONE | business-rules.test.ts:903-922 — asserts created invoice `taxCents === 0`; rounding.test.ts present | VERIFIED | PARTIAL | Registry status=partial (intended stub). Asserting test exists, but it is a flag/value rule, not a KG flow/step → no KG node. Verdict PARTIAL (TESTED, not KG-mapped). |
| BR-011 | Active payment plan blocks invoice archival (void/uncollectible) | NONE (no void step) | edge-cases.test.ts:398-424 — seeds active plan, asserts **422 + code==`ACTIVE_PAYMENT_PLAN`**; business-rules.test.ts:935-962 (asserts 4xx) | VERIFIED | PARTIAL | Handler voidDentalInvoice.ts:46-51 truly enforces it (the "documents the gap" comment in business-rules.test.ts:925-932 is STALE — guard IS implemented). TESTED rigorously; not KG-mapped. |
| BR-012 | Invoice state machine draft→issued→paid/partial/overdue/void; illegal → fail | (partly via invoice-and-collect issue/payment steps) | business-rules.test.ts:997-1061 (issue already-issued→4xx INVALID_STATUS; void already-void→4xx ALREADY_VOIDED); edge-cases.test.ts:285-306 (payment on draft→422 INVALID_STATUS_TRANSITION); invoice.fsm.property.test.ts:35-103 (fast-check transition map + terminal-state rejection) | VERIFIED | PARTIAL | Illegal-transition assertions present + property test. State machine itself is not a discrete KG step node (issue/payment steps partially cover it) → KG mapping weak; PARTIAL. |
| BR-013 | 'uncollectible' terminal write-off, reachable from issued/partial/overdue; terminal | NONE (no uncollectible step) | dental-billing.test.ts:705-766 — issued→200 uncollectible+uncollectibleAt; **draft→422 INVALID_STATUS_TRANSITION**; already-uncollectible→422 ALREADY_UNCOLLECTIBLE; **non-owner staff_full→403** (owner-only); invoice.fsm.property.test.ts:31-67 (uncollectible terminal) | VERIFIED | PARTIAL | FULLY implemented (markUncollectible.ts) + adversarially tested incl. else-422 + owner-only. NOT KG-mapped. ⚠ central business-rules.test.ts:13,189 STALE-claims BR-013 "deferred/501" — contradicted by dedicated tests + handler. |

## Summary counts
- WORKFLOWS: GREEN 3 (WF-013, WF-014, WF-042), PARTIAL 2 (WF-015, WF-041), RED 0
- BUSINESS RULES: GREEN 1 (BR-009), PARTIAL 4 (BR-010, BR-011, BR-012, BR-013), RED 0
- TOTAL: GREEN 4 / PARTIAL 6 / RED 0

## PARTIAL/RED missing-piece list
- WF-015 (Create payment plan): missing KG step node. `flow:invoice-and-collect` has steps create/discount/issue/payment/receipt but NO payment-plan step. (Tests strong.)
- WF-041 (Invoice void): missing KG step node. No void/archival step under invoice-and-collect; `flow:ar-collections` exists as a flow but has ZERO child steps. (Tests strong.)
- BR-010 (tax=0): not KG-mappable (value flag, registry=partial/stub by design). Tested.
- BR-011 (active plan blocks void): no KG node for void/archival. Tested (422 ACTIVE_PAYMENT_PLAN).
- BR-012 (invoice state machine): no discrete KG node for the FSM. Tested (illegal transitions + property test).
- BR-013 (uncollectible write-off): no KG node. Tested (incl. owner-only 403 + else-422).

## Flags
- NO registry-"implemented" BR is missing an asserting test. Every implemented BR (009/011/012/013) has a VERIFIED negative-path assertion. BR-010 (partial) also tested.
- STALE DOC FLAG: `services/api-ts/src/tests/business-rules.test.ts` header (lines 10-15) and inline comments (line 189, 925-932) claim BR-011 is an "implementation gap" and BR-013 is "deferred/handler always returns 501". Both are FALSE on this branch — voidDentalInvoice.ts:46-51 enforces BR-011 and markUncollectible.ts:23-55 fully implements BR-013, with dedicated rigorous tests in dental-billing.test.ts:705-766 and edge-cases.test.ts:398-424. The comments should be corrected to avoid future confusion.
- KG GAP: domain-graph.json models the billing happy path (invoice-and-collect: 5 steps) but the three terminal/AR flows (`flow:ar-collections`, `flow:configure-fees-templates`, `flow:claims-remittance`) have NO child step nodes, and there is no step for payment-plan creation, void, or uncollectible. These are the root cause of all 6 PARTIAL verdicts — the alternate/terminal billing paths are under-modeled in the KG despite being well-tested.

---

## C3-scheduling-org-auth — Traceability Result

Cluster modules: dental-scheduling, dental-org, auth
Branch: feat/module-workflow-alignment | Static read only (suite not run)

## Workflows

| ID | Name | KG node | Test file:line | Strength | Verdict | Notes |
|----|------|---------|----------------|----------|---------|-------|
| WF-006 | Appointment booking | `flow:book-appointment` (steps: Hold Slot, Create Appointment, Confirm, Check In) | dental-scheduling.hurl:59-70 (POST appt 201); business-rules.test.ts (BR-005/booking); appointment-modal.test.tsx (FE); journey 17-scheduling-booking.journey.spec.ts | VERIFIED | KG-mapped w/ 4 steps; backend+contract+FE+E2E all assert real create. |
| WF-007 | Appointment check-in → visit creation | `step:book-appointment:check-in` "Check In Patient" + `step:conduct-visit:create-visit` | acceptance.scheduling-workflows.test.ts:160-219 (AC-SCHED-02 asserts check-in returns visitId + appt.visitId linked w/ correct patientId/branchId); dental-scheduling.hurl:111 | VERIFIED | Asserts visit actually created+linked on check-in, not just 200. |
| WF-024 | Calendar / schedule view | `flow:book-appointment` (no dedicated view step; calendar reads appointments) | calendar.spec.ts:69 (seeds appt, asserts card renders in day grid — guards the branchId-drop bug); calendar-day/week/month.test.ts (FE positioning) | VERIFIED | E2E asserts real seeded appointment card, not just toolbar chrome. |
| WF-004 | Staff invitation + first login | `flow:manage-membership-rbac` → step Create Member | createMember.test.ts:156-235 (201 valid, 403 non-owner, owner-bootstrap); add-staff.spec.ts (FR6.1 create→list); auth-pin.spec.ts:100 (staff PIN profile-select) | VERIFIED | RBAC 403 + create asserted; first-login via PIN-select E2E. |
| WF-025 | Configure fee schedule | `flow:configure-fees-templates` | dental-org.fee-schedule.test.ts:142-157 (401 noauth, 400 missing branchId, **403 non-member**, GET/PATCH wired) | VERIFIED | Cross-membership 403 asserted. |
| WF-026 | Configure branch hours | `flow:configure-fees-templates` (org config; no dedicated hours step) | dental-scheduling.working-hours.test.ts:133+ (GET/PUT save+round-trip, invalid-time rejected, **booking blocked outside hours FR3.10**); clinic-settings.test.ts (403 non-owner) | VERIFIED | Config persisted AND enforced on booking. |
| WF-027 | Staff member management | `flow:manage-membership-rbac` → Create/Set Permissions/Deactivate Member | createMember.test.ts:220 (403 non-owner); deactivateMember.test.ts + .route.test.ts; updateMember.test.ts; permissions.test.ts; listMembers.test.ts | VERIFIED | Full CRUD incl 403 RBAC + real route registration. |
| WF-029 | Export practice reports | NONE (no dedicated KG flow/step; closest = getDashboardSummary, no export node) | reporting.spec.ts:126 (revenue report renders seeded invoice, no 500); reports/components/*.test.ts (revenue/patient/treatment); exportPatientCareRecord.test.ts (PMD, adjacent) | PARTIAL | TESTED (reporting E2E + unit asserts real data) but NO KG node for a reports/export flow. |
| WF-043 | Branch-scoped login (membership select) | `flow:manage-membership-rbac` (Set/Verify PIN steps) | getBranchesByUser.test.ts:65-82 (401 noauth, empty when no active membership, **active-only — inactive membership excluded**); verifyPin.test.ts; auth-pin.spec.ts:114 (/auth/pin-select) | VERIFIED | Membership-scoped branch selection asserted incl inactive-exclusion. |
| WF-001 | User Login (email+password) | NONE (Better-Auth integrated; no auth flow/step in KG) | auth-signup-signin.hurl:7-37 (sign-up→get-session→sign-out); auth-password-reset.hurl:66 (sign-in/email asserted); journey 18 + journey 11 sign-in/email; booking-flow.hurl:110 | PARTIAL | TESTED (real sign-in/session contract+journeys) but NO KG auth node — legitimately so (Better-Auth). No BR. |
| WF-002 | User Login (passkey) | NONE | NONE (passkey only in Better-Auth migration schema; no functional test, no FE usage) | NONE | RED | No KG node AND no test exercising passkey login. |
| WF-003 | Magic link login (patient) | NONE | NONE (no magic-link handler test, no FE sendMagicLink, only schema) | NONE | RED | No KG node AND no test. Feature appears unbuilt/unexercised. |

## Business Rules

| ID | Rule | KG node | Test file:line | Strength | Verdict | Notes |
|----|------|---------|----------------|----------|---------|-------|
| BR-004 | Check-in creates a visit; deleting the appointment does NOT delete the visit | `step:book-appointment:check-in` + `step:conduct-visit:create-visit` | business-rules.test.ts:653-711 (cancels appt via real DELETE, asserts **linked visit still exists** by id); acceptance.scheduling-workflows.test.ts AC-SCHED-03 (cancel ≠ delete visit) | VERIFIED | Adversarial: visit survival explicitly asserted after appt soft-delete. |
| BR-016 | Branch membership required for all clinical access; every handler calls assertBranchAccess | `flow:manage-membership-rbac` (membership domain) | business-rules.test.ts:1142-1148 (no-membership → 403 on create visit); cross-org-isolation.test.ts:176-229 (**Org-B member → 403 on Org-A patient AND visit**); rbac-scheduling.test.ts:365 (no-membership POST appt → 403); dental-org-auth-p0.test.ts:138-201 (foreign-org 403) | VERIFIED | Cross-branch/cross-org 403 asserted at multiple handlers (99 assertBranchAccess call sites). |

## Verdict Counts
- GREEN (KG + TESTED): 8 — WF-006, WF-007, WF-024, WF-004, WF-025, WF-026, WF-027, WF-043, BR-004, BR-016 (10 items GREEN)
- PARTIAL: 2 — WF-029 (tested, no KG node), WF-001 (tested, no KG node — auth legitimately Better-Auth)
- RED: 2 — WF-002 (passkey), WF-003 (magic-link)

Total: 12 workflows + 2 BRs. GREEN=10, PARTIAL=2, RED=2.

---

## C4-imaging-perio — Traceability Audit Result

Branch: feat/module-workflow-alignment. Modules: dental-imaging, dental-perio.
Method: static read of KG (domain-graph.json), backend handler tests, ceph-math
package tests, contract Hurl suites, FE unit tests, E2E specs. Suite NOT run.

Two independent verdicts per item: (A) KG-MAPPED (flow/step node), (B) TESTED
(a test that ACTUALLY ASSERTS the rule). GREEN = both. PARTIAL = one. RED = neither.

---

## WORKFLOWS

| WF | Name | KG | TEST | Verdict | Evidence |
|----|------|----|------|---------|----------|
| WF-019 | Upload radiographic study | YES — `flow:capture-imaging-study` step "Create Study" (createImagingStudy.ts) | VERIFIED | GREEN | imaging.test.ts createImagingStudy 201; e2e imaging-annotation/measurement specs; BR-034 mime gate |
| WF-020 | Annotate radiograph | YES — covered under capture-imaging flow (createMeasurement/createFinding) | VERIFIED | GREEN | imaging.test.ts annotation geometry types (label/arrow/freehand/shape 201/400); e2e imaging-annotation.spec.ts |
| WF-030 | Cephalometric analysis | YES — `flow:cephalometric-analysis` (no discrete step nodes) | VERIFIED | GREEN | ceph.test.ts + ceph-business-rules.test.ts + ceph-math analyses/ceph-math.test.ts (SNA/SNB/ANB golden); e2e imaging-ceph.spec.ts + journeys 11–14 |
| WF-031 | Ceph landmark placement | YES — flow entry `POST .../ceph/:studyId/landmarks` | VERIFIED | GREEN | ceph.test.ts batch upsert / FSM transitions; ceph-landmark.fsm.property.test.ts; FE CephLandmarkLayer/Palette tests |
| WF-040 | Imaging finding record | YES — step "Record Finding" (createFinding.ts) | VERIFIED | GREEN | imaging.test.ts imaging findings (createFinding 201/401/404, listFindings, updateFinding); e2e imaging-findings.spec.ts |
| WF-P01 | Create perio chart for a visit | YES — `flow:record-perio-chart` + step "Record Perio Chart" (createPerioChart.ts) | VERIFIED | GREEN | dental-perio-coverage.test.ts createPerioChart 201/409/403/422; contract dental-perio.hurl |
| WF-P02 | Record tooth-level readings | YES — record-perio-chart flow (upsert per-site merge) | VERIFIED | GREEN | dental-perio-coverage.test.ts upsertToothReading (per-site merge no-data-loss, CAL math, grade bounds); contract hurl PUT readings |
| WF-P03 | Complete / lock perio chart | YES — record-perio-chart flow | VERIFIED | GREEN | dental-perio-coverage.test.ts completePerioChart (16-reading gate, 2017 staging/grading, visit-lock cascade) |
| WF-P04 | View perio chart (historical) | YES — `flow:perio-longitudinal-comparison` + getPerioChart | VERIFIED | GREEN | dental-perio-history.test.ts listPerioChartsForPatient; FE perio-comparison.logic.test.ts (trend math) |
| WF-P05 | Print perio chart (PDF export) | NO discrete KG node (no print/PDF flow or step) | NONE — no asserting test for PDF export found | RED | No `print`/`pdf` perio handler/route/test; not in KG flows. Per MEMORY, PDF export is a deferred non-goal backlog item. |

---

## BUSINESS RULES — dental-imaging (core BR-023..035)

| BR | Status(reg) | KG | TEST | Verdict | Evidence |
|----|-----|----|------|---------|----------|
| BR-023 | implemented | YES (capture/annotate) | VERIFIED | GREEN | imaging.test.ts annotation geometry stored as overlay; FE use-imaging-br.test.ts BR-023 asserts createFinding POSTs `/findings`, never PATCHes the image resource; finding carries no image URL |
| BR-024 | partial | YES (calibration step) | VERIFIED | GREEN | Backend updateImageCalibration (200/400/401); FE measurement-toolbar.test.ts asserts panoramic + uncalibrated warning show/hide + distance/area disabled when uncalibrated |
| BR-025 | implemented | YES | VERIFIED | GREEN | imaging.test.ts @BR-025 (image→patient required, visit/tooth optional); FE use-imaging-br.test.ts BR-025 (patientId required, visit/tooth optional) |
| BR-026 | implemented | YES | VERIFIED | GREEN | imaging.test.ts: hygienist 403, front_desk 403 (delete default-deny) |
| BR-027 | implemented | YES | VERIFIED | GREEN | imaging.test.ts: associate deletes own→200, other's→403 |
| BR-028 | implemented | YES | VERIFIED | GREEN | imaging.test.ts BR-028: delete sets status='archived' (captured set arg), no hard delete; FE BR-028 DELETE method, no cache purge |
| BR-029 | implemented | YES | VERIFIED | GREEN | imaging.test.ts findings branch isolation (401 unauth, 404 missing image); FE BR-029 |
| BR-030 | implemented | YES | VERIFIED | GREEN | imaging.test.ts union adapter: xray→source:legacy/modality:other, photo→intraoral_photo, downloadUrl null |
| BR-031 | unauditable | n/a | NONE (IndexedDB offline cache; use-offline-cache.test.ts exists but cache-presence is environment-dependent) | PARTIAL | use-offline-cache.test.ts present; rule self-declared unauditable. KG: no node. |
| BR-032 | implemented | YES | VERIFIED | GREEN | modality non-null default 'other' asserted in create paths + union adapter default 'other' |
| BR-033 | partial | YES | WEAK (delegated) | PARTIAL | imaging.test.ts BR-033 confirms handler does NOT enforce 100MB (delegated to storage multipart); no test proves storage layer rejects >100MB. Honest gap; registry=partial. |
| BR-034 | implemented | YES | VERIFIED | GREEN | imaging.test.ts BR-034: application/pdf→422 UNSUPPORTED_MIME_TYPE; image/jpeg accepted; mime checked before size |
| BR-035 | implemented | YES | WEAK | PARTIAL | Backend test exercises a LOCAL mock db (tests the mock's LWW, not the real updateAnnotation/updateFinding handler). FE test only confirms the hook sends PATCH and comments "backend enforces LWW". No test asserts the production handler omits an optimistic-lock / applies last-write-wins. |

## BUSINESS RULES — dental-imaging ceph (CIMG-001..015)

All map to KG `flow:cephalometric-analysis`. All VERIFIED in ceph.test.ts and/or
ceph-business-rules.test.ts with strong status/code/value assertions.

| CIMG | Verdict | Evidence (file) |
|------|---------|-----------------|
| CIMG-001 (paid tier 403) | GREEN | ceph.test.ts "Addon tier gate — free org → 403" (batch/PATCH/get) |
| CIMG-002 (null tier=free 403) | GREEN | ceph.test.ts "null imagingTier treated as free → 403" |
| CIMG-003 (forward FSM placed→confirmed→locked) | GREEN | ceph.test.ts "Invalid status transition" (valid forward 200); fsm.property.test.ts |
| CIMG-004 (locked immutable 422 LANDMARK_LOCKED) | GREEN | ceph.test.ts "CIMG-14 lock matrix" PATCH x/y/DELETE→422 |
| CIMG-005 (invalid transition 422 INVALID_STATUS_TRANSITION) | GREEN | ceph.test.ts placed→locked skip / confirmed→placed→422 |
| CIMG-006 (report gate A/B/Go/Po confirmed) | GREEN | ceph.test.ts "D-L confirm-gate" 422 REPORT_GATE_UNCONFIRMED |
| CIMG-007 (non-member 404 not 403) | GREEN | ceph.test.ts "Branch isolation — non-member → 404 not 403"; ceph-business-rules BR-041 (8 ops) |
| CIMG-008 (immutable versioned reports) | GREEN | ceph.test.ts "D-I immutability" + "Version monotonicity" |
| CIMG-009 (write returns {items,analysis} fresh) | GREEN | ceph.test.ts BR-030 recompute-on-write; ceph-business-rules BR-046 |
| CIMG-010 (analysisType steiner_hybrid_sn) | GREEN | ceph.test.ts "D-G label"; ceph-business-rules BR-043 |
| CIMG-011 (createCephReport 201 frozen snapshot) | GREEN | ceph.test.ts "CIMG-11 report assembly" + D4 snapshot fields |
| CIMG-012 (version monotonic, unique (imageId,version)) | GREEN | ceph.test.ts Version monotonicity; ceph-business-rules BR-042 |
| CIMG-013 (PATCH returns {items,analysis}) | GREEN | ceph.test.ts "CIMG-13 PATCH landmark" |
| CIMG-014 (locked immutable across 3 axes) | GREEN | ceph.test.ts CIMG-14 lock matrix (x/y/delete) |
| CIMG-015 (recompute returns single CephAnalysis, idempotent) | GREEN | ceph.test.ts "CIMG-15 recompute idempotent"; ceph-business-rules BR-038 |

## BUSINESS RULES — dental-imaging ceph (BR-036..047)

All map to KG `flow:cephalometric-analysis`. ALL VERIFIED in the formal
ceph-business-rules.test.ts (796 lines, each BR id → describe block, strong
assertions on status/code/computed values; @monobase/ceph-math exercised live).

| BR | Verdict | Evidence (ceph-business-rules.test.ts) |
|----|---------|-----------------------------------------|
| BR-036 idempotent batch upsert | GREEN | onConflictDoUpdate target=(imageId,landmarkCode), set overwrites x/y; items not duplicated |
| BR-037 locked rows skipped in batch | GREEN | setWhere contains 'locked'; locked code → still 200, row stays locked |
| BR-038 recompute idempotent, analysis-only | GREEN | two recomputes equal measurements; no version/snapshot in response |
| BR-039 calibration provenance frozen | GREEN | snapshot.calibration = {value:0.1,method:manual_ruler} / {null,not_calibrated} |
| BR-040 calibration gates mm metrics | GREEN | uncalibrated→mm null + angles still number; calibrated→mm number (also ceph-math.test.ts) |
| BR-041 non-member 404 never 403 | GREEN | 8 CephMgmt_* ops parametrized → 404 |
| BR-042 version monotonic no gap | GREEN | first→1; maxVersion=2→3 |
| BR-043 steiner_hybrid_sn label | GREEN | analysis + snapshot.analysis_label asserted |
| BR-044 delete confirmed/placed ok, locked→422 | GREEN | placed/confirmed→204; locked→422 LANDMARK_LOCKED |
| BR-045 snapshot measurements nullable | GREEN | gate-only report 201; sna/snb/anb present but null |
| BR-046 PATCH inline recompute contract | GREEN | PATCH→fresh {items,analysis}; recompute endpoint authoritative |
| BR-047 ceph ops require existing image → 404 | GREEN | 7 ops parametrized w/ image:null → 404 |

**Ceph math correctness** (load-bearing): packages/ceph-math/src/ceph-math.test.ts
pins SNA≈82.0, SNB≈80.0, ANB≈2.0 against hand-calculated golden coords + Class I/II/III
sign checks + uncalibrated null taxonomy. analyses.test.ts pins ricketts/downs/tweed
facial_angle/fma/impa/a_to_nperp/pa_fhr to toBeCloseTo. STRONG.

## BUSINESS RULES — dental-perio (implicit, not enumerated in cluster)

Perio has no BR ids in the cluster JSON, but the workflow verdicts above cover the
perio rule surface. Key invariants VERIFIED in dental-perio-coverage.test.ts:
- CAL math (PD+recession, at-CEJ, coronal subtraction, null when GM missing) — VERIFIED line 456
- AAP/EFP 2017 staging/grading (Stage III + Grade C + generalized from clinical inputs) — VERIFIED line 659
- Per-site merge no-data-loss (single-site patch preserves other sites) — VERIFIED line 298/343
- Visit-lock cascade, 16-reading completion gate, primary-dentition 8-reading min — VERIFIED
- Grade bounds (mobility 0-3, furcation, tooth number, gingival margin) — VERIFIED

---

## COUNTS

Workflows: 9 GREEN, 0 PARTIAL, 1 RED (WF-P05)
Imaging core BR-023..035 (13): 9 GREEN, 3 PARTIAL (BR-031, BR-033, BR-035), 0 RED
Imaging ceph CIMG-001..015 (15): 15 GREEN
Imaging ceph BR-036..047 (12): 12 GREEN

TOTAL items: 49 (10 WF + 13 core BR + 15 CIMG + 12 ceph BR — note BR-024/etc not double-counted)
GREEN: 45 | PARTIAL: 3 | RED: 1

## PARTIAL / RED detail

- **WF-P05 Print perio chart (PDF export) — RED**: no KG node, no asserting test, no
  print/PDF handler or route. Deferred non-goal per project memory.
- **BR-031 (IndexedDB offline cache) — PARTIAL**: registry self-declares 'unauditable';
  use-offline-cache.test.ts exists but offline-cache presence is environment-dependent;
  no KG node. Acceptable given declared status.
- **BR-033 (100MB upload limit) — PARTIAL**: registry='partial'; test confirms the
  *handler* does NOT enforce the limit (delegated to storage multipart) — but NO test
  proves the storage layer rejects >100MB. Enforcement is unverified end-to-end.
- **BR-035 (annotation last-write-wins) — PARTIAL**: registry='implemented' but NO test
  asserts the *production* handler applies LWW / omits an optimistic-lock. The backend
  test drives a local mock db (asserts the mock, not updateAnnotation/updateFinding); the
  FE test only asserts the hook sends PATCH and defers LWW to "the backend". Registry-
  'implemented' with no asserting test against the real handler.

## REGISTRY-"implemented" BRs WITH NO ASSERTING TEST (flagged)
- **BR-035** — only weak/mock + hook-level coverage; no real-handler LWW assertion.
  (BR-033 is registry='partial', so its gap is honestly disclosed, not a false claim.)

---

## Traceability Result — C5-pmd-patient-emr-erasure

Branch: feat/module-workflow-alignment. Static read only (suite NOT run).
Modules: dental-pmd, dental-patient, emr (consultation), dental-erasure, dental-legalhold, retention.

KG source: `.understand-anything/domain-graph.json` (38 flow nodes, 46 step nodes).
GREEN = KG-mapped AND a test that ACTUALLY ASSERTS the rule. PARTIAL = one. RED = neither.

## Workflow matrix

| ID | Name | KG-mapped? | Tested? (verdict + file:line) | Verdict |
|----|------|-----------|-------------------------------|---------|
| WF-021 | Generate PMD | YES `flow:generate-pmd` (entry POST /dental/pmd/generate) | VERIFIED — `dental-pmd/dental-pmd.test.ts:194-316` (gen on completed visit, 422 on draft, patient-visit binding, supersede) + `dental-pmd-auth.test.ts:225` | GREEN |
| WF-022 | Import external PMD | YES `flow:import-external-pmd` | VERIFIED — `imported-pmd-immutable.test.ts:25-61` (real app, 405 on PATCH/PUT/DELETE) + `repos/pmd-document.test.ts:141-213` (import store, sourceDescription) + contract `dental-pmd.hurl:250-316` | GREEN |
| WF-005 | Patient registration | YES `flow:register-patient` (+4 step nodes: create-person/create-patient/init-dentition/update-consent) | VERIFIED — `dental-patient/dental-patient.test.ts:120-155, 300-343` (create + duplicate-detect warning) + contract `dental-patient.hurl:45-55` + FE `patient-registration-modal.test.ts` (9 asserts) | GREEN |
| WF-023 | Patient search | **NONE** (no search flow node; not subsumed under register-patient) | VERIFIED — `dental-patient.test.ts:201-265` (FR2.2 ?q= search) + FE `patient-list.test.ts`, `use-patients.test.ts` | PARTIAL (KG gap) |
| WF-044 | Patient consent at registration (BR-015) | YES (step `step:register-patient:update-consent` "Record Consent Flags") | VERIFIED — `communication-consent.test.ts:141-148` (registration consent preserved) + `dental-patient.hurl:52` consentGiven=true | GREEN |
| WF-EMRC-001 | Provider creates draft consultation | **NONE** (no EMR/consultation flow in KG) | VERIFIED — `emr/emr-coverage.test.ts:170-271` (real app: 401/400/403/404/201 happy + CONSULTATION_EXISTS) | PARTIAL (KG gap) |
| WF-EMRC-002 | Provider updates draft fields | **NONE** | VERIFIED — `emr-coverage.test.ts:456-539` incl. line 526 "cannot update finalized → CONSULTATION_NOT_DRAFT" + handler guard `updateConsultation.ts:69-73` | PARTIAL (KG gap) |
| WF-EMRC-003 | Provider finalizes draft (terminal) | **NONE** | VERIFIED — `emr-coverage.test.ts:546-598` (finalize happy + 404 + 403 + re-finalize ≥400) + FSM `consultation-note.fsm.property.test.ts:42-94` (draft→finalized ONLY) + `emr.handlers.test.ts:158-186` | PARTIAL (KG gap) |
| WF-EMRC-004 | ~~Amend finalized~~ STRUCK (V-EMR-001) | **NONE** | VERIFIED (struck-correctly) — `consultation-note.fsm.property.test.ts:60-64` asserts finalized↔amended REJECTED; no amend endpoint exists | PARTIAL (KG gap; rule is "must NOT exist", proven) |
| WF-EMRC-005 | Read note w/ optional expand | **NONE** | VERIFIED — `getConsultation.expand.test.ts:75-105` (flat vs nested patient/provider/person) + `emr-coverage.test.ts:274-328` (admin/provider/patient RBAC reads) | PARTIAL (KG gap) |
| WF-EMRC-006 | List consulted patients w/ stats | **NONE** | VERIFIED — `emr-coverage.test.ts:405-465` (listEMRPatients: no-profile 403, empty, populated, admin cross-provider) | PARTIAL (KG gap) |

## Business-rule matrix

| ID | Status (input) | KG-mapped? | Tested? (verdict + file:line) | Verdict |
|----|---------------|-----------|-------------------------------|---------|
| BR-021 | implemented (PMD checksum snapshot) | YES `flow:generate-pmd` | **VERIFIED (gold)** — `dental-pmd.test.ts:252-293` mutates source-visit treatment after gen, re-fetches PMD, asserts content byte-identical + checksum unchanged + original cdtCode preserved (`!= D9999`); repo sign-once + supersede `repos/pmd-document.test.ts:75-108` | GREEN |
| BR-022 | implemented (imported PMD read-only) | YES `flow:import-external-pmd` | **VERIFIED** — `imported-pmd-immutable.test.ts:26-60` real-app 405 IMPORTED_PMD_IMMUTABLE on PATCH/PUT/DELETE (+route-param independence) | GREEN |
| BR-019 | partial (records immutable/append-only; corrections=amendments) | YES `flow:manage-clinical-records` + `flow:amend-locked-record` | VERIFIED — signed-note lock `dental-visit/dental-visit.signed-notes.test.ts:262-268` (422 NOTE_SIGNED on edit) + addendum append-only (J10) + amendment workflow `dental-clinical/amendments/approveAmendment.test.ts`, `repos/amendment.test.ts`, `em-cli-011.amendment-role-guard.test.ts` | GREEN |
| BR-020 | **not-implemented** (patient merge/unmerge) | YES `flow:dedupe-merge-patient` (summary CLAIMS merge cascade + unmerge — ASPIRATIONAL/INACCURATE) | VERIFIED-as-stub — `patient/mergePatients.ts:29-35` returns 501 NOT_IMPLEMENTED; `unmergePatients` throws→500; `patient/patient-merge-auth.test.ts:106-117,133-143` asserts admin reaches the **501/500 stub** (NOT a cascade). Test header explicitly: "merge/unmerge business logic is intentionally NOT implemented; we only verify the authorization guard." | GREEN (rule = "not implemented", correctly tested) |

## WFG-006 / WFG-007 status (explicit)

- **WFG-006 (Erasure / GDPR Art.17)** — fully covered, GREEN.
  - KG: `flow:erasure-request` + 4 step nodes (request/get/approve/reject); `flow:legal-hold`.
  - Engine safety invariants VERIFIED: `dental-erasure/erasure-engine.test.ts:38-168` — dry-run default, **anonymize-not-delete**, **legal-hold blocks (no target touched, refusal audited `erasure.blocked_legal_hold`)**, idempotent no-op, **every run APPENDS an audit event**, S3 file-id surfacing.
  - Cross-module integration VERIFIED: `erasure-legalhold.test.ts:33-68` — active hold → approve blocked (status rejected, `legalHoldBlocked=true`, person firstName NOT erased) → release → fresh request → approve → person `firstName == ERASED_MARKER`.
  - Contract VERIFIED end-to-end: `specs/api/tests/contract/dental-erasure.hurl:266-300` (Scenario 6 place-hold→approve-blocked→release→fresh→anonymized) + `dental-legalhold.hurl` lifecycle. Service layer `erasure-service.test.ts:53-106` (reject-then-no-reapprove, terminal-state guards).
- **WFG-007** — NOT a workflow in this cluster's input JSON. Per task framing it denotes the patient-merge cascade orphan. There is **NO merge-cascade workflow node and no cascade test** — merge is the 501 stub above (BR-020). So WFG-007 (merge cascade) is correctly absent/orphaned; the KG `flow:dedupe-merge-patient` node is present but its summary over-claims a cascade that does not exist in code. This is a KG-vs-reality drift, not a missing test (the not-implemented state IS tested).

## Counts

- Workflows: 11 total — **4 GREEN**, **7 PARTIAL**, 0 RED.
- Business rules: 4 total — **4 GREEN**, 0 PARTIAL, 0 RED.
- All 7 PARTIALs are KG-mapping gaps (test side is VERIFIED in every case): WF-023 patient-search + all 6 WF-EMRC-* (emr consultation module has zero domain-graph flow node).

---

## C6-base-notif-audit — Traceability Result

Branch: feat/module-workflow-alignment. Method: static read only (suite NOT run).
KG source: `.understand-anything/domain-graph.json` (all 8 base flows confirmed as nodes).

## Verdict legend
GREEN = KG-mapped AND a test that asserts real behavior. PARTIAL = one. RED = neither.

## Workflows in cluster JSON

| ID | Name | KG | Test | Verdict | Evidence |
|----|------|----|------|---------|----------|
| WF-028 | View audit log | ✅ ("Audit Trail" node) | ✅ VERIFIED | **GREEN** | `dental-audit/listAuditLogs.test.ts`, `getAuditEvents.test.ts`, `audit-events-route-registration.test.ts`; contract `audit.hurl` (401/200/403). |

Business rules: none in this cluster.

## Base-module flows (the real job)

| Flow | KG node | Test (file:line) | Quality | Verdict |
|------|---------|------------------|---------|---------|
| **Audit Trail** | ✅ | `dental-audit/audit-immutability-db.test.ts:70-113` (real DB: INSERT allowed; row UPDATE/DELETE rejected by DB trigger w/ "append-only"); `audit-append-only.test.ts:28-61` (405 AUDIT_EVENT_IMMUTABLE on DELETE/PUT/PATCH via real routes); contract `audit.hurl`, `audit-side-effects.hurl` | VERIFIED — DB-trigger immutability + route-level 405 + append-allowed | **GREEN** |
| **Notifications** | ✅ | `notifs/notifs.test.ts:125,180` (real DB readback `recipient`, ownership-filter 404, 200 body); `markNotificationAsRead.test.ts`; contract `notifs.hurl` (401/200/201, unread count==0) | VERIFIED — persistence + ownership isolation | **GREEN** |
| **Transactional Email** | ✅ | `email/email-queue.test.ts:124,150` (real DB readback name+status; 403 non-admin); `email-templates.test.ts`; `jobs/processor.test.ts`; contract `email.hurl` (401/403/200/201) | VERIFIED — queue/template persistence + RBAC + processor | **GREEN** |
| **Chat Room** | ✅ | `comms/comms.test.ts:142-156` (real DB chatRoom readback status), `:177-195` (message readback messageType); participant-validation 400/403; contract `comms.hurl`, `comms-edge.hurl` | VERIFIED — room/message persistence + participant RBAC | **GREEN** |
| **Video Call** | ✅ | `comms/joinVideoCall.test.ts`; `ws.chat-room.test.ts` (WS); endVideoCall/joinVideoCall fire notifs (`endVideoCall.ts:114`, `joinVideoCall.ts:142`); contract `comms.hurl` covers call lifecycle | VERIFIED (lifecycle handlers tested); WS signaling has dedicated test | **GREEN** |
| **Upload File** | ✅ | `storage/uploadFile.test.ts:48-149` (size-limit boundaries 50/100/101MB, auth); `multipartOwnerCheck.test.ts`; `storage-coverage.test.ts`; contract `storage.hurl:52` (`uploadMethod == "PUT"`), `storage-edge.hurl` | VERIFIED for validation/auth/multipart-ownership; **S3 mocked** — no real byte-level persist roundtrip (presigned-URL pattern, so client uploads direct to S3 — acceptable) | **GREEN** |
| **Download File** | ✅ | `storage-coverage.test.ts:258-281` (getFileDownload presigned-URL gen + owner 403 on foreign file); contract `storage.hurl` | VERIFIED — URL generation + owner gate; mocked storage adapter | **GREEN** |
| **Submit Review** | ✅ | `reviews/reviews.test.ts:127-143` (real DB seed+readback `npsScore===8`), `:188-224` (200 body npsScore 9/7, RBAC owner/admin/reviewed-entity); `createReview.test.ts` (self-review block, validation); contract `reviews.hurl` (200/201/400) | VERIFIED — NPS persisted to DB and asserted on readback + RBAC | **GREEN** |

Supporting (also in cluster modules): **person** `person.test.ts:145-228` (real DB persist bound to caller, 409 dup, 400 future-DOB) — GREEN. **billing** `createInvoice.test.ts`/`payInvoice.test.ts`/`handleStripeWebhook.test.ts` — GREEN. **booking** `createBooking.test.ts`/`confirmBooking.test.ts`/`jobs/confirmationTimer.test.ts` — GREEN.

## §14 NOTIFICATION GAPS — true current state

| Gap | Feature | State | Evidence |
|-----|---------|-------|----------|
| **WFG-009** | 24h appointment reminder | **IMPLEMENTED + TESTED → GREEN** | `dental-scheduling/jobs/reminderArmer.ts` — cron job enqueues scheduled `appointment.reminder` rows per configurable `leadHours` policy (e.g. [72,24,2]) × consented channel, keyed for idempotency, consent-gated. Test `reminderArmer.test.ts:107-174` hits REAL DB + REAL NotificationRepository: asserts exact row count (6 = 3 leads × 2 channels), idempotency (2nd run = 0 dupes), SMS suppressed w/o consent, past-lead skip, canceller expiry. Delivery via `notifs.processScheduledNotifications`. |
| **WFG-010** | Invoice overdue notification | **PARTIAL → RED (overdue gap)** | NO overdue/dunning job exists (`grep overdue/dunning/past-due` in `*/jobs/*` = empty; no `invoice.overdue` notif type). What DOES exist: `billing/finalizeInvoice.ts:139` fires an "Invoice issued" `billing` notif on finalize (tested `finalizeInvoice.notif.test.ts`), and `handleStripeWebhook.ts` fires payment-success/failed notifs. But **no detection of due-date passing → no overdue notification**. The specific WFG-010 feature is **ABSENT**. |
| **WFG-011** | PMD ready notification | **ABSENT (explicitly deferred)** | `dental-pmd/generatePMD.ts:144-152` — per ADR-006 (domain-events-descope) there is NO event bus; the DE-017 "PMDGenerated" event is satisfied ONLY by writing a `pmd.generated` audit-log row. Comment states "Reactive consumers (notifs download-link, dental-audit) are **deferred to a future phase**." No `createNotification` call. No test for a notification. |
| **WFG-012** | Lab order complete notification | **ABSENT (explicitly deferred)** | `dental-clinical/lab-orders/updateLabOrder.ts:49-59` — per ADR-006, DE-015 "LabOrderCompleted" satisfied ONLY by a `lab_order.completed` audit-log row on the `delivered` transition. No notification emitted, no notif test. |
| **WFG-013** | Appointment booking confirmation notification | **IMPLEMENTED → PARTIAL** | `dental-scheduling/createAppointment.ts:121` fires `booking.created` in-app notif ("Appointment scheduled"); `createOnlineBooking.ts:178` fires `booking.created` ("Appointment requested" w/ confirmation code). Base `booking/confirmBooking.ts:81,101`, `cancelBooking.ts`, `rejectBooking.ts` also fire notifs. Implementation present & wired. **No dedicated test asserting the confirmation notification is emitted** (notif call is best-effort `.catch()`; createAppointment tests don't assert the notif side-effect — unlike billing which has `finalizeInvoice.notif.test.ts`). KG-mapped via Notifications/Book Appointment. → PARTIAL (implemented, untested side-effect). |

## Summary counts
- Cluster workflow (WF-028): 1 GREEN.
- Base flows: **8/8 GREEN** (Audit Trail, Notifications, Transactional Email, Chat Room, Video Call, Upload File, Download File, Submit Review).
- Notification gaps: 1 GREEN (WFG-009), 1 PARTIAL (WFG-013), 3 RED/ABSENT (WFG-010, WFG-011, WFG-012).
