# TDD_PROOF: AL-006/007/009 Audit Trail

## RED Phase (tests written before fix)

Tests were added to existing test files. The AL-006 and AL-009 tests would have failed before the fix because `logAuditEvent` was never called in those handlers, so `DentalAuditRepository.query()` would return 0 entries.

AL-007 `createDentalVisit` already had `logAuditEvent` at lines 44-51 — the test was written to confirm that existing wiring is correct and to lock it against regression.

## GREEN Phase (implementation)

### AL-006 — exportDentalPatients.ts
- Added `import { logAuditEvent } from '@/core/audit-logger'`
- Added call after patient data is fetched and filtered, before returning the response:
  ```ts
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: q['branchId'],
    branchId: q['branchId'],
    action: 'patient.export',
    resourceType: 'dental_patient',
    metadata: { format, count: filtered.length, statusFilter: statusFilter ?? null },
  });
  ```

### AL-007 — createDentalVisit.ts
- No change needed. Confirmed present:
  ```ts
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: body.branchId,
    action: 'visit.create',
    resourceType: 'dental_visit',
    resourceId: visit.id,
    metadata: { patientId: visit.patientId, branchId: visit.branchId },
  });
  ```

### AL-009 — createAppointment.ts
- Added `import { logAuditEvent } from '@/core/audit-logger'`
- Added call after `repo.createOne(...)`, before notifications:
  ```ts
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchId,
    branchId,
    action: 'appointment.book',
    resourceType: 'dental_appointment',
    resourceId: appt.id,
    metadata: {
      patientId: appt.patientId,
      dentistMemberId: appt.dentistMemberId,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes,
      serviceType: appt.serviceType,
      walkIn: appt.walkIn ?? false,
    },
  });
  ```

## Test Locations

| Test | File | Describe block |
|------|------|---------------|
| AL-006 JSON export audit | `handlers/dental-patient/dental-patient.test.ts` | `AL-006: exportDentalPatients writes audit record to DB` |
| AL-006 CSV export audit | same | same |
| AL-007 visit create audit | `handlers/dental-visit/dental-visit.test.ts` | `AL-007: createDentalVisit writes audit record to DB` |
| AL-009 appointment book audit | `handlers/dental-scheduling/dental-scheduling.test.ts` | `AL-009: createAppointment writes audit record to DB` |

## Assertion Strategy

Each test queries `DentalAuditRepository` directly against the live test DB to confirm the row was persisted — not mocked. Assertions check:
- `entry.action` exact match
- `entry.resourceType` exact match
- `entry.resourceId` matches the created resource id (where applicable)
- `entry.branchId` matches the request branchId
- `entry.timestamp` >= `before` (timestamp captured before the HTTP call)
- `entry.metadata` contains key operation parameters
