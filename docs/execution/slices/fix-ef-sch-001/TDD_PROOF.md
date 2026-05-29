# TDD_PROOF: fix-ef-sch-001

## Test file
`services/api-ts/src/handlers/dental-scheduling/domain-events.test.ts`

## Test run result
```
8 pass
0 fail
22 expect() calls
Ran 8 tests across 1 file. [400.00ms]
```

## Coverage (domain-events.ts)
```
src/handlers/dental-scheduling/domain-events.ts | 100.00 | 100.00 |
```
100% function coverage, 100% line coverage on the new module.

## Regression check
Existing `dental-scheduling.test.ts` suite (52 tests, 103 assertions) — all pass, 0 fail.

## Test cases

### DE-010: AppointmentBooked emitted after successful booking
| # | Test | Result |
|---|------|--------|
| 1 | scheduler.trigger called with DENTAL_SCHEDULING_EVENTS_QUEUE after 201 | PASS |
| 2 | payload contains event=AppointmentBooked + appointmentId + patientId + branchId | PASS |
| 3 | DE-010 not emitted when booking fails (400 bad request) | PASS |
| 4 | graceful degradation when no scheduler injected — still returns 201 | PASS |

### DE-011: AppointmentCancelled emitted after successful cancellation
| # | Test | Result |
|---|------|--------|
| 5 | scheduler.trigger called with DENTAL_SCHEDULING_EVENTS_QUEUE after 204 | PASS |
| 6 | payload contains event=AppointmentCancelled + appointmentId + patientId + branchId | PASS |
| 7 | DE-011 not emitted when appointment not found (404) | PASS |
| 8 | graceful degradation when no scheduler injected — still returns 204 | PASS |

## Strategy
Tests inject a `MockScheduler` (in-memory, no pg-boss) via `ctx.set('jobs', scheduler)`.
After each successful handler response, `scheduler.calls` is inspected for the expected
queue name and payload. A 10ms `setTimeout` settles the non-blocking promise before assertion.
