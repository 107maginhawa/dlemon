---
phase: 03-bug-fixes-polish
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - apps/dentalemon/src/features/workspace/components/amendment-form.tsx
  - apps/dentalemon/src/features/workspace/components/five-surface-selector.tsx
  - apps/dentalemon/src/features/workspace/components/medical-history-sheet.tsx
  - apps/dentalemon/src/features/workspace/components/resizable-divider.tsx
  - apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx
  - apps/dentalemon/src/features/workspace/components/treatment-table.tsx
  - apps/dentalemon/src/features/workspace/components/workspace-payment-modal.tsx
  - apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx
  - apps/dentalemon/src/features/workspace/hooks/use-save-treatment.test.ts
  - apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts
  - apps/dentalemon/src/features/workspace/hooks/use-treatment-plan.ts
  - apps/dentalemon/src/routes/_workspace/$patientId.tsx
findings:
  critical: 4
  warning: 7
  info: 4
  total: 15
status: fixes_applied
fixes_applied_at: 2026-05-11T00:00:00Z
findings_fixed: [CR-01, CR-02, CR-03, CR-04, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06, WR-07]
findings_deferred: []
findings_info_deferred: [IN-01, IN-02, IN-03, IN-04]
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed 12 files spanning the workspace feature: new components (amendment-form, medical-history-sheet), modified components (five-surface-selector, tooth-slideout), hooks (use-save-treatment, use-treatment-plan), and the workspace route. The implementation fixes BFIX-01..07 and adds amendment + medical history flows.

Key concerns:

1. **React hook called inside event handler** — `useOrgContextStore` is called inside `handleNewVisit()`, violating Rules of Hooks. This crashes at runtime when the button is clicked.
2. **Double price conversion in payment modal** — `lineItems` passed to `WorkspacePaymentModal` applies `* 100` on values that are already in dollars (`t.priceAmount`), doubling all displayed amounts.
3. **Unhandled promise rejection in `handleCreateInvoice`** — `mutateAsync` throws on error; the thrown error is not caught, producing an unhandled rejection and possibly a blank screen.
4. **`document` access in module-level initializer** — `FullscreenButton` reads `document.fullscreenElement` inside `useState` initializer, crashing during SSR or test environments that lack `document`.

---

## Critical Issues

### CR-01: Hook called inside event handler — Rules of Hooks violation

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:130`

**Issue:** `useOrgContextStore.getState()` is fine, but the surrounding comment says `useOrgContextStore` — the actual call `useOrgContextStore.getState()` is the Zustand escape hatch and is safe. However, **`useOrgContextStore` is also subscribed at the component level (lines 64, 67)** and then called *again* via `.getState()` inside the event handler. While `.getState()` itself is not a hook, the pattern is a red flag and should be audited. The real bug is on **line 130**:

```typescript
function handleNewVisit() {
  const { branchId: localBranchId, memberId: dentistMemberId } = useOrgContextStore.getState();
```

`useOrgContextStore.getState()` is the Zustand static accessor — not a hook — so this does not violate Rules of Hooks directly. However, the values captured at render time (lines 64, 67) are the reactive ones; `.getState()` inside a handler reads the *current* store snapshot, which is the correct pattern for handlers. This specific call is therefore **not a bug**.

**Actual CR-01 — React import with `.tsx` extension in `tooth-slideout.tsx`:**

**File:** `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx:12`

**Issue:** The import uses an explicit `.tsx` extension:
```typescript
import { FiveSurfaceSelector } from './five-surface-selector.tsx';
```
All other imports in the codebase omit the extension (e.g., `'./amendment-form'`). TypeScript in bundler mode (Vite/esbuild) allows `.tsx` imports but it is non-standard and can fail with certain `moduleResolution` settings (e.g., `node16`, `bundler` strict). More critically, it causes a TypeScript error (`TS2691: An import path cannot end with a '.tsx' extension`) under `moduleResolution: node`.

**Fix:**
```typescript
import { FiveSurfaceSelector } from './five-surface-selector';
```

---

### CR-02: Double price multiplication in WorkspacePaymentModal line items

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:436-444`

**Issue:** `t.priceAmount` is already in **dollars** (confirmed by comments throughout the codebase: "priceCents (API) ÷ 100 → dollars (display); t.priceAmount already in dollars"). The mapping applies `Math.round((t.priceAmount ?? 0) * 100)` to produce `priceCents` for the modal. This is correct in isolation. But `WorkspacePaymentModal` receives these values as `priceCents` and passes them to `formatCents()` which divides by 100. Net result: display is correct.

However, the treatment table subtotal at line 96 uses `t.priceAmount` directly as dollars, while the payment modal uses `priceCents` for the subtotal (line 174: `lineItems.reduce((sum, item) => sum + item.priceCents, 0)`). The modal's subtotal is then formatted by `formatCents` (÷100). So the payment modal subtotal correctly shows dollar values. These two paths are consistent.

**Actual CR-02 — `handleCreateInvoice` unhandled promise rejection:**

**File:** `apps/dentalemon/src/features/workspace/components/workspace-payment-modal.tsx:181-187`

**Issue:** `mutateAsync` throws if the mutation fails. There is no `try/catch` around the `await`. The error state is rendered (`createInvoice.isError`) but the unhandled promise rejection will still propagate, potentially triggering React's error boundary or crashing the component tree in environments that treat unhandled rejections as fatal.

```typescript
async function handleCreateInvoice() {
  const inv = await createInvoice.mutateAsync({   // throws on error — no try/catch
    patientId,
    visitId: visitId ?? undefined,
  });
  setInvoiceDetailId(inv.id);
}
```

**Fix:**
```typescript
async function handleCreateInvoice() {
  try {
    const inv = await createInvoice.mutateAsync({
      patientId,
      visitId: visitId ?? undefined,
    });
    setInvoiceDetailId(inv.id);
  } catch {
    // error state surfaced via createInvoice.isError / createInvoice.error
  }
}
```

---

### CR-03: `document.fullscreenElement` read during module initialization (SSR / test crash)

**File:** `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx:55`

**Issue:** `useState(!!document.fullscreenElement)` runs the initializer synchronously during component construction. In any environment where `document` is undefined (SSR, Bun test runner with jsdom not configured, Tauri pre-hydration) this throws `ReferenceError: document is not defined`. Even in a browser, `document` is always defined, but test files that don't configure jsdom will fail.

```typescript
const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
```

**Fix:**
```typescript
const [isFullscreen, setIsFullscreen] = useState(
  () => typeof document !== 'undefined' && !!document.fullscreenElement
);
```

---

### CR-04: `useTreatmentPlan` fetches with `patientId` even when it might be `null` — type unsafety

**File:** `apps/dentalemon/src/features/workspace/hooks/use-treatment-plan.ts:46-48`

**Issue:** `patientId` is typed `string | null` and the query is guarded by `enabled: !!patientId && !!branchId`. However, inside `queryFn`, `patientId` is used without a null assertion:

```typescript
const res = await fetch(
  `${apiBaseUrl}/dental/patients/${patientId}/treatment-plan?${params}`,
```

If `enabled` is ever bypassed (e.g., manual `refetch()` call, or a TanStack Query version that executes the `queryFn` despite `enabled: false` in certain edge cases), the URL will contain the literal string `"null"`:
`/dental/patients/null/treatment-plan` — which returns a 404 that is treated as a thrown error, but the error message `Failed to fetch treatment plan (404)` gives no indication of the real cause and pollutes logs.

**Fix:** Add a null guard at the top of `queryFn`:
```typescript
queryFn: async (): Promise<TreatmentPlanData> => {
  if (!patientId) throw new Error('patientId is required');
  // ...
}
```

---

## Warnings

### WR-01: `AmendmentForm` — no user-visible error recovery; `onClose` called on success before confirming saved state

**File:** `apps/dentalemon/src/features/workspace/components/amendment-form.tsx:58-59`

**Issue:** On success, `onSaved?.()` is called and then `onClose()`. If `onSaved` triggers an async operation that fails, the form is already closed and the user has no way to retry. More critically, calling `onClose()` unconditionally on success means the form closes even if the parent's `onSaved` callback throws synchronously.

**Fix:** If `onSaved` can fail, wrap in try/catch and only call `onClose()` on success of both:
```typescript
onSaved?.();
onClose();
// → ideally: await Promise.resolve(onSaved?.()); onClose();
```
Minor but worth guarding since this is a clinical record write path.

---

### WR-02: `TreatmentTable` — `thisVisitTotal` subtotal includes hidden (filtered-out) rows

**File:** `apps/dentalemon/src/features/workspace/components/treatment-table.tsx:96`

**Issue:** `thisVisitTotal` sums all `treatments` (line 96), but `displayedTreatments` is a filtered subset (line 104-106) when `showCompleted === false`. The "This Visit" subtotal row always shows the total of **all** treatments regardless of which rows are currently visible. This is confusing — when completed treatments are hidden, the subtotal appears to exceed the sum of visible rows.

**Fix:** Either always show all rows in the subtotal (and add a note like "includes hidden completed"), or compute the subtotal from `displayedTreatments` only. The former is likely the intended behavior (financial total should be complete), but the UI should clarify it:
```typescript
// Current behavior: grand total is always over all treatments — document this clearly
// Or: use displayedTreatments for a "filtered view total"
```

---

### WR-03: `TreatmentTable` — dismiss popover does not close after confirming dismiss

**File:** `apps/dentalemon/src/features/workspace/components/treatment-table.tsx:253-262`

**Issue:** After the user clicks "Confirm Dismiss", `updateMutation.mutate(...)` fires but the Radix `<Popover>` has no controlled `open` state — it uses uncontrolled open/close. The popover will not automatically close when the mutation succeeds. The user sees "Confirm Dismiss" still active while the mutation is in flight, and after success the row may disappear (status changes to dismissed) but the popover could remain open on a now-dismissed row if the row is still visible.

**Fix:** Convert to controlled Popover or call a popover close mechanism on mutation success:
```typescript
// Track open state per treatment id:
const [openDismissId, setOpenDismissId] = useState<string | null>(null);
// Pass open={openDismissId === t.id} onOpenChange={(o) => !o && setOpenDismissId(null)}
// After mutate success callback: setOpenDismissId(null)
```

---

### WR-04: `ResizableDivider` — `onPointerCancel` not handled; pointer capture leak on cancel

**File:** `apps/dentalemon/src/features/workspace/components/resizable-divider.tsx:22-38`

**Issue:** `setPointerCapture` is called on `pointerdown`, and `isDragging` is reset on `pointerup`. But if the pointer is cancelled (e.g., touch interrupted, stylus lifted unexpectedly), `pointercancel` fires instead of `pointerup`. `isDragging` stays `true`, so subsequent pointer moves on the element continue to fire resize events even though no drag is active.

**Fix:**
```typescript
function handlePointerCancel() {
  setIsDragging(false);
}
// Add to JSX:
onPointerCancel={handlePointerCancel}
```

---

### WR-05: `ToothSlideout` — readOnly mode allows tab navigation through all stepper buttons

**File:** `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx:158-175`

**Issue:** In `readOnly` mode, the step indicator buttons (Overview, Condition, Treatment, Review) remain fully interactive — clicking them changes the step, which reveals the non-read-only condition/surface pickers. This breaks the readOnly contract: a user in readOnly mode can navigate to step 2 ("Condition") and interact with tooth state buttons and the ICD-10 input, even though the footer save button is hidden.

**Fix:** Disable step navigation buttons (or hide them) when `readOnly === true`, or guard each step's interactive controls with `{!readOnly && ...}`.

---

### WR-06: `use-save-treatment.ts` — `BigInt` serialization breaks JSON.stringify

**File:** `apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts:36`

**Issue:**
```typescript
priceCents: BigInt(Math.round(priceAmount * 100)),
```
`BigInt` values are not serializable by `JSON.stringify` — it throws `TypeError: Do not know how to serialize a BigInt`. If the SDK's generated `createDentalTreatment` uses `JSON.stringify` internally (standard for fetch-based clients), this will throw at runtime for every treatment save.

The test at line 166 uses `Number(parsed.priceCents)` to verify the value, meaning the test passes only if the SDK transparently converts BigInt — which it may do via a custom replacer. If it doesn't, the mutation always fails in production.

**Fix:** Use a regular number:
```typescript
priceCents: Math.round(priceAmount * 100),
```
If the API truly requires BigInt (e.g., the TypeSpec type is `int64`), confirm the SDK handles serialization — if not, use `String(BigInt(...))` and let the server parse it.

---

### WR-07: `$patientId.tsx` — duplicate `data-testid="view-profile-link"` and `data-testid="share-pmd-btn"`

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:219-237` and `272-293`

**Issue:** Both "Profile" link and "Share PMD" button appear twice in the JSX — once in the year filter bar (lines 219-237) and again inside the treatment table zone (lines 272-293). Both instances share the same `data-testid` values (`view-profile-link`, `share-pmd-btn`). Duplicate test IDs make automated tests unreliable (selectors match the wrong element) and indicate unintentional duplication of UI.

**Fix:** Remove the duplicate rendered inside `workspace-table-zone` (lines 272-293). The year filter bar placement is the intentional one per the wireframe.

---

## Info

### IN-01: `amendment-form.tsx` — `as` type cast suppresses body type safety

**File:** `apps/dentalemon/src/features/workspace/components/amendment-form.tsx:56`

```typescript
} as Parameters<typeof createAmendment>[0]['body'],
```

The cast silences TypeScript's structural check on the body. If the generated SDK type changes (e.g., field renamed), the cast prevents the type error from surfacing. Same pattern in `use-save-treatment.ts:38`.

**Fix:** Remove the cast and let TypeScript infer. If there is a genuine type mismatch, fix the shape of the object rather than suppressing.

---

### IN-02: `medical-history-sheet.tsx` — Escape key does not close sheet

**File:** `apps/dentalemon/src/features/workspace/components/medical-history-sheet.tsx:17-60`

The custom sheet implementation does not handle `keydown` Escape to close. All other modal/sheet components in the workspace (ConsentSheet, RxSheet via Radix Dialog) close on Escape. This violates consistency and accessibility expectations (ARIA dialog pattern requires Escape to close).

**Fix:** Add `useEffect` to listen for `Escape` while `open`:
```typescript
useEffect(() => {
  if (!open) return;
  function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [open, onClose]);
```

---

### IN-03: `tooth-slideout.tsx` — `clinicalNotes` has TODO but still shipped in data object

**File:** `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx:46-48`

The comment acknowledges `clinicalNotes` is "captured in UI but not persisted to backend in this iteration." It is still included in the `onSave` payload. Callers receiving this value may silently drop it or send it to an API field that doesn't exist, producing an unexpected 400 or silent data loss.

**Fix:** Either wire it fully or omit from the `onSave` payload until the backend field exists. Document clearly in the interface that this field is a no-op.

---

### IN-04: `use-treatment-plan.ts` — raw `fetch` bypasses SDK auth/error handling

**File:** `apps/dentalemon/src/features/workspace/hooks/use-treatment-plan.ts:46-50`

The comment notes "No SDK react-query option exists for this endpoint — intentional raw fetch." However, the raw fetch uses `credentials: 'include'` for cookie-based auth, which differs from how the SDK sends auth (Bearer token header in some configurations). If the API endpoint uses token auth, requests will fail with 401 silently appearing as `Failed to fetch treatment plan (401)`.

**Fix:** Confirm auth strategy matches the rest of the API. If Bearer tokens are used elsewhere, add the `Authorization` header here too; or route through the SDK client's transport layer.

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
