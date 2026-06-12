# AHA Fix Report: Case Presentation — MODULE COMPLETE (Batch A + B + C)

**Executed:** 2026-06-12 · **Prompt:** `04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Batches:** A (FIX-001 journey, `4a30d2b8`), B (FIX-002 viewer, shipped 2026-06-12 earlier this session), C (FIX-004 MODULE_SPEC, `7ba6751f`) all shipped. FIX-003 (printable estimate) blocked/out-of-scope (Q1 confirmed NO separate build — covered by invoice/plan flows per product-decisions §4 Batch B). **Module closed.**

## Batch A (FIX-001 — present→sign→accept + reject journey) — SHIPPED `4a30d2b8`

The historically-broken highest-revenue flow now has a browser-level regression pin: `apps/dentalemon/tests/e2e/journeys/19-case-presentation-accept.journey.spec.ts` (registered J19 in the harness roster). It DOM-drives both legs end-to-end and asserts the goal state via an INDEPENDENT read of the durable presentation aggregate:
- **Accept leg:** open the Plans sheet → "Present to patient" on a `presented` plan → patient types signer name + draws the signature stroke → Accept & Sign → independent read asserts `presentation.decision='accepted'` + `signerName` persisted + `plan.status='approved'`; the UI flips to the FIX-002 signed-acceptance viewer.
- **Reject leg:** a separate plan (a `draft` transitioned through the UI) → "Present to patient" → Decline with reason → independent read asserts `decision='rejected'` + the typed reason persisted + `plan.status='rejected'`.

**§15 finding (corrected the fix-ready premise "seed already has 4 plans — reuse"):** the demo seed (`scripts/seed-demo.ts`) creates ZERO plan headers; the 4 cp plans across the FSM come from `services/api-ts/scripts/seed-supplement.ts` (`cpPlanSpecs`), DB-direct. **Those specs bind each plan to a patient by `allPatients` PHYSICAL-ROW index (`select * from patient` with no `orderBy`), which is NOT the demo P0..P9 insertion order** — on this machine `presented→Maria`, `draft→Miguel`, `rejected→Ana`, `approved→Carlos`. So the journey **discovers** its targets by plan STATUS via the independent reader (never hardcodes a patient), making it robust across environments. **Mutation-tested non-vacuous:** removing the signature stroke (accept becomes impossible) turns J19 RED. Verified GREEN on a clean reseed (9.3s) and alongside J08/J09 on one reseed (J09+J19 green).

**ROADMAP FLAG (pre-existing, NOT this batch):** the same physical-row binding makes `seed-supplement` cp plans land on whichever patient Postgres returns first — on this machine `cp-rejected`'s linked `diagnosed` implant (D6010 #47) lands on **Ana Reyes**, the patient J08 hardcodes, and J08 fails (its decline scenario reads no `declined` treatment). J08 fails in isolation, first, on a fresh reseed, importing none of this batch's code → **pre-existing, not a J19 regression.** Durable fix = bind `cpPlanSpecs` to patients **deterministically by displayName** (not `allPatients[idx]`) so they stop colliding with the hardcoded-patient journeys (J08/J09); J19 already sidesteps it via status-discovery.

## Batch C (FIX-004 — thin MODULE_SPEC) — SHIPPED `7ba6751f`

Authored `docs/product/modules/case-presentation/MODULE_SPEC.md` (documents shipped behavior, verified against the handlers): present/accept/reject FSM + the linked-items accept precondition, approve-vs-accept parity (G3), option-acceptance single-ownership (Q3 = owned by case-presentation; visit/billing consume), GET-write view telemetry as documented-intentional (GAP-6, do-not-fix), print/email estimate = no separate build (Q1/FIX-003), permissions (present = clinicians+coordinator; accept/reject = broader chairside set), and the §11 do-not-build set.

---

## (historical) Batch B execution detail below

## What shipped (FIX-002 — GAP-1 signed-acceptance read-back; also closes dental-visit GAP-3)

E-sign acceptance was **write-only**: after the moment of signing, the legal artifact (who accepted, when, and the immutable itemized plan they accepted) was invisible. This makes it visible — FE-only, read-only, **no backend / TypeSpec / SDK regen** (consumes the already-fetched case-presentation aggregate). Per the orchestrator bundle decision, **case-presentation owns this viewer**; it closes both this module's GAP-1 and dental-visit's GAP-3 (the visit side now only needs consumption wiring, if any).

- **`accepted-plan-viewer.tsx`** (new, presentational) — given the aggregate, renders the **signed-acceptance record** (accepted: signer name + formatted decision timestamp; rejected: timestamp + rejection reason) + the **immutable itemized plan** (phases/items via `formatCents` + grand total). Strictly read-only; undecided → an honest "no signed acceptance yet" state.
- **`use-case-presentation.ts`** — extended the view-model **additively** with `signerName` / `decisionAt` / `rejectionReason` (mapped from the SDK aggregate's presentation record; previously dropped). The interactive flow is unaffected.
- **`case-presentation-panel.tsx`** — entry point (Q2 default): when `presentation.decision !== null` the panel renders the read-back viewer instead of the interactive sign controls, so the signed record is visible whenever a decided presentation is opened (from the plans-sheet present-flow route or presentation history). The interactive `CasePresentationView` is unchanged for undecided presentations.

The drawn-signature **image bytes** live on `TreatmentPlanApproval.signatureData` (not on the case-presentation aggregate); surfacing them would need a read path that isn't FE-reachable today. The legally-operative signature (typed signer name + intent + timestamp, e-sign / UETA-ESIGN) **is** surfaced. The drawn-image enhancement is a deferred follow-up (requires backend read exposure — out of this FE-only scope).

## Adversarial review → fixes folded in (focused code-reviewer, bypassPermissions)

No P0. Verified the decision gate is atomically consistent (the backend `decide()` writes status+decision together), the `decisionAt` string-cast is safe, the viewer is truly read-only, and null-safety holds. Two real items fixed:

| Finding | Sev | Disposition |
| --- | --- | --- |
| A *second* `presentation` override in `case-presentation-view.test.tsx` omitted the new required fields → `undefined` not `null` (hidden: test files excluded from typecheck) | P2 | **Fixed** — added `signerName/decisionAt/rejectionReason: null` |
| Viewer grand-total not asserted coherent with the rendered line items (documented summary-vs-body bug class) | P3 | **Fixed** — added a DOM-derived `assertTotalExplainedByRows` coherence guard |
| SDK `CasePresentationAggregate.presentation.decision` type lacks `\| null` (codegen drops the OpenAPI `nullable:true`) | P1 | **Tracked, not a FE defect** — the `?? null` guards handle it correctly; do not remove them. → decision queue (platform codegen) |

## Verification (fresh runs)

| Layer | Result |
| --- | --- |
| `accepted-plan-viewer.test.tsx` (record / itemized plan / declined / undecided / coherence) | pass |
| `case-presentation-panel.test.tsx` (decided→viewer, rejected→viewer, undecided→interactive) | pass |
| Full case-presentation suite | **12 pass / 0 fail** |
| Workspace regression sweep | **766 pass / 0 fail** |
| Typecheck (root FE + `@monobase/api-ts`) | both **exit 0** |
| RED→GREEN | viewer import-RED → GREEN; panel routing pinned |

## Batch A (FIX-001 present→sign→accept journey) — was DEFERRED, now SHIPPED `4a30d2b8` (see top of report)

**(Historical rationale from the Batch-B pass — superseded; the journey shipped 2026-06-12.)** Rationale at the time: the journey is a browser-level **regression pin on a flow the audit already graded PASS** (live-verified working). Executing it requires booting the full stack (`bun run dev` app+API via Playwright `webServer`) + `bun run db:reseed` through HTTP + MinIO, and historically the journey suite is selector-sensitive and time-consuming to green — high risk of a budget overrun that would leave the module half-done (against the session's explicit stop-guidance). The signed-acceptance read-back (Batch B) is the substantive, decision-free completion and is fully pinned by component + panel tests; the present→sign→accept chain is already covered piecewise by existing journeys (09 plan-versioning, 08 informed-refusal) and the component layer.

**Remaining work (a clean future pass):** add `apps/dentalemon/tests/e2e/journeys/19-case-presentation-accept.journey.spec.ts` modeled on journey 08 — `pinAuth('dentist')` → present a plan from the plans sheet → patient view renders ₱ phases → sign (signature-pad) → accept → independent API read asserts `decision='accepted'` + the new viewer's signed record; reject leg asserts `decision='rejected'` + reason. Low product-code risk; test-only.

## Not implemented (per plan §10/§11)

FIX-003 printable estimate (blocked: Q1 confirmation + dental-billing shared print utility); FIX-004 MODULE_SPEC (Batch C, doc-only); public patient link, image overlay, new FSM states; removing GET-write telemetry (documented-intentional).

## Decision queue

| Item | Note |
| --- | --- |
| **FIX-001 journey** | SHIPPED `4a30d2b8` (J19, both legs GREEN + mutation-tested). |
| **seed-supplement cp-plan→patient binding** | Roadmap: bind `cpPlanSpecs` deterministically by displayName (not `allPatients[idx]`) — the physical-row binding collides with hardcoded-patient journeys (currently breaks J08 by landing `cp-rejected` on Ana Reyes). |
| SDK codegen: `CasePresentationAggregate.presentation.decision` (+ other optional+nullable fields) lose `\| null` | Platform codegen drift (openapi-ts treats optional+nullable as `?: T`); FE keeps defensive `?? null`. Same class noted for perio M8. |
| Drawn-signature image read-back | Needs backend exposure of `TreatmentPlanApproval.signatureData` on a read path (out of FE-only scope). |
| Q2 viewer placement | Default adopted: panel renders the read-back for decided presentations. |
