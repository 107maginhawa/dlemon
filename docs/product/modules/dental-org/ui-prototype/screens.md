<!-- oli-version: 1.0 | generated: 2026-05-24 | skill: oli-ui-blueprint --blueprint --all -->

# Screens — dental-org

---

## Screen: Dashboard (`/dashboard`)

**Roles:** `dentist_owner`, `dentist_associate` (filtered)
**ARIA landmarks:** `<header>` (top bar), `<nav>` (sidebar), `<main>` (stats), `<aside>` (quick actions)

**Layout:** 4-metric stat cards row + recent activity list + upcoming appointments widget
**Components:** `StatCard ×4`, `ActivityFeed`, `AppointmentWidget`, `PatientHeader`

**Fields displayed:**
| Field | Source | Format |
|-------|--------|--------|
| Appointments today | `GET /dental/dashboard` | Count badge |
| Active patients | dashboard API | Count |
| Outstanding invoices | dashboard API | Count + amount |
| Outstanding total | dashboard API | Currency |

**Role variants:**
- `dentist_owner`: All stats visible
- `dentist_associate`: Patient count filtered to own patients; billing hidden

**States:** Loading (skeleton cards), Loaded, Error (alert with retry)

---

## Screen: Staff Management (`/staff/members`)

**Roles:** `dentist_owner` only
**ARIA:** `<main>`, `<table aria-label="Staff members">`

**Layout:** Page header + "Invite staff" button + data table
**Components:** `Table`, `Badge` (role), `DropdownMenu` (actions), `Dialog` (invite form)

**Table columns:**
| Column | Type | Sortable |
|--------|------|---------|
| Name | string | YES |
| Email | string | NO |
| Role | Badge | YES |
| Status | StatusBadge | YES |
| Joined | date | YES |
| Actions | menu | NO |

**Row actions:** Edit role, Revoke access (with ConfirmDialog)
**States:** Loading, Empty ("No staff yet — invite your first team member"), Loaded, Error

---

## Screen: Invite Staff Dialog

**Trigger:** "Invite Staff" button on Staff Management
**Component:** `Dialog` (modal)

**Form fields:** email (required), role (required, Select), branch (auto-filled)
**Validation:** email format, role required
**Success:** toast "Invitation sent", dialog closes, table refreshes

---

## Screen: Fee Schedule (`/staff/fee-schedule`)

**Roles:** `dentist_owner`
**Layout:** Search bar + CDT code table with inline price editing

**Components:** `Input` (search), `Table` (inline-editable)

**Columns:** CDT code, Description, Price (editable inline), Last updated
**Inline edit:** Click price → input field → blur to save
**States:** Loading, Loaded, Saving (per-row spinner), Error

---

## Screen: Branch Settings (`/settings/branch`)

**Roles:** `dentist_owner`
**Layout:** Form card — branch name, address, timezone, working hours

**Components:** `Card`, `Form`, `Input`, `Select` (timezone), `Button`
**States:** View mode, Edit mode, Saving, Success toast

---

## Screen: Audit Log

**Route:** `/audit/log` — canonical definition in `dental-audit/ui-prototype/screens.md`.
Accessible from the dental-org Reports sidebar as a nav link. No duplicate screen spec here.
