# Workspace Toolbar — UX/UI Gap Fixes

**Source:** cold-start assessment of the workspace toolbar (Imaging · Perio · Occlusion ·
Recalls · Plans · Export, plus ceph). Wiring is sound across all features; ceph tracing and
perio are standards-conforming and self-serve. The gaps below are the UX/UI friction that
blocks an untrained solo dentist. **Read-only review found no regressions** — these are additive.

**Toolbar location:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:364-443`.

---

## ⚠️ Conflict note — sequence matters

Two of the six fixes live in `routes/_workspace/$patientId.tsx`, the **same file that renders
the timeline carousel + chart area**. Run **Phase 1 first** (3 isolated files, zero overlap),
and only run **Phase 2** once the carousel/timeline/chart work on that route has landed.

| Phase | Items | Files | Overlap with carousel work |
|---|---|---|---|
| **1** | Plans create · Imaging thumbnails · Recall chips | 3 isolated component files | None |
| **2** | Toolbar promote · Export hint · Perio hint | `$patientId.tsx` (shared route) | High — do after carousel lands |

---

## Phase 1 — isolated (safe anytime)

### 1.1 Plans: add "New plan" (v1 blocker — dead-end empty state)
- **File:** `apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx`
- **Now:** empty state says *"Create one to track…"* but there is no create affordance.
  `useTreatmentPlans` already exposes `createPlan` (`hooks/use-treatment-plans.ts:45,63`) — it's
  simply never destructured or wired.
- **Change:** destructure `createPlan, isCreating` from the hook; add a "New plan" button in the
  sheet header (mirror RecallsSheet/OcclusionSheet `New …` pattern) **and** a primary button in
  the empty state. One click creates a `draft` plan, then the existing FSM rows take over.
- **Open question (must resolve):** `createTreatmentPlan` requires `providerId`
  (`services/api-ts/src/handlers/dental-patient/treatment-plans/createTreatmentPlan.ts:20`;
  `totalEstimateCents/notes/cdtCodeSetYear` optional). Resolve the current provider id from the
  session/org-context (the same identity used elsewhere in the workspace) — do **not** add a
  provider picker. If no clean source exists, pass the authenticated user's person id and confirm
  the backend accepts it.
- **Tests:** extend `treatment-plans-sheet.test.ts` — empty state renders a create button; click
  calls `createPlan`; button disabled while `isCreating`.

### 1.2 Imaging: thumbnails + capture date in list rows (v1 blocker)
- **File:** `apps/dentalemon/src/features/imaging/components/patient-image-list.tsx:181-290`
- **Now:** rows show `fileName` + modality text only — you pick X-rays by reading filenames, with
  no date. Diverges from radiograph-viewer convention (dated thumbnail strip).
- **Change:** in the non-volume `<li>`, prepend a small thumbnail (`<img>` `w-10 h-10 object-cover
  rounded`) using `item.downloadUrl` (type: `downloadUrl: string \| null`,
  `use-imaging-studies.ts:27`); when null, render a neutral placeholder icon (never the bare
  filename as a src — that's the silent-blank bug already guarded in the overlay). Add the capture
  date `new Date(item.createdAt).toLocaleDateString()` (`use-imaging-studies.ts:26`) under the
  modality line. Leave `CbctStudyCard` (volumes) and the FMX mount untouched.
- **Tests:** add `patient-image-list.test.tsx` (none exists) — row renders a thumbnail when
  `downloadUrl` set, placeholder when null, and shows the formatted `createdAt`.

### 1.3 Recalls: interval chips (3/6/12-mo) — kill manual date math
- **File:** `apps/dentalemon/src/features/workspace/components/recalls-sheet.tsx:204-258`
- **Now:** form sends `type/dueDate/notes`; dentist hand-types every due date.
- **Change:** add three quick chips above the Due Date input that set `formDueDate = today + N
  months` (3/6/12). Pure FE date math — keep it as a tiny local `addMonths(isoToday, n)` helper in
  the component (clamp day-of-month). The input stays editable for overrides.
- **Scope guard:** the backend `createRecall` accepts `intervalMonths` for recurrence
  (`createRecall.ts:44`) **but the generated SDK request type does not expose it** (no
  `intervalMonths` in `packages/sdk-ts/generated`). Do **not** try to send it — that needs a
  TypeSpec/OpenAPI change, out of scope. Chips only pre-fill `dueDate`.
- **Tests:** extend `recalls-sheet.test.ts` — clicking the "6 mo" chip fills `dueDate` to
  today+6mo; field remains editable.

---

## Phase 2 — shared route file (run AFTER carousel work lands)

All three edit `apps/dentalemon/src/routes/_workspace/$patientId.tsx`.

### 2.1 Promote the toolbar from muted text links to real buttons
- **Lines:** `364-443` (the year-filter row). Every trigger is
  `text-xs font-medium text-muted-foreground hover:underline` — visually indistinguishable from
  body text, easily missed on cold start.
- **Change:** give each trigger a recognizable button affordance — icon + label, subtle
  border/background, clear hover/active. Keep **every `data-testid`** unchanged
  (`imaging-tab-btn`, `perio-tab-btn`, `occlusion-tab-btn`, `recalls-tab-btn`, `tasks-tab-btn`,
  `treatment-plans-tab-btn`, `chart-export-btn`) so E2E stays green. Reuse existing icons already
  imported across the sheets (`CalendarClock`, `ClipboardList`, `Activity`, etc.). Respect the
  font-size ratchet (rem tokens, not px).
- **Tests:** existing `$patientId.test.ts` + E2E by testid should pass unchanged; add an assertion
  that triggers are buttons with accessible names.

### 2.2 Export: show disabled + hint instead of hiding (mirror Perio)
- **Lines:** `433-443`. Today the Export button only renders when `currentVisitId` is set, so it
  silently vanishes with no explanation.
- **Change:** always render it; when `currentVisitId === null`, set `disabled` + `title="Select a
  visit to export the chart"` (same pattern as the Perio trigger at `381-391`).

### 2.3 Perio: inline disabled hint (touch devices don't hover)
- **Lines:** `381-391`. The disabled reason lives only in a `title` tooltip, invisible on
  iPad/touch (the primary device).
- **Change:** when disabled, surface the reason inline (small helper text near the row, or
  `aria-describedby`) in addition to the `title`.

---

## Phase 1b — sharper gaps from the cold-start review (isolated unless noted)

These surfaced from the start-to-finish journey trace. Most are in isolated component files
(Phase-1-safe); only N1's toolbar label touches the shared route.

- **N1. "Plans" vs "Treatment Plan" naming collision.** Toolbar "Plans" = plan-document FSM
  (`treatment-plans-sheet.tsx`); top-bar "Treatment Plan" = diagnosed-treatment list with Accept
  (`treatment-plan-tab.tsx`). A cold dentist can't tell which door to use. **Fix:** relabel the
  toolbar trigger (`$patientId.tsx:423-431` — **SHARED route, Phase 2**) to something like "Plan
  docs"; leave the top-bar "Treatment Plan" as the working list. Pure label change, keep the
  `treatment-plans-tab-btn` testid.
- **N2. "Present" means two things in the Plans sheet.** FSM transition label "Present"
  (draft→presented, `treatment-plans-sheet.tsx:55` TRANSITION_LABELS) sits next to "Present to
  patient" (`:133`). **Fix:** rename the FSM label to "Mark presented." Isolated.
- **N3. Imaging Compare is a hidden affordance.** The "Compare ▶" button only renders after
  exactly 2 checkboxes are ticked (`patient-image-list.tsx:82-95`); nothing tells the dentist the
  checkboxes do anything. **Fix:** always show a disabled "Compare (select 2)" button that enables
  at 2. Isolated. (Pairs with item 1.2 in the same file — do together.)
- **N4. "Present to patient" silently vanishes for non-presenting roles.** Gated to `undefined`
  when `!canPresent` (`treatment-plans-sheet.tsx:319`) with no explanation. **Fix:** render it
  disabled with title "Requires treatment-coordinator role." Isolated.
- **N5. Perio "16/16" reads as "exam complete."** Gate is `MIN_ADULT_READINGS = 16`
  (`perio-chart-overlay.tsx:48,314`) but a full-mouth exam is ~28 teeth; maxing at 16 implies done.
  **Fix:** label the counter "minimum 16 to complete," not "16/16." Isolated.
- **N6. "FMX mount" is unexplained jargon** for a GP (`patient-image-list.tsx:79`). **Fix:** add
  `title="Full-mouth X-ray layout"`. Isolated. (Same file as 1.2/N3.)

**Phase mapping:** N2-N6 are isolated → run with Phase 1. N1's toolbar label → Phase 2 (shared
route). Plans is the weakest end-to-end surface — items 1.1, N1, N2, N4 all land there.

## Phase 1c — layout & visual-quality gaps (from the iPad screenshot audit)

Layout/use-of-space findings the intuitiveness reviews under-weighted. All isolated files →
Phase 1, EXCEPT none touch `$patientId.tsx`. The codebase already ships a right-side drawer
(`@monobase/ui` `Sheet side="right"`, used at `patient-image-list.tsx:102`) — reuse it.

- **L1. Imaging empty canvas wastes ~70% and shows a no-op prompt.** With zero images the right
  pane says "Select an image to view" (`workspace-imaging-overlay.tsx:88`) though nothing is
  selectable. **Fix:** make that copy conditional on `allItems.length > 0`; when empty, host the
  primary empty state / upload dropzone in the canvas. Phase 1. (Pairs with 1.2.)
- **L2. Imaging upload CTA is a small rail-header button, not co-located with the empty state**
  (`patient-image-list.tsx:98,163`). **Fix:** surface a prominent upload dropzone in the empty
  canvas; keep the rail button as secondary. Phase 1.
- **L3. Imaging viewer has no back/prev from a drilled-in state.** Compare/Ceph can only be left
  via × which closes the whole overlay (`workspace-imaging-overlay.tsx:42,59-74`). **Fix:** add a
  "← Back to images" control when a comparison/viewer is active. Phase 1.
- **L4. Four surface patterns for one toolbar.** Full-screen overlay (Imaging/Perio), centered
  modal (Export), hand-rolled bottom sheet (Recalls/Occlusion/Tasks/Plans), right drawer (imaging
  Upload). **Fix:** standardize — overlay for Imaging/Perio, right drawer for the list features,
  modal for Export. Phase 1.
- **L5. Bottom sheet covers the chart on the primary iPad/desktop device.**
  `fixed bottom-0 left-0 right-0` in `recalls-sheet.tsx:162`, `occlusion-screening-sheet.tsx:137`,
  `treatment-plans-sheet.tsx:269`, `tasks-sheet.tsx:157`. **Fix:** convert the four list features
  to `Sheet side="right"` (chart stays visible); keep bottom sheet only as the narrow-screen
  fallback. Phase 1.
- **L6. Empty-state CTA not co-located.** "New …" sits in the sheet header while the empty body
  only describes the gap (`recalls-sheet.tsx:184` vs `:287`; `occlusion-screening-sheet.tsx:154`
  vs `:297`; `tasks-sheet.tsx:181` vs `:294`). **Fix:** put the primary New-X button inside the
  empty state. Phase 1. (Plans' missing CTA is item 1.1.)
- **L7. Full-width sheet wastes horizontal space on iPad landscape** for small forms (same four
  sheet files). **Fix:** the right-drawer conversion (L5) resolves this — constrain to a fixed
  drawer width (`w-[360px]` like the imaging editor). Phase 1.

**Note:** L1-L3 land in the imaging files (batch with 1.2/N3/N6). L4-L7 are the bottom-sheet →
right-drawer conversion across the four list sheets — do as one coherent change, preserving every
`*-sheet` `data-testid` and `role="dialog"`/a11y wiring.

## Verify gate (per project standards + repo notes)

Run from repo root, all must pass with no new warnings/regressions:

```bash
bun run typecheck
bun run lint                 # pre-commit allows eslint --max-warnings 200; don't add warnings
DATABASE_URL=postgres://…/monobase_test bun run test   # NEVER `bun test <path>` (pollutes clone template)
bun run check:boundaries     # required — not just typecheck/lint/test
```

- Tests-before-code (Vertical TDD): write the failing component test, then implement.
- Font-size ratchet is enforced in pre-commit — use rem tokens / `unknown`+cast where needed.
- FE verification: prefer a Playwright E2E pass over manual checkpoints.

## Out of scope (don't build)
- Recall `intervalMonths` recurrence wiring (needs spec change).
- Perio suppuration/mobility/plaque entry; occlusion edit/delete; structured midline.
- Ceph and Export internals — both already conform.
