/**
 * Module 5: Dashboard — FR0.7 Active Payment Plans, FR0.8 Lab Order Status
 *
 * Tests:
 * - GET /dental/dashboard/summary returns activePaymentPlans + labOrders
 * - FR0.7: counts onTrack and behind plans
 * - FR0.7: behindCount reflects behind plans
 * - FR0.8: counts ordered + inFabrication lab orders
 * - FR0.8: overdueDelivery count for past expectedDeliveryDate
 * - Returns zeros when no data exists
 * - 401 without auth
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalPaymentPlans } from '@/handlers/dental-billing/repos/dental-payment-plan.schema';
import { dentalInvoices } from '@/handlers/dental-billing/repos/dental-invoice.schema';
import { labOrders } from '@/handlers/dental-clinical/repos/lab-order.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { getDashboardSummary } from './getDashboardSummary';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000077', email: 'test@clinic.com' };
const ORG_ID = 'eeeeeeee-0000-1000-8000-000000000077';
const BRANCH_ID = 'bbbbbbbb-0000-1000-8000-000000000077';
const PATIENT_ID = 'aaaaaaaa-0000-1000-8000-000000000077';
const PERSON_ID = 'eeeeeeee-0000-1000-8000-000000000088';
const INVOICE_ID = 'ffffffff-0000-1000-8000-000000000077';
const VISIT_ID = 'cccccccc-0000-1000-8000-000000000077';
const MEMBER_ID = 'dddddddd-0000-1000-8000-000000000077';

// N-ORG-01: a non-owner branch member used to assert the dashboard's
// practice-wide financials are gated to dentist_owner only.
const STAFF_USER = { id: '00000000-0000-0000-0000-000000000099', email: 'staff@clinic.com' };
const STAFF_MEMBER_ID = 'dddddddd-0000-1000-8000-000000000099';

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
    if (user) ctx.set('user', user);
    await next();
  });
  app.get('/dental/dashboard/summary', getDashboardSummary);
  return app;
}

async function seedBaseData() {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Test Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();

  // Seed membership for TEST_USER so assertBranchAccess passes + visit FK
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID,
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Test Owner', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: 'completed',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalInvoices).values({
    id: INVOICE_ID, patientId: PATIENT_ID, visitId: VISIT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
    invoiceNumber: 'INV-TEST-001',
    subtotalCents: 50000, totalCents: 50000,
    status: 'issued', issuedAt: new Date(),
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

}

/**
 * N-ORG-01: seed a staff_scheduling member of the same branch. Membership exists
 * and is active (so assertBranchAccess would pass), but the role is NOT
 * dentist_owner — so the financials gate must reject it.
 */
async function seedStaffMember(role: 'staff_scheduling' | 'staff_full' | 'hygienist' | 'read_only') {
  await db.insert(persons).values({
    id: STAFF_USER.id, firstName: 'Front', lastName: 'Desk',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: STAFF_MEMBER_ID,
    branchId: BRANCH_ID, personId: STAFF_USER.id,
    displayName: 'Front Desk', role, status: 'active',
    pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
}

afterEach(async () => {
  await db.execute(sql`DELETE FROM lab_order`);
  await db.execute(sql`DELETE FROM dental_payment_plan_installment`);
  await db.execute(sql`DELETE FROM dental_payment_plan`);
  await db.execute(sql`DELETE FROM dental_invoice_line_item`);
  await db.execute(sql`DELETE FROM dental_invoice`);
  await db.execute(sql`DELETE FROM dental_visit`);
  await db.execute(sql`DELETE FROM patient`);
  await db.execute(sql`DELETE FROM dental_membership`);
  await db.execute(sql`DELETE FROM dental_branch`);
  await db.execute(sql`DELETE FROM dental_organization`);
  await db.execute(sql`DELETE FROM person WHERE id IN (${PERSON_ID}, ${STAFF_USER.id})`);
});

// ---------------------------------------------------------------------------
// FR0.7 + FR0.8 dashboard summary
// ---------------------------------------------------------------------------

describe('GET /dental/dashboard/summary', () => {
  test('returns zeros when no data', async () => {
    await seedBaseData();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.activePaymentPlans.count).toBe(0);
    expect(body.labOrders.totalPending).toBe(0);
  });

  test('401 without auth', async () => {
    const app = buildTestApp();
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(401);
  });

  test('FR0.7: counts active (onTrack) payment plans', async () => {
    await seedBaseData();
    await db.insert(dentalPaymentPlans).values({
      id: crypto.randomUUID(),
      invoiceId: INVOICE_ID, patientId: PATIENT_ID,
      totalCents: 30000, numberOfInstallments: 3,
      amountPerInstallmentCents: 10000,
      frequency: 'monthly', startDate: new Date(),
      status: 'on_track',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    const body = await res.json() as any;
    expect(body.activePaymentPlans.count).toBe(1);
    expect(body.activePaymentPlans.behindCount).toBe(0);
  });

  test('FR0.7: behindCount reflects behind plans', async () => {
    await seedBaseData();
    await db.insert(dentalPaymentPlans).values([
      {
        id: crypto.randomUUID(),
        invoiceId: INVOICE_ID, patientId: PATIENT_ID,
        totalCents: 10000, numberOfInstallments: 2, amountPerInstallmentCents: 5000,
        frequency: 'monthly', startDate: new Date(),
        status: 'on_track',
        createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
      },
      {
        id: crypto.randomUUID(),
        invoiceId: INVOICE_ID, patientId: PATIENT_ID,
        totalCents: 20000, numberOfInstallments: 2, amountPerInstallmentCents: 10000,
        frequency: 'monthly', startDate: new Date(),
        status: 'behind',
        createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
      },
    ]);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    const body = await res.json() as any;
    expect(body.activePaymentPlans.count).toBe(2);
    expect(body.activePaymentPlans.behindCount).toBe(1);
  });

  test('FR0.7: completed/defaulted plans not counted as active', async () => {
    await seedBaseData();
    await db.insert(dentalPaymentPlans).values({
      id: crypto.randomUUID(),
      invoiceId: INVOICE_ID, patientId: PATIENT_ID,
      totalCents: 10000, numberOfInstallments: 2, amountPerInstallmentCents: 5000,
      frequency: 'monthly', startDate: new Date(),
      status: 'completed',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    const body = await res.json() as any;
    expect(body.activePaymentPlans.count).toBe(0);
  });

  test('FR0.8: counts ordered and inFabrication lab orders', async () => {
    await seedBaseData();
    await db.insert(labOrders).values([
      {
        id: crypto.randomUUID(),
        visitId: VISIT_ID, patientId: PATIENT_ID,
        labName: 'LabCo', description: 'Crown',
        status: 'ordered',
        orderedAt: new Date(),
        createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
      },
      {
        id: crypto.randomUUID(),
        visitId: VISIT_ID, patientId: PATIENT_ID,
        labName: 'LabCo', description: 'Bridge',
        status: 'in_fabrication',
        orderedAt: new Date(),
        createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
      },
    ]);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    const body = await res.json() as any;
    expect(body.labOrders.totalPending).toBe(2);
    expect(body.labOrders.ordered).toBe(1);
    expect(body.labOrders.inFabrication).toBe(1);
  });

  test('FR0.8: delivered/fitted orders not counted as pending', async () => {
    await seedBaseData();
    await db.insert(labOrders).values({
      id: crypto.randomUUID(),
      visitId: VISIT_ID, patientId: PATIENT_ID,
      labName: 'LabCo', description: 'Crown',
      status: 'delivered',
      orderedAt: new Date(),
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    const body = await res.json() as any;
    expect(body.labOrders.totalPending).toBe(0);
  });

  test('FR0.8: overdueDelivery count for past expectedDeliveryDate', async () => {
    await seedBaseData();
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    await db.insert(labOrders).values({
      id: crypto.randomUUID(),
      visitId: VISIT_ID, patientId: PATIENT_ID,
      labName: 'LabCo', description: 'Crown',
      status: 'in_fabrication',
      orderedAt: new Date(),
      expectedDeliveryDate: pastDate,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    const body = await res.json() as any;
    expect(body.labOrders.overdueDelivery).toBe(1);
  });

  // -------------------------------------------------------------------------
  // N-ORG-01 (P1): practice financials must be gated to dentist_owner.
  // ROLE_PERMISSION_MATRIX Dashboard row: staff_scheduling = No access,
  // staff_full = no financials. API_CONTRACTS GET /dental/dashboard = dentist_owner.
  // -------------------------------------------------------------------------
  test('N-ORG-01: dentist_owner gets 200 with financials', async () => {
    await seedBaseData();
    await db.insert(dentalPaymentPlans).values({
      id: crypto.randomUUID(),
      invoiceId: INVOICE_ID, patientId: PATIENT_ID,
      totalCents: 30000, numberOfInstallments: 3, amountPerInstallmentCents: 10000,
      frequency: 'monthly', startDate: new Date(),
      status: 'on_track',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.activePaymentPlans.count).toBe(1);
    expect(body.activePaymentPlans.totalOutstandingCents).toBeDefined();
    expect(body.labOrders).toBeDefined();
  });

  test('N-ORG-01: staff_scheduling branch member is denied financials (403)', async () => {
    await seedBaseData();
    await seedStaffMember('staff_scheduling');
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(403);
  });

  test('N-ORG-01: staff_full branch member is denied financials (403)', async () => {
    await seedBaseData();
    await seedStaffMember('staff_full');
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(403);
  });

  test('N-ORG-01: read_only branch member is denied financials (403)', async () => {
    await seedBaseData();
    await seedStaffMember('read_only');
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/dashboard/summary?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(403);
  });
});
