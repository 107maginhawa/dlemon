---
slice: GAP-009
phase: audit-full-remediation
agent_skills: [oli-execution-gate]
---

# GAP-009 — Discount Reason + discountedBy on Invoice

## Standard Ref
IDEAL §5.7 BILL-BR-004: "Discounts/write-offs require permission AND reason."

## Problem
`applyDentalDiscount.ts` accepts `reason` via validator but ignores it.
`dentalInvoices` schema has `discountCents` but no `discountReason` or `discountedBy` columns.
Branch-role auth exists; reason audit does not.

## Scope

### Files Modified
- `dental-invoice.schema.ts` — add discountReason text, discountedBy uuid
- `dental-invoice.repo.ts` — add reason + discountedBy to applyDiscount()
- `applyDentalDiscount.ts` — pass body.reason + session.userId; guard empty reason
- `dental-billing.test.ts` — extend with persistence assertions

## Acceptance Criteria

| ID | Description |
|----|-------------|
| AC-001 | discountReason stored in DB and returned in response |
| AC-002 | discountedBy (actor UUID) stored and returned |
| AC-003 | Empty/whitespace-only reason → 422 DISCOUNT_REASON_REQUIRED |
| AC-004 | Non-empty reason passes and is persisted |
| AC-005 | Migration 0057_* generated |
