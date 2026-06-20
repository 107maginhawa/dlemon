/**
 * createDentalPaymentPlan.concurrency.test.ts — two plans for one invoice.
 *
 * The handler checks planRepo.findByInvoice(invoiceId) then inserts. Under READ COMMITTED
 * two concurrent creates for the same invoice both read null (the plan does not exist yet,
 * so there is NO row to lock and neither sees the other's uncommitted insert) and both
 * INSERT — violating the one-plan-per-invoice rule. dental_payment_plan.invoice_id only
 * had a NON-unique btree, so nothing in the DB stopped it.
 *
 * Fix: a UNIQUE index on invoice_id (migration 0114). The losing concurrent INSERT fails
 * with 23505; the handler catches it and re-runs the idempotency check (same shape →
 * replay 200, different shape → PLAN_EXISTS) — exactly one plan survives.
 *
 * RED-proof: DROP the unique index and a round races → two plan rows, both 201. GREEN:
 * exactly one plan row, one 201 + one 200 replay.
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
import { createDentalPaymentPlan } from './createDentalPaymentPlan';
import { CreateDentalInvoiceBody, CreateDentalPaymentPlanBody, CreateDentalPaymentPlanParams } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 112.
const USER = { id: '00000000-0000-4000-8000-000000112001', email: 'owner@planrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000112001';
const BRANCH = 'ba000000-0000-4000-8000-000000112001';
const MEMBER = 'ca000000-0000-4000-8000-000000112001';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payment_plan_installment, dental_payment_plan, dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'PlanRace Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

async function seedBillableVisit(): Promise<{ visitId: string; patientId: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'Plan', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id });
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
  app.post('/dental/billing/invoices/:invoiceId/plan', zValidator('param', CreateDentalPaymentPlanParams, ve), zValidator('json', CreateDentalPaymentPlanBody, ve), createDentalPaymentPlan as any);
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

function createPlan(invoiceId: string, patientId: string) {
  return buildApp().request(`/dental/billing/invoices/${invoiceId}/plan`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId, numberOfInstallments: 3, frequency: 'monthly', startDate: '2026-08-01T00:00:00.000Z' }),
  });
}

describe('createDentalPaymentPlan — concurrent creates cannot make two plans for one invoice', () => {
  test('two simultaneous identical-shape creates → exactly one plan row, one 201 + one 200 replay', async () => {
    const ROUNDS = 8;
    for (let i = 0; i < ROUNDS; i++) {
      const { visitId, patientId } = await seedBillableVisit();
      const { invoiceId } = await seedIssuedInvoice(visitId, patientId);

      const [a, b] = await Promise.all([createPlan(invoiceId, patientId), createPlan(invoiceId, patientId)]);
      const statuses = [a.status, b.status];

      const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM dental_payment_plan WHERE invoice_id = ${invoiceId}`);
      const plans = Number(((r as any).rows?.[0] ?? (r as any)[0]).n);

      // One-plan-per-invoice invariant.
      expect(plans, `round ${i}: exactly one plan may exist for an invoice (plans=${plans} statuses=${statuses})`).toBe(1);
      // Both requests resolve successfully (winner creates 201, loser replays 200) — no 500.
      expect(statuses.every((s) => s === 200 || s === 201), `round ${i}: both 2xx (statuses=${statuses})`).toBe(true);
      expect(statuses.includes(201), `round ${i}: exactly one create won (201)`).toBe(true);

      await db.execute(sql`TRUNCATE TABLE dental_payment_plan_installment, dental_payment_plan, dental_payment, dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
    }
  });
});
