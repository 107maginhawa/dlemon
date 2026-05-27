/**
 * Acceptance Criteria tests — dental-billing
 *
 * AC-PAY-01: Recording a partial payment transitions invoice from 'issued' to 'partial'
 * AC-PAY-02: Recording a full payment transitions invoice from 'issued' to 'paid'
 * AC-PAY-03: Voiding a payment reduces the invoice paid amount
 * AC-PAY-04: Creating a payment plan with 3 installments persists all 3 installment records
 * AC-PAY-05: A payment plan blocks the invoice from being voided until the plan is resolved
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { recordDentalPayment } from './recordDentalPayment';
import { voidDentalPayment } from './voidDentalPayment';
import { voidDentalInvoice } from './voidDentalInvoice';
import { createDentalPaymentPlan } from './createDentalPaymentPlan';
import { getDentalPaymentPlan } from './getDentalPaymentPlan';
import {
  RecordDentalPaymentParams,
  RecordDentalPaymentBody,
  VoidDentalPaymentParams,
  VoidDentalPaymentBody,
  VoidDentalInvoiceParams,
  CreateDentalPaymentPlanParams,
  CreateDentalPaymentPlanBody,
  GetDentalPaymentPlanParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: ab1 — avoids membership unique-index collision with other billing suites
const TEST_USER  = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'e0000000-0000-1000-8000-000000000001';
const BRANCH_ID  = '7b000000-0000-4000-8000-000000ab0001';
const MEMBER_ID  = '7c000000-0000-4000-8000-000000ab0001';
const VISIT_ID   = 'b0000000-0000-4000-8000-000000ab0001';
const ORG_ID     = 'ef000000-0000-1000-8000-000000ab0001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'AC Billing Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Test Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'AC', lastName: 'BillingPatient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: 'completed',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

async function truncate() {
  await db.execute(sql`DELETE FROM dental_payment_plan_installment`);
  await db.execute(sql`DELETE FROM dental_payment_plan`);
  await db.execute(sql`DELETE FROM dental_payment`);
  await db.execute(sql`DELETE FROM dental_invoice_line_item`);
  await db.execute(sql`DELETE FROM dental_invoice`);
}

afterEach(truncate);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

  app.post(
    '/dental/billing/invoices/:invoiceId/payments',
    zValidator('param', RecordDentalPaymentParams, validationErrorHandler),
    zValidator('json', RecordDentalPaymentBody, validationErrorHandler),
    recordDentalPayment as any,
  );
  app.post(
    '/dental/billing/invoices/:invoiceId/payments/:paymentId/void',
    zValidator('param', VoidDentalPaymentParams, validationErrorHandler),
    zValidator('json', VoidDentalPaymentBody, validationErrorHandler),
    voidDentalPayment as any,
  );
  app.post(
    '/dental/billing/invoices/:invoiceId/void',
    zValidator('param', VoidDentalInvoiceParams, validationErrorHandler),
    voidDentalInvoice as any,
  );
  app.post(
    '/dental/billing/invoices/:invoiceId/plan',
    zValidator('param', CreateDentalPaymentPlanParams, validationErrorHandler),
    zValidator('json', CreateDentalPaymentPlanBody, validationErrorHandler),
    createDentalPaymentPlan as any,
  );
  app.get(
    '/dental/billing/invoices/:invoiceId/plan',
    zValidator('param', GetDentalPaymentPlanParams, validationErrorHandler),
    getDentalPaymentPlan as any,
  );

  return app;
}

async function seedIssuedInvoice(opts: { totalCents?: number } = {}) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const total = opts.totalCents ?? 10000;

  const [row] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(),
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
    invoiceNumber,
    status: 'issued' as any,
    subtotalCents: total,
    discountCents: 0,
    taxCents: 0,
    taxRate: '0',
    totalCents: total,
    paidCents: 0,
    balanceCents: total,
    issuedAt: new Date('2025-01-15T10:00:00.000Z'),
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).returning();
  return row!;
}

// ===========================================================================
// AC-PAY-01
// ===========================================================================

describe('AC-PAY-01: partial payment transitions invoice to partial', () => {
  test('recording a partial payment transitions invoice status from issued to partial [AC-PAY-01]', async () => {
    const invoice = await seedIssuedInvoice({ totalCents: 10000 });
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 4000,
        method: 'cash',
        receiptNumber: `REC-AC-PAY-01-${Date.now()}`,
        recordedByMemberId: MEMBER_ID,
        patientId: PATIENT_ID,
      }),
    });

    expect(res.status).toBe(201);

    // Verify invoice status is now partial
    const invoiceRepo = new DentalInvoiceRepository(db);
    const updated = await invoiceRepo.findOneById(invoice.id);
    expect(updated?.status).toBe('partial');
    expect(updated?.paidCents).toBe(4000);
    expect(updated?.balanceCents).toBe(6000);
  });
});

// ===========================================================================
// AC-PAY-02
// ===========================================================================

describe('AC-PAY-02: full payment transitions invoice to paid', () => {
  test('recording a full payment transitions invoice status from issued to paid [AC-PAY-02]', async () => {
    const invoice = await seedIssuedInvoice({ totalCents: 5000 });
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 5000,
        method: 'card',
        receiptNumber: `REC-AC-PAY-02-${Date.now()}`,
        recordedByMemberId: MEMBER_ID,
        patientId: PATIENT_ID,
      }),
    });

    expect(res.status).toBe(201);

    // Verify invoice status is now paid
    const invoiceRepo = new DentalInvoiceRepository(db);
    const updated = await invoiceRepo.findOneById(invoice.id);
    expect(updated?.status).toBe('paid');
    expect(updated?.paidCents).toBe(5000);
    expect(updated?.balanceCents).toBe(0);
  });
});

// ===========================================================================
// AC-PAY-03
// ===========================================================================

describe('AC-PAY-03: voiding a payment reduces the invoice paid amount', () => {
  test('voiding a payment reduces paidCents on invoice and restores balance [AC-PAY-03]', async () => {
    const invoice = await seedIssuedInvoice({ totalCents: 10000 });

    // Seed a payment directly
    const paymentRepo = new DentalPaymentRepository(db);
    const payment = await paymentRepo.createOne({
      invoiceId: invoice.id,
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      amountCents: 3000,
      method: 'cash',
      receiptNumber: `REC-AC-PAY-03-${Date.now()}`,
      recordedByMemberId: MEMBER_ID,
    });

    // Apply payment to invoice balance
    const invoiceRepo = new DentalInvoiceRepository(db);
    await invoiceRepo.addPayment(invoice.id, 3000);

    const app = buildTestApp(TEST_USER);

    const res = await app.request(
      `/dental/billing/invoices/${invoice.id}/payments/${payment.id}/void`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason: 'Error in payment' }),
      },
    );

    expect(res.status).toBe(200);

    // Invoice paid amount should be back to 0
    const updated = await invoiceRepo.findOneById(invoice.id);
    expect(updated?.paidCents).toBe(0);
    expect(updated?.balanceCents).toBe(10000);
  });
});

// ===========================================================================
// AC-PAY-04
// ===========================================================================

describe('AC-PAY-04: creating a payment plan with 3 installments persists all 3 records', () => {
  test('payment plan creation with numberOfInstallments=3 persists 3 installment records [AC-PAY-04]', async () => {
    const invoice = await seedIssuedInvoice({ totalCents: 9000 });
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        numberOfInstallments: 3,
        frequency: 'monthly',
        startDate: '2025-06-01T00:00:00.000Z',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // Response is { ...plan, installments } — plan fields at top level
    expect(body.id).toBeTruthy();
    expect(body.invoiceId).toBe(invoice.id);
    expect(body.installments).toHaveLength(3);

    // Verify via repo that all 3 are persisted
    const planRepo = new DentalPaymentPlanRepository(db);
    const plan = await planRepo.findByInvoice(invoice.id);
    expect(plan).toBeTruthy();
    const installments = await planRepo.findInstallmentsByPlan(plan!.id);
    expect(installments).toHaveLength(3);
  });
});

// ===========================================================================
// AC-PAY-05
// ===========================================================================

describe('AC-PAY-05: active payment plan blocks invoice void', () => {
  test('voiding an invoice with an active payment plan returns 400 ACTIVE_PAYMENT_PLAN [AC-PAY-05]', async () => {
    const invoice = await seedIssuedInvoice({ totalCents: 6000 });

    // Create an active payment plan directly (status defaults to 'on_track')
    const planRepo = new DentalPaymentPlanRepository(db);
    await planRepo.createWithInstallments({
      invoiceId: invoice.id,
      patientId: PATIENT_ID,
      totalCents: 6000,
      numberOfInstallments: 2,
      frequency: 'monthly',
      startDate: new Date('2025-06-01T00:00:00.000Z'),
      amountPerInstallmentCents: 3000,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, {
      method: 'POST',
    });

    // BusinessLogicError maps to 422 in this codebase
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('ACTIVE_PAYMENT_PLAN');
  });
});
