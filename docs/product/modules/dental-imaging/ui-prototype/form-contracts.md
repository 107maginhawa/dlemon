# Form Contracts — dental-imaging
<!-- oli: v3-dentalemon | dental-imaging | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Upload study: `study_type` (required, enum PA/BW/OPG/Photo/CBCT/Ceph), `study_date` (required, date, default today), `tooth_region` (optional FDI string or arch label), `notes` (textarea, optional), `files[]` (required, min 1, accepted: image/png, image/jpeg, image/heic, application/dicom, .dcm). Max per-file size 200 MB (CBCT), 25 MB for non-DICOM (UI-side; server may differ).

Add finding: `finding_type` (required enum: caries / bone_loss / periapical / artifact / restoration / fracture / other), `severity` (required enum: low / moderate / high / critical), `tooth_region` (FDI picker, optional), `description` (required, min 4 chars), `linked_annotation_id` (optional uuid).

Add annotation: `annotation_type` (required enum: point / line / polygon / arrow / text), `label` (optional, max 80 chars), `color` (required, preset palette), `notes` (optional textarea), `coordinates` (required, computed from canvas gesture; shape-specific schema).

Ceph analysis: no top-level form. Landmarks are persisted per-placement as `{ landmark_code, x, y }`. The set of required landmark codes is canonical and fixed per analysis template version. Measurements are derived server-side or in an isomorphic math engine on the client; no user-entered values.

Edit study metadata (post-upload): `study_date`, `tooth_region`, `notes` editable; `study_type` and image set immutable in v1.
