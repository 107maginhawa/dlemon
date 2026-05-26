# dental-perio — Form Contracts

## ToothReadingForm

Drives PUT `/dental/perio-charts/{chartId}/readings/{toothNumber}`.

| Field      | Type    | Required | Validation                       | UI control            |
|------------|---------|----------|----------------------------------|------------------------|
| depthBM    | int     | no       | 0–20 (BR-P03)                    | Stepper 0–20           |
| depthBC    | int     | no       | 0–20                             | Stepper                |
| depthBD    | int     | no       | 0–20                             | Stepper                |
| depthLM    | int     | no       | 0–20                             | Stepper                |
| depthLC    | int     | no       | 0–20                             | Stepper                |
| depthLD    | int     | no       | 0–20                             | Stepper                |
| bopBM..LD  | bool    | no       | —                                | Toggle per site        |
| recession  | int     | no       | -5–20                            | Stepper                |
| mobility   | int     | no       | 0–3                              | Radio chips 0/1/2/3    |
| furcation  | int     | no       | 0–3                              | Radio chips 0/1/2/3    |
| plaque     | bool    | no       | —                                | Toggle                 |
| suppuration| bool    | no       | —                                | Toggle                 |
| notes      | string  | no       | ≤ 500 chars                      | Textarea               |

### Submit behavior
- Optimistic update locally; on 422 (depth out of range) show inline error on the offending site stepper.
- On 422 PERIO_CHART_LOCKED show toast "Chart is completed and cannot be edited" and close drawer.
- On 403 show toast "Only dentists can record perio readings."

## CreatePerioChartForm

Drives POST `/dental/perio-charts`.

| Field     | Type   | Required | Notes                           |
|-----------|--------|----------|---------------------------------|
| visitId   | UUID   | yes      | derived from current visit ctx  |
| patientId | UUID   | yes      | derived from current visit ctx  |
| notes     | string | no       | optional examiner notes         |

### Submit behavior
- 409 PERIO_CHART_DUPLICATE → redirect to existing chart.
- 422 PERIO_VISIT_LOCKED → toast "Visit must be active to add a perio chart."
