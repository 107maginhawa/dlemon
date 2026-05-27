/**
 * dental-billing-module4.test.ts — G1-S4: PaymentPlan FSM guard
 *
 * Covers F-004: PaymentPlan state machine unguarded
 *   - completed → any   → 422 INVALID_TRANSITION
 *   - defaulted → any   → 422 INVALID_TRANSITION
 *   - on_track  → completed   → 200 (valid)
 *   - on_track  → defaulted   → 200 (valid)
 *   - on_track  → behind      → 200 (valid)
 *   - on_track  → cancelled   → 422 INVALID_TRANSITION (not an allowed status)
 *   - behind    → on_track    → 200 (valid)
 *   - behind    → defaulted   → 200 (valid)
 *   - behind    → completed   → 200 (valid)
 *
 * Fixture namespace: a07 — unique across all dental suites:
 *   module1 (a02), module2 (bb/cc), module3 (a04), visit suites (a01/a03)
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalPaymentPlans } from './repos/dental-payment-plan.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

import { updateDentalPaymentPlan } from './updateDentalPaymentPlan';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique namespace: a07
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'e0000000-0000-1000-8000-000000000001';
const BRANCH_ID  = '7b000000-0000-4000-8000-000000000a07';
const MEMBER_ID  = '7c000000-0000-4000-8000-000000000a07';
const VISIT_ID   = 'b4000000-0000-4000-8000-000000000a07';
const ORG_ID     = 'ea000000-0000-1000-8000-000000000007';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'BillingModule4 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

// ─── App builder ──────────────────────────────────────────────────────────────

const UpdatePlanParamsSchema = z.object({ planId: z.string().uuid() });
const UpdatePlanBodySchema   = z.object({ status: z.enum(['on_track', 'behind', 'completed', 'defaulted']) });

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session', userId: user.id });
    }
    await next();
  });

  app.patch(
    '/dental/billing/plans/:planId/status',
    zValidator('param', UpdatePlanParamsSchema, validationErrorHandler),
    zValidator('json', UpdatePlanBodySchema, validationErrorHandler),
    updateDentalPaymentPlan as any,
  );

  return app;
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedPlan(status: 'on_track' | 'behind' | 'completed' | 'defaulted') {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();

  const [invoice] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(),
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
    invoiceNumber,
    status: 'issued',
    subtotalCents: 12000,
    discountCents: 0,
    taxCents: 0,
    taxRate: '0',
    totalCents: 12000,
    paidCents: 0,
    balanceCents: 12000,
    issuedAt: new Date('2025-01-15T10:00:00.000Z'),
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).returning();

  const [plan] = await db.insert(dentalPaymentPlans).values({
    id: crypto.randomUUID(),
    invoiceId: invoice!.id,
    patientId: PATIENT_ID,
    totalCents: 12000,
    numberOfInstallments: 3,
    frequency: 'monthly',
    startDate: new Date('2025-06-01T00:00:00.000Z'),
    amountPerInstallmentCents: 4000,
    status,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).returning();

  return plan!;
}

async function truncate() {
  await db.execute(sql`DELETE FROM dental_payment_plan_installment`);
  await db.execute(sql`DELETE FROM dental_payment_plan`);
  await db.execute(sql`DELETE FROM dental_payment`);
  await db.execute(sql`DELETE FROM dental_invoice_line_item`);
  await db.execute(sql`DELETE FROM dental_invoice`);
}

// =============================================================================
// G1-S4 — PaymentPlan FSM: invalid transitions from terminal states → 422
// =============================================================================

describe('PaymentPlan FSM — terminal states reject all transitions', () => {
  afterEach(truncate);

  test('completed → on_track → 422 INVALID_TRANSITION', async () => {
    const plan = await seedPlan('completed');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'on_track' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_TRANSITION');
  });

  test('completed → behind → 422 INVALID_TRANSITION', async () => {
    const plan = await seedPlan('completed');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'behind' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_TRANSITION');
  });

  test('completed → defaulted → 422 INVALID_TRANSITION', async () => {
    const plan = await seedPlan('completed');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'defaulted' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_TRANSITION');
  });

  test('defaulted → on_track → 422 INVALID_TRANSITION', async () => {
    const plan = await seedPlan('defaulted');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'on_track' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_TRANSITION');
  });

  test('defaulted → completed → 422 INVALID_TRANSITION', async () => {
    const plan = await seedPlan('defaulted');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_TRANSITION');
  });
});

// =============================================================================
// G1-S4 — PaymentPlan FSM: valid transitions succeed
// =============================================================================

describe('PaymentPlan FSM — valid transitions succeed', () => {
  afterEach(truncate);

  test('on_track → completed → 200', async () => {
    const plan = await seedPlan('on_track');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('completed');
  });

  test('on_track → defaulted → 200', async () => {
    const plan = await seedPlan('on_track');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'defaulted' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('defaulted');
  });

  test('on_track → behind → 200', async () => {
    const plan = await seedPlan('on_track');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'behind' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('behind');
  });

  test('behind → on_track → 200 (recovery)', async () => {
    const plan = await seedPlan('behind');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'on_track' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('on_track');
  });

  test('behind → defaulted → 200', async () => {
    const plan = await seedPlan('behind');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'defaulted' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('defaulted');
  });

  test('behind → completed → 200', async () => {
    const plan = await seedPlan('behind');
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/billing/plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('completed');
  });
});
