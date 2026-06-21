/**
 * voidDentalPayment.concurrency.test.ts — concurrent double-void race.
 *
 * voidDentalPayment reads payment.isVoid with a plain SELECT BEFORE the transaction
 * and DentalPaymentRepository.voidPayment's UPDATE keyed on `id` ONLY (no
 * `is_void = false` predicate). Under READ COMMITTED, two concurrent voids of the
 * SAME payment both pass the pre-tx `isVoid` check, both flip is_void=true, and both
 * call removePayment → the invoice is reversed TWICE for one payment. With other live
 * payments on the invoice the GREATEST(0,…) clamp turns that into a visible corruption:
 * paid_cents collapses below the sum of the still-valid payments (money silently lost
 * from the invoice's books), plus a second spurious `payment.void` audit row.
 *
 * Fix: voidPayment's UPDATE now carries `AND is_void = false`; the losing concurrent
 * void matches 0 rows (null) and the handler throws ALREADY_VOIDED, aborting the tx
 * (rolling back the second removePayment). Exactly one void may win.
 *
 * RED-proof: drop the `is_void = false` predicate (revert voidPayment to WHERE id only)
 * and a round races → both 200, paid_cents != sum(non-void payments), two void rows.
 * GREEN: every round yields exactly one 200 + one 422 ALREADY_VOIDED and the invoice's
 * paid_cents equals the sum of its remaining non-voided payments.
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
import { voidDentalPayment } from './voidDentalPayment';
import {
  CreateDentalInvoiceBody,
  RecordDentalPaymentBody,
  RecordDentalPaymentParams,
  VoidDentalPaymentBody,
  VoidDentalPaymentParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 106.
const USER = { id: '00000000-0000-4000-8000-000000106001', email: 'owner@voidrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000106001';
const BRANCH = 'ba000000-0000-4000-8000-000000106001';
const MEMBER = 'ca000000-0000-4000-8000-000000106001';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'VoidRace Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

/** Seed a fresh patient + active visit + a ₱50 (5000c) performed treatment + signed consent. */
async function seedBillableVisit(): Promise<{ visitId: string; patientId: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'Void', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id });
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
  app.post('/dental/billing/invoices/:invoiceId/payments/:paymentId/void', zValidator('param', VoidDentalPaymentParams, ve), zValidator('json', VoidDentalPaymentBody, ve), voidDentalPayment as any);
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

/** Record a payment via the real handler; returns the created payment id. */
async function record(invoiceId: string, amountCents: number): Promise<string> {
  const res = await buildApp().request(`/dental/billing/invoices/${invoiceId}/payments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents, method: 'cash', recordedByMemberId: MEMBER }),
  });
  if (res.status !== 201) throw new Error(`record payment: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

function voidPayment(invoiceId: string, paymentId: string) {
  return buildApp().request(`/dental/billing/invoices/${invoiceId}/payments/${paymentId}/void`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voidReason: 'duplicate entry' }),
  });
}

async function invoiceState(invoiceId: string): Promise<{ paid: number; total: number; balance: number; nonVoidSum: number; voidCount: number }> {
  const ir = await db.execute(sql`SELECT paid_cents, total_cents, balance_cents FROM dental_invoice WHERE id = ${invoiceId}`);
  const i = (ir as any).rows?.[0] ?? (ir as any)[0];
  const pr = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE NOT is_void), 0)::int AS non_void_sum,
      COUNT(*) FILTER (WHERE is_void)::int AS void_count
    FROM dental_payment WHERE invoice_id = ${invoiceId}`);
  const p = (pr as any).rows?.[0] ?? (pr as any)[0];
  return {
    paid: Number(i.paid_cents),
    total: Number(i.total_cents),
    balance: Number(i.balance_cents),
    nonVoidSum: Number(p.non_void_sum),
    voidCount: Number(p.void_count),
  };
}

describe('voidDentalPayment — concurrent voids cannot double-reverse a payment', () => {
  test('two simultaneous voids of the same payment → exactly one 200, one 422 ALREADY_VOIDED; books stay consistent', async () => {
    const ROUNDS = 8;
    for (let i = 0; i < ROUNDS; i++) {
      const { visitId, patientId } = await seedBillableVisit();
      const { invoiceId } = await seedIssuedInvoice(visitId, patientId);
      // Two real payments so a double-reversal is VISIBLE (the GREATEST(0,…) clamp
      // would mask a double-void on a lone full payment): P1 is voided twice, P2 stays.
      const p1 = await record(invoiceId, 3000);
      await record(invoiceId, 2000); // P2 — the remaining valid money on the invoice

      const [a, b] = await Promise.all([voidPayment(invoiceId, p1), voidPayment(invoiceId, p1)]);
      const statuses = [a.status, b.status];

      const { paid, total, balance, nonVoidSum, voidCount } = await invoiceState(invoiceId);

      // Money-integrity invariant: the invoice's paid_cents must equal the sum of its
      // still-valid (non-void) payments — i.e. exactly P2's 2000 after P1 is voided once.
      expect(paid, `round ${i}: paid_cents must equal the non-void payment sum (paid=${paid} nonVoidSum=${nonVoidSum} statuses=${statuses})`).toBe(nonVoidSum);
      expect(paid, `round ${i}: only P1 (3000) may be reversed; P2 (2000) stays`).toBe(2000);
      expect(balance, `round ${i}: balance must reflect a single reversal`).toBe(total - nonVoidSum);
      expect(voidCount, `round ${i}: exactly one payment row may be voided`).toBe(1);

      const winners = [a, b].filter((r) => r.status === 200);
      expect(winners.length, `round ${i}: exactly one void may succeed (statuses ${statuses})`).toBe(1);
      const loser = [a, b].find((r) => r.status !== 200)!;
      expect(loser.status, `round ${i}: the loser must be a clean 422`).toBe(422);
      const loserBody = (await loser.json()) as { code?: string };
      expect(loserBody.code, `round ${i}: loser must be ALREADY_VOIDED`).toBe('ALREADY_VOIDED');

      await db.execute(sql`TRUNCATE TABLE dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
    }
  });
});
