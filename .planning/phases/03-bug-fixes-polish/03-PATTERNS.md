# Phase 3: Bug Fixes & Polish - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 8 files to modify + 2 to delete
**Analogs found:** 7 / 8 (1 no-analog: fullscreenchange listener)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/workspace/hooks/use-treatment-plan.ts` | hook | request-response | `features/workspace/hooks/use-save-tooth-flow.ts` + self | exact (already correct) |
| `features/workspace/components/workspace-top-bar.tsx` | component | event-driven | `features/workspace/components/cdt-code-browser.tsx` (useEffect) | role-match |
| `features/workspace/components/resizable-divider.tsx` | component | event-driven | self (extend in-place) | exact |
| `routes/_workspace/$patientId.tsx` | route | request-response | `routes/_dashboard/staff.tsx`, `routes/_dashboard/patients.tsx` | exact |
| `features/workspace/components/tooth-slideout.tsx` | component | request-response | `features/workspace/components/treatment-table.tsx` (price math) | role-match |
| `features/workspace/components/treatment-table.tsx` | component | CRUD | self (price math already correct at lines 282-286) | exact |
| `features/workspace/components/workspace-payment-modal.tsx` | component | request-response | self (already uses `priceCents` correctly) | exact |
| `features/workspace/components/workspace-tabs.tsx` | — | — | DELETE | — |

---

## Pattern Assignments

### `routes/_workspace/$patientId.tsx` — BFIX-05: Org Store Reactive

**Analog:** `apps/dentalemon/src/routes/_dashboard/patients.tsx` (line 42), `staff.tsx` (lines 13, 15)

**Correct reactive selector pattern** (from `_dashboard/patients.tsx:42` and `_dashboard/staff.tsx:13-15`):
```typescript
// CORRECT — reactive, re-renders when store changes
const branchId = useOrgContextStore((s) => s.branchId) ?? undefined;
const memberId = useOrgContextStore((s) => s.memberId) ?? '';

// WRONG (current lines 64-67 in $patientId.tsx) — snapshot, stale on store updates
const prescriberMemberId = React.useRef(useOrgContextStore.getState().memberId ?? '').current;
const branchId = React.useRef(useOrgContextStore.getState().branchId).current;
```

**Fix lines 64-67** — replace both `React.useRef(useOrgContextStore.getState()...)` captures with:
```typescript
const prescriberMemberId = useOrgContextStore((s) => s.memberId) ?? '';
const branchId = useOrgContextStore((s) => s.branchId) ?? null;
```

**Leave untouched** — `.getState()` inside event handlers (lines 130-131 `handleNewVisit`) is correct non-reactive usage.

---

### `features/workspace/components/workspace-top-bar.tsx` — BFIX-03: Fullscreen Escape Sync

**Analog:** No direct analog in codebase. Standard React `useEffect` + browser event pattern.

**Current broken state** (lines 54-70 — `FullscreenButton` component):
```typescript
function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    } else {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    }
  }, []);
  // ...
}
```

**Required fix** — add `useEffect` after `useState` to sync state when browser fires native Escape exit:
```typescript
import React, { useState, useCallback, useEffect } from 'react';

function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);
  // ...
}
```

Note: Drop `.then(() => setIsFullscreen(...))` from toggle — the `fullscreenchange` listener now owns all state updates, eliminating double-set race.

---

### `features/workspace/components/workspace-top-bar.tsx` — BFIX-04: Duplicate PMD/Profile Buttons

**Investigation target:** The `WorkspaceTopBar` props interface (lines 17-28) has `onPmd` prop but no PMD button is rendered in the JSX (lines 150-175). The `$patientId.tsx` route (lines 197-209) passes `onPmd={() => setPmdViewerOpen(true)}` to `WorkspaceTopBar` — but the PMD button may be inside `tooth-slideout.tsx` or elsewhere.

**Analog:** `features/workspace/components/cdt-code-browser.tsx` for import pattern:
```typescript
import { useOrgContextStore } from '@/stores/org-context.store';
// line 90: const memberId = useOrgContextStore(s => s.memberId);
```

**Action:** Locate duplicate button render site by searching both `workspace-top-bar.tsx` and `tooth-slideout.tsx` JSX for Profile/PMD-related buttons. Remove the duplicate; keep the canonical one in `workspace-top-bar.tsx`. The `onPmd` prop is already wired — just ensure only one render site calls it.

---

### `features/workspace/components/resizable-divider.tsx` — BFIX-07: Add `direction` Prop

**Analog:** Self — extend in-place. Current implementation (all 54 lines) is the template.

**Current interface** (lines 12-14):
```typescript
interface ResizableDividerProps {
  onResize: (delta: number) => void;
}
```

**Required new interface** (backward-compatible):
```typescript
interface ResizableDividerProps {
  onResize: (delta: number) => void;
  direction?: 'x' | 'y';  // default 'x'
}
```

**Logic change pattern** — destructure `direction = 'x'` and branch on it:
```typescript
export function ResizableDivider({ onResize, direction = 'x' }: ResizableDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(0);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setIsDragging(true);
    setStartPos(direction === 'y' ? e.clientY : e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const current = direction === 'y' ? e.clientY : e.clientX;
    const delta = current - startPos;
    setStartPos(current);
    onResize(delta);
  }
  // handlePointerUp unchanged

  return (
    <div
      role="separator"
      aria-label="Drag to resize"
      aria-orientation={direction === 'y' ? 'horizontal' : 'vertical'}
      className={[
        direction === 'y'
          ? 'h-2 relative flex justify-center items-center cursor-row-resize shrink-0 touch-none select-none'
          : 'w-2 relative flex items-center justify-center cursor-col-resize shrink-0 touch-none select-none',
        'bg-border/30 hover:bg-border/60 group transition-colors',
        isDragging ? 'bg-border/60' : '',
      ].join(' ')}
      // ...pointer handlers unchanged
    >
      <div className={direction === 'y'
        ? 'w-9 h-[5px] rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50 transition-colors'
        : 'h-9 w-[5px] rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50 transition-colors'
      } />
    </div>
  );
}
```

**Consumer update** (`$patientId.tsx` line 260): pass `direction="y"` when layout is vertical stacking. Current usage `<ResizableDivider onResize={handleResize} />` remains backward-compatible (defaults to `'x'`).

---

### `features/workspace/components/tooth-slideout.tsx` — BFIX-01: Price Boundary

**Analog:** `features/workspace/components/treatment-table.tsx` lines 281-286 (canonical price save pattern).

**Price boundary rule:**
- **Display** (review step): `parseFloat(priceInput).toLocaleString(APP_LOCALE)` — already correct at line 276
- **Save** (`use-save-tooth-flow.ts` line 58-63): receives raw `priceInput` string, calls `parseFloat(data.priceInput)` → `priceAmount` — sends as float, **not** cents
- **Backend save** (`useSaveTreatment`): sends `priceAmount` (float); backend stores as cents internally
- **CDT select** (line 102): `setPriceInput(String(selection.priceCents / 100))` — converts cents→float string correctly

**Verify these two stay consistent:**
```typescript
// handleCdtSelect (line 102) — correct: cents→display float
setPriceInput(String(selection.priceCents / 100));

// handleSave (lines 108-128) — correct: passes raw priceInput string to onSave
// use-save-tooth-flow.ts line 58: parseFloat(data.priceInput) → priceAmount (float)
```

**No cents conversion in slideout itself** — the boundary is entirely in `use-save-tooth-flow.ts`. Fix: verify no `* 100` or `/ 100` accidentally introduced in `handleSave` or `onSave` call site.

**Analog:** `treatment-table.tsx` canonical save pattern (lines 281-286):
```typescript
const parsed = parseFloat(draftPrice);
if (!isNaN(parsed) && parsed >= 0) {
  const cents = Math.round(parsed * 100);
  updateMutation.mutate({
    path: { visitId, treatmentId: t.id },
    body: { priceCents: cents },  // treatment-table sends cents directly to API
  });
}
```
Note: `treatment-table.tsx` sends `priceCents` (cents) directly. `tooth-slideout` sends `priceAmount` (float) through `useSaveTreatment` — different API call shape. Both are correct for their respective paths.

---

### `features/workspace/components/treatment-table.tsx` — BFIX-01: Price Boundary

**Status:** Already correct. Lines 282-286 use `Math.round(parsed * 100)` → `priceCents`. Line 305 displays `t.priceAmount ?? 0` as float. Line 384 displays `item.priceCents / 100`.

**Action:** Audit only — confirm no mixed `priceAmount`/`priceCents` at display vs. save boundaries. No code changes expected.

---

### `features/workspace/components/workspace-payment-modal.tsx` — BFIX-01: Price Boundary

**Status:** Already correct. `lineItems` prop typed as `priceCents: number` (line 27). Display uses `formatCents(item.priceCents)` (line 96). Subtotal at line 173: `sum + item.priceCents`.

**Caller in `$patientId.tsx`** (lines 436-443):
```typescript
lineItems={treatments.map((t) => ({
  priceCents: Math.round((t.priceAmount ?? 0) * 100),  // float→cents at call site
  // ...
}))}
```

**Action:** Confirm call site conversion `Math.round((t.priceAmount ?? 0) * 100)` is present and correct. No changes inside modal itself expected.

---

### `features/workspace/hooks/use-treatment-plan.ts` — BFIX-02: Keep Raw Fetch

**Status:** Already correct. Raw fetch with `apiBaseUrl` and `credentials: 'include'` is the right pattern (no SDK hook exists for this endpoint).

**Pattern to preserve** (lines 1-61 are all correct):
```typescript
import { apiBaseUrl } from '@/utils/config';

export function useTreatmentPlan({ patientId, branchId }: UseTreatmentPlanOptions) {
  const query = useQuery({
    queryKey: ['dental-treatment-plan', patientId, branchId],
    queryFn: async (): Promise<TreatmentPlanData> => {
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/treatment-plan?${params}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to fetch treatment plan (${res.status})`);
      return res.json();
    },
    enabled: !!patientId && !!branchId,
  });
  // ...
}
```

**Action:** No changes. Ensure `use-treatment-plan.test.ts` still passes after any incidental edits.

---

## Shared Patterns

### Org Store Reactive Selector
**Source:** `apps/dentalemon/src/routes/_dashboard/staff.tsx` lines 13-15
**Apply to:** All render-time store reads (not event handlers)
```typescript
// Reactive — use in component body
const branchId = useOrgContextStore((s) => s.branchId) ?? '';
const memberId = useOrgContextStore((s) => s.memberId) ?? '';
const role = useOrgContextStore((s) => s.role) ?? 'dentist_owner';

// Non-reactive — OK inside event handlers only
const { branchId } = useOrgContextStore.getState();
```

### Price Boundary
**Source:** `apps/dentalemon/src/features/workspace/hooks/use-save-tooth-flow.ts` lines 56-63
**Rule:**
- slideout `priceInput` = raw float string (e.g., `"1500"`)
- display: `parseFloat(priceInput).toLocaleString(APP_LOCALE)`
- save: `priceAmount = parseFloat(priceInput)` → sent as float to `useSaveTreatment`
- payment modal call site: `Math.round((t.priceAmount ?? 0) * 100)` → `priceCents`
- treatment-table inline edit: `Math.round(parsed * 100)` → `priceCents` directly to update API

### Browser Event Listener (useEffect)
**Source:** Standard React pattern — no existing analog in this codebase
**Apply to:** `FullscreenButton` in `workspace-top-bar.tsx`
```typescript
useEffect(() => {
  function handler() { /* sync state */ }
  document.addEventListener('eventname', handler);
  return () => document.removeEventListener('eventname', handler);
}, []);
```

---

## Deletions

| File | Reason |
|---|---|
| `features/workspace/components/workspace-tabs.tsx` | Zero external consumers confirmed; superseded by route-level tab management |
| `features/workspace/components/workspace-tabs.test.ts` | Test file for deleted component |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `FullscreenButton` (inside `workspace-top-bar.tsx`) | component | event-driven | No `fullscreenchange` / `document.addEventListener` patterns exist in codebase — use standard React useEffect pattern |

---

## Metadata

**Analog search scope:** `apps/dentalemon/src/features/workspace/`, `apps/dentalemon/src/routes/`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-11
