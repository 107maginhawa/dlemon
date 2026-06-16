/**
 * handleStripeWebhook handler tests
 *
 * Tests webhook signature validation and event routing.
 * Stripe and database are fully mocked.
 */

import { describe, test, expect, mock } from 'bun:test';
// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { buildTestApp as buildHarnessApp } from '@/tests/helpers/test-app';
import { BusinessLogicError } from '@/core/errors';
import { processedWebhookEvents } from './repos/billing.schema';

function buildTestApp(options: {
  verifyResult?: any;
  verifyThrows?: boolean;
  db?: any;
} = {}) {
  const mockBilling = {
    verifyWebhookSignature: mock(async (body: string, sig: string) => {
      if (options.verifyThrows) {
        throw new Error('Invalid signature');
      }
      return options.verifyResult || {
        id: 'evt_test',
        type: 'unknown.event',
        livemode: false,
        data: { object: {} },
      };
    }),
  };

  const mockNotifs = {
    createNotification: mock(async () => ({})),
  };

  // Default db: the idempotency-ledger read returns "not seen" ([]) and the
  // ledger write is a no-op. Deep enough to satisfy `.select().from().where().limit()`
  // and `.insert().values().onConflictDoNothing()` without each test re-specifying it.
  const db =
    options.db ??
    ({
      select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
      insert: () => ({ values: () => ({ onConflictDoNothing: () => Promise.resolve() }) }),
    } as any);

  const app = buildHarnessApp({
    db,
    services: { billing: mockBilling as any, notifs: mockNotifs as any },
  });

  return { app, mockBilling, mockNotifs };
}

describe('handleStripeWebhook', () => {
  test('returns 400 when stripe-signature header is missing', async () => {
    const { app } = buildTestApp();

    const res = await app.request('/billing/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when signature verification fails', async () => {
    const { app } = buildTestApp({ verifyThrows: true });

    const res = await app.request('/billing/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_bad' },
      body: '{}',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 200 for valid webhook with unknown event type', async () => {
    const { app } = buildTestApp({
      verifyResult: {
        id: 'evt_test',
        type: 'some.unknown.event',
        livemode: false,
        data: { object: {} },
      },
    });

    const res = await app.request('/billing/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_valid' },
      body: '{}',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.received).toBe(true);
  });

  test('calls verifyWebhookSignature with raw body and signature', async () => {
    const { app, mockBilling } = buildTestApp();

    await app.request('/billing/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test123' },
      body: 'raw-webhook-body',
    });

    expect(mockBilling.verifyWebhookSignature).toHaveBeenCalledTimes(1);
  });

  // Mirrors InvoiceRepository.findByStripePaymentIntentId's query chain
  // (.select().from().where().limit()); the final call throws `err`.
  const throwingDb = (err: Error) => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => { throw err; } }) }) }),
  });

  const refundEvent = {
    id: 'evt_proc_fail',
    type: 'charge.refunded',
    livemode: false,
    data: { object: { id: 'ch_1', payment_intent: 'pi_1' } },
  };

  test('a BusinessLogicError thrown while processing a valid event is NOT swallowed as 200 — Stripe must retry', async () => {
    // A valid, signature-verified event whose processing throws must NOT return
    // 200: a 200 tells Stripe "handled, do not retry" → the event is lost forever
    // (silent payment loss). It must return a retryable SERVER error (5xx) so
    // Stripe re-delivers. The safe "ignore" cases (missing invoice/metadata)
    // already return early INSIDE the handlers, so they never reach this path.
    // This case pins the exact deleted branch: `if (err instanceof BusinessLogicError) return 200`.
    const { app } = buildTestApp({
      db: throwingDb(new BusinessLogicError('simulated processing failure', 'SIM_PROCESSING_FAILURE')),
      verifyResult: refundEvent,
    });

    const res = await app.request('/billing/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_valid' },
      body: '{}',
    });

    expect(res.status).not.toBe(200); // <-- the silent-loss bug: today this was 200
    expect(res.status).toBeGreaterThanOrEqual(500); // retryable SERVER error, not a 4xx
  });

  test('a generic Error thrown while processing a valid event also returns a retryable 5xx (not 200)', async () => {
    // The realistic production failure mode: repos throw generic Errors /
    // DrizzleQueryErrors, never BusinessLogicError. This guards against a future
    // broad re-swallow (e.g. `if (error instanceof Error) return 200`) that the
    // BusinessLogicError-only case above would not catch.
    const { app } = buildTestApp({
      db: throwingDb(new Error('db connection lost')),
      verifyResult: refundEvent,
    });

    const res = await app.request('/billing/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_valid' },
      body: '{}',
    });

    expect(res.status).not.toBe(200);
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  test('a duplicate (already-processed) event is short-circuited — it is NOT processed again', async () => {
    // Stripe is at-least-once: it can re-deliver an event we already handled. The
    // idempotency ledger must recognize it and SKIP, so side effects (invoice
    // writes, patient/provider notifications) do not fire twice.
    // The ledger read reports the event as already processed; ANY other db read
    // means the handler is wrongly reprocessing, so that branch throws to fail loudly.
    const db = {
      select: () => ({
        from: (tbl: any) =>
          tbl === processedWebhookEvents
            ? { where: () => ({ limit: () => [{ eventId: 'evt_dup' }] }) } // already processed
            : {
                where: () => {
                  throw new Error('reprocessed an already-processed event');
                },
              },
      }),
      insert: () => ({ values: () => ({ onConflictDoNothing: () => Promise.resolve() }) }),
    };

    const { app, mockNotifs } = buildTestApp({
      db,
      verifyResult: {
        id: 'evt_dup',
        type: 'charge.succeeded',
        livemode: false,
        data: { object: { id: 'ch_1', payment_intent: 'pi_1' } },
      },
    });

    const res = await app.request('/billing/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_valid' },
      body: '{}',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.duplicate).toBe(true);
    expect(mockNotifs.createNotification).not.toHaveBeenCalled(); // no double side effects
  });

  test('a first-time event is recorded in the ledger after successful processing', async () => {
    // After a new event is processed, its id is written to the ledger (so a later
    // re-delivery is skipped). Recorded AFTER success — a failed event is never
    // marked, so Stripe's retry still reprocesses it.
    const onConflictDoNothing = mock(() => Promise.resolve());
    const valuesSpy = mock(() => ({ onConflictDoNothing }));
    const insertSpy = mock(() => ({ values: valuesSpy }));
    const db = {
      // Ledger read → not seen ([]); an unknown event type makes no other reads.
      select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
      insert: insertSpy,
    };

    const { app } = buildTestApp({
      db,
      verifyResult: {
        id: 'evt_new',
        type: 'some.unknown.event',
        livemode: false,
        data: { object: {} },
      },
    });

    const res = await app.request('/billing/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_valid' },
      body: '{}',
    });

    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalled(); // event id recorded in the ledger
  });

  test('returns 200 for payment_intent.succeeded event', async () => {
    const { app } = buildTestApp({
      verifyResult: {
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        livemode: false,
        data: {
          object: {
            id: 'pi_test',
            metadata: {},
          },
        },
      },
    });

    const res = await app.request('/billing/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_valid' },
      body: '{}',
    });

    expect(res.status).toBe(200);
  });
});
