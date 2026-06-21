/**
 * getInvoice handler tests — REAL handler via buildTestApp.
 *
 * Previously this file built a bespoke Hono app and RE-IMPLEMENTED the authz in
 * an inline wrapper, so getInvoice.ts:70-73 could regress green (vacuous). It now
 * drives the real generated route (authMiddleware -> zValidator -> getInvoice) and
 * mocks ONLY the two repo seams the handler touches, so the assertions bind to the
 * production authz. Closes billing-getinvoice-real-handler-authz-untested.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { buildTestApp } from '@/tests/helpers/test-app';

// Real UUIDs — the generated GetInvoiceParams validator (UUIDSchema) 400s
// non-UUID ids before the handler, unlike the old vacuous local route.
const INVOICE_ID    = '11111111-1111-4111-8111-111111111111';
const MERCHANT_ID   = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID   = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444';

const fakeInvoice = {
  id: INVOICE_ID,
  invoiceNumber: 'INV-2026-000001',
  customer: CUSTOMER_ID,
  merchant: MERCHANT_ID,
  context: 'booking:123',
  status: 'open' as const,
  subtotal: 10000,
  tax: 800,
  total: 10800,
  currency: 'USD',
  paymentCaptureMethod: 'automatic' as const,
  paymentDueAt: null,
  paymentStatus: null,
  paidAt: null,
  paidBy: null,
  voidedAt: null,
  voidedBy: null,
  voidThresholdMinutes: null,
  authorizedAt: null,
  authorizedBy: null,
  merchantAccount: null,
  metadata: null,
  lineItems: [
    { description: 'Consultation', quantity: 1, unitPrice: 10000, amount: 10000, metadata: null },
  ],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  version: 1,
  createdBy: MERCHANT_ID,
  updatedBy: null,
};

// ── repo seams (declared before the handler is imported via buildTestApp) ──────
const mockFindOneWithLineItems = mock((_id: string) => Promise.resolve(fakeInvoice as any));
mock.module('@/handlers/billing/repos/billing.repo', () => ({
  InvoiceRepository: class {
    findOneWithLineItems = mockFindOneWithLineItems;
  },
}));

const mockFindBillingParty = mock((_db: unknown, personId: string) =>
  Promise.resolve(personId ? ({ id: personId, firstName: 'T', lastName: 'U' } as any) : null),
);
mock.module('@/handlers/person/repos/person-billing.facade', () => ({
  findBillingParty: mockFindBillingParty,
}));

function appFor(user: { id: string; role?: string } | null) {
  return buildTestApp({ db: {} as any, user: user ?? undefined });
}

describe('GET /billing/invoices/:invoice — real-handler authz', () => {
  beforeEach(() => {
    mockFindOneWithLineItems.mockClear();
    mockFindOneWithLineItems.mockImplementation(() => Promise.resolve(fakeInvoice as any));
    mockFindBillingParty.mockClear();
    mockFindBillingParty.mockImplementation((_db: unknown, personId: string) =>
      Promise.resolve(personId ? ({ id: personId, firstName: 'T', lastName: 'U' } as any) : null),
    );
  });

  test('merchant owner -> 200', async () => {
    const res = await appFor({ id: MERCHANT_ID }).request(`/billing/invoices/${INVOICE_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(INVOICE_ID);
    expect(body.merchant).toBe(MERCHANT_ID);
    expect(body.customer).toBe(CUSTOMER_ID);
    expect(body.context).toBe('booking:123');
    expect(body.lineItems).toHaveLength(1);
    expect(body.lineItems[0].description).toBe('Consultation');
  });

  test('customer owner -> 200', async () => {
    const res = await appFor({ id: CUSTOMER_ID }).request(`/billing/invoices/${INVOICE_ID}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).id).toBe(INVOICE_ID);
  });

  test('admin (non-owner) -> 200 — isAdmin branch, not ownership', async () => {
    const res = await appFor({ id: OTHER_USER_ID, role: 'admin' }).request(`/billing/invoices/${INVOICE_ID}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).id).toBe(INVOICE_ID);
  });

  test('foreign user (non-owner, non-admin) -> 403', async () => {
    const res = await appFor({ id: OTHER_USER_ID, role: 'user' }).request(`/billing/invoices/${INVOICE_ID}`);
    expect(res.status).toBe(403);
    expect(((await res.json()) as any).code).toBe('FORBIDDEN');
  });

  test('unauthenticated -> 401', async () => {
    const res = await appFor(null).request(`/billing/invoices/${INVOICE_ID}`);
    expect(res.status).toBe(401);
  });

  test('missing invoice -> 404', async () => {
    mockFindOneWithLineItems.mockImplementation(() => Promise.resolve(null as any));
    const res = await appFor({ id: MERCHANT_ID }).request(`/billing/invoices/${INVOICE_ID}`);
    expect(res.status).toBe(404);
  });

  test('merchant person not found -> 404', async () => {
    mockFindBillingParty.mockImplementation(() => Promise.resolve(null as any));
    const res = await appFor({ id: MERCHANT_ID }).request(`/billing/invoices/${INVOICE_ID}`);
    expect(res.status).toBe(404);
  });

  test('non-UUID id is rejected by the generated validator -> 400', async () => {
    const res = await appFor({ id: MERCHANT_ID }).request('/billing/invoices/not-a-uuid');
    expect(res.status).toBe(400);
  });
});
