# SLICE_SPEC — AL-012: HIPAA Audit Trail for Imaging Study Create/Access

## Finding

**AL-012** — `createImagingStudy` and `getImagingStudy` handlers had no audit logging for PHI image access. Both endpoints handle Protected Health Information (dental imaging studies tied to patient records) and must emit audit events per HIPAA audit-control requirements.

## Root Cause

Neither handler imported or called `logAuditEvent` from `@/core/audit-logger`. All other PHI-touching handlers in the codebase (e.g. `getDentalPatient`, `createDentalVisit`) already use the audit shim; imaging was overlooked.

## Fix

### Files Modified

- `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts`
  - Added `import { logAuditEvent } from '@/core/audit-logger'`
  - After study creation and before the 201 response, call `logAuditEvent` with:
    - `action: 'imaging_study.create'`
    - `resourceType: 'imaging_study'`
    - `resourceId: study.id`
    - `metadata: { patientId, branchId, modality }`

- `services/api-ts/src/handlers/dental-imaging/getImagingStudy.ts`
  - Added `import { logAuditEvent } from '@/core/audit-logger'`
  - After branch auth and before the 200 response, call `logAuditEvent` with:
    - `action: 'imaging_study.read'`
    - `resourceType: 'imaging_study'`
    - `resourceId: study.id`
    - `metadata: { patientId: study.patientId, branchId: study.branchId }`

### Audit Event Shape

Both calls follow the project-standard `AuditEvent` interface:

```typescript
{
  personId: user.id,           // actor (the authenticated staff member)
  tenantId: branchId,          // scoping tenant
  action: 'imaging_study.create' | 'imaging_study.read',
  resourceType: 'imaging_study',
  resourceId: study.id,
  metadata: { patientId, branchId, modality? }
}
```

`logAuditEvent` is a fire-and-forget shim that writes to:
1. Pino structured log (`logger.info`)
2. `dental_audit` table (legacy compatibility)
3. `dental_audit_log` table (spec-compliant)

It never throws — audit failure cannot break the main request path.

## Compliance Impact

Closes the HIPAA audit-control gap for imaging PHI access. Every imaging study creation and retrieval is now traceable by actor, time, resource, and tenant in both the Pino log stream and the persistent audit tables.
