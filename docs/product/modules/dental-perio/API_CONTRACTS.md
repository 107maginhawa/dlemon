<!--
oli: oli-api-contracts v1.0 | generated: 2026-05-24 | source: dental-perio MODULE_SPEC.md + TypeSpec
-->

# API Contracts: dental-perio

> Wire-level contracts for the Periodontal Charting module. All paths prefixed `/api/v1`.

---

## Authentication

All endpoints require Bearer token (Better-Auth session). `branchId` is derived from the visit's branch — callers must have a `DentalMembership` at that branch (`assertBranchAccess`).

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

All fields are optional — send only what changed. Existing values preserved for fields not included.

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
| 403 | FORBIDDEN | Caller not dentist role |
| 404 | NOT_FOUND | chartId not found |
| 422 | VISIT_LOCKED | Parent visit is locked |
| 422 | INVALID_DEPTH | Any depth value < 0 or > 20 |
| 422 | INVALID_TOOTH_NUMBER | toothNumber not in valid FDI set |
| 422 | CHART_COMPLETED | Chart already completed — use amendment flow |

---

### POST /api/v1/dental/perio-charts/:id/complete

Mark a perio chart as completed. Computes summary statistics.

**Auth:** dentist_owner | dentist_associate | hygienist

**Request Body:** `{}` (empty — no body needed)

**Success 200:**
```json
{
  "id": "pc-00000001-0000-4000-8000-000000000001",
  "status": "completed",
  "completedAt": "2026-05-24T10:30:00Z",
  "summaryBopPercent": 42.5,
  "summaryMeanDepth": 3.8,
  "summaryDeepPocketCount": 3
}
```

**Errors:**
| Status | Code | Condition |
|--------|------|-----------|
| 403 | FORBIDDEN | Caller not dentist role |
| 404 | NOT_FOUND | Chart not found |
| 409 | CHART_COMPLETED | Already completed |
| 422 | VISIT_LOCKED | Parent visit is locked |
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
