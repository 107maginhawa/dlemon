# Components Inventory

All domain components live under `apps/dentalemon/src/features/`. Shared primitives (shadcn) are in `src/components/`.

## Legend
- ✅ Done — correct implementation, no known issues
- 🔧 Needs update — exists but has bugs or data layer problems
- ❌ Missing — needs to be created
- 🗑 Delete — broken, replace with TanStack Query version

---

## PR1: Data Layer (Hooks to Build/Fix)

| Hook | File | Status | Issue |
|------|------|--------|-------|
| `usePatients` | `features/patients/hooks/use-patients.ts` | ❌ Missing | Inline fetch in `patients.tsx` must move here |
| `useVisits` | `features/workspace/hooks/use-visits.ts` | ❌ Missing | Replaces broken `use-visit.ts` |
| `useDentalChart` | `features/workspace/hooks/use-dental-chart-query.ts` | ❌ Missing | Replaces closure-based `use-dental-chart.ts` |
| `useTreatments` | `features/workspace/hooks/use-treatments.ts` | ❌ Missing | Inline fetch in `$patientId.tsx` must move here |
| `use-visit.ts` | `features/workspace/hooks/use-visit.ts` | 🗑 Delete | Returns null — not a React hook |
| `use-dental-chart.ts` | `features/workspace/hooks/use-dental-chart.ts` | 🗑 Delete | Closure-based, not React state |

---

## PR1: Shared Infrastructure

| Item | File | Status | Issue |
|------|------|--------|-------|
| Brand constants | `src/constants/brand.ts` | ❌ Missing | `#FFE97D`, currency `PHP`, locale `en-PH` scattered |
| FDI adapter | `features/workspace/components/dental-chart.helpers.ts` | 🔧 Add functions | Add `fdiToUniversal()` + `universalToFdi()` |
| 5-surface type | `features/workspace/components/five-surface-selector.tsx` | 🔧 Fix type | Remove `cervical` from canonical type, drop `| string` escape |

---

## PR1: Patient List Components

| Component | File | Status | Issue |
|-----------|------|--------|-------|
| `PatientFolderCard` | `features/patients/components/patient-folder-card.tsx` | 🔧 Update | Card renders but missing manila folder tab (colored top strip). Update to match wireframe. |
| `PatientList` | `features/patients/components/patient-list.tsx` | 🔧 Update | Passes data prop, no loading/error states |
| `PatientFilterTabs` | `features/patients/components/patient-filter-tabs.tsx` | ❌ Missing | All / Active / Needs Follow-Up / Archived tabs with count badges |
| `PatientRegistrationModal` | `features/patients/components/patient-registration-modal.tsx` | ✅ Exists | No changes needed for PR1 |

---

## PR1: Workspace Components

| Component | File | Status | Issue |
|-----------|------|--------|-------|
| `WorkspaceTabs` | `features/workspace/components/workspace-tabs.tsx` | ❌ Missing | Odontogram / Periodontal / Treatment Plan / Notes tab bar |
| `TimelineCarousel` | `features/workspace/components/timeline-carousel.tsx` | 🔧 Update | Wire to `useVisits` hook, remove inline fetch dependency |
| `DentalChart` | `features/workspace/components/dental-chart.tsx` | 🔧 Update | Fix FDI mapping via new adapter functions |
| `ToothSlideout` | `features/workspace/components/tooth-slideout.tsx` | 🔧 Update | Fix `priceCents` → `priceInput`. Reset state on tooth change. |
| `FiveSurfaceSelector` | `features/workspace/components/five-surface-selector.tsx` | 🔧 Update | Use 5-surface canonical type (drop cervical) |

---

## PR2: Missing Screens (deferred)

| Component | File | Status |
|-----------|------|--------|
| `MedicalHistoryForm` | `features/workspace/components/medical-history-form.tsx` | ❌ Missing |
| `PaymentModal` | `features/workspace/components/payment-modal.tsx` | ❌ Missing |
| `ToothHistoryPanel` | `features/workspace/components/tooth-history-panel.tsx` | ❌ Missing |
| `DentalChartThumbnail` | `features/workspace/components/dental-chart-thumbnail.tsx` | ❌ Missing (for carousel) |

---

## Existing (no changes needed for PR1)

**Workspace sheets** (PR2 wiring): `lab-orders-sheet.tsx`, `rx-sheet.tsx`, `consent-sheet.tsx`
**Scheduling**: `appointment-modal.tsx`, `calendar-day.tsx`, `calendar-week.tsx`
**Billing**: `billing-list.tsx`, `invoice-detail.tsx`, `payment-plan-view.tsx`
**Dashboard**: `morning-briefing.tsx`, `metric-card.tsx`
**Staff**: `staff-list.tsx`, `staff-create-modal.tsx`
**Settings**: `clinic-settings.tsx`, `fee-schedule.tsx`, `locale-settings.tsx`
**Shared primitives**: All `src/components/*.tsx` (shadcn — do not modify)

---

## PR1 Build Order (vertical TDD)

```
Slice 1 — Patient List
  1. usePatients hook (test → implement)
  2. PatientFolderCard update (test → implement)
  3. PatientFilterTabs (test → implement)
  4. Wire patients.tsx (smoke test → verify)

Slice 2 — Workspace
  1. Brand constants + FDI adapter (test → implement)
  2. useVisits + useDentalChart + useTreatments (test → implement)
  3. WorkspaceTabs (test → implement)
  4. Update TimelineCarousel, DentalChart, ToothSlideout, FiveSurfaceSelector
  5. Wire $patientId.tsx (smoke test → verify)
```
