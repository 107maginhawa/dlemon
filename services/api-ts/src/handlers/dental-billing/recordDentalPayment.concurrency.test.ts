/**
 * recordDentalPayment.concurrency.test.ts — concurrent overpayment race.
 *
 * The V-BIL-004 overpayment guard (recordDentalPayment.ts) compares amountCents to
 * invoice.balanceCents read by a plain SELECT BEFORE the transaction. Under READ
 * COMMITTED, two concurrent payments each <= balance but SUMMING > balance both pass
 * the guard, and addPayment incremented paidCents unconditionally → paid_cents >
 * total_cents (money collected past the balance; GREATEST(0,…) masks the negative true
 * balance). Only the sequential case was tested.
 *
 * Fix: addPayment is now called with { guardBalance: true } so its UPDATE applies only
 * when balance_cents >= amount AT WRITE TIME; the losing concurrent write matches 0 rows
 * (null) and the handler throws PAYMENT_EXCEEDS_BALANCE, aborting the tx.
 *
 * RED-proof: with guardBalance removed, a round races (both 201 → paid 8000 > total 5000).
 * GREEN: every round yields exactly one 201 + one 422 and paid_cents <= total_cents.
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
import { CreateDentalInvoiceBody, RecordDentalPaymentBody, RecordDentalPaymentParams } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 105.
const USER = { id: '00000000-0000-4000-8000-000000105001', email: 'owner@payrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000105001';
const BRANCH = 'ba000000-0000-4000-8000-000000105001';
const MEMBER = 'ca000000-0000-4000-8000-000000105001';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'PayRace Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

/** Seed a fresh patient + active visit + a ₱50 (5000c) performed treatment + signed consent. */
async function seedBillableVisit(): Promise<{ visitId: string; patientId: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'Pay', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id });
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
  return app;
}

/** Create the invoice from the visit, then issue it (draft → issued). Returns id + balance. */
async function seedIssuedInvoice(visitId: string, patientId: string): Promise<{ invoiceId: string; balanceCents: number }> {
  const res = await buildApp().request('/dental/billing/invoices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId, patientId, branchId: BRANCH, dentistMemberId: MEMBER }),
  });
  if (res.status !== 201) throw new Error(`create invoice: ${res.status} ${await res.text()}`);
  const inv = await res.json() as { id: string; totalCents: number };
  const issued = await new DentalInvoiceRepository(db).issue(inv.id);
  return { invoiceId: inv.id, balanceCents: issued!.balanceCents };
}

function pay(invoiceId: string, amountCents: number) {
  return buildApp().request(`/dental/billing/invoices/${invoiceId}/payments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents, method: 'cash', recordedByMemberId: MEMBER }),
  });
}

async function invoicePaidVsTotal(invoiceId: string): Promise<{ paid: number; total: number; payments: number }> {
  const rows = await db.execute(sql`SELECT paid_cents, total_cents FROM dental_invoice WHERE id = ${invoiceId}`);
  const r = (rows as any).rows?.[0] ?? (rows as any)[0];
  const pr = await db.execute(sql`SELECT count(*)::int AS n FROM dental_payment WHERE invoice_id = ${invoiceId}`);
  const prr = (pr as any).rows?.[0] ?? (pr as any)[0];
  return { paid: Number(r.paid_cents), total: Number(r.total_cents), payments: Number(prr.n) };
}

describe('recordDentalPayment — concurrent payments cannot overpay an invoice', () => {
  test('two simultaneous payments each <= balance but summing > balance → exactly one 201, one 422', async () => {
    const ROUNDS = 8;
    for (let i = 0; i < ROUNDS; i++) {
      const { visitId, patientId } = await seedBillableVisit();
      const { invoiceId, balanceCents } = await seedIssuedInvoice(visitId, patientId);
      // Each pays 80% of the balance: individually valid, together an overpayment.
      const amt = Math.round(balanceCents * 0.8);

      const [a, b] = await Promise.all([pay(invoiceId, amt), pay(invoiceId, amt)]);
      const statuses = [a.status, b.status];

      const { paid, total, payments } = await invoicePaidVsTotal(invoiceId);
      // Money-integrity invariant: never collect past the total.
      expect(paid, `round ${i}: paid_cents must not exceed total (paid=${paid} total=${total} statuses=${statuses})`).toBeLessThanOrEqual(total);

      const winners = [a, b].filter((r) => r.status === 201);
      expect(winners.length, `round ${i}: exactly one payment may succeed (statuses ${statuses})`).toBe(1);
      expect(payments, `round ${i}: exactly one payment row may exist`).toBe(1);
      const loser = [a, b].find((r) => r.status !== 201)!;
      expect(loser.status, `round ${i}: the loser must be a clean 422`).toBe(422);
      const loserBody = (await loser.json()) as { code?: string };
      expect(loserBody.code, `round ${i}: loser must be PAYMENT_EXCEEDS_BALANCE`).toBe('PAYMENT_EXCEEDS_BALANCE');

      await db.execute(sql`TRUNCATE TABLE dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
    }
  });
});
