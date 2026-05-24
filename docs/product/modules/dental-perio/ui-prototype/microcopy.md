# dental-perio — Microcopy

## Labels
- Tab title: "Perio"
- Drawer title: "Tooth {n} — Periodontal reading"
- Stat tiles: "Bleeding on probing", "Mean probing depth", "Deep pockets (≥5 mm)"
- CTA: "Begin charting" / "Complete chart" / "Print summary"

## Empty states
- Workspace: **No periodontal exam yet.** "Tap Begin charting to record probing depths and bleeding for this visit."
- History: **No periodontal exams recorded.** "Start a chart from an active visit to track perio trends."

## Confirmations
- Complete chart modal title: "Complete periodontal chart?"
- Body: "Stats will be locked: BoP {x}%, mean PD {y} mm, {n} deep pockets. You won't be able to edit readings after completing."
- Confirm button: "Complete chart"
- Cancel button: "Keep editing"

## Errors
- 422 depth out of range: "Probing depth must be between 0 and 20 mm."
- 422 invalid tooth: "Tooth {n} isn't a valid FDI number."
- 422 chart locked: "This chart is completed and can't be edited."
- 422 visit locked: "Visit must be active to add a periodontal chart."
- 422 insufficient readings: "Record at least 16 teeth before completing the chart."
- 403 role: "Only dentists can record periodontal readings."
- 409 duplicate: "A periodontal chart already exists for this visit."

## Toasts
- Reading saved: "Saved tooth {n}."
- Chart completed: "Periodontal chart completed."
- Chart created: "Periodontal chart started."

## Accessibility
- Grid cells `aria-label="Tooth {fdi}, depth {pd} mm, bleeding {yes|no}"`
- Drawer `role="dialog" aria-modal="true"`
- Stepper buttons `aria-label="Increase depth"` / `"Decrease depth"`
