# Phase 10: Comparison + Smoke Test - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Side-by-side X-ray comparison view (IMG-17) with degraded offline UX when an image isn't cached (IMG-18), plus a Playwright smoke test covering the full offline workflow (upload → view → measure → annotate → save without network) and IMG-01–IMG-18 verification.

**In scope:**
- `ComparisonView` component: two independent `ImagingWorkspace` instances in a flex row
- Checkbox multi-select on `PatientImageList` + "Compare" button (max 2 selected)
- Degraded offline placeholder: when `getCachedBlob(imageId)` returns null, show gray placeholder + "Image not available offline" text instead of the image
- Playwright E2E smoke test: `imaging-comparison.spec.ts` covering the full workflow

**Out of scope:** Synchronized pan/zoom between panes (deferred), new backend endpoints (none needed), measurement/annotation features (phases 8–9)

</domain>

<decisions>
## Implementation Decisions

### Comparison Layout
**D1 — Two independent `ImagingWorkspace` instances in a flex row.**
No synchronized pan/zoom. Each pane controls its own zoom/pan state independently.
Implementation: `ComparisonView` renders `<div className="flex gap-2 h-full">` with two `ImagingWorkspace` instances side by side.
No changes to the existing `ImagingWorkspace` component needed.

### Image Selection UX
**D2 — Checkbox multi-select in `PatientImageList` + "Compare" button.**
User checks up to 2 images in the existing patient image list, then clicks "Compare ▶".
Button is disabled unless exactly 2 are selected.
On click: opens `ComparisonView` (likely as a sheet or full-screen overlay, matching existing sheet patterns).
No new picker modal needed.

### Degraded Offline UX
**D3 — Parent-level cache check, not inside `ImagingWorkspace`.**
`ComparisonView` calls `getCachedBlob(imageId)` for each pane on mount.
If blob is null: render a gray placeholder div with `"Image not available offline"` text instead of `ImagingWorkspace`.
If blob exists: pass `imageUrl` (object URL from blob) to `ImagingWorkspace` as normal.
`ImagingWorkspace` interface unchanged.

### Smoke Test
**D4 — Playwright E2E at `apps/dentalemon/tests/e2e/imaging-comparison.spec.ts`.**
Same harness pattern as `imaging-measurement.spec.ts` and `imaging-annotation.spec.ts`.
Covers: comparison view renders, offline placeholder shown when image not cached, full offline workflow (IMG-18 — upload → view → measure → annotate without network).
No manual walkthrough checklist — automated only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Imaging Components
- `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` — reuse as-is for both comparison panes
- `apps/dentalemon/src/features/imaging/components/patient-image-list.tsx` — extend with checkbox multi-select + Compare button
- `apps/dentalemon/src/features/imaging/hooks/use-offline-cache.ts` — `getCachedBlob(imageId)` returns `Blob | null`
- `apps/dentalemon/src/features/imaging/hooks/use-imaging-studies.ts` — existing data hook for image list

### E2E Test Pattern
- `apps/dentalemon/tests/e2e/imaging-measurement.spec.ts` — copy structure for comparison spec
- `apps/dentalemon/tests/e2e/imaging-annotation.spec.ts` — parallel pattern

### Requirements
- `.planning/REQUIREMENTS.md` §v1.3 Imaging Workspace — IMG-17 (comparison), IMG-18 (offline)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ImagingWorkspace` — takes `imageId`, `imageUrl`, `toolMode`, `modality`, `pixelSpacingMm` props. Fully self-contained. Mount two instances for comparison with no changes.
- `useOfflineCache` — `getCachedBlob(imageId): Promise<Blob | null>` and `setCachedBlob`. Use in `ComparisonView` to check both images on mount.
- `PatientImageList` — already renders image thumbnails with metadata. Extend with checkbox state (max 2) and Compare button.

### Established Patterns
- Sheet/overlay pattern: existing sheets (SoapNotesSheet, etc.) use `<Sheet>` from `@/components/sheet` — comparison view should follow same pattern for full-screen mode.
- `#FFE97D` lemon accent for interactive elements (toolbar buttons, active states).
- `role="alert"` for inline warnings (established in phase 8 panoramic warning).

### Integration Points
- `ComparisonView` receives two `imageId`s from `PatientImageList` selection state.
- Offline check in `ComparisonView.useEffect` → if blob null, show placeholder instead of workspace.
- No new routes needed — comparison opens as overlay within existing patient workspace.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond what's captured in decisions — open to standard approaches for layout details.

</specifics>

<deferred>
## Deferred Ideas

- **Synchronized pan/zoom** — useful for aligning the same tooth, deferred to v1.4 or later. Would require lifting offset/scale state out of `ImagingWorkspace` into a shared ref.

</deferred>

---

*Phase: 10-comparison-smoke-test*
*Context gathered: 2026-05-11*
