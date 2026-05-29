# Slice Spec: fix-em-bil-001

## Finding

**ID:** EM-BIL-001  
**Severity:** P0  
**Category:** Auth Bypass  

## Description

`GET /dental/billing/invoices` (handler: `listDentalInvoices`) only calls
`assertBranchAccess` when the `branchId` query parameter is present.  When
`branchId` is omitted the branch access check is skipped entirely **and** no
`WHERE branch_id = ?` clause is added to the query, so the response contains
invoices from every branch in the database.  Any authenticated user can
enumerate all-organisation financial data by calling the endpoint without
`branchId`.

**Vulnerable code path (`listDentalInvoices.ts` lines 30-37):**
```typescript
// Branch-level authorization — optional filter; if provided, verify access
if (query.branchId) {
  await assertBranchAccess(db, session.userId, query.branchId);
}

const conditions = [];
if (query.patientId) conditions.push(eq(dentalInvoices.patientId, query.patientId));
if (query.branchId)  conditions.push(eq(dentalInvoices.branchId, query.branchId));
```

## Intended Behaviour (MODULE_SPEC §6)

All billing workflows operate within a branch context.  The MODULE_SPEC
lists `all dental roles` as viewers but does not define a cross-branch
aggregate view.  Comparable list endpoints (`listDentalVisits`,
`listDentalPatients`, `listPatientImages`) all require `branchId` and
return 400 when it is absent.

## Fix Strategy

**Require `branchId`** — if absent return `400 VALIDATION_ERROR` before
touching the database.  This matches the established pattern in the codebase
and is the safest fix because it:

1. Eliminates the data-leak with a single guard.
2. Does not require introducing a "get accessible branches" helper that
   could itself be misused.
3. Aligns with every other list endpoint in the dental module.

## Files Changed

| File | Change |
|------|--------|
| `services/api-ts/src/handlers/dental-billing/listDentalInvoices.ts` | Require `branchId`; 400 when absent |
| `services/api-ts/src/handlers/dental-billing/dental-billing.test.ts` | Add RED→GREEN tests for EM-BIL-001 |

## TDD Sequence

1. Write failing tests (RED): omit `branchId` → expect `400`; wrong branch → expect `403`.
2. Apply fix (GREEN): add guard at top of handler.
3. Verify all existing tests still pass.

## Acceptance Criteria

- `GET /dental/billing/invoices` (no `branchId`) → `400` with `{ error: "branchId is required" }`.
- `GET /dental/billing/invoices?branchId=<other-branch>` (user not a member) → `403`.
- `GET /dental/billing/invoices?branchId=<own-branch>` (authenticated member) → `200` with scoped data.
- All pre-existing `listDentalInvoices` tests continue to pass.
