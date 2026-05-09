# Architecture Patterns

**Domain:** Dental Practice Management — Workspace Integration Milestone (v1.2)
**Researched:** 2026-05-06

## Current Architecture Snapshot

### Route Tree

```
/_workspace.tsx           ← Layout: glass header + <Outlet/>
  /$patientId.tsx         ← Main workspace: tabs, chart, treatments, footer

/_dashboard.tsx           ← Layout: sidebar + <Outlet/>
  /patients.tsx           ← Patient list → navigates to /$patientId
  /billing.tsx            ← Invoice list + detail sheet + payment plan
  /reports.tsx            ← RevenueReport component
  /dashboard.tsx          ← Morning briefing
  /calendar.tsx, /staff.tsx, /settings.tsx
```

### $patientId.tsx Component Map (Current)

```
WorkspacePage
├── WorkspaceTabs          (odontogram | periodontal | treatment-plan | notes)
├── TimelineCarousel       (visit selector + "New Visit" + "Share PMD")
├── Main Content Area
│   ├── [odontogram]       → DentalChart + ToothSlideout
│   ├── [notes]            → MedicalHistoryForm
│   ├── [treatment-plan]   → PLACEHOLDER ("coming in PR2")
│   └── [periodontal]      → PLACEHOLDER ("coming in PR2")
├── Treatment Table        (inline <table> in $patientId.tsx)
└── Payment Footer         (treatment count + "Continue to Payment" → /billing)
```

### Orphaned Components (Built, Never Imported)

| Component | Location | Props Interface | Uses raw fetch() |
|-----------|----------|-----------------|-------------------|
| RxSheet | features/workspace/components/rx-sheet.tsx | `{ visitId, patientId, prescriberMemberId, open, onClose, onSaved? }` | YES |
| ConsentSheet | features/workspace/components/consent-sheet.tsx | `{ visitId, patientId, open, onClose, onSaved? }` | YES |
| LabOrdersSheet | features/workspace/components/lab-orders-sheet.tsx | `{ visitId, patientId, open, onClose }` | YES |
| PMDViewer | features/pmd/components/pmd-viewer.tsx | `{ pmd: PMDDocument }` | NO (pure display) |
| PMDImport | features/pmd/components/pmd-import.tsx | `{ patientId, open, onClose, onImported? }` | YES |

### Existing Hooks

| Hook | Query Key | API Endpoint | Returns |
|------|-----------|-------------|---------|
| useVisits | `dental-visits` | `GET /dental/visits?patientId=` | `{ visits, isLoading }` |
| useDentalChart | `dental-chart` | `GET /dental/visits/:id/chart` | `{ teeth, selectedTooth, selectTooth, clearSelection }` |
| useTreatments | `dental-treatments` | `GET /dental/visits/:id/treatments` | `{ treatments, isLoading, refetch }` |
| useCreateVisit | (mutation) | `POST /dental/visits` | mutation |
| useSharePMD | (mutation) | `POST /dental/pmd/generate` | mutation |
| useSaveChart | (mutation) | `PUT /dental/visits/:id/chart` | mutation |
| useSaveTreatment | (mutation) | `POST /dental/visits/:id/treatments` | mutation |
| useMedicalHistory | `medical-history` | `GET /dental/patients/:id/medical-history` | entries |
| usePatients | `dental-patients` | `GET /dental/patients` | `{ patients, isLoading, error }` |

### Backend APIs Available (Not Yet Wired to Frontend)

| Feature | Endpoint | Handler |
|---------|----------|---------|
| Treatment Plan | `GET /dental/patients/:patientId/treatment-plan?branchId=` | getTreatmentPlan |
| Patient Profile | `GET /dental/patients/:id` | getDentalPatient (returns visitCount, outstandingBalanceCents, person, emergencyContact, recallDate) |
| Attachments | `POST/GET/DELETE /dental/visits/:id/attachments` | createAttachment, listAttachments, deleteAttachment |
| Quick Payment | `POST /dental/billing/payments` | recordDentalPayment |
| Create Invoice | `POST /dental/billing/invoices` | createDentalInvoice |
| Patient Balance | `GET /dental/billing/patients/:id/balance` | getPatientBalance |
| Collections | `GET /dental/billing/collections-summary` | getCollectionsSummary |

---

## Recommended Architecture for v1.2

### Component Integration Map

```
WorkspacePage (MODIFIED — $patientId.tsx)
├── WorkspaceTabs          (UNCHANGED)
├── TimelineCarousel       (UNCHANGED)
├── ActionBar              (NEW — toolbar between carousel and content)
│   ├── [Rx] button        → opens RxSheet
│   ├── [Consent] button   → opens ConsentSheet
│   ├── [Lab Orders] button→ opens LabOrdersSheet
│   ├── [PMD] button       → opens PMDViewer (sheet)
│   ├── [Import PMD] button→ opens PMDImport
│   └── [Attach] button    → opens AttachmentsPanel
├── Main Content Area
│   ├── [odontogram]       → DentalChart + ToothSlideout (UNCHANGED)
│   ├── [notes]            → MedicalHistoryForm (UNCHANGED)
│   ├── [treatment-plan]   → TreatmentPlanTab (NEW)
│   └── [periodontal]      → PLACEHOLDER (v1.3)
├── Treatment Table        (UNCHANGED — inline)
├── Sheet Overlays         (5 orphaned components wired via state)
│   ├── RxSheet
│   ├── ConsentSheet
│   ├── LabOrdersSheet
│   ├── PMDViewerSheet     (NEW wrapper — puts PMDViewer in a sheet)
│   └── PMDImport
├── AttachmentsPanel       (NEW — slide-in or inline panel)
├── QuickPaymentModal      (NEW — opened from footer)
└── Payment Footer         (MODIFIED — adds "Quick Pay" button)
```

### Component Boundaries

| Component | Responsibility | Communicates With | New/Modified |
|-----------|---------------|-------------------|-------------|
| **WorkspaceActionBar** | Icon toolbar for clinical actions | Parent ($patientId) via callbacks | NEW |
| **TreatmentPlanTab** | Display aggregated treatment plan from all visits | useTreatmentPlan hook (NEW) | NEW |
| **AttachmentsPanel** | Upload/list/delete visit attachments | useAttachments hook (NEW) | NEW |
| **QuickPaymentModal** | Record a quick cash/card payment against a visit | useRecordPayment hook (NEW) | NEW |
| **PMDViewerSheet** | Wraps PMDViewer in a slide-up sheet with fetch logic | usePMDForVisit hook (NEW) | NEW |
| **ReportDrilldown** | Expandable row detail in RevenueReport daily table | Inline in RevenueReport | MODIFIED |
| **PatientProfileScreen** | Full patient profile page (demographics, safety floor, stats) | usePatientProfile hook (NEW) | NEW route |
| $patientId.tsx | Wire action bar + sheets + new tabs | All above | MODIFIED |
| RevenueReport | Add drilldown rows | Internal state | MODIFIED |

### New Hooks Required

| Hook | Query Key | API Endpoint | Returns |
|------|-----------|-------------|---------|
| useTreatmentPlan | `treatment-plan, patientId` | `GET /dental/patients/:id/treatment-plan?branchId=` | `{ treatments, totalEstimateCents, byTooth, isLoading }` |
| useAttachments | `attachments, visitId` | `GET /dental/visits/:id/attachments` | `{ attachments, isLoading }` |
| useCreateAttachment | (mutation) | `POST /dental/visits/:id/attachments` | mutation |
| useDeleteAttachment | (mutation) | `DELETE /dental/visits/:id/attachments/:attachmentId` | mutation |
| useRecordPayment | (mutation) | `POST /dental/billing/payments` | mutation |
| usePatientProfile | `dental-patient, patientId` | `GET /dental/patients/:id` | `{ patient, isLoading }` |
| usePMDForVisit | `pmd-visit, visitId` | `GET /dental/pmd/visits/:id` | `{ pmd, isLoading }` |

### New vs Modified Components

**NEW components (8):**
1. `features/workspace/components/workspace-action-bar.tsx` — icon toolbar
2. `features/workspace/components/treatment-plan-tab.tsx` — treatment plan view
3. `features/workspace/components/attachments-panel.tsx` — file upload/list/delete
4. `features/workspace/components/pmd-viewer-sheet.tsx` — wraps PMDViewer in sheet chrome
5. `features/billing/components/quick-payment-modal.tsx` — quick pay dialog
6. `routes/_workspace/$patientId/profile.tsx` OR inline in `$patientId.tsx` — patient profile
7. New hooks (7 hooks as listed above)

**MODIFIED components (3):**
1. `routes/_workspace/$patientId.tsx` — add action bar, wire 5 sheets, add treatment-plan tab, modify footer
2. `features/reports/components/revenue-report.tsx` — add row-click drilldown
3. `features/workspace/components/workspace-tabs.tsx` — no change needed (already has treatment-plan tab ID)

**UNCHANGED components (all 5 orphaned):**
- RxSheet, ConsentSheet, LabOrdersSheet, PMDViewer, PMDImport — import and wire, do not modify

---

## Data Flow

### Action Bar → Sheet Flow
```
User clicks [Rx] in ActionBar
  → setRxSheetOpen(true) in $patientId.tsx
  → <RxSheet visitId={currentVisitId} patientId={patientId} open={rxSheetOpen} onClose={...} onSaved={...} />
  → RxSheet calls POST /dental/visits/:id/prescriptions (raw fetch — tech debt, not refactored)
  → onSaved callback invalidates relevant queries
```

### Treatment Plan Tab Flow
```
User clicks "Treatment Plan" tab
  → activeTab === 'treatment-plan'
  → <TreatmentPlanTab patientId={patientId} />
  → useTreatmentPlan({ patientId }) calls GET /dental/patients/:id/treatment-plan?branchId=
  → Renders grouped-by-tooth treatment list with totals
```

### Quick Payment Flow
```
User clicks "Quick Pay" in footer
  → setQuickPayOpen(true)
  → <QuickPaymentModal visitId={currentVisitId} patientId={patientId} ... />
  → Modal shows amount, method selector, note field
  → Submit calls POST /dental/billing/payments via useRecordPayment
  → On success: invalidate treatments + invoices queries, close modal
```

### Patient Profile Flow (Route Decision)
Two options:
1. **New nested route** `/_workspace/$patientId/profile` — separate page under workspace layout
2. **New tab** in WorkspaceTabs — add "Profile" as 5th tab

**Recommendation: New tab.** Rationale:
- Workspace is already patient-scoped with patientId in URL
- Profile is a read-mostly view (demographics, stats, safety floor)
- Adding a tab keeps the user in the workspace context without navigation
- WorkspaceTabs already supports arbitrary tab IDs

Update `WorkspaceTab` type to add `'profile'` and render `<PatientProfilePanel patientId={patientId} />` in the tab content area.

### Report Drilldown Flow
```
User clicks a daily row in RevenueReport table
  → Row expands inline to show invoice-level breakdown
  → Uses existing invoice data (already fetched in RevenueReport)
  → No new API call needed — filter invoices array by date
```

---

## Patterns to Follow

### Pattern 1: Sheet State Management in $patientId.tsx

All 5 orphaned sheets + new panels use the same pattern: boolean state + conditional render.

```typescript
// In WorkspacePage:
const [rxSheetOpen, setRxSheetOpen] = useState(false);
const [consentSheetOpen, setConsentSheetOpen] = useState(false);
const [labOrdersSheetOpen, setLabOrdersSheetOpen] = useState(false);
const [pmdViewerOpen, setPmdViewerOpen] = useState(false);
const [pmdImportOpen, setPmdImportOpen] = useState(false);
const [attachmentsOpen, setAttachmentsOpen] = useState(false);
const [quickPayOpen, setQuickPayOpen] = useState(false);

// Pass open/onClose to each sheet component
```

This matches the existing pattern used by ToothSlideout (conditional render based on `selectedTooth !== null`).

### Pattern 2: TanStack Query Hook Pattern

Follow the established hook pattern from `use-treatments.ts`:

```typescript
export function useTreatmentPlan({ patientId }: { patientId: string }) {
  const branchId = localStorage.getItem('currentBranchId') ?? '';
  const query = useQuery({
    queryKey: ['treatment-plan', patientId, branchId],
    queryFn: async () => {
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/treatment-plan?branchId=${branchId}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return res.json();
    },
    enabled: !!patientId && !!branchId,
  });
  return { plan: query.data, isLoading: query.isLoading, error: query.error };
}
```

### Pattern 3: ActionBar as Presentation-Only Component

ActionBar receives only callbacks — no data fetching. Parent manages open/close state.

```typescript
interface WorkspaceActionBarProps {
  onRx: () => void;
  onConsent: () => void;
  onLabOrders: () => void;
  onPMD: () => void;
  onPMDImport: () => void;
  onAttachments: () => void;
  disabled?: boolean; // true when no active visit
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Refactoring Orphaned Components
**What:** Converting RxSheet/ConsentSheet/LabOrdersSheet from raw fetch() to TanStack Query hooks
**Why bad:** Out of scope for v1.2. These components work. Refactoring risks introducing bugs with zero user-facing value.
**Instead:** Wire them as-is. Track fetch-to-TanStack migration as tech debt for v1.3.

### Anti-Pattern 2: Nested Routes for Workspace Tabs
**What:** Creating `/_workspace/$patientId/treatment-plan.tsx`, `/_workspace/$patientId/profile.tsx` etc.
**Why bad:** Current architecture uses client-side tab state (`activeTab`), not route-based tabs. Mixing patterns creates inconsistency. Tab content shares state (currentVisitId, treatments, etc.) that would need prop-drilling or context with route-based tabs.
**Instead:** Keep tab switching via `activeTab` state. All tab content lives as components rendered conditionally in $patientId.tsx.

### Anti-Pattern 3: Global Sheet State via Context/Zustand
**What:** Creating a SheetContext or Zustand store for sheet open/close state.
**Why bad:** Only $patientId.tsx needs this state. Over-engineering for 7 boolean flags.
**Instead:** Local useState in WorkspacePage. If it becomes unwieldy, extract to a `useSheetState()` custom hook that returns `{ rxOpen, setRxOpen, ... }`.

### Anti-Pattern 4: Creating a New Invoice from Workspace
**What:** Building invoice creation into the Quick Payment modal.
**Why bad:** `createDentalInvoice` is a separate workflow (itemized invoice with line items). Quick Pay is `recordDentalPayment` — a simpler "record cash/card received" action.
**Instead:** Quick Payment modal calls `recordDentalPayment` only. Full invoicing stays in /billing route.

---

## Build Order (Dependency-Driven)

### Phase 1: Action Bar + Sheet Wiring (Foundation)

**Why first:** All 5 orphaned components are already built. Wiring them is the highest-value, lowest-risk work. Action bar is the trigger mechanism for all sheets.

1. Create `WorkspaceActionBar` component
2. Add 7 sheet state variables to $patientId.tsx
3. Import + render all 5 orphaned sheets with props from existing state
4. Wire ActionBar callbacks to sheet state setters
5. Gate action bar buttons on `currentVisitId !== null`

**Dependencies:** None. Uses existing components and state.

### Phase 2: Treatment Plan Tab

**Why second:** Fills the most visible placeholder ("coming in PR2"). Backend API exists. Needs one new hook + one new component.

1. Create `useTreatmentPlan` hook
2. Create `TreatmentPlanTab` component (grouped-by-tooth list + totals)
3. Replace placeholder in $patientId.tsx tab switch

**Dependencies:** None on Phase 1 — independent tab.

### Phase 3: Patient Profile

**Why third:** Builds on patient data patterns. Adds a new tab to workspace.

1. Create `usePatientProfile` hook
2. Create `PatientProfilePanel` component (demographics, stats, safety floor, emergency contact)
3. Add `'profile'` to `WorkspaceTab` type
4. Add Profile tab to TABS array in workspace-tabs.tsx
5. Render PatientProfilePanel in tab switch

**Dependencies:** Modifies workspace-tabs.tsx (adds tab), but independent of Phase 1-2 sheet work.

### Phase 4: Attachments

**Why fourth:** New feature with upload/delete. Needs new hooks and a new panel component.

1. Create `useAttachments`, `useCreateAttachment`, `useDeleteAttachment` hooks
2. Create `AttachmentsPanel` component (file list + upload button + delete)
3. Wire into action bar (Phase 1 adds the button, Phase 4 builds the panel)

**Dependencies:** Action bar button from Phase 1 (but panel can be built independently).

### Phase 5: Quick Payment Modal

**Why fifth:** Modifies the payment footer. Needs billing API integration.

1. Create `useRecordPayment` hook
2. Create `QuickPaymentModal` component (amount, method, note, submit)
3. Add "Quick Pay" button to payment footer in $patientId.tsx
4. Wire modal open/close

**Dependencies:** Independent, but logically follows treatment plan (user sees plan → pays).

### Phase 6: Report Drilldown

**Why last:** Smallest scope. Modifies existing RevenueReport component. No new API calls.

1. Add expandable row state to RevenueReport
2. On row click, show invoice-level breakdown filtered from existing data
3. Style inline expansion

**Dependencies:** None — entirely within RevenueReport component.

---

## Scalability Considerations

| Concern | Current (v1.2) | Future (v1.3+) |
|---------|---------------|-----------------|
| Sheet state in $patientId.tsx | 7 useState flags — manageable | Extract to `useSheetState()` if more sheets added |
| Raw fetch() in orphaned components | Works, known tech debt | Migrate to TanStack Query hooks for cache coherence |
| Treatment plan data freshness | Refetch on tab switch | Add real-time via WebSocket or polling |
| File uploads (attachments) | Direct POST to API | Consider S3 presigned URLs for large files |
| Payment footer complexity | 2 buttons (Continue + Quick Pay) | May need to become a PaymentFooter component |

## Sources

- `apps/dentalemon/src/routes/_workspace/$patientId.tsx` — current workspace implementation (HIGH confidence)
- `apps/dentalemon/src/features/workspace/components/workspace-tabs.tsx` — tab architecture (HIGH confidence)
- All 5 orphaned component source files — props interfaces verified (HIGH confidence)
- `services/api-ts/src/handlers/dental-visit/getTreatmentPlan.ts` — treatment plan API response shape (HIGH confidence)
- `services/api-ts/src/handlers/dental-patient/getDentalPatient.ts` — patient profile API response (HIGH confidence)
- `services/api-ts/src/handlers/dental-billing/` — payment/invoice handlers confirmed (HIGH confidence)
- `services/api-ts/src/handlers/dental-clinical/` — attachment/prescription/consent/lab-order handlers confirmed (HIGH confidence)
