/**
 * dental-billing-module3.test.ts — Untested branch coverage
 *
 * Covers high-risk branches not exercised by module1/module2:
 *   getCollectionsSummary — period=month, year, custom from/to, branchId filter + deny
 *   recordDentalPayment   — INVALID_AMOUNT, INVOICE_IMMUTABLE, PAYMENT_EXCEEDS_BALANCE, idempotency
 *   voidDentalInvoice     — BR-011 ACTIVE_PAYMENT_PLAN, void paid invoice, ALREADY_VOIDED
 *   applyDentalDiscount   — ALREADY_PAID guard
 *   createDentalPaymentPlan — NO_BALANCE, installment rounding (Math.floor)
 *   getPatientBalance     — overdue amounts, activePaymentPlanCount, branch-auth deny
 *
 * Fixture namespace: a04 — unique across all dental suites:
 *   module1 (a02), module2 (bb/cc), visit suites (a01/a03)
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

import { getCollectionsSummary } from './getCollectionsSummary';
import { recordDentalPayment } from './recordDentalPayment';
import { voidDentalInvoice } from './voidDentalInvoice';
import { applyDentalDiscount } from './applyDentalDiscount';
import { createDentalPaymentPlan } from './createDentalPaymentPlan';
import { getPatientBalance } from './getPatientBalance';

import {
  RecordDentalPaymentParams,
  RecordDentalPaymentBody,
  VoidDentalInvoiceParams,
  VoidDentalInvoiceBody,
  CreateDentalPaymentPlanParams,
  CreateDentalPaymentPlanBody,
  ApplyDentalDiscountParams,
  ApplyDentalDiscountBody,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique BRANCH_ID + MEMBER_ID (tag a04)
const TEST_USER  = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const UNAUTHED_USER = { id: '99000000-0000-0000-0000-000000000099', email: 'other@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'e0000000-0000-1000-8000-000000000001';
const BRANCH_ID  = '7b000000-0000-4000-8000-000000000a04';
const MEMBER_ID  = '7c000000-0000-4000-8000-000000000a04';
const VISIT_ID   = 'b4000000-0000-4000-8000-000000000a04';
const NONEXISTENT_ID  = 'ffffffff-ffff-1000-8000-ffffffffffff';
const OTHER_BRANCH_ID = '9b000000-0000-4000-8000-000000000a04'; // TEST_USER has no membership here
const ORG_ID = 'ef000000-0000-1000-8000-000000000001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'BillingModule3 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

// ─── App builder ──────────────────────────────────────────────────────────────

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session', userId: user.id });
    }
    await next();
  });

  app.get('/dental/billing/collections/summary', getCollectionsSummary as any);
  app.get('/dental/billing/patients/:patientId/balance', getPatientBalance as any);

  app.post(
    '/dental/billing/invoices/:invoiceId/payments',
    zValidator('param', RecordDentalPaymentParams, validationErrorHandler),
    zValidator('json', RecordDentalPaymentBody, validationErrorHandler),
    recordDentalPayment as any,
  );
  app.post(
    '/dental/billing/invoices/:invoiceId/void',
    zValidator('param', VoidDentalInvoiceParams, validationErrorHandler),
    zValidator('json', VoidDentalInvoiceBody, validationErrorHandler),
    voidDentalInvoice as any,
  );
  app.post(
    '/dental/billing/invoices/:invoiceId/plan',
    zValidator('param', CreateDentalPaymentPlanParams, validationErrorHandler),
    zValidator('json', CreateDentalPaymentPlanBody, validationErrorHandler),
    createDentalPaymentPlan as any,
  );
  app.post(
    '/dental/billing/invoices/:invoiceId/discount',
    zValidator('param', ApplyDentalDiscountParams, validationErrorHandler),
    zValidator('json', ApplyDentalDiscountBody, validationErrorHandler),
    applyDentalDiscount as any,
  );

  return app;
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedInvoice(opts: {
  status?: string;
  totalCents?: number;
  paidCents?: number;
  balanceCents?: number;
} = {}) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const total   = opts.totalCents   ?? 10000;
  const paid    = opts.paidCents    ?? 0;
  const balance = opts.balanceCents ?? total - paid;
  const status  = opts.status ?? 'issued';

  const [row] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(),
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
    invoiceNumber,
    status: status as any,
    subtotalCents: total,
    discountCents: 0,
    taxCents: 0,
    taxRate: '0',
    totalCents: total,
    paidCents: paid,
    balanceCents: balance,
    issuedAt: status !== 'draft' ? new Date('2025-01-15T10:00:00.000Z') : null,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).returning();
  return row!;
}

async function truncate() {
  await db.execute(sql`DELETE FROM dental_payment_plan_installment`);
  await db.execute(sql`DELETE FROM dental_payment_plan`);
  await db.execute(sql`DELETE FROM dental_payment`);
  await db.execute(sql`DELETE FROM dental_invoice_line_item`);
  await db.execute(sql`DELETE FROM dental_invoice`);
}

// =============================================================================
// T2 — getCollectionsSummary: period branches + branchId filter/deny
// =============================================================================

describe('getCollectionsSummary — period and branchId branches', () => {
  afterEach(truncate);

  test('period=month returns 200 with period.from on the 1st of the month', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/billing/collections/summary?period=month');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const from = new Date(body.period.from);
    expect(from.getDate()).toBe(1);
    expect(typeof body.totalCollectedCents).toBe('number');
    expect(typeof body.paymentCount).toBe('number');
  });

  test('period=year returns 200 with period.from on Jan 1 of current year', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/billing/collections/summary?period=year');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const from = new Date(body.period.from);
    expect(from.getMonth()).toBe(0); // January
    expect(from.getDate()).toBe(1);
    expect(typeof body.totalBilledCents).toBe('number');
  });

  test('custom from/to reflects requested range in response and returns zero for empty window', async () => {
    const from = '2025-01-01T00:00:00.000Z';
    const to   = '2025-01-31T23:59:59.000Z';
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/collections/summary?from=${from}&to=${to}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.period.from).toBe(from);
    expect(body.period.to).toBe(to);
    expect(body.totalCollectedCents).toBe(0);
    expect(body.paymentCount).toBe(0);
  });

  test('branchId filter returns 200 for authenticated user with membership', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/collections/summary?period=today&branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.totalCollectedCents).toBe('number');
    expect(typeof body.collectionsByMethod).toBe('object');
  });

  test('branchId filter returns 403 when user has no membership in branch', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/collections/summary?branchId=${OTHER_BRANCH_ID}`);
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// T3 — recordDentalPayment: untested error branches + idempotency
// =============================================================================

describe('recordDentalPayment — error branches and idempotency', () => {
  afterEach(truncate);

  test('rejects amountCents of zero at the schema layer (400, V-BIL-010 .gte(1))', async () => {
    // V-BIL-010: the contract min:1 bound is now enforced at the validator layer,
    // so a zero/negative amount is caught as 400 VALIDATION_ERROR before the handler.
    // MODULE_SPEC BR-015 accepts 400 for amount bounds; the handler's 422 INVALID_AMOUNT
    // remains as defense-in-depth for non-HTTP callers.
    const invoice = await seedInvoice({ totalCents: 5000, balanceCents: 5000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 0, method: 'cash', receiptNumber: 'RCT-ZERO-M3', recordedByMemberId: MEMBER_ID }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 422 INVOICE_IMMUTABLE when invoice is fully paid (V-BIL-005)', async () => {
    const invoice = await seedInvoice({ status: 'paid', totalCents: 5000, paidCents: 5000, balanceCents: 0 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 1000, method: 'cash', receiptNumber: 'RCT-PAID-M3', recordedByMemberId: MEMBER_ID }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVOICE_IMMUTABLE');
  });

  test('returns 422 INVOICE_IMMUTABLE when recording payment on voided invoice (V-BIL-005)', async () => {
    const invoice = await seedInvoice({ status: 'voided', totalCents: 5000, balanceCents: 5000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 1000, method: 'cash', receiptNumber: 'RCT-VOID-M3', recordedByMemberId: MEMBER_ID }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVOICE_IMMUTABLE');
  });

  // V-BIL-105 / CONF-BILL-L1-01: recording a payment on a `draft` invoice is an
  // out-of-FSM transition. Per MODULE_SPEC §8 (SM-INVOICE), payments are valid
  // only on issued/partial/overdue invoices. A draft has not been issued, so it
  // must be rejected with 422 INVALID_STATUS_TRANSITION (BR-012).
  test('returns 422 INVALID_STATUS_TRANSITION when recording payment on a draft invoice (V-BIL-105)', async () => {
    const invoice = await seedInvoice({ status: 'draft', totalCents: 5000, balanceCents: 5000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 1000, method: 'cash', receiptNumber: 'RCT-DRAFT-M3', recordedByMemberId: MEMBER_ID }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('returns 422 PAYMENT_EXCEEDS_BALANCE when amount exceeds remaining balance (V-BIL-004)', async () => {
    const invoice = await seedInvoice({ totalCents: 5000, paidCents: 2000, balanceCents: 3000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 4000, method: 'cash', receiptNumber: 'RCT-OVER-M3', recordedByMemberId: MEMBER_ID }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('PAYMENT_EXCEEDS_BALANCE');
  });

  test('idempotency: duplicate receiptNumber returns 200 with same payment (not a new 201)', async () => {
    const invoice = await seedInvoice({ totalCents: 5000, balanceCents: 5000 });
    const app = buildTestApp(TEST_USER);
    const paymentBody = JSON.stringify({ amountCents: 2000, method: 'cash', receiptNumber: 'RCT-IDEM-M3', recordedByMemberId: MEMBER_ID });

    const first = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: paymentBody,
    });
    expect(first.status).toBe(201);
    const firstBody = await first.json() as any;

    const second = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: paymentBody,
    });
    expect(second.status).toBe(200);
    const secondBody = await second.json() as any;
    expect(secondBody.id).toBe(firstBody.id);
    expect(secondBody.receiptNumber).toBe('RCT-IDEM-M3');
  });

  // N-BIL-01: idempotency replay must be scoped to the CURRENT invoice.
  // A receipt number reused from invoice A against invoice B must NOT echo
  // back invoice A's payment (money-integrity + cross-resource data exposure).
  test('N-BIL-01: reusing a receiptNumber from invoice A on invoice B does NOT return A\'s payment', async () => {
    const invoiceA = await seedInvoice({ totalCents: 5000, balanceCents: 5000 });
    const invoiceB = await seedInvoice({ totalCents: 8000, balanceCents: 8000 });
    const app = buildTestApp(TEST_USER);
    const receipt = 'RCT-XINV-M3';

    // Record a payment with receipt R on invoice A (amount 2000).
    const onA = await app.request(`/dental/billing/invoices/${invoiceA.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 2000, method: 'cash', receiptNumber: receipt, recordedByMemberId: MEMBER_ID }),
    });
    expect(onA.status).toBe(201);
    const onABody = await onA.json() as any;

    // POST same receipt R to invoice B with a DIFFERENT amount (3500).
    const onB = await app.request(`/dental/billing/invoices/${invoiceB.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 3500, method: 'cash', receiptNumber: receipt, recordedByMemberId: MEMBER_ID }),
    });

    // Must NOT be a 200 echo of invoice A's payment.
    expect(onB.status).toBe(409);
    const onBBody = await onB.json() as any;
    expect(onBBody.code).toBe('CONFLICT');
    // Crucially, A's payment (id/amount/invoice) must never be exposed via B.
    expect(JSON.stringify(onBBody)).not.toContain(onABody.id);
    expect(JSON.stringify(onBBody)).not.toContain(invoiceA.id);
  });

  // N-BIL-01: same invoice + same receipt + DIFFERENT amount → conflict, not a
  // silent 200 echo of the prior (different-amount) payment.
  test('N-BIL-01: same invoice + same receiptNumber + different amount returns 409 CONFLICT', async () => {
    const invoice = await seedInvoice({ totalCents: 10000, balanceCents: 10000 });
    const app = buildTestApp(TEST_USER);
    const receipt = 'RCT-AMTM-M3';

    const first = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 2000, method: 'cash', receiptNumber: receipt, recordedByMemberId: MEMBER_ID }),
    });
    expect(first.status).toBe(201);

    const second = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 4000, method: 'cash', receiptNumber: receipt, recordedByMemberId: MEMBER_ID }),
    });
    expect(second.status).toBe(409);
    const secondBody = await second.json() as any;
    expect(secondBody.code).toBe('CONFLICT');
  });
});

// =============================================================================
// T4a — voidDentalInvoice: BR-011, paid-invoice void, already-voided
// =============================================================================

describe('voidDentalInvoice — BR-011, paid invoice, already-voided', () => {
  afterEach(truncate);

  test('BR-011: returns 400 ACTIVE_PAYMENT_PLAN when active plan exists for invoice', async () => {
    const invoice = await seedInvoice({ totalCents: 10000, balanceCents: 10000 });
    const planRepo = new DentalPaymentPlanRepository(db);
    await planRepo.createWithInstallments({
      invoiceId: invoice.id,
      patientId: PATIENT_ID,
      totalCents: 10000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: new Date('2025-06-01T00:00:00.000Z'),
      amountPerInstallmentCents: 3333,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Active plan void attempt' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('ACTIVE_PAYMENT_PLAN');
  });

  test('allows voiding a paid invoice (admin correction use case)', async () => {
    const invoice = await seedInvoice({ status: 'paid', totalCents: 5000, paidCents: 5000, balanceCents: 0 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Admin correction of paid invoice' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('voided');
  });

  test('returns 400 ALREADY_VOIDED when voiding an already-voided invoice', async () => {
    const invoice = await seedInvoice({ status: 'voided', totalCents: 5000, balanceCents: 5000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Already voided attempt' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('ALREADY_VOIDED');
  });
});

// =============================================================================
// T4b — applyDentalDiscount: ALREADY_PAID guard
// =============================================================================

describe('applyDentalDiscount — ALREADY_PAID guard', () => {
  afterEach(truncate);

  test('returns 422 ALREADY_PAID when applying discount to a fully paid invoice', async () => {
    const invoice = await seedInvoice({ status: 'paid', totalCents: 10000, paidCents: 10000, balanceCents: 0 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentageRate: 10, reason: 'Test discount' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('ALREADY_PAID');
  });
});

// =============================================================================
// T4c — createDentalPaymentPlan: NO_BALANCE guard and installment rounding
// =============================================================================

describe('createDentalPaymentPlan — NO_BALANCE and rounding', () => {
  afterEach(truncate);

  test('returns 400 NO_BALANCE when invoice has zero remaining balance', async () => {
    const invoice = await seedInvoice({ status: 'paid', totalCents: 5000, paidCents: 5000, balanceCents: 0 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, numberOfInstallments: 3, frequency: 'monthly', startDate: '2025-06-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('NO_BALANCE');
  });

  test('installment rounding: 10000 / 3 = 3333 per installment (Math.floor)', async () => {
    const invoice = await seedInvoice({ totalCents: 10000, balanceCents: 10000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, numberOfInstallments: 3, frequency: 'monthly', startDate: '2025-06-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.installments).toHaveLength(3);
    expect(body.installments[0].amountCents).toBe(3333);
    expect(body.installments[1].amountCents).toBe(3333);
    expect(body.installments[2].amountCents).toBe(3334); // last installment gets remainder: 10000-3333*2=3334
  });

  // V-BIL-002: installment count bounded 2–24.
  test('returns 422 INVALID_INSTALLMENT_COUNT when count is 0 (div-by-zero guard)', async () => {
    const invoice = await seedInvoice({ totalCents: 10000, balanceCents: 10000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, numberOfInstallments: 0, frequency: 'monthly', startDate: '2025-06-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_INSTALLMENT_COUNT');
  });

  test('returns 422 INVALID_INSTALLMENT_COUNT when count is 1 (below min)', async () => {
    const invoice = await seedInvoice({ totalCents: 10000, balanceCents: 10000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, numberOfInstallments: 1, frequency: 'monthly', startDate: '2025-06-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('INVALID_INSTALLMENT_COUNT');
  });

  test('returns 422 INVALID_INSTALLMENT_COUNT when count exceeds 24', async () => {
    const invoice = await seedInvoice({ totalCents: 10000, balanceCents: 10000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, numberOfInstallments: 25, frequency: 'monthly', startDate: '2025-06-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('INVALID_INSTALLMENT_COUNT');
  });
});

// =============================================================================
// V-BIL-001 — applyDentalDiscount: percentageRate bounds (money-integrity)
// =============================================================================

describe('applyDentalDiscount — rate bounds (V-BIL-001)', () => {
  afterEach(truncate);

  test('returns 422 INVALID_DISCOUNT_RATE when rate exceeds 100', async () => {
    const invoice = await seedInvoice({ totalCents: 10000, balanceCents: 10000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentageRate: 150, reason: 'Bad rate' }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('INVALID_DISCOUNT_RATE');
  });

  test('returns 422 INVALID_DISCOUNT_RATE when rate is negative', async () => {
    const invoice = await seedInvoice({ totalCents: 10000, balanceCents: 10000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentageRate: -10, reason: 'Bad rate' }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('INVALID_DISCOUNT_RATE');
  });

  test('rate of exactly 100 is accepted and never yields a negative total', async () => {
    const invoice = await seedInvoice({ totalCents: 10000, balanceCents: 10000 });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentageRate: 100, reason: 'Full waiver' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.totalCents).toBeGreaterThanOrEqual(0);
    expect(body.balanceCents).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// T4d — getPatientBalance: overdue amounts, activePaymentPlanCount, branch-auth deny
// =============================================================================

describe('getPatientBalance — overdue and active-plan branches + branch-auth', () => {
  afterEach(truncate);

  test('overdueAmountCents and overdueInvoiceCount reflect overdue invoices', async () => {
    await seedInvoice({ status: 'overdue', totalCents: 7500, balanceCents: 7500 });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/patients/${PATIENT_ID}/balance`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.overdueAmountCents).toBe(7500);
    expect(body.overdueInvoiceCount).toBe(1);
  });

  test('activePaymentPlanCount is 1 when an on_track plan exists for patient', async () => {
    const invoice = await seedInvoice({ totalCents: 9000, balanceCents: 9000 });
    const planRepo = new DentalPaymentPlanRepository(db);
    await planRepo.createWithInstallments({
      invoiceId: invoice.id,
      patientId: PATIENT_ID,
      totalCents: 9000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: new Date('2025-06-01T00:00:00.000Z'),
      amountPerInstallmentCents: 3000,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/patients/${PATIENT_ID}/balance`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.activePaymentPlanCount).toBe(1);
  });

  test('returns 403 when user has no membership in patient preferred branch', async () => {
    // UNAUTHED_USER has no membership in BRANCH_ID (patient's preferredBranchId)
    const app = buildTestApp(UNAUTHED_USER);
    const res = await app.request(`/dental/billing/patients/${PATIENT_ID}/balance`);
    expect(res.status).toBe(403);
  });
});
