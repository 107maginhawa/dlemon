# Code State Machines

<!-- oli:regen:code-state-machines:begin -->
| FSM | States | Transitions | Method | Confidence |
|---|---|---|---|---|
| `fsm:appointment-status` | scheduled / checked_in / completed / cancelled / no_show | 0 | drizzle_enum | MEDIUM |
| `fsm:audit-retention-status` | active / archived / pending-purge | 0 | drizzle_enum | MEDIUM |
| `fsm:booking-event-status` | draft / active / paused / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:booking-status` | pending / confirmed / rejected / cancelled / completed / no_show_client / no_show_host | 0 | drizzle_enum | MEDIUM |
| `fsm:ceph-landmark-status` | not_placed / placed / confirmed / locked | 0 | drizzle_enum | MEDIUM |
| `fsm:chat-room-status` | active / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:consultation-status` | draft / finalized / amended | 0 | drizzle_enum | MEDIUM |
| `fsm:dental-installment-status` | pending / paid / overdue / waived | 0 | drizzle_enum | MEDIUM |
| `fsm:dental-invoice-status` | draft / issued / partial / paid / overdue / voided | 0 | drizzle_enum | MEDIUM |
| `fsm:dental-perio-chart-status` | draft / completed / locked | 0 | drizzle_enum | MEDIUM |
| `fsm:dental-plan-status` | on_track / behind / completed / defaulted | 0 | drizzle_enum | MEDIUM |
| `fsm:dental-treatment-status` | diagnosed / planned / performed / verified / dismissed / declined | 0 | drizzle_enum | MEDIUM |
| `fsm:dental-visit-status` | draft / active / completed / locked / discarded | 0 | drizzle_enum | MEDIUM |
| `fsm:email-queue-status` | pending / processing / sent / failed / cancelled | 0 | drizzle_enum | MEDIUM |
| `fsm:file-status` | uploading / processing / available / failed | 0 | drizzle_enum | MEDIUM |
| `fsm:imaging-finding-status` | draft / suspected / confirmed / monitoring / resolved | 0 | drizzle_enum | MEDIUM |
| `fsm:imaging-status` | active / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:invoice-status` | draft / open / paid / void / uncollectible | 0 | drizzle_enum | MEDIUM |
| `fsm:lab-order-status` | ordered / in_fabrication / delivered / fitted / cancelled | 0 | drizzle_enum | MEDIUM |
| `fsm:member-status` | invited / active / inactive / revoked | 0 | drizzle_enum | MEDIUM |
| `fsm:notification-status` | queued / sent / delivered / read / failed / expired | 0 | drizzle_enum | MEDIUM |
| `fsm:payment-status` | pending / requires_capture / processing / succeeded / failed / canceled | 0 | drizzle_enum | MEDIUM |
| `fsm:pmd-document-status` | generated / signed / superseded | 0 | drizzle_enum | MEDIUM |
| `fsm:prescription-status` | pending / dispensed / cancelled | 0 | drizzle_enum | MEDIUM |
| `fsm:slot-status` | available / booked / blocked | 0 | drizzle_enum | MEDIUM |
| `fsm:template-status` | draft / active / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:tooth-state` | healthy / caries / fractured / filled / crown / missing / implant / extracted / watchlist | 0 | drizzle_enum | MEDIUM |
| `fsm:video-call-status` | starting / active / ended / cancelled | 0 | drizzle_enum | MEDIUM |
<!-- oli:regen:code-state-machines:end -->
