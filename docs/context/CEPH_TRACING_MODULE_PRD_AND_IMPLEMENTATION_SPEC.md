# Cephalometric Tracing / Imaging Module PRD and AI Implementation Spec

**Product area:** Dentalemon / Dental Management System  
**Parent module:** Clinical Imaging  
**Sub-feature:** Cephalometric Tracing for lateral cephalometric X-rays  
**Target version:** v1.4 Clinical Imaging  
**Status:** Implementation-ready draft, pending orthodontic clinical validation  
**Primary objective:** Make the cephalometric tracing module precise enough for AI-assisted implementation, testing, and future enhancement.

---

## 1. Brutally Honest Scope Statement

This document is intended to make the cephalometric tracing module executable by AI engineers and coding agents.

It defines:

- Product behavior
- User workflow
- UI/UX expectations
- Data model
- File/module structure
- Landmark and measurement registries
- Geometry rules
- Export/report behavior
- Testing requirements
- AI implementation guardrails

This document does **not** replace orthodontic clinical validation. A licensed orthodontist or domain expert must validate:

- Landmark definitions
- Measurement formulas
- Normal ranges
- Interpretation thresholds
- Report wording
- Clinical disclaimers

The software may compute values correctly from coordinates, but clinical meaning depends on image quality, landmarking accuracy, patient age, ethnic/population norms, radiographic standardization, and clinician judgment.

---

## 2. What Cephalometric Tracing Is

Cephalometric tracing is the process of identifying anatomical landmarks on a lateral cephalometric skull X-ray and calculating angular or linear measurements used in orthodontic diagnosis and treatment planning.

The module allows a clinician to manually place named landmarks on a lateral ceph image, then automatically computes measurements such as SNA, SNB, and ANB. These measurements are displayed visually on the image and numerically in a measurements panel and report.

---

## 3. What This Module Is Not

For MVP, this module is **not**:

- A general X-ray viewer
- A panoramic tracing tool
- A CBCT/3D cephalometric tool
- An AI landmark detection tool
- A replacement for orthodontic diagnosis
- A fully validated clinical decision support system
- A regulatory-certified diagnostic device
- A treatment planning engine
- A surgical planning engine

The MVP is a **manual cephalometric tracing and measurement assistant**.

---

## 4. Relationship to the Imaging Module

The ceph tracing feature lives under the broader Imaging module.

The Imaging module is responsible for:

- Uploading/storing images
- Associating images with patients
- Displaying images
- Managing image metadata
- Identifying image type
- Providing the base image viewer

The Ceph Tracing module is responsible for:

- Activating only for lateral cephalometric images
- Providing the tracing overlay
- Managing landmarks and measurement overlays
- Computing cephalometric measurements
- Generating ceph-specific reports
- Exporting tracing data and PDF reports

### Activation Rule

The tracing tool should only be available when:

```ts
image.type === 'LATERAL_CEPH'
```

If the image is not tagged as `LATERAL_CEPH`, the UI should hide or disable the ceph tracing action.

Optional admin/clinician action:

```ts
Mark image as lateral ceph
```

This action should require permission and should be audit logged.

---

## 5. Primary Users

### 5.1 Orthodontist / Dentist

Can:

- Open lateral ceph image
- Enter tracing mode
- Place/edit landmarks
- Review measurements
- Add clinical notes
- Generate report
- Export/print report

### 5.2 Dental Assistant / Imaging Staff

Can, depending on permissions:

- Upload image
- Tag image type
- Prepare tracing draft
- Place preliminary landmarks

May not finalize report unless permitted.

### 5.3 Clinic Admin

Can:

- View reports
- Print/export reports
- Manage image records

May not edit clinical landmarks unless permitted.

### 5.4 Read-only Viewer

Can:

- View image
- View tracing overlay
- View report

Cannot edit landmarks, measurements, or report.

---

## 6. MVP User Journey

### Journey: Create Ceph Tracing from Lateral Ceph Image

1. User opens a patient record.
2. User goes to Imaging.
3. User selects a lateral ceph X-ray.
4. System opens image viewer.
5. User clicks `Ceph Tracing`.
6. System opens `CephTracingWorkspace`.
7. User optionally calibrates image scale.
8. User selects or follows guided landmark placement sequence.
9. User clicks on image to place landmarks.
10. System stores each landmark in image-native coordinates.
11. System computes available measurements automatically.
12. System draws measurement lines/arcs when required landmarks exist.
13. User reviews measurements and norms.
14. User adds optional notes.
15. User saves tracing.
16. User opens report view.
17. User prints or exports PDF.

---

## 7. Core UX Principles

The ceph tracing tool must feel like a clinical imaging workspace, not a generic drawing tool.

### Principles

- Image remains the center of the workspace.
- Landmark placement must be fast and precise.
- The user should always know which landmark is currently being placed.
- Measurements should update immediately after landmark changes.
- Missing measurements should explain which landmarks are missing.
- Zoom/pan must not corrupt landmark positions.
- Saved coordinates must survive viewport changes.
- Report output must be clean and printable.

---

## 8. Recommended Screen Layout

### 8.1 Desktop Layout

```txt
┌──────────────────────────────────────────────────────────────┐
│ Top Bar: Patient | Image Date | Ceph Tracing | Save | Report │
├───────────────────┬──────────────────────────┬───────────────┤
│ Left Panel         │ Main Image Viewer        │ Right Panel   │
│ Landmark List      │ X-ray + Overlay          │ Measurements  │
│ Placement Sequence │ Zoom/Pan/Contrast Tools  │ Norms/Notes   │
│ Visibility Toggles │                          │ Actions       │
└───────────────────┴──────────────────────────┴───────────────┘
```

### 8.2 Right Panel Behavior

The right panel should show:

- Measurement values
- Status: complete/incomplete
- Normal range
- Basic interpretation label
- Required missing landmarks
- Report notes

### 8.3 Bottom/Toolbar Controls

Controls may include:

- Zoom in
- Zoom out
- Fit to screen
- Reset view
- Pan mode
- Place landmark mode
- Toggle labels
- Toggle lines
- Toggle arcs
- Brightness/contrast
- Save
- Generate report

---

## 9. Required Components

### 9.1 `CephTracingWorkspace`

Main orchestration component.

Responsibilities:

- Load image
- Load existing tracing if available
- Manage active tool mode
- Manage selected landmark
- Coordinate viewer, layers, panels, save/export actions

### 9.2 `CephImageViewer`

Base viewer for image display.

Responsibilities:

- Render image
- Support zoom/pan
- Support fit-to-screen
- Maintain transform matrix
- Provide mapping between screen coordinates and image-native coordinates

### 9.3 `CephTracingOverlay`

Container for all overlay layers.

Responsibilities:

- Render overlay aligned to image
- Preserve image-native coordinate mapping
- Coordinate child layers

### 9.4 `CephLandmarkLayer`

Renders landmarks and labels.

Responsibilities:

- Display landmark points
- Display landmark labels
- Support hover/selected states
- Support drag-to-adjust
- Support click-to-place
- Support keyboard delete/backspace for selected point

### 9.5 `CephMeasurementLineLayer`

Renders lines and planes used for measurement.

Examples:

- S-N line
- N-A line
- N-B line

### 9.6 `CephAngleArcLayer`

Renders angle arcs for angular measurements.

Examples:

- SNA arc at N
- SNB arc at N
- ANB arc at N

### 9.7 `CephMeasurementsPanel`

Displays computed measurements.

Responsibilities:

- Show measurement name
- Show value
- Show unit
- Show normal range
- Show interpretation
- Show missing landmark dependencies
- Allow filtering by analysis type

### 9.8 `CephLandmarkListPanel`

Guides user through placement.

Responsibilities:

- List required landmarks
- Show placed/unplaced status
- Allow selecting next landmark
- Provide anatomical tooltip
- Show sequence progress

### 9.9 `CephReportView`

Printable/exportable report page.

Responsibilities:

- Display patient and image metadata
- Display tracing preview
- Display measurements table
- Display notes
- Display disclaimer
- Support print layout

### 9.10 `ceph-export.ts`

Export utility.

Responsibilities:

- Export PDF report
- Export tracing JSON
- Export overlay PNG if supported

### 9.11 `packages/ceph-math`

Isomorphic math package.

Responsibilities:

- Define landmark and measurement schemas
- Compute angles
- Compute distances
- Apply calibration
- Return measurement results
- Run on client and server
- Have no React/UI dependencies

---

## 10. Recommended File Structure

```txt
src/features/imaging/
  routes/
    imaging-ceph-report.$imageId.tsx
  ceph/
    components/
      CephTracingWorkspace.tsx
      CephImageViewer.tsx
      CephTracingOverlay.tsx
      CephLandmarkLayer.tsx
      CephMeasurementLineLayer.tsx
      CephAngleArcLayer.tsx
      CephMeasurementsPanel.tsx
      CephLandmarkListPanel.tsx
      CephReportView.tsx
      CephToolbar.tsx
      CephCalibrationTool.tsx
    hooks/
      useCephTracing.ts
      useCephViewerTransform.ts
      useCephMeasurements.ts
      useCephAutosave.ts
    services/
      ceph-tracing.service.ts
      ceph-export.ts
    schemas/
      ceph-tracing.schema.ts
    types/
      ceph.types.ts
    constants/
      ceph-landmarks.ts
      ceph-measurements.ts
      ceph-norms.ts
    tests/
      ceph-workspace.test.tsx
      ceph-landmark-layer.test.tsx
      ceph-measurements-panel.test.tsx
      ceph-report-view.test.tsx

packages/ceph-math/
  src/
    index.ts
    geometry.ts
    landmarks.ts
    measurements.ts
    norms.ts
    calibration.ts
    types.ts
    validators.ts
  tests/
    geometry.test.ts
    measurements.test.ts
    calibration.test.ts
    fixtures/
      basic-sna-snb-anb.fixture.ts
```

---

## 11. Coordinate System Rules

This is one of the most important implementation requirements.

### 11.1 Store Image-Native Coordinates

Landmarks must be stored relative to the original image dimensions, not the current screen position.

Correct:

```ts
{
  landmarkId: 'S',
  x: 1240.5,
  y: 882.2,
  coordinateSpace: 'IMAGE_NATIVE'
}
```

Incorrect:

```ts
{
  x: 512,
  y: 338,
  coordinateSpace: 'SCREEN'
}
```

### 11.2 Why This Matters

Zooming, panning, resizing, or rotating the viewport must not change the stored anatomical point.

Screen coordinates are temporary. Image-native coordinates are permanent.

### 11.3 Required Mapping Functions

The viewer must expose:

```ts
screenToImagePoint(screenPoint: ScreenPoint): ImagePoint
imageToScreenPoint(imagePoint: ImagePoint): ScreenPoint
```

### 11.4 Coordinate Origin

Use standard image coordinate origin:

```txt
Top-left corner = (0, 0)
X increases to the right
Y increases downward
```

### 11.5 Rotation Handling

MVP recommendation:

- Allow visual rotation only if transform mapping is fully supported.
- Otherwise, avoid image rotation in MVP.
- Do not allow saved points to drift when rotation changes.

Preferred MVP:

```ts
rotationDegrees = 0
```

Add rotation later after stable zoom/pan/point mapping is proven.

---

## 12. Calibration Rules

Some angular measurements do not require image scale calibration. Linear distance measurements in millimeters do require calibration.

### 12.1 MVP Calibration Behavior

The user may calibrate the image by drawing a known-length line.

Example:

1. User selects calibration tool.
2. User clicks first point.
3. User clicks second point.
4. User enters known real-world length in mm.
5. System computes pixels per mm.

### 12.2 Calibration Data Model

```ts
export interface CephCalibration {
  method: 'TWO_POINT_KNOWN_DISTANCE';
  pointA: ImagePoint;
  pointB: ImagePoint;
  knownDistanceMm: number;
  pixelsPerMm: number;
  createdAt: string;
  createdBy: string;
}
```

### 12.3 Linear Measurement Rule

If measurement type is `DISTANCE_MM` and calibration is missing:

```ts
status = 'INCOMPLETE_CALIBRATION_REQUIRED'
```

Do not display fake mm values.

### 12.4 Angular Measurement Rule

Angles may be computed without calibration because they depend on relative geometry, not physical scale.

---

## 13. Landmark Registry

The landmark registry defines every point the user may place.

### 13.1 Landmark Type

```ts
export type LandmarkId =
  | 'S'
  | 'N'
  | 'A'
  | 'B'
  | 'ANS'
  | 'PNS'
  | 'Go'
  | 'Gn'
  | 'Me'
  | 'Pg'
  | 'Po'
  | 'Or'
  | 'U1_TIP'
  | 'U1_APEX'
  | 'L1_TIP'
  | 'L1_APEX'
  | 'UL'
  | 'LL'
  | 'ST_Pg';
```

### 13.2 Landmark Schema

```ts
export interface CephLandmarkDefinition {
  id: LandmarkId;
  abbreviation: string;
  displayName: string;
  category: 'SKELETAL' | 'DENTAL' | 'SOFT_TISSUE';
  requiredForMvp: boolean;
  anatomicalDefinition: string;
  placementHint: string;
}
```

### 13.3 MVP Required Landmarks

For MVP, the minimum set should be:

| ID | Name | Purpose |
|---|---|---|
| S | Sella | Required for SNA, SNB |
| N | Nasion | Required for SNA, SNB, ANB |
| A | A-Point / Subspinale | Required for SNA, ANB |
| B | B-Point / Supramentale | Required for SNB, ANB |

### 13.4 Extended Landmarks for Future Phases

| ID | Name | Common Use |
|---|---|---|
| ANS | Anterior Nasal Spine | Palatal plane / maxilla |
| PNS | Posterior Nasal Spine | Palatal plane / maxilla |
| Go | Gonion | Mandibular plane |
| Gn | Gnathion | Mandibular plane / facial axis |
| Me | Menton | Mandibular plane |
| Pg | Pogonion | Chin / mandibular prominence |
| Po | Porion | Frankfort horizontal |
| Or | Orbitale | Frankfort horizontal |
| U1_TIP | Upper incisor tip | Dental inclination |
| U1_APEX | Upper incisor apex | Dental inclination |
| L1_TIP | Lower incisor tip | Dental inclination |
| L1_APEX | Lower incisor apex | Dental inclination |
| UL | Upper lip | Soft tissue |
| LL | Lower lip | Soft tissue |
| ST_Pg | Soft tissue pogonion | Soft tissue line |

---

## 14. MVP Landmark Definitions

These are draft definitions for implementation and must be clinically validated.

```ts
export const MVP_CEPH_LANDMARKS: CephLandmarkDefinition[] = [
  {
    id: 'S',
    abbreviation: 'S',
    displayName: 'Sella',
    category: 'SKELETAL',
    requiredForMvp: true,
    anatomicalDefinition: 'Center of the sella turcica.',
    placementHint: 'Place at the approximate center of the sella turcica.'
  },
  {
    id: 'N',
    abbreviation: 'N',
    displayName: 'Nasion',
    category: 'SKELETAL',
    requiredForMvp: true,
    anatomicalDefinition: 'Anterior point of the frontonasal suture.',
    placementHint: 'Place at the frontonasal junction.'
  },
  {
    id: 'A',
    abbreviation: 'A',
    displayName: 'A-Point / Subspinale',
    category: 'SKELETAL',
    requiredForMvp: true,
    anatomicalDefinition: 'Deepest point on the anterior contour of the maxillary alveolar process.',
    placementHint: 'Place at the deepest concavity of the anterior maxilla.'
  },
  {
    id: 'B',
    abbreviation: 'B',
    displayName: 'B-Point / Supramentale',
    category: 'SKELETAL',
    requiredForMvp: true,
    anatomicalDefinition: 'Deepest point on the anterior contour of the mandibular symphysis.',
    placementHint: 'Place at the deepest concavity between lower incisor alveolus and pogonion.'
  }
];
```

---

## 15. Measurement Registry

### 15.1 Measurement Schema

```ts
export interface CephMeasurementDefinition {
  id: string;
  displayName: string;
  shortName: string;
  type: 'ANGLE_DEGREES' | 'DISTANCE_MM' | 'RATIO';
  analysisGroup: 'MVP_SKELETAL' | 'STEINER' | 'SOFT_TISSUE' | 'DENTAL';
  requiredLandmarks: LandmarkId[];
  formulaType: 'ANGLE_AT_VERTEX' | 'LINE_TO_LINE_ANGLE' | 'POINT_TO_LINE_DISTANCE' | 'CUSTOM';
  formula: string;
  unit: 'deg' | 'mm' | 'ratio';
  norm?: CephNormDefinition;
  description: string;
}
```

### 15.2 MVP Measurements

| ID | Name | Required Landmarks | Formula |
|---|---|---|---|
| SNA | SNA Angle | S, N, A | Angle S-N-A at N |
| SNB | SNB Angle | S, N, B | Angle S-N-B at N |
| ANB | ANB Angle | A, N, B | Angle A-N-B at N |

### 15.3 MVP Measurement Definitions

```ts
export const MVP_CEPH_MEASUREMENTS: CephMeasurementDefinition[] = [
  {
    id: 'SNA',
    displayName: 'SNA Angle',
    shortName: 'SNA',
    type: 'ANGLE_DEGREES',
    analysisGroup: 'MVP_SKELETAL',
    requiredLandmarks: ['S', 'N', 'A'],
    formulaType: 'ANGLE_AT_VERTEX',
    formula: 'angle(S, N, A)',
    unit: 'deg',
    norm: {
      mean: 82,
      standardDeviation: 2,
      lower: 80,
      upper: 84,
      label: 'Common Steiner reference; validate population-specific norms'
    },
    description: 'Assesses maxillary position relative to the anterior cranial base.'
  },
  {
    id: 'SNB',
    displayName: 'SNB Angle',
    shortName: 'SNB',
    type: 'ANGLE_DEGREES',
    analysisGroup: 'MVP_SKELETAL',
    requiredLandmarks: ['S', 'N', 'B'],
    formulaType: 'ANGLE_AT_VERTEX',
    formula: 'angle(S, N, B)',
    unit: 'deg',
    norm: {
      mean: 80,
      standardDeviation: 2,
      lower: 78,
      upper: 82,
      label: 'Common Steiner reference; validate population-specific norms'
    },
    description: 'Assesses mandibular position relative to the anterior cranial base.'
  },
  {
    id: 'ANB',
    displayName: 'ANB Angle',
    shortName: 'ANB',
    type: 'ANGLE_DEGREES',
    analysisGroup: 'MVP_SKELETAL',
    requiredLandmarks: ['A', 'N', 'B'],
    formulaType: 'ANGLE_AT_VERTEX',
    formula: 'angle(A, N, B)',
    unit: 'deg',
    norm: {
      mean: 2,
      standardDeviation: 2,
      lower: 0,
      upper: 4,
      label: 'Common skeletal classification reference; validate clinically'
    },
    description: 'Assesses sagittal skeletal relationship between maxilla and mandible.'
  }
];
```

---

## 16. Measurement Computation Rules

### 16.1 Result Schema

```ts
export interface CephMeasurementResult {
  measurementId: string;
  status: 'COMPLETE' | 'MISSING_LANDMARKS' | 'CALIBRATION_REQUIRED' | 'ERROR';
  value?: number;
  unit?: 'deg' | 'mm' | 'ratio';
  roundedValue?: number;
  requiredLandmarks: LandmarkId[];
  missingLandmarks: LandmarkId[];
  norm?: CephNormDefinition;
  interpretation?: CephMeasurementInterpretation;
  errorMessage?: string;
}
```

### 16.2 Missing Landmark Rule

If any required landmark is missing:

```ts
status = 'MISSING_LANDMARKS'
value = undefined
missingLandmarks = requiredLandmarks.filter(id => !landmarks[id])
```

The UI should display:

```txt
Incomplete: requires Sella, Nasion, A-Point
```

### 16.3 Rounding Rule

Angles:

```ts
roundedValue = round(value, 1)
```

Distances:

```ts
roundedValue = round(value, 1)
```

### 16.4 Norm Interpretation Rule

MVP should keep interpretation conservative.

```ts
if value < norm.lower => 'BELOW_REFERENCE_RANGE'
if value > norm.upper => 'ABOVE_REFERENCE_RANGE'
else => 'WITHIN_REFERENCE_RANGE'
```

Avoid strong clinical diagnosis in MVP.

Use:

- Below reference range
- Within reference range
- Above reference range

Avoid:

- “Patient has Class II malocclusion”
- “Mandible is retruded”
- “Surgery required”

Clinical diagnosis should be clinician-authored.

---

## 17. Geometry Engine Requirements

`packages/ceph-math` must be pure and testable.

### 17.1 Point Type

```ts
export interface Point2D {
  x: number;
  y: number;
}
```

### 17.2 Angle Function

```ts
export function angleAtVertex(
  pointA: Point2D,
  vertex: Point2D,
  pointC: Point2D
): number
```

Returns angle in degrees between vectors:

```txt
vertex -> pointA
vertex -> pointC
```

### 17.3 Implementation Logic

```ts
const v1 = { x: pointA.x - vertex.x, y: pointA.y - vertex.y };
const v2 = { x: pointC.x - vertex.x, y: pointC.y - vertex.y };

const dot = v1.x * v2.x + v1.y * v2.y;
const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
const cosTheta = dot / (mag1 * mag2);
const clamped = Math.max(-1, Math.min(1, cosTheta));
const radians = Math.acos(clamped);
const degrees = radians * (180 / Math.PI);
```

### 17.4 Zero-Length Vector Rule

If two points overlap and vector length is zero:

```ts
throw new CephGeometryError('ZERO_LENGTH_VECTOR')
```

The measurement should return:

```ts
status = 'ERROR'
errorMessage = 'Cannot compute angle because two required points overlap.'
```

### 17.5 Distance Function

```ts
export function distancePixels(a: Point2D, b: Point2D): number
```

### 17.6 Pixel to Millimeter Conversion

```ts
export function pixelsToMm(pixelDistance: number, pixelsPerMm: number): number {
  return pixelDistance / pixelsPerMm;
}
```

---

## 18. Data Model

### 18.1 Ceph Tracing Record

```ts
export interface CephTracingRecord {
  id: string;
  patientId: string;
  imageId: string;
  imageType: 'LATERAL_CEPH';
  status: 'DRAFT' | 'FINALIZED' | 'VOIDED';
  version: number;
  landmarks: CephLandmarkPoint[];
  calibration?: CephCalibration;
  measurementResults: CephMeasurementResult[];
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  finalizedAt?: string;
  finalizedBy?: string;
}
```

### 18.2 Landmark Point

```ts
export interface CephLandmarkPoint {
  landmarkId: LandmarkId;
  x: number;
  y: number;
  coordinateSpace: 'IMAGE_NATIVE';
  placedAt: string;
  placedBy: string;
  updatedAt?: string;
  updatedBy?: string;
  confidence?: 'MANUAL';
}
```

### 18.3 Audit Events

Every clinically relevant change should be audit logged:

- Landmark placed
- Landmark moved
- Landmark deleted
- Calibration created
- Calibration changed
- Report generated
- Tracing finalized
- Tracing voided

Audit event schema:

```ts
export interface CephTracingAuditEvent {
  id: string;
  tracingId: string;
  eventType:
    | 'LANDMARK_PLACED'
    | 'LANDMARK_MOVED'
    | 'LANDMARK_DELETED'
    | 'CALIBRATION_CREATED'
    | 'CALIBRATION_UPDATED'
    | 'TRACING_SAVED'
    | 'TRACING_FINALIZED'
    | 'REPORT_GENERATED'
    | 'TRACING_VOIDED';
  payload: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
}
```

---

## 19. Save and Versioning Behavior

### 19.1 Draft Save

During tracing, the system should autosave or allow manual save.

Recommended:

- Autosave after landmark placement/move/delete, debounced by 800–1500ms.
- Manual `Save` button remains available.

### 19.2 Finalization

When a clinician finalizes the tracing:

- Status changes from `DRAFT` to `FINALIZED`.
- Landmark edits are locked by default.
- Report shows finalized timestamp and clinician.

### 19.3 Editing Finalized Tracing

If editing a finalized tracing is allowed, the system should create a new version.

```txt
Version 1 = original finalized tracing
Version 2 = edited tracing
```

Do not silently mutate finalized clinical records.

---

## 20. UI State Rules

### 20.1 Active Landmark Placement

When user selects a landmark:

```ts
activeLandmarkId = 'S'
mode = 'PLACE_LANDMARK'
```

On image click:

- Convert screen point to image-native point.
- Save/update landmark coordinate.
- Advance to next unplaced landmark if guided mode is active.
- Recompute measurements.

### 20.2 Landmark Dragging

When user drags a landmark:

- Show live movement.
- Update coordinate in local state.
- Recompute measurements live or on drag end.
- Persist on drag end.
- Audit as `LANDMARK_MOVED`.

### 20.3 Undo/Redo

Recommended but not mandatory for MVP.

If implemented:

- Undo landmark placement
- Undo landmark movement
- Undo landmark deletion

### 20.4 Deleting Landmark

When selected landmark is deleted:

- Remove coordinate.
- Mark dependent measurements incomplete.
- Remove dependent arcs/lines from overlay.

### 20.5 Overlay Visibility Toggles

User should be able to toggle:

- Landmarks
- Labels
- Lines
- Angle arcs
- Measurement values

---

## 21. Measurement Overlay Rendering

### 21.1 SNA

Required landmarks:

- S
- N
- A

Render:

- Line S-N
- Line N-A
- Arc centered at N
- Label `SNA: 82.0°`

### 21.2 SNB

Required landmarks:

- S
- N
- B

Render:

- Line S-N
- Line N-B
- Arc centered at N
- Label `SNB: 80.0°`

### 21.3 ANB

Required landmarks:

- A
- N
- B

Render:

- Line N-A
- Line N-B
- Arc centered at N
- Label `ANB: 2.0°`

### 21.4 Incomplete Measurement Rendering

If required landmarks are missing:

- Do not draw fake line/arc.
- Measurement panel should show incomplete status.
- Landmark list should highlight missing points.

---

## 22. Report Requirements

### 22.1 Report Route

```txt
/imaging/ceph-report/:imageId
```

Existing route naming note:

```txt
imaging-ceph-report.$imageId.tsx
```

Use the route convention of the existing app framework.

### 22.2 Report Sections

The report must include:

1. Header
   - Clinic name
   - Report title: Cephalometric Tracing Report
   - Date generated

2. Patient information
   - Patient name
   - Patient ID
   - Age/date of birth if available
   - Sex if available and permitted

3. Image information
   - Image ID
   - Image type
   - Image date
   - Source/upload info

4. Tracing information
   - Tracing status
   - Tracing version
   - Created by
   - Finalized by
   - Finalized date

5. Tracing preview
   - Lateral ceph image with overlay
   - Landmarks
   - Lines/arcs

6. Measurements table
   - Measurement
   - Value
   - Unit
   - Reference range
   - Status/interpretation

7. Landmark completeness
   - Placed landmarks
   - Missing landmarks

8. Clinician notes

9. Disclaimer

### 22.3 Disclaimer Draft

```txt
This cephalometric tracing report is generated from clinician-placed landmarks on a lateral cephalometric image. Measurements are provided as an aid to clinical review and should be interpreted by a qualified dental or orthodontic professional. Reference ranges may vary by analysis method, population, age, radiographic technique, and clinical context.
```

---

## 23. Export Requirements

### 23.1 PDF Export

The system should allow exporting a printable PDF report.

File naming:

```txt
ceph-report-{patientId}-{imageId}-{YYYYMMDD}.pdf
```

### 23.2 JSON Export

The system should allow exporting tracing data as JSON for audit, backup, or future interoperability.

```ts
export interface CephTracingExportJson {
  schemaVersion: 'ceph-tracing.v1';
  exportedAt: string;
  tracing: CephTracingRecord;
}
```

### 23.3 Overlay Image Export

Optional for MVP:

- PNG image with landmarks and measurement overlays
- Useful for report preview

---

## 24. Permissions

Recommended permissions:

```ts
'imaging.ceph.view'
'imaging.ceph.create'
'imaging.ceph.edit'
'imaging.ceph.finalize'
'imaging.ceph.export'
'imaging.ceph.void'
```

### 24.1 Permission Rules

| Action | Permission |
|---|---|
| View tracing | `imaging.ceph.view` |
| Create tracing | `imaging.ceph.create` |
| Edit draft tracing | `imaging.ceph.edit` |
| Finalize tracing | `imaging.ceph.finalize` |
| Export report | `imaging.ceph.export` |
| Void tracing | `imaging.ceph.void` |

---

## 25. Error and Edge Case Handling

### 25.1 Wrong Image Type

If user tries to open ceph tracing for non-lateral-ceph image:

```txt
Cephalometric tracing is only available for lateral cephalometric images.
```

### 25.2 Missing Image

```txt
Image could not be loaded. Please check the file or try again.
```

### 25.3 Missing Landmarks

```txt
SNA cannot be computed yet. Missing: Sella, Nasion, A-Point.
```

### 25.4 Calibration Missing

```txt
Linear measurements require calibration before millimeter values can be shown.
```

### 25.5 Overlapping Landmarks

```txt
This measurement cannot be computed because two required landmarks overlap.
```

### 25.6 Unsaved Changes

If user navigates away with unsaved changes:

```txt
You have unsaved tracing changes. Save before leaving?
```

---

## 26. Accessibility Requirements

- All toolbar buttons must have labels/tooltips.
- Landmark list must be keyboard navigable.
- Selected landmark should have visible focus state.
- Color should not be the only way to indicate status.
- Measurement status should use text labels.
- Report must be printable and readable in grayscale.

---

## 27. Performance Requirements

- Image viewer should remain responsive while placing landmarks.
- Landmark drag should feel immediate.
- Measurement recomputation should happen under 50ms for MVP measurement set.
- Overlay rendering should avoid unnecessary full React rerenders during drag if possible.
- Use SVG or canvas carefully.

### Recommended MVP Rendering Approach

Use SVG overlay for MVP because:

- Easier to render points, lines, arcs, and labels
- Easier to test
- Easier to inspect/debug
- Easier for AI to implement safely

Canvas may be considered later if performance becomes an issue.

---

## 28. Math Package API

### 28.1 Public API

```ts
export function computeCephMeasurements(input: ComputeCephMeasurementsInput): CephMeasurementResult[];

export function angleAtVertex(a: Point2D, vertex: Point2D, c: Point2D): number;

export function distancePixels(a: Point2D, b: Point2D): number;

export function pixelsToMm(pixelDistance: number, pixelsPerMm: number): number;
```

### 28.2 Input Type

```ts
export interface ComputeCephMeasurementsInput {
  landmarks: CephLandmarkPoint[];
  measurementDefinitions: CephMeasurementDefinition[];
  calibration?: CephCalibration;
}
```

### 28.3 Landmark Lookup

Convert array to lookup map:

```ts
const landmarkMap: Partial<Record<LandmarkId, CephLandmarkPoint>> = {};
```

---

## 29. Testing Requirements

This module should be implemented test-first where possible.

### 29.1 Unit Tests: Geometry

Test:

- 90 degree angle
- 180 degree angle
- 0 degree angle
- arbitrary angle
- overlapping points
- clamping floating point errors

Example:

```ts
expect(angleAtVertex({x: 1, y: 0}, {x: 0, y: 0}, {x: 0, y: 1})).toBeCloseTo(90, 5);
```

### 29.2 Unit Tests: Measurement Dependencies

Test:

- SNA complete when S, N, A exist
- SNA incomplete when A missing
- SNB complete when S, N, B exist
- ANB complete when A, N, B exist
- Missing landmarks listed correctly

### 29.3 Unit Tests: Calibration

Test:

- pixels per mm calculation
- pixel distance conversion to mm
- linear measurement blocked without calibration

### 29.4 Component Tests

Test:

- Landmark list renders required landmarks
- Clicking a landmark selects it
- Clicking viewer places selected landmark
- Measurement panel updates after landmark placement
- Missing measurements show missing landmarks

### 29.5 E2E Tests

E2E journey:

1. Open patient imaging page.
2. Open lateral ceph image.
3. Click `Ceph Tracing`.
4. Place S, N, A, B landmarks.
5. Confirm SNA/SNB/ANB appear.
6. Save tracing.
7. Open report.
8. Export/print action is available.

### 29.6 Golden Fixture Tests

Create known coordinate fixture where expected values are deterministic.

Example fixture:

```ts
const landmarks = [
  { landmarkId: 'S', x: 0, y: 0 },
  { landmarkId: 'N', x: 0, y: 1 },
  { landmarkId: 'A', x: 1, y: 1 },
  { landmarkId: 'B', x: -1, y: 1 }
];
```

Expected:

- SNA = 90 degrees
- SNB = 90 degrees
- ANB = 180 degrees

This is not clinically realistic, but useful for math validation.

---

## 30. MVP Acceptance Criteria

### 30.1 Activation

- Ceph tracing button appears only for lateral ceph images.
- Non-lateral image does not allow ceph tracing.

### 30.2 Landmark Placement

- User can select S, N, A, B.
- User can place each landmark on image.
- User can move placed landmark.
- User can delete placed landmark.
- Points stay attached to image after zoom/pan.

### 30.3 Measurement Calculation

- SNA computes only when S, N, A exist.
- SNB computes only when S, N, B exist.
- ANB computes only when A, N, B exist.
- Measurements update after point movement.
- Incomplete measurements show missing landmarks.

### 30.4 Overlay

- Landmarks display on image.
- Landmark labels display on image.
- SNA/SNB/ANB lines/arcs display only when complete.
- Overlay aligns correctly after zoom/pan.

### 30.5 Save/Load

- User can save tracing.
- User can reopen tracing and see same landmarks.
- Measurements recompute from saved landmarks.

### 30.6 Report

- User can open report route for image.
- Report includes tracing preview and measurements.
- Report can be printed/exported.

### 30.7 Tests

- Geometry tests pass.
- Measurement dependency tests pass.
- Core UI tests pass.
- E2E happy path passes.

---

## 31. AI Implementation Sequence

AI should implement in this order.

### Phase 1: Math Package First

Implement:

- `packages/ceph-math/src/types.ts`
- `packages/ceph-math/src/geometry.ts`
- `packages/ceph-math/src/measurements.ts`
- `packages/ceph-math/src/calibration.ts`
- Unit tests

Gate:

- All math tests pass.
- No React dependency in `packages/ceph-math`.

### Phase 2: Schemas and Constants

Implement:

- `ceph.types.ts`
- `ceph-tracing.schema.ts`
- `ceph-landmarks.ts`
- `ceph-measurements.ts`
- `ceph-norms.ts`

Gate:

- Types compile.
- Registry entries are not duplicated.
- Measurement definitions reference valid landmark IDs.

### Phase 3: Viewer and Coordinate Mapping

Implement:

- `CephImageViewer`
- `useCephViewerTransform`
- `screenToImagePoint`
- `imageToScreenPoint`

Gate:

- Points remain stable after zoom/pan.
- Coordinate mapping has tests.

### Phase 4: Landmark Layer

Implement:

- `CephLandmarkLayer`
- Landmark placement
- Landmark movement
- Landmark deletion

Gate:

- S/N/A/B can be placed.
- Saved state uses image-native coordinates only.

### Phase 5: Measurement Panel and Overlay

Implement:

- `useCephMeasurements`
- `CephMeasurementsPanel`
- `CephMeasurementLineLayer`
- `CephAngleArcLayer`

Gate:

- SNA/SNB/ANB compute correctly.
- Missing landmarks are handled correctly.
- Arcs/lines render only when complete.

### Phase 6: Save/Load Service

Implement:

- `ceph-tracing.service.ts`
- API integration or repository integration
- Autosave/manual save

Gate:

- Tracing persists.
- Reopening image restores landmarks.

### Phase 7: Report and Export

Implement:

- `CephReportView`
- `imaging-ceph-report.$imageId.tsx`
- `ceph-export.ts`

Gate:

- Report route works.
- Printable layout works.
- PDF/export path works or is stubbed with clear TODO if export library not yet selected.

### Phase 8: E2E and Hardening

Implement:

- Happy path E2E
- Missing landmark cases
- Wrong image type case
- Save/reopen case

Gate:

- All relevant tests pass.
- No console errors.
- No duplicate component implementations.

---

## 32. Non-Negotiable AI Guardrails

AI must follow these rules:

1. Do not store landmarks in screen coordinates.
2. Do not compute measurements with missing landmarks.
3. Do not fake calibration-dependent mm values.
4. Do not duplicate `CephMeasurementsPanel`, `CephReportView`, `packages/ceph-math`, or `ceph-export.ts`.
5. Do not put clinical diagnosis language into automated interpretation.
6. Do not make ceph tracing available for non-lateral-ceph images.
7. Do not make `packages/ceph-math` depend on React, DOM, browser APIs, or app-specific UI code.
8. Do not mutate finalized tracings silently.
9. Do not skip tests for geometry and measurement dependencies.
10. Do not implement AI landmark detection in MVP.

---

## 33. Suggested Orchestrator Prompt for AI Implementation

```md
You are implementing the Cephalometric Tracing / Imaging Module.

Read and strictly follow:

`CEPH_TRACING_MODULE_PRD_AND_IMPLEMENTATION_SPEC.md`

Implementation mode:
- Work phase by phase.
- Do not jump ahead.
- Start with `packages/ceph-math`.
- Write tests before or alongside implementation.
- Do not proceed to UI until math tests pass.
- Use image-native coordinates only.
- Keep `packages/ceph-math` isomorphic and free of React/browser dependencies.
- Implement only MVP measurements first: SNA, SNB, ANB.
- Mark all clinical norms as configurable and pending orthodontic validation.
- Do not add AI landmark detection.
- Do not create duplicate files/components.

Execution gates:
1. Math package tests must pass.
2. Registry validation must pass.
3. Coordinate transform tests must pass.
4. Landmark placement must work with image-native coordinates.
5. Measurements must update from landmarks.
6. Save/load must preserve coordinates.
7. Report route must render a printable report.
8. E2E happy path must pass.

After each phase, report:
- Files changed
- Tests added
- Tests passed/failed
- Remaining blockers
- Whether the phase gate passed

Do not continue to the next phase unless the current phase gate passes.
```

---

## 34. Future Enhancements

After MVP is stable:

### 34.1 Expanded Analysis Sets

- Steiner full analysis
- Downs analysis
- Tweed analysis
- McNamara analysis
- Wits appraisal
- Soft tissue analysis

### 34.2 AI-Assisted Landmark Suggestions

Future only.

Rules:

- AI may suggest landmarks.
- Clinician must confirm landmarks.
- AI-suggested points should be marked differently.
- Audit trail must record AI suggestion vs clinician confirmation.

### 34.3 Superimposition

Support comparison of multiple ceph images over time.

### 34.4 Growth/Treatment Progress

Trend measurements over time.

### 34.5 Custom Norm Profiles

Allow clinic/admin to configure norms by:

- Analysis method
- Age group
- Population group
- Clinical preference

---

## 35. Clinical Validation Checklist

Before production clinical use, ask orthodontist/domain expert to validate:

- Landmark list
- Landmark definitions
- Landmark placement hints
- Measurement formulas
- Normal ranges
- Interpretation labels
- Report disclaimer
- Whether SNA/SNB/ANB is sufficient for MVP
- Whether Wits appraisal should be added early
- Whether population-specific norms are required
- Whether reports should include diagnosis language or only measurements

---

## 36. Final Product Positioning

This module should be positioned as:

> A manual cephalometric tracing and measurement tool integrated into the dental imaging workflow, designed to help clinicians place landmarks, compute standard skeletal measurements, visualize tracing overlays, and generate printable reports.

It should not be positioned as:

> An automated orthodontic diagnosis engine.

---

## 37. MVP Summary

MVP must deliver:

- Lateral ceph-only activation
- Manual placement of S, N, A, B landmarks
- Stable image-native coordinate storage
- Computation of SNA, SNB, ANB
- Visual landmarks, lines, and arcs
- Measurements panel with norms/reference ranges
- Save/load tracing
- Printable/exportable report
- Geometry and workflow tests

Once this is stable, the module can expand into a full orthodontic analysis suite.
