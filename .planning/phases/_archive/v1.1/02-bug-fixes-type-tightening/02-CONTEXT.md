# Phase 2: Bug Fixes + Type Tightening - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix known bugs in tooth-slideout and workspace page, tighten types for safety, and fold in critical Phase 1 review findings. Cascade guard: re-run typecheck after to verify Phase 1 hooks still compile with tightened types.

**In scope (ROADMAP BUG-01 through BUG-07):**
- Treatment status enum: `proposed` → `diagnosed | planned`
- Price field naming: `priceCents` → `priceInput`
- Tooth slideout state reset on tooth change
- ToothData.state type narrowing (remove `| string`)
- ToothSurface canonicalization
- FDI validation guard
- Price NaN guard
- Hardcoded color → token (in Phase 2 touched files only)

**Folded from Phase 1 review (CR-01, CR-02, WR-02):**
- CR-01: Guard empty localStorage branchId/dentistMemberId before createVisit
- CR-02: Fix stale visitId closure in useSaveChart/useSaveTreatment cache invalidation
- WR-02: Chain chart+treatment saves sequentially (not parallel)
- CR-03: Remove `as any` casts by updating Treatment type

**Out of scope:**
- WR-03 (error toast UI) — needs toast component + design, separate concern
- Bulk `bg-[#FFE97D]` replacement across all 50+ instances — separate cleanup phase
- N3 (billing nav without context) — placeholder, not a Phase 2 bug

</domain>

<decisions>
## Implementation Decisions

### Review Findings Scope
- Fold CR-01 (empty localStorage guard), CR-02 (stale visitId), WR-02 (parallel save race), CR-03 (as any casts) into Phase 2
- Defer WR-03 (error UI/toasts) — needs design decisions and toast component
- Defer bulk hardcoded color cleanup — 50+ files is a separate concern

### Color Token Strategy
- Add `bg-lemon`, `text-lemon-contrast`, `hover:bg-lemon-hover` to tailwind config extending brand.ts
- Replace hardcoded `bg-[#FFE97D]`, `text-[#4A4018]`, `hover:bg-[#F5DC60]` only in files touched by Phase 2 bugs (tooth-slideout.tsx, $patientId.tsx)
- Full codebase sweep deferred

### Type Tightening Approach
- Update Treatment type to include `cdtCode`, `description` fields — remove `as any` casts
- Derive ToothState type from TOOTH_STATES const via `typeof` — remove `| string`
- FDI validation guard in `dental-chart.helpers.ts` (reusable, testable)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TOOTH_STATES` const array in tooth-slideout.tsx (line 17-27) — can derive type from this
- `dental-chart.helpers.ts` — existing helper file for FDI validation guard
- `brand.ts` constants — CURRENCY_SYMBOL, APP_LOCALE already defined
- `five-surface-selector.helpers.ts` — has ToothSurface type definition

### Established Patterns
- Mutation hooks use `useMutation` from `@tanstack/react-query` with `onSuccess` callbacks
- Brand colors defined in `apps/dentalemon/src/constants/brand.ts`
- Tailwind config extends brand tokens
- Type definitions co-located with components or in shared type files

### Integration Points
- `$patientId.tsx` — main workspace page consuming all hooks
- `tooth-slideout.tsx` — form component for tooth data entry
- `use-save-chart.ts` / `use-save-treatment.ts` — cache invalidation fix targets
- `use-create-visit.ts` — localStorage guard target

</code_context>

<specifics>
## Specific Ideas

- Treatment type update should add optional `cdtCode?: string` and `description?: string` to match what the API actually returns
- FDI validation should accept both Universal (1-32) and FDI (11-48) numbering systems
- Price NaN guard should reject non-numeric input before mutation fires, not silently default to 0
- Chain saves: saveChart → onSuccess → saveTreatment (if treatment data present)

</specifics>

<deferred>
## Deferred Ideas

- Toast/notification system for mutation error feedback (WR-03) — needs component + design
- Codebase-wide `bg-[#FFE97D]` → `bg-lemon` replacement (50+ files)
- Billing page navigation with visit context (N3)
- Share PMD button loading/disabled state during mutation (N4)

</deferred>
