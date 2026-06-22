/**
 * Billing cross-tenant / object-ownership negative tests.
 *
 * These ten billing writes ship a handler + SDK but have NO FE consumer, so they
 * are reachable over the wire and were tracked as sensitive mutating orphans
 * (the class that once swallowed the P0 updatePatientContact IDOR). Each handler
 * already enforces an ownership gate; this file PINS that boundary so a refactor
 * can't silently drop it. Polarity: a non-owner caller must be DENIED (403).
 *
 * Repos + the billing-party facade are mocked (no DB) — the 403 fires before any
 * Stripe/DB side effect, so the deny path is fully exercised at unit speed.
 *
 * Discharges the billing entries of endpoint-sensitive-orphan.allowlist.json.
 * The Stripe webhook handler is intentionally NOT covered here: it is
 * unauthenticated and its trust boundary is the Stripe signature (covered in its
 * own signature + idempotency test file), not per-user object ownership — it
 * stays allowlisted with that reason.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { buildTestApp } from '@/tests/helpers/test-app';

// Owner of every seeded invoice / merchant account.
const MERCHANT_ID = 'b1000000-0000-4000-8000-000000000001';
const CUSTOMER_ID = 'a1000000-0000-4000-8000-000000000001';
// A different, authenticated user — owns nothing here.
const ATTACKER_ID = 'a9000000-0000-4000-8000-0000000000ff';

const INVOICE_ID = 'f1000000-0000-4000-8000-000000000001';
const MAC_ID = 'c8000000-0000-4000-8000-000000000001';

// ─── repo + facade mocks (declared before any handler import) ─────────────────

const mockInvoiceFindOneById = () =>
  Promise.resolve({
    id: INVOICE_ID,
    invoiceNumber: 'INV-2026-000777',
    merchant: MERCHANT_ID,
    customer: CUSTOMER_ID,
    status: 'draft',
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
    metadata: { stripePaymentIntentId: 'pi_x', providerDecision: undefined },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

const mockMerchantAccount = () =>
  Promise.resolve({ id: MAC_ID, person: MERCHANT_ID, active: true, metadata: {} } as any);

mock.module('@/handlers/billing/repos/billing.repo', () => ({
  InvoiceRepository: class {
    findOneById = mockInvoiceFindOneById;
    findOneWithLineItems = mockInvoiceFindOneById;
    updateStatus = () => Promise.resolve();
    updateOneById = () => Promise.resolve();
    deleteOneById = () => Promise.resolve();
  },
  MerchantAccountRepository: class {
    findOneById = mockMerchantAccount;
    findByPerson = mockMerchantAccount;
  },
}));

// Identity resolver: findBillingParty(_, id) → { id }. So a lookup by the
// attacker's user.id resolves to the attacker; a lookup by invoice.merchant
// resolves to the merchant. Either way the ownership compare must reject.
mock.module('@/handlers/person/repos/person-billing.facade', () => ({
  findBillingParty: (_db: unknown, id: string) => Promise.resolve({ id }),
}));

const URLS = { refreshUrl: 'https://example.com/refresh', returnUrl: 'https://example.com/return' };

function asAttacker() {
  return buildTestApp({ db: {} as any, user: { id: ATTACKER_ID } });
}

function post(app: ReturnType<typeof buildTestApp>, path: string, body?: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  // mocks are stateless; nothing to reset.
});

describe('billing cross-tenant / object-ownership deny path (IDOR pins)', () => {
  test('captureInvoicePayment: a non-merchant caller is forbidden', async () => {
    const res = await post(asAttacker(), `/billing/invoices/${INVOICE_ID}/capture`);
    expect(res.status).toBe(403);
  });

  test('finalizeInvoice: a foreign-merchant caller is forbidden', async () => {
    const res = await post(asAttacker(), `/billing/invoices/${INVOICE_ID}/finalize`);
    expect(res.status).toBe(403);
  });

  test('deleteInvoice: a foreign-merchant caller is forbidden', async () => {
    const res = await asAttacker().request(`/billing/invoices/${INVOICE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  test('updateInvoice: a foreign-merchant caller is forbidden', async () => {
    const res = await asAttacker().request(`/billing/invoices/${INVOICE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(403);
  });

  test('markInvoiceUncollectible: a foreign-merchant caller is forbidden', async () => {
    const res = await post(asAttacker(), `/billing/invoices/${INVOICE_ID}/mark-uncollectible`);
    expect(res.status).toBe(403);
  });

  test('refundInvoicePayment: a foreign-merchant caller is forbidden', async () => {
    const res = await post(asAttacker(), `/billing/invoices/${INVOICE_ID}/refund`);
    expect(res.status).toBe(403);
  });

  test('payInvoice: a different patient cannot pay another customer’s invoice', async () => {
    const res = await post(asAttacker(), `/billing/invoices/${INVOICE_ID}/pay`, { paymentMethod: 'pm_test123' });
    expect(res.status).toBe(403);
  });

  test('getMerchantDashboard: a non-owner cannot read another merchant’s dashboard', async () => {
    const res = await post(asAttacker(), `/billing/merchant-accounts/${MAC_ID}/dashboard`);
    expect(res.status).toBe(403);
  });

  test('onboardMerchantAccount: a non-owner cannot onboard another merchant account', async () => {
    const res = await post(asAttacker(), `/billing/merchant-accounts/${MAC_ID}/onboard`, URLS);
    expect(res.status).toBe(403);
  });

  test('createMerchantAccount: a caller cannot create a merchant account for a different person', async () => {
    const res = await post(asAttacker(), `/billing/merchant-accounts`, { person: MERCHANT_ID, ...URLS });
    expect(res.status).toBe(403);
  });
});
