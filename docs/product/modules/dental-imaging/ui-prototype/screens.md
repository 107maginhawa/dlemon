# Screens — dental-imaging
<!-- oli: v3-dentalemon | dental-imaging | ui-prototype -->

Imaging workspace for capturing, viewing, annotating, and analyzing dental imaging studies (X-rays, photographs, CBCT references, cephalometric radiographs). Cephalometric analysis is gated behind the `imagingTier` feature flag on the organization. All studies are branch-scoped; reads available to all dental roles; uploads, annotations, findings, and ceph analysis restricted to dentists.

Design system: Apple HIG with `#FFE97D` lemon accent. SF Pro. `#F2F2F7` grouped background, white card surfaces, dark canvas (`#0B0B0F`) for the image viewer for clinical legibility. 44px touch targets; viewer toolbar buttons 44×44 for stylus/finger.

Key tables backing these screens: `dental_imaging_study`, `dental_imaging_image`, `dental_imaging_annotation`, `dental_imaging_finding`, `dental_ceph_analysis`, `dental_ceph_landmark`.

---

## Screen: Imaging Studies List (`/patients/:id/imaging`)
**Roles:** all dental roles read (branch-scoped); dentist_owner / dentist_associate write (Upload Study CTA)
**Layout:** Timeline-style list rendered against `#F2F2F7` grouped background. Header row: page title "Imaging" + `Upload Study` button (lemon primary, right-aligned, FAB on phone). Filter bar: study type segmented control (All / PA / BW / OPG / Photo / CBCT / Ceph) + date range chip + dentist filter chip. Each row is a card: leading thumbnail (first image of study, dark canvas with rounded corners), study date (large), `StudyTypeBadge`, image count chip, dentist avatar+name, findings count badge (`X findings`), `ceph` chip if `dental_ceph_analysis` exists. Row tap → Study Viewer. Sort: study_date desc.
**Components:** StudyListTimeline, StudyTypeBadge, UploadStudyDialog (modal trigger)
**States:**
- Loading (5 skeleton cards with shimmer)
- Empty ("No imaging studies for this patient." + Upload CTA)
- Filtered empty ("No studies match the current filters." + Clear filters action)
- Error (retry button inline)

---

## Screen: Study Viewer (`/patients/:id/imaging/:sid`)
**Roles:** all dental roles read; dentist_owner / dentist_associate write (annotate, add findings, run ceph)
**Layout:** Three-column layout on iPad landscape, collapses to single column on phone.
- **Left rail (96–120px):** vertical `ThumbnailStrip` of all images in the study; active thumbnail highlighted with 2px lemon ring.
- **Center (flex):** dark canvas `ImageViewer` filling viewport height minus 56px header. Above-canvas `AnnotationToolbar`: zoom in / zoom out / fit / pan / measure / annotate (point / line / polygon / arrow / text) / brightness / contrast / reset / fullscreen. Footer overlay shows mouse coords + measurement readouts. Annotation overlay rendered as SVG layer above image; annotations are clickable to focus.
- **Right rail (320px):** stacked accordion sections — Study metadata (date, type, region, dentist, notes), `FindingsPanel` (list of findings with severity badges + link to annotation), Annotations list (chronological).
Header bar: back to studies list, study title (`{type} — {date}`), `Run Ceph Analysis` button (only when study type is `ceph` and `org.imagingTier === true`).
**Components:** ThumbnailStrip, ImageViewer, AnnotationToolbar, AnnotationOverlay, FindingsPanel, FindingSeverityBadge, AddAnnotationDialog, AddFindingDialog
**States:**
- Loading image (placeholder + spinner on canvas, low-res preview swap when available)
- Image load error (retry CTA centered on canvas)
- Annotating (tool selected highlighted lemon; cursor crosshair; ESC cancels in-progress shape)
- Read-only role (toolbar shows only zoom/pan/brightness; annotate disabled with tooltip)
- Tier gate on ceph button (disabled + tooltip "Cephalometric analysis requires the Imaging tier")
- Saving annotation/finding (toast + optimistic overlay)
- Multi-image study: active image marker on thumbnail strip; keyboard ←/→ to navigate

---

## Screen: Upload Study Dialog (modal)
**Roles:** dentist_owner, dentist_associate
**Layout:** Radix Dialog, 560px width on iPad, full-screen sheet on phone. Title "Upload Study". Fields: study type selector (segmented: PA / BW / OPG / Photo / CBCT / Ceph), study date (defaults to today), tooth/region context (FDI picker, optional), notes (textarea, optional). Below fields: multi-file dropzone (dashed lemon border, 160px tall, "Drop DICOM files, images, or click to browse"). Each queued file appears as a row with filename, detected modality, size, progress bar, status (queued / uploading / done / error). DICOM (.dcm) auto-detected and modality inferred from DICOM tags when possible. Footer: Cancel | Upload (lemon primary, disabled until at least one file queued).
**Components:** UploadStudyDialog, FileAttachmentUploader (specialized variant with modality inference)
**States:**
- Default (form + empty dropzone)
- Files queued (rows with pending progress)
- Uploading (overall progress + per-file progress; Cancel becomes "Cancel uploads" with confirm dialog)
- Partial failure (succeeded files green, failed files red with retry; primary CTA becomes "Retry failed" or "Finish")
- Done (auto-close dialog + toast "Study uploaded. {N} images." → navigates to Study Viewer)

---

## Screen: Add Annotation Dialog (compact modal)
**Roles:** dentist_owner, dentist_associate
**Layout:** Small Radix Dialog (380px). Triggered after the user finishes drawing a shape on the canvas (point/line/polygon/arrow). Title "Add Annotation". Fields: annotation type (auto-filled from drawing tool, editable), label (text), color picker (preset palette: lemon, red, blue, green, white), notes (textarea, optional). Footer: Cancel (discards in-progress shape) | Save.
**Components:** AddAnnotationDialog
**States:**
- Default (label focused)
- Color preview live on canvas
- Submitting (Save spinner)
- Discard confirm (Radix AlertDialog when Cancel pressed with unsaved label)

---

## Screen: Add Finding Dialog (modal)
**Roles:** dentist_owner, dentist_associate
**Layout:** Radix Dialog (480px). Title "Add Finding". Fields: finding type (Select — caries / bone_loss / periapical / artifact / restoration / fracture / other), severity (segmented: low / moderate / high / critical), tooth/region (FDI picker), description (textarea, required), linked annotation (optional Combobox of existing study annotations). Footer: Cancel | Save.
**Components:** AddFindingDialog, FindingSeverityBadge (preview)
**States:**
- Default
- Validation (description required)
- Linked annotation preview (mini-thumbnail of linked annotation when selected)
- Submitting / success / error (toast)

---

## Screen: Cephalometric Analysis (`/patients/:id/imaging/:sid/ceph`)
**Roles:** dentist_owner, dentist_associate (run/edit); all read; **requires `org.imagingTier === true`**
**Layout:** Two-pane layout.
- **Left (flex):** ceph X-ray displayed on dark canvas, full-height. `CephLandmarkCanvas` overlay shows placed landmarks (lemon dot + label) and pending landmarks (gray ring at last-known position or center prompt). Toolbar: zoom / pan / undo / redo / clear all (with confirm).
- **Right (380px):** `CephLandmarkList` (sidebar of all landmarks for the active analysis — SNA, SNB, ANB, FMA, IMPA, SN-GoGn, U1-NA, L1-NB, Wits, etc. — with placed/unplaced state and required indicator). Below it, `CephResultsTable` with measurement name, computed value, normal range, deviation indicator (within range / mild / severe deviation). Footer: Recompute (auto on landmark change but manual button available), Export PDF Report.
Header: back to study viewer, "Cephalometric Analysis" title, completion progress chip (`{placed}/{total} landmarks`).
**Components:** CephLandmarkCanvas, CephLandmarkList, CephResultsTable
**States:**
- Tier gate (page redirects with toast if `imagingTier` false)
- Initial (no landmarks placed; CTA "Place first landmark: S — Sella")
- In progress (some placed; pending count visible)
- All landmarks placed (results table fully populated; Export enabled)
- Recomputing (table cells show subtle skeleton)
- Save error (toast; landmarks remain client-side until retry)

---

## Screen: Imaging Findings Summary (`/patients/:id/imaging/findings`)
**Roles:** all dental roles read; dentist write (edit/delete)
**Layout:** Aggregate view across all studies for the patient. Top toggle: group by Date | group by Tooth. List of findings grouped accordingly. Each finding row: severity badge, type, tooth/region, description (truncated), source study link (date + type chip) → deep-links back to Study Viewer with annotation focused. Filter chips: severity (low/moderate/high/critical), type. Empty state when no findings recorded.
**Components:** FindingsPanel (reused in aggregate mode), FindingSeverityBadge, StudyTypeBadge (as link chip)
**States:**
- Loading
- Empty ("No findings recorded across any imaging study.")
- Filtered empty
- Error
