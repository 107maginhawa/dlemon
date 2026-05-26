# Interaction states — dental-pmd
<!-- oli: v3-dentalemon | dental-pmd | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

PMD list: loading (5-row skeleton), empty (no completed visits yet), populated, error with retry.

Import dialog: idle → uploading (progress) → verifying (spinner) → preview (or mismatch warning) → submitting → success/error. Checksum mismatch shows orange callout with secondary `Import as Unverified` action.

Generate dialog: eligible → generating → success (download + view) | not-eligible (SOAP unsigned) | already-exists (link).

Verification panel: idle → re-verifying → verified (green) | mismatch (red) | error (retry).
