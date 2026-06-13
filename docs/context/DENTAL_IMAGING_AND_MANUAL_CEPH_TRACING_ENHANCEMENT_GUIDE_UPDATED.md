# Dental Imaging + Manual Cephalometric Tracing Enhancement Guide

**Target system:** Existing Dental Management System V1  
**Purpose:** Guide an AI coding agent or engineering team to enhance the existing system with robust dental imaging, manual cephalometric tracing, measurement, reporting, versioning, and clinical workflow rules.  
**V1 direction:** Manual-first. No AI landmark detection, no automated diagnosis, no automated treatment simulation in this phase.  
**Prepared for:** Enhancing an already-built dental management system, not rebuilding from scratch.  
**Date:** 2026-06-10

---

> ⚠️ **READ FIRST — this guide is written greenfield and UNDERSHOOTS the current code.**
> The ceph/imaging module already exceeds this guide's "V1 manual-first" scope: it has **6 analyses** (Steiner, Ricketts, Downs, Tweed, McNamara, Jarabak), a richer landmark FSM (`not_placed→placed→confirmed→locked`), **6 population norm sets**, calibration-safe math, immutable versioned reports, superimposition, and a landmark instruction library (§31.5 is already built). **Do not rebuild these.**
> Before implementing anything from this guide, read the reconciliation:
> **`docs/reviews/research/ceph-guide-reconciliation.md`** — it maps each section to real code (✅/◐/❌/🚫), lists "do not rebuild," and isolates the genuine gaps (report version-pinning, trace-session FSM, sign-off split, template abstraction, library breadth, versioned calibration). Treat this guide as a **spec reference**, not a build-from-zero plan, and consult `docs/audits/module-gap-plans/dental-imaging-gap-plan.md` for the wiring gaps.

---

## 0. How to Use This Document

Give this file to the AI coding agent before implementation.

The agent must treat this as an **enhancement specification**. The Dental Management System V1 already exists, so the first responsibility is to inspect what is already there, preserve working behavior, and add imaging/ceph workflows in small, testable vertical slices.

The agent must not assume it is starting from a blank codebase.

### Required AI Agent Behavior

Before coding, the agent must:

1. Inspect current routes, modules, UI components, state management, data models, API services, permissions, and test setup.
2. Identify existing imaging, patient, visit, dental chart, treatment plan, notes, attachments, audit, and reporting capabilities.
3. Produce a gap map between the existing system and this enhancement guide.
4. Propose a small implementation sequence.
5. Avoid destructive rewrites unless the current module is demonstrably unusable.
6. Add tests for each vertical slice before moving to the next.
7. Mark clinical uncertainties as `NEEDS CLINICAL VALIDATION`.
8. Mark product decisions as `NEEDS PRODUCT DECISION`.
9. Mark deferred features as `V2` or `FUTURE`.

### V1 Scope Boundary

Included in V1:

- Patient imaging library.
- Image upload/import.
- Image metadata.
- Linking images to patient, visit, tooth, treatment plan, and orthodontic case if available.
- Image viewer with basic clinical tools.
- Calibration.
- Annotation layer.
- Manual cephalometric tracing for lateral cephalometric radiographs.
- Guided landmark placement.
- Measurement calculation engine.
- Draft/final/revision lifecycle.
- Printable/exportable ceph report.
- Trace version history and audit trail.
- Permission rules.
- Tests and acceptance criteria.

Excluded from V1:

- AI landmark detection.
- Automated diagnosis.
- Automated treatment recommendation.
- Orthognathic surgical simulation.
- CBCT/3D cephalometry.
- Full DICOM PACS implementation unless already present.
- Patient-facing ceph interpretation unless explicitly approved.
- Final clinical norm ranges without orthodontist validation.

---

## 1. Research-Based Product Principles

This guide is based on publicly accessible cephalometric workflow patterns, open-source ceph tracing applications, and clinical cephalometric references.

### Key Observations From Public References

1. **Cephalometric analysis is primarily based on lateral skull radiographs.** It evaluates skeletal, dental, and soft tissue relationships using landmarks, lines, planes, angles, and distances.
2. **Digital tracing should streamline manual clinical tracing, not hide clinical judgment.** The clinician still needs to place, verify, and interpret landmarks.
3. **Guided tracing is important.** Public ceph tools commonly guide users through analysis selection, landmark placement, automatic measurement, interpretation, and export.
4. **Measurements should update immediately after landmark placement.** This is a common expectation in digital tracing tools.
5. **Custom analysis and measurement definitions matter.** Orthodontic practices may use different analyses, norm sets, and report structures.
6. **Trace data and reports must be reproducible.** A finalized report should reference the exact image, calibration, landmarks, formulas, norm set, and trace version used.
7. **Ceph values are not standalone diagnosis.** Cephalometric values should be interpreted in clinical context, and norms can vary by age, sex, ethnicity, and analysis method.
8. **Manual-first is the correct V1 path.** AI/automation can be added later as a suggestion layer, but the foundational manual tracing workflow must be reliable first.

---

## 2. Existing Dental System Integration Assumptions

The V1 Dental Management System likely already has some or all of these:

- Patient records.
- Visit records.
- Dental charting / odontogram.
- Treatment notes.
- Treatment plans.
- Billing or procedures.
- Scheduling.
- User roles.
- Possibly a patient workspace with carousel or panels.
- Possibly attachments or file uploads.

The imaging/ceph enhancement must integrate with the existing workflow rather than becoming a disconnected tool.

### Recommended Information Architecture

```text
Patient Record
  ├─ Overview
  ├─ Visits / Timeline
  ├─ Dental Chart
  ├─ Treatment Plans
  ├─ Imaging Library
  │    ├─ Photos
  │    ├─ X-rays
  │    ├─ Panoramic
  │    ├─ Lateral Ceph
  │    ├─ Annotations
  │    └─ Ceph Traces
  ├─ Orthodontic Case / Ortho Workspace, if available
  └─ Reports
```

### Core Integration Rule

An image belongs to the **patient**, but it may also be linked to one or more clinical contexts:

- Visit.
- Tooth or teeth.
- Dental chart finding.
- Procedure.
- Treatment plan.
- Orthodontic case.
- Report.

Do not duplicate the image file for each context. Use links/relationships.

---

## 3. User Roles and Permissions

### Suggested Roles

| Role | Typical Rights |
|---|---|
| Dentist | View, upload, annotate, calibrate, trace, finalize, export. |
| Orthodontist | Full ceph tracing and finalization rights. |
| Dental Assistant | Upload, organize, annotate, prepare draft traces, but may not finalize unless configured. |
| Radiology/Imaging Staff | Upload, classify, quality-check, calibrate if allowed. |
| Clinic Admin | Manage settings, templates, access, storage, but not necessarily sign clinical traces. |
| Patient Portal User | View shared reports only, if patient portal exists. |

### Permission Keys

Implement permission checks using the system’s existing RBAC pattern. Suggested permission keys:

```text
imaging.view
imaging.upload
imaging.edit_metadata
imaging.archive
imaging.link_context
imaging.annotate
imaging.calibrate
imaging.export
ceph.trace.create
ceph.trace.edit_draft
ceph.trace.finalize
ceph.trace.revise
ceph.trace.export_report
ceph.template.manage
ceph.norms.manage
ceph.audit.view
```

### Permission Business Rules

1. Anyone who can view a patient should not automatically be allowed to view all imaging; follow existing clinical access rules.
2. Uploading an image does not imply permission to finalize a ceph trace.
3. Assistants may prepare a draft trace, but only authorized clinicians should finalize/sign.
4. Finalized traces cannot be edited silently.
5. Template and norm-set management should be restricted to admin/clinical lead roles.
6. Exporting patient reports should be logged.

---

## 4. Imaging Library Module

### Purpose

The Imaging Library is the patient’s central visual clinical archive.

It should support X-rays, clinical photos, ceph images, annotations, and links to visits/treatments. Ceph tracing is an advanced workflow inside this broader imaging module.

### Supported Image Types

Minimum V1 image types:

```text
intraoral_photo
extraoral_photo
periapical_xray
bitewing_xray
panoramic_xray
lateral_ceph_xray
other_clinical_image
```

Optional later:

```text
cbct
stl_scan
dicom_study
implant_planning_image
orthodontic_progress_photo
```

### Imaging Library Workflow

1. User opens patient record.
2. User opens Imaging Library.
3. System displays images grouped by date, type, and clinical context.
4. User uploads/imports an image.
5. User classifies image type.
6. User enters or confirms metadata.
7. System stores the original image and creates preview/thumbnail.
8. User links image to visit/tooth/treatment/ortho case if needed.
9. System shows image in library and related context timelines.

### Required Metadata

Minimum metadata:

```text
imageId
patientId
imageType
fileStorageKey
thumbnailStorageKey
originalFilename
mimeType
width
height
dateTaken
uploadedBy
clinicId
qualityStatus
notes
createdAt
updatedAt
archivedAt
```

Recommended metadata:

```text
sourceDevice
acquisitionMethod
orientation
bodyRegion
toothNumbers
visitId
orthodonticCaseId
treatmentPlanId
tags
isDiagnostic
retakeReason
```

### Imaging Business Rules

1. Every image must belong to one patient.
2. An image can be linked to many clinical contexts.
3. Removing a context link does not delete the image.
4. Archiving an image removes it from default views but keeps audit history.
5. Hard delete should be restricted and may be disabled for clinical records.
6. The original file must remain unchanged.
7. Derived transformations and annotations must be stored separately.
8. Unsupported files must fail gracefully without creating broken records.
9. Large image uploads must not freeze the UI.
10. Upload failures must be recoverable.

### Imaging Library Filters

Support filters by:

- Image type.
- Date taken.
- Visit.
- Tooth/teeth.
- Treatment plan.
- Orthodontic case.
- Uploaded by.
- Quality status.
- Tag.
- Archived status.

---

## 5. Image Viewer Module

### Purpose

The viewer is the foundation for all imaging workflows. Ceph tracing depends on it.

### V1 Viewer Tools

Minimum tools:

- Open image.
- Zoom in/out.
- Pan.
- Fit to screen.
- Reset view.
- Rotate view.
- Brightness/contrast adjustment.
- Invert grayscale.
- Show/hide metadata.
- Show/hide annotations.
- Export current view.

Recommended tools:

- Measurement ruler.
- Angle measurement.
- Fullscreen mode.
- Side-by-side comparison.
- Before/after comparison.
- Keyboard shortcuts.
- Touch gestures.
- Magnifier/loupe.

### Viewer Rules

1. Viewer transformations must not alter the original image file.
2. Coordinates must be stored in original image coordinate space.
3. Annotations and landmarks must remain aligned after zoom, pan, resize, rotate, and export.
4. Rotation may be a view state unless saved as a derived image.
5. Flipping should be restricted or clearly labeled because it can invert clinical orientation.
6. Measurements must clearly show whether they are calibrated.
7. Image rendering must handle high-resolution radiographs efficiently.

### Coordinate System Rule

All persisted geometry must use original image coordinates:

```text
x = pixel coordinate relative to original image width
y = pixel coordinate relative to original image height
```

Do not persist screen/canvas coordinates as clinical source of truth.

The UI may transform image-native coordinates into viewport coordinates for rendering.

---

## 6. Calibration Workflow

### Purpose

Calibration converts image pixel distances into real-world millimeters.

### When Calibration Is Required

Calibration is required for:

- Distance measurements in mm.
- Some reportable dental/ceph measurements.
- Follow-up distance comparisons.

Calibration is not required for:

- Angular measurements, although image distortion and acquisition quality still matter clinically.

### Calibration Workflow

1. User opens image.
2. User selects calibration tool.
3. System prompts: “Place two points on a known scale/ruler.”
4. User places Point A and Point B.
5. User enters known distance in mm.
6. System calculates pixel distance.
7. System calculates pixels-per-mm.
8. System stores calibration record.
9. Viewer displays calibrated status.
10. Any dependent measurements recompute.

### Calibration Data

```text
calibrationId
imageId
version
pointA: { x, y }
pointB: { x, y }
knownDistanceMm
pixelDistance
pixelsPerMm
createdBy
createdAt
status
notes
```

### Calibration Business Rules

1. Calibration belongs to an image.
2. Calibration must be versioned.
3. Changing calibration after trace finalization requires a new trace revision.
4. A finalized report must reference the exact calibration version used.
5. If calibration is missing, distance measurements must show `uncalibrated` or `incomplete`.
6. Angular measurements can be computed without calibration but should still show image-quality warnings if relevant.
7. The system must log calibration creation and changes.
8. User must be warned when recalibration affects existing measurements.

---

## 7. Annotation Layer

### Purpose

The annotation layer supports general clinical markup separate from ceph-specific landmarks.

### Annotation Types

V1:

- Point.
- Line.
- Arrow.
- Rectangle.
- Ellipse.
- Text note.
- Freehand path.
- Distance measurement.
- Angle measurement.

Optional V2:

- Area measurement.
- Tooth-specific finding marker.
- Layer groups.
- Shared annotation templates.

### Annotation Workflow

1. User opens image.
2. User selects annotation tool.
3. User places annotation.
4. User adds label/note if needed.
5. System stores annotation geometry in image-native coordinates.
6. User can edit, hide, lock, or archive annotation.
7. System logs changes.

### Annotation Rules

1. Store annotations separately from image file.
2. Persist annotations as geometry JSON plus metadata.
3. Support show/hide overlays.
4. Support lock/unlock.
5. Locked or signed annotations require revision workflow to edit.
6. Author and timestamp must be stored.
7. Annotations should support visit linkage when clinically relevant.

---

## 8. Manual Cephalometric Tracing Module

### Purpose

The ceph tracing module lets clinicians manually identify cephalometric landmarks on lateral ceph images, calculate measurements, interpret them using selected norm sets, and generate a report.

### V1 Clinical Positioning

This is a **manual tracing assistant**, not an automated diagnostic engine.

The system should help the clinician:

- Select analysis template.
- Place landmarks accurately.
- See required/missing landmarks.
- Recalculate measurements instantly.
- Review and finalize findings.
- Export a reproducible report.

### Ceph Trace Entry Points

A trace can be started from:

- Patient Imaging Library.
- Lateral ceph image viewer.
- Orthodontic case workspace.
- Visit workspace.
- Treatment planning workspace.

### Start Trace Workflow

1. User opens a lateral ceph image.
2. User selects “Start Ceph Trace.”
3. System validates image type.
4. System checks calibration status.
5. User selects analysis template.
6. User selects norm set if required.
7. System creates draft trace session.
8. User enters guided landmark placement workspace.

### Trace Statuses

```text
draft
ready_for_review
finalized
revised
archived
```

### Trace Status Rules

| Status | Editable? | Reportable? | Notes |
|---|---:|---:|---|
| draft | Yes | Draft only | Work in progress. |
| ready_for_review | Limited | Draft only | Optional if assistant prepares trace. |
| finalized | No | Yes | Locked clinical output. |
| revised | No | Historical | Superseded by a newer version. |
| archived | No | Hidden by default | Retained for audit. |

---

## 9. Landmark Placement Workflow

### Landmark Placement UX

The user should never feel lost. The system should always show:

- Current active landmark.
- Short landmark placement instruction.
- Required vs optional status.
- Previously placed landmarks.
- Missing landmarks.
- Measurements affected by the current landmark.
- Trace completion percentage.

### Landmark Placement Workflow

1. System loads selected analysis template.
2. System displays required landmark sequence.
3. System highlights the current landmark in the list.
4. System shows anatomical placement guidance.
5. User clicks/taps image to place landmark.
6. Landmark label appears on image.
7. Measurements dependent on that landmark update.
8. System advances to the next required landmark.
9. User may move, nudge, hide, skip optional, or delete a landmark.
10. System persists draft progress.

### Landmark Interaction Requirements

Support:

- Click/tap to place.
- Drag to move.
- Nudge with arrow keys.
- Undo/redo.
- Zoom while placing.
- Temporary magnifier/loupe.
- Hide/show labels.
- Snap disabled by default unless clinically justified.
- Placement history.

### Landmark Source

Even though V1 is manual, the model should support source tracking for future extensibility.

```text
source = manual | imported | ai_suggested_future
```

For V1, only `manual` and possibly `imported` are active.

### Landmark Data

```text
landmarkInstanceId
traceSessionId
landmarkDefinitionId
x
y
source
confidence
status
createdBy
updatedBy
createdAt
updatedAt
```

For V1 manual landmarks:

```text
source = manual
confidence = null
status = placed | missing | skipped
```

### Landmark Business Rules

1. Required landmarks must be placed before finalization.
2. Optional landmarks can be skipped.
3. Moving a landmark must recompute affected measurements.
4. Deleting a landmark must mark dependent measurements incomplete.
5. Landmark coordinates must be stored in original image coordinates.
6. Landmark edits must be logged.
7. Finalized trace landmarks are locked.
8. Corrections to finalized landmarks require a new trace revision.

---

## 10. Suggested Landmark Definitions for V1

Final landmark list must be clinically validated by an orthodontist.

### Minimum Skeletal Landmarks for Basic V1

```text
S  - Sella
N  - Nasion
A  - A Point / Subspinale
B  - B Point / Supramentale
Pg - Pogonion
Gn - Gnathion
Me - Menton
Go - Gonion
ANS - Anterior Nasal Spine
PNS - Posterior Nasal Spine
Or - Orbitale
Po - Porion
```

### Suggested Dental Landmarks

```text
U1Tip   - Upper incisor tip
U1Apex  - Upper incisor apex
L1Tip   - Lower incisor tip
L1Apex  - Lower incisor apex
U6      - Upper first molar reference point
L6      - Lower first molar reference point
```

### Suggested Soft Tissue Landmarks

```text
SoftNasion
Pronasale
Subnasale
SoftTissueA
UpperLip
LowerLip
SoftTissuePogonion
SoftTissueMenton
```

### V1 Recommendation

Implement the landmark system as configurable definitions, not hard-coded UI points.

Each landmark definition should include:

```text
id
code
name
category: skeletal | dental | soft_tissue | constructed
requiredByTemplates[]
instruction
aliases[]
displayOrder
isRequiredDefault
isActive
```

---

## 11. Analysis Templates

### Purpose

An analysis template defines which landmarks, planes, measurements, norms, and report sections are required.

### Initial V1 Templates

Recommended V1:

1. Basic Skeletal Analysis.
2. Basic Steiner-style Analysis.
3. Basic Dental Relationship Analysis if formulas are validated.

V2 templates:

- Downs analysis.
- Wits appraisal.
- Tweed’s Triangle.
- Vertical relationships.
- Mandibular rotation analysis.
- Soft tissue analysis.
- Custom clinic template.

### Analysis Template Data

```text
templateId
name
description
version
requiredLandmarks[]
optionalLandmarks[]
measurementDefinitions[]
normSetOptions[]
reportSections[]
createdBy
createdAt
updatedAt
isActive
```

### Template Rules

1. Templates must be versioned.
2. A finalized trace references the exact template version used.
3. Changing a template must not change old reports.
4. Templates should be configurable later, but initial definitions may be seeded in code or database.
5. Do not hard-code one analysis permanently into the UI.

---

## 12. Measurement Engine

### Purpose

The measurement engine computes cephalometric angles and distances from landmarks.

It must be separate from UI components.

### Recommended Architecture

```text
packages/ceph-math
  ├─ geometry
  │   ├─ points
  │   ├─ lines
  │   ├─ vectors
  │   ├─ angles
  │   └─ distances
  ├─ calibration
  ├─ landmarks
  ├─ measurements
  ├─ norms
  └─ tests
```

If the current system does not support packages, use a clean domain/service module instead:

```text
src/modules/ceph/domain
src/modules/ceph/services
src/modules/ceph/tests
```

### Geometry Functions

Minimum required functions:

```text
distancePx(pointA, pointB)
distanceMm(pointA, pointB, pixelsPerMm)
angleThreePoints(pointA, vertexPoint, pointC)
angleBetweenLines(line1, line2)
lineFromPoints(pointA, pointB)
projectPointToLine(point, line)
perpendicularDistanceToLine(point, line)
```

### Measurement Result Data

```text
measurementResultId
traceSessionId
measurementDefinitionId
value
unit
status
interpretation
formulaVersion
normSetId
dependenciesJson
computedAt
```

### Measurement Statuses

```text
complete
incomplete_missing_landmarks
uncalibrated
invalid_geometry
not_applicable
```

### Measurement Business Rules

1. Every measurement declares required landmarks.
2. Measurement should not compute if required landmarks are missing.
3. Distance measurements require calibration if reported in mm.
4. Angular measurements can compute without calibration.
5. Measurement formula versions must be stored.
6. Finalized reports store measurement snapshots.
7. Formula changes must not mutate historical report outputs.
8. Interpretation must be configurable and clinically validated.

---

## 13. Minimum V1 Measurements

### Recommended Minimum

Start with a clinically useful but limited set:

```text
SNA
SNB
ANB
```

Then add only formulas that are verified by clinical review and test cases.

### Measurement Definitions

#### SNA

Purpose: Relationship of maxilla/A-point to cranial base reference using Sella and Nasion.

Required landmarks:

```text
S
N
A
```

Type:

```text
angle
```

Status:

```text
NEEDS CLINICAL VALIDATION for exact implementation and display convention.
```

#### SNB

Purpose: Relationship of mandible/B-point to cranial base reference using Sella and Nasion.

Required landmarks:

```text
S
N
B
```

Type:

```text
angle
```

Status:

```text
NEEDS CLINICAL VALIDATION for exact implementation and display convention.
```

#### ANB

Purpose: Difference/relationship between maxilla and mandible position.

Required landmarks:

```text
A
N
B
```

Common computation options:

```text
Option 1: angle A-N-B directly
Option 2: SNA - SNB
```

Status:

```text
NEEDS CLINICAL VALIDATION: decide and document calculation convention.
```

### Important Rule

Do not silently assume formulas. The agent must implement formulas only after defining them in measurement definitions and adding unit tests with known coordinates.

---

## 14. Norm Sets and Interpretation

### Purpose

Norm sets provide reference ranges and labels for measurements.

### Norm Set Data

```text
normSetId
name
description
populationContext
ageRange
sexApplicability
ethnicityApplicability
sourceReference
version
measurementNorms[]
isActive
```

### Measurement Norm Data

```text
measurementDefinitionId
normalMin
normalMax
idealValue
standardDeviation
lowInterpretation
normalInterpretation
highInterpretation
severityBands[]
```

### Norm Business Rules

1. Norm ranges are configurable.
2. Norms must be versioned.
3. Finalized reports reference exact norm set version.
4. Do not hard-code final norm values without clinical validation.
5. If patient age/sex/population context is unknown, show general norms only if approved.
6. Interpretation labels must be editable/configurable.
7. Norms should be treated as references, not diagnosis.

### Suggested Interpretation Language

Use careful language:

```text
within selected reference range
above selected reference range
below selected reference range
requires clinical correlation
incomplete measurement
uncalibrated distance measurement
```

Avoid overconfident language:

```text
patient has Class II
patient requires extraction
patient needs surgery
```

Unless such statements are explicitly clinician-authored.

---

## 15. Trace Review and Finalization

### Review Workflow

1. User completes required landmarks.
2. System shows trace completion status.
3. System shows measurement table.
4. System shows missing/invalid measurements.
5. User reviews landmarks and measurements.
6. User adds clinical note.
7. User clicks “Finalize Trace.”
8. System asks for confirmation.
9. System locks trace and creates final snapshot.
10. System records finalization audit event.

### Finalization Requirements

Before finalization, validate:

- Required landmarks are placed.
- Required measurements are complete.
- Calibration status is known.
- Analysis template is selected.
- Norm set is selected or intentionally omitted.
- User has finalization permission.
- Trace has not already been finalized.

### Finalization Rules

1. Finalized traces are immutable.
2. A finalized trace can be viewed and exported.
3. To correct a finalized trace, create a revision.
4. Revision copies the prior trace into a new draft version.
5. Old finalized trace remains in history.
6. Reports always point to a specific trace version.

---

## 16. Report Generation

### Purpose

The ceph report is the clinical output of a finalized trace.

### Report Workflow

1. User opens finalized trace.
2. User clicks “Generate Report” or “Export PDF.”
3. System builds a report snapshot.
4. Report includes patient, image, trace, measurement, and note details.
5. Report can be printed/exported.
6. Export event is logged.

### Report Content

Minimum report sections:

- Clinic name/logo if available.
- Patient name and ID.
- Patient age/date of birth if available and permitted.
- Image type and date taken.
- Trace date.
- Clinician/finalized by.
- Analysis template and version.
- Norm set and version.
- Calibration status.
- Tracing overlay image.
- Measurement table.
- Interpretation notes.
- Clinician notes.
- Draft/final/revision status.
- Disclaimer: measurements require clinical interpretation.

### Measurement Table Columns

```text
Measurement
Value
Unit
Reference Range
Interpretation
Status
```

### Report Snapshot Rules

1. Reports must be reproducible.
2. Store snapshot JSON at report generation/finalization.
3. Do not regenerate old reports from changed formulas or norms unless explicitly creating a new report version.
4. Exported PDF must identify draft vs finalized status.
5. Reports must not expose internal database IDs.
6. Export must be permission-checked and audited.

---

## 17. Trace Revision Workflow

### Purpose

Clinical corrections should preserve history.

### Revision Workflow

1. User opens finalized trace.
2. User selects “Create Revision.”
3. System verifies permission.
4. System copies finalized trace into a new draft version.
5. User edits landmarks/calibration/template notes as needed.
6. System recomputes measurements.
7. User finalizes revised trace.
8. Old trace is marked `revised` but remains viewable.

### Revision Rules

1. Never edit finalized trace in place.
2. Always record reason for revision.
3. Preserve old trace, old measurements, old report, and old audit trail.
4. New revision should have a new version number.
5. Comparison between versions should be available if practical.

---

## 18. Follow-Up and Comparison Workflow

### Purpose

Orthodontic cases often need before/after or progress comparison.

### V1 Comparison

Minimum:

- Show two images side-by-side.
- Show two finalized traces side-by-side.
- Show measurement differences in a table.

### V2 Comparison

Optional:

- Overlay superimposition.
- Growth/change visualization.
- Export progress report.

### Comparison Rules

1. Always show dates and trace versions.
2. Flag if norm sets differ.
3. Flag if one trace is calibrated and the other is not.
4. Flag if analysis templates differ.
5. Do not imply clinical improvement without clinician-authored interpretation.

---

## 19. Dental Chart and Treatment Plan Integration

### Integration Points

Images and traces should appear in:

- Patient imaging library.
- Visit timeline.
- Orthodontic case page.
- Treatment plan attachments.
- Report library.
- Dental chart context panel, if relevant.

### Example Use Cases

#### Use Case: Orthodontic Initial Assessment

1. Patient comes for ortho consultation.
2. Staff uploads lateral ceph and extraoral photos.
3. Orthodontist opens lateral ceph.
4. Orthodontist creates manual trace.
5. Measurements are calculated.
6. Orthodontist finalizes trace.
7. Report is linked to treatment plan.

#### Use Case: Progress Review

1. Patient returns after treatment interval.
2. New lateral ceph is uploaded.
3. Orthodontist creates new trace.
4. System compares prior and current measurements.
5. Orthodontist adds progress note.
6. Report is stored in patient timeline.

#### Use Case: Assistant Prepares Draft Trace

1. Assistant uploads lateral ceph.
2. Assistant starts trace and places landmarks.
3. Trace status becomes `ready_for_review`.
4. Orthodontist opens draft, adjusts landmarks, and finalizes.
5. Audit trail shows assistant preparation and orthodontist finalization.

### Integration Rules

1. Ceph trace is part of clinical record.
2. Trace report can be linked to treatment plan.
3. Treatment plan should not depend on mutable draft trace unless clearly marked.
4. Finalized trace should appear in timeline.
5. Draft trace visibility should be role-controlled.

---

## 20. Recommended Data Model

The agent must adapt this to the current system’s actual ORM/database style.

### ImagingAsset

```ts
type ImagingAsset = {
  id: string;
  patientId: string;
  imageType: ImagingImageType;
  fileStorageKey: string;
  thumbnailStorageKey?: string;
  originalFilename: string;
  mimeType: string;
  width?: number;
  height?: number;
  dateTaken: string;
  uploadedBy: string;
  clinicId?: string;
  sourceDevice?: string;
  qualityStatus: 'acceptable' | 'needs_retake' | 'poor_quality' | 'non_diagnostic' | 'unknown';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};
```

### ImagingLink

```ts
type ImagingLink = {
  id: string;
  imageId: string;
  patientId: string;
  visitId?: string;
  toothId?: string;
  treatmentPlanId?: string;
  orthodonticCaseId?: string;
  reportId?: string;
  createdBy: string;
  createdAt: string;
};
```

### ImageCalibration

```ts
type ImageCalibration = {
  id: string;
  imageId: string;
  version: number;
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  knownDistanceMm: number;
  pixelDistance: number;
  pixelsPerMm: number;
  status: 'active' | 'superseded' | 'invalid';
  createdBy: string;
  createdAt: string;
};
```

### ImageAnnotation

```ts
type ImageAnnotation = {
  id: string;
  imageId: string;
  annotationType: 'point' | 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'freehand' | 'distance' | 'angle';
  geometryJson: unknown;
  label?: string;
  note?: string;
  layer?: string;
  locked: boolean;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  revisionOf?: string;
};
```

### CephTraceSession

```ts
type CephTraceSession = {
  id: string;
  imageId: string;
  patientId: string;
  orthodonticCaseId?: string;
  status: 'draft' | 'ready_for_review' | 'finalized' | 'revised' | 'archived';
  analysisTemplateId: string;
  analysisTemplateVersion: number;
  normSetId?: string;
  normSetVersion?: number;
  calibrationId?: string;
  version: number;
  revisionReason?: string;
  createdBy: string;
  finalizedBy?: string;
  finalizedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

### CephLandmarkDefinition

```ts
type CephLandmarkDefinition = {
  id: string;
  code: string;
  name: string;
  category: 'skeletal' | 'dental' | 'soft_tissue' | 'constructed';
  instruction?: string;
  aliases?: string[];
  displayOrder: number;
  isActive: boolean;
};
```

### CephLandmarkInstance

```ts
type CephLandmarkInstance = {
  id: string;
  traceSessionId: string;
  landmarkDefinitionId: string;
  x: number;
  y: number;
  source: 'manual' | 'imported' | 'ai_suggested_future';
  confidence?: number;
  status: 'placed' | 'missing' | 'skipped';
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};
```

### CephMeasurementDefinition

```ts
type CephMeasurementDefinition = {
  id: string;
  code: string;
  name: string;
  type: 'angle' | 'distance' | 'ratio' | 'derived';
  unit: 'degrees' | 'mm' | 'ratio' | 'text';
  requiredLandmarkCodes: string[];
  formulaKey: string;
  formulaVersion: string;
  description?: string;
  isActive: boolean;
};
```

### CephMeasurementResult

```ts
type CephMeasurementResult = {
  id: string;
  traceSessionId: string;
  measurementDefinitionId: string;
  value?: number;
  unit: string;
  status: 'complete' | 'incomplete_missing_landmarks' | 'uncalibrated' | 'invalid_geometry' | 'not_applicable';
  interpretation?: string;
  formulaVersion: string;
  normSetId?: string;
  dependenciesJson: unknown;
  computedAt: string;
};
```

### CephReportSnapshot

```ts
type CephReportSnapshot = {
  id: string;
  traceSessionId: string;
  reportStatus: 'draft' | 'final';
  snapshotJson: unknown;
  pdfStorageKey?: string;
  generatedBy: string;
  generatedAt: string;
};
```

---

## 21. API / Service Layer Guidance

Use the existing backend style. Do not invent a new API architecture if the system already has conventions.

### Suggested Service Methods

```text
createImagingAsset
getPatientImagingLibrary
updateImagingMetadata
archiveImagingAsset
createImagingLink
removeImagingLink
createImageCalibration
getImageCalibrations
createImageAnnotation
updateImageAnnotation
archiveImageAnnotation
createCephTraceSession
getCephTraceSession
updateCephTraceSession
placeCephLandmark
moveCephLandmark
removeCephLandmark
computeCephMeasurements
finalizeCephTrace
createCephTraceRevision
generateCephReportSnapshot
exportCephReportPdf
compareCephTraces
```

### API Rules

1. Validate patient access on every request.
2. Validate role permissions on every mutation.
3. Validate trace status before allowing edits.
4. Validate image type before creating ceph trace.
5. Never trust client-computed measurement values as source of truth.
6. Client may compute for preview, but server/domain service should recompute for finalization.
7. Audit all clinically meaningful changes.
8. Return clear status messages for incomplete measurements.

---

## 22. Frontend Component Map

Adapt names to current framework.

### Imaging Components

```text
PatientImagingTab
ImagingLibraryGrid
ImagingTimeline
ImageUploadDialog
ImageMetadataPanel
ImageViewerShell
ImageViewerCanvas
ImageViewerToolbar
ImageAdjustmentPanel
ImageAnnotationToolbar
ImageAnnotationLayer
ImageCalibrationTool
ImageComparisonView
```

### Ceph Components

```text
CephTraceWorkspace
CephTraceToolbar
CephLandmarkGuidePanel
CephLandmarkList
CephLandmarkLayer
CephPlaneLineLayer
CephMeasurementPanel
CephNormInterpretationPanel
CephTraceStatusBar
CephFinalizeDialog
CephRevisionDialog
CephReportPreview
CephReportExportButton
CephTraceComparisonView
```

### UI Layout Recommendation

```text
Top: Patient + image context + main actions
Left: Imaging library / trace list / tool selector
Center: Image viewer and overlay
Right: Landmark guide + measurement panel
Bottom: Visit/treatment context or trace progress
```

If the current dental UI already uses a carousel and right-side panel, preserve that pattern:

- Imaging can be one carousel workspace.
- Viewer opens in main canvas.
- Landmark/metadata/measurement panel opens on the right.
- Bottom panel shows visit-linked image summary and trace status.

---

## 23. Key UI States

The agent must implement or account for these states:

### Imaging States

```text
no_images
uploading
upload_failed
unsupported_file
image_loaded
image_archived
metadata_missing
permission_denied
```

### Viewer States

```text
loading_image
image_render_failed
viewer_ready
annotation_mode
calibration_mode
comparison_mode
exporting
```

### Ceph States

```text
not_lateral_ceph
no_calibration
trace_not_started
trace_draft
landmark_active
landmark_missing
measurements_incomplete
trace_ready_for_review
trace_finalized
trace_revised
report_generating
report_ready
```

---

## 24. Error Handling and Edge Cases

### Upload Edge Cases

- File too large.
- Unsupported MIME type.
- Corrupted image.
- Duplicate upload.
- Network interruption.
- Patient record unavailable.
- User lacks upload permission.

### Viewer Edge Cases

- Image dimensions unavailable.
- High-resolution image causes performance issue.
- Annotation geometry outside bounds.
- Rotate/resize breaks overlay if not handled correctly.
- Browser/device touch quirks.

### Calibration Edge Cases

- User enters zero or negative distance.
- Points overlap.
- Calibration points outside image bounds.
- Existing finalized trace uses old calibration.
- Calibration deleted or superseded.

### Ceph Edge Cases

- User starts trace on wrong image type.
- Required landmark missing.
- Landmarks create invalid geometry.
- User changes template mid-trace.
- User changes norm set mid-trace.
- Assistant tries to finalize without permission.
- Finalized trace edit attempt.
- Report generation fails.
- Historical formula changed.

### Business Handling

Every edge case should produce a clear user-facing message and a safe data state.

---

## 25. Testing Requirements

### Unit Tests

Required:

- Geometry calculations.
- Pixel distance.
- Calibrated mm distance.
- Angle between three points.
- Angle between two lines.
- Missing landmark handling.
- Invalid geometry handling.
- Calibration version logic.
- Trace status transitions.
- Permission guards.
- Measurement formula versioning.

### Integration Tests

Required:

1. Upload image and create metadata.
2. Link image to visit.
3. Open image viewer.
4. Create calibration.
5. Add annotation.
6. Create ceph trace session.
7. Place landmarks.
8. Compute SNA/SNB/ANB.
9. Finalize trace.
10. Block edit after finalization.
11. Create revision.
12. Generate report snapshot.
13. Export report.

### Frontend Tests

Required:

- Imaging tab renders.
- Upload dialog validates required fields.
- Viewer toolbar actions trigger expected state.
- Calibration tool captures two points and distance.
- Landmark guide advances after placement.
- Measurement panel updates after landmark movement.
- Missing landmarks show incomplete measurement status.
- Finalize button hidden/disabled without permission.
- Finalized traces render locked state.

### E2E Journey Tests

#### Journey 1: Dentist Manual Ceph Trace

1. Login as dentist/orthodontist.
2. Open patient.
3. Upload lateral ceph image.
4. Calibrate image.
5. Start ceph trace.
6. Select Basic Skeletal Analysis.
7. Place required landmarks.
8. Verify measurements update.
9. Finalize trace.
10. Export report.
11. Confirm finalized trace appears in patient timeline.

#### Journey 2: Assistant Prepares Draft

1. Login as assistant.
2. Upload lateral ceph image.
3. Start draft trace.
4. Place landmarks.
5. Mark ready for review.
6. Confirm assistant cannot finalize if restricted.
7. Login as orthodontist.
8. Review and finalize trace.

#### Journey 3: Revision Protection

1. Open finalized trace.
2. Attempt direct landmark edit.
3. Confirm edit is blocked.
4. Create revision.
5. Move landmark.
6. Finalize revision.
7. Confirm old trace remains available.

---

## 26. Implementation Sequence

### Phase 0: Current-State Audit

The AI agent must produce:

- Current module map.
- Existing patient/visit/chart/treatment model map.
- Existing file upload/storage map.
- Existing permission model map.
- Existing test framework map.
- Risks and constraints.

No implementation should begin before this audit.

### Phase 1: Imaging Foundation

Deliver:

- Imaging asset model.
- Patient imaging tab/library.
- Upload workflow.
- Metadata editor.
- Thumbnail generation/display.
- Visit/context linking.
- Basic tests.

### Phase 2: Viewer + Annotation

Deliver:

- Image viewer.
- Zoom/pan/reset.
- Brightness/contrast/invert if practical.
- Annotation layer.
- Annotation persistence.
- Coordinate transform tests.

### Phase 3: Calibration + Measurement Tools

Deliver:

- Calibration workflow.
- Pixel-to-mm conversion.
- Simple distance/angle tools.
- Calibration audit/versioning.
- Unit/integration tests.

### Phase 4: Manual Ceph Trace Draft

Deliver:

- Ceph trace session model.
- Landmark definitions.
- Analysis template seed.
- Guided landmark UI.
- Landmark placement and movement.
- Draft persistence.
- Tests.

### Phase 5: Measurement Engine

Deliver:

- Ceph math/domain service.
- SNA/SNB/ANB definitions.
- Dependency validation.
- Measurement status rules.
- Measurement panel.
- Unit tests with known coordinates.

### Phase 6: Finalization + Reporting

Deliver:

- Finalize workflow.
- Trace locking.
- Report snapshot.
- Report preview/export.
- Audit logging.
- E2E journey tests.

### Phase 7: Revision + Comparison

Deliver:

- Create revision from finalized trace.
- Trace version history.
- Side-by-side trace comparison.
- Measurement difference table.
- Tests.

### Phase 8: Template and Norm Management

Deliver only if required for V1:

- Admin template manager.
- Norm set manager.
- Measurement definition manager.

Otherwise seed templates/norms and mark admin management as V2.

---

## 27. AI Agent Master Prompt

Use this prompt when asking an AI coding agent to implement:

```text
You are enhancing an existing Dental Management System V1. Do not rebuild from scratch.

Load and follow DENTAL_IMAGING_AND_MANUAL_CEPH_TRACING_ENHANCEMENT_GUIDE.md.

Your task is to enhance the existing system with dental imaging and manual cephalometric tracing workflows.

Strict boundaries:
- No AI landmark detection in V1.
- No automated diagnosis.
- No silent edits to finalized clinical records.
- No hard-coded clinical norm ranges without marking them as NEEDS CLINICAL VALIDATION.
- Do not rewrite working modules unless necessary.

Required first step:
Audit the existing codebase and produce:
1. Current imaging/file upload capabilities.
2. Current patient/visit/chart/treatment integration points.
3. Current permissions model.
4. Current reporting/export capabilities.
5. Current tests.
6. Gap list against the enhancement guide.
7. Proposed vertical-slice implementation sequence.

After the audit, implement in small vertical slices with tests:
1. Imaging library upload/view/linking.
2. Viewer and annotation layer.
3. Calibration and basic measurement tools.
4. Manual ceph trace draft and landmark placement.
5. Measurement engine for SNA/SNB/ANB.
6. Finalization and report snapshot/export.
7. Revision and comparison.

Clinical rules:
- Store all landmarks/annotations in original image coordinate space.
- Finalized traces are immutable.
- Revisions create new versions.
- Reports reference exact trace version, calibration version, template version, formula version, and norm set version.
- Every mutation must respect patient access and role permissions.
- Every clinically meaningful change must be auditable.

Testing requirements:
- Add unit tests for geometry and formula calculations.
- Add integration tests for upload, calibration, trace, finalization, revision, and report.
- Add frontend tests for viewer, landmark guide, measurement panel, and permission states.
- Add E2E tests for dentist tracing, assistant draft review, and finalized trace revision.

When uncertain, label the item as one of:
- NEEDS CLINICAL VALIDATION
- NEEDS PRODUCT DECISION
- NEEDS DATA SAMPLE
- V2 / FUTURE

Do not proceed past a slice if critical tests fail.
```

---

## 28. Acceptance Criteria Checklist

The enhancement is acceptable when all required items are true:

### Imaging

- [ ] Patient has an imaging library.
- [ ] User can upload supported image files.
- [ ] User can classify image type.
- [ ] User can link image to visit/tooth/treatment/ortho case where available.
- [ ] Original image is preserved.
- [ ] Archived images are not hard-deleted.
- [ ] Image actions are permission-checked.

### Viewer

- [ ] Viewer supports zoom, pan, reset, and fit.
- [ ] Annotations remain aligned after viewport changes.
- [ ] Viewer does not mutate original image.
- [ ] High-resolution images load acceptably.

### Calibration

- [ ] User can calibrate using two points and known distance.
- [ ] Calibration version is stored.
- [ ] Distance measurements show calibrated or uncalibrated status.
- [ ] Changing calibration does not mutate finalized reports.

### Ceph Tracing

- [ ] User can start trace from lateral ceph image.
- [ ] User can select analysis template.
- [ ] User can manually place landmarks.
- [ ] Landmark guide shows progress.
- [ ] Landmarks are stored in original image coordinates.
- [ ] Moving landmarks recomputes measurements.
- [ ] Missing landmarks show incomplete measurement status.

### Measurements

- [ ] Measurement engine is separate from UI.
- [ ] SNA/SNB/ANB or approved V1 measurements are implemented with tests.
- [ ] Measurement definitions declare dependencies.
- [ ] Formula versions are stored.
- [ ] Norms/interps are configurable or clearly marked for validation.

### Finalization and Reports

- [ ] Draft trace can be finalized by authorized clinician.
- [ ] Finalized trace is locked.
- [ ] Revision creates new version.
- [ ] Report snapshot is reproducible.
- [ ] Report export is audited.

### Tests

- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Frontend tests pass.
- [ ] E2E critical journeys pass.

---

## 29. Clinical Validation Items

These should be reviewed by an orthodontist before production use:

1. Final landmark list.
2. Landmark anatomical instructions.
3. SNA/SNB/ANB calculation conventions.
4. Additional analysis formulas.
5. Norm sets and reference ranges.
6. Interpretation language.
7. Report format.
8. Whether assistants may prepare traces.
9. Whether draft traces may appear in patient-facing outputs.
10. When calibration is mandatory.

---

## 30. Product Decisions Needed

The product owner should decide:

1. Is ceph tracing available only inside an orthodontic case, or from any patient image?
2. Should images be linked to visits automatically when uploaded inside a visit?
3. Should calibration be required before finalizing a trace?
4. Which measurements are mandatory in V1 beyond SNA/SNB/ANB?
5. Are norm sets configured in admin UI in V1 or seeded only?
6. Should assistants be allowed to mark traces as ready for review?
7. Should reports be generated only from finalized traces?
8. Should patients ever see ceph reports in the portal?
9. Should image comparison be V1 or V2?
10. What file formats and size limits are allowed?

---


## 31. Final Implementation Guardrails Addendum

This addendum exists because the Dental Management System V1 is already built. The AI agent must enhance the existing product carefully instead of treating this as a greenfield rebuild.

### 31.1 Completeness and Certainty Guardrail

This document is implementation-ready for a **manual-first imaging and ceph tracing enhancement**, but it is not a final clinical authority.

The AI agent must treat the following as configurable and clinically reviewable:

- landmark anatomical definitions,
- landmark placement instructions,
- cephalometric formulas,
- norm ranges,
- interpretation labels,
- report wording,
- calibration requirements,
- user role limits for signing/finalizing traces.

Any clinical detail not explicitly validated by the product owner or orthodontist must be tagged as `NEEDS CLINICAL VALIDATION`.

### 31.2 Existing-System Preservation Guardrail

The AI agent must not rewrite working V1 dental workflows just to fit this guide.

Before changing code, the agent must identify:

- existing patient workspace flow,
- existing visit/timeline flow,
- existing charting flow,
- existing treatment plan flow,
- existing upload/attachment flow,
- existing reporting flow,
- existing role/permission model,
- existing audit/logging model,
- existing test framework.

Rules:

- Preserve current URLs/routes unless there is a documented reason to change them.
- Preserve working patient, visit, charting, treatment, billing, and scheduling behavior.
- Add imaging/ceph as an enhancement layer, not as a replacement for existing clinical modules.
- If a current implementation is weak but functional, wrap and improve it incrementally.
- If a current implementation is unsafe or unusable, document the issue before replacing it.

### 31.3 Formula Validation Gate

The AI agent must not implement a measurement as final unless all of the following are defined:

1. Measurement name.
2. Measurement type: angle, distance, ratio, appraisal, or derived value.
3. Required landmarks.
4. Formula description.
5. Coordinate assumptions.
6. Unit: degrees, mm, ratio, or text.
7. Calibration dependency.
8. Formula version.
9. Norm set dependency.
10. Unit test with known input coordinates and expected result.
11. Clinical status: validated, provisional, or `NEEDS CLINICAL VALIDATION`.

If any item is missing, the measurement may exist as a draft/provisional definition but must not be presented as clinically final.

### 31.4 Minimum Formula Test Fixtures

Create deterministic test fixtures for the math engine.

At minimum:

- one fixture with known Sella, Nasion, A-Point, and B-Point coordinates,
- one fixture for SNA,
- one fixture for SNB,
- one fixture for ANB,
- one fixture for missing-landmark behavior,
- one fixture for recalculation after moving a landmark,
- one fixture for distance conversion after calibration,
- one fixture for finalized trace snapshot immutability.

Tests should assert not only numeric results, but also status output:

- `complete`,
- `incomplete`,
- `uncalibrated`,
- `invalid`,
- `provisional`.

### 31.5 Landmark Instruction Library

Each landmark should have a user-facing placement instruction. This improves guided tracing and reduces ambiguity for clinicians and assistants.

Each landmark definition should include:

- landmark code,
- display name,
- anatomical description,
- short placement instruction,
- required/optional status,
- analysis templates that use it,
- dependency list showing which measurements use it,
- clinical validation status.

Example format:

```yaml
landmarkCode: S
displayName: Sella
shortInstruction: Place at the center of the sella turcica.
requiredFor:
  - SNA
  - SNB
  - ANB
validationStatus: NEEDS_CLINICAL_VALIDATION
```

Do not rely only on labels like `S` or `N`; the UI should help the user understand what they are placing.

### 31.6 Report Layout Requirements

A ceph report should be reproducible, readable, and clinically traceable.

Minimum report sections:

1. Header
   - clinic name,
   - patient name/code,
   - patient age/date of birth if allowed,
   - image date,
   - report date,
   - clinician.

2. Image and Trace Information
   - image type,
   - image source,
   - calibration status,
   - trace version,
   - analysis template,
   - norm set,
   - formula version.

3. Tracing View
   - lateral ceph image with overlay,
   - landmarks visible,
   - major planes/lines visible,
   - option for clean overlay if supported.

4. Measurement Table
   - measurement name,
   - value,
   - unit,
   - norm/reference range if validated,
   - interpretation if validated,
   - status.

5. Clinical Notes
   - free-text clinician notes,
   - treatment planning notes if applicable.

6. Sign-Off
   - prepared by,
   - reviewed/finalized by,
   - finalized timestamp,
   - revision number if applicable.

7. Disclaimers / Status Notes
   - show `Draft` if not finalized,
   - show `Uncalibrated` where applicable,
   - show `Provisional formula/norm` where applicable,
   - show `NEEDS CLINICAL VALIDATION` only in internal/admin views, not necessarily in patient-facing PDFs unless product decides.

Suggested sign-off language:

```text
Prepared by: [Name / Role]
Reviewed and finalized by: [Clinician Name]
Finalized on: [Date and Time]
Trace version: [Version]
```

Rules:

- Draft reports must be visibly marked as draft.
- Final reports must reference a locked trace snapshot.
- Revised reports must show revision/version number.
- Reports should not be regenerated from mutable live data without snapshotting.

### 31.7 Image Storage, Security, and Privacy Guardrails

Because dental images are clinical records, image handling must be designed carefully.

The AI agent must identify the current system storage pattern before implementing new storage logic.

Minimum requirements:

- Preserve original uploaded image.
- Store viewer transformations separately from original file.
- Use thumbnails/previews for fast library browsing.
- Avoid loading full-resolution images unnecessarily.
- Define allowed file types.
- Define maximum file size.
- Reject unsupported or corrupted files safely.
- Validate patient access before returning image metadata or file URLs.
- Use private storage or signed URLs if cloud/object storage is used.
- Do not expose raw storage paths in the UI.
- Log clinical image access/export where audit rules require it.
- Avoid including patient identifiers in file names where possible.
- Ensure backups include image files and metadata together.

Suggested allowed V1 formats:

- JPEG/JPG,
- PNG,
- WebP if already supported,
- PDF only as attachment, not as traceable image unless converted safely,
- DICOM deferred unless the system already supports it.

Suggested V1 decisions to confirm:

- max file size,
- max image dimensions,
- whether image compression is allowed,
- whether original image retention is mandatory,
- whether deleted images are soft-deleted or archived,
- whether patients can view exported imaging reports.

### 31.8 Seed Data and Fixture Requirement

The AI agent should add seed/sample data for development and testing where the existing project pattern allows it.

Minimum seed/demo records:

1. One demo patient with imaging history.
2. One lateral ceph image placeholder.
3. One panoramic image placeholder.
4. One intraoral photo placeholder.
5. One calibrated ceph image.
6. One draft ceph trace.
7. One finalized ceph trace.
8. One revised ceph trace.
9. One generated ceph report snapshot.
10. One assistant-prepared / clinician-finalized workflow example.

If real clinical images cannot be used, use clearly marked synthetic/placeholders and avoid fake clinical claims.

### 31.9 Role and Sign-Off Guardrail

The app should distinguish between preparing a trace and clinically finalizing it.

Recommended default:

- Assistant/staff may upload images and prepare draft landmarks if permission allows.
- Dentist/orthodontist must review and finalize/sign the trace.
- Admin may manage templates/settings but does not automatically have clinical sign-off rights unless explicitly configured.

Rules:

- A report generated from a draft trace must show draft status.
- A finalized report must show the reviewing clinician.
- A revised trace must preserve the earlier finalized version.
- The UI should not imply that staff-prepared draft data is clinically final.

### 31.10 Implementation Readiness Gate

Before declaring the enhancement complete, the AI agent must produce a short readiness report with these items:

- What existing V1 files/modules were reused.
- What new files/modules were added.
- What workflows were changed.
- What tests were added.
- What remains `NEEDS CLINICAL VALIDATION`.
- What remains `NEEDS PRODUCT DECISION`.
- What was deferred to V2.
- Any migration/backfill risks.
- Any storage/security considerations.
- Any known limitations.

The enhancement should not be marked done until the readiness report is produced and tests pass.

---

## 32. References and Research Notes

These sources were used for workflow and product guidance. No private WebCeph login or proprietary workflow was accessed.

### Open-Source / Product Workflow References

1. **forabi/WebCeph — GitHub**  
   A web app for tracing and analyzing cephalograms and photographs used in orthodontic treatment planning. The README highlights drag/drop image start, browser-based operation, offline usage, assisted tracing, immediate measurement calculation, automatic interpretation, local data ownership, and export.  
   URL: https://github.com/forabi/WebCeph

2. **WebCeph Public Guide**  
   Public guide sections reference automated cephalo tracing and analysis, visual treatment objectives, caseroom/gallery, image viewer modes, PDF export/print, and analysis/measurement wizards. For this V1, use these as workflow inspiration only; do not implement AI or simulation first.  
   URL: https://webceph.com/en/guide/

3. **alexcorvi/cephalometric — GitHub**  
   A cephalometric analysis web application that supports uploading a lateral cephalogram and computer-assisted orthodontic diagnostic analysis. README lists included analysis categories: basic/common, dental, vertical relationships, mandibular rotations, Downs, Steiner, Mills-Eastman, Wits appraisal, and Tweed’s Triangle.  
   URL: https://github.com/alexcorvi/cephalometric

### Clinical / Educational References

4. **NCBI Bookshelf / StatPearls — Orthodontics, Cephalometric Analysis**  
   Describes cephalometric analysis as evaluation of lateral skull radiographs to determine skeletal patterns and treatment complexity. Notes that results depend on operator variability, should be interpreted in clinical context, and that standard measures vary by age, sex, and ethnicity. Also describes traditional manual tracing and digital tracing.  
   URL: https://www.ncbi.nlm.nih.gov/books/NBK594272/

5. **Digital versus Manual Tracing in Cephalometric Analysis — Systematic Review**  
   Useful background for why digital tracing can streamline workflow but must preserve accuracy, repeatability, and clinical review.  
   URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC11204843/

6. **The accuracy and reliability of WebCeph for cephalometric analysis**  
   Study comparing WebCeph with AutoCAD for cephalometric analysis. Useful as background that digital tools can be evaluated for accuracy and reliability, but does not remove the need for clinical validation.  
   URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC8801471/

### Deferred AI References

These are not for V1 implementation, but may be useful later if AI-assisted landmark suggestion is reconsidered:

7. **Aariz: Benchmark Dataset for Automatic Cephalometric Landmark Detection and CVM Stage Classification**  
   Dataset of 1,000 lateral cephalometric radiographs from seven imaging devices, annotated with 29 landmarks by clinical experts.  
   URL: https://arxiv.org/abs/2302.07797

8. **Tracing Like a Clinician: Anatomy-Guided Spatial Priors for Cephalometric Landmark Detection**  
   AI research describing how clinicians follow structured anatomical reasoning when tracing cephalometric radiographs. This can inform future AI assist, but not V1.  
   URL: https://arxiv.org/abs/2605.03358

---

## 33. Final Guidance

For V1, the winning implementation is not the most advanced one. It is the one that is:

- easy to use,
- clinically auditable,
- integrated with patient and visit workflows,
- respectful of existing dental management system behavior,
- manual-first,
- versioned,
- test-covered,
- and ready for orthodontist validation.

Build the foundation properly first. AI, automation, simulation, and advanced custom analysis can come later.
