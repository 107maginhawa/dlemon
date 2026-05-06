---
quick_id: 260507-8zl
slug: workspace-wireframe-alignment
status: complete
date: 2026-05-07
---
# Summary: Workspace Wireframe Alignment

## What was done

1. **Task 1** — Stripped workspace layout header to bare auth guard shell (`_workspace.tsx`). Commit: `45d0cd7`

2. **Task 2** — Added `conditionCode?: string | null` to `Treatment` interface. Created `TreatmentTable` component with 7 wireframe columns (Tooth, Surface, Condition, Treatment Plan, Done, Status, Total). Replaced inline `<table>` in `$patientId.tsx` with `<TreatmentTable>`. Commit: `f7b441e`

3. **Task 3** — Wired `useTreatmentPlan` in `$patientId.tsx`, derived `carriedOverItems`, passed to TreatmentTable. TreatmentTable renders "Carried Over from Previous Visits" separator row + dimmed rows with "from {date}" labels cross-referenced from visits array. Commit: `ee81b58`

4. **Task 4** — Removed `WorkspaceTabs`, `activeTab` state, all tab-conditional rendering, and standalone `DentalChart` from main view. Kept `useDentalChart`, `ToothSlideout`, and all sheet components. Main content is now only `TreatmentTable`. Commit: `ee81b58`

5. **Task 5** — Created `WorkspaceTopBar` component: 56px frosted-glass bar, patient avatar chip (initials from `usePatientProfile`), safety floor (active allergies/medications/conditions from `useMedicalHistory`), visit date label, 5 icon buttons (Rx, Notes, Attachments, Treatment Plan, Fullscreen). Wired all callbacks in `$patientId.tsx`. Commit: `a22d498`

6. **Task 6** — Simplified workspace footer to show only `{pendingCount} pending · {CURRENCY_SYMBOL}{totalAmount}` on left and payment button on right. Removed 5-icon action bar from footer (moved to top bar). Commit: `ee81b58`

7. **Task 7** — Created `YearSegmentControl` (Apple-style segmented pills). Added `yearFilter` state in `$patientId.tsx`, derived unique years from visits, renders between top bar and carousel, filters visits by selected year. Commit: `67c3fe8`

8. **Task 8** — Rewrote `TimelineCarousel` with 3D perspective layout: left flanking card (perspective/rotateY/scale + 0.4 opacity + placeholder grid), focal card (~520px, gold ring shadow, interactive 16×4 tooth mini-grid with real tooth data, visit date + status badge), "+" new visit card (0.2 opacity, dashed). New props: `teeth`, `onSelectTooth`. Commit: `863e037`

9. **Task 9** — Created `ResizableDivider` (8px drag handle, pointer capture, onPointerDown/Move/Up). Added `splitRatio` state and `containerRef` in `$patientId.tsx`, wrapped carousel+table in resizable flex-col with dynamic `flex-basis` styles. Commit: `a1bd7e3`

## Files created
- `apps/dentalemon/src/features/workspace/components/treatment-table.tsx`
- `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx`
- `apps/dentalemon/src/features/workspace/components/year-segment-control.tsx`
- `apps/dentalemon/src/features/workspace/components/resizable-divider.tsx`

## Files modified
- `apps/dentalemon/src/routes/_workspace.tsx`
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx`
- `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx`
- `apps/dentalemon/src/features/workspace/hooks/use-treatments.ts`

## Deviations from Plan

None — plan executed exactly as written. Tasks 3 (carried-over), 4 (remove tabs), 6 (footer), and the `$patientId.tsx` wiring for tasks 5/7/9 were batched into one large `$patientId.tsx` rewrite commit (ee81b58) for atomicity, but all functionality matches the plan spec.

## Known Stubs

- **WorkspaceTopBar fullscreen button** (`workspace-top-bar.tsx`): onClick is a no-op (`() => {}`). Cosmetic per plan spec ("low priority").
- **Notes sheet** (`$patientId.tsx`): Implemented as a custom overlay div rather than using a Radix `Sheet` component — functional but uses hand-rolled backdrop/close pattern. Consistent with how other UI is wired; does not block feature.

## Verification

- TypeScript: passes `bun run typecheck` with no errors
- Layout: TopBar → YearFilter → 3D Carousel → ResizableDivider → TreatmentTable → Footer
- No standalone DentalChart or tab system in main view
- All existing sheets (Rx, Consent, Lab, PMD, Attachments, Payment) preserved
- ToothSlideout wired via `onSelectTooth` on focal carousel card
- Carried-over treatments render in dimmed section below separator
