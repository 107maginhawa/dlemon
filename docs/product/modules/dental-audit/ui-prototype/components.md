# Components — dental-audit
<!-- oli: v3-dentalemon | dental-audit | ui-prototype -->

All components live in `apps/dentalemon/src/components/audit/` and compose Radix primitives from `apps/dentalemon/src/components/ui/`. SF Pro, white surfaces on `#F2F2F7`, lemon `#FFE97D` for active filter accents only. Read-only by contract — no component exposes mutation affordances.

---

## AuditLogTable

**Props:**
- `events: AuditEvent[]`
- `variant: 'full' | 'compact'`
- `page: number`
- `pageSize: number`
- `total: number`
- `onPageChange(next: number): void`
- `onRowExpand(eventId: string): void`
- `loading?: boolean`

**Behavior:**
- Radix Table with columns: `created_at`, `event_type`, `actor_id`, `resource_type`, `resource_id`, `branch_id`, `ip_address`
- Default sort: `created_at` desc (server-driven)
- Row click → `onRowExpand` (opens drawer); row also exposes a visible "Expand" affordance for accessibility
- `variant='compact'` hides `ip_address` and `branch_id` columns (used on dashboard)
- Pagination shown in `variant='full'`; jumps disabled while `loading`
- Empty state delegated to caller via render slot

---

## AuditEventRow

**Props:**
- `event: AuditEvent`
- `onClick(): void`

**Behavior:**
- Renders one row; composes `AuditEventTypeChip`
- `created_at` formatted as `YYYY-MM-DD HH:mm:ss` (24h) with relative tooltip ("3 minutes ago")
- `actor_id` rendered as monospace short ID with copy-on-hover affordance; never resolved to a name (G-005)
- `resource_type` + `resource_id` rendered as a single compact pair
- Keyboard: `Enter` triggers `onClick`

---

## AuditEventTypeChip

**Props:**
- `eventType: string` (e.g. `visit.created`, `billing.invoice.issued`)

**Behavior:**
- Parses module prefix from `eventType` (split on `.`) and applies module color mapping:
  - visit / clinical = blue tint
  - billing = green tint
  - scheduling = orange tint
  - notifs / comms = purple tint
  - audit = neutral gray
  - other = neutral gray fallback
- Chip text shows the full `eventType` in monospace
- Tooltip shows the parsed module name

---

## EventPayloadViewer

**Props:**
- `payload: unknown`
- `eventId: string`

**Behavior:**
- Syntax-highlighted JSON, line-numbered, monospace
- "Copy Payload" button copies stringified JSON to clipboard and toasts "Payload copied"
- "Copy Event ID" button copies `eventId`
- No editing — view is `contenteditable={false}`
- Wraps long values; preserves indentation

---

## AuditEventDrawer

**Props:**
- `eventId: string | null`
- `open: boolean`
- `onOpenChange(open: boolean): void`

**Behavior:**
- Radix Sheet (right-anchored, 480px desktop / full-width iPad portrait)
- Loads event detail on open; shows skeleton until ready
- Header: `AuditEventTypeChip` + timestamp
- Body: summary field list, then `EventPayloadViewer`
- Trap focus returns to originating row on close
- No mutation surfaces

---

## AuditFilterBar

**Props:**
- `value: AuditFilterState`
- `onChange(next: AuditFilterState): void`
- `onExportClick(): void`

**Behavior:**
- Sticky bar (top of log viewer)
- Fields: date range picker (required, default last 7 days), actor ID input (free text, monospace), event type multi-select (grouped by module), resource type select
- Debounces text input to 250 ms before firing `onChange`
- Active filter pills displayed beneath; clearing a pill calls `onChange` with the value removed
- Lemon `#FFE97D` accent on active multi-select chips
- Trailing region hosts `Export Log` button → calls `onExportClick`

---

## AuditDashboardTiles

**Props:**
- `tiles: Array<{ id: string; label: string; value: number | string; delta?: { value: number; direction: 'up' | 'down' } }>`
- `loading?: boolean`

**Behavior:**
- Responsive grid of summary tiles (1–4 per row depending on viewport)
- Each tile: label (small caps), large value, optional delta with directional icon
- Skeleton tiles when `loading`
- Read-only; not clickable in v1

---

## AuditEventsMiniChart

**Props:**
- `data: Array<{ date: string; module: string; count: number }>`
- `range: { from: string; to: string }`

**Behavior:**
- Recharts stacked bar chart: x = `date`, y = event count, stack segments by `module`
- Module colors match `AuditEventTypeChip` mapping
- Hover tooltip shows per-module counts for the date
- Empty state: "No events in this date range."
- Read-only

---

## ExportAuditDialog

**Props:**
- `open: boolean`
- `onOpenChange(open: boolean): void`
- `defaultFilter?: AuditFilterState`
- `onExportComplete?(downloadUrl: string): void`

**Behavior:**
- Form: date range (required), format radio (CSV / JSON, required), event type multi-select (optional), resource type select (optional)
- Pre-populates from `defaultFilter` if provided (handy from the log viewer)
- Submits POST `/api/dental-audit/exports`; polls job status every 2s
- During generation shows progress + cancel; on completion surfaces a download link and calls `onExportComplete`
- Closing the dialog mid-job leaves the background job running and surfaces the result via toast + dashboard exports tray

---

## AuditEmptyState

**Props:**
- `variant: 'no-filters' | 'no-results' | 'no-events-ever'`
- `onAdjustFilters?(): void`

**Behavior:**
- Centered card with icon, headline, and helper text
- Copy varies by variant:
  - `no-filters`: "Choose a date range to see events."
  - `no-results`: "No events match these filters. Try widening your date range." + `Adjust Filters` action
  - `no-events-ever`: "No audit events recorded for this branch yet."
- No mutation actions
