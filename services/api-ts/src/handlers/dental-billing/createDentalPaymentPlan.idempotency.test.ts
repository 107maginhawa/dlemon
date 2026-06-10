/**
 * createDentalPaymentPlan.idempotency.test.ts — SL-04 / F-G16 (Tier-2, P1 money)
 *
 * ADR-004 Tier-2: a payment plan is one-per-invoice. The handler already guards
 * duplicates (findByInvoice → PLAN_EXISTS), but it ERRORS on an offline replay
 * (dropped ACK, same request re-sent) instead of idempotently returning the
 * original plan — exactly the invoice 422-on-replay defect (E-NEW-05). Without a
 * localId column the natural idempotency key is the request content: same invoice
 * + same plan shape (installments/frequency/startDate) = a replay.
 *
 * Fix contract: an identical re-create returns the EXISTING plan (200); a DIFFERENT
 * plan shape for an invoice that already has one is a genuine conflict → PLAN_EXISTS.
 *
 * (The sibling Tier-2 endpoints are already safe — verified, not duplicated here:
 * recordDentalPayment has a receiptNumber idempotency key scoped to the invoice;
 * applyDentalDiscount SETS absolute totals from the fixed subtotal, so re-applying
 * the same rate is a no-op replacement, not a double-subtract.)
 *
 * RED-proof: the second identical POST returns 422 PLAN_EXISTS before the fix.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { createDentalPaymentPlan } from './createDentalPaymentPlan';
import { CreateDentalPaymentPlanBody, CreateDentalPaymentPlanParams } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 106.
const USER = { id: '00000000-0000-4000-8000-000000106001', email: 'owner@idempp.com' };
const ORG = 'ea000000-0000-4000-8000-000000106001';
const BRANCH = 'ba000000-0000-4000-8000-000000106001';
const MEMBER = 'ca000000-0000-4000-8000-000000106001';
const PERSON = 'fa000000-0000-4000-8000-000000106001';
const PATIENT = 'aa000000-0000-4000-8000-000000106001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'IdemPP Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'IdemPP', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE dental_payment_plan_installment, dental_payment_plan, dental_invoice CASCADE
  `);
});

async function seedInvoiceWithBalance(): Promise<string> {
  const repo = new DentalInvoiceRepository(db);
  const invoiceNumber = await repo.generateInvoiceNumber();
  const inv = await repo.createOne({
    patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, invoiceNumber,
    subtotalCents: 6000, taxCents: 0, taxRate: '0', totalCents: 6000, balanceCents: 6000,
  });
  await repo.issue(inv.id);
  return inv.id;
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
  app.post('/dental/billing/invoices/:invoiceId/plan',
    zValidator('param', CreateDentalPaymentPlanParams, ve),
    zValidator('json', CreateDentalPaymentPlanBody, ve),
    createDentalPaymentPlan as any);
  return app;
}

async function createPlan(invoiceId: string, installments = 3) {
  return buildApp().request(`/dental/billing/invoices/${invoiceId}/plan`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: PATIENT, numberOfInstallments: installments, frequency: 'monthly', startDate: '2026-07-01T00:00:00Z' }),
  });
}

async function countPlans(invoiceId: string): Promise<number> {
  const rows = await db.execute(sql`SELECT count(*)::int AS n FROM dental_payment_plan WHERE invoice_id = ${invoiceId}`);
  return ((rows as unknown as { rows?: Array<{ n: number }> }).rows?.[0]?.n) ?? (rows as unknown as Array<{ n: number }>)[0]?.n ?? 0;
}

describe('SL-04 / F-G16 — createDentalPaymentPlan is idempotent on an identical replay', () => {
  test('an identical re-create returns the SAME plan (not 422 PLAN_EXISTS)', async () => {
    const invoiceId = await seedInvoiceWithBalance();

    const first = await createPlan(invoiceId, 3);
    expect(first.status).toBe(201);
    const p1 = await first.json() as { id: string; installments: unknown[] };

    const second = await createPlan(invoiceId, 3);
    expect([200, 201]).toContain(second.status); // RED before: 422 PLAN_EXISTS
    const p2 = await second.json() as { id: string; installments: unknown[] };

    expect(p2.id).toBe(p1.id);
    expect(Array.isArray(p2.installments)).toBe(true);
    expect(p2.installments.length).toBe(3);
    expect(await countPlans(invoiceId)).toBe(1);
  });

  test('a DIFFERENT plan shape for an invoice that already has one is still a conflict', async () => {
    const invoiceId = await seedInvoiceWithBalance();

    const first = await createPlan(invoiceId, 3);
    expect(first.status).toBe(201);

    const second = await createPlan(invoiceId, 6); // different installment count
    expect(second.status).toBe(422);
    const body = await second.json() as { code: string };
    expect(body.code).toBe('PLAN_EXISTS');
    expect(await countPlans(invoiceId)).toBe(1);
  });
});
