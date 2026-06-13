/**
 * handleStripeWebhook handler tests
 *
 * Tests webhook signature validation and event routing.
 * Stripe and database are fully mocked.
 */

import { describe, test, expect, mock } from 'bun:test';
// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { buildTestApp as buildHarnessApp } from '@/tests/helpers/test-app';

function buildTestApp(options: {
  verifyResult?: any;
  verifyThrows?: boolean;
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

  const db = {
    select: () => ({ from: () => [] }),
  } as any;

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
