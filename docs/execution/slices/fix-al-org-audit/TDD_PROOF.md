# TDD PROOF: AL-003 / AL-004

## RED phase (before fix)
- `createMember.ts` had no `logAuditEvent` call — an AL-003 DB-assertion test querying `audit_log_entry` for the new membership id would return 0 rows → FAIL
- `deactivateMember.ts` had no `logAuditEvent` call — an AL-004 DB-assertion test querying `audit_log_entry` for the deactivated membership id would return 0 rows → FAIL

## GREEN phase (after fix)

### AL-003 test — createMember.test.ts
```
test('AL-003: createMembership persists audit record to DB')
  POST /dental/org/members?branchId=...  → 201
  SELECT from audit_log_entry WHERE resource = membership.id
  expect rows.length >= 1
  expect row.action = 'create'
  expect row.resourceType = 'dental_membership'
  expect row.user = PERSON_ID
  expect row.outcome = 'success'
```

### AL-004 test — deactivateMember.test.ts
```
test('AL-004: revokeMembership persists audit record to DB')
  DELETE /dental/org/members/:memberId  → 204
  SELECT from audit_log_entry WHERE resource = member.id
  expect rows.length >= 1
  expect row.action = 'delete'
  expect row.resourceType = 'dental_membership'
  expect row.user = PERSON_ID
  expect row.outcome = 'success'
```

## Typecheck
No new errors introduced in dental-org handlers. Pre-existing unrelated errors in `src/tests/` are unchanged.

## Audit failure safety
Both calls wrapped in try/catch — audit failure logs `warn` and does NOT propagate to caller. Main request path is unaffected.
