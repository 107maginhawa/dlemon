# SLICE SPEC: AL-003 / AL-004 — HIPAA Audit Trail for Membership Create/Revoke

## Findings

**AL-003**: `createMember` (POST /dental/org/members) — no audit call after successful membership creation. Violates HIPAA §164.312 (access controls / audit controls).

**AL-004**: `deactivateMember` (DELETE /dental/org/members/:memberId) — no audit call after successful membership deactivation/revocation. Same HIPAA violation.

## Fix

Import `logAuditEvent` from `@/handlers/audit/repos/audit.facade` in both handlers and call it after the successful DB operation, wrapped in try/catch so audit failure never breaks the main request.

### createMember.ts
- After `memberRepo.createOne(...)` and before returning 201
- `eventType: 'data-modification'`, `category: 'administrative'`, `action: 'create'`, `outcome: 'success'`
- `resource: membership.id`, `resourceType: 'dental_membership'`
- `details`: branchId, role, displayName

### deactivateMember.ts
- After `repo.deactivate(memberId)` and before returning 204
- `eventType: 'data-modification'`, `category: 'administrative'`, `action: 'delete'`, `outcome: 'success'`
- `resource: memberId`, `resourceType: 'dental_membership'`
- `details`: branchId (from pre-fetched `member`), memberId

## Pattern Reference

Follows the same pattern as `DentalMembershipManagement_setPin.ts` which imports from `audit.facade` and wraps in try/catch with `logger?.warn` on failure.

## Files Changed

- `services/api-ts/src/handlers/dental-org/createMember.ts`
- `services/api-ts/src/handlers/dental-org/deactivateMember.ts`
- `services/api-ts/src/handlers/dental-org/createMember.test.ts` (AL-003 DB-assertion test)
- `services/api-ts/src/handlers/dental-org/deactivateMember.test.ts` (AL-004 DB-assertion test)
