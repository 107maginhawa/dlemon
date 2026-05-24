# Screens — dental-audit
<!-- oli: v3-dentalemon | dental-audit | ui-prototype -->

Dental audit trail and compliance event log. Extends the base `audit` module. Append-only — no edit, no delete (server returns 405). Consumed by `dentist_owner` via the audit log viewer (WF-028).

**Roles in this module:**
- `dentist_owner` — view only (sole UI consumer)
- System (all other modules) — write events via pg-boss

**Business rules referenced:**
- AC-AUD-001 — events written within 5s of source action
- AC-AUD-002 — no modify / no delete (405 from API)
- AC-AUD-003 — branch-scoped reads
- AC-AUD-004 — no email or name persisted in event payload (G-005 compliance)

Visual system: SF Pro, white card surfaces on `#F2F2F7`, lemon `#FFE97D` accent for selected filters and emphasis, 44px touch targets.

---

## Screen: Audit Dashboard (`/audit`)

**Roles:** dentist_owner
**Layout:** Dashboard landing page. Header: "Audit". Toolbar with branch selector (auto-set to current branch; switchable if owner has multi-branch access) and `Export Log` action top-right. Body is a responsive grid: row 1 = summary tiles (Total Events 30d, Unique Actors 30d, Events Today, Failed Verifications 30d); row 2 = `AuditEventsMiniChart` (full width); row 3 = two-column ("Events by Module" bar list left, "Top Event Types" list right); row 4 = "Recent Events" table (last 10) with link to full log.
**Components:**
- `AuditDashboardTiles`
- `AuditEventsMiniChart`
- Events-by-module bar list (recharts horizontal bars)
- Top-event-types ranked list
- `AuditLogTable` (compact variant, last 10, no filter bar)
- Branch selector (Radix Select)
- `ExportAuditDialog` trigger

**States:**
- Loading: skeleton tiles + chart shimmer
- Loaded: tiles populated; chart rendered
- Empty branch: "No audit events recorded for this branch yet."
- Error: inline banner with retry per panel
- Refreshing (polling on 30s interval): subtle "Updated just now" timestamp

---

## Screen: Audit Log Viewer (`/audit/log`)

**Roles:** dentist_owner
**Layout:** Filter-driven log explorer. Top: `AuditFilterBar` (sticky, 56px tall). Below: `AuditLogTable` with paginated rows (50/page). Right-side `AuditEventDrawer` opens on row expand. Export action in filter bar trailing region.
**Components:**
- `AuditFilterBar` (date range picker, actor input, event type multi-select, resource type select)
- `AuditLogTable` (full variant)
- `AuditEventRow` (per row)
- `AuditEventTypeChip` (inline per row)
- `AuditEventDrawer` (Radix Sheet, right side)
- Pagination control (previous / next + page count)
- `ExportAuditDialog` trigger

**States:**
- Loading: 10-row skeleton table
- Loaded (results): rows with expandable detail
- Empty (no events in range): `AuditEmptyState` with "Try widening your date range" suggestion
- Filter applied / no results: filtered-empty variant
- Large result set: pagination active; "Showing 1–50 of 1,247"
- Error: full-table error banner with retry
- Row expand: smooth Sheet open (slide-in from right), payload loads (small spinner if hydration needed)

---

## Screen: Event Detail Drawer

**Roles:** dentist_owner
**Layout:** Radix Sheet, anchored right, 480px wide on desktop, full-width on iPad portrait. Sticky header with timestamp + event type chip + actor ID summary. Body scrolls: structured "Summary" fields list first (event_type, actor_id, resource_type, resource_id, branch_id, ip_address, created_at), then `EventPayloadViewer` for the full JSON payload. No edit controls anywhere.
**Components:**
- `AuditEventDrawer` (root)
- Sticky header with `AuditEventTypeChip` and timestamp
- Field summary list (label/value rows)
- `EventPayloadViewer` (JSON viewer with copy button)
- "Copy event ID" secondary action

**States:**
- Loading: header populated from row; body shows JSON skeleton
- Loaded: full JSON rendered, syntax highlighted, line-numbered
- Copy success: toast "Payload copied"
- Error: drawer body shows error with retry; header remains
- Close: trap-focus returns to the originating row

---

## Screen: Export Dialog

**Roles:** dentist_owner
**Layout:** Radix Dialog (520px wide). Form fields stacked: date range picker (required), format select (CSV / JSON, required), event type multi-select (optional filter), resource type select (optional). Footer with `Cancel` and `Start Export` primary action.
**Components:**
- `ExportAuditDialog` (root)
- Date range picker
- Format select (Radix RadioGroup, segmented)
- Event type multi-select
- Resource type select
- Async progress region (visible once export started)

**States:**
- Idle: form ready, primary disabled until required filled
- Submitting: spinner on primary, fields disabled
- Queued: form replaced by status "Export queued. We'll generate your file in the background."
- Generating: progress indicator with cancel option
- Ready: download link surfaced ("Download {filename} ({size})")
- Failed: error message with `Try Again`
- Closing while in-progress: dialog can close; background job continues; result appears as toast + persisted in a small "Recent exports" tray on the dashboard
