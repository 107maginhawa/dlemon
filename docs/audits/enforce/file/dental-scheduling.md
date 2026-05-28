# dental-scheduling — File Enforcement
<!-- oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary
- Files scanned: 25 (source: 17, tests: 8)
- Findings: 5 (P0: 0, P1: 2, P2: 2, P3: 1)
- Service files present: `.service.ts` ❌, `.repo.ts` ✅ (2 repos: `dental-appointment.repo.ts`, `queue-item.repo.ts`)

## Findings

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EF-SCH-001 | P1 | No `.service.ts` — `updateAppointment.ts` (101 lines) and `checkInAppointment.ts` (68 lines) contain complex orchestration including FSM enforcement, double-booking detection, working-hours validation, visit creation, and notification dispatch. This logic should live in a service layer, not directly in handlers. | `updateAppointment.ts`, `checkInAppointment.ts`, `createAppointment.ts` | — |
| EF-SCH-002 | P1 | `workingHours.ts` (137 lines) uses camelCase filename for a multi-word concept. Convention requires `kebab-case` for multi-word handler files (`working-hours.ts`). Additionally the file bundles both GET and PUT handlers (2 operations, 137 lines) — should be split or at minimum renamed. | `workingHours.ts` | — |
| EF-SCH-003 | P2 | `repos/appointment-patient.facade.ts` imports cross-module schemas: `@/handlers/patient/repos/patient.schema` and `@/handlers/person/repos/person.schema`. Direct cross-module schema imports at the repo/facade layer are a boundary violation. Should access patient data via a service abstraction. | `repos/appointment-patient.facade.ts` | 11–12 |
| EF-SCH-004 | P2 | `utils/assert-branch-access.ts` is a 2-line stub file. Either inline the import at the call sites or implement properly. A 2-line re-export file adds navigation overhead with no encapsulation benefit. | `utils/assert-branch-access.ts` | 1–2 |
| EF-SCH-005 | P3 | No `.test.ts` for `workingHours.ts` handler functions directly — `dental-scheduling.working-hours.test.ts` is an integration test, not a unit test of the working-hours helpers in isolation. Low risk but noted. | `workingHours.ts` | — |

## Notes

- No direct `db.insert/select/update/delete` in handler files — all DB ops route through repo classes. ✅
- No cross-module schema imports in handler files (only in facade). ✅
- No files exceed 500 lines. ✅
- Largest non-test file is `dental-appointment.repo.ts` at 186 lines — within limits. ✅
- Handler files are individually small (29–101 lines); no single handler exceeds 300 lines. ✅
- Strong test coverage: 8 test files including property-based FSM tests, acceptance tests, and notification tests. ✅
- F2 gap: two repos exist; missing `.service.ts` means FSM logic, notification dispatch, and working-hours enforcement are handled inside handlers directly. A `dental-scheduling.service.ts` would centralize this.

## File Inventory

| File | Lines | Role |
|------|-------|------|
| `dental-scheduling.test.ts` | 1040 | Integration test |
| `dental-scheduling-transitions.test.ts` | 405 | FSM transition test |
| `repos/dental-appointment.test.ts` | 362 | Repo unit test |
| `dental-scheduling.working-hours.test.ts` | 326 | Working hours integration test |
| `dental-queue.test.ts` | 321 | Queue integration test |
| `acceptance.scheduling-workflows.test.ts` | 296 | Acceptance test |
| `createAppointment.notif.test.ts` | 126 | Notification test |
| `appointment.fsm.property.test.ts` | 92 | Property-based FSM test |
| `repos/dental-appointment.repo.ts` | 186 | Repository ✅ |
| `workingHours.ts` | 137 | Handler (naming violation P1, bundles GET+PUT) |
| `updateAppointment.ts` | 101 | Handler (orchestration-heavy) |
| `repos/appointment-patient.facade.ts` | 95 | Facade (cross-module imports — P2) |
| `createAppointment.ts` | 82 | Handler |
| `listAppointments.ts` | 69 | Handler |
| `repos/dental-appointment.schema.ts` | 68 | Schema |
| `checkInAppointment.ts` | 68 | Handler |
| `repos/queue-item.repo.ts` | 65 | Repository ✅ |
| `updateQueueItemStatus.ts` | 54 | Handler |
| `cancelAppointment.ts` | 54 | Handler |
| `createQueueItem.ts` | 43 | Handler |
| `repos/queue-item.schema.ts` | 35 | Schema |
| `getAppointment.ts` | 29 | Handler |
| `listQueueBoard.ts` | 26 | Handler |
| `queue-item-validators.ts` | 23 | Validators |
| `repos/operatory.schema.ts` | 17 | Schema |
| `utils/assert-branch-access.ts` | 2 | Stub (P2) |
