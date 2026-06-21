/**
 * applyDentalDiscount.concurrency.test.ts — discount/payment lost-update race.
 *
 * DentalInvoiceRepository.applyDiscount (dental-invoice.repo.ts) recomputed
 * balanceCents = totalCents − invoice.paidCents in JS from a SELECT taken inside the
 * call, then wrote that constant. Under READ COMMITTED a recordDentalPayment that
 * commits AFTER that read but BEFORE the discount's UPDATE lands makes the persisted
 * balanceCents stale — the discount overwrites the just-reduced balance with one
 * computed from a paidCents snapshot that misses the payment → PHANTOM DEBT (the
 * invoice shows a balance the patient already paid; the clinic can re-collect it).
 *
 * This interleaving is NOT reliably hit by a naive Promise.all (the discount path is
 * shorter, wins the invoice row-lock, commits first, and the payment's guardBalance
 * then 422s). We force the exact harmful order DETERMINISTICALLY: a dedicated pg
 * connection holds an uncommitted payment (row lock); the discount's findOneById reads
 * the pre-payment paidCents, its UPDATE blocks on that lock, then we commit the payment
 * and the discount's UPDATE proceeds.
 *
 * Fix: applyDiscount computes balanceCents (and the paid-status flip) in SQL from the
 * LIVE paid_cents column (GREATEST(0, total − paid_cents)), so the blocked UPDATE
 * re-reads the just-committed payment instead of writing a stale JS constant.
 *
 * RED: buggy code persists balance=4000 with paid=5000 (phantom debt). GREEN: balance
 * == max(0, total − paid) == 0.
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
import { CreateDentalInvoiceBody } from '@/generated/openapi/validators';

const URL = process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test';
const db = createDatabase({ url: URL });

// Suite-unique tag: 109.
const USER = { id: '00000000-0000-4000-8000-000000109001', email: 'owner@discountrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000109001';
const BRANCH = 'ba000000-0000-4000-8000-000000109001';
const MEMBER = 'ca000000-0000-4000-8000-000000109001';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'DiscountRace Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

async function seedBillableVisit(): Promise<{ visitId: string; patientId: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'Disc', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id });
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
  return app;
}

async function seedIssuedInvoice(visitId: string, patientId: string): Promise<{ invoiceId: string; totalCents: number }> {
  const res = await buildApp().request('/dental/billing/invoices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId, patientId, branchId: BRANCH, dentistMemberId: MEMBER }),
  });
  if (res.status !== 201) throw new Error(`create invoice: ${res.status} ${await res.text()}`);
  const inv = await res.json() as { id: string };
  const issued = await new DentalInvoiceRepository(db).issue(inv.id);
  return { invoiceId: inv.id, totalCents: issued!.totalCents };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('applyDentalDiscount — a payment committing during a discount must not be lost from the balance', () => {
  test('discount UPDATE blocked behind an uncommitted payment recomputes balance from the live paid amount', async () => {
    const { visitId, patientId } = await seedBillableVisit();
    const { invoiceId, totalCents } = await seedIssuedInvoice(visitId, patientId); // total 5000, paid 0, balance 5000
    expect(totalCents).toBe(5000);

    // A dedicated connection holds an UNCOMMITTED full payment → it holds the invoice row lock.
    const pool = new Pool({ connectionString: URL, max: 1 });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE dental_invoice SET paid_cents = 5000, balance_cents = 0, status = 'paid', paid_at = now() WHERE id = $1`,
        [invoiceId],
      );

      // Discount 20% (1000 of 5000 → total 4000). Its findOneById reads the pre-payment
      // paid_cents=0 (the payment is uncommitted → invisible under READ COMMITTED), then its
      // UPDATE blocks on the row lock held above.
      const discountP = new DentalInvoiceRepository(db).applyDiscount(invoiceId, 1000, 0, 'senior citizen', USER.id);
      await sleep(300); // let the discount complete its read and reach the blocking UPDATE

      // Release the payment's row lock; the discount's UPDATE now proceeds.
      await client.query('COMMIT');
      await discountP;
    } finally {
      client.release();
      await pool.end();
    }

    const r = await db.execute(sql`SELECT total_cents, paid_cents, balance_cents FROM dental_invoice WHERE id = ${invoiceId}`);
    const i = (r as any).rows?.[0] ?? (r as any)[0];
    const total = Number(i.total_cents), paid = Number(i.paid_cents), balance = Number(i.balance_cents);

    expect(total, 'discount applied: total 5000 → 4000').toBe(4000);
    expect(paid, 'the concurrent payment committed: paid 5000').toBe(5000);
    // Money-integrity invariant: the stored balance must reflect the live paid amount,
    // never a stale snapshot that resurrects already-paid debt.
    expect(balance, `balance must equal max(0, total − paid) (total=${total} paid=${paid} balance=${balance})`).toBe(Math.max(0, total - paid));
  });
});
