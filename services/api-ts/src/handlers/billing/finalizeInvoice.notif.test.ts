/**
 * finalizeInvoice — notification trigger test (AC-NOTIF-02)
 *
 * Verifies notifs.createNotification is called with type 'billing'
 * after a successful invoice finalization.
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';

const INVOICE_ID = 'f0000000-0000-1000-8000-000000000001';
const MERCHANT_ID = 'b0000000-0000-1000-8000-000000000001';
const CUSTOMER_ID = 'a0000000-0000-1000-8000-000000000001';

const mockFindOneById = mock(() => Promise.resolve({
  id: INVOICE_ID, invoiceNumber: 'INV-2026-000001',
  merchant: MERCHANT_ID, customer: CUSTOMER_ID,
  status: 'draft', total: 5000, currency: 'USD',
}));
const mockFindOneById2 = mock(() => Promise.resolve({ id: MERCHANT_ID }));
const mockUpdateStatus = mock(() => Promise.resolve());
const mockFindOneWithLineItems = mock(() => Promise.resolve({
  id: INVOICE_ID, invoiceNumber: 'INV-2026-000001',
  merchant: MERCHANT_ID, customer: CUSTOMER_ID,
  status: 'open', subtotal: 5000, tax: null, total: 5000,
  currency: 'USD', paymentCaptureMethod: 'automatic',
  paymentDueAt: null, paymentStatus: null, paidAt: null, paidBy: null,
  voidedAt: null, voidedBy: null, voidThresholdMinutes: null,
  authorizedAt: null, authorizedBy: null, context: null, metadata: null,
  lineItems: [],
  createdAt: new Date(), updatedAt: new Date(),
}));

mock.module('@/handlers/billing/repos/billing.repo', () => ({
  InvoiceRepository: class {
    findOneById = mockFindOneById;
    updateStatus = mockUpdateStatus;
    findOneWithLineItems = mockFindOneWithLineItems;
  },
}));
mock.module('@/handlers/person/repos/person.repo', () => ({
  PersonRepository: class {
    findOneById = mockFindOneById2;
  },
}));

const { finalizeInvoice } = await import('./finalizeInvoice');

function buildApp(notifs?: object) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message }, err.statusCode as any);
    return c.json({ error: String(err) }, 500);
  });
  app.use('*', async (c, next) => {
    (c as any).set('database', {});
    (c as any).set('logger', { debug:()=>{}, info:()=>{}, warn:()=>{}, error:()=>{} });
    (c as any).set('session', { user: { id: MERCHANT_ID } });
    if (notifs) (c as any).set('notifs', notifs);
    await next();
  });
  app.post('/invoices/:invoice/finalize', async (c) => {
    // Inject validated param manually (bypasses generated validator for unit test isolation)
    (c.req as any).valid = (key: string) => key === 'param' ? { invoice: INVOICE_ID } : undefined;
    return finalizeInvoice(c as any);
  });
  return app;
}

describe('finalizeInvoice — notification trigger (AC-NOTIF-02)', () => {
  beforeEach(() => {
    mockFindOneById.mockClear();
    mockUpdateStatus.mockClear();
    mockFindOneWithLineItems.mockClear();
  });

  test('calls notifs.createNotification with billing type on success', async () => {
    const createNotification = mock(() => Promise.resolve({ id: 'notif-1' }));
    const app = buildApp({ createNotification });

    const res = await app.request(`/invoices/${INVOICE_ID}/finalize`, { method: 'POST' });

    expect(res.status).toBe(200);
    await Promise.resolve();
    expect(createNotification).toHaveBeenCalledTimes(1);
    const [req] = createNotification.mock.calls[0] as any[];
    expect(req.type).toBe('billing');
    expect(req.channel).toBe('in-app');
    expect(req.recipient).toBe(CUSTOMER_ID);
    expect(req.relatedEntityType).toBe('invoice');
  });

  test('does not throw when notifs service is absent', async () => {
    const app = buildApp(undefined);
    const res = await app.request(`/invoices/${INVOICE_ID}/finalize`, { method: 'POST' });
    expect(res.status).toBe(200);
  });
});
