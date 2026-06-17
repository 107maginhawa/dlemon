/**
 * markInvoiceUncollectible handler tests
 *
 * Covers:
 *   1. Intent cancelled when stripePaymentIntentId + stripeAccountId present
 *   2. No cancel call when invoice has no stripePaymentIntentId
 *   3. logAuditEvent is called with action 'invoice.mark_uncollectible'
 *   4. cancel failure is non-fatal — handler still returns 200 and writes audit
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';

const INVOICE_ID    = 'f1000000-0000-1000-8000-000000000001';
const MERCHANT_ID   = 'b1000000-0000-1000-8000-000000000001';
const CUSTOMER_ID   = 'a1000000-0000-1000-8000-000000000001';
const INTENT_ID     = 'pi_test_intent_123';
const STRIPE_ACCT   = 'acct_test_stripe_456';

// ─── repo mocks (must be declared before import of handler) ──────────────────

const mockFindOneById          = mock(() => Promise.resolve(null as any));
const mockUpdateStatus         = mock(() => Promise.resolve());
const mockFindOneWithLineItems = mock(() => Promise.resolve(null as any));
const mockMerchantFindByPerson = mock(() => Promise.resolve(null as any));
const mockMerchantFindOnePerson= mock(() => Promise.resolve(null as any));

mock.module('@/handlers/billing/repos/billing.repo', () => ({
  InvoiceRepository: class {
    findOneById          = mockFindOneById;
    updateStatus         = mockUpdateStatus;
    findOneWithLineItems = mockFindOneWithLineItems;
  },
  MerchantAccountRepository: class {
    findByPerson = mockMerchantFindByPerson;
  },
}));

mock.module('@/handlers/person/repos/person-billing.facade', () => ({
  findBillingParty: mock(() => Promise.resolve({ id: MERCHANT_ID })),
}));

// ─── audit-logger mock ───────────────────────────────────────────────────────

const mockLogAuditEvent = mock(() => Promise.resolve());
mock.module('@/core/audit-logger', () => ({
  logAuditEvent: mockLogAuditEvent,
}));

// ─── import handler AFTER mocks ──────────────────────────────────────────────

const { markInvoiceUncollectible } = await import('./markInvoiceUncollectible');

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeInvoice(opts: { stripePaymentIntentId?: string } = {}) {
  return {
    id: INVOICE_ID,
    invoiceNumber: 'INV-2026-000099',
    merchant: MERCHANT_ID,
    customer: CUSTOMER_ID,
    status: 'open',
    paymentStatus: 'requires_capture',
    subtotal: 10000,
    tax: null,
    total: 10000,
    currency: 'USD',
    paymentCaptureMethod: 'manual',
    paymentDueAt: null,
    paidAt: null,
    paidBy: null,
    voidedAt: null,
    voidedBy: null,
    voidThresholdMinutes: null,
    authorizedAt: null,
    authorizedBy: null,
    context: null,
    metadata: opts.stripePaymentIntentId
      ? { stripePaymentIntentId: opts.stripePaymentIntentId }
      : null,
    lineItems: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeMerchantAccount(opts: { stripeAccountId?: string } = {}) {
  return {
    id: 'mac-1',
    personId: MERCHANT_ID,
    metadata: opts.stripeAccountId ? { stripeAccountId: opts.stripeAccountId } : null,
  };
}

function buildApp(opts: {
  billing?: object;
  notifs?: object;
} = {}) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message }, err.statusCode as any);
    return c.json({ error: String(err) }, 500);
  });
  app.use('*', async (c, next) => {
    (c as any).set('database', {});
    (c as any).set('logger', {
      debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
    });
    (c as any).set('session', { user: { id: MERCHANT_ID } });
    if (opts.billing) (c as any).set('billing', opts.billing);
    if (opts.notifs)  (c as any).set('notifs',  opts.notifs);
    await next();
  });
  app.post('/invoices/:invoice/mark-uncollectible', async (c) => {
    (c.req as any).valid = (key: string) =>
      key === 'param' ? { invoice: INVOICE_ID } : undefined;
    return markInvoiceUncollectible(c as any);
  });
  return app;
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('markInvoiceUncollectible handler', () => {
  const cancelPaymentIntent = mock(() => Promise.resolve({ id: 'pi_canceled' }));

  beforeEach(() => {
    mockFindOneById.mockClear();
    mockUpdateStatus.mockClear();
    mockFindOneWithLineItems.mockClear();
    mockMerchantFindByPerson.mockClear();
    mockLogAuditEvent.mockClear();
    cancelPaymentIntent.mockClear();

    // Default: invoice exists, merchant lookup returns same person, invoice-with-items returns full object
    mockFindOneById.mockImplementation(() =>
      Promise.resolve(makeInvoice({ stripePaymentIntentId: INTENT_ID }))
    );
    mockFindOneWithLineItems.mockImplementation(() =>
      Promise.resolve(makeInvoice({ stripePaymentIntentId: INTENT_ID }))
    );
    mockMerchantFindByPerson.mockImplementation(() =>
      Promise.resolve(makeMerchantAccount({ stripeAccountId: STRIPE_ACCT }))
    );
  });

  test('cancels payment intent when stripePaymentIntentId and stripeAccountId present', async () => {
    const app = buildApp({ billing: { cancelPaymentIntent } });

    const res = await app.request(`/invoices/${INVOICE_ID}/mark-uncollectible`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(cancelPaymentIntent).toHaveBeenCalledTimes(1);
    const [intentId, acctId, reason] = cancelPaymentIntent.mock.calls[0] as any[];
    expect(intentId).toBe(INTENT_ID);
    expect(acctId).toBe(STRIPE_ACCT);
    expect(reason).toBe('Marked uncollectible');
  });

  test('does not call cancelPaymentIntent when invoice has no stripePaymentIntentId', async () => {
    // Override to invoice with no stripe intent
    mockFindOneById.mockImplementation(() =>
      Promise.resolve(makeInvoice())  // no stripePaymentIntentId
    );
    mockFindOneWithLineItems.mockImplementation(() =>
      Promise.resolve(makeInvoice())
    );

    const app = buildApp({ billing: { cancelPaymentIntent } });

    const res = await app.request(`/invoices/${INVOICE_ID}/mark-uncollectible`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(cancelPaymentIntent).not.toHaveBeenCalled();
  });

  test('logAuditEvent is called with action invoice.mark_uncollectible', async () => {
    const app = buildApp({ billing: { cancelPaymentIntent } });

    const res = await app.request(`/invoices/${INVOICE_ID}/mark-uncollectible`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    const [_db, _logger, event, opts] = mockLogAuditEvent.mock.calls[0] as any[];
    expect(event.action).toBe('invoice.mark_uncollectible');
    expect(event.resourceType).toBe('invoice');
    expect(event.resourceId).toBe(INVOICE_ID);
    expect(event.before).toEqual({ status: 'open' });
    expect(event.after).toEqual({ status: 'uncollectible' });
    expect(opts?.failClosed).toBe(true);
  });

  test('cancel failure is non-fatal — returns 200 and still writes audit row', async () => {
    const failingCancel = mock(() => Promise.reject(new Error('Stripe error')));
    const app = buildApp({ billing: { cancelPaymentIntent: failingCancel } });

    const res = await app.request(`/invoices/${INVOICE_ID}/mark-uncollectible`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    // The failing cancel was tried
    expect(failingCancel).toHaveBeenCalledTimes(1);
    // Audit was still written despite the cancel failure
    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    const [_db, _logger, event] = mockLogAuditEvent.mock.calls[0] as any[];
    expect(event.action).toBe('invoice.mark_uncollectible');
  });
});
