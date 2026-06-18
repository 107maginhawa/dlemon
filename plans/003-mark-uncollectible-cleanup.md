# Plan 003: markInvoiceUncollectible performs its cleanup (cancel intent, audit, notify)

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the expected result before moving on. On any "STOP conditions"
> item, stop and report — do not improvise. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 6bcb3af6..HEAD -- services/api-ts/src/handlers/billing/markInvoiceUncollectible.ts services/api-ts/src/handlers/billing/voidInvoice.ts`
> If either changed, compare against the excerpts below before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6bcb3af6`, 2026-06-17

## Why this matters

`markInvoiceUncollectible` flips the invoice status to `uncollectible` and returns 200, but its post-update cleanup is a 4-line `TODO` that never executes (`markInvoiceUncollectible.ts:93-97`). Concretely: (1) if an authorized Stripe payment intent exists, it is **not** cancelled — the authorization hold is left orphaned on the customer's card; (2) **no audit row** is written for a financially-significant state change (the rest of the billing module audits such events); (3) the customer is **not notified**. The sibling `voidInvoice` handler already does the intent-cancel correctly — this plan brings the same rigor to the uncollectible path. "Update accounting records" from the TODO is **explicitly deferred** (there is no accounting subsystem in this repo; folding the event into the audit trail is the right amount of work now).

## Current state

- `services/api-ts/src/handlers/billing/markInvoiceUncollectible.ts` — handler. After auth + status checks it does (lines 87–97):

```ts
  // Update invoice status to uncollectible
  await invoiceRepo.updateStatus(invoiceId, 'uncollectible', user.id);
  const invoiceWithItems = await invoiceRepo.findOneWithLineItems(invoiceId);
  if (!invoiceWithItems) throw new NotFoundError('Invoice not found after update');
  const updatedInvoice = invoiceWithItems;

  // TODO: Trigger any necessary cleanup:
  // - Cancel pending payment intents
  // - Update accounting records
  // - Send notifications
  // - Create audit log entries
```

  The handler context is `ValidatedContext<never, never, MarkInvoiceUncollectibleParams>`; it currently gets `database`, `logger`, `session`. It does **not** yet get `billing` or `notifs`.

- **Exemplar — Stripe intent cancel** (`voidInvoice.ts:91-131`, copy this shape):

```ts
  const billing = ctx.get('billing');                       // top of handler
  // ...
  const invoiceMetadata = invoice.metadata as InvoiceMetadata | undefined;
  const stripePaymentIntentId = invoiceMetadata?.stripePaymentIntentId;
  // merchant account → Stripe connected account id:
  const merchantAccountRepo = new MerchantAccountRepository(database, logger);
  const merchantAccount = await merchantAccountRepo.findByPerson(invoice.merchant);
  const merchantMeta = merchantAccount?.metadata as MerchantMetadata | undefined;
  // cancel:
  await billing.cancelPaymentIntent(stripePaymentIntentId, merchantMeta.stripeAccountId, 'Marked uncollectible');
```

  Types `InvoiceMetadata` / `MerchantMetadata` are imported from `./billing.types` (see `voidInvoice.ts:13`). `InvoiceMetadata.stripePaymentIntentId?: string` (`billing.types.ts:7`). `MerchantAccountRepository` is exported from `./repos/billing.repo` (`voidInvoice.ts:11`).

- **Exemplar — audit log, fail-closed** (`dental-org/updateMember.ts:99-111`): `logAuditEvent(db, logger, { personId, tenantId, branchId?, eventType, actorRole, action, resourceType, resourceId, before, after }, { failClosed: true })`. Imported from `@/core/audit-logger`. `failClosed: true` rethrows on audit-write failure so the operation can't silently commit without a trail.

- **Exemplar — best-effort notification** (`finalizeInvoice.ts:138-147`):

```ts
  const notifs = ctx.get('notifs') as NotificationService | undefined;   // top of handler
  notifs?.createNotification({
    recipient: updatedInvoice.customer,
    type: 'billing',
    channel: 'in-app',
    title: 'Invoice written off',
    message: `Invoice ${updatedInvoice.invoiceNumber} has been marked uncollectible`,
    relatedEntityType: 'invoice',
    relatedEntity: updatedInvoice.id,
  }).catch(() => {/* non-blocking */});
```

  `NotificationService` type import: `import type { NotificationService } from '@/core/notifs';` (see `finalizeInvoice.ts:16`).

- Money is integer cents. The invoice here is in `open` state with `paymentStatus !== 'succeeded'` (guaranteed by the existing checks at lines 71–85).

## Commands you will need

| Purpose   | Command (from `services/api-ts/`)                                           | Expected |
|-----------|------------------------------------------------------------------------------|----------|
| Typecheck | `bun run typecheck`                                                          | exit 0   |
| Lint      | `bun run lint`                                                              | exit 0   |
| Test      | `bun run scripts/test-with-db.ts src/handlers/billing/markInvoiceUncollectible.test.ts` | all pass |

## Scope

**In scope**:
- `services/api-ts/src/handlers/billing/markInvoiceUncollectible.ts`
- `services/api-ts/src/handlers/billing/markInvoiceUncollectible.test.ts` (create if absent; otherwise extend)

**Out of scope** (do NOT touch):
- `voidInvoice.ts`, `finalizeInvoice.ts`, `updateMember.ts` — exemplars only; read, don't modify.
- `core/billing.ts`, `core/notifs.ts`, `core/audit-logger.ts` — consume their existing APIs; do not change them.
- Any "accounting records" integration — explicitly deferred (no accounting module exists). Leave a one-line comment noting the deferral; do not build it.
- The response-formatting block (lines 108–140) — unchanged.

## Git workflow

- Branch: `advisor/003-uncollectible-cleanup`.
- Conventional commit, e.g. `fix(billing): markInvoiceUncollectible cancels intent, audits, notifies`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Wire `billing` and `notifs` into the handler context reads

At the top of `markInvoiceUncollectible` (near the existing `const database = ctx.get('database')`), add `const billing = ctx.get('billing');` and `const notifs = ctx.get('notifs') as NotificationService | undefined;`. Add the imports: `NotificationService` from `@/core/notifs`, `MerchantAccountRepository` from `./repos/billing.repo`, and `InvoiceMetadata`/`MerchantMetadata` from `./billing.types`.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Replace the TODO with real cleanup

Replace lines 93–97 (the TODO block) with cleanup that runs after the status update. Target shape:

```ts
  // 1) Cancel an orphaned Stripe authorization, if one exists (best-effort —
  //    mirrors voidInvoice). An uncollectible invoice should not leave an
  //    authorization hold on the customer's card.
  const invoiceMeta = invoice.metadata as InvoiceMetadata | undefined;
  const stripePaymentIntentId = invoiceMeta?.stripePaymentIntentId;
  if (stripePaymentIntentId) {
    try {
      const merchantAccountRepo = new MerchantAccountRepository(database, logger);
      const merchantAccount = await merchantAccountRepo.findByPerson(invoice.merchant);
      const merchantMeta = merchantAccount?.metadata as MerchantMetadata | undefined;
      if (merchantMeta?.stripeAccountId) {
        await billing.cancelPaymentIntent(stripePaymentIntentId, merchantMeta.stripeAccountId, 'Marked uncollectible');
      }
    } catch (err) {
      // Non-fatal: the invoice is already uncollectible. Log and continue —
      // the audit row below records the write-off regardless.
      logger.warn({ err, invoiceId, stripePaymentIntentId }, 'Failed to cancel payment intent on uncollectible');
    }
  }

  // 2) Audit the write-off (fail-closed: a financial state change must not
  //    commit without an audit row). Accounting-system reconciliation is
  //    deferred — no accounting subsystem exists in this codebase yet.
  await logAuditEvent(db_or_database, logger, {
    personId: user.id,
    tenantId: updatedInvoice.merchant,
    eventType: 'data-modification',
    actorRole: 'provider',
    action: 'invoice.mark_uncollectible',
    resourceType: 'invoice',
    resourceId: invoiceId,
    before: { status: 'open' },
    after: { status: 'uncollectible' },
  }, { failClosed: true });

  // 3) Notify the customer (best-effort, non-blocking).
  notifs?.createNotification({
    recipient: updatedInvoice.customer,
    type: 'billing',
    channel: 'in-app',
    title: 'Invoice written off',
    message: `Invoice ${updatedInvoice.invoiceNumber} has been marked uncollectible`,
    relatedEntityType: 'invoice',
    relatedEntity: updatedInvoice.id,
  }).catch(() => {/* non-blocking */});
```

Use the handler's actual database variable name in the `logAuditEvent` call (this handler names it `database`, not `db` — replace the `db_or_database` placeholder accordingly). Import `logAuditEvent` from `@/core/audit-logger`.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Tests

Create/extend `markInvoiceUncollectible.test.ts`. Use the nearest billing handler test as the structural pattern (e.g. `voidInvoice.test.ts` if present, else `payInvoice.test.ts`) — they stub `ctx.get('billing')`, `ctx.get('notifs')`, and the session. Cover:
- **Intent cancelled**: invoice with `metadata.stripePaymentIntentId` set and a merchant account with `stripeAccountId` → `billing.cancelPaymentIntent` is called once with that intent id; response is 200.
- **No intent → no cancel**: invoice without `stripePaymentIntentId` → `cancelPaymentIntent` NOT called; still 200.
- **Audit written**: `logAuditEvent` (or the audit spy) is invoked with `action: 'invoice.mark_uncollectible'`.
- **Cancel failure is non-fatal**: `cancelPaymentIntent` throws → handler still returns 200 and still writes the audit row.

**Verify**: `bun run scripts/test-with-db.ts src/handlers/billing/markInvoiceUncollectible.test.ts` → all pass.

### Step 4: Gates

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

## Test plan

- File: `services/api-ts/src/handlers/billing/markInvoiceUncollectible.test.ts`.
- Cases: the four bullets in Step 3 (intent-cancel happy path, no-intent skip, audit-written, cancel-failure-non-fatal).
- Pattern: nearest existing billing handler test (`voidInvoice.test.ts` / `payInvoice.test.ts`).
- Verification: the `test-with-db.ts` run above passes including the new cases.

## Done criteria

- [ ] `grep -n "TODO: Trigger any necessary cleanup" services/api-ts/src/handlers/billing/markInvoiceUncollectible.ts` returns no matches
- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] The test file passes with the 4 new cases
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report if:

- The "Current state" excerpt doesn't match the handler (drift).
- `ctx.get('billing')` or `ctx.get('notifs')` is not available in this handler's context type and cannot be added the way `voidInvoice`/`finalizeInvoice` do it.
- `billing.cancelPaymentIntent` has a different signature than the 3-arg `(intentId, stripeAccountId, reason)` used in `voidInvoice.ts:127-131` — report the actual signature.
- `logAuditEvent` rejects the event shape (different required fields than `updateMember.ts:99-111`) — report the actual type from `core/audit-logger.ts`.
- Writing the fail-closed audit causes an existing test to fail because no audit infra is stubbed — report it; do NOT downgrade `failClosed` to silence it.

## Maintenance notes

- "Accounting records" is intentionally deferred — when an accounting/ledger integration lands, this handler is one of its call sites (alongside `voidInvoice`, refunds).
- Reviewer should confirm: the audit is `failClosed: true` (financial event), the Stripe cancel is best-effort (never blocks the write-off), and the notification is non-blocking.
- The narrow concurrency window noted on the Stripe webhook (notifications not yet dedup-keyed) applies here too if the customer is later double-notified — out of scope, tracked elsewhere.
