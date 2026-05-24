<!-- oli-version: 1.0 | generated: 2026-05-24 | skill: oli-ui-blueprint --blueprint --all -->

# Data Table Contracts — dental-org

## StaffTable

| Column | Field | Sortable | Filter | Format |
|--------|-------|---------|--------|--------|
| Name | person.full_name | YES | — | "First Last" |
| Email | person.email | NO | — | truncate at 30 |
| Role | role | YES | multi-select | StatusBadge |
| Status | status | YES | select | StatusBadge |
| Joined | created_at | YES | — | "DD MMM YYYY" |
| Actions | — | NO | — | DropdownMenu |

- Default sort: joined DESC
- Row actions: Edit role (Dialog), Revoke (ConfirmDialog + DELETE)
- Bulk actions: NONE (role changes are individual)
- Pagination: server-side, per_page 20

## FeeScheduleTable

| Column | Field | Sortable | Filter | Format |
|--------|-------|---------|--------|--------|
| CDT Code | cdt_code | YES | text search | monospace |
| Description | description | YES | text search | — |
| Price | price_cents | YES | — | "$0.00" (currency) |
| Last Updated | updated_at | NO | — | "DD MMM YYYY" |

- Inline edit: click price cell → number input → blur saves
- No pagination (max ~500 CDT codes, client-side)

## AuditLogTable

| Column | Field | Sortable | Filter | Format |
|--------|-------|---------|--------|--------|
| Timestamp | occurred_at | YES (default desc) | date range | "DD MMM YYYY HH:mm" |
| Actor | actor_id | NO | combobox | membership name lookup |
| Action | action | NO | select | monospace badge |
| Entity | aggregate_type | NO | select | — |
| Entity ID | aggregate_id | NO | — | truncated UUID |
| Details | metadata | NO | — | expandable row |

- Pagination: server-side, per_page 20 (max 100)
- Bulk actions: NONE (immutable records)
- Export: future (not Phase 1)
