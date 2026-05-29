/**
 * dental-billing domain-event audit-trace tests
 *
 * Per ADR-006, billing domain events are AUDIT-LOG-ONLY semantic markers — there is
 * no event bus. A "publish" is satisfied by the producer writing a synchronous
 * dental_audit_log row via logAuditEvent. A publisher test therefore:
 *   1. triggers the producing HTTP action (via app.request through the real handler), then
 *   2. asserts a dental_audit_log row exists with the expected action / targetType /
 *      targetId / actorId.
 *
 * Events covered (previously untraced — TRACE_REPORT TR-P1-04):
 *   DE-007 InvoiceCreated  → action 'invoice.create'  / target dental_invoice
 *   DE-008 InvoicePaid     → action 'invoice.paid'    / target dental_invoice
 *   DE-009 InvoiceVoided   → action 'invoice.voided'  / target dental_invoice
 *
 * Consumer / idempotency tests are out of scope (no bus, per ADR-006).
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateDentalInvoiceBody,
  RecordDentalPaymentParams, RecordDentalPaymentBody,
  VoidDentalInvoiceParams,
} from '@/generated/openapi/validators';
import { createDentalInvoice } from './createDentalInvoice';
import { recordDentalPayment } from './recordDentalPayment';
import { voidDentalInvoice } from './voidDentalInvoice';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'billing-de@clinic.com' };
const PERSON_ID  = 'ee000000-0000-1000-8000-0000000be001';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000be001';
const BRANCH_ID  = 'bb000000-0000-1000-8000-0000000be002';
const MEMBER_ID  = 'cc000000-0000-1000-8000-0000000be003';
const ORG_ID     = 'ec000000-0000-1000-8000-0000000be001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Billing-DE Clinic', tier: 'solo', ownerPersonId: TEST_USER.id,
    countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Owner',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Billing', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  const visitIds = sql`(SELECT id FROM dental_visit WHERE patient_id = ${PATIENT_ID})`;
  await db.execute(sql`DELETE FROM dental_audit_log WHERE branch_id = ${BRANCH_ID}`);
  await db.execute(sql`DELETE FROM dental_payment WHERE patient_id = ${PATIENT_ID}`);
  await db.execute(sql`DELETE FROM dental_invoice WHERE patient_id = ${PATIENT_ID}`);
  await db.execute(sql`DELETE FROM consent_form WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM dental_treatment WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM dental_visit WHERE patient_id = ${PATIENT_ID}`);
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

function buildTestApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', TEST_USER);
    ctx.set('session', { id: 'test-session', userId: TEST_USER.id });
    await next();
  });
  app.post('/dental/billing/invoices', zValidator('json', CreateDentalInvoiceBody, ve), createDentalInvoice as any);
  app.post('/dental/billing/invoices/:invoiceId/payments',
    zValidator('param', RecordDentalPaymentParams, ve),
    zValidator('json', RecordDentalPaymentBody, ve),
    recordDentalPayment as any);
  app.post('/dental/billing/invoices/:invoiceId/void',
    zValidator('param', VoidDentalInvoiceParams, ve),
    voidDentalInvoice as any);
  return app;
}

// Seed a visit + a billable (performed) treatment + a signed consent so that
// createDentalInvoice's BR-014 (consent) and NO_BILLABLE_TREATMENTS guards pass.
async function seedBillableVisit() {
  const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
  const { TreatmentRepository } = await import('@/handlers/dental-visit/repos/treatment.repo');
  const { ConsentFormRepository } = await import('@/handlers/dental-clinical/repos/consent-form.repo');
  const visitRepo = new VisitRepository(db);
  const treatRepo = new TreatmentRepository(db);
  const consentRepo = new ConsentFormRepository(db);

  const visit = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
  const treatment = await treatRepo.createOne({
    visitId: visit.id, patientId: PATIENT_ID, cdtCode: 'D2740',
    description: 'Crown', priceCents: 50000, carriedOver: false,
  });
  await treatRepo.updateStatus(treatment.id, 'performed');

  const consent = await consentRepo.createOne({
    visitId: visit.id, patientId: PATIENT_ID,
    templateId: 'tpl-de', templateName: 'Treatment Consent',
  });
  await consentRepo.sign(consent.id, 'data:image/png;base64,SIG');
  return visit;
}

async function auditRows(action: string, targetId: string) {
  return db.select().from(dentalAuditLog)
    .where(and(eq(dentalAuditLog.action, action), eq(dentalAuditLog.targetId, targetId)));
}

async function createInvoiceViaApi(app: ReturnType<typeof buildTestApp>, visitId: string) {
  const res = await app.request('/dental/billing/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID }),
  });
  return res;
}

// ---------------------------------------------------------------------------
// DE-007 InvoiceCreated
// ---------------------------------------------------------------------------

describe('DE-007 InvoiceCreated — audit-row marker on invoice creation', () => {
  test('writes a dental_audit_log row (invoice.create) referencing the new invoice', async () => {
    const app = buildTestApp();
    const visit = await seedBillableVisit();

    const res = await createInvoiceViaApi(app, visit.id);
    expect(res.status).toBe(201);
    const invoice = await res.json() as any;

    const rows = await auditRows('invoice.create', invoice.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('dental_invoice');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
    expect(rows[0]?.branchId).toBe(BRANCH_ID);
  });

  test('does NOT write an invoice.create row when creation fails (no billable treatments)', async () => {
    const app = buildTestApp();
    const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
    const { ConsentFormRepository } = await import('@/handlers/dental-clinical/repos/consent-form.repo');
    const visit = await new VisitRepository(db).createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
    const consent = await new ConsentFormRepository(db).createOne({ visitId: visit.id, patientId: PATIENT_ID, templateId: 't', templateName: 'C' });
    await new ConsentFormRepository(db).sign(consent.id, 'data:image/png;base64,SIG');

    const res = await createInvoiceViaApi(app, visit.id);
    expect(res.status).toBe(422);

    const rows = await db.select().from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'invoice.create'), eq(dentalAuditLog.branchId, BRANCH_ID)));
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DE-008 InvoicePaid
// ---------------------------------------------------------------------------

describe('DE-008 InvoicePaid — audit-row marker only on transition to fully paid', () => {
  test('writes a dental_audit_log row (invoice.paid) when a payment fully settles the invoice', async () => {
    const app = buildTestApp();
    const visit = await seedBillableVisit();
    const createRes = await createInvoiceViaApi(app, visit.id);
    const invoice = await createRes.json() as any;

    // Pay the full balance (50000) → status transitions to 'paid'
    const payRes = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: invoice.totalCents, method: 'cash', recordedByMemberId: MEMBER_ID }),
    });
    expect(payRes.status).toBe(201);

    const rows = await auditRows('invoice.paid', invoice.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('dental_invoice');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
  });

  test('does NOT write invoice.paid on a partial payment (no full-paid transition)', async () => {
    const app = buildTestApp();
    const visit = await seedBillableVisit();
    const createRes = await createInvoiceViaApi(app, visit.id);
    const invoice = await createRes.json() as any;

    const payRes = await app.request(`/dental/billing/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 1000, method: 'cash', recordedByMemberId: MEMBER_ID }),
    });
    expect(payRes.status).toBe(201);

    expect(await auditRows('invoice.paid', invoice.id)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DE-009 InvoiceVoided
// ---------------------------------------------------------------------------

describe('DE-009 InvoiceVoided — audit-row marker on void', () => {
  test('writes a dental_audit_log row (invoice.voided) referencing the voided invoice', async () => {
    const app = buildTestApp();
    const visit = await seedBillableVisit();
    const createRes = await createInvoiceViaApi(app, visit.id);
    const invoice = await createRes.json() as any;

    const voidRes = await app.request(`/dental/billing/invoices/${invoice.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Billing error' }),
    });
    expect(voidRes.status).toBe(200);

    const rows = await auditRows('invoice.voided', invoice.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('dental_invoice');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
  });

  test('does NOT write invoice.voided when void fails (404 unknown invoice)', async () => {
    const app = buildTestApp();
    const NONEXISTENT = 'ffffffff-ffff-1000-8000-ffffffffffff';
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'x' }),
    });
    expect(res.status).toBe(404);
    expect(await auditRows('invoice.voided', NONEXISTENT)).toHaveLength(0);
  });
});
