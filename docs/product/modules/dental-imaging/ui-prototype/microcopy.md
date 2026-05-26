# Microcopy — dental-imaging
<!-- oli: v3-dentalemon | dental-imaging | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Primary CTAs: "Upload Study", "Add Finding", "Annotate", "Run Ceph Analysis", "Place Landmark", "Recompute", "Export PDF Report", "Clear All".

Page / panel titles: "Imaging", "Studies", "Findings", "Cephalometric Analysis".

Empty states: "No imaging studies for this patient." / "No findings recorded across any imaging study." / "No annotations on this study yet."

Filtered empty: "No studies match the current filters." with "Clear filters" action.

Tier gate (Ceph button + redirect toast): "Cephalometric analysis requires the Imaging tier. Contact your administrator."

Upload toasts: "Study uploaded. {N} images." / "Some files failed to upload. Retry?" / "Upload canceled."

Annotation toasts: "Annotation saved." / "Finding added." / "Finding deleted." Errors: "Couldn't save. Try again."

Ceph workflow copy: progress chip "{placed}/{total} landmarks", placement prompt header "Place next: {code} — {name}", export disabled hint "Place all required landmarks to export.", deviation labels "Within range" / "Mild deviation" / "Severe deviation".

Confirm dialogs: "Discard annotation?" / "Clear all landmarks for this analysis?" / "Cancel upload?" (destructive style, red primary).
