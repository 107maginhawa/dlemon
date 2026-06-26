# Workspace Record Tabs — Polish Backlog

Follow-up polish for the workspace record/list tabs (Recalls · Tasks · Occlusion ·
Treatment Plans / Plan docs) after the modal conversion + legibility passes on branch
`ux/workspace-first-slice`. All items are **additive UX/UI polish** — no backend, no
schema, no new deps.

## Standards (read before coding)

- **Vertical TDD** (`docs/development/VERTICAL_TDD.md`): write the failing component
  test first, then implement. Each item below names the test file + assertion.
- **FE test harness gotcha:** `apps/dentalemon/src/test-setup.ts` globally stubs
  `@radix-ui/react-dialog` — its `Content`/`Title` stubs DROP props. So any
  `data-testid` MUST sit on an inner wrapper `<div>`, never on `DialogContent`/
  `SheetContent`. `role="dialog"` comes from the Root stub. Lucide icons used by a
  *tested* component must exist in the test-setup lucide mock object (add if missing).
- **Font-size ratchet** (pre-commit, baseline **333** in
  `scripts/check-arbitrary-font-size.ts`): use rem tokens (`text-xs`/`text-sm`),
  NOT `text-[Npx]`. If you remove literals, lower BASELINE to the new count.
- **Theme tokens only:** `bg-card/background`, `border-border`, `text-foreground`,
  `text-muted-foreground`, `bg-muted`, `bg-lemon/lemon-foreground`. No zinc-900/black.
- Preserve every existing `data-testid`, `role="dialog"`, and the empty-state
  "New …" buttons + the modal "Back to workspace" controls.

## Verify gate (all green, no new warnings/regressions)

```bash
bun run typecheck
bun run lint                 # eslint max-warnings; do not add warnings
DATABASE_URL=postgres://…/monobase_test bun run test   # NEVER `bun test <path>` for API; FE app suite is bun test src/
bun run check:boundaries     # backend boundary gate (no-op here, but run it)
```

Commit each item (or tight cluster) atomically. Prefer Playwright/E2E or component
tests over manual checkpoints.

---

## Items (checklist)

### [ ] 1. Recall overdue + relative due dates  (HIGH — clinical)
- **File:** `apps/dentalemon/src/features/workspace/components/recalls-sheet.tsx`
  (`RecallRow`, the `Due: {date}` line ~:107).
- **Change:** when `dueDate < today` and status is `pending`/`sent`, show a red
  **"Overdue"** badge; add relative text next to the absolute date ("in 3 mo",
  "2 weeks overdue"). Pure FE date math — small local helper (clamp like the
  existing `addMonths`). Completed/cancelled recalls never show overdue.
- **Test:** `recalls-sheet.test.ts` — a past-due pending recall renders "Overdue";
  a future one does not.

### [ ] 2. Plan docs labeled rows + light Tasks labels  (HIGH — consistency)
- **Files:** `treatment-plans-sheet.tsx` (`PlanRow` ~:100-160),
  `tasks-sheet.tsx` (`TaskRow` ~:68-108).
- **Change:** mirror the occlusion `Metric` labeled-grid pattern
  (`occlusion-screening-sheet.tsx`). Plan docs: surface **Estimate**, **CDT year**,
  and status as labeled fields (keep the FSM transition buttons + "Present to
  patient"). Tasks: lightly label **Type** / **Due** (keep title, status badge,
  transitions, description). Don't change FSM/testids/behavior.
- **Test:** extend `treatment-plans-sheet.test.ts` (estimate/CDT render as labeled
  values) and `tasks-sheet.test.ts` (type/due labels present).

### [ ] 3. Wire `aria-describedby` on the 4 record modals  (MED — a11y)
- **Files:** `recalls-sheet.tsx`, `tasks-sheet.tsx`,
  `occlusion-screening-sheet.tsx`, `treatment-plans-sheet.tsx`.
- **Change:** the header description `<p>` added last pass gets an `id`
  (e.g. `recalls-desc`); pass it to `DialogContent aria-describedby={...}` instead
  of `undefined`. Screen readers then announce the purpose line.
- **Test:** assert `getByRole('dialog')` has `aria-describedby` pointing at the
  description text (one modal is enough; replicate the impl across all four).

### [ ] 4. Loading skeletons in the 4 modals  (MED — polish)
- **Files:** same four; the `Loading …` `<p>` (recalls :299, tasks :278,
  occlusion :305, treatment-plans :318).
- **Change:** replace the plain text with `Skeleton` rows (`import { Skeleton }
  from '@monobase/ui'`), matching the perio overlay pattern
  (`perio-chart-overlay.tsx:247`). 2–3 skeleton list rows.
- **Test:** existing loading assertions still pass (or update to the skeleton
  testid). Keep a stable `data-testid` (e.g. `recalls-loading`).

### [ ] 5. Occlusion "permanent record" hint  (LOW — clarity)
- **File:** `occlusion-screening-sheet.tsx`.
- **Change:** there is no edit/delete endpoint — add a subtle footer line
  ("Screenings are a permanent record and can't be edited.") so users don't hunt
  for an edit button. Muted, small.
- **Test:** optional — assert the hint renders.

### [ ] 6. Imaging "Images" count badge  (LOW — consistency)
- **File:** `apps/dentalemon/src/features/imaging/components/patient-image-list.tsx`
  (rail header title row).
- **Change:** add a count badge next to "Images" (count of `allItems`), mirroring
  the count badges on the record tabs. Hidden when 0.
- **Test:** `patient-image-list.test.tsx` — badge shows the item count.

### [ ] 7. Angle-class quick reference in Occlusion  (LOW — guidance)
- **File:** `occlusion-screening-sheet.tsx`.
- **Change:** a collapsible "Angle classes" legend (Class I / II div 1 / II div 2 /
  III / edge-to-edge, one-line each) for solo-GP guidance. Collapsed by default;
  fills the large card usefully.
- **Test:** toggling the legend reveals the class descriptions.

---

## Out of scope (don't build)
- Occlusion edit/delete (no backend endpoint); recall `intervalMonths` recurrence
  (not in SDK type); any backend/schema/TypeSpec change; new dependencies.
