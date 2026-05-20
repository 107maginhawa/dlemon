# Workspace Reconciliation Design Spec

**Date:** 2026-05-09
**Status:** Draft
**Scope:** Reconcile sample-workspace UI/UX with dentalemon's backend-wired workspace. Fix all known issues. Add pediatric dentition. Migrate manual routes to TypeSpec pipeline.

---

## 1. Context & Motivation

The dentalemon app has two workspace implementations:

- **`apps/sample-workspace`** — A standalone Vite prototype with polished UI (coverflow carousel, interactive dental chart, surface selector, breakdown table). Uses mock data, no backend. Ported from MYCURE.
- **`apps/dentalemon/src/features/workspace/`** — The production workspace. 17 components, 14 hooks, fully wired to the backend via generated SDK (48+ dental API functions). Has more features (Rx, Consent, Lab Orders, Attachments, Payment, Medical History, PMD) but visual/interaction quality lags behind sample-workspace.

**Problem:** The production workspace has broken connections, visual regressions, orphaned components, no-op handlers, and inconsistent patterns. The sample-workspace's UI quality needs to be brought into the production app while preserving all backend wiring.

**Additional problem:** 41 dental API routes bypass the TypeSpec pipeline (manually registered with inline Zod validation). This is a documented anti-pattern that should be fixed as part of this work using vertical slices.

---

## 2. Design Decisions (Validated)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chart accumulation | Cumulative (copy previous state) | Industry standard, backend supports it |
| Visit creation | Both check-in and walk-in | Backend implements both paths |
| Historical tooth tap | View-only + amendment | Legal requirement, amendment API exists |
| Treatment table | Passive display + smart carry-over | Clinical workflow, backend has `carriedOver` flag |
| Table interactivity | Limited: mark done, dismiss, edit price, add note | Clinical data via slideout, business data inline |
| CDT code selection | Hybrid: favorites/recent + search + specialty browse | 90% of work uses ~20 codes |
| Chart visual language | Color + icon overlay | Industry standard, scales to 9+ states |
| Numbering system | FDI (ISO 3950) everywhere, Universal only for SVG filenames | International standard, backend uses FDI |
| Pediatric dentition | Implement now | Backend supports deciduous + mixed |
| Visit closure | Two-step: Complete then Lock | Clinical vs administrative closure separation |
| Auto-lock | 60 days after completion (configurable per org) | Safety net; 60 days allows insurance adjudication |
| TypeSpec migration | Vertical slices (per-feature) | Aligned with Vertical TDD protocol |

---

## 3. Architecture

### 3.1 Workspace Layout (Single Screen)

```
+---------------------------------------------+
| TOP BAR                                      |
| [Avatar] Name, Age | Safety Floor | Actions  |
+---------------------------------------------+
| YEAR FILTER [All] [2026] [2025] ...          |
+---------------------------------------------+
|                                              |
|   CAROUSEL (Swiper EffectCoverflow)          |
|   <- [past] [past] [ACTIVE] [past] ->       |
|   Each card = visit chart snapshot           |
|                                              |
+---------------------------------------------+
| TREATMENT TABLE                                    |
| Tooth | Surface | Cond | Tx Plan | CDT | Status | $|
| --- carried over (dimmed) ---                |
| --- current visit ---                        |
| Estimated: P X,XXX    |    Checkout: P X,XXX |
+---------------------------------------------+
```

When tooth is tapped, slideout opens from right:

```
+-----------------------------+---------------+
|                             | TOOTH SLIDEOUT |
|  WORKSPACE (dimmed)         | 4-step wizard  |
|                             |                |
+-----------------------------+---------------+
```

### 3.2 Data Flow

- All data via generated SDK hooks (TanStack Query) — zero raw `fetch()`
- Visit list query → carousel cards
- Each card fetches its own chart via `getDentalChart(visitId)`
- Active card's treatments → treatment table via `listDentalTreatments(visitId)`
- Carry-overs loaded on visit creation (backend copies from previous visit)
- Tooth history in slideout via `getToothHistory(patientId, toothNumber)`
- All mutations invalidate relevant query keys
- Org context via Zustand store (reactive subscription, not imperative `getState()`)

### 3.3 Numbering

- **FDI notation** (ISO 3950) used in all UI, API calls, data storage
- **Universal numbering** (1-32) used only as SVG filename keys
- Adapter layer in `dental-chart.helpers.ts` converts FDI ↔ Universal at SVG boundary
- Adult permanent: FDI 11-48 (32 teeth)
- Pediatric deciduous: FDI 51-85 (20 teeth)
- Mixed dentition: both sets displayed

---

## 4. Component Specifications

### 4.1 Carousel (`TimelineCarousel`)

**Visual:** Swiper.js EffectCoverflow with exact config from sample-workspace:
```typescript
effect: 'coverflow',
coverflowEffect: { rotate: 35, depth: 200, scale: 0.72, slideShadows: false },
centeredSlides: true,
slidesPerView: 'auto',
pagination: { clickable: true },
keyboard: { enabled: true }
```

**Behavior:**
- Each card represents one visit, ordered chronologically (oldest left, newest right)
- Active/draft visit card: amber border (#FFCC5E), full opacity, editable
- Completed visit cards: grey border, 85% opacity, read-only (view + amend)
- Locked visit cards: grey border, lock icon badge, 80% opacity, fully immutable
- "New Visit" button rendered below the carousel (matching current implementation at `timeline-carousel.tsx` line 116), not as a card. For walk-ins, also accessible from top bar action menu.
- Swiping changes which visit's treatments populate the table below
- Year filter controls which visits appear

**Data:** Each card independently queries `getDentalChart(visitId)` for its teeth array. Cards lazy-load chart data as they enter the viewport (Swiper's `slidesPerView` + buffer).

**New visit creation:**
- Copies previous visit's tooth states (cumulative charting)
- Backend `createDentalVisit` returns the new visit; frontend then calls `upsertDentalChart` with carried-forward teeth
- Carried-over treatments appear automatically (backend handles `carriedOver` flag)

### 4.2 Dental Chart (`DentalChart`)

**Layout:**
- Adult: 2 rows of 16 teeth. Upper arch: 18→11, 21→28. Lower arch: 48→41, 31→38. Midline dashed separator.
- Pediatric: 2 rows of 10 teeth. Upper: 55→51, 61→65. Lower: 85→81, 71→75.
- Mixed: adult grid with deciduous teeth rendered as smaller overlays in their anatomical positions.

**Visual language (color + icon):**

| State | Color | Icon Overlay |
|-------|-------|-------------|
| healthy | #4CAF50 (green) | none |
| caries | #F44336 (red) | dot/cavity mark |
| fractured | #FF5722 (deep orange) | crack line |
| filled | #2196F3 (blue) | filled area indicator |
| crown | #9C27B0 (purple) | crown cap symbol |
| missing | #9E9E9E (grey) | empty outline (dashed) |
| implant | #00BCD4 (cyan) | screw/post icon |
| extracted | #757575 (dark grey) | X mark |
| watchlist | #FFC107 (amber) | eye/watch icon |

**Legend:** Horizontal bar below chart. Tapping a legend item toggles highlight filter.

**Interaction:**
- Tap tooth on active card → opens slideout wizard
- Tap tooth on historical card → opens read-only slideout with amendment option
- Hover/long-press → tooltip with tooth name and current state

**SVG rendering:** Reuse sample-workspace's SVG system (`universal-tooth.tsx`, `svg-utils.ts`) adapted to:
- Accept FDI numbers, convert internally to Universal for SVG file lookup
- Support icon overlays (additional SVG elements positioned over base tooth)
- Support pediatric tooth SVGs (when assets are available, fall back to scaled adult SVGs)

### 4.3 Tooth Slideout (`ToothSlideout`)

**4-step wizard, slides in from right edge.**

> **Note:** The current implementation has 4 steps (condition → surface → treatment → review). This spec restructures to: overview → surface & condition → treatment → review. Step 1 (Overview with tooth history) is **net new** — requires `getToothHistory` integration and a new UI component. Steps 2-4 are reconciled from existing steps.

**Step 1 — Overview (NEW):**
- Tooth FDI number, name (e.g., "Upper Right Third Molar"), type
- Current state with color+icon badge
- History timeline: compact chronological list from `getToothHistory`
  - Each entry: date, condition found, treatment performed, visit link
- "Continue" to proceed, "X" to close

**Step 2 — Surface & Condition:**
- Interactive 5-surface SVG diagram (from sample-workspace's `SurfaceSelector`)
  - Posterior: Mesial, Distal, Buccal, Lingual, Occlusal
  - Anterior: Mesial, Distal, Labial, Lingual, Incisal
  - Tap to toggle selection (multi-select)
- Condition picker grid below with color chips
- Live preview: selected surfaces color with chosen condition on the diagram
- "Continue" when at least one surface + condition selected

**Step 3 — Treatment:**
- **Favorites/Recent** section (top) — most-used CDT codes for this dentist member
  - Persisted via localStorage keyed by `memberId` (no backend needed)
  - Auto-populated from usage frequency
- **Search** (middle) — type-ahead filtering all CDT codes
- **Specialty tabs** (bottom) — General, Ortho, Endo, Perio, Prostho, Oral Surgery, Pedia, Cosmetic
  - Each tab shows categorized CDT codes with descriptions and default prices
- Selecting a code fills: CDT code, description, default price (editable)
- Notes text area for clinical notes
- "Continue" when code selected

**Step 4 — Review & Save:**
- Summary card showing: tooth (FDI), surfaces, condition, treatment, CDT code, price, notes
- Buttons:
  - "Save" → calls `useSaveToothFlow` (upsert chart + create treatment), closes slideout
  - "Save & Next" → saves, keeps slideout open, waits for next tooth tap
  - "Back" → return to previous step
  - "Cancel" → discard and close

**Historical variant (read-only):**
- Shows Step 1 content only (overview + history)
- Displays what was recorded at that specific visit
- "Add Amendment" button → opens amendment form:
  - Original record reference (auto-filled)
  - Reason (required dropdown: correction, additional finding, clarification)
  - Content (free text)
  - Saves via `createAmendment`, stamped with author and timestamp

### 4.4 Treatment Table (`TreatmentTable`)

**Columns:** Tooth | Surface | Condition | Treatment Plan | CDT Code | Status | Total (PHP)

**Row types:**
- **Carried-over** (dimmed background, source visit date badge): treatments from prior visits still in `diagnosed` or `planned` status
- **Current visit** (full color): treatments added this session

**Interactive cells:**
- **Status chip** — tap to cycle: `planned` → `performed` (most common action). Calls `updateDentalTreatment` with new status.
- **Dismiss** — context menu on carried-over rows. Requires reason selection (patient declined, no longer indicated, deferred). Calls `updateDentalTreatment` with `dismissed` status + reason.
- **Price** — tap to inline edit. Updates via `updateDentalTreatment`.
- **Note** — tap to expand inline text field. Updates via `updateDentalTreatment`.

**Non-editable cells:** tooth, surface, condition, CDT code (correct via slideout).

**Dual footer:**
- **Estimated:** sum of all treatments (`diagnosed` + `planned` + `performed` + `verified`)
- **Checkout:** sum of billable treatments only (`performed` + `verified`)

**Actions:**
- "Checkout" button → opens payment modal
- "Complete Visit" button → opens pre-completion checklist

### 4.5 Top Bar (`WorkspaceTopBar`)

**Layout:** Frosted glass bar (matching sample-workspace `header-bar` aesthetic).

- **Left zone:** Patient avatar (from profile photo or initials fallback) + full name + age
- **Center zone:** Safety floor badges
  - Red pills: active allergies (from medical history)
  - Blue pills: active medications
  - Amber pills: active conditions
  - Tap any pill → expands to full Medical History sheet
- **Right zone:** Action icon buttons (left to right):
  - Rx (prescription) → opens RxSheet
  - Consent → opens ConsentSheet
  - Lab → opens LabOrdersSheet
  - Attachments → opens AttachmentsSheet
  - Notes → opens SOAP Notes sheet
  - Complete Visit → triggers completion flow
  - Fullscreen toggle (functional, not no-op)

### 4.6 Clinical Sheets

All sheets render as bottom sheets (Shadcn Sheet component) overlaying the workspace.

**RxSheet:**
- Form: drug name (RxNorm searchable), dosage, frequency, duration, quantity, instructions, dispense-as-written toggle
- Validation: all fields required except instructions
- List of visit prescriptions below form
- SDK: `createPrescription`, `listPrescriptions`, `updatePrescription`

**ConsentSheet:**
- Template selector → pre-fills consent text
- Editable text area
- Signature canvas: supports mouse AND touch events (`onPointerDown/Move/Up` for universal input)
- Clear signature button
- Sign button → immutable after signing
- SDK: `createConsentForm`, `listConsentForms`, `signConsentForm`

**LabOrdersSheet:**
- Create form: lab name, description, expected delivery date
- Order list with status progression buttons (forward-only state machine)
- Status: `ordered` → `inFabrication` → `delivered` → `fitted` (or `cancelled` from any)
- Defective flag + replacement order linking
- **Migrate from imperative useState to TanStack Query hooks**
- SDK: `createLabOrder`, `listLabOrders`, `updateLabOrder`

**AttachmentsSheet:**
- Upload: drag-and-drop + tap-to-browse (50MB limit per file)
- Image type chips: X-ray, Photo, Scan, Document, Other
- Tooth tagger: select FDI numbers this attachment relates to
- Thumbnail grid with download/delete actions
- Multi-step upload: get presigned URL → PUT to S3 → complete → create record
- SDK: `createAttachment`, `listAttachments`, `deleteAttachment`

**SOAP Notes Sheet:**
- Structured form: Subjective, Objective, Assessment, Plan fields + free-text notes
- Auto-save on blur (debounced)
- SDK: `upsertVisitNotes`, `getVisitNotes`

**Medical History Sheet** (via safety floor tap):
- Sections: Conditions (ICD-10), Medications (RxNorm), Allergies (SNOMED), Surgical History, Vaccinations, Family History
- Each entry: code, display name, notes, onset date, active toggle
- Preset quick-add buttons for common items
- Lifestyle fields: pregnancy status, smoking, alcohol
- SDK: `listMedicalHistory`, `createMedicalHistoryEntry`, `updateMedicalHistoryEntry`

### 4.7 Payment Modal (`WorkspacePaymentModal`)

- Shows `performed`/`verified` treatment line items with CDT codes and prices
- Subtotal, discount (percentage), tax, total calculation
- Payment method: cash, card, bank transfer
- Creates invoice from billable treatments (`createDentalInvoice`)
- Records payment (`recordDentalPayment`)
- Payment plan option for partial payment (`createDentalPaymentPlan`)
- Receipt generation
- Invoice status banner (draft/issued/partial/paid/overdue/voided)

### 4.8 Visit Lifecycle UI

**Complete Visit flow:**
1. "Complete Visit" button (top bar or table footer)
2. Pre-completion checklist modal:
   - Unsigned consent forms? (warning)
   - Treatments still `planned`? (warning with count)
   - Missing SOAP notes? (warning)
   - Each is a warning, not a blocker — dentist can override
3. Confirm → `updateDentalVisit(visitId, { status: 'completed' })`
4. Card slides back in carousel, visual treatment changes to completed state
5. Treatment table remains visible for billing

**Lock Visit flow:**
- Available on completed visits only
- Can be triggered from visit context menu or Pending Locks admin queue
- Confirm dialog: "Locking this visit will generate a permanent medical document. This cannot be undone."
- `updateDentalVisit(visitId, { status: 'locked' })` → triggers PMD generation
- Auto-lock: configurable timer per org (default 60 days post-completion)

**Pending Locks queue:**
- Admin dashboard view (outside workspace scope, but data model defined here)
- Lists completed-but-unlocked visits sorted by completion date
- Warning badges: yellow (>30 days), red (>50 days approaching auto-lock)
- Bulk lock action for admin

---

## 5. Known Issues to Fix

These are bugs and incomplete implementations identified in the current codebase:

| # | Issue | Fix |
|---|-------|-----|
| 1 | Carousel shows same teeth on all cards | Each card queries its own `getDentalChart(visitId)` |
| 2 | `onSelectTooth` threaded but never connected in carousel | Wire through `ChartCard` → `DentalChart` → tooth click handler |
| 3 | `ResizableDivider` works but consumer (`$patientId.tsx`) passes empty `onResize` handler | Wire `onResize` callback in `$patientId.tsx` to update carousel/table zone heights with min/max constraints |
| 4 | Duplicate Profile/Share PMD buttons | Remove duplicates, consolidate into top bar |
| 5 | `useTreatmentPlan` uses raw fetch | Migrate to generated SDK hook |
| 6 | Price unit mismatch (priceCents vs whole PHP) | Standardize: store cents in backend, display as PHP in UI, convert at boundary |
| 7 | `ConsentSheet` uses `(form as any).id` | Properly type the form object |
| 8 | LabOrdersSheet imperative state | Migrate to TanStack Query hooks |
| 9 | Fullscreen button is no-op | Implement Fullscreen API toggle |
| 10 | `WorkspaceTabs` component orphaned (has Odontogram/Periodontal/Treatment Plan/Notes tabs) | Remove component. Odontogram is the default view, Treatment Plan + Notes are sheet overlays, Periodontal charting is deferred (no backend schema exists) |
| 11 | `useOrgContextStore.getState()` in component body | Use reactive Zustand hook `useOrgContextStore(s => s.field)` |
| 12 | Consent signature missing touch support | Use Pointer Events (works for mouse + touch + pen) |
| 13 | Treatment price `BigInt(Math.round(priceAmount))` sent as priceCents | Trace exact conversion path through `useSaveTreatment` → SDK → handler → schema; fix at boundary |

---

## 5.1 Components to Build (Net New)

These components do not exist in the current codebase and must be built from scratch:

| Component | Purpose | SDK Dependencies |
|-----------|---------|-----------------|
| `SoapNotesSheet` | SOAP notes form (S/O/A/P fields + free text) | `upsertVisitNotes`, `getVisitNotes` |
| `MedicalHistorySheet` | Sheet wrapper around existing `MedicalHistoryForm`, triggered from safety floor pills | `listMedicalHistory`, `createMedicalHistoryEntry`, `updateMedicalHistoryEntry` |
| `AmendmentForm` | Amendment creation form for historical visit corrections | `createAmendment`, `listAmendments` |
| `ToothOverviewStep` | Step 1 of slideout wizard: tooth info + history timeline | `getToothHistory` |
| `CdtCodeBrowser` | CDT code search + specialty tabs + favorites | Static JSON catalog (bundled) |
| `PreCompletionChecklist` | Modal with warnings before visit completion | Aggregates consent, treatment, notes queries |
| `PendingLocksView` | Admin queue for completed-but-unlocked visits | `listDentalVisits` filtered by status |

---

## 5.2 CDT Code Data Source

CDT codes are maintained by the ADA. For this implementation:
- Bundle a static JSON file (`src/data/cdt-codes.json`) with ~600 common CDT codes
- Structure: `{ code: "D2140", description: "Amalgam - one surface, primary or permanent", category: "Restorative", specialty: "General", defaultPriceCents: 350000 }`
- Favorites/recents persisted in localStorage keyed by `memberId`
- Future: migrate to a backend-served catalog if the code set needs to be org-configurable

---

## 5.3 Error & Edge Case Handling

**Save failures:**
- Toast notification with error message on any mutation failure
- Retry affordance (toast with "Retry" button)
- `useSaveToothFlow` partial save: if chart saves but treatment fails, show warning "Chart updated but treatment was not saved. Please try again." (currently only `console.error`)

**Concurrent editing:**
- Optimistic locking: include `updatedAt` in mutation payloads
- Backend rejects if `updatedAt` doesn't match current record (409 Conflict)
- UI shows "This record was modified by another user. Refresh to see changes."

**Network offline:**
- Disable save buttons when offline (navigator.onLine)
- Show persistent banner "You are offline — changes will not be saved"

---

## 6. Pediatric Dentition

**Deciduous teeth (20):** FDI 51-55, 61-65, 71-75, 81-85

**Chart layout:**
- Upper arch: 55→51 (right), 61→65 (left)
- Lower arch: 85→81 (right), 71→75 (left)
- Smaller grid than adult (10 per row vs 16)

**Mixed dentition (ages 6-12):**
- Full adult grid displayed
- Deciduous teeth rendered as smaller overlays above/below their successor permanent teeth
- As permanent teeth erupt, deciduous teeth are marked `extracted` and permanent teeth become `healthy`

**SVG assets:**
- 20 deciduous column SVGs + 20 deciduous surfacemap SVGs needed
- If not available, fall back to scaled-down adult SVGs with deciduous FDI labels
- Check `docs/development/teeth/` and `apps/sample-workspace/public/teeth/` for existing assets

**Patient dentition type:**
- Determined by `initializeDentition` API call (backend endpoint exists)
- Stored on patient record
- Chart component renders appropriate grid based on dentition type

---

## 7. TypeSpec Migration Strategy

**Current state:** 41 dental routes manually registered in `app.ts` with inline Zod validation, bypassing the TypeSpec → OpenAPI → codegen pipeline.

**Target state:** All dental routes defined in TypeSpec, generated through the standard pipeline, with handlers using `ValidatedContext` and `ctx.req.valid()`.

**Approach:** Vertical slices per feature area. For each slice:
1. Verify/update TypeSpec definition in `specs/api/src/modules/dental-*.tsp`
2. Run `cd specs/api && bun run build` to regenerate OpenAPI
3. Run `cd services/api-ts && bun run generate` to regenerate routes/validators
4. Update handler to use `ValidatedContext` pattern
5. Update/verify backend tests
6. Regenerate SDK: `cd packages/sdk-ts && bun run generate`
7. Update frontend hooks to use new SDK functions
8. Verify end-to-end

**Slice order** (by dependency):
1. dental-org (foundation: orgs, branches, memberships)
2. dental-patient (depends on org)
3. dental-visit (depends on patient — visits, charts, treatments, notes)
4. dental-clinical (depends on visit — Rx, consent, lab orders, attachments, medical history, amendments)
5. dental-billing (depends on visit + treatments — invoices, payments, plans)
6. dental-scheduling (depends on patient + visit — appointments, check-in)
7. dental-pmd (depends on visit — PMD generation)

---

## 8. Implementation Strategy

**Approach:** Vertical slices — each feature area gets its TypeSpec + backend + frontend reconciled together before moving to the next.

**Phase sequence:**

### Phase 1: Foundation & Chart Core
- Fix org context reactivity (issue #11)
- Implement cumulative chart data flow (each card queries own visit)
- Port sample-workspace SVG system with FDI adapter
- Implement color + icon visual language for 9 tooth states
- Add pediatric dentition grid support
- Fix carousel visual fidelity (coverflow, opacity, borders)
- Wire tooth tap → slideout on active card
- Wire tooth tap → read-only slideout on historical card

### Phase 2: Slideout Wizard
- Restructure existing 4-step wizard (condition→surface→treatment→review) to new flow (overview→surface+condition→treatment→review)
- **Build NEW** Step 1: `ToothOverviewStep` with tooth history timeline (via `getToothHistory`)
- Step 2: surface selector + condition picker (port visual quality from sample-workspace `SurfaceSelector`)
- **Build NEW** Step 3: `CdtCodeBrowser` (favorites/recent + search + specialty browse). Requires CDT code JSON catalog.
- Step 4: review + save (reconcile with existing `useSaveToothFlow`)
- **Build NEW** `AmendmentForm` for historical card slideout variant

### Phase 3: Treatment Table & Visit Lifecycle
- Treatment table with carry-over display
- Interactive cells: mark done, dismiss, edit price, add note
- Dual footer totals (estimated vs checkout)
- **Build NEW** `PreCompletionChecklist` modal
- Complete Visit flow with pre-completion checklist
- Lock Visit flow
- **Build NEW** `PendingLocksView` (admin queue)

### Phase 4: Clinical Sheets
> **Note:** Phase 4 is independent of Phases 2-3 and can be parallelized if resources allow.
- RxSheet: verify wiring, fix any direct SDK imports to use hook pattern
- ConsentSheet: fix `(form as any).id` typing (issue #7), migrate to Pointer Events for touch (issue #12)
- LabOrdersSheet: migrate from imperative `useState` to TanStack Query hooks (issue #8)
- AttachmentsSheet: verify wiring
- **Build NEW** `SoapNotesSheet` component (backend handlers exist, no frontend component)
- **Build NEW** `MedicalHistorySheet` wrapper (form exists as `MedicalHistoryForm`, needs sheet wrapper + safety floor trigger)

### Phase 5: Payment & Polish
- Payment modal with invoice creation
- Payment recording and receipt
- Payment plan support
- Fix all remaining known issues (#3, #4, #5, #9, #10, #13)
- Fullscreen toggle
- Remove duplicate buttons
- Clean up orphaned components

### Phase 6: TypeSpec Migration
- Migrate dental routes from manual registration to TypeSpec pipeline
- Follow slice order: org → patient → visit → clinical → billing → scheduling → pmd
- Update handlers to ValidatedContext pattern
- Regenerate SDK after each slice
- Verify all frontend hooks still work
- **Rollback strategy:** Keep old manual route registration commented out (not deleted) until the migrated route passes all tests. Only remove old registration after verification.
- **Pre-check:** Before Phase 1, verify that pediatric endpoints (`initializeDentition`) are already in TypeSpec. If not, migrate those first.

---

## 9. Verification Plan

**Per-phase gates:**
- `bun run typecheck` passes (zero errors)
- `bun test` passes (no regressions)
- Manual smoke test: open workspace, navigate carousel, tap tooth, complete wizard, verify treatment table updates

**End-to-end verification:**
1. Start API server (`cd services/api-ts && bun dev`)
2. Start frontend (`cd apps/dentalemon && bun dev`)
3. Login, navigate to workspace
4. Create a new visit (walk-in)
5. Tap tooth → complete 4-step wizard → treatment appears in table
6. Mark treatment done → checkout total updates
7. Complete visit → card becomes read-only
8. Tap tooth on completed card → read-only slideout with amendment option
9. Create new visit → verify chart carries forward previous state
10. Verify all clinical sheets open and function (Rx, Consent, Lab, Attachments, Notes)
11. Run checkout → payment modal → record payment
12. Switch to pediatric patient → verify 20-tooth grid renders

**TypeSpec migration verification:**
- After each slice: `cd specs/api && bun run build` succeeds
- After each slice: `cd services/api-ts && bun run generate` succeeds
- After each slice: existing tests still pass
- Final: all dental routes go through generated pipeline (zero manual registrations)
