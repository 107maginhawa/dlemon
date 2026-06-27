# Per-Tooth Panel — Phase 2 Plan (in-panel editing) — 2026-06-27

**Status:** PLAN (phase-0 discovery synthesized; no code written this run except this doc).
**Branch context:** `feat/carousel-cumulative-timeline`. Phase 1 shipped at `ffcb454b`
(Treatment Breakdown is now a stacked CARD list; panel read-only).
**Source of truth (do not re-derive):**
- [`../CAROUSEL_TIMELINE.md`](../CAROUSEL_TIMELINE.md) — two-layer model, invariants I1/I2/I3, locked vocabulary.
- [`per-tooth-panel-audit-2026-06-27.md`](./per-tooth-panel-audit-2026-06-27.md) — Phase 2 = P2-C / P2-D / P2-E.
- [`per-tooth-panel-card-layout.md`](./per-tooth-panel-card-layout.md) — Phase-1 decision + Phase-2 backlog.

**Goal:** let a dentist edit a tooth's treatment entries mid-visit (advance status,
decline, dismiss, fix mistakes) directly from the per-tooth slideout's card list —
gated, before the chart closes — without leaving the panel to the separate
`treatment-table` surface.

---

## 1. Scope — what's IN, and what ALREADY EXISTS vs is MISSING

Three audit items, all read-path / FE-placement work on top of an already-complete
backend mutation surface. **No new backend route, no new mutation logic.**

### P2-C — Surface the treatment `id` per card (additive, TypeSpec-governed)

| | Status |
|---|---|
| **Exists** | `ToothHistoryEntry` carries `visitId, visitDate, toothNumber, state, conditionCode?, treatmentCdtCode?, treatmentDescription?, surfaces?, treatmentStatus?, treatmentPriceCents?, eventKind, syncStatus?` (`specs/api/src/modules/dental-visit.tsp:522-544`). The handler already has the treatment `t` in scope in the emit loop (`getToothHistory.ts:91-106`). |
| **Missing** | The `treatmentId` field itself. It is deliberately omitted today, so the FE has no handle to PATCH. **This is TypeSpec-governed** — add `treatmentId?: UUID;` to the model, run codegen, then populate `treatmentId: t.id` in the handler emit loop. **Purely additive to the OUTPUT** — does NOT touch the emit rule's flag/no-flag decision (`getToothHistory.ts:49-124`). |

### P2-D — In-panel Advance / Decline / Dismiss (+ consent gate)

| | Status |
|---|---|
| **Exists (backend)** | The ENTIRE mutation surface. ONE polymorphic endpoint `PATCH /dental/visits/{visitId}/treatments/{treatmentId}` covers all three actions (advance/decline/dismiss). FSM two-step, consent gate, dismiss soft-hide, decline reason-gate all enforced server-side. No new route, no new handler. |
| **Exists (FE hooks)** | `useMarkTreatmentDone` (two-step advance), `useUpdateTreatment(visitId)` (PATCH), `DismissTreatmentPopover` / `DeclineTreatmentPopover` (`treatment-row-popovers.tsx`, already reason-gated + `min-h-[44px]`). All already imported and proven in `treatment-table.tsx`. |
| **Missing** | (1) `entry.treatmentId` on the card (blocked by P2-C). (2) Per-card action row placement in `tooth-overview-step.tsx`. (3) `readOnly` + `visitId` props threaded from `tooth-slideout.tsx` into `ToothOverviewStep` (NOT passed today — `tooth-slideout.tsx:332-341` passes toothNumber/patientId/surfaceConditions/focus/condition/classification only). (4) An "Edit mode" toggle + inline 422 surfacing (consent). |

### P2-E — `readOnly` hard-gate + append-only amendment for closed charts

| | Status |
|---|---|
| **Exists (~80%)** | Props `readOnly`, `visitId`, `originalRecordId` plumbed (`tooth-slideout.tsx:53-57`); derived `canAmend = !!(readOnly && visitId && originalRecordId)` (`:157`); `AmendmentsList` renders when `readOnly && visitId` (`:431`); `AmendmentForm` renders when `readOnly && showAmendment && visitId && originalRecordId` (`:438-450`); footer "Add Amendment" when `canAmend` (`:463`); footer mode-switch on `readOnly` (`:454`). Backend amendment subsystem exists (POST/GET/approve). |
| **Missing** | (1) **No VISIBLE locked banner** — `readOnly` only swaps the footer and hides `FindingsPanel`; the ledger looks identical open vs locked, so a clinician can't tell edits are disabled (audit Dim-2 / UX gap #7). (2) The new edit-mode toggle + per-card actions must be gated behind `!readOnly` so a closed chart NEVER shows Advance/Decline/Dismiss. (3) `originalRecordType="tooth_treatment"` (`:442`) is a free-form passthrough the BE does NOT validate — to reconcile (see §2 amendment). (4) Per-treatment amendment targeting (once `treatmentId` exists) — OPTIONAL stretch, not required for P2. |

**Out of scope (leave inert):** finding cards (`eventKind === 'finding'`) get no
Advance/Decline/Dismiss — there is no treatment to PATCH; a future "Resolve/Convert"
routes to `FindingsPanel` and is explicitly P3. `synthState` fabrication (P3-D) is NOT
touched — it lives inside the forbidden emit path.

---

## 2. Backend findings (file:line — verified in discovery)

**Status endpoint (single, polymorphic).** `PATCH /dental/visits/{visitId}/treatments/{treatmentId}`
— route registered `services/api-ts/src/generated/openapi/routes.ts:2404` (auth roles
`["user"]`, zValidator on `UpdateDentalTreatmentParams` + `UpdateDentalTreatmentBody`);
handler `services/api-ts/src/handlers/dental-visit/treatments/updateDentalTreatment.ts:22`,
keyed off `body.status`:
- **Advance** → generic patch path (`:124-138`); performed branch `:70-77,126`.
- **Decline** → `status='declined'` branch (`:100-121`); requires `body.refusalReason` or 422 `REFUSAL_REASON_REQUIRED`.
- **Dismiss** → `status='dismissed'` branch (`:80-97`); uses `body.dismissReason` (default `'Dismissed'`).

**FSM enforcement (two-step).** `updateDentalTreatment.ts:57-67` reads
`TREATMENT_TRANSITIONS[currentStatus]`; an out-of-list newStatus throws
`BusinessLogicError('Invalid status transition…')` → HTTP 422. Transition map (single
source of truth) `services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts:174-181`:
`diagnosed:['planned','dismissed','declined']`, `planned:['performed','dismissed','declined']`,
`performed:['verified','dismissed']`, `verified:['dismissed']`, `dismissed:[]`, `declined:[]`.
**No `diagnosed→performed` edge** → a single jump 422s (proven `treatment-fsm-http.test.ts:169`).
Field-edit immutability gate at `:48-55` (422 `TREATMENT_IMMUTABLE` once performed/verified);
visit-lock gate `:44-46` (422 `VISIT_IMMUTABLE` for completed/locked visits).
→ **Implication:** the panel MUST walk `diagnosed → PATCH{planned} → PATCH{performed}`
(exactly what `use-mark-treatment-done.ts` already does); never offer a single set-to-performed
on a `diagnosed` row.

**Consent gate.** `updateDentalTreatment.ts:70-77`: when `body.status==='performed'`,
calls `hasSignedConsentForVisit(db, treatment.visitId)`; false → `BusinessLogicError(…,
'TREATMENT_CONSENT_REQUIRED')` → 422. Checked ONLY on `→performed`. Server-side and
unconditional — any in-panel advance-to-performed inherits it; the panel only needs to
**surface the 422 inline** (reuse `treatment-table`'s copy).

**TypeSpec shape (P2-C).** `ToothHistoryEntry` `specs/api/src/modules/dental-visit.tsp:522-544`,
no treatment id today. Add `treatmentId?: UUID;` (optional — finding rows have no treatment);
codegen via `cd specs/api && bun run build` then `cd services/api-ts && bun run generate`
(NEVER hand-edit generated files); populate `treatmentId: t.id` at `getToothHistory.ts:91-106`.

**Amendment path (closed-chart correction).** `POST /dental/visits/{visitId}/amendments`
(`createAmendment.ts:50`), GET list, POST approve. TypeSpec `dental-clinical.tsp:811-845`;
`CreateAmendmentRequest` `:548` (`patientId, originalRecordType:string FREE-FORM,
originalRecordId:UUID, reason, content`). Role-gated to `dentist_owner`/`dentist_associate`
(`:66`). **Gap:** `createAmendment.ts:29-48` only validates in-module record types
(prescription/consent/labOrder/medicalHistory); a `'tooth_treatment'`/`'treatment'` type
passes UNCHECKED (`:44-46 default:true`) — no FK/existence guarantee. FE already sends
`originalRecordType="tooth_treatment"` (`tooth-slideout.tsx:442`). Closed-visit correction =
create a treatment-typed amendment, NEVER an in-place status PATCH (which 422s `VISIT_IMMUTABLE`).

**`performedAt` (backdate gotcha).** `updateDentalTreatment.ts:126` hardcodes
`patch.performedAt = new Date()`; the API does NOT accept a client `performedAt`, and
performed/verified rows are immutable afterward (`:48-55`). `deriveLayerSetsAsOf`
(`chart-export.ts:160-169`) paints `Treated` only on cards dated `≥ performedAt`.
→ **In-panel advance-to-performed stamps server-now.** Correct for live chairside work
done TODAY (the dentist IS performing it now; I2 "Treated is sticky" holds going forward).
**Cannot record historical/backdated work** — there is no HTTP path to set a past
`performedAt` (the seed had to use a direct-DB backdate pass; `CAROUSEL_TIMELINE.md §6.2`).
The plan does NOT promise chairside backdating.

**Dismiss semantics.** `'dismissed'` is a REAL terminal FSM status (`treatment.schema.ts:170,179`),
reachable from every non-terminal state + performed. PATCH → `repo.dismiss(...)`,
recomputes the plan (dismissed leaves the completion denominator), audits `treatment.dismissed`.
**In the ledger it is a SOFT-HIDE:** `getToothHistory.ts:80-82` filters `t.status!=='dismissed'`,
so a dismissed treatment produces NO row. Same in as-of layers (`CAROUSEL_TIMELINE.md:82`:
"drops from all as-of layers and the ledger"). → **An in-panel Dismiss must make the card
DISAPPEAR after refetch** (do not paint a "Dismissed" badge — the row never reaches the
ledger to be badged). Distinct from `declined` (patient refused; shown gray, non-absorbing,
stays in ledger).

---

## 3. Interaction model + card-edit mock

**Read is the default.** The card list stays a pure read surface until the clinician
deliberately enters edit mode — no always-live mutation controls (protects against
accidental gloved taps mutating a clinical record; audit Q4).

**Enter edit mode:** a single **"Edit" toggle in the Treatment Breakdown card-list header**
(`tooth-overview-step.tsx:280`, next to the `<h3>`), shown only when
`!readOnly && visitId && (any eventKind==='treatment' row exists)`. Tapping it flips a local
`editing` boolean and reveals a per-card action row on every editable (treatment) card.
**Exit:** the same toggle reads "Done" (collapses action rows; nothing to commit — each
action is its own atomic PATCH on confirm). Esc still closes the whole slideout (`useSheetA11y`).

**Per-card actions** (only in edit mode, only `eventKind==='treatment'`):
- **Advance (two-step, FSM-safe):** one primary button labeled by next state — **"Mark
  Planned"** when `status==='diagnosed'`, **"Mark Done"** when `status==='planned'`. Calls
  `useMarkTreatmentDone.markDone(entry.treatmentId, visitId, entry.treatmentStatus)`
  (walks diagnosed→planned→performed as two PATCHes; never single-jumps → no 422 BR-006).
  `→performed` inherits the server consent gate; on 422 `TREATMENT_CONSENT_REQUIRED` surface
  the SAME inline copy `treatment-table` uses ("Consent required — ask patient to sign before
  completing."). Hidden when performed/verified (show static green "✓ Treated"). Label so the
  clinician understands it records work done TODAY (`performedAt = now`; no chairside backdating).
- **Decline (patient refused):** reuse `DeclineTreatmentPopover`, gated
  `status==='diagnosed' || 'planned'` (matches `treatment-table.tsx:481`). Reason-required.
  Confirm → `useUpdateTreatment(visitId).mutate({…body:{status:'declined',refusalReason}})`.
  Card then shows a gray "Declined" badge (non-absorbing, stays in ledger).
- **Dismiss (mistake-eraser):** reuse `DismissTreatmentPopover`, gated non-terminal. Confirm →
  `body:{status:'dismissed',dismissReason}`. **Row DISAPPEARS** after refetch (getToothHistory
  filters `status!=='dismissed'`); do NOT show a "Dismissed" badge.

**Closed chart (`readOnly===true`):** the Edit toggle and ALL per-card action rows are NOT
rendered (gate on `!readOnly`). Show a small visible banner at the top of the card list —
**"Chart closed — corrections via Amendment"** (`role="status"`, non-interactive) — so the
read-only state is legible, not just an absence of buttons (closes audit Dim-2 / gap #7).
Corrections route to the existing append-only amendment path (`AmendmentsList` + footer
"Add Amendment"), which is 422-proof against `VISIT_IMMUTABLE`.

### Card-edit text mock

**Read mode (today, unchanged):**
```
┌─────────────────────────────────────────┐
│ Jun 27, 2026  B          [Planned]  ₱800 │
│ Periodic oral evaluation                 │
│ Condition: Fractured · State: —          │
└─────────────────────────────────────────┘
```

**Edit mode (header "Edit" tapped → action row appears on treatment cards):**
```
┌─────────────────────────────────────────┐
│ Treatment Breakdown            [ Done ]  │  <- header toggle (was "Edit")
├─────────────────────────────────────────┤
│ Jun 27, 2026  B          [Planned]  ₱800 │
│ Periodic oral evaluation                 │
│ Condition: Fractured · State: —          │
│ ┌─────────────┐ ┌─────────┐ ┌─────────┐ │  <- NEW action row, ≥44px each
│ │  Mark Done  │ │ Decline │ │ Dismiss │ │     (status=planned → "Mark Done")
│ └─────────────┘ └─────────┘ └─────────┘ │
│  ⚠ Consent required — ask patient to     │  <- inline only after a 422 on this row
│    sign before completing.               │
├─────────────────────────────────────────┤
│ Jun 17, 2026             [Flagged]       │  <- finding card: NO action row
│ Watchlist                                │
│ Condition: — · State: Watchlist          │
└─────────────────────────────────────────┘
```
Variants: `diagnosed` → primary reads **"Mark Planned"** (first FSM step), Decline + Dismiss
still allowed. `performed`/`verified` → no action row; static green "✓ Treated" where the badge
sits; only Dismiss could optionally appear (FSM performed→dismissed).

**Closed-chart variant (`readOnly=true`):**
```
┌─────────────────────────────────────────┐
│ ⓘ Chart closed — corrections via Amendment│  <- visible banner, no Edit toggle
├─────────────────────────────────────────┤
│ Jun 27, 2026  B          [Planned]  ₱800 │  <- cards render, NO action rows
│ Periodic oral evaluation                 │
│ Condition: Fractured · State: —          │
└─────────────────────────────────────────┘
(footer shows Close + "Add Amendment"; AmendmentsList below)
```

### a11y / glove constraints
- Every new control (Mark Done/Planned, Decline, Dismiss, header Edit/Done) ≥44px tall —
  reuse the proven token (`treatment-table.tsx:433` `min-h-[44px] min-w-[44px]`;
  `treatment-row-popovers.tsx:58` `min-h-[44px]`). Do NOT introduce a smaller target.
- Action row uses `flex-wrap` + ≥8px gap so three ≥44px buttons never crowd at 340px and a
  gloved miss never lands between two targets. iPad full-width (max-lg) is the design center.
- Focus order within a card: date/badge/price → treatment text → condition/state → [action row]
  (actions last — "read then act"). Header Edit/Done precedes the card list in DOM. On entering
  edit mode, move focus to the first card's primary action (or `aria-live` "Edit mode — N
  treatments editable").
- Esc closes the whole slideout (`useSheetA11y`); a stray Esc inside a popover only closes the
  popover (Radix default), not the slideout — confirm in test.
- Closed-chart banner is `role="status"`/text (read once, not a tab stop). Re-check AA contrast
  on the small `[10px]/[11px]` badge text (audit P3-B).

---

## 4. Vertical-TDD execution plan

Per `docs/development/VERTICAL_TDD.md`: tests before code, vertical slice end-to-end. One
slice (P2-C → P2-D → P2-E gate are tightly coupled; ship as one vertical because P2-D cannot
exist without P2-C's id, and the P2-E gate is the same render).

**Step 1 — TypeSpec (P2-C).** Add `treatmentId?: UUID;` to `ToothHistoryEntry`
(`specs/api/src/modules/dental-visit.tsp:522-544`). Optional — finding rows omit it.

**Step 2 — Codegen.** `cd specs/api && bun run build` (TypeSpec→OpenAPI→TS types) then
`cd services/api-ts && bun run generate` (validators/registry/routes). NEVER hand-edit
`services/api-ts/src/generated/openapi/**`.

**Step 3 — Backend tests (RED).** Extend `getToothHistory` tests: a treatment-event entry
now carries `treatmentId === t.id`; a finding-event entry has `treatmentId` undefined.
Assert the emit rule (flag/no-flag count) is UNCHANGED. (Mutation endpoint is already fully
covered — `treatment-fsm-http.test.ts` — no new BE mutation tests needed; optionally add a
regression asserting the consent 422 shape the FE will surface.)

**Step 4 — Backend impl (GREEN).** Populate `treatmentId: t.id` in the emit loop
(`getToothHistory.ts:91-106`). Additive only — do NOT touch the emit rule (`:49-124`),
`deriveLayerSetsAsOf`, or the guard.

**Step 5 — Contract tests (RED→GREEN).** Confirm the Hurl/contract suite still green with the
additive `treatmentId` field (optional response field; existing scenarios unaffected). Add a
scenario asserting `treatmentId` present on a treatment row if the suite asserts shape.

**Step 6 — Frontend tests (RED).** Extend `tooth-slideout.test.ts` / overview-step tests:
- Edit toggle hidden when `readOnly`; visible when `!readOnly && visitId &&` treatment row exists.
- Tapping Edit reveals action rows on treatment cards only (finding cards get none).
- "Mark Planned" on diagnosed; "Mark Done" on planned; performed/verified shows "✓ Treated".
- Decline opens reason popover, gated diagnosed|planned; on confirm card shows gray Declined.
- Dismiss → row removed after refetch (no Dismissed badge).
- Consent 422 → inline copy surfaced on the row.
- `readOnly` → no Edit toggle, no actions, visible "Chart closed — corrections via Amendment"
  banner; footer shows Close + Add Amendment.
- Thread `readOnly` + `visitId` into `ToothOverviewStep` (assert props passed).

**Step 7 — Frontend impl (GREEN).** Thread `readOnly` + `visitId` from `tooth-slideout.tsx`
into `<ToothOverviewStep>`; add the header Edit/Done toggle + local `editing` state; render the
per-card action row (reuse `useMarkTreatmentDone`, `useUpdateTreatment`, `DeclineTreatmentPopover`,
`DismissTreatmentPopover` — NO new mutation logic); add the closed-chart banner. Mirror
`treatment-table`'s `readOnly = readOnlyProp || !visitId` fallback in the slideout (currently
missing — a gap to close).

**Step 8 — E2E.** Playwright journey: open a tooth mid-visit → Edit → Mark Planned → Mark Done
(consent signed) → assert green Treated; Decline a second treatment → gray badge; Dismiss a
third → row gone. Then Complete/lock the visit → reopen tooth → assert NO actions + banner +
Add-Amendment path. Reuse the existing tooth-lifecycle E2E harness.

**Step 9 — Verify gates.**
- **Backend verify gate:** `bun run typecheck` + `bun run lint` + `bun run test`
  (with `DATABASE_URL=…/monobase_test` — NEVER `bun test <path>` directly; pollutes the clone
  template → phantom regressions) + **`bun run check:boundaries`**.
- **Frontend verify gate:** `bun run test` + `bun run typecheck` + `bun run lint` +
  Playwright E2E + live iPad (max-lg full-width) and desktop (lg 340px) screenshots at edit
  mode and closed-chart mode.
- No regressions in `check-timeline-coherence.ts` (run it; expect 0 violations unchanged).

---

## 5. OPEN QUESTIONS — require the user's decision BEFORE building

1. **Dismiss = soft-hide or visible terminal?** Backend already treats dismiss as a soft-hide
   (`getToothHistory.ts:80-82` filters it out; the row DISAPPEARS). The plan above honors that
   (Dismiss → card vanishes, no badge). **Confirm** this is the desired chairside behavior — a
   dentist who taps Dismiss sees the row vanish entirely, which is correct as a "mistake-eraser"
   but could surprise someone expecting a struck-through "Dismissed" entry. (Changing this would
   mean changing the ledger filter — touches the forbidden emit path. Recommend: keep soft-hide.)

2. **`performedAt` backdating (I1/I2/I3 interaction).** In-panel advance-to-performed stamps
   `performedAt = new Date()` (server hardcoded; `updateDentalTreatment.ts:126`). This is correct
   for live work done today and keeps I2 ("Treated is sticky") going forward. **But it cannot
   record historical/backdated work** — there is no HTTP path to a past `performedAt`, and the
   row is immutable afterward. **Is chairside backdating a requirement?** If a dentist needs to
   mark "this filling was actually done last visit," that needs a SEPARATE direct-DB / explicit-
   date mechanism (per `CAROUSEL_TIMELINE.md §6.2`), out of P2 scope. Recommend: P2 ships
   "advance = performed now"; defer backdating as a distinct decision.

3. **Closed-chart correction: amend vs block — and the UX.** Plan = block in-place edit
   (`!readOnly` gate) + route to the append-only amendment path + a visible "Chart closed —
   corrections via Amendment" banner. **Confirm** amendment is the intended correction path
   (vs simply blocking with no correction route). Sub-question: the BE does NOT validate
   `originalRecordType="tooth_treatment"` (free-form passthrough, no FK guarantee) — **do we
   want to (a) reconcile/validate that record type in `createAmendment.ts`, (b) target the
   specific `treatmentId` now that P2-C surfaces it, or (c) ship as-is and defer?** Recommend:
   ship the gate + banner in P2; treat amendment-type validation + per-treatment targeting as a
   follow-up (it is a separate BE change with its own tests).

4. **Logic-vs-presentation ambiguities to confirm before build:**
   - The "Edit mode toggle" pattern (deliberate enter/exit) vs always-live row controls — plan
     chooses deliberate toggle (audit Q4 safety). Confirm.
   - Whether `performed`/`verified` cards should expose the optional `→dismissed` action (FSM
     allows it) or stay fully read-only ("✓ Treated" only). Plan leaves Dismiss optional/omitted
     there; confirm.
   - Finding-card "Resolve/Convert to treatment" is explicitly deferred to P3 (routes to
     `FindingsPanel`); confirm it stays out of P2.

---

## 6. Risk notes — invariants that MUST NOT change

These are LOCKED by `CAROUSEL_TIMELINE.md §5/§7` and the discovery constraints. The plan is
designed to touch NONE of them:

- **The `getToothHistory` emit rule** (`getToothHistory.ts:49-124`) — adding `treatmentId` to the
  OUTPUT is additive/allowed; changing the flag/no-flag decision is NOT. The dismiss filter
  (`:80-82`) stays.
- **`deriveLayerSetsAsOf`** (`chart-export.ts:160-169,184`) — as-of layer precedence
  (proposed > completed > declined > baseline) and the `performedAt`-based Treated painting are
  untouched. In-panel advance flows through the existing PATCH, which feeds these unchanged.
- **`scripts/check-timeline-coherence.ts`** — the guard is not edited; run it post-change to
  confirm 0 violations (the new `treatmentId` field does not affect the raw snapshots it reads).
- **The treatment FSM** (`treatment.schema.ts:174-181`) — two-step diagnosed→planned→performed;
  the panel walks it via `useMarkTreatmentDone`, never single-jumps (would 422). No edge added.
- **The chart-close gate** (`updateDentalTreatment.ts:44-46` `VISIT_IMMUTABLE`; FE `isReadOnly`
  in `$patientId.tsx:194-195`) — closed charts route to amendments; the panel never PATCHes a
  locked visit.
- **Consent gate** (`updateDentalTreatment.ts:70-77`) — unchanged; the panel only surfaces its
  422 inline.
- **`performedAt = new Date()`** server hardcode — unchanged; the plan accepts "advance =
  performed now" and explicitly does NOT promise backdating (see OPEN QUESTION 2).

---

*Phase-0 discovery synthesis. No source files edited, created, or deleted this run; the only
file written is this plan doc. TypeSpec/codegen/impl steps are PLANNED, not executed.*
