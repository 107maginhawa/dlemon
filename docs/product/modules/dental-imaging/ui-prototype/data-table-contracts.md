# Data Table Contracts — dental-imaging
<!-- oli: v3-dentalemon | dental-imaging | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Studies list (rendered as cards, not table): `study_date`, `study_type`, `image_count`, `dentist`, `findings_count`, `has_ceph_analysis` (boolean → ceph chip). Sort: `study_date` desc. Filter: type, date range, dentist. Branch-scoped query.

Findings summary table (aggregate across studies): `study_date`, `study_type` (badge), `finding_type`, `severity` (`FindingSeverityBadge`), `tooth_region`, `description` (truncated 60 chars). Sort modes: group by date desc, or group by FDI tooth ascending. Filter: severity, type.

Ceph results table: `name`, `value`, `unit`, `normal_low`, `normal_high`, derived `deviation_class` (within / mild / severe). No sort — fixed canonical order (SNA, SNB, ANB, FMA, IMPA, SN-GoGn, U1-NA, L1-NB, Wits, ...).

Annotations list (right rail in viewer): `created_at`, `type`, `label`, `author`. Sort: `created_at` asc (drawing order).
