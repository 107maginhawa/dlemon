# Phase 3: Bug Fixes & Polish - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all 7 known workspace bugs identified in the reconciliation audit (BFIX-01 through BFIX-07). No new features — only correctness, consistency, and cleanup. Typecheck must remain green after every fix.

</domain>

<decisions>
## Implementation Decisions

### SDK Migration (BFIX-02)
- Keep raw `fetch` with `apiBaseUrl` — no SDK react-query options exist for `/dental/patients/:patientId/treatment-plan`
- Preserve existing `TreatmentPlanItem` and `TreatmentPlanData` local interfaces (correct, match API shape)
- Ensure `use-treatment-plan.test.ts` still passes after any cleanup

### Org Store Fix Scope (BFIX-05)
- Fix only `_workspace/$patientId.tsx` lines 64+67: replace `React.useRef(useOrgContextStore.getState().memberId)` and `.branchId` captures with reactive `useOrgContextStore(s => s.memberId)` / `useOrgContextStore(s => s.branchId)`
- Leave all `.getState()` calls inside event handlers untouched (onboarding, auth routes, sidebar, appointment modal) — these are legitimately non-reactive

### ResizableDivider Direction (BFIX-07)
- Add `direction?: 'x' | 'y'` prop, defaulting to `'x'` (backward compatible)
- When `direction === 'y'`: track `clientY`/`startY`, use `cursor-row-resize`, `aria-orientation="horizontal"`
- Workspace route passes `direction="y"` when in vertical stacking layout

### Claude's Discretion
- BFIX-01 (price consistency): verify boundary exactly once — display uses `priceCents / 100`, save uses `Math.round(parsed * 100)`; fix any deviation found in tooth-slideout save flow
- BFIX-03 (fullscreen Escape sync): add `useEffect` with `fullscreenchange` event listener; update `isFullscreen` state when browser fires native Escape exit
- BFIX-04 (duplicate Profile/PMD buttons): investigate exact duplication site (likely tooth-slideout vs workspace-top-bar overlap); remove the duplicate render
- BFIX-06 (WorkspaceTabs deletion): delete `workspace-tabs.tsx` and `workspace-tabs.test.ts`; no external consumers found — safe to remove

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useOrgContextStore` (selector pattern) — already used correctly in `cdt-code-browser.tsx:90`
- `ResizableDivider` at `features/workspace/components/resizable-divider.tsx` — extend in-place
- `FullscreenButton` inside `workspace-top-bar.tsx:54` — add `useEffect` listener there
- TanStack Query `useQuery` pattern — already established across all other hooks

### Established Patterns
- State management: `useOrgContextStore(s => s.field)` selector pattern (NOT `.getState()` in render)
- Raw fetch hooks: `import { apiBaseUrl } from '@/utils/config'` + `{ credentials: 'include' }`
- Price math: display = `priceCents / 100`, save = `Math.round(parsed * 100)`
- File naming: `kebab-case.tsx` for components, `use-kebab-case.ts` for hooks

### Integration Points
- `_workspace/$patientId.tsx` — consumer of ResizableDivider + org store (two fixes here)
- `workspace-top-bar.tsx` — FullscreenButton (BFIX-03) + potential duplicate buttons (BFIX-04)
- `tooth-slideout.tsx` — price boundary (BFIX-01) + possible duplicate button source (BFIX-04)

</code_context>

<specifics>
## Specific Ideas

- No specific requirements beyond the 7 BFIX items — open to standard approaches for each
- BFIX-06: both `workspace-tabs.tsx` and `workspace-tabs.test.ts` must be deleted (confirmed zero external consumers)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
