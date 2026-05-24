# dental-perio — Interaction States

## S1 Perio Chart Workspace

| State        | Trigger                              | UI                                                                                  |
|--------------|--------------------------------------|-------------------------------------------------------------------------------------|
| Loading      | route mount                          | Skeleton grid + spinner in right rail.                                              |
| Empty draft  | no chart yet for visit               | "Start a periodontal exam" empty state with CTA "Begin charting".                   |
| Draft        | chart exists, status='draft'         | Grid editable; Complete CTA shown but disabled until ≥16 readings.                  |
| Saving cell  | PUT in flight                        | Affected cell shows pulsing lemon outline; other cells remain interactive.          |
| Save error   | PUT failed                           | Cell badged with red dot + tooltip; row banner with retry.                          |
| Complete CTA | tap Complete                         | Confirmation modal "Complete this chart? Stats: BoP X%, mean PD Y mm."              |
| Completed    | POST /complete returned 200          | Status pill flips to "Completed"; grid disables; right rail shows finalized stats.  |
| Locked       | visit.status='locked' or 'completed' | Banner across top: "Visit locked — chart is read-only".                             |

## S2 Perio History List

| State    | Trigger              | UI                                                                |
|----------|----------------------|-------------------------------------------------------------------|
| Loading  | route mount          | Skeleton rows                                                     |
| Empty    | no charts            | Illustration + "No periodontal exams recorded yet."               |
| Populated| ≥1 chart             | DataTable rows, trend rail with mini sparkline                    |
| Error    | fetch failed         | Inline alert with retry button                                    |

## S3 Print View

| State    | Trigger              | UI                                                                |
|----------|----------------------|-------------------------------------------------------------------|
| Ready    | chart loaded         | Auto-trigger `window.print()` after 250ms                          |
| Loading  | fetching chart       | Centered spinner                                                  |
| Error    | chart 404            | Friendly error "Chart not found." + back link                     |
