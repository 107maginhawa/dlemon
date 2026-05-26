<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-ui-blueprint --blueprint --all -->
<!-- based-on: apps/dentalemon/src/components/, apps/sample-workspace/src/components/, DESIGN.md -->

# Shared Components — Dentalemon

> Cross-module components. Source: `apps/dentalemon/src/components/` (exists) and domain-specific components.
> All components use Radix UI primitives + Tailwind CSS + design tokens.

---

## 1. Foundation Components (already implemented)

| Component | File | Purpose |
|-----------|------|---------|
| `Button` | `button.tsx` | Primary, secondary, ghost, destructive, icon variants |
| `Card` | `card.tsx` | Card container with header/content/footer |
| `Table` | `table.tsx` | Data table shell |
| `Dialog` | `dialog.tsx` | Modal dialogs |
| `Sheet` | `sheet.tsx` | Slideout panel (320px, lemon left border) |
| `Tabs` | `tabs.tsx` | Tab navigation |
| `Form` | `form.tsx` | RHF form wrapper with label/error |
| `Input` | `input.tsx` | Text input |
| `Select` | `select.tsx` | Dropdown select |
| `Combobox` | `combobox.tsx` | Searchable select |
| `Badge` | `badge.tsx` | Status badges |
| `Skeleton` | `skeleton.tsx` | Loading skeletons |
| `EmptyState` | `empty-state.tsx` | Empty collection state |
| `Pagination` | `pagination.tsx` | Table pagination |
| `Loading` | `loading.tsx` | Spinner |
| `Sonner` | `sonner.tsx` | Toast notifications |
| `Avatar` | `avatar.tsx` | User/patient avatar |
| `PhoneInput` | `phone-input.tsx` | Phone number input with country |
| `AppSidebar` | `app-sidebar.tsx` | Main sidebar nav |

---

## 2. Domain Components (workspace — from sample-workspace)

| Component | Source | Purpose |
|-----------|--------|---------|
| `DentalChartGrid` | `dental-chart-grid.tsx` | 32-tooth interactive chart |
| `UniversalTooth` | `dental/universal-tooth.tsx` | Single tooth SVG component |
| `TimelineCarousel` | `timeline-carousel.tsx` | Visit history snapshots |
| `BreakdownTable` | `breakdown-table.tsx` | CDT treatment + cost breakdown |
| `ToothDetailPanel` | `tooth-detail-panel.tsx` | Per-tooth slideout detail |
| `SurfaceSelector` | `surface-selector.tsx` | Tooth surface selector (M/D/O/B/L) |
| `ChartCard` | `chart-card.tsx` | Chart section card wrapper |
| `HeaderBar` | `header-bar.tsx` | Workspace top bar |

---

## 3. Required New Shared Components

These need to be built (cross-module use, no existing implementation):

### `SafetyFloor`

**Purpose:** Displays patient allergy + medication alerts at top of any patient-context screen.

```typescript
interface SafetyFloorProps {
  allergies: string[];
  medications: string[];
  patientId: string;
  compact?: boolean; // true = collapsed banner, false = expanded list
}
```

**WAI-ARIA:** `role="alert"` when allergies present, `aria-live="polite"` for updates
**States:** No alerts (hidden), 1+ alerts (red banner), compact (collapsed badge count)

---

### `PatientHeader`

**Purpose:** Compact patient identity row shown at top of workspace and patient-context screens.

```typescript
interface PatientHeaderProps {
  patient: { id: string; firstName: string; lastName: string; dateOfBirth: string; status: 'active' | 'archived' };
  showStatus?: boolean;
  onViewProfile?: () => void;
}
```

---

### `StatusBadge`

**Purpose:** Consistent status display across modules.

```typescript
type StatusVariant = 'active' | 'draft' | 'pending' | 'completed' | 'overdue' | 'voided' | 'archived' | 'locked';

interface StatusBadgeProps {
  status: StatusVariant;
  size?: 'sm' | 'md';
}
```

---

### `ConfirmDialog`

**Purpose:** Confirmation dialogs for destructive/irreversible actions.

```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;   // default: "Confirm"
  cancelLabel?: string;    // default: "Cancel"
  variant?: 'destructive' | 'default';
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}
```

**WAI-ARIA:** `role="alertdialog"`, `aria-labelledby`, `aria-describedby`

---

### `BranchGuard`

**Purpose:** Route wrapper that enforces branch membership + role. Shows 403 screen if insufficient.

```typescript
interface BranchGuardProps {
  requiredRoles?: DentalRole[];
  children: React.ReactNode;
}
```

---

### `AuditTrailNote` (read-only)

**Purpose:** Shows that an action will be logged to audit trail. Used in destructive/clinical forms.

```typescript
interface AuditTrailNoteProps {
  action: string; // e.g., "Voiding this invoice will be recorded in the audit log."
}
```

---

## 4. Component Skeleton Conventions

All domain components follow this pattern:

```typescript
// 1. Loading skeleton: always use <Skeleton> components
// 2. Empty state: always use <EmptyState icon={...} title={...} description={...} action={...} />
// 3. Error state: always use <Alert variant="destructive"> with retry button
// 4. ARIA: landmark, label, required on all interactive elements
// 5. Tokens: use CSS vars (--primary, --muted, --card) not hardcoded hex
```

---

## 5. Icon Convention

Library: **Lucide React** (already installed via dentalemon app)
- Size: 20px standard, 16px in badges/tight spaces, 24px in empty states
- Stroke width: 1.5 (Apple HIG feel)
- Color: inherit from text color unless semantic

---

## 6. Toast Patterns (Sonner)

| Event | Toast type | Message pattern |
|-------|------------|----------------|
| Create success | success | "{Entity} created" |
| Update success | success | "Changes saved" |
| Delete success | success | "{Entity} archived/removed" |
| Error (4xx) | error | Field error or server message |
| Error (5xx) | error | "Something went wrong. Please try again." |
| Async queued | info | "{Action} in progress..." |
