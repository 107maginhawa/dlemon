# Interaction states — dental-audit
<!-- oli: v3-dentalemon | dental-audit | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Dashboard: loading (tile + chart skeletons) → loaded | empty (no events in branch) | error per panel.

Log table: loading (10-row skeleton) → results | filtered-empty | empty-ever | error. Row expand → drawer slide-in. Polling refresh every 30s on dashboard only.

Drawer: open → payload loading → loaded | error. Copy → toast.

Export dialog: idle → submitting → queued → generating (with cancel) → ready (download link) | failed. Dialog can close mid-job; result surfaces via toast.
