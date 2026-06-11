# AHA Fix Report: Case Presentation — Batch B (Signed-acceptance viewer) + Batch A deferred

**Executed:** 2026-06-12 · **Prompt:** `04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Batches:** B (FIX-002) shipped; A (FIX-001 journey) deferred (rationale below); C (doc) + FIX-003 (blocked) not in scope.

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

## Batch A (FIX-001 present→sign→accept journey) — DEFERRED

**Deferred this pass.** Rationale: the journey is a browser-level **regression pin on a flow the audit already graded PASS** (live-verified working). Executing it requires booting the full stack (`bun run dev` app+API via Playwright `webServer`) + `bun run db:reseed` through HTTP + MinIO, and historically the journey suite is selector-sensitive and time-consuming to green — high risk of a budget overrun that would leave the module half-done (against the session's explicit stop-guidance). The signed-acceptance read-back (Batch B) is the substantive, decision-free completion and is fully pinned by component + panel tests; the present→sign→accept chain is already covered piecewise by existing journeys (09 plan-versioning, 08 informed-refusal) and the component layer.

**Remaining work (a clean future pass):** add `apps/dentalemon/tests/e2e/journeys/19-case-presentation-accept.journey.spec.ts` modeled on journey 08 — `pinAuth('dentist')` → present a plan from the plans sheet → patient view renders ₱ phases → sign (signature-pad) → accept → independent API read asserts `decision='accepted'` + the new viewer's signed record; reject leg asserts `decision='rejected'` + reason. Low product-code risk; test-only.

## Not implemented (per plan §10/§11)

FIX-003 printable estimate (blocked: Q1 confirmation + dental-billing shared print utility); FIX-004 MODULE_SPEC (Batch C, doc-only); public patient link, image overlay, new FSM states; removing GET-write telemetry (documented-intentional).

## Decision queue

| Item | Note |
| --- | --- |
| **FIX-001 journey** | Deferred (rationale above); component/panel tests are the interim proof. |
| SDK codegen: `CasePresentationAggregate.presentation.decision` (+ other optional+nullable fields) lose `\| null` | Platform codegen drift (openapi-ts treats optional+nullable as `?: T`); FE keeps defensive `?? null`. Same class noted for perio M8. |
| Drawn-signature image read-back | Needs backend exposure of `TreatmentPlanApproval.signatureData` on a read path (out of FE-only scope). |
| Q2 viewer placement | Default adopted: panel renders the read-back for decided presentations. |
