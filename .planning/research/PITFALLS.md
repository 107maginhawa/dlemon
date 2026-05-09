# Domain Pitfalls

**Domain:** Dental practice management — assembly/wiring milestone
**Researched:** 2026-05-06
**Focus:** Wiring 5 orphaned components, action bar, placeholder tabs, payments, attachments

---

## Critical Pitfalls

Mistakes that cause rewrites or major regressions.

### Pitfall 1: Raw fetch() Bypasses TanStack Query Cache — Stale Data After Mutation

**What goes wrong:** The 5 orphaned components (RxSheet, ConsentSheet, LabOrdersSheet, PMDImport, PaymentPlanView) use raw `fetch()` for both reads and writes. When a user creates a prescription via RxSheet, the workspace treatment list (driven by `useQuery(['dental-treatments', visitId])`) never gets invalidated. The user sees stale data until a manual page refresh. Worse, if another component's `useQuery` re-fetches the same endpoint, TanStack Query serves its cache — which never knew about the raw fetch write.

**Why it happens:** These components were built in isolation before the TanStack Query mutation hooks (useSaveTreatment, useSaveChart, etc.) were extracted. They pre-date the v1.1 hook extraction.

**Consequences:**
- Prescription saved but Rx count in action bar stays at 0
- Lab order created but treatment plan tab still shows old data
- Consent signed but consent badge doesn't update
- User thinks the operation failed — tries again — creates duplicates

**Prevention:**
- For writes: wrap each component's save handler in a `useMutation` with `onSuccess` that calls `queryClient.invalidateQueries()` for all related query keys
- For reads (LabOrdersSheet `load()`): replace with `useQuery` so data participates in cache
- Minimum viable fix if NOT refactoring to hooks: call `queryClient.invalidateQueries()` in the raw fetch `.then()` path for the specific query keys that other components depend on
- Pattern to follow: `useSaveTreatment` in `use-save-treatment.ts` — mutationFn wraps fetch, onSuccess invalidates `['dental-treatments', visitId]`

**Detection:** After saving in any sheet, check if the workspace tab/action bar/badge reflects the new count without refresh.

**Query keys that must be invalidated per component:**

| Component | After save, invalidate |
|-----------|----------------------|
| RxSheet | `['dental-visits', patientId]`, `['dental-prescriptions', visitId]` |
| ConsentSheet | `['dental-visits', patientId]`, `['dental-consents', visitId]` |
| LabOrdersSheet | `['dental-lab-orders', visitId]` |
| PMDImport | `['dental-pmd', patientId]` |
| PaymentPlanView (read-only currently) | N/A — but if adding "mark paid" action, invalidate `['invoices']` |

---

### Pitfall 2: z-index War Between Custom Overlays and Radix Sheet

**What goes wrong:** All 5 orphaned components render their own `fixed inset-0 z-40` overlay with a custom backdrop. The shared `Sheet` component (Radix Dialog) uses `z-50`. If the action bar opens a Radix `<Sheet>` that then opens an orphaned component (e.g., clicking "New Rx" inside a Sheet), the orphaned component's `z-40` renders BEHIND the Radix Sheet's `z-50` overlay. The form is invisible but still captures focus.

**Why it happens:** Two overlay systems coexist: hand-rolled divs (z-40) and Radix portals (z-50). Neither knows about the other.

**Consequences:**
- Invisible form capturing keyboard input
- User cannot close either overlay (click events trapped)
- Escape key closes wrong layer

**Prevention:**
- Option A (recommended): Wrap each orphaned component inside the existing Radix `<Sheet>` / `<SheetContent side="bottom">`. Remove the hand-rolled overlay div from the component. The orphaned component becomes just the form body, not the overlay container.
- Option B (quick fix): Change orphaned components to z-50 to match Radix. But this doesn't fix focus management — Radix manages focus trapping, hand-rolled divs don't.
- Never nest a hand-rolled modal inside a Radix portal.

**Detection:** Open tooth slideout (if it uses Sheet), then try to open RxSheet from an action bar button. Check if the sheet is visible and interactive.

---

### Pitfall 3: PMDViewer Has No open/onClose Props — Cannot Be Sheet-Wrapped

**What goes wrong:** PMDViewer accepts `{ pmd: PMDDocument }` only. It renders content inline — no overlay, no open/close state. Attempting to use it like the other 4 components (`<PMDViewer open={true} onClose={fn} />`) fails at compile time. A developer wrapping it in `<Sheet>` must also add: (a) a PMD-fetching query, (b) loading/error states, (c) the Sheet open/close wiring.

**Why it happens:** PMDViewer was designed as a content display component, not a sheet. The other 4 were designed as self-contained sheets.

**Consequences:**
- If treated like other sheets, compile error or runtime blank render
- If naively wrapped, missing loading state = blank sheet flashes before data arrives
- Missing error state = silent failure when PMD endpoint 404s

**Prevention:**
- Create a `PMDViewerSheet` wrapper component that:
  1. Accepts `{ patientId, visitId, open, onClose }`
  2. Uses `useQuery(['dental-pmd', visitId])` to fetch the PMD
  3. Renders `<Sheet open={open} onOpenChange={onClose}><SheetContent side="bottom"><PMDViewer pmd={data} /></SheetContent></Sheet>`
  4. Shows skeleton while loading, error state on failure
- Do NOT modify PMDViewer itself — it's a pure display component, keep it that way

**Detection:** Check that PMDViewer wrapper shows loading skeleton when sheet opens, not a blank flash.

---

### Pitfall 4: prescriberMemberId Must Come From Auth Context, Not URL Params

**What goes wrong:** RxSheet requires `prescriberMemberId` as a prop. The dashboard `_dashboard.tsx` already fetches org context and stores `currentMemberId` in localStorage (line 43). But if the workspace route (`_workspace.tsx`) doesn't have access to this value, the developer invents a workaround — hardcoding, passing via URL search params, or creating a redundant API call.

**Why it happens:** The workspace layout (`_workspace.tsx`) has no `beforeLoad` that populates the member context. Only `_dashboard.tsx` does. If a patient workspace page is rendered under `_workspace` instead of `_dashboard`, localStorage may be empty.

**Consequences:**
- Prescription saved with null/empty prescriberMemberId — backend may reject or save corrupt data
- Audit trail broken — no record of who prescribed
- If hardcoded for dev, production gets wrong prescriber ID

**Prevention:**
- Read from `localStorage.getItem('currentMemberId')` — already populated by `_dashboard.tsx` beforeLoad
- Add a guard: if `!currentMemberId`, show an error message instead of the form
- If workspace pages can be reached without going through `_dashboard`, replicate the org context fetch in `_workspace.tsx` beforeLoad
- Never pass prescriberMemberId via URL search params — it's PII-adjacent and can be tampered with

**Detection:** Open workspace directly via URL (not via sidebar navigation). Check if prescriberMemberId is populated.

---

## Moderate Pitfalls

### Pitfall 5: Action Bar Fights Layout Footer for Bottom Space

**What goes wrong:** The current workspace layout has a comment: "Payment footer is rendered by the child page to access treatments state." The new action bar is also a bottom-pinned element. If both render, the user sees two overlapping bars or a double-height footer area that pushes content off-screen.

**Prevention:**
- The action bar REPLACES the payment footer, not supplements it. It should contain: sheet trigger buttons (Rx, Consent, Lab Orders, PMD, PMD Import) + the existing payment summary/button.
- Use a single `<footer>` element with `sticky bottom-0` or `fixed bottom-0` — never two competing fixed footers.
- The action bar needs access to treatments state (for the payment total) — hoist state or use a shared query.

---

### Pitfall 6: ConsentSheet Signature Canvas Breaks on Touch Devices

**What goes wrong:** ConsentSheet uses `onMouseDown/onMouseMove/onMouseUp` for drawing. These don't fire on touch devices (iPad, phone). The canvas appears but drawing doesn't work.

**Prevention:**
- Add `onTouchStart`, `onTouchMove`, `onTouchEnd` handlers alongside mouse events
- The canvas already has `touch-none` CSS class — this prevents scroll but doesn't enable drawing
- Extract touch coordinates from `e.touches[0].clientX/clientY`
- Out of scope for v1.2 (iPad deferred) but flag it so it's not forgotten for v1.3

---

### Pitfall 7: Treatment Plan Tab — "Coming in PR2" Placeholder Has No Data Contract

**What goes wrong:** The placeholder is replaced with a component that fetches treatments, but the query key or endpoint doesn't match what `useSaveTreatment` invalidates. New treatments don't appear in the tab.

**Prevention:**
- Treatment plan tab must use `useQuery(['dental-treatments', visitId])` — the EXACT query key that `useSaveTreatment.onSuccess` invalidates
- Verify the endpoint returns treatments with status `planned` (not just `diagnosed`)
- The tab should show: CDT code, description, tooth number, surfaces, price, status — all fields that `SaveTreatmentInput` writes

---

### Pitfall 8: File Upload Size/Type Validation Missing on Client

**What goes wrong:** The attachments component sends files to the storage API without client-side validation. A user uploads a 500MB CBCT scan or a `.exe` file. The request hangs or the backend rejects it after a long upload — bad UX.

**Prevention:**
- Validate before upload:
  - Max file size: 25MB for clinical photos, 100MB for DICOM/STL (configurable)
  - Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`, `application/dicom`, `model/stl`
  - Show error inline before the upload starts
- Use the dental-clinical attachment module endpoints (not generic `/storage/upload`) — they enforce clinical file types server-side
- Show upload progress (XHR or fetch with ReadableStream) — don't leave user staring at a spinner

---

### Pitfall 9: Payment Amount Floating-Point Precision

**What goes wrong:** Treatment prices are stored as `priceAmount` (likely a float/decimal) or `priceCents` (integer). If the quick payment modal sums prices using floating-point addition, `0.1 + 0.2 = 0.30000000000000004` appears in the total. Worse, if the payment API expects cents but the frontend sends dollars, the charge is 100x wrong.

**Prevention:**
- All monetary arithmetic MUST use integer cents (`priceCents` / `amountCents`)
- The codebase already uses `amountCents` in PaymentPlanView and `priceCents` in PMDViewer — follow this convention
- Display: divide by 100 only at render time with `toFixed(2)`
- The existing `formatCents()` function in `payment-plan-view.tsx` is the correct pattern — reuse it
- Never use `parseFloat()` on user-entered amounts without immediately converting to cents: `Math.round(parseFloat(input) * 100)`

---

### Pitfall 10: Orphaned Component State Not Reset on Sheet Close

**What goes wrong:** RxSheet uses `if (!open) return null` — when reopened, React re-mounts and state resets via `useState` defaults. This works. But LabOrdersSheet uses `useEffect([open])` to reset — if the effect dependencies are wrong, stale data from the previous open persists.

**Prevention:**
- Prefer the Radix Sheet `open/onOpenChange` pattern over conditional rendering — Radix handles mount/unmount cleanly
- If keeping conditional render (`if (!open) return null`), verify that ALL useState hooks reset on re-mount (they do by default)
- If using `useEffect` for reset, ensure the dependency array includes `open` AND the entity IDs (visitId, patientId) — LabOrdersSheet already does this correctly with `[open, visitId]`
- Test: open sheet, fill form partially, close, reopen — verify form is clean

---

## Minor Pitfalls

### Pitfall 11: Duplicate Close Buttons After Sheet Wrapping

**What goes wrong:** Each orphaned component has its own close button (top-right X). The Radix `<SheetContent>` also renders a close button. After wrapping, the user sees two X buttons.

**Prevention:** When wrapping in Radix Sheet, either:
- Remove the orphaned component's close button
- Or pass `closeButton={false}` / remove the `<SheetPrimitive.Close>` from SheetContent via a custom variant

### Pitfall 12: Consent Sheet Two-Step Save Creates Partial State on Network Failure

**What goes wrong:** ConsentSheet creates the form (POST), then signs it (POST /sign). If the second call fails, a consent form exists in the database as "unsigned" — but the UI already called `onClose()`. The user doesn't know the form is half-created.

**Prevention:**
- Don't call `onClose()` until BOTH requests succeed
- If sign fails, show the error but keep the sheet open with the form ID, allowing retry
- Already partially handled (error set, sheet stays open) but the flow is fragile — the first POST created state that needs cleanup if abandoned

### Pitfall 13: Missing Keyboard/Accessibility Trap in Hand-Rolled Overlays

**What goes wrong:** The hand-rolled `fixed inset-0` overlays don't trap focus. Tab key moves focus behind the overlay to sidebar links. Screen readers announce the wrong context.

**Prevention:** Wrapping in Radix Sheet fixes this automatically — Radix provides focus trap, escape-to-close, and aria attributes. Another reason to prefer Option A in Pitfall 2.

---

## Phase-Specific Warnings

| Phase/Task | Likely Pitfall | Mitigation |
|------------|---------------|------------|
| Action bar + sheet wiring | #2 z-index war, #5 double footer | Use Radix Sheet wrapper, single footer element |
| RxSheet wiring | #1 stale cache, #4 prescriberMemberId | Add useMutation + invalidation, read from localStorage |
| ConsentSheet wiring | #6 touch events, #12 partial save | Flag touch for v1.3, keep sheet open on sign failure |
| LabOrdersSheet wiring | #1 stale cache, #10 state reset | Replace load() with useQuery, verify useEffect deps |
| PMDViewer wiring | #3 no open/onClose props | Create PMDViewerSheet wrapper with query + loading state |
| PMDImport wiring | #1 stale cache | Add invalidation for PMD query keys |
| Treatment Plan tab | #7 query key mismatch | Use exact key `['dental-treatments', visitId]` |
| Attachments | #8 file validation | Client-side size/type check, use dental-clinical endpoints |
| Quick payment modal | #9 float precision | Integer cents everywhere, formatCents() for display |
| All sheet wrapping | #11 duplicate close, #13 a11y | Remove orphan close button OR customize SheetContent |

---

## Sources

- Direct code inspection: `rx-sheet.tsx`, `consent-sheet.tsx`, `lab-orders-sheet.tsx`, `pmd-viewer.tsx`, `pmd-import.tsx`, `payment-plan-view.tsx`
- Established pattern: `use-save-treatment.ts` (useMutation + invalidateQueries)
- Radix Sheet: `components/sheet.tsx` (z-50, Portal, focus trap)
- Dashboard auth context: `routes/_dashboard.tsx` (localStorage.setItem('currentMemberId'))
- Workspace layout: `routes/_workspace.tsx` (no beforeLoad context fetch)
- TanStack Query cache model (HIGH confidence — Context7 verified in prior sessions)
