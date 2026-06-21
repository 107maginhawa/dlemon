/**
 * refundDentalPayment.concurrency.test.ts — concurrent double-refund race.
 *
 * BR-053 caps a refund at the un-refunded remainder: refundable =
 * payment.amountCents − totalRefundedForPayment(paymentId). Read-then-write that
 * value under READ COMMITTED races — two concurrent refunds could both read
 * alreadyRefunded=0, both pass the cap, and both insert a refund row + removePayment,
 * together refunding MORE than the payment ever collected (money paid out twice).
 *
 * The handler already guards this with a per-payment `pg_advisory_xact_lock(1002,
 * hashtext(paymentId))` taken at the top of the tx, which serializes refunds of the
 * same payment so the alreadyRefunded read + refund write are atomic. This test pins
 * that protection.
 *
 * RED-proof: remove the `pg_advisory_xact_lock` line from refundDentalPayment.ts and a
 * round races → both 200, total refunded 6000 > payment 5000, two refund rows.
 * GREEN: every round yields exactly one 200 + one 422 EXCEEDS_REFUNDABLE and the total
 * refunded for the payment never exceeds the amount collected.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { createDentalInvoice } from './createDentalInvoice';
import { recordDentalPayment } from './recordDentalPayment';
import { refundDentalPayment } from './refundDentalPayment';
import {
  CreateDentalInvoiceBody,
  RecordDentalPaymentBody,
  RecordDentalPaymentParams,
  RefundDentalPaymentBody,
  RefundDentalPaymentParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 107.
const USER = { id: '00000000-0000-4000-8000-000000107001', email: 'owner@refundrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000107001';
const BRANCH = 'ba000000-0000-4000-8000-000000107001';
const MEMBER = 'ca000000-0000-4000-8000-000000107001';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payment_refund, dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'RefundRace Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

/** Seed a fresh patient + active visit + a ₱50 (5000c) performed treatment + signed consent. */
async function seedBillableVisit(): Promise<{ visitId: string; patientId: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'Refund', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id });
  await db.insert(patients).values({ id: patientId, person: personId, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id });
  const visitRepo = new VisitRepository(db);
  const v = await visitRepo.createOne({ patientId, branchId: BRANCH, dentistMemberId: MEMBER });
  const visit = await visitRepo.activate(v.id);
  await new TreatmentRepository(db).createOne({ visitId: visit!.id, patientId, cdtCode: 'D2150', description: 'Amalgam', priceCents: 5000, carriedOver: false, status: 'performed' });
  await db.insert(consentForms).values({ id: crypto.randomUUID(), visitId: visit!.id, patientId, templateId: 'general-consent-v1', templateName: 'General Treatment Consent', signed: true, signedAt: new Date(), signatureData: 'x', createdBy: USER.id, updatedBy: USER.id });
  return { visitId: visit!.id, patientId };
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
    ctx.set('session', { id: 'sess', userId: USER.id });
    await next();
  });
  app.post('/dental/billing/invoices', zValidator('json', CreateDentalInvoiceBody, ve), createDentalInvoice as any);
  app.post('/dental/billing/invoices/:invoiceId/payments', zValidator('param', RecordDentalPaymentParams, ve), zValidator('json', RecordDentalPaymentBody, ve), recordDentalPayment as any);
  app.post('/dental/billing/payments/:paymentId/refund', zValidator('param', RefundDentalPaymentParams, ve), zValidator('json', RefundDentalPaymentBody, ve), refundDentalPayment as any);
  return app;
}

/** Create the invoice from the visit, then issue it (draft → issued). Returns id. */
async function seedIssuedInvoice(visitId: string, patientId: string): Promise<{ invoiceId: string }> {
  const res = await buildApp().request('/dental/billing/invoices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId, patientId, branchId: BRANCH, dentistMemberId: MEMBER }),
  });
  if (res.status !== 201) throw new Error(`create invoice: ${res.status} ${await res.text()}`);
  const inv = await res.json() as { id: string };
  await new DentalInvoiceRepository(db).issue(inv.id);
  return { invoiceId: inv.id };
}

/** Record a full payment via the real handler; returns the created payment id. */
async function record(invoiceId: string, amountCents: number): Promise<string> {
  const res = await buildApp().request(`/dental/billing/invoices/${invoiceId}/payments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents, method: 'cash', recordedByMemberId: MEMBER }),
  });
  if (res.status !== 201) throw new Error(`record payment: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

function refund(paymentId: string, amountCents: number) {
  return buildApp().request(`/dental/billing/payments/${paymentId}/refund`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents, reason: 'overcharge correction' }),
  });
}

async function state(invoiceId: string, paymentId: string): Promise<{ paid: number; total: number; refundedSum: number; refundCount: number }> {
  const ir = await db.execute(sql`SELECT paid_cents, total_cents FROM dental_invoice WHERE id = ${invoiceId}`);
  const i = (ir as any).rows?.[0] ?? (ir as any)[0];
  const rr = await db.execute(sql`SELECT COALESCE(SUM(amount_cents),0)::int AS s, COUNT(*)::int AS n FROM dental_payment_refund WHERE payment_id = ${paymentId}`);
  const r = (rr as any).rows?.[0] ?? (rr as any)[0];
  return { paid: Number(i.paid_cents), total: Number(i.total_cents), refundedSum: Number(r.s), refundCount: Number(r.n) };
}

describe('refundDentalPayment — concurrent refunds cannot over-refund a payment', () => {
  test('two simultaneous refunds each <= amount but summing > amount → exactly one 200, one 422 EXCEEDS_REFUNDABLE', async () => {
    const ROUNDS = 8;
    for (let i = 0; i < ROUNDS; i++) {
      const { visitId, patientId } = await seedBillableVisit();
      const { invoiceId } = await seedIssuedInvoice(visitId, patientId);
      const paymentId = await record(invoiceId, 5000); // full payment

      // Two refunds of 3000: each <= the 5000 collected, but 6000 together exceeds it.
      const [a, b] = await Promise.all([refund(paymentId, 3000), refund(paymentId, 3000)]);
      const statuses = [a.status, b.status];

      const { paid, total, refundedSum, refundCount } = await state(invoiceId, paymentId);

      // Money-integrity invariant: never refund more than was collected on the payment.
      expect(refundedSum, `round ${i}: total refunded must not exceed the 5000 collected (refundedSum=${refundedSum} statuses=${statuses})`).toBeLessThanOrEqual(5000);
      expect(refundedSum, `round ${i}: exactly one 3000 refund may post`).toBe(3000);
      expect(refundCount, `round ${i}: exactly one refund row may exist`).toBe(1);
      // Invoice reversed by exactly one refund: paid 5000 − 3000 = 2000.
      expect(paid, `round ${i}: invoice paid reflects a single reversal`).toBe(2000);
      expect(total).toBe(5000);

      const winners = [a, b].filter((r) => r.status === 200);
      expect(winners.length, `round ${i}: exactly one refund may succeed (statuses ${statuses})`).toBe(1);
      const loser = [a, b].find((r) => r.status !== 200)!;
      expect(loser.status, `round ${i}: the loser must be a clean 422`).toBe(422);
      const loserBody = (await loser.json()) as { code?: string };
      expect(loserBody.code, `round ${i}: loser must be EXCEEDS_REFUNDABLE`).toBe('EXCEEDS_REFUNDABLE');

      await db.execute(sql`TRUNCATE TABLE dental_payment_refund, dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
    }
  });
});
