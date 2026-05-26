# dental-perio — Data Table Contracts

## PerioHistoryTable

Backed by client-side aggregation over `GET /dental/patients/{patientId}/perio-charts` (future endpoint) — for now derived from the visit list filtered by `chartExists`.

### Columns

| Key              | Header              | Sortable | Render                                          |
|------------------|---------------------|----------|-------------------------------------------------|
| examDate         | Exam date           | yes (default desc) | `date`                                |
| examinerName     | Dentist             | no       | `Dr. {name}`                                    |
| bopPercent       | BoP %               | yes      | `{n.toFixed(1)}%` or `—`                        |
| meanDepth        | Mean PD             | yes      | `{n.toFixed(2)} mm` or `—`                      |
| deepPocketCount  | Deep pockets (≥5)   | yes      | `{n}` with lemon dot if > 5                     |
| status           | Status              | no       | Pill: draft / completed / locked                |
| actions          |                     | no       | `[Open] [Print]`                                |

### Filters
- Status: All / Draft / Completed / Locked
- Date range: last 6 months (default), 1 year, all

### Empty / loading
- Loading: 3 skeleton rows
- Empty: "No perio exams in this date range."

### Row interactions
- Click row → navigate to S1 Workspace for that chart's visit.
- Print action → open S3 in new tab.
