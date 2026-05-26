# Interaction States — dental-imaging
<!-- oli: v3-dentalemon | dental-imaging | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Image viewer: loading large DICOM/CBCT shows a centered spinner over a low-res preview placeholder. Failed image load surfaces a retry CTA on canvas without unmounting the viewer shell. Brightness/contrast persist per-image during the session only.

Annotation drawing: cursor switches to crosshair when an annotation tool is active. In-progress shape uses dashed stroke; ESC discards. Polygon close requires Enter or double-click. Saving an annotation is optimistic — the shape commits to the overlay immediately and reverts with a toast on server error.

Findings: severity is purely informational in UI; deleting a finding asks for AlertDialog confirmation. Linked annotation chip highlights the target shape on the canvas on hover.

Ceph workflow: required landmarks are flagged with an asterisk; unplaced required landmarks gate Export. Placed landmarks render as lemon dots; pending landmarks are gray rings in the sidebar only (not on canvas). Drag-to-reposition snaps to integer pixels; on release, debounced recompute updates the results table.

Tier gating: when `org.imagingTier === false`, the `Run Ceph Analysis` CTA is rendered disabled with a tooltip, and direct navigation to `/patients/:id/imaging/:sid/ceph` redirects to the study viewer with a toast: "Cephalometric analysis requires the Imaging tier. Contact your administrator."

Upload: per-file progress bars with success/failure states. Failed uploads show retry; canceling mid-upload prompts AlertDialog confirm. DICOM auto-detection runs after file selection and infers modality; user can still override study_type before submit.

Read-only role: viewer toolbar collapses to zoom/pan/brightness; annotation/finding CTAs hidden; ceph routes redirect read-only roles to the study viewer.
