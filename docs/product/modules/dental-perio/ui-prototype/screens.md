# dental-perio — Screens

Apple HIG + #FFE97D lemon accent. Radix UI primitives. iPad-first.

## S1: Perio Chart Workspace

**Route:** `/clinical/visits/:visitId/perio`
**Purpose:** Capture or edit a periodontal exam during a visit.

### Layout (1024×1366 iPad landscape)

```
+--------------------------------------------------------------+
| Visit header (patient, dentist, date)        [Status pill]   |
+--------------------------------------------------------------+
| Tabs: Clinical | Notes | Treatments | Perio* | Imaging | Rx  |
+--------------------------------------------------------------+
| Perio chart workspace                                        |
|                                                              |
|  [Maxillary arch — 16 teeth FDI 18..28]                      |
|   18  17  16  15  14  13  12  11 | 21 22 23 24 25 26 27 28   |
|   ┌──┬──┬──┬──┬──┬──┬──┬──┐  ┌──┬──┬──┬──┬──┬──┬──┬──┐       |
|   │PD│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │           |
|   │BP│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │           |
|   └──┴──┴──┴──┴──┴──┴──┴──┘  └──┴──┴──┴──┴──┴──┴──┴──┘       |
|                                                              |
|  [Mandibular arch — 16 teeth FDI 48..38]                     |
|   ... mirror layout ...                                      |
|                                                              |
|  Tap tooth to open ToothReadingPanel drawer                  |
+--------------------------------------------------------------+
| Right rail (320px): SummaryStats card                        |
|  - BoP %  - Mean PD  - Deep pockets (>=5mm)                  |
|  - Readings: 24 / 28        [Complete chart] button          |
+--------------------------------------------------------------+
```

### States
- **Empty / Draft (new chart)**: grid renders empty cells, every tap opens the reading panel for first capture; status pill = "Draft".
- **In progress**: cells render abbreviated PD/BoP triplets, color cues (BoP red dot, deep pocket lemon outline).
- **Completed**: grid is read-only, status pill = "Completed at {timestamp}"; Complete CTA hidden; summary stats locked.
- **Locked (visit locked)**: same as Completed plus a banner "Visit locked — chart is immutable".

## S2: Perio History List

**Route:** `/clinical/patients/:patientId/perio`
**Purpose:** Browse prior perio exams for trend review.

### Layout
- Header: patient name + tabs (Overview | Clinical | Perio*)
- DataTable: rows of past perio charts (date, dentist, BoP%, mean PD, deep pockets, status).
- Right rail: trend mini-charts (BoP % over time, mean PD over time).

### States
- **Empty**: "No periodontal exams recorded yet." illustration + CTA "Start charting from a visit".
- **Populated**: rows sorted desc by `completedAt`.

## S3: Print View

**Route:** `/clinical/perio/:chartId/print`
**Purpose:** Print-friendly single-page summary for patient handout.

### Layout
- Header: clinic logo, patient name, DOB, exam date.
- Maxillary + mandibular grids rendered as static SVG.
- Summary block (BoP %, mean PD, deep pocket sites).
- Footer: examiner name + signature line.
- Letter / A4 portrait; CSS `@media print` strips chrome.
