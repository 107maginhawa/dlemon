/**
 * RLS P1b activation — dental-billing invoices + payments (Tier-1 activation).
 *
 * P0/P1a armed RLS on dental_invoice + dental_payment but the app connects as
 * the postgres superuser (bypasses RLS) so the second wall is dormant. P1b
 * ACTIVATES it on the request path by routing each handler's payload DB access
 * through `withTenantTx({branchIds:[branch]})` — opening a tx, publishing the
 * branch scope, and `SET LOCAL ROLE app_rls` so the query is filtered by the
 * policies.
 *
 * Activation contract per handler (the locked pattern from dental_visit):
 *   - Entity-resolution fetch + authz (assertBranchRole/assertBranchAccess) +
 *     audit writes + deliberate cross-tenant guards (the GLOBAL receipt-number
 *     uniqueness check in recordDentalPayment) STAY on the bypassing db
 *     connection → exact existing 403/409 behavior preserved.
 *   - The payload reads/writes wrap in withTenantTx.
 *   - Pure single-row-by-PK GET (getDentalInvoice) gets NO wrap (wrapping a
 *     by-PK GET flips 403→404 and is not the enumeration leak class).
 *
 * RED-first: each activated handler must OPEN a tenant transaction — observable
 * as a db.transaction() call (logAuditEvent is a plain insert, never a tx).
 * Before activation these handlers read the pooled db directly → ZERO
 * transactions → the routing assertion FAILS. The happy-path result proves the
 * branch scope passed to withTenantTx was correct (a wrong/empty scope → RLS
 * returns/blocks 0 rows under app_rls → the write/read would break).
 *
 * Runs against its own cloned DB (scripts/test-with-db.ts) carrying migrations
 * 0104–0106.
 */

import { describe, test, expect, beforeAll, afterEach, spyOn } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { createDentalInvoice } from './createDentalInvoice';
import { listDentalInvoices } from './listDentalInvoices';
import { getDentalInvoice } from './getDentalInvoice';
import { issueDentalInvoice } from './issueDentalInvoice';
import { voidDentalInvoice } from './voidDentalInvoice';
import { applyDentalDiscount } from './applyDentalDiscount';
import { markUncollectible } from './markUncollectible';
import { recordDentalPayment } from './recordDentalPayment';
import { voidDentalPayment } from './voidDentalPayment';
import { listDentalPayments } from './listDentalPayments';
import {
  CreateDentalInvoiceBody,
  ListDentalInvoicesQuery,
  GetDentalInvoiceParams,
  IssueDentalInvoiceParams,
  VoidDentalInvoiceParams,
  VoidDentalInvoiceBody,
  ApplyDentalDiscountBody,
  ApplyDentalDiscountParams,
  MarkUncollectibleParams,
  RecordDentalPaymentBody,
  RecordDentalPaymentParams,
  VoidDentalPaymentBody,
  VoidDentalPaymentParams,
  ListDentalPaymentsParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// File-unique ids (own clone, distinct prefix 1bb = P1b billing invoices/payments).
const USER = { id: '1bb00000-0000-4000-8000-00000000a001', email: 'owner@a.com' };
const ORG = '1bb00000-0000-4000-8000-00000000a002';
const BRANCH = '1bb00000-0000-4000-8000-00000000a003';
const MEMBER = '1bb00000-0000-4000-8000-00000000a004';
const PERSON = '1bb00000-0000-4000-8000-00000000a005';
const PATIENT = '1bb00000-0000-4000-8000-00000000a006';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({ id: ORG, name: '1bb Clinic A', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Test', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
});

/** Seed an active visit with a performed (billable) treatment + signed consent. */
async function seedBillableVisit(): Promise<string> {
  const visitRepo = new VisitRepository(db);
  const v = await visitRepo.createOne({ patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER });
  const visit = await visitRepo.activate(v.id);
  const visitId = visit!.id;
  await new TreatmentRepository(db).createOne({
    visitId, patientId: PATIENT, cdtCode: 'D2150', description: 'Amalgam',
    priceCents: 5000, carriedOver: false, status: 'performed',
  });
  await db.insert(consentForms).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT,
    templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
    signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,test',
    createdBy: USER.id, updatedBy: USER.id,
  });
  return visitId;
}

/** Seed an invoice directly (as superuser) in the given status. */
async function seedInvoice(opts: { status?: string; totalCents?: number; paidCents?: number; balanceCents?: number } = {}) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const total = opts.totalCents ?? 10000;
  const paid = opts.paidCents ?? 0;
  const balance = opts.balanceCents ?? total - paid;
  const [row] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER,
    invoiceNumber: await invoiceRepo.generateInvoiceNumber(),
    status: (opts.status ?? 'issued') as any,
    subtotalCents: total, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: total, paidCents: paid, balanceCents: balance, issuedAt: new Date(),
    createdBy: USER.id, updatedBy: USER.id,
  }).returning();
  return row!;
}

async function seedPayment(invoiceId: string, amountCents = 5000) {
  return new DentalPaymentRepository(db).createOne({
    invoiceId, patientId: PATIENT, branchId: BRANCH, amountCents, method: 'cash',
    receiptNumber: `RCP-1bb-${crypto.randomUUID().slice(0, 8)}`, recordedByMemberId: MEMBER,
  });
}

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
    ctx.set('session', { id: 's', userId: USER.id });
    ctx.set('requestId', 'test-req');
    await next();
  });
  app.post('/dental/billing/invoices', zValidator('json', CreateDentalInvoiceBody, ve), createDentalInvoice as any);
  app.get('/dental/billing/invoices', zValidator('query', ListDentalInvoicesQuery, ve), listDentalInvoices as any);
  app.get('/dental/billing/invoices/:invoiceId', zValidator('param', GetDentalInvoiceParams, ve), getDentalInvoice as any);
  app.patch('/dental/billing/invoices/:invoiceId/issue', zValidator('param', IssueDentalInvoiceParams, ve), issueDentalInvoice as any);
  app.post('/dental/billing/invoices/:invoiceId/void', zValidator('param', VoidDentalInvoiceParams, ve), zValidator('json', VoidDentalInvoiceBody, ve), voidDentalInvoice as any);
  app.post('/dental/billing/invoices/:invoiceId/discount', zValidator('param', ApplyDentalDiscountParams, ve), zValidator('json', ApplyDentalDiscountBody, ve), applyDentalDiscount as any);
  app.post('/dental/billing/invoices/:invoiceId/uncollectible', zValidator('param', MarkUncollectibleParams, ve), markUncollectible as any);
  app.post('/dental/billing/invoices/:invoiceId/payments', zValidator('param', RecordDentalPaymentParams, ve), zValidator('json', RecordDentalPaymentBody, ve), recordDentalPayment as any);
  app.post('/dental/billing/invoices/:invoiceId/payments/:paymentId/void', zValidator('param', VoidDentalPaymentParams, ve), zValidator('json', VoidDentalPaymentBody, ve), voidDentalPayment as any);
  app.get('/dental/billing/invoices/:invoiceId/payments', zValidator('param', ListDentalPaymentsParams, ve), listDentalPayments as any);
  return app;
}

describe('RLS P1b — dental-billing invoices/payments route through withTenantTx (activation)', () => {
  test('createDentalInvoice opens a tenant tx and writes the invoice under app_rls scope', async () => {
    const visitId = await seedBillableVisit();
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/billing/invoices', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visitId, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.branchId).toBe(BRANCH);           // CORRECT SCOPE (WITH CHECK passed)
      expect(body.lineItems.length).toBe(1);
      expect(txSpy).toHaveBeenCalled();             // ROUTING (RED before activation)
    } finally {
      txSpy.mockRestore();
    }
  });

  test('listDentalInvoices opens a tenant tx and returns the branch invoice', async () => {
    const inv = await seedInvoice();
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices?branchId=${BRANCH}`);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.map((i: any) => i.id)).toContain(inv.id);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('getDentalInvoice (by-PK GET) does NOT open a tenant tx (left unwrapped by design)', async () => {
    const inv = await seedInvoice();
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices/${inv.id}`);
      expect(res.status).toBe(200);
      expect(txSpy).not.toHaveBeenCalled();         // by-PK GET stays on db (no 403→404 flip)
    } finally {
      txSpy.mockRestore();
    }
  });

  test('issueDentalInvoice opens a tenant tx and transitions draft→issued', async () => {
    const inv = await seedInvoice({ status: 'draft' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices/${inv.id}/issue`, { method: 'PATCH' });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('issued');
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('applyDentalDiscount opens a tenant tx and writes the discount', async () => {
    const inv = await seedInvoice({ status: 'issued' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices/${inv.id}/discount`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ percentageRate: 10, reason: 'Senior discount' }),
      });
      expect(res.status).toBe(200);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('markUncollectible opens a tenant tx and writes the write-off', async () => {
    const inv = await seedInvoice({ status: 'issued' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices/${inv.id}/uncollectible`, { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('uncollectible');
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('recordDentalPayment opens a tenant tx and records the payment', async () => {
    const inv = await seedInvoice({ status: 'issued', totalCents: 10000, balanceCents: 10000 });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices/${inv.id}/payments`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountCents: 4000, method: 'cash', recordedByMemberId: MEMBER }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.branchId).toBe(BRANCH);           // CORRECT SCOPE (WITH CHECK passed)
      expect(body.amountCents).toBe(4000);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('voidDentalInvoice opens a tenant tx and voids the invoice', async () => {
    const inv = await seedInvoice({ status: 'issued' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices/${inv.id}/void`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Duplicate invoice created in error' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('voided');
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('voidDentalPayment opens a tenant tx and reverses the payment', async () => {
    const inv = await seedInvoice({ status: 'partial', totalCents: 10000, paidCents: 5000, balanceCents: 5000 });
    const payment = await seedPayment(inv.id, 5000);
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices/${inv.id}/payments/${payment.id}/void`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voidReason: 'Entered wrong amount' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.isVoid).toBe(true);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('listDentalPayments opens a tenant tx and returns the invoice payments', async () => {
    const inv = await seedInvoice({ status: 'partial', totalCents: 10000, paidCents: 5000, balanceCents: 5000 });
    const payment = await seedPayment(inv.id, 5000);
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices/${inv.id}/payments`);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.map((p: any) => p.id)).toContain(payment.id);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });
});
