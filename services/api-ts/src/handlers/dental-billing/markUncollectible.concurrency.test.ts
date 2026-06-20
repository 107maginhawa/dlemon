/**
 * markUncollectible.concurrency.test.ts — mark-uncollectible races a payment.
 *
 * markUncollectible reads invoice.status (WRITE_OFF_FROM guard) from a SELECT BEFORE the
 * tx, then writes via DentalInvoiceRepository.markUncollectible — an UPDATE keyed on id
 * ONLY (no status predicate). Under READ COMMITTED a recordDentalPayment that fully pays
 * the invoice (status→'paid') can commit between that read and the write-off UPDATE, so
 * the invoice ends up BOTH paid in full AND written off as bad debt — a corrupt terminal
 * state plus a misleading invoice.uncollectible audit row for money that was collected.
 *
 * Fix: markUncollectible's UPDATE re-checks status at write time (WHERE status IN
 * issued/partial/overdue); the losing write matches 0 rows (null) and the handler rejects
 * (INVALID_STATUS_TRANSITION for a now-paid invoice, ALREADY_UNCOLLECTIBLE for a repeat).
 *
 * RED: buggy code persists status='uncollectible' on a fully-paid invoice. GREEN: the
 * write-off is rejected 422 and the invoice stays 'paid'.
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
import { markUncollectible } from './markUncollectible';
import { CreateDentalInvoiceBody } from '@/generated/openapi/validators';

const URL = process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test';
const db = createDatabase({ url: URL });

// Suite-unique tag: 111.
const USER = { id: '00000000-0000-4000-8000-000000111001', email: 'owner@uncollrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000111001';
const BRANCH = 'ba000000-0000-4000-8000-000000111001';
const MEMBER = 'ca000000-0000-4000-8000-000000111001';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'UncollRace Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

async function seedBillableVisit(): Promise<{ visitId: string; patientId: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'Uncoll', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id });
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
  app.post('/dental/billing/invoices/:invoiceId/uncollectible', markUncollectible as any);
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

function writeOff(invoiceId: string) {
  return buildApp().request(`/dental/billing/invoices/${invoiceId}/uncollectible`, { method: 'POST' });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('markUncollectible — a fully-paid invoice racing a write-off cannot be written off', () => {
  test('write-off blocked behind an uncommitted full payment is rejected once the payment commits', async () => {
    const { visitId, patientId } = await seedBillableVisit();
    const { invoiceId } = await seedIssuedInvoice(visitId, patientId); // issued, balance 5000

    // A dedicated connection holds an UNCOMMITTED full payment (status→paid) → row lock.
    const pool = new Pool({ connectionString: URL, max: 1 });
    const client = await pool.connect();
    let res: Response;
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE dental_invoice SET paid_cents = 5000, balance_cents = 0, status = 'paid', paid_at = now() WHERE id = $1`, [invoiceId]);

      // Write-off reads status='issued' (payment uncommitted), passes the WRITE_OFF_FROM
      // guard, then its UPDATE blocks on the row lock above.
      const offP = writeOff(invoiceId);
      await sleep(300);

      await client.query('COMMIT'); // release the lock; write-off UPDATE proceeds
      res = await offP;
    } finally {
      client.release();
      await pool.end();
    }

    const r = await db.execute(sql`SELECT status FROM dental_invoice WHERE id = ${invoiceId}`);
    const status = ((r as any).rows?.[0] ?? (r as any)[0]).status;

    // A fully-paid invoice must never end up written off as bad debt.
    expect(status, `invoice must stay paid, not uncollectible (status=${status} res=${res!.status})`).toBe('paid');
    expect(res!.status, 'the racing write-off must be rejected 422').toBe(422);
  });
});
