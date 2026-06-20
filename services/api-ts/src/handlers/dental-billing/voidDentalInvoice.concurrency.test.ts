/**
 * voidDentalInvoice.concurrency.test.ts — payment clobbers a concurrent invoice void.
 *
 * recordDentalPayment's INVOICE_IMMUTABLE guard (recordDentalPayment.ts:45) reads
 * invoice.status from a SELECT BEFORE the tx, and addPayment's write re-checks only
 * balance_cents (guardBalance), NOT status. voidInvoice (dental-invoice.repo.ts) sets
 * status='voided' without touching balance_cents. Under READ COMMITTED a payment that
 * read status='issued' before the void committed then runs addPayment against the now
 * voided row: balance is unchanged so guardBalance still passes, the payment is recorded,
 * and the invoice status is flipped back to partial/paid — silently UN-voiding it and
 * collecting money on an invoice the owner deliberately voided, with no audit of the
 * un-void.
 *
 * This needs the payment's addPayment to land AFTER the void commits but with the
 * payment's pre-tx status read taken BEFORE — forced deterministically here: a dedicated
 * pg connection holds an uncommitted void (row lock); the payment reads 'issued', its
 * addPayment blocks on the lock, then the void commits.
 *
 * Fix: recordDentalPayment passes { guardStatus: true } so addPayment's UPDATE also
 * requires status NOT IN ('voided','paid'); the blocked write re-reads the committed
 * voided row, matches 0 rows (null), and the handler throws INVOICE_IMMUTABLE (rolling
 * back the payment insert). (voidInvoice also gains a status<>'voided' predicate so a
 * double-void rejects ALREADY_VOIDED instead of writing twice.)
 *
 * RED: buggy code records the payment (201), status flips to 'paid', paid=5000 on a
 * voided invoice. GREEN: 422 INVOICE_IMMUTABLE, status stays 'voided', paid=0, no
 * payment row.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
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

const URL = process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test';
const db = createDatabase({ url: URL });

// Suite-unique tag: 110.
const USER = { id: '00000000-0000-4000-8000-000000110001', email: 'owner@voidinvrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000110001';
const BRANCH = 'ba000000-0000-4000-8000-000000110001';
const MEMBER = 'ca000000-0000-4000-8000-000000110001';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'VoidInvRace Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

async function seedBillableVisit(): Promise<{ visitId: string; patientId: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'VoidInv', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id });
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

function pay(invoiceId: string, amountCents: number) {
  return buildApp().request(`/dental/billing/invoices/${invoiceId}/payments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents, method: 'cash', recordedByMemberId: MEMBER }),
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('voidDentalInvoice — a payment racing a void cannot un-void the invoice', () => {
  test('a payment whose write lands after a concurrent void is rejected, not recorded on the voided invoice', async () => {
    const { visitId, patientId } = await seedBillableVisit();
    const { invoiceId } = await seedIssuedInvoice(visitId, patientId); // issued, total 5000, balance 5000, paid 0

    // A dedicated connection holds an UNCOMMITTED void → it holds the invoice row lock.
    const pool = new Pool({ connectionString: URL, max: 1 });
    const client = await pool.connect();
    let payRes: Response;
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE dental_invoice SET status = 'voided', voided_at = now() WHERE id = $1`, [invoiceId]);

      // Payment reads status='issued' (void uncommitted → invisible), passes the
      // INVOICE_IMMUTABLE guard, then its addPayment blocks on the row lock above.
      const payP = pay(invoiceId, 5000);
      await sleep(300); // let the payment reach the blocking addPayment

      await client.query('COMMIT'); // release the lock; the payment's write proceeds
      payRes = await payP;
    } finally {
      client.release();
      await pool.end();
    }

    const r = await db.execute(sql`SELECT status, paid_cents FROM dental_invoice WHERE id = ${invoiceId}`);
    const i = (r as any).rows?.[0] ?? (r as any)[0];
    const pc = await db.execute(sql`SELECT COUNT(*)::int AS n FROM dental_payment WHERE invoice_id = ${invoiceId}`);
    const payments = Number(((pc as any).rows?.[0] ?? (pc as any)[0]).n);

    // The void must stand: no money may be recorded on a voided invoice.
    expect(i.status, `invoice must stay voided (status=${i.status} paid=${i.paid_cents} payRes=${payRes!.status})`).toBe('voided');
    expect(Number(i.paid_cents), 'a voided invoice carries no paid amount').toBe(0);
    expect(payments, 'no payment row may exist on the voided invoice').toBe(0);
    expect(payRes!.status, 'the racing payment must be rejected 422').toBe(422);
    const body = (await payRes!.json()) as { code?: string };
    expect(body.code, 'rejected as INVOICE_IMMUTABLE').toBe('INVOICE_IMMUTABLE');
  });
});
