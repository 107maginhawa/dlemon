# Plan 002: createInvoice honors the request's `tax` instead of hardcoding 0

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP conditions" item occurs, stop and report — do not improvise. When done,
> update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bcb3af6..HEAD -- services/api-ts/src/handlers/billing/createInvoice.ts`
> If the file changed, compare against the "Current state" excerpt before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6bcb3af6`, 2026-06-17

## Why this matters

`createInvoice` computes `const tax = 0` unconditionally (line 119), so every invoice total ignores tax even though the API already accepts a `tax` field and the response already returns one. The OpenAPI contract for the create-invoice body declares `tax?: CurrencyAmount` (optional integer cents), but the handler silently drops it — `total` is always `subtotal`. For any clinic in a sales-tax/VAT jurisdiction, every invoice total is wrong, silently. The minimal correct fix is to honor a caller-supplied `tax` (still defaulting to `0` when omitted), so the field stops being a no-op. This plan deliberately does **not** build a jurisdiction tax engine — it only stops discarding the value the contract already accepts. (If the product decision is that dentalemon is tax-out-of-scope for v1, see the "STOP conditions" — surface that rather than guessing.)

## Current state

- `services/api-ts/src/handlers/billing/createInvoice.ts` — the create-invoice handler.
  - It destructures the validated body (lines 42–52) but **omits `tax`** from the destructure.
  - It computes amounts (lines 104–120):

```ts
  // Calculate amounts (TypeSpec uses integers for cents)
  let subtotal = 0;
  const processedLineItems = lineItems.map((item) => {
    const quantity = item.quantity || 1;
    const amount = quantity * item.unitPrice;
    subtotal += amount;
    return { description: item.description, quantity, unitPrice: item.unitPrice, amount, metadata: item.metadata };
  });

  const tax = 0; // TODO: Calculate tax based on jurisdiction
  const total = subtotal + tax;
```

  - The invoice is then created with `tax: tax || undefined` and `total` (lines 122–139).
- The handler signature is `ctx: ValidatedContext<CreateInvoiceBody, never, never>` (line 31) and reads `const body = ctx.req.valid('json') as CreateInvoiceRequest;` (line 41).
- **The body already permits `tax`**: the generated validator has `tax: z.number().int().gte(0).optional()` (`services/api-ts/src/generated/openapi/validators.ts:18046`), and the TypeSpec source declares it at `specs/api/src/modules/billing.tsp:151` (`tax?: CurrencyAmount;`). `tax` is **integer cents**, `>= 0`. Do NOT edit the generated validator or the TypeSpec — they already support this field.
- Money convention: all amounts are **integer cents** (`unitPrice`, `amount`, `subtotal`, `total`, `tax`). No floats. See the `processedLineItems` math above.

## Commands you will need

| Purpose   | Command (run from `services/api-ts/`)                          | Expected |
|-----------|----------------------------------------------------------------|----------|
| Typecheck | `bun run typecheck`                                            | exit 0   |
| Lint      | `bun run lint`                                                | exit 0   |
| Test      | `bun run scripts/test-with-db.ts src/handlers/billing/createInvoice.test.ts` | all pass |

(Find the actual create-invoice test file first — see Step 2. Run backend tests via `scripts/test-with-db.ts` with explicit **file** args, never a directory.)

## Scope

**In scope**:
- `services/api-ts/src/handlers/billing/createInvoice.ts`
- The create-invoice handler test file (locate in Step 2; create only if none exists).

**Out of scope** (do NOT touch):
- `services/api-ts/src/generated/openapi/validators.ts` and anything under `services/api-ts/src/generated/` — generated; already supports `tax`.
- `specs/api/` TypeSpec — already declares `tax`.
- Any jurisdiction/tax-rate computation, tax tables, or new request fields. This plan honors an existing field only.
- The response-formatting block — it already emits `tax` correctly.

## Git workflow

- Branch: `advisor/002-invoice-tax`.
- Conventional commit, e.g. `fix(billing): createInvoice honors request tax instead of hardcoding 0`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read `tax` from the body, default to 0

In `createInvoice.ts`:

1. Add `tax` to the destructure block (lines 42–52). Because the runtime body is the validated `CreateInvoiceBody` (which includes optional `tax`), read it from `body`. If the local `CreateInvoiceRequest` cast type does not expose `tax`, read it as `const taxInput = (body as { tax?: number }).tax;` rather than widening the cast.

2. Replace line 119 (`const tax = 0; // TODO...`) with:

```ts
  // Honor a caller-supplied tax amount (integer cents, validated >= 0 by the
  // OpenAPI body schema). Defaults to 0 when omitted. NOTE: this does not
  // compute jurisdiction tax — it stops silently discarding the contract's tax
  // field, which previously forced every invoice total to equal its subtotal.
  const tax = taxInput ?? 0;
  const total = subtotal + tax;
```

Keep the existing `tax: tax || undefined` in the `createWithLineItems` call (it stores `undefined` when zero — preserve that behavior).

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Add/extend a test proving tax flows into the total

Locate the existing test:

```
ls services/api-ts/src/handlers/billing/ | grep -i 'createInvoice\|invoice.*test'
grep -rln "createInvoice" services/api-ts/src/handlers/billing/*.test.ts services/api-ts/tests
```

Add a test that creates an invoice with `tax` supplied and asserts `total === subtotal + tax`, plus a regression case asserting that omitting `tax` yields `total === subtotal` (tax defaults to 0). Follow the existing billing test's setup (auth/session stub + `buildTestApp` or the repo's billing test helper at `services/api-ts/tests/helpers/billing.ts`). If a billing E2E flow exists (`services/api-ts/tests/e2e/billing/billing.test.ts`), prefer adding the assertion there if that's where create-invoice is exercised end-to-end.

If **no** create-invoice handler test exists at all, create `services/api-ts/src/handlers/billing/createInvoice.test.ts` modeled on the nearest existing billing handler test (e.g. `payInvoice.test.ts`), covering the two cases above.

**Verify**: run the test file via `bun run scripts/test-with-db.ts <that-file>` → all pass, including the two new cases.

### Step 3: Gates

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

## Test plan

- Cases:
  1. **Happy path with tax**: body `tax: 250` (cents) over a `subtotal` of N → `total === N + 250` and persisted `tax === 250`.
  2. **Regression (default)**: body without `tax` → `total === subtotal`, persisted `tax` is `undefined`/null (unchanged behavior).
- Pattern to follow: nearest existing billing handler test (`payInvoice.test.ts`) or the billing E2E in `tests/e2e/billing/billing.test.ts` + helper `tests/helpers/billing.ts`.
- Verification: `bun run scripts/test-with-db.ts <test-file>` → all pass.

## Done criteria

- [ ] `grep -n "const tax = 0" services/api-ts/src/handlers/billing/createInvoice.ts` returns no matches
- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] The create-invoice test (located/created in Step 2) passes with the two new cases
- [ ] No generated/TypeSpec files modified (`git status` shows nothing under `services/api-ts/src/generated/` or `specs/`)
- [ ] No files outside the in-scope list modified
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back if:

- The "Current state" excerpt doesn't match `createInvoice.ts` (drift).
- The body type genuinely has no `tax` field at runtime (the validator no longer declares it) — then the contract changed; report rather than re-adding it.
- You discover an existing ADR or `docs/` decision stating tax is intentionally out of scope for v1 (search `docs/decisions/` and `docs/architecture/` for "tax"). If so, the correct change is to make the descope explicit (e.g. assert/comment) — STOP and report so the operator chooses, rather than wiring the field.
- Honoring `tax` breaks an existing test that asserted `total === subtotal` with tax supplied (would reveal a contradicting assumption).

## Maintenance notes

- This is intentionally a *pass-through*, not a tax engine. If real jurisdiction tax calculation is added later, it belongs in a dedicated tax service, and this line becomes its call site.
- A reviewer should confirm `tax` is treated as integer cents end-to-end (no `/100` or float math introduced) and that the zero-default path is unchanged.
