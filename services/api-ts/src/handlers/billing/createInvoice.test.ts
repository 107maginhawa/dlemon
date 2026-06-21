/**
 * createInvoice handler tests — REAL handler via buildTestApp.
 *
 * The prior merchant-mismatch test asserted only `>=400` against an EMPTY DB, so
 * findBillingParty returned null and the handler 404'd (merchant-not-found) BEFORE
 * reaching the merchant!==user.id 403 (createInvoice.ts:86-88) — the rule was
 * structurally unreachable (vacuous). Here both persons are mocked to exist so the
 * 403 branch is actually exercised. Closes billing-createinvoice-merchant-authz-vacuous.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';

const USER_ID     = '00000000-0000-4000-8000-000000000001'; // session user == merchant for the 201 case
const OTHER_MERCH = '00000000-0000-4000-8000-0000000000ff'; // a different merchant -> 403
const CUSTOMER_ID = '00000000-0000-4000-8000-000000000002';

// ── seams (declared before buildTestApp import) ──────────────────────────────
// Every party resolves to an existing person, so the two 404 short-circuits
// (merchant-not-found, customer-not-found) cannot fire and the 403 is reachable.
const mockFindBillingParty = mock((_db: unknown, personId: string) =>
  Promise.resolve({ id: personId, firstName: 'P', lastName: 'Q' } as any),
);
mock.module('@/handlers/person/repos/person-billing.facade', () => ({
  findBillingParty: mockFindBillingParty,
}));

const mockFindMany = mock(() => Promise.resolve([] as any[]));
const mockCreateWithLineItems = mock((inv: any, items: any[]) =>
  Promise.resolve({
    id: '00000000-0000-4000-8000-00000000aaaa',
    invoiceNumber: 'INV-2026-000123',
    merchantAccount: null,
    context: inv.context ?? null,
    status: inv.status ?? 'draft',
    subtotal: inv.subtotal,
    tax: inv.tax ?? null,
    total: inv.total,
    currency: inv.currency,
    paymentCaptureMethod: inv.paymentCaptureMethod,
    paymentDueAt: null,
    paymentStatus: null,
    paidAt: null,
    paidBy: null,
    voidedAt: null,
    voidedBy: null,
    voidThresholdMinutes: inv.voidThresholdMinutes ?? null,
    authorizedAt: null,
    authorizedBy: null,
    lineItems: items,
    metadata: inv.metadata ?? null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
  }),
);
mock.module('@/handlers/billing/repos/billing.repo', () => ({
  InvoiceRepository: class {
    findMany = mockFindMany;
    createWithLineItems = mockCreateWithLineItems;
  },
}));

import { buildTestApp } from '@/tests/helpers/test-app';

function post(user: { id: string } | null, body: unknown) {
  return buildTestApp({ db: {} as any, user: user ?? undefined }).request('/billing/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const oneLineItem = [{ description: 'Service', unitPrice: 5000, quantity: 1 }];

describe('createInvoice handler — merchant authorization', () => {
  beforeEach(() => {
    mockFindBillingParty.mockClear();
    mockFindMany.mockClear();
    mockCreateWithLineItems.mockClear();
    mockFindMany.mockImplementation(() => Promise.resolve([]));
  });

  test('merchant != session user -> 403 (both persons exist)', async () => {
    const res = await post({ id: USER_ID }, {
      customer: CUSTOMER_ID,
      merchant: OTHER_MERCH,
      lineItems: oneLineItem,
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.code).toBe('FORBIDDEN');
    // The merchant-mismatch 403 happens BEFORE any write.
    expect(mockCreateWithLineItems).not.toHaveBeenCalled();
  });

  test('merchant == session user -> 201', async () => {
    const res = await post({ id: USER_ID }, {
      customer: CUSTOMER_ID,
      merchant: USER_ID,
      lineItems: oneLineItem,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.merchant).toBe(USER_ID);
    expect(body.status).toBe('draft');
    expect(body.lineItems).toHaveLength(1);
    expect(mockCreateWithLineItems).toHaveBeenCalledTimes(1);
  });

  test('unauthenticated -> 401', async () => {
    const res = await post(null, { customer: CUSTOMER_ID, merchant: USER_ID, lineItems: oneLineItem });
    expect(res.status).toBe(401);
  });

  test('non-UUID merchant rejected by the generated validator -> 400', async () => {
    const res = await post({ id: USER_ID }, { customer: CUSTOMER_ID, merchant: 'not-a-uuid', lineItems: oneLineItem });
    expect(res.status).toBe(400);
  });
});
