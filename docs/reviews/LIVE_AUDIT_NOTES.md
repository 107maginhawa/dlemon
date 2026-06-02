# Live-App Audit Notes

> 2026-06-02. Drove the running app (web `:3003`, API `:7213`) headless via the browser as Dentist-Owner (Dr. Maria Reyes, PIN 123456). Screenshots in `screenshots/`. These feed the module scorecards and `IMPROVEMENT_BACKLOG.md`.

## Screens captured
| # | Screen | File |
|---|--------|------|
| 01 | Dashboard (morning briefing) | `screenshots/01-dashboard.png` |
| 02 | Patients list | `screenshots/02-patients-list.png` |
| 03 | Clinical workspace + timeline carousel + dental chart | `screenshots/03-workspace-carousel.png` |
| 04 | Tooth slideout (Overview/Treatment/Review wizard) | `screenshots/04-tooth-slideout.png` |
| 05 | Prescription form | `screenshots/05-prescription-form.png` |

## Cross-cutting findings

### CC-1 [P1] Dashboard appointment fetch 400s — client/server contract drift
`GET /dental/appointments?date=2026-06-02&branchId=…` returns **400** repeatedly. Response body: `Validation failed: date_from: expected string, received undefined; date_to: …`. The API requires `date_from`/`date_to`. **Localized to the dashboard hook** `apps/dentalemon/src/features/dashboard/.../use-dashboard-summary.ts:69-70`, which sends `date=`; the calendar hook (`use-appointments.ts:79`) already sends the correct params, so the calendar is fine — this is a one-hook fix, not a calendar-wide outage. Dashboard shows a graceful red banner "Failed to load today appointments (HTTP 400)" (good error UX) but the **morning briefing is empty**. Evidence: `screenshots/01-dashboard.png`, network log, code review.

### CC-2 [P2] PIN session drops on workspace↔dashboard navigation
Hard navigation, and crossing between the `_workspace` and `_dashboard` route trees (e.g. clicking "Profile" from the workspace), bounces back to `/auth/pin-select`, forcing PIN re-entry. Friction for the chairside switching journey. Decide intended PIN-session lifetime and persist it across the route-tree boundary (or scope re-auth to genuine privilege changes).

### CC-3 [P2] Demo seed gives each patient only ONE visit
Every patient in the 20-patient seed has ≤1 visit, so the **timeline carousel's signature multi-visit Cover Flow comparison is never visible** — the core product differentiator can't be demoed or evaluated. Seed several patients with 3–6 longitudinal visits showing chart evolution. Evidence: `screenshots/03-workspace-carousel.png` (single card).

### CC-4 [P3] Dev-env console noise
`[RuntimeConfig] Failed to fetch runtime config … using fallback` and `OneSignal … AppID doesn't match` errors on every page. Dev-only, but noisy; gate behind env or fix the runtime-config endpoint.

## Accessibility (clinical core)

### A11Y-1 [resolved — not a defect] Teeth and `role="button"`
My initial DOM probe found 0 elements with an explicit `role="button"` and I flagged teeth as inaccessible. **Code verification corrected this**: teeth are native `<button>` elements with rich aria-labels (`"Tooth 18: Upper Right Third Molar, watchlist, baseline"`) — native buttons have an *implicit* button role, so they announce correctly to screen readers; my `querySelector('[role="button"]')` only matched explicit attributes. No fix needed. (Kept here as a verification note.) The real a11y items are A11Y-2/3 below.

### A11Y-2 [P2] Escape doesn't dismiss sheets + no focus return
The tooth slideout and Rx sheet did not close on `Escape` (had to reload), and focus is not returned to the triggering tooth/button on close. Standard modal/sheet behavior expects Escape-to-close and focus restoration (WCAG 2.4.3 Focus Order). Evidence: live walkthrough + code review.

### A11Y-3 [P3] Possible nested screen-reader announcement
The inner tooth graphic carries `role="img"` inside the native `<button>`, which may double-announce. Verify with a screen reader. Evidence: code review (visit/charting scorecard).

## Positive observations (keep / build on)
- **Tooth slideout** (`screenshots/04-tooth-slideout.png`) is strong: 3-step wizard, B/D/M/P/O surface ring, color-dotted condition chips, and an Entry Classification that includes **"Existing (Other) — From another provider"** — directly satisfies the multi-provider attribution standard.
- **Dashboard error handling** is graceful (inline red banner, not a crash).
- **Prescription form** uses RxNorm code + clinically-correct frequency abbreviations (OD/BID/TID/QID/PRN/Stat) + dispense-as-written.
- **Layer model** Baseline / Proposed / Completed is a clean segmented control inside the visit card.
- **Anatomical tooth rendering** (crown+root SVG) gives each chart a recognizable "fingerprint," which is exactly what the carousel snapshot concept needs.

## Not reached headless (assessed from code in scorecards)
- Perio charting UI (no entry point found in workspace toolbar/tabs — flagged for verification in perio scorecard).
- Ceph report (`imaging-ceph-report.$imageId`) — test patient had no seeded ceph image.
- Calendar / billing detail screens (collapsed sidebar links not actionable headless; covered by light-pass research).
