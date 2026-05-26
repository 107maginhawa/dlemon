# Interaction states — dental-emr
<!-- oli: v3-dentalemon | dental-emr | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

List: loading skeleton → empty ("No external medical records imported…") | populated | filtered-empty | error.

Import dialog: idle → uploading → parsing (FHIR) → preview (structured) | preview-fallback (unknown format) → submitting → success/error.

Viewer: loading skeleton → loaded (structured) | loaded (PDF iframe fallback) | partial (missing sections placeholders) | 404.
