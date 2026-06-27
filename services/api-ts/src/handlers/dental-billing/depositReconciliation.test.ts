/**
 * depositReconciliation.test.ts — §g S-D money path (the critical correctness proof).
 *
 * Proves the deposit → credit → performed-invoice reconciliation conserves money:
 *  - paying a deposit invoice MIRRORS the cash into the patient credit wallet;
 *  - applying that credit to the performed-work invoice reduces its balance with
 *    NO double-charge (total cash collected == the job total, one OR per peso);
 *  - F-01: refunding a deposit BEFORE it is applied REVERSES the mirrored credit
 *    (no money from nothing); refunding AFTER it is applied is BLOCKED;
 *  - F-07: credit cannot be applied to a deposit invoice (no self-application).
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { DentalPatientCreditRepository } from './repos/dental-patient-credit.repo';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { createDentalDepositInvoice } from './createDentalDepositInvoice';
import { createDentalInvoice } from './createDentalInvoice';
import { issueDentalInvoice } from './issueDentalInvoice';
import { recordDentalPayment } from './recordDentalPayment';
import { refundDentalPayment } from './refundDentalPayment';
import { voidDentalPayment } from './voidDentalPayment';
import { applyCreditToInvoice } from './applyCreditToInvoice';
import {
  CreateDentalDepositInvoiceBody, CreateDentalInvoiceBody, IssueDentalInvoiceParams,
  RecordDentalPaymentBody, RecordDentalPaymentParams,
  RefundDentalPaymentBody, RefundDentalPaymentParams,
  VoidDentalPaymentBody, VoidDentalPaymentParams,
  ApplyCreditToInvoiceBody, ApplyCreditToInvoiceParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: dec0 (hex).
const USER = { id: '00000000-0000-4000-8000-0000dec00001', email: 'owner@dec.com' };
const ORG = 'ea000000-0000-4000-8000-0000dec00001';
const BRANCH = 'ba000000-0000-4000-8000-0000dec00001';
const MEMBER = 'ca000000-0000-4000-8000-0000dec00001';
const PERSON = 'fa000000-0000-4000-8000-0000dec00001';
const PATIENT = 'aa000000-0000-4000-8000-0000dec00001';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'Reconcile Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Reconcile', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payment_refund, dental_patient_credit, dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
});

const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: 'Validation failed', issues: r.error.issues }, 400); };

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    ctx.set('user', USER);
    ctx.set('session', { id: 'sess', userId: USER.id });
    ctx.set('requestId', 'test-req');
    await next();
  });
  app.post('/dental/billing/invoices/deposit', zValidator('json', CreateDentalDepositInvoiceBody, ve), createDentalDepositInvoice as any);
  app.post('/dental/billing/invoices', zValidator('json', CreateDentalInvoiceBody, ve), createDentalInvoice as any);
  app.patch('/dental/billing/invoices/:invoiceId/issue', zValidator('param', IssueDentalInvoiceParams, ve), issueDentalInvoice as any);
  app.post('/dental/billing/invoices/:invoiceId/payments', zValidator('param', RecordDentalPaymentParams, ve), zValidator('json', RecordDentalPaymentBody, ve), recordDentalPayment as any);
  app.post('/dental/billing/invoices/:invoiceId/apply-credit', zValidator('param', ApplyCreditToInvoiceParams, ve), zValidator('json', ApplyCreditToInvoiceBody, ve), applyCreditToInvoice as any);
  app.post('/dental/billing/payments/:paymentId/refund', zValidator('param', RefundDentalPaymentParams, ve), zValidator('json', RefundDentalPaymentBody, ve), refundDentalPayment as any);
  app.post('/dental/billing/invoices/:invoiceId/payments/:paymentId/void', zValidator('param', VoidDentalPaymentParams, ve), zValidator('json', VoidDentalPaymentBody, ve), voidDentalPayment as any);
  return app;
}
const app = buildApp();

async function seedPlannedVisit(estimateCents = 6300): Promise<string> {
  const visitRepo = new VisitRepository(db);
  const v = await visitRepo.createOne({ patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER });
  const visit = await visitRepo.activate(v.id);
  await new TreatmentRepository(db).createOne({
    visitId: visit!.id, patientId: PATIENT, cdtCode: 'D2740', description: 'Crown',
    priceCents: estimateCents, carriedOver: false, status: 'planned',
  });
  return visit!.id;
}

async function makeDeposit(visitId: string, depositCents: number) {
  const res = await app.request('/dental/billing/invoices/deposit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, depositCents }),
  });
  return res;
}

async function pay(invoiceId: string, amountCents: number) {
  return app.request(`/dental/billing/invoices/${invoiceId}/payments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents, method: 'cash', recordedByMemberId: MEMBER }),
  });
}

/** Flip the visit's planned treatments to performed + sign consent so
 *  createDentalInvoice can mint the performed-work invoice. */
async function performAndConsent(visitId: string) {
  await db.execute(sql`UPDATE dental_treatment SET status = 'performed' WHERE visit_id = ${visitId}`);
  await db.insert(consentForms).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT,
    templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
    signed: true, signedAt: new Date(), signatureData: 'x', createdBy: USER.id, updatedBy: USER.id,
  });
}

async function balance(): Promise<number> {
  return new DentalPatientCreditRepository(db).getBalance(PATIENT);
}

describe('§g S-D deposit reconciliation', () => {
  test('paying a deposit mirrors the cash into the patient credit wallet', async () => {
    const visitId = await seedPlannedVisit(6300);
    const dep = await (await makeDeposit(visitId, 3000)).json() as any;
    await pay(dep.id, 3000);
    expect(await balance()).toBe(3000);   // mirrored
  });

  test('reconciles to the performed invoice with NO double-charge (cash == job total)', async () => {
    const visitId = await seedPlannedVisit(6300);
    const dep = await (await makeDeposit(visitId, 3000)).json() as any;
    await pay(dep.id, 3000);                                   // deposit cash 3000 (OR #1)
    expect(await balance()).toBe(3000);

    await performAndConsent(visitId);
    const perf = await (await app.request('/dental/billing/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER }),
    })).json() as any;
    expect(perf.totalCents).toBe(6300);
    await app.request(`/dental/billing/invoices/${perf.id}/issue`, { method: 'PATCH' });

    // Apply the deposit credit to the performed invoice (no new OR).
    const applied = await app.request(`/dental/billing/invoices/${perf.id}/apply-credit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountCents: 3000 }),
    });
    expect(applied.status).toBe(200);
    const ar = await applied.json() as any;
    expect(ar.invoiceBalanceCents).toBe(3300);                // 6300 - 3000 credit
    expect(await balance()).toBe(0);                          // credit consumed

    await pay(perf.id, 3300);                                 // remaining cash 3300 (OR #2)
    const repo = new DentalInvoiceRepository(db);
    const finalPerf = await repo.findOneById(perf.id);
    expect(finalPerf!.status).toBe('paid');
    expect(finalPerf!.balanceCents).toBe(0);

    // No double-charge: actual cash = 3000 (deposit) + 3300 (performed) = 6300 == job.
    const cashRows = await db.execute(sql`SELECT COALESCE(SUM(amount_cents),0)::int AS n FROM dental_payment WHERE patient_id = ${PATIENT} AND is_void = false`);
    expect((((cashRows as any).rows ?? cashRows)[0]).n).toBe(6300);
  });

  test('F-01: refunding a deposit BEFORE it is applied reverses the credit (no leak)', async () => {
    const visitId = await seedPlannedVisit(6300);
    const dep = await (await makeDeposit(visitId, 3000)).json() as any;
    const payment = await (await pay(dep.id, 3000)).json() as any;
    expect(await balance()).toBe(3000);

    const refund = await app.request(`/dental/billing/payments/${payment.id}/refund`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 3000, reason: 'Patient cancelled the plan' }),
    });
    expect(refund.status).toBe(200);
    expect(await balance()).toBe(0);                          // mirrored credit reversed
  });

  test('F-01: refunding a deposit AFTER it is applied is BLOCKED (money conserved)', async () => {
    const visitId = await seedPlannedVisit(6300);
    const dep = await (await makeDeposit(visitId, 3000)).json() as any;
    const payment = await (await pay(dep.id, 3000)).json() as any;

    await performAndConsent(visitId);
    const perf = await (await app.request('/dental/billing/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER }),
    })).json() as any;
    await app.request(`/dental/billing/invoices/${perf.id}/issue`, { method: 'PATCH' });
    await app.request(`/dental/billing/invoices/${perf.id}/apply-credit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountCents: 3000 }),
    });
    expect(await balance()).toBe(0);                          // deposit spent

    const refund = await app.request(`/dental/billing/payments/${payment.id}/refund`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 3000, reason: 'Trying to refund spent deposit' }),
    });
    expect(refund.status).toBe(422);
    expect((await refund.json() as any).code).toBe('DEPOSIT_ALREADY_APPLIED');
  });

  test('F-01 (void path): voiding a deposit payment reverses the mirrored credit', async () => {
    const visitId = await seedPlannedVisit(6300);
    const dep = await (await makeDeposit(visitId, 3000)).json() as any;
    const payment = await (await pay(dep.id, 3000)).json() as any;
    expect(await balance()).toBe(3000);

    const voided = await app.request(`/dental/billing/invoices/${dep.id}/payments/${payment.id}/void`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voidReason: 'Wrong amount entered' }),
    });
    expect(voided.status).toBe(200);
    expect(await balance()).toBe(0);                          // mirror reversed — no money from nothing
  });

  test('F-07: credit cannot be applied to a deposit invoice (no self-application)', async () => {
    const visitId = await seedPlannedVisit(6300);
    const dep = await (await makeDeposit(visitId, 3000)).json() as any;
    await pay(dep.id, 3000);                                  // credit 3000 now available
    const res = await app.request(`/dental/billing/invoices/${dep.id}/apply-credit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountCents: 1000 }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('INVOICE_IS_DEPOSIT');
  });
});
