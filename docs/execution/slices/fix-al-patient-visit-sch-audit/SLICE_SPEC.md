# SLICE_SPEC: AL-006/007/009 — HIPAA Audit Trail Fixes

## Problem

Three handlers were missing persisted audit records for PHI-touching operations:

- **AL-006** `exportDentalPatients` — bulk PHI export had no audit record in `dental_audit` / `dental_audit_log`
- **AL-007** `createDentalVisit` — visit creation lacked `logAuditEvent` call (only `logger.info`)
- **AL-009** `createAppointment` — appointment booking had no audit record at all

HIPAA requires an audit trail for all PHI access and mutations, persisted in a queryable store (not just log files).

## Fix Summary

| Finding | File | Change |
|---------|------|--------|
| AL-006 | `services/api-ts/src/handlers/dental-patient/identity/exportDentalPatients.ts` | Import + call `logAuditEvent` with action `patient.export` after successful data fetch |
| AL-007 | `services/api-ts/src/handlers/dental-visit/visits/createDentalVisit.ts` | Already had `logAuditEvent` — confirmed present at lines 44-51 |
| AL-009 | `services/api-ts/src/handlers/dental-scheduling/createAppointment.ts` | Import + call `logAuditEvent` with action `appointment.book` after `repo.createOne` |

## Audit Event Shape

Both new calls use the same `logAuditEvent` signature from `@/core/audit-logger`:

```ts
logAuditEvent(db, logger, {
  personId: user.id,       // actor
  tenantId: branchId,      // tenant scope
  branchId,                // branch scope
  action: '<action>',      // 'patient.export' | 'appointment.book'
  resourceType: '<type>',  // 'dental_patient' | 'dental_appointment'
  resourceId?: appt.id,    // undefined for bulk export
  metadata: { ... },       // operation-specific context (count, format, patientId, etc.)
})
```

`logAuditEvent` writes to both `dental_audit` (legacy) and `dental_audit_log` (spec-compliant). It never throws — audit failure is logged but does not break the main request.

## Test Coverage

- `dental-patient.test.ts` — added `describe('AL-006: ...)` with 2 tests (JSON export, CSV export)
- `dental-visit.test.ts` — added `describe('AL-007: ...)` with 1 test (visit.create record)
- `dental-scheduling.test.ts` — added `describe('AL-009: ...)` with 1 test (appointment.book record)

Each test: POST/GET the operation → query `DentalAuditRepository` directly → assert row exists with correct action, resourceType, resourceId, branchId, and timestamp ≥ before.
