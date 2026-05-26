# Mock data — dental-audit
<!-- oli: v3-dentalemon | dental-audit | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

24-hour window, branch `br_main`, 47 total events across 3 modules:

- 18× `visit.*` (visit.created, visit.updated, treatment.status_changed → diagnosed/planned/performed)
- 22× `billing.*` (billing.invoice.draft, billing.invoice.issued, billing.payment.received)
- 7× `scheduling.*` (scheduling.appointment.created, scheduling.appointment.cancelled with reason)

Sample rows:
- `evt_001` 2026-05-23T09:12:04Z — visit.created — actor `usr_abc123` — resource `visit:v_555` — ip `10.0.0.14`
- `evt_002` 2026-05-23T09:14:18Z — treatment.status_changed — actor `usr_abc123` — resource `treatment:tr_8821` — payload `{ from: "planned", to: "performed" }`
- `evt_003` 2026-05-23T09:30:02Z — billing.invoice.issued — actor `usr_def456` — resource `invoice:inv_9001`
- `evt_004` 2026-05-23T11:01:55Z — scheduling.appointment.cancelled — actor `usr_def456` — resource `appointment:apt_7700` — payload `{ reason: "patient_request" }`

Dashboard tiles (30d): Total Events 1,247 / Unique Actors 8 / Events Today 47 / Failed Verifications 0.
