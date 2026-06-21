# Coverage Backlog — verified user-reachable gaps (Phase 1)

> Verified user-reachable coverage gaps. Each confirmed real by corpus search. Burn down RED-first in Phase 3.
> Phase 1 (ledger-coverage.ts + LLM verify wf_27c33227-093)

## How this was graded

1. **Deterministic matrix** (`scripts/coverage/ledger-coverage.ts`) joined all 915 ledger items against the endpoint/workflow/fe-route matrices + a be-unit signal (operationId-grep ∪ recorder sink) + a static e2e spec-index, applying the per-type required-layer policy.
2. **Reachability filter** dropped 135 backend/orphan gaps (no FE consumer — upstream Stripe `billing` template, not dentalemon-reachable).
3. **LLM verification** (wf_27c33227-093, 41 agents) confirmed each candidate gap by reading the actual corpus, and judged non-vacuity of 20 high-risk COVERED money/clinical items.

## Outcome

| | count |
|--|------:|
| **Confirmed gaps (burn down in Phase 3)** | **18** |
| False positives dropped (covered, matcher missed) | 4 |
| Contract-only deferred (mostly deliberate "integration-tested instead") | 36 |
| Non-vacuity sample | 19/20 non-vacuous (1 vacuity gap found) |

**Dropped false positives:** `billing-create-invoice`, `imaging-delete-image-link`, `person-get-operation`, `calibrate-image` — each is covered by an e2e/journey the fuzzy matcher could not bind (e.g. imaging-library-write G5, imaging-calibration G6, the journey harness exercising getPerson).

## Confirmed backlog (priority order: severity → blast radius)

Severity: `unproven` (no layer covers it) > `e2e-gap` (unit proven, workflow not end-to-end) > `be-unit-gap` > `vacuity` (covered-but-vacuous).

| # | sev | risk | id | missing | route | recommendation |
|--:|-----|------|----|---------|-------|----------------|
| 1 | unproven | auth | `notif-push-opt-in-enable` | e2e | /_workspace | Add a RED-first Playwright spec at apps/dentalemon/tests/e2e/push-opt-in.spec.ts (or exten |
| 2 | unproven | core | `portal-index-redirect` | e2e | /portal | Add one RED-first Playwright e2e that, as an authenticated patient session (Better-Auth us |
| 3 | unproven | core | `portal-tab-navigation` | e2e | /portal/* | Add ONE journey/e2e spec (e.g. apps/dentalemon/tests/e2e/journeys/32-patient-portal-tabs.j |
| 4 | e2e-gap | money | `be-dental-billing-loa-authorization-dependency` | e2e | /dental/patients/{patientId}/authorizations | RED-first, smallest viable: a UI-driving Playwright e2e is currently impossible because th |
| 5 | e2e-gap | money | `inter-portal-billing-facade` | e2e | /me/invoices | Add a RED-first Playwright e2e at apps/dentalemon/tests/e2e/portal-bills.spec.ts that auth |
| 6 | e2e-gap | money | `notif-push-click-deep-link` | e2e | /_dashboard (usePushNotificationRouting registered on shell mount) | Add one Playwright e2e spec at apps/dentalemon/tests/e2e/push-deep-link.spec.ts that, on t |
| 7 | e2e-gap | money | `person-billing-party-lookup-inter-module` | e2e | /invoices | See above. |
| 8 | e2e-gap | money | `portal-get-my-balance` | e2e | /portal/bills | Add one RED-first Playwright journey spec (e.g. apps/dentalemon/tests/e2e/journeys/32-port |
| 9 | e2e-gap | money | `portal-list-my-invoices` | e2e | /portal/bills |  |
| 10 | e2e-gap | clinical | `portal-list-my-appointments` | e2e | /portal/appointments | Add a Playwright e2e journey, e.g. apps/dentalemon/tests/e2e/portal-appointments.spec.ts,  |
| 11 | e2e-gap | core | `comms-ws-chat-room` | e2e | /ws/comms/chat-rooms/:room | Add a server-level WebSocket integration test (not a Playwright UI journey, since comms ha |
| 12 | e2e-gap | core | `notifs-mark-all-read` | e2e | /_dashboard header (inbox header) | Add an e2e test to notification-inbox.spec.ts that seeds 2+ real notifications, opens the  |
| 13 | e2e-gap | core | `portal-sign-out` | e2e | /portal/* | Add a focused portal sign-out journey (e.g. apps/dentalemon/tests/e2e/journeys/32-portal-s |
| 14 | be-unit-gap | clinical | `dp-list-coverage-authorizations` | be-unit+contract | /dental/patients/:patientId/authorizations | See above. |
| 15 | be-unit-gap | clinical | `dp-list-due-recalls` | be-unit | /calendar | Add a be-unit test (e.g. services/api-ts/src/handlers/dental-patient/recalls/listDueRecall |
| 16 | be-unit-gap | clinical | `op-export-dental-chart` | be-unit | /$patientId | Add a handler-level bun test (e.g. services/api-ts/src/handlers/dental-visit/exportDentalC |
| 17 | be-unit-gap | clinical | `uc-list-consent-refusals` | be-unit | /dental/visits/:visitId/consent-refusals | Add a RED-first bun unit test for the listConsentRefusals handler. |
| 18 | vacuity | clinical | `br-003-visit-immutable-clinical-writes` | be-unit (negative-path) | — | BR-003 locked/completed-visit guard exists in createPrescription.ts:37-40 but no test asse |

## Clusters (Phase 3 grouping)

- **Patient portal e2e (7):** `portal-index-redirect`, `portal-tab-navigation`, `portal-list-my-appointments`, `portal-list-my-invoices`, `portal-get-my-balance`, `portal-sign-out`, `inter-portal-billing-facade` — the portal has ~no e2e coverage; ONE authenticated-patient journey spec can cover the lot.
- **Notifications e2e (3):** `notif-push-opt-in-enable`, `notif-push-click-deep-link`, `notifs-mark-all-read`.
- **Billing/inter-module e2e (2):** `be-dental-billing-loa-authorization-dependency`, `person-billing-party-lookup-inter-module`.
- **Clinical/patient be-unit reads (4):** `dp-list-coverage-authorizations`, `dp-list-due-recalls`, `op-export-dental-chart`, `uc-list-consent-refusals`.
- **Comms e2e (1):** `comms-ws-chat-room` (WebSocket).
- **Vacuity (1):** `br-003-visit-immutable-clinical-writes` — locked-visit guard exists, no test asserts it on the prescription path.

