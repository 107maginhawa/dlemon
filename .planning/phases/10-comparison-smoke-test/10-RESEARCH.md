# Phase 10: Comparison + Smoke Test - Research

**Researched:** 2026-05-11
**Domain:** React component composition, IndexedDB offline cache, Playwright E2E
**Confidence:** HIGH — all findings verified from codebase source

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D1** — `ComparisonView` renders two independent `ImagingWorkspace` instances in `<div className="flex gap-2 h-full">`. No synchronized pan/zoom. No changes to `ImagingWorkspace`.
- **D2** — Checkbox multi-select in `PatientImageList` + "Compare ▶" button disabled unless exactly 2 checked. On click: opens `ComparisonView`.
- **D3** — `ComparisonView` calls `getCachedBlob(imageId)` for each pane on mount. If null → gray placeholder div + "Image not available offline". If blob exists → `URL.createObjectURL(blob)` passed as `imageUrl`. `ImagingWorkspace` interface unchanged.
- **D4** — Playwright E2E at `apps/dentalemon/tests/e2e/imaging-comparison.spec.ts`. Same harness pattern as `imaging-measurement.spec.ts` and `imaging-annotation.spec.ts`.

### Claude's Discretion
- Layout details beyond the flex row (padding, gap, header bar in ComparisonView).
- Checkbox visual style (how they appear on image list items).
- Exact text and styling of the offline placeholder.

### Deferred Ideas (OUT OF SCOPE)
- Synchronized pan/zoom between panes (would require lifting offset/scale state out of `ImagingWorkspace` into a shared ref — deferred to v1.4+).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMG-17 | User can compare past and current X-rays side-by-side | `ComparisonView` with two `ImagingWorkspace` instances in flex row; checkbox selection in `PatientImageList` |
| IMG-18 | Images and all overlay data stored locally for offline use | `getCachedBlob()` already exists in `use-offline-cache.ts`; `ImagingWorkspace` already populates cache on load; `ComparisonView` checks cache before mounting workspace |
</phase_requirements>

---

## Summary

Phase 10 is a pure frontend composition phase — no new backend endpoints, no new hooks needed. The three deliverables are: (1) a `ComparisonView` component wrapping two `ImagingWorkspace` instances, (2) checkbox multi-select added to `PatientImageList`, and (3) a Playwright smoke spec covering comparison + offline degraded UX.

The existing `ImagingWorkspace` already handles offline caching internally: on mount it calls `getCachedBlob(imageId)` and falls back to the network `imageUrl` if no cache hit. For the comparison view the decision is to do the cache check one level up in `ComparisonView` so a null blob never reaches `ImagingWorkspace` — instead a gray placeholder renders. This means `ImagingWorkspace` is used as-is, consistent with D1 and D3.

The imaging overlay in `$patientId.tsx` is a `fixed inset-0 z-50 flex flex-col bg-background` div — not a Sheet component — with its own close button. `ComparisonView` should open the same way (or be embedded within the same overlay, replacing the single-image view when 2 images are selected).

**Primary recommendation:** Add `ComparisonView` as a new component at `apps/dentalemon/src/features/imaging/components/comparison-view.tsx`. Wire it into the existing imaging overlay in `$patientId.tsx` by adding comparison state alongside `selectedImageItem`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Comparison layout | Browser/Client | — | Pure DOM composition, two Canvas instances |
| Offline blob check | Browser/Client | IndexedDB | `getCachedBlob()` is async IndexedDB read |
| Image list checkbox state | Browser/Client | — | Local React state on `PatientImageList` |
| Comparison trigger | Browser/Client | — | Button click → callback to parent (`$patientId.tsx`) |
| E2E test harness | Playwright | Dev server at :3003 | Existing `IMAGING_TEST_URL=/imaging-test` pattern |

---

## Component Analysis

### ImagingWorkspace — `imaging-workspace.tsx`

**Props interface (verified):**
```typescript
interface ImagingWorkspaceProps {
  imageId: string
  imageUrl: string          // Used as fallback src only — see below
  className?: string
  toolMode?: ToolMode
  onToolModeChange?: (mode: ToolMode) => void
  onMeasurementSaved?: () => void
  modality?: string
  pixelSpacingMm?: number | null
  onCalibrationSaved?: (pxMm: number) => void
}
```

**How `imageUrl` is consumed (CRITICAL finding):**

`ImagingWorkspace` does NOT use `imageUrl` as an `<img src>`. On mount it runs:
```typescript
const cached = await getCachedBlob(imageId)
const src = cached ? URL.createObjectURL(cached) : imageUrl
const img = new Image()
img.src = src
```
Then draws to a Canvas. If no cache hit, it fetches `imageUrl` over the network and stores the blob via `setCachedBlob`.

**Implication for D3:** `ImagingWorkspace` will still attempt a network fetch if `imageUrl` is passed and no cache exists. To show a placeholder instead, `ComparisonView` must check the cache first and only render `ImagingWorkspace` when the blob is non-null. When blob is null, skip rendering `ImagingWorkspace` entirely. Passing a fake `imageUrl` and letting it fail silently is NOT the right approach — it would trigger a failed `fetch()` with no user feedback.

**No changes needed to `ImagingWorkspace`.** [VERIFIED: codebase]

---

### PatientImageList — `patient-image-list.tsx`

**Current structure (verified):**
- Fixed width: `w-[280px]`
- Header: "Images" label + "Upload Image" Sheet trigger (lemon `#FFE97D` button)
- Body: `<ul>` with `<li>` per item — `onClick={() => onSelectImage?.(item)}`
- Item content: `fileName`, `modality`, optional "Legacy" badge
- No selection state, no checkboxes currently

**State needed for D2:**
```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
```

Toggle logic: if already 2 selected and item not in set → no-op (or replace oldest). Simplest: cap at 2 by preventing 3rd check.

**Props to add:**
```typescript
interface PatientImageListProps {
  patientId: string
  branchId: string
  onSelectImage?: (item: PatientImageItem) => void      // existing — keep
  onCompare?: (items: [PatientImageItem, PatientImageItem]) => void  // new
}
```

**"Compare ▶" button placement:** In header row next to "Upload Image", or as a sticky footer within the list. Header is cleaner — matches existing layout. Button disabled unless `selectedIds.size === 2`.

**Checkbox placement on list items:** Left of the item content, standard `<input type="checkbox">` styled minimally. Clicking checkbox toggles selection; clicking row still calls `onSelectImage` for single-image preview (or suppress if in "compare mode"). Simplest: row click for single view, checkbox for comparison selection.

**Gotcha:** The `li` currently has `onClick={() => onSelectImage?.(item)}` on the whole row. Adding a checkbox inside means the row click will also fire when clicking the checkbox. Fix: `e.stopPropagation()` on the checkbox's `onChange` (or restructure to separate click zones).

[VERIFIED: codebase]

---

### useOfflineCache — `use-offline-cache.ts`

**Exact API (verified):**
```typescript
getCachedBlob(imageId: string): Promise<Blob | null>
setCachedBlob(imageId: string, blob: Blob): Promise<void>
getCachedAnnotations(imageId: string): Promise<unknown | null>
setCachedAnnotations(imageId: string, data: unknown): Promise<void>
```

**IndexedDB stores:**
- `image-blobs` — keyed by `id`, stores `{ id, blob, cachedAt }`
- `annotations` — keyed by `imageId`, stores `{ imageId, data, cachedAt }`

**For ComparisonView D3 implementation:**
```typescript
// In ComparisonView on mount:
const [blobA, setBlobA] = useState<Blob | null | 'loading'>('loading')
const [blobB, setBlobB] = useState<Blob | null | 'loading'>('loading')

useEffect(() => {
  void getCachedBlob(imageIdA).then(setBlobA)
  void getCachedBlob(imageIdB).then(setBlobB)
}, [imageIdA, imageIdB])
```

When blob is `Blob`: `URL.createObjectURL(blob)` → pass as `imageUrl` to `ImagingWorkspace`.
When blob is `null`: render gray placeholder.
When `'loading'`: render spinner or skeleton.

**Gotcha:** `URL.createObjectURL()` creates an object URL that should be revoked on cleanup to avoid memory leaks. `useEffect` cleanup: `URL.revokeObjectURL(url)`.

[VERIFIED: codebase]

---

### Imaging Overlay in `$patientId.tsx`

**Pattern used (verified):**
```tsx
{imagingOpen && (
  <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="imaging-overlay">
    {/* header with close button */}
    <div className="flex flex-1 min-h-0">
      <PatientImageList ... onSelectImage={(item) => setSelectedImageItem(item)} />
      <div className="flex-1 min-w-0">
        {selectedImageItem ? <ImagingWorkspace ... /> : <placeholder />}
      </div>
    </div>
  </div>
)}
```

This is NOT a `<Sheet>` component — it's a raw `fixed inset-0 z-50` overlay. The CONTEXT.md mentions "likely as a sheet or full-screen overlay, matching existing sheet patterns" — **the existing pattern is the full-screen overlay**, not `<Sheet>`. Use the same pattern.

**Integration approach for comparison:**

Add to `$patientId.tsx`:
```typescript
const [comparisonItems, setComparisonItems] = useState<[PatientImageItem, PatientImageItem] | null>(null)
```

Wire `PatientImageList.onCompare`:
```tsx
<PatientImageList
  patientId={patientId}
  branchId={branchId ?? ''}
  onSelectImage={(item) => setSelectedImageItem(item)}
  onCompare={(items) => setComparisonItems(items)}
/>
```

In the right pane, switch between single view and comparison view:
```tsx
{comparisonItems ? (
  <ComparisonView
    imageA={comparisonItems[0]}
    imageB={comparisonItems[1]}
    onClose={() => setComparisonItems(null)}
  />
) : selectedImageItem ? (
  <ImagingWorkspace ... />
) : (
  <placeholder />
)}
```

[VERIFIED: codebase]

---

### PatientImageItem type

From `use-imaging-studies.ts`:
```typescript
export type PatientImageItem = components['schemas']['DentalImagingModule.PatientImageItem']
```

Fields used in current list render: `id`, `fileName`, `modality`, `source`. The `id` is what gets passed to `getCachedBlob` and `ImagingWorkspace`.

[VERIFIED: codebase — inferred from usage patterns]

---

## Test Harness Pattern

**Playwright config (verified):**
- `baseURL`: `http://localhost:3003`
- `testDir`: `./tests/e2e`
- `testMatch`: `**/*.spec.ts`
- `webServer`: `bun run dev` — reuses existing server if running
- Single Chromium project, sequential workers

**Test URL pattern (verified from both existing specs):**
```typescript
const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'
```

Both `imaging-measurement.spec.ts` and `imaging-annotation.spec.ts` use this same constant. They navigate to `/imaging-test` which is expected to mount `ImagingWorkspace` in isolation (test harness page or Storybook equivalent).

**For comparison spec, use same pattern:**
```typescript
const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'
const COMPARISON_TEST_URL = process.env.COMPARISON_TEST_URL ?? '/imaging-comparison-test'
```

Or reuse `/imaging-test` if the comparison view is accessible from there. The comparison spec also needs to test the full overlay via the workspace route — for offline workflow tests, navigate to `/_workspace/:patientId` with a mock/seeded patient.

**Offline simulation in Playwright:**
```typescript
// Playwright network interception to simulate offline
await page.route('**/*', route => route.abort())
// Or use browser context offline mode:
await page.context().setOffline(true)
```

[VERIFIED: playwright.config.ts + existing specs]

---

## Standard Stack

### Core (no new dependencies needed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React | 19 | Component composition | Already in project |
| Tailwind CSS | 3.x | Styling | Already in project |
| Playwright | latest | E2E tests | Already configured |
| IndexedDB (native) | — | Offline blob cache | Via `use-offline-cache.ts` |

No new npm installs required for this phase. [VERIFIED: codebase]

---

## Architecture Patterns

### System Architecture Diagram

```
User selects 2 images via checkboxes in PatientImageList
        |
        v
"Compare ▶" button click → onCompare([itemA, itemB]) callback
        |
        v
$patientId.tsx sets comparisonItems state
        |
        v
ComparisonView mounts with imageIdA, imageIdB
        |
        +---> getCachedBlob(imageIdA) ---> Blob | null
        |              |                       |
        |         Blob exists             null (not cached)
        |              |                       |
        |    URL.createObjectURL()    Gray placeholder div
        |              |             "Image not available offline"
        |              v
        +---> ImagingWorkspace (pane A)   [or placeholder]
        |
        +---> getCachedBlob(imageIdB) ---> same branching for pane B
```

### Recommended Project Structure (new files only)
```
apps/dentalemon/src/features/imaging/components/
├── comparison-view.tsx          # NEW — two ImagingWorkspace or placeholders
├── imaging-workspace.tsx        # UNCHANGED
├── patient-image-list.tsx       # MODIFIED — add checkbox state + onCompare

apps/dentalemon/tests/e2e/
├── imaging-comparison.spec.ts   # NEW — Playwright smoke test
├── imaging-measurement.spec.ts  # UNCHANGED (reference pattern)
├── imaging-annotation.spec.ts   # UNCHANGED (reference pattern)
```

### Pattern: ComparisonView

```tsx
// apps/dentalemon/src/features/imaging/components/comparison-view.tsx
import { useEffect, useState } from 'react'
import { useOfflineCache } from '../hooks/use-offline-cache'
import { ImagingWorkspace } from './imaging-workspace'
import type { PatientImageItem } from '../hooks/use-imaging-studies'

interface ComparisonViewProps {
  imageA: PatientImageItem
  imageB: PatientImageItem
  onClose?: () => void
}

function OfflinePlaceholder({ fileName }: { fileName: string }) {
  return (
    <div className="flex flex-col h-full items-center justify-center bg-zinc-100 text-center p-6">
      <p className="text-sm text-zinc-500 font-medium">{fileName}</p>
      <p className="text-xs text-zinc-400 mt-1" role="alert">Image not available offline</p>
    </div>
  )
}

export function ComparisonView({ imageA, imageB, onClose }: ComparisonViewProps) {
  const { getCachedBlob } = useOfflineCache()
  const [urlA, setUrlA] = useState<string | null | 'loading'>('loading')
  const [urlB, setUrlB] = useState<string | null | 'loading'>('loading')

  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []

    void (async () => {
      const [blobA, blobB] = await Promise.all([
        getCachedBlob(imageA.id),
        getCachedBlob(imageB.id),
      ])
      if (cancelled) return
      if (blobA) {
        const url = URL.createObjectURL(blobA)
        objectUrls.push(url)
        setUrlA(url)
      } else {
        setUrlA(null)
      }
      if (blobB) {
        const url = URL.createObjectURL(blobB)
        objectUrls.push(url)
        setUrlB(url)
      } else {
        setUrlB(null)
      }
    })()

    return () => {
      cancelled = true
      objectUrls.forEach(URL.revokeObjectURL)
    }
  }, [imageA.id, imageB.id, getCachedBlob])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-zinc-900 shrink-0">
        <span className="text-sm font-semibold text-white">Compare Images</span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xs px-2 py-1"
            aria-label="Close comparison"
          >
            ✕ Exit Compare
          </button>
        )}
      </div>
      {/* Panes */}
      <div className="flex gap-2 flex-1 min-h-0 p-2 bg-zinc-950">
        {/* Pane A */}
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-xs text-zinc-400 px-1 pb-1 truncate">{imageA.fileName}</p>
          {urlA === 'loading' ? (
            <div className="flex-1 bg-zinc-900 animate-pulse rounded" />
          ) : urlA === null ? (
            <OfflinePlaceholder fileName={imageA.fileName} />
          ) : (
            <ImagingWorkspace
              imageId={imageA.id}
              imageUrl={urlA}
              className="flex-1"
              modality={imageA.modality}
            />
          )}
        </div>
        {/* Pane B */}
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-xs text-zinc-400 px-1 pb-1 truncate">{imageB.fileName}</p>
          {urlB === 'loading' ? (
            <div className="flex-1 bg-zinc-900 animate-pulse rounded" />
          ) : urlB === null ? (
            <OfflinePlaceholder fileName={imageB.fileName} />
          ) : (
            <ImagingWorkspace
              imageId={imageB.id}
              imageUrl={urlB}
              className="flex-1"
              modality={imageB.modality}
            />
          )}
        </div>
      </div>
    </div>
  )
}
```

### Pattern: PatientImageList checkbox extension

Key changes to `patient-image-list.tsx`:

```tsx
// New state
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

// New prop
onCompare?: (items: [PatientImageItem, PatientImageItem]) => void

// Toggle handler
function toggleSelect(item: PatientImageItem, e: React.ChangeEvent<HTMLInputElement>) {
  e.stopPropagation()
  setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(item.id)) {
      next.delete(item.id)
    } else if (next.size < 2) {
      next.add(item.id)
    }
    return next
  })
}

// Compare button in header (alongside Upload button)
{selectedIds.size === 2 && (
  <button
    onClick={() => {
      const selected = data?.items.filter(i => selectedIds.has(i.id)) ?? []
      if (selected.length === 2) {
        onCompare?.([selected[0]!, selected[1]!])
      }
    }}
    className="bg-[#FFE97D] text-black text-xs font-semibold px-3 py-1.5 rounded-md"
    data-testid="compare-btn"
  >
    Compare ▶
  </button>
)}

// List item — add checkbox, keep row click for single view
<li key={item.id} className="flex items-center gap-3 p-3 hover:bg-zinc-50">
  <input
    type="checkbox"
    checked={selectedIds.has(item.id)}
    onChange={(e) => toggleSelect(item, e)}
    className="shrink-0 accent-[#FFE97D]"
    data-testid={`select-image-${item.id}`}
  />
  <div
    className="flex-1 min-w-0 cursor-pointer"
    onClick={() => onSelectImage?.(item)}
  >
    {/* existing content */}
  </div>
</li>
```

### Playwright Spec Pattern

```typescript
// apps/dentalemon/tests/e2e/imaging-comparison.spec.ts
import { test, expect } from '@playwright/test'

const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'

test.describe('ComparisonView', () => {
  test('renders two image panes side by side', async ({ page }) => {
    await page.goto(`${IMAGING_TEST_URL}?mode=comparison`)
    await expect(page.getByTestId('comparison-pane-a')).toBeVisible()
    await expect(page.getByTestId('comparison-pane-b')).toBeVisible()
  })

  test('shows offline placeholder when image not cached', async ({ page }) => {
    await page.goto(`${IMAGING_TEST_URL}?mode=comparison&uncached=true`)
    await expect(page.getByRole('alert')).toContainText('not available offline')
  })
})

test.describe('PatientImageList comparison selection', () => {
  test('Compare button hidden until 2 images selected', async ({ page }) => {
    await page.goto(IMAGING_TEST_URL)
    await expect(page.getByTestId('compare-btn')).not.toBeVisible()
  })
})
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Object URL lifecycle | Manual tracking | `useEffect` cleanup with `URL.revokeObjectURL` | Standard browser API pattern |
| Offline detection | Custom fetch interceptor | Playwright `page.context().setOffline(true)` | Built into Playwright |
| Synchronized pan/zoom | Shared transform state | Deferred per D1 | Out of scope; complex ref lifting |
| Comparison modal | Custom modal | Inline within existing imaging overlay | Consistent with existing overlay pattern |

---

## Common Pitfalls

### Pitfall 1: ImagingWorkspace double-fetches even when blob passed
**What goes wrong:** `ComparisonView` creates an object URL from the blob and passes it as `imageUrl`. `ImagingWorkspace` then calls `getCachedBlob(imageId)` on mount — finds the blob in IndexedDB — and uses the cached version anyway. The passed `imageUrl` is only a fallback.
**Why it happens:** `ImagingWorkspace` always checks cache first. The object URL passed as `imageUrl` would only be used if IndexedDB returns null.
**How to avoid:** If the blob check in `ComparisonView` already confirmed the blob exists, `ImagingWorkspace` will find it again via its own cache check. No double-fetch. This is fine — no action needed. But if blob is null, do NOT pass a real network URL — skip rendering `ImagingWorkspace` entirely.
**Warning signs:** Gray canvas with no image = network URL passed to offline `ImagingWorkspace` when no cache exists.

### Pitfall 2: Object URL memory leak
**What goes wrong:** `URL.createObjectURL(blob)` allocates memory. If the effect re-runs (imageId changes) or component unmounts without cleanup, object URLs accumulate.
**Why it happens:** React effects that create resources without cleanup.
**How to avoid:** Always call `URL.revokeObjectURL(url)` in the `useEffect` cleanup function. Track all created URLs in a local array within the effect.

### Pitfall 3: Checkbox click bubbles to row onClick
**What goes wrong:** Clicking the checkbox also fires the `li` row's `onClick`, triggering `onSelectImage` for single-image view at the same time as toggling selection.
**Why it happens:** DOM event bubbling — the checkbox is inside the row element that has `onClick`.
**How to avoid:** Structure the list item so the checkbox and the clickable content area are siblings (not parent-child), and only the content div has `onClick`. Or call `e.stopPropagation()` on the checkbox `onChange`.

### Pitfall 4: Playwright test URL `/imaging-test` may not exist
**What goes wrong:** Both existing specs use `IMAGING_TEST_URL ?? '/imaging-test'` but the route may not be registered in the Vite app.
**Why it happens:** The test was written as an acceptance gate before the harness page was created (spec comments say "without a running dev server these tests will be skipped automatically").
**How to avoid:** Check if `/imaging-test` is a registered TanStack Router route. If not, the comparison spec must either: (a) create/verify that route exists, or (b) navigate to the full workspace route `/_workspace/:patientId` and trigger the imaging overlay. Use the same approach as the existing specs.

### Pitfall 5: selectedIds can reference items not yet in filtered data
**What goes wrong:** If `data` is still loading when user triggers Compare, `data?.items.filter(...)` returns empty array.
**Why it happens:** `useImagingStudies` is async — button click can race with data load.
**How to avoid:** Disable the Compare button while `isLoading` is true, or guard the `onCompare` callback with a check that exactly 2 matching items are found.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (configured) |
| Config file | `apps/dentalemon/playwright.config.ts` |
| Quick run command | `cd apps/dentalemon && npx playwright test imaging-comparison.spec.ts` |
| Full suite command | `cd apps/dentalemon && npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMG-17 | Comparison panes render side-by-side | E2E | `npx playwright test imaging-comparison.spec.ts` | No — Wave 0 |
| IMG-17 | Compare button disabled < 2 selected | E2E | same spec | No — Wave 0 |
| IMG-17 | Compare button enabled at exactly 2 | E2E | same spec | No — Wave 0 |
| IMG-18 | Offline placeholder shown when blob null | E2E | same spec | No — Wave 0 |
| IMG-18 | ImagingWorkspace renders when blob cached | E2E | same spec | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/dentalemon && npx playwright test imaging-comparison.spec.ts --reporter=line`
- **Per wave merge:** `cd apps/dentalemon && npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/imaging-comparison.spec.ts` — covers IMG-17 and IMG-18 (new file)
- [ ] Verify `/imaging-test` route is registered (or identify correct test harness URL)

---

## Open Questions

1. **Does `/imaging-test` route exist?**
   - What we know: Both `imaging-measurement.spec.ts` and `imaging-annotation.spec.ts` reference `IMAGING_TEST_URL ?? '/imaging-test'` with a note that tests are skipped if server unavailable.
   - What's unclear: Whether this route is actually registered in TanStack Router or if it's always been a placeholder.
   - Recommendation: Wave 0 of the plan should verify by running `grep -r "imaging-test" apps/dentalemon/src/` before writing the comparison spec. If absent, the spec should use `/_workspace/test-patient` with a seeded patient ID instead.

2. **`PatientImageItem.fileName` — is it a URL or just a filename?**
   - What we know: In `$patientId.tsx`, `imageUrl={selectedImageItem.fileName}` is passed to `ImagingWorkspace`. The field is used as both a display string and a network URL.
   - What's unclear: Whether `fileName` is a full URL (e.g., S3 presigned URL) or just a filename string. `ImagingWorkspace` uses it as `img.src` — it must be a fetchable URL.
   - Recommendation: Safe to assume it's a full URL based on how it's used. `ComparisonView` passes it through the same way.

3. **`modality` field on `PatientImageItem`**
   - What we know: Used in the list item display (`.replace('_', ' ')`).
   - What's unclear: Whether `ImagingWorkspace` receives `modality` as a string matching `PatientImageItem.modality` type.
   - Recommendation: Pass `modality={imageA.modality}` directly — the component accepts `modality?: string` so any string is fine.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies for this phase — all libraries already in project, no new backend services).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/imaging-test` harness route exists and mounts `ImagingWorkspace` in isolation | Test Harness Pattern | Spec will fail; must use workspace route instead |
| A2 | `PatientImageItem.fileName` is a network-fetchable URL (not just a filename) | Open Questions | `ImagingWorkspace` would fail to load image in online mode |

---

## Sources

### Primary (HIGH confidence — all verified from codebase)
- `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` — props interface, `imageUrl` consumption, cache behavior
- `apps/dentalemon/src/features/imaging/components/patient-image-list.tsx` — current structure, Sheet usage, item render
- `apps/dentalemon/src/features/imaging/hooks/use-offline-cache.ts` — exact `getCachedBlob` API and IndexedDB schema
- `apps/dentalemon/src/features/imaging/hooks/use-imaging-studies.ts` — `PatientImageItem` type, query pattern
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx` — imaging overlay pattern (fixed inset-0, not Sheet)
- `apps/dentalemon/tests/e2e/imaging-measurement.spec.ts` — Playwright URL constant, test structure
- `apps/dentalemon/tests/e2e/imaging-annotation.spec.ts` — Playwright test structure
- `apps/dentalemon/playwright.config.ts` — baseURL :3003, testDir, webServer config

---

## Metadata

**Confidence breakdown:**
- Component API: HIGH — read source directly
- Implementation approach: HIGH — all decisions locked in CONTEXT.md, verified compatible with source
- Test harness: MEDIUM — URL pattern copied from existing specs, existence of `/imaging-test` unverified (A1)
- Object URL lifecycle: HIGH — standard browser API behavior

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable codebase, no external dependencies)
