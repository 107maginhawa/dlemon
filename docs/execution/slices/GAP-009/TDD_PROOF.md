# TDD Proof: GAP-009

## Finding
GAP-009 — `applyDentalDiscount` accepted a `reason` via the validator but neither
persisted it nor recorded the acting user, and the `dental_invoice` table had no
`discount_reason` / `discounted_by` columns. This violated **IDEAL §5.7
BILL-BR-004**: *"Discounts/write-offs require permission AND reason."* Branch-role
permission was enforced; the reason audit trail (reason + actor) was not.

> Backfilled proof artifact (audit finding GAP-009). The feature and its tests
> already exist and pass; this document records the RED→GREEN evidence that was
> not captured at implementation time.

## Acceptance Criteria (from SLICE_SPEC.md)

| ID | Description |
|----|-------------|
| AC-001 | `discountReason` stored in DB and returned in response |
| AC-002 | `discountedBy` (actor UUID) stored and returned |
| AC-003 | Empty/whitespace-only reason → 422 `DISCOUNT_REASON_REQUIRED` |
| AC-004 | Non-empty reason passes and is persisted |
| AC-005 | Migration `0057_*` generated |

## RED Phase

The persistence assertions were added before the schema/repo/handler were wired to
store the reason and actor. Against the pre-fix code they fail because the response
omits `discountReason` / `discountedBy` and an empty reason is not rejected.

| Test (in `dental-billing.test.ts`) | AC | Expected | Actual (pre-fix) | Result |
|------|----|----------|------------------|--------|
| `AC-001/AC-002: discountReason and discountedBy returned after applying discount` | AC-001/002 | body has `discountReason='Senior citizen discount'`, `discountedBy=TEST_USER.id` | both fields `undefined` | FAIL |
| `AC-003: empty reason string → 422 DISCOUNT_REASON_REQUIRED` | AC-003 | 422 + `code='DISCOUNT_REASON_REQUIRED'` | 200 (whitespace accepted) | FAIL |

Both live in the `describe('GAP-009: discount reason and actor persistence', …)`
block at `services/api-ts/src/handlers/dental-billing/dental-billing.test.ts:1543`.

## GREEN Phase

Implementation wired the reason and actor end-to-end:

- **Schema** (`repos/dental-invoice.schema.ts:36-37`): added
  `discountReason: text('discount_reason')` and `discountedBy: uuid('discounted_by')`.
- **Repository** (`repos/dental-invoice.repo.ts:184-198`): `applyDiscount()` signature
  extended with `discountReason` + `discountedBy`, both written in the `.set({ … })`
  update alongside the recomputed `discountCents` / `taxCents` / `totalCents` /
  `balanceCents`.
- **Handler** (`applyDentalDiscount.ts:42-44, 64`): added the empty-reason guard —
  `if (!body.reason?.trim()) throw new BusinessLogicError('Discount reason is required', 'DISCOUNT_REASON_REQUIRED')`
  — then passes `body.reason.trim()` and `session.userId` into `repo.applyDiscount(...)`.
  The applied discount is also audit-logged (`action: 'discount.applied'`,
  `metadata: { percentageRate, reason }`) at `applyDentalDiscount.ts:66-74`.
- **Migration** (`src/generated/migrations/0057_modern_shiver_man.sql`):
  `ALTER TABLE "dental_invoice" ADD COLUMN "discount_reason" text;` and
  `ADD COLUMN "discounted_by" uuid;`.

### Post-fix run

```
cd services/api-ts && \
  DATABASE_URL="postgres://…/monobase_test" \
  bun test src/handlers/dental-billing/dental-billing.test.ts -t "GAP-009"

 2 pass
 0 fail
 5 expect() calls
Ran 2 tests across 1 file. [536.00ms]
```

## Test Coverage

| AC | Covered by | Assertion |
|----|-----------|-----------|
| AC-001 | `AC-001/AC-002: …returned after applying discount` | `expect(body.discountReason).toBe('Senior citizen discount')` |
| AC-002 | same test | `expect(body.discountedBy).toBe(TEST_USER.id)` |
| AC-003 | `AC-003: empty reason string → 422 …` | `expect(res.status).toBe(422)`; `expect(body.code).toBe('DISCOUNT_REASON_REQUIRED')` |
| AC-004 | `AC-001/AC-002` happy path + `applyDentalDiscount handler › returns 200 with updated invoice after discount is applied` (`dental-billing.test.ts:763`) | non-empty reason → 200, totals recomputed |
| AC-005 | filesystem | `0057_modern_shiver_man.sql` present |

Supporting permission coverage (BILL-BR-004 "require permission") in the same file:
`applyDentalDiscount: staff_full → 403` (`:1481`), `dentist_associate → 403 (owner-only)`
(`:1492`), `dentist_owner → not 403` (`:1504`).

## Business Rule

IDEAL §5.7 **BILL-BR-004** — a discount requires both owner permission (enforced via
`assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner'])` at
`applyDentalDiscount.ts:32`) and a non-empty reason, with the reason and acting user
persisted on the invoice for audit.

## Files Referenced

| File | Role |
|------|------|
| `services/api-ts/src/handlers/dental-billing/applyDentalDiscount.ts` | Handler: empty-reason guard, passes reason + actor, audit log |
| `services/api-ts/src/handlers/dental-billing/repos/dental-invoice.repo.ts` | `applyDiscount()` persists `discountReason` + `discountedBy` |
| `services/api-ts/src/handlers/dental-billing/repos/dental-invoice.schema.ts` | `discount_reason` / `discounted_by` columns |
| `services/api-ts/src/handlers/dental-billing/dental-billing.test.ts` | GAP-009 tests (`:1543`) + happy-path/permission tests |
| `services/api-ts/src/generated/migrations/0057_modern_shiver_man.sql` | DDL adding the two columns |
| `docs/execution/slices/GAP-009/SLICE_SPEC.md` | Slice spec / acceptance criteria |
