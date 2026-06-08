<!--
oli: oli-api-contracts v1.0 | generated: 2026-05-24 | source: dental-perio MODULE_SPEC.md + TypeSpec
-->

# API Contracts: dental-perio

> Wire-level contracts for the Periodontal Charting module. All paths prefixed `/api/v1`.

---

## Authentication

All endpoints require Bearer token (Better-Auth session). `branchId` is derived from the resource's own branch (the visit's branch for create; the chart's branch for chart-scoped ops; the patient's charts' branch for the history list) — never caller-supplied. Authorization is **role-gated** via `assertBranchRole` (not bare membership): write ops require a clinical role (dentist_owner / dentist_associate / hygienist); read ops additionally allow staff_full. `staff_scheduling` is excluded from all perio access (EF-PER-002).

---

## Endpoints

---

### POST /api/v1/dental/perio-charts

Create a new perio chart for a visit.

**Auth:** dentist_owner | dentist_associate | hygienist

**Request Body:**
```json
{
  "visitId": "uuid",
  "patientId": "uuid",
  "notes": "string (optional)"
}
```

**Success 201:**
```json
{
  "id": "pc-00000001-0000-4000-8000-000000000001",
  "visitId": "vi-00000001-0000-4000-8000-000000000001",
  "patientId": "dp-00000001-0000-4000-8000-000000000001",
  "branchId": "br-00000001-0000-4000-8000-000000000001",
  "examinerMemberId": "dm-00000001-0000-4000-8000-000000000001",
  "status": "draft",
  "notes": null,
  "readings": [],
  "createdAt": "2026-05-24T10:00:00Z",
  "updatedAt": "2026-05-24T10:00:00Z"
}
```

**Errors:**
| Status | Code | Condition |
|--------|------|-----------|
| 403 | FORBIDDEN | Caller not dentist role at branch |
| 409 | CHART_EXISTS | Chart already exists for visitId |
| 422 | VISIT_LOCKED | Parent visit is locked |
| 404 | NOT_FOUND | visitId or patientId not found |

---

### GET /api/v1/dental/perio-charts/:id

Get a perio chart with all tooth readings.

**Auth:** dentist_owner | dentist_associate | hygienist | staff_full

**Success 200:**
```json
{
  "id": "pc-00000001-0000-4000-8000-000000000001",
  "visitId": "vi-00000001-0000-4000-8000-000000000001",
  "patientId": "dp-00000001-0000-4000-8000-000000000001",
  "branchId": "br-00000001-0000-4000-8000-000000000001",
  "examinerMemberId": "dm-00000001-0000-4000-8000-000000000001",
  "status": "completed",
  "notes": "Generalized moderate periodontitis",
  "completedAt": "2026-05-24T10:30:00Z",
  "summaryBopPercent": 42.5,
  "summaryMeanDepth": 3.8,
  "summaryDeepPocketCount": 3,
  "readings": [
    {
      "id": "pr-00000001-0000-4000-8000-000000000001",
      "toothNumber": 16,
      "depthBM": 4, "depthBC": 3, "depthBD": 5,
      "depthLM": 3, "depthLC": 3, "depthLD": 4,
      "bopBM": true, "bopBC": false, "bopBD": true,
      "bopLM": false, "bopLC": false, "bopLD": false,
      "recession": 1,
      "mobility": 0,
      "furcation": 1,
      "plaque": true,
      "suppuration": false,
      "notes": null
    }
  ],
  "createdAt": "2026-05-24T10:00:00Z",
  "updatedAt": "2026-05-24T10:30:00Z"
}
```

**Errors:**
| Status | Code | Condition |
|--------|------|-----------|
| 403 | FORBIDDEN | No membership at branch |
| 404 | NOT_FOUND | Chart not found |

---

### GET /api/v1/dental/perio-charts?patientId={uuid}

Multi-exam longitudinal comparison: a patient's **finalized** (completed/locked) perio charts, most recent first (bounded to 12), each with its readings (incl. computed per-site CAL). Drafts excluded.

**Auth:** dentist_owner | dentist_associate | hygienist | staff_full (branch derived from the patient's own charts; empty `{ "data": [] }` is returned — with no role check — when the patient has no finalized charts)

**Success 200:**
```json
{ "data": [ /* PerioChart objects (newest first), each with readings[] incl. gm*/cal* per-site fields */ ] }
```

**Errors:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | — | Unauthenticated |
| 403 | FORBIDDEN | Caller has no clinical-read role at the charts' branch |

---

### GET /api/v1/dental/visits/:visitId/perio-chart

Get the perio chart for a specific visit (convenience endpoint).

**Auth:** dentist_owner | dentist_associate | hygienist | staff_full

**Success 200:** Same shape as GET /dental/perio-charts/:id

**Success 204:** No chart exists for this visit (not an error)

**Errors:**
| Status | Code | Condition |
|--------|------|-----------|
| 403 | FORBIDDEN | No membership at branch |
| 404 | NOT_FOUND | Visit not found |

---

### PUT /api/v1/dental/perio-charts/:chartId/readings/:toothNumber

Upsert tooth-level periodontal readings. Idempotent — safe to call repeatedly.

**Auth:** dentist_owner | dentist_associate | hygienist

**Path Params:**
- `chartId` — UUID of the perio chart
- `toothNumber` — FDI tooth number (integer, 11-48 adult, 51-85 primary)

**Request Body:**
```json
{
  "depthBM": 4,
  "depthBC": 3,
  "depthBD": 5,
  "depthLM": 3,
  "depthLC": 3,
  "depthLD": 4,
  "bopBM": true,
  "bopBC": false,
  "bopBD": true,
  "bopLM": false,
  "bopLC": false,
  "bopLD": false,
  "recession": 1,
  "mobility": 0,
  "furcation": 1,
  "plaque": true,
  "suppuration": false,
  "notes": "Class II furcation molar"
}
```

All fields are optional — send only what changed. Existing values preserved for fields not included. Additional optional fields not shown above: per-site **gingival-margin** position vs CEJ (`gmBM/gmBC/gmBD/gmLM/gmLC/gmLD`, signed integers −5..20mm) which, combined with the matching probing depth, drive the **read-only per-site CAL** (`calBM…calLD`) returned on the response (never persisted).

**Success 200:**
```json
{
  "id": "pr-00000001-0000-4000-8000-000000000001",
  "chartId": "pc-00000001-0000-4000-8000-000000000001",
  "toothNumber": 16,
  "depthBM": 4, "depthBC": 3, "depthBD": 5,
  "depthLM": 3, "depthLC": 3, "depthLD": 4,
  "bopBM": true, "bopBC": false, "bopBD": true,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "recession": 1,
  "mobility": 0,
  "furcation": 1,
  "plaque": true,
  "suppuration": false,
  "notes": "Class II furcation molar",
  "createdAt": "2026-05-24T10:05:00Z",
  "updatedAt": "2026-05-24T10:20:00Z"
}
```

**Errors:**
| Status | Code | Condition |
|--------|------|-----------|
| 403 | FORBIDDEN | Caller lacks clinical (dentist/hygienist) role at branch |
| 404 | NOT_FOUND | chartId not found, or parent visit not found |
| 409 | CHART_COMPLETED | Chart already completed/locked — immutable (state conflict, not 422) |
| 422 | VISIT_IMMUTABLE | Parent visit is completed/locked |
| 422 | INVALID_DEPTH | Any depth < 0 or > 20 (or recession outside −5..20) |
| 422 | INVALID_GRADE | mobility/furcation outside 0–3 |
| 422 | INVALID_GINGIVAL_MARGIN | a `gm*` site outside −5..20 (handler-level; the validator also bounds it → 400) |
| 422 | INVALID_TOOTH_NUMBER | toothNumber not in valid FDI set (quadrant-gap, e.g. 19) |

---

### POST /api/v1/dental/perio-charts/:id/complete

Mark a perio chart as completed. Computes summary statistics.

**Auth:** dentist_owner | dentist_associate | hygienist

**Request Body:** optional. Omit entirely (`{}`) for measurement-only classification, or supply 2017 staging/grading risk factors sourced from medical history (all optional): `toothLossCount`, `remainingTeeth`, `biteCollapse`, `bonelossPercent`, `ageYears`, `fiveYearProgressionMm`, `cigarettesPerDay`, `hasDiabetes`, `hba1cPercent`, `molarIncisorPattern`. **Note (IDEAL-§343):** when `remainingTeeth` is omitted it is *not* inferred from the charted-tooth count — a partial chart is not over-staged to IV via the `<20 teeth` factor.

**Success 200:**
```json
{
  "id": "pc-00000001-0000-4000-8000-000000000001",
  "status": "completed",
  "completedAt": "2026-05-24T10:30:00Z",
  "summaryBopPercent": 42.5,
  "summaryMeanDepth": 3.8,
  "summaryDeepPocketCount": 3,
  "stage": "III",
  "grade": "C",
  "extent": "generalized"
}
```
`stage` (I–IV) and `extent` (localized/generalized/molar_incisor) are `null` without evidence; `grade` (A/B/C) defaults to `B`. Computed per the 2017 AAP/EFP system; persisted in the `perio.chart.completed` audit row.

**Errors:**
| Status | Code | Condition |
|--------|------|-----------|
| 403 | FORBIDDEN | Caller lacks clinical role |
| 404 | NOT_FOUND | Chart or parent visit not found |
| 409 | CHART_COMPLETED | Already completed/locked (state conflict) |
| 422 | VISIT_LOCKED | Parent visit is completed/locked |
| 422 | INSUFFICIENT_READINGS | < 16 teeth recorded (adult) or < 8 (primary) |

---

## Shared Types

### PerioStatus enum
`draft` | `completed` | `locked`

### FDI Valid Tooth Numbers
Adult: 11–18, 21–28, 31–38, 41–48
Primary: 51–55, 61–65, 71–75, 81–85

### Mobility scale
0 = none, 1 = ≤1 mm horizontal, 2 = >1 mm horizontal, 3 = vertical displacement

### Furcation scale
0 = none, 1 = F1 (≤3 mm probe entry), 2 = F2 (>3 mm, not through-and-through), 3 = F3 (through-and-through)
