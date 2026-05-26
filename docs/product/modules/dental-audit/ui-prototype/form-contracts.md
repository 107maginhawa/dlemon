# Form contracts — dental-audit
<!-- oli: v3-dentalemon | dental-audit | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Filter bar:
- `date_range` — required, `{ from, to }`, default last 7 days
- `actor_id` — optional string
- `event_types[]` — optional, multi-select
- `resource_type` — optional, single select

Export form:
- `date_from`, `date_to` — required dates
- `format` — required enum: `csv | json`
- `event_types[]` — optional
- `resource_type` — optional

No create / update / delete forms. Audit module is read-only by contract (AC-AUD-002 — 405 on modify/delete).
