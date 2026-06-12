/**
 * FIX-010 — patient-balance dual-source equality pin
 *
 * The FE sums per-invoice balanceCents (use-patient-billing.ts) while the
 * getPatientBalance endpoint computes its own outstandingBalanceCents. They must
 * AGREE: Σ (non-voided invoice.balanceCents) == endpoint.outstandingBalanceCents,
 * with voided invoices excluded on BOTH sides. This pin closes the dual-source
 * drift class without FE rework (the endpoint is otherwise a 0-consumer orphan).
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { getPatientBalance } from './getPatientBalance';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const USER = { id: '00000000-0000-0000-0000-0000000ba101', email: 'bal@clinic.com' };
const ORG_ID = 'ec000000-0000-1000-8000-0000000ba101';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000ba101';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000ba101';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000ba101';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000ba101';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000ba101';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Balance Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Bal', lastName: 'Ance', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.delete(dentalInvoices).where(eq(dentalInvoices.patientId, PATIENT_ID));
});

async function seedInvoice(status: string, total: number, paid: number, balance: number) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, invoiceNumber, status: status as 'issued',
    subtotalCents: total, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: total, paidCents: paid, balanceCents: balance,
    dueDate: new Date('2026-01-01T00:00:00Z'), issuedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: USER.id, updatedBy: USER.id,
  });
}

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
    ctx.set('session', { id: 's', userId: USER.id });
    await next();
  });
  app.get('/dental/billing/patients/:patientId/balance', getPatientBalance as any);
  return app;
}

describe('FIX-010 — getPatientBalance equals Σ per-invoice balanceCents (non-voided)', () => {
  test('mixed paid/partial/issued/overdue sum to the endpoint balance; voided is excluded on both sides', async () => {
    // The FE sums these per-invoice balances; voided (9999) must NOT count.
    await seedInvoice('paid', 4000, 4000, 0);
    await seedInvoice('partial', 8000, 5000, 3000);
    await seedInvoice('issued', 5000, 0, 5000);
    await seedInvoice('overdue', 2000, 0, 2000);
    await seedInvoice('voided', 9999, 0, 9999);

    // The FE's source of truth: Σ non-voided invoice.balanceCents.
    const invoiceRepo = new DentalInvoiceRepository(db);
    const invoices = await invoiceRepo.findMany({ patientId: PATIENT_ID });
    const clientVisibleBalance = invoices
      .filter((inv) => inv.status !== 'voided')
      .reduce((sum, inv) => sum + inv.balanceCents, 0);
    expect(clientVisibleBalance).toBe(10000); // 0 + 3000 + 5000 + 2000

    const res = await buildApp().request(`/dental/billing/patients/${PATIENT_ID}/balance`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;

    // EQUALITY: the endpoint and the FE's per-invoice sum must agree.
    expect(body.outstandingBalanceCents).toBe(clientVisibleBalance);
    // And the voided invoice's 9999 leaked into neither source.
    expect(body.outstandingBalanceCents).toBe(10000);
    expect(body.overdueAmountCents).toBe(2000);
  });
});
