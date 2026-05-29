/**
 * dental-billing handler tests
 *
 * Tests HTTP-level behavior: auth, validation, 201/200 on success, 404 not found,
 * and state transitions (issue, void, pay, plan).
 *
 * Handlers that use ctx.req.valid('json') require zValidator middleware to be
 * registered before the handler in the test app — matching production routes.ts.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { createDentalInvoice } from './createDentalInvoice';
import { getDentalInvoice } from './getDentalInvoice';
import { listDentalInvoices } from './listDentalInvoices';
import { issueDentalInvoice } from './issueDentalInvoice';
import { voidDentalInvoice } from './voidDentalInvoice';
import { applyDentalDiscount } from './applyDentalDiscount';
import { recordDentalPayment } from './recordDentalPayment';
import { listDentalPayments } from './listDentalPayments';
import { voidDentalPayment } from './voidDentalPayment';
import { createDentalPaymentPlan } from './createDentalPaymentPlan';
import { getDentalPaymentPlan } from './getDentalPaymentPlan';

import {
  CreateDentalInvoiceBody,
  ApplyDentalDiscountParams,
  ApplyDentalDiscountBody,
  IssueDentalInvoiceParams,
  VoidDentalInvoiceParams,
  RecordDentalPaymentParams,
  RecordDentalPaymentBody,
  ListDentalPaymentsParams,
  VoidDentalPaymentParams,
  VoidDentalPaymentBody,
  CreateDentalPaymentPlanParams,
  CreateDentalPaymentPlanBody,
  GetDentalInvoiceParams,
  GetDentalPaymentPlanParams,
  ListDentalInvoicesQuery,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique BRANCH_ID + membership id (tag a02) breaks the cross-suite
// collision on dental_membership's (person_id, branch_id) partial unique index.
// Org/patient/person ids stay at their original deterministic values so
// onConflictDoNothing is a correct no-op against rows from prior runs.
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const STAFF_USER = { id: '00000000-0000-0000-0000-000000000099', email: 'staff@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID = 'e0000000-0000-1000-8000-000000000001';
const BRANCH_ID = '7b000000-0000-4000-8000-000000000a02';
const MEMBER_ID = '7c000000-0000-4000-8000-000000000a02';
const STAFF_MEMBER_ID = '7c000000-0000-4000-8000-000000000a99';
const SCHEDULING_USER = { id: '00000000-0000-0000-0000-000000000097', email: 'scheduling@clinic.com' };
const SCHEDULING_MEMBER_ID = '7c000000-0000-4000-8000-000000000a97';
const NONEXISTENT_ID = 'ffffffff-ffff-1000-8000-ffffffffffff';
const ORG_ID = 'ed000000-0000-1000-8000-000000000001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Billing Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: STAFF_MEMBER_ID, branchId: BRANCH_ID, personId: STAFF_USER.id, displayName: 'Test Staff', role: 'staff_full', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: SCHEDULING_MEMBER_ID, branchId: BRANCH_ID, personId: SCHEDULING_USER.id, displayName: 'Scheduling Staff', role: 'staff_scheduling', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
  }
};

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
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

  // createDentalInvoice — needs zValidator for ctx.req.valid('json')
  app.post(
    '/dental/billing/invoices',
    zValidator('json', CreateDentalInvoiceBody, validationErrorHandler),
    createDentalInvoice as any,
  );

  // listDentalInvoices — needs zValidator for ctx.req.valid('query')
  app.get(
    '/dental/billing/invoices',
    zValidator('query', ListDentalInvoicesQuery, validationErrorHandler),
    listDentalInvoices as any,
  );

  // getDentalInvoice — needs zValidator for ctx.req.valid('param')
  app.get(
    '/dental/billing/invoices/:invoiceId',
    zValidator('param', GetDentalInvoiceParams, validationErrorHandler),
    getDentalInvoice as any,
  );

  // applyDentalDiscount
  app.post(
    '/dental/billing/invoices/:invoiceId/discount',
    zValidator('param', ApplyDentalDiscountParams, validationErrorHandler),
    zValidator('json', ApplyDentalDiscountBody, validationErrorHandler),
    applyDentalDiscount as any,
  );

  // issueDentalInvoice
  app.post(
    '/dental/billing/invoices/:invoiceId/issue',
    zValidator('param', IssueDentalInvoiceParams, validationErrorHandler),
    issueDentalInvoice as any,
  );

  // recordDentalPayment
  app.post(
    '/dental/billing/invoices/:invoiceId/payments',
    zValidator('param', RecordDentalPaymentParams, validationErrorHandler),
    zValidator('json', RecordDentalPaymentBody, validationErrorHandler),
    recordDentalPayment as any,
  );

  // listDentalPayments
  app.get(
    '/dental/billing/invoices/:invoiceId/payments',
    zValidator('param', ListDentalPaymentsParams, validationErrorHandler),
    listDentalPayments as any,
  );

  // voidDentalPayment
  app.post(
    '/dental/billing/invoices/:invoiceId/payments/:paymentId/void',
    zValidator('param', VoidDentalPaymentParams, validationErrorHandler),
    zValidator('json', VoidDentalPaymentBody, validationErrorHandler),
    voidDentalPayment as any,
  );

  // createDentalPaymentPlan
  app.post(
    '/dental/billing/invoices/:invoiceId/plan',
    zValidator('param', CreateDentalPaymentPlanParams, validationErrorHandler),
    zValidator('json', CreateDentalPaymentPlanBody, validationErrorHandler),
    createDentalPaymentPlan as any,
  );

  // getDentalPaymentPlan
  app.get(
    '/dental/billing/invoices/:invoiceId/plan',
    zValidator('param', GetDentalPaymentPlanParams, validationErrorHandler),
    getDentalPaymentPlan as any,
  );

  // voidDentalInvoice
  app.post(
    '/dental/billing/invoices/:invoiceId/void',
    zValidator('param', VoidDentalInvoiceParams, validationErrorHandler),
    voidDentalInvoice as any,
  );

  return app;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedVisitAndTreatment() {
  const visitRepo = new VisitRepository(db);
  const treatmentRepo = new TreatmentRepository(db);

  const visit = await visitRepo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
  });

  const treatment = await treatmentRepo.createOne({
    visitId: visit.id,
    patientId: PATIENT_ID,
    cdtCode: 'D1110',
    description: 'Adult prophylaxis',
    priceCents: 5000,
    status: 'performed',
  });

  return { visit, treatment };
}

async function seedInvoice() {
  const { visit } = await seedVisitAndTreatment();
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const invoice = await invoiceRepo.createOne({
    visitId: visit.id,
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
    invoiceNumber,
    subtotalCents: 5000,
    taxCents: 0,
    taxRate: '0',
    totalCents: 5000,
    balanceCents: 5000,
  });
  return { invoice };
}

async function seedIssuedInvoice() {
  const { invoice } = await seedInvoice();
  const invoiceRepo = new DentalInvoiceRepository(db);
  const issued = await invoiceRepo.issue(invoice.id);
  return { invoice: issued! };
}

async function seedPayment(invoiceId: string) {
  const paymentRepo = new DentalPaymentRepository(db);
  const payment = await paymentRepo.createOne({
    invoiceId,
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    amountCents: 1000,
    method: 'cash',
    receiptNumber: 'REC-001',
    recordedByMemberId: MEMBER_ID,
  });
  // Also update invoice balance
  const invoiceRepo = new DentalInvoiceRepository(db);
  await invoiceRepo.addPayment(invoiceId, 1000);
  return { payment };
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_payment_plan_installment`);
  await db.execute(sql`DELETE FROM dental_payment_plan`);
  await db.execute(sql`DELETE FROM dental_payment`);
  await db.execute(sql`DELETE FROM dental_invoice_line_item`);
  await db.execute(sql`DELETE FROM dental_invoice`);
  await db.execute(sql`DELETE FROM consent_form`);
  await db.execute(sql`DELETE FROM dental_treatment`);
  await db.execute(sql`DELETE FROM dental_visit`);
});

async function seedSignedConsent(visitId: string) {
  const [cf] = await db.insert(consentForms).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT_ID,
    templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
    signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,test',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return cf!;
}

// ===========================================================================
// createDentalInvoice
// ===========================================================================

describe('createDentalInvoice handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: NONEXISTENT_ID,
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        dentistMemberId: MEMBER_ID,
      }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when required fields are missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when no billable treatments for visit', async () => {
    const visitRepo = new VisitRepository(db);
    const visit = await visitRepo.createOne({
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID,
    });
    await seedSignedConsent(visit.id);

    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        dentistMemberId: MEMBER_ID,
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/billable/i);
  });

  test('returns 201 with invoice when visit has performed treatments', async () => {
    const { visit } = await seedVisitAndTreatment();
    await seedSignedConsent(visit.id);
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        dentistMemberId: MEMBER_ID,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.visitId).toBe(visit.id);
    expect(body.subtotalCents).toBe(5000);
    expect(body.status).toBe('draft');
    expect(body.invoiceNumber).toMatch(/^INV-/);
  });

  test('sets billedInvoiceId on treatments after invoice is created', async () => {
    const { visit, treatment } = await seedVisitAndTreatment();
    await seedSignedConsent(visit.id);
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        dentistMemberId: MEMBER_ID,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;

    const treatmentRepo = new TreatmentRepository(db);
    const updatedTreatment = await treatmentRepo.findOneById(treatment.id);
    expect(updatedTreatment).not.toBeNull();
    expect(updatedTreatment!.billedInvoiceId).toBe(body.id);
  });

  test('returns 422 with TREATMENT_ALREADY_BILLED when re-invoicing a visit', async () => {
    const { visit } = await seedVisitAndTreatment();
    await seedSignedConsent(visit.id);
    const app = buildTestApp(TEST_USER);

    const requestBody = JSON.stringify({
      visitId: visit.id,
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID,
    });

    // First invoice — should succeed
    const res1 = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });
    expect(res1.status).toBe(201);

    // Second invoice for the same visit — treatments already billed
    const res2 = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });
    expect(res2.status).toBe(422);
    const body2 = await res2.json() as any;
    expect(body2.code).toBe('TREATMENT_ALREADY_BILLED');
  });
});

// ===========================================================================
// getDentalInvoice
// ===========================================================================

describe('getDentalInvoice handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}`);
    expect(res.status).toBe(401);
  });

  test('returns 404 when invoice not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}`);
    expect(res.status).toBe(404);
  });

  test('returns 200 with invoice and lineItems', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(invoice.id);
    expect(Array.isArray(body.lineItems)).toBe(true);
  });
});

// ===========================================================================
// listDentalInvoices
// ===========================================================================

describe('listDentalInvoices handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/billing/invoices');
    expect(res.status).toBe(401);
  });

  // EM-BIL-001: branchId is required — omitting it must return 400, not 200
  test('[EM-BIL-001] returns 400 when branchId is omitted', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/billing/invoices');
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/branchId/i);
  });

  // EM-BIL-001: omitting branchId must NOT leak invoices from all branches
  test('[EM-BIL-001] omitting branchId does not return other-branch invoices', async () => {
    await seedInvoice(); // seeds invoice in BRANCH_ID
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/billing/invoices');
    // Must be blocked before returning any data
    expect(res.status).toBe(400);
  });

  // EM-BIL-001: user without branch membership is forbidden even when branchId is provided
  test('[EM-BIL-001] returns 403 when branchId is provided but user has no membership', async () => {
    const outsider = { id: '00000000-0000-0000-0000-000000000050', email: 'outsider@other.com' };
    const app = buildTestApp(outsider);
    const res = await app.request(`/dental/billing/invoices?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(403);
  });

  test('returns 200 with empty array when no invoices for branch', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  test('returns 200 with invoice list when branchId is provided', async () => {
    await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('filters by patientId', async () => {
    await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices?branchId=${BRANCH_ID}&patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.every((inv: any) => inv.patientId === PATIENT_ID)).toBe(true);
  });

  test('filters by status', async () => {
    await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices?branchId=${BRANCH_ID}&status=draft`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.every((inv: any) => inv.status === 'draft')).toBe(true);
  });
});

// ===========================================================================
// issueDentalInvoice
// ===========================================================================

describe('issueDentalInvoice handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/issue`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when invoice not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/issue`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  test('returns 422 when invoice is not in draft status', async () => {
    const { invoice } = await seedIssuedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/issue`, {
      method: 'POST',
    });
    // BusinessLogicError maps to 422
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('returns 200 and transitions invoice from draft to issued', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/issue`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('issued');
    expect(body.issuedAt).not.toBeNull();
  });
});

// ===========================================================================
// voidDentalInvoice
// ===========================================================================

describe('voidDentalInvoice handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/void`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when invoice not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/void`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  test('returns 200 and transitions invoice to voided', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('voided');
    expect(body.voidedAt).not.toBeNull();
  });

  test('returns error when trying to void an already voided invoice', async () => {
    const { invoice } = await seedInvoice();
    const invoiceRepo = new DentalInvoiceRepository(db);
    await invoiceRepo.voidInvoice(invoice.id);

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, {
      method: 'POST',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json() as any;
    expect(body.code).toBe('ALREADY_VOIDED');
  });
});

// ===========================================================================
// applyDentalDiscount
// ===========================================================================

describe('applyDentalDiscount handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Loyalty', percentageRate: 10 }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when invoice not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Loyalty', percentageRate: 10 }),
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when body is invalid', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Missing rate' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 200 with updated invoice after discount is applied', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Senior citizen', percentageRate: 20 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.discountCents).toBeGreaterThan(0);
    expect(body.totalCents).toBeLessThan(invoice.totalCents);
  });

  test('returns error when trying to apply discount to voided invoice', async () => {
    const { invoice } = await seedInvoice();
    const invoiceRepo = new DentalInvoiceRepository(db);
    await invoiceRepo.voidInvoice(invoice.id);

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test', percentageRate: 10 }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VOIDED_INVOICE');
  });
});

// ===========================================================================
// recordDentalPayment
// ===========================================================================

describe('recordDentalPayment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 1000,
        method: 'cash',
        receiptNumber: 'REC-001',
        recordedByMemberId: MEMBER_ID,
      }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when invoice not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 1000,
        method: 'cash',
        receiptNumber: 'REC-001',
        recordedByMemberId: MEMBER_ID,
      }),
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when body is invalid', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 1000 }), // missing method, receiptNumber, recordedByMemberId
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with payment record on valid input', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 2500,
        method: 'card',
        receiptNumber: 'REC-002',
        recordedByMemberId: MEMBER_ID,
        notes: 'Partial payment',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.amountCents).toBe(2500);
    expect(body.method).toBe('card');
    expect(body.isVoid).toBe(false);
  });

  test('invoice status becomes partial after partial payment', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 1000,
        method: 'cash',
        receiptNumber: 'REC-003',
        recordedByMemberId: MEMBER_ID,
      }),
    });

    const invoiceRepo = new DentalInvoiceRepository(db);
    const updated = await invoiceRepo.findOneById(invoice.id);
    expect(updated!.status).toBe('partial');
    expect(updated!.paidCents).toBe(1000);
  });

  test('invoice status becomes paid after full payment', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 5000,
        method: 'bank_transfer',
        receiptNumber: 'REC-004',
        recordedByMemberId: MEMBER_ID,
      }),
    });

    const invoiceRepo = new DentalInvoiceRepository(db);
    const updated = await invoiceRepo.findOneById(invoice.id);
    expect(updated!.status).toBe('paid');
    expect(updated!.balanceCents).toBe(0);
  });

  test('returns error when trying to record payment on voided invoice', async () => {
    const { invoice } = await seedInvoice();
    const invoiceRepo = new DentalInvoiceRepository(db);
    await invoiceRepo.voidInvoice(invoice.id);

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 1000,
        method: 'cash',
        receiptNumber: 'REC-005',
        recordedByMemberId: MEMBER_ID,
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VOIDED_INVOICE');
  });
});

// ===========================================================================
// listDentalPayments
// ===========================================================================

describe('listDentalPayments handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/payments`);
    expect(res.status).toBe(401);
  });

  test('returns 404 when invoice not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/payments`);
    expect(res.status).toBe(404);
  });

  test('returns 200 with empty array when no payments', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  test('returns 200 with list of non-voided payments', async () => {
    const { invoice } = await seedInvoice();
    await seedPayment(invoice.id);
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].amountCents).toBe(1000);
    expect(body.data[0].isVoid).toBe(false);
  });
});

// ===========================================================================
// voidDentalPayment
// ===========================================================================

describe('voidDentalPayment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(
      `/dental/billing/invoices/${NONEXISTENT_ID}/payments/${NONEXISTENT_ID}/void`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason: 'Error' }),
      },
    );
    expect(res.status).toBe(401);
  });

  test('returns 404 when payment not found', async () => {
    const app = buildTestApp(TEST_USER);
    const { invoice } = await seedInvoice();

    const res = await app.request(
      `/dental/billing/invoices/${invoice.id}/payments/${NONEXISTENT_ID}/void`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason: 'Error' }),
      },
    );
    expect(res.status).toBe(404);
  });

  test('returns 400 when voidReason is missing', async () => {
    const { invoice } = await seedInvoice();
    const { payment } = await seedPayment(invoice.id);
    const app = buildTestApp(TEST_USER);

    const res = await app.request(
      `/dental/billing/invoices/${invoice.id}/payments/${payment.id}/void`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(400);
  });

  test('returns 200 with voided payment and reverses invoice balance', async () => {
    const { invoice } = await seedInvoice();
    const { payment } = await seedPayment(invoice.id);
    const app = buildTestApp(TEST_USER);

    const res = await app.request(
      `/dental/billing/invoices/${invoice.id}/payments/${payment.id}/void`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason: 'Customer requested refund' }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.isVoid).toBe(true);
    expect(body.voidReason).toBe('Customer requested refund');

    // Invoice balance should be restored
    const invoiceRepo = new DentalInvoiceRepository(db);
    const updated = await invoiceRepo.findOneById(invoice.id);
    expect(updated!.balanceCents).toBe(5000);
  });

  test('returns error when trying to void an already voided payment', async () => {
    const { invoice } = await seedInvoice();
    const { payment } = await seedPayment(invoice.id);
    const paymentRepo = new DentalPaymentRepository(db);
    await paymentRepo.voidPayment(payment.id, 'First void', MEMBER_ID);

    const app = buildTestApp(TEST_USER);
    const res = await app.request(
      `/dental/billing/invoices/${invoice.id}/payments/${payment.id}/void`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason: 'Second void attempt' }),
      },
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json() as any;
    expect(body.code).toBe('ALREADY_VOIDED');
  });
});

// ===========================================================================
// createDentalPaymentPlan
// ===========================================================================

describe('createDentalPaymentPlan handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        numberOfInstallments: 3,
        frequency: 'monthly',
        startDate: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when invoice not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        numberOfInstallments: 3,
        frequency: 'monthly',
        startDate: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when body is invalid', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }), // missing other required fields
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with plan and installments created', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        numberOfInstallments: 3,
        frequency: 'monthly',
        startDate: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.invoiceId).toBe(invoice.id);
    expect(body.numberOfInstallments).toBe(3);
    expect(body.frequency).toBe('monthly');
  });

  test('returns error when plan already exists for invoice', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const planBody = JSON.stringify({
      patientId: PATIENT_ID,
      numberOfInstallments: 2,
      frequency: 'weekly',
      startDate: new Date().toISOString(),
    });

    await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: planBody,
    });

    // Second attempt should fail
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: planBody,
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json() as any;
    expect(body.code).toBe('PLAN_EXISTS');
  });

  test('returns error when invoice is voided', async () => {
    const { invoice } = await seedInvoice();
    const invoiceRepo = new DentalInvoiceRepository(db);
    await invoiceRepo.voidInvoice(invoice.id);

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        numberOfInstallments: 3,
        frequency: 'monthly',
        startDate: new Date().toISOString(),
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VOIDED_INVOICE');
  });
});

// ===========================================================================
// getDentalPaymentPlan
// ===========================================================================

describe('getDentalPaymentPlan handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/plan`);
    expect(res.status).toBe(401);
  });

  test('returns 404 when no plan exists for invoice', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`);
    expect(res.status).toBe(404);
  });

  test('returns 200 with plan and installments', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    // Create plan first
    await app.request(`/dental/billing/invoices/${invoice.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        numberOfInstallments: 4,
        frequency: 'monthly',
        startDate: new Date().toISOString(),
      }),
    });

    const res = await app.request(`/dental/billing/invoices/${invoice.id}/plan`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.invoiceId).toBe(invoice.id);
    expect(Array.isArray(body.installments)).toBe(true);
    expect(body.installments.length).toBe(4);
  });
});

// ===========================================================================
// EC3: Only highest discount applies (no stacking)
// ===========================================================================

describe('EC3: only highest discount applies', () => {
  test('applying a second discount replaces the first (no stacking)', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);

    // First discount: 10%
    await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'PWD', percentageRate: 10 }),
    });

    // Second discount: 20% (higher — should replace, not stack)
    const res2 = await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Senior', percentageRate: 20 }),
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json() as any;

    // Discount should be 20% of subtotal, not 10% + 20% = 30%
    const expected20pct = Math.round(invoice.subtotalCents * 0.20);
    // Allow ±1 cent for rounding differences
    expect(Math.abs(body2.discountCents - expected20pct)).toBeLessThanOrEqual(1);
    // Total should NOT be less than if 30% was applied
    const would30pct = Math.round(invoice.subtotalCents * 0.30);
    expect(body2.discountCents).toBeLessThan(would30pct + 1);
  });
});

// ===========================================================================
// EC6: Multiple payment plans per patient allowed
// ===========================================================================

describe('EC6: multiple payment plans per patient', () => {
  test('allows creating two payment plans for the same patient (different invoices)', async () => {
    const { invoice: inv1 } = await seedInvoice();

    // Seed a second visit and invoice for the same patient
    const visitRepo = new VisitRepository(db);
    const visit2 = await visitRepo.createOne({
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID,
    });
    const invoiceRepo = new DentalInvoiceRepository(db);
    const invoiceNumber2 = await invoiceRepo.generateInvoiceNumber();
    const inv2 = await invoiceRepo.createOne({
      visitId: visit2.id,
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID,
      invoiceNumber: invoiceNumber2,
      subtotalCents: 60000,
      taxCents: 0,
      taxRate: '0',
      totalCents: 60000,
      balanceCents: 60000,
    });

    const app = buildTestApp(TEST_USER);

    // Create plan for first invoice
    const res1 = await app.request(`/dental/billing/invoices/${inv1.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        numberOfInstallments: 3,
        frequency: 'monthly',
        startDate: new Date().toISOString(),
      }),
    });
    expect(res1.status).toBe(201);

    // Create plan for second invoice (same patient — EC6 allows this)
    const res2 = await app.request(`/dental/billing/invoices/${inv2.id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        numberOfInstallments: 6,
        frequency: 'monthly',
        startDate: new Date().toISOString(),
      }),
    });
    expect(res2.status).toBe(201);
    const body2 = await res2.json() as any;
    expect(body2.invoiceId).toBe(inv2.id);
    expect(body2.installments).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Role gates — issueDentalInvoice (dentist_* only) + voidDentalInvoice (dentist_owner only)
// ---------------------------------------------------------------------------

describe('issueDentalInvoice role gate', () => {
  test('staff_full → 403', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/issue`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  test('dentist_owner → passes role gate (not 403)', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/issue`, { method: 'POST' });
    expect(res.status).not.toBe(403);
  });
});

describe('voidDentalInvoice role gate', () => {
  test('staff_full → 403', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  test('dentist_associate → 403 (owner-only operation)', async () => {
    const associateUser = { id: '00000000-0000-0000-0000-000000000098', email: 'assoc@clinic.com' };
    const { dentalMemberships: dm } = await import('@/handlers/dental-org/repos/membership.schema');
    await db.insert(dm).values({ id: '7c000000-0000-4000-8000-000000000a98', branchId: BRANCH_ID, personId: associateUser.id, displayName: 'Associate', role: 'dentist_associate', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
    const { invoice } = await seedInvoice();
    const app = buildTestApp(associateUser);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  test('staff_scheduling → 403', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(SCHEDULING_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  test('dentist_owner → passes role gate (not 403)', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, { method: 'POST' });
    expect(res.status).not.toBe(403);
  });
});

// ── GAP-009: Discount reason + discountedBy persistence (AC-001..AC-003) ──────

describe('GAP-009: discount reason and actor persistence', () => {
  // AC-001 + AC-002: reason and discountedBy stored in DB and returned
  test('AC-001/AC-002: discountReason and discountedBy returned after applying discount', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Senior citizen discount', percentageRate: 20 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.discountReason).toBe('Senior citizen discount');
    expect(body.discountedBy).toBe(TEST_USER.id);
  });

  // AC-003: empty reason → error
  test('AC-003: empty reason string → 422 DISCOUNT_REASON_REQUIRED', async () => {
    const { invoice } = await seedInvoice();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: '   ', percentageRate: 10 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('DISCOUNT_REASON_REQUIRED');
  });
});
