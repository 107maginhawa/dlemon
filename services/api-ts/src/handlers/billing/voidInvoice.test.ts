/**
 * voidInvoice (BASE billing) handler tests — REAL handler via buildTestApp.
 *
 * The base /billing/invoices/:invoice/void route had NO test at any layer (only
 * the separate dental-billing void is covered; billing-lifecycle.hurl skips void).
 * This pins all six money-state guards by their discriminating error code so a
 * dropped/weakened guard fails. Closes billing-voidinvoice-guard-branches-untested.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';

const INVOICE_ID    = 'f1000000-0000-1000-8000-000000000001';
const MERCHANT_ID   = 'b1000000-0000-1000-8000-000000000001';
const CUSTOMER_ID   = 'a1000000-0000-1000-8000-000000000001';
const OTHER_USER_ID = 'c1000000-0000-1000-8000-000000000001';
const INTENT_ID     = 'pi_test_intent_123';
const STRIPE_ACCT   = 'acct_test_456';

// ── repo + facade seams (declared before buildTestApp import) ─────────────────
const mockFindOneById        = mock(() => Promise.resolve(null as any));
const mockUpdateOneById      = mock(() => Promise.resolve());
const mockMerchantFindByPerson = mock(() => Promise.resolve(null as any));
mock.module('@/handlers/billing/repos/billing.repo', () => ({
  InvoiceRepository: class {
    findOneById   = mockFindOneById;
    updateOneById = mockUpdateOneById;
  },
  MerchantAccountRepository: class {
    findByPerson = mockMerchantFindByPerson;
  },
}));

const mockFindBillingParty = mock((_db: unknown, personId: string) =>
  Promise.resolve({ id: personId } as any),
);
mock.module('@/handlers/person/repos/person-billing.facade', () => ({
  findBillingParty: mockFindBillingParty,
}));

import { buildTestApp } from '@/tests/helpers/test-app';

function makeInvoice(opts: {
  paymentStatus?: string | null;
  providerDecision?: string;
  stripePaymentIntentId?: string | null;
} = {}) {
  const metadata: Record<string, unknown> = {};
  if (opts.stripePaymentIntentId !== null) {
    metadata['stripePaymentIntentId'] = opts.stripePaymentIntentId ?? INTENT_ID;
  }
  if (opts.providerDecision) metadata['providerDecision'] = opts.providerDecision;
  return {
    id: INVOICE_ID,
    invoiceNumber: 'INV-2026-000099',
    merchant: MERCHANT_ID,
    customer: CUSTOMER_ID,
    context: null,
    status: 'open',
    paymentStatus: opts.paymentStatus === undefined ? 'requires_capture' : opts.paymentStatus,
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
    metadata: Object.keys(metadata).length ? metadata : null,
    lineItems: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

const cancelPaymentIntent = mock(() => Promise.resolve({ id: 'pi_canceled', status: 'canceled' }));

function voidReq(user: { id: string; role?: string } | null) {
  return buildTestApp({
    db: {} as any,
    user: user ?? undefined,
    services: { billing: { cancelPaymentIntent } as any },
  }).request(`/billing/invoices/${INVOICE_ID}/void`, { method: 'POST' });
}

describe('voidInvoice (base) — money-state guards', () => {
  beforeEach(() => {
    mockFindOneById.mockClear();
    mockUpdateOneById.mockClear();
    mockMerchantFindByPerson.mockClear();
    mockFindBillingParty.mockClear();
    cancelPaymentIntent.mockClear();
    // defaults: eligible invoice + merchant account with stripe id
    mockFindOneById.mockImplementation(() => Promise.resolve(makeInvoice()));
    mockMerchantFindByPerson.mockImplementation(() =>
      Promise.resolve({ id: 'mac-1', personId: MERCHANT_ID, metadata: { stripeAccountId: STRIPE_ACCT } }),
    );
    mockFindBillingParty.mockImplementation((_db: unknown, personId: string) =>
      Promise.resolve({ id: personId }),
    );
  });

  test('happy path: requires_capture -> 200, cancels intent + writes void', async () => {
    const res = await voidReq({ id: MERCHANT_ID });
    expect(res.status).toBe(200);
    expect(cancelPaymentIntent).toHaveBeenCalledTimes(1);
    const [intentId, acctId, reason] = cancelPaymentIntent.mock.calls[0] as any[];
    expect(intentId).toBe(INTENT_ID);
    expect(acctId).toBe(STRIPE_ACCT);
    expect(reason).toBe('Voided by provider');
    expect(mockUpdateOneById).toHaveBeenCalledTimes(1);
    const [, patch] = mockUpdateOneById.mock.calls[0] as any[];
    expect(patch.paymentStatus).toBe('canceled');
    expect(patch.status).toBe('void');
    expect(patch.voidedAt).toBeInstanceOf(Date);
    expect(patch.metadata.providerDecision).toBe('void');
  });

  test('foreign non-admin merchant -> 403', async () => {
    mockFindBillingParty.mockImplementation(() => Promise.resolve({ id: OTHER_USER_ID }));
    const res = await voidReq({ id: OTHER_USER_ID });
    expect(res.status).toBe(403);
    expect(((await res.json()) as any).code).toBe('FORBIDDEN');
    expect(cancelPaymentIntent).not.toHaveBeenCalled();
  });

  test('already voided (canceled) -> 409 CONFLICT', async () => {
    mockFindOneById.mockImplementation(() => Promise.resolve(makeInvoice({ paymentStatus: 'canceled' })));
    const res = await voidReq({ id: MERCHANT_ID });
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).code).toBe('CONFLICT');
    expect(cancelPaymentIntent).not.toHaveBeenCalled();
  });

  test('already captured (succeeded) -> 409 CONFLICT', async () => {
    mockFindOneById.mockImplementation(() => Promise.resolve(makeInvoice({ paymentStatus: 'succeeded' })));
    const res = await voidReq({ id: MERCHANT_ID });
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).code).toBe('CONFLICT');
    expect(cancelPaymentIntent).not.toHaveBeenCalled();
  });

  test('not authorized (open) -> 422 PAYMENT_NOT_AUTHORIZED', async () => {
    mockFindOneById.mockImplementation(() => Promise.resolve(makeInvoice({ paymentStatus: 'open' })));
    const res = await voidReq({ id: MERCHANT_ID });
    expect(res.status).toBe(422);
    expect(((await res.json()) as any).code).toBe('PAYMENT_NOT_AUTHORIZED');
    expect(cancelPaymentIntent).not.toHaveBeenCalled();
  });

  test('not authorized (null status) -> 422 PAYMENT_NOT_AUTHORIZED', async () => {
    mockFindOneById.mockImplementation(() => Promise.resolve(makeInvoice({ paymentStatus: null })));
    const res = await voidReq({ id: MERCHANT_ID });
    expect(res.status).toBe(422);
    expect(((await res.json()) as any).code).toBe('PAYMENT_NOT_AUTHORIZED');
  });

  test('provider decision already made -> 409 CONFLICT', async () => {
    mockFindOneById.mockImplementation(() => Promise.resolve(makeInvoice({ providerDecision: 'capture' })));
    const res = await voidReq({ id: MERCHANT_ID });
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).code).toBe('CONFLICT');
    expect(cancelPaymentIntent).not.toHaveBeenCalled();
  });

  test('no payment intent -> 422 PAYMENT_INTENT_MISSING', async () => {
    mockFindOneById.mockImplementation(() => Promise.resolve(makeInvoice({ stripePaymentIntentId: null })));
    const res = await voidReq({ id: MERCHANT_ID });
    expect(res.status).toBe(422);
    expect(((await res.json()) as any).code).toBe('PAYMENT_INTENT_MISSING');
    expect(cancelPaymentIntent).not.toHaveBeenCalled();
  });

  test('invoice not found -> 404', async () => {
    mockFindOneById.mockImplementation(() => Promise.resolve(null));
    const res = await voidReq({ id: MERCHANT_ID });
    expect(res.status).toBe(404);
  });

  test('admin foreign user bypasses merchant check -> 200', async () => {
    const res = await voidReq({ id: OTHER_USER_ID, role: 'admin' });
    expect(res.status).toBe(200);
    expect(cancelPaymentIntent).toHaveBeenCalledTimes(1);
  });

  test('unauthenticated -> 401', async () => {
    const res = await voidReq(null);
    expect(res.status).toBe(401);
  });
});
