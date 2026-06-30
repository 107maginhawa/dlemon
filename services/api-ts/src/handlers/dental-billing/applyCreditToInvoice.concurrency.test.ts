/**
 * applyCreditToInvoice.concurrency.test.ts — apply-credit racing a concurrent void.
 *
 * BR-052 draws a patient's credit down against an invoice inside withTenantTx,
 * under a per-patient advisory lock (1001), re-reading the invoice in-tx so the
 * balance + available-credit checks are consistent. The OUTER guard rejects an
 * already-voided invoice — but it reads the invoice BEFORE the lock. An invoice
 * voided concurrently (after that outer read, before the in-tx re-read) must NOT
 * receive applied credit: voidInvoice does NOT zero balanceCents, so the in-tx
 * `balanceCents <= 0` guard cannot catch it; without an in-tx voided-status
 * re-check the draw-down would commit — burning the patient's credit against an
 * invoice whose debt was just erased (and even un-voiding it via addPayment).
 *
 * This pins the in-tx voided re-check. The race window is forced DETERMINISTICALLY:
 * a dedicated connection holds the SAME per-patient advisory lock (1001) that
 * apply takes at the top of its tx. We fire apply (it passes the outer checks,
 * enters its tx, then BLOCKS on the lock just before its in-tx re-read), commit
 * the void while apply is parked, then release the lock so apply re-reads a
 * now-voided invoice.
 *
 * RED-proof: delete the in-tx `if (live.status === 'voided')` guard in
 * applyCreditToInvoice.ts → apply returns 200, a consuming (negative) credit row
 * is written against the voided invoice, the wallet is drawn to 0, and addPayment
 * even flips the invoice off 'voided'.
 * GREEN (with the guard): apply returns 422 INVOICE_VOIDED, no consuming row, the
 * wallet is untouched, and the invoice stays voided.
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
import { DentalPatientCreditRepository } from './repos/dental-patient-credit.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { createDentalInvoice } from './createDentalInvoice';
import { applyCreditToInvoice } from './applyCreditToInvoice';
import { voidDentalInvoice } from './voidDentalInvoice';
import {
  CreateDentalInvoiceBody,
  ApplyCreditToInvoiceBody,
  ApplyCreditToInvoiceParams,
  VoidDentalInvoiceBody,
  VoidDentalInvoiceParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 113.
const USER = { id: '00000000-0000-4000-8000-000000113001', email: 'owner@applycreditrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000113001';
const BRANCH = 'ba000000-0000-4000-8000-000000113001';
const MEMBER = 'ca000000-0000-4000-8000-000000113001';

const CREDIT_CENTS = 5000;

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_patient_credit, dental_payment_refund, dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'ApplyCreditRace Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
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
  app.post('/dental/billing/invoices/:invoiceId/apply-credit', zValidator('param', ApplyCreditToInvoiceParams, ve), zValidator('json', ApplyCreditToInvoiceBody, ve), applyCreditToInvoice as any);
  app.post('/dental/billing/invoices/:invoiceId/void', zValidator('param', VoidDentalInvoiceParams, ve), zValidator('json', VoidDentalInvoiceBody, ve), voidDentalInvoice as any);
  return app;
}

/**
 * Seed a fresh patient with an ISSUED invoice (₱50 performed treatment → 5000c
 * balance) and a positive credit wallet (5000c). Returns the ids.
 */
async function seedInvoiceWithCredit(): Promise<{ invoiceId: string; patientId: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'Apply', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id });
  await db.insert(patients).values({ id: patientId, person: personId, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id });

  const visitRepo = new VisitRepository(db);
  const v = await visitRepo.createOne({ patientId, branchId: BRANCH, dentistMemberId: MEMBER });
  const visit = await visitRepo.activate(v.id);
  await new TreatmentRepository(db).createOne({ visitId: visit!.id, patientId, cdtCode: 'D2150', description: 'Amalgam', priceCents: 5000, carriedOver: false, status: 'performed' });
  await db.insert(consentForms).values({ id: crypto.randomUUID(), visitId: visit!.id, patientId, templateId: 'general-consent-v1', templateName: 'General Treatment Consent', signed: true, signedAt: new Date(), signatureData: 'x', createdBy: USER.id, updatedBy: USER.id });

  const res = await buildApp().request('/dental/billing/invoices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId: visit!.id, patientId, branchId: BRANCH, dentistMemberId: MEMBER }),
  });
  if (res.status !== 201) throw new Error(`create invoice: ${res.status} ${await res.text()}`);
  const inv = await res.json() as { id: string };
  await new DentalInvoiceRepository(db).issue(inv.id);

  // Seed a positive credit wallet (on db / superuser, bypassing RLS).
  await new DentalPatientCreditRepository(db).create({
    patientId, branchId: BRANCH, amountCents: CREDIT_CENTS, source: 'manual',
    createdBy: USER.id, updatedBy: USER.id,
  });

  return { invoiceId: inv.id, patientId };
}

function applyCredit(invoiceId: string, amountCents: number) {
  return buildApp().request(`/dental/billing/invoices/${invoiceId}/apply-credit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents }),
  });
}

function voidInvoice(invoiceId: string) {
  return buildApp().request(`/dental/billing/invoices/${invoiceId}/void`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'duplicate invoice correction' }),
  });
}

async function invoiceStatus(invoiceId: string): Promise<string> {
  const r = await db.execute(sql`SELECT status FROM dental_invoice WHERE id = ${invoiceId}`);
  const row = (r as any).rows?.[0] ?? (r as any)[0];
  return String(row.status);
}

async function consumingRowCount(invoiceId: string): Promise<number> {
  const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM dental_patient_credit WHERE invoice_id = ${invoiceId} AND amount_cents < 0`);
  const row = (r as any).rows?.[0] ?? (r as any)[0];
  return Number(row.n);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('applyCreditToInvoice — credit is never applied to a concurrently-voided invoice', () => {
  test('void commits while apply is parked on the per-patient lock → apply rejects INVOICE_VOIDED, wallet untouched, invoice stays voided', async () => {
    const ROUNDS = 3;
    const pool = (db as unknown as { $client: { connect: () => Promise<{ query: (q: string, p: unknown[]) => Promise<unknown>; release: () => void }> } }).$client;

    for (let i = 0; i < ROUNDS; i++) {
      const { invoiceId, patientId } = await seedInvoiceWithCredit();

      // Hold the SAME per-patient advisory lock apply takes at the top of its tx
      // (classid 1001, objid hashtext(patientId)) on a dedicated connection.
      const lockClient = await pool.connect();
      await lockClient.query('SELECT pg_advisory_lock(1001, hashtext($1))', [patientId]);

      // Fire apply: it passes the OUTER checks (invoice not yet voided), enters its
      // tx, then blocks on pg_advisory_xact_lock(1001, …) — just before its in-tx
      // re-read. Do NOT await yet.
      const applyP = applyCredit(invoiceId, CREDIT_CENTS);
      await sleep(250); // let apply reach and block on the lock

      // Commit the void while apply is parked (void never takes the 1001 lock).
      const voidRes = await voidInvoice(invoiceId);
      expect(voidRes.status, `round ${i}: void must succeed (${await voidRes.clone().text()})`).toBe(200);

      // Release the lock → apply wakes, re-reads, and now sees a voided invoice.
      await lockClient.query('SELECT pg_advisory_unlock(1001, hashtext($1))', [patientId]);
      lockClient.release();

      const applyRes = await applyP;

      // (1) apply must be rejected for the right reason.
      expect(applyRes.status, `round ${i}: apply must be rejected (${await applyRes.clone().text()})`).toBe(422);
      const body = (await applyRes.json()) as { code?: string };
      expect(body.code, `round ${i}: rejection must be INVOICE_VOIDED`).toBe('INVOICE_VOIDED');

      // (2) Money invariant: no consuming credit row against the voided invoice.
      expect(await consumingRowCount(invoiceId), `round ${i}: no consuming credit row may exist for the voided invoice`).toBe(0);

      // (3) Wallet must NOT be drawn down for a voided invoice.
      const wallet = await new DentalPatientCreditRepository(db).getBalance(patientId);
      expect(wallet, `round ${i}: wallet must be untouched (still ${CREDIT_CENTS})`).toBe(CREDIT_CENTS);

      // (4) The void must stand — apply's addPayment must not un-void it.
      expect(await invoiceStatus(invoiceId), `round ${i}: invoice must remain voided`).toBe('voided');

      await db.execute(sql`TRUNCATE TABLE dental_patient_credit, dental_payment_refund, dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
    }
  });
});
