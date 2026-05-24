# Data table contracts — dental-audit
<!-- oli: v3-dentalemon | dental-audit | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Audit log columns: `created_at` (sortable, default desc), `event_type`, `actor_id` (ID only — names not stored, G-005 / AC-AUD-004), `resource_type`, `resource_id`, `branch_id`, `ip_address`.

Page size: 50. Server-side filter + sort + pagination. Branch scoped (AC-AUD-003).

Compact dashboard variant hides `branch_id` and `ip_address`; shows last 10 events.
