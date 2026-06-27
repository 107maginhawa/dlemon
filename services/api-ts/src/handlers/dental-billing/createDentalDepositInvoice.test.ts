/**
 * createDentalDepositInvoice.test.ts — §g deposit-invoice slice (S-C).
 *
 * A deposit invoice lets a dentist collect money against a PLANNED estimate
 * without loosening the performed|verified billable filter. Asserts:
 *  - mints a FINALIZED kind='deposit' invoice (status issued, due-on-receipt)
 *    with ONE non-treatment line; total == deposit (VAT carved out for VAT clinics);
 *  - capped at the active treatment-plan estimate (DQ1);
 *  - rejects when there is no active plan;
 *  - does NOT touch treatment status / billedInvoiceId (FSM untouched);
 *  - idempotent on localId (double-tap / offline replay returns the same invoice).
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { createDentalDepositInvoice } from './createDentalDepositInvoice';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { getInvoicesForKpis, getOutstandingInvoicesForAging } from './repos/billing-report.facade';
import { CreateDentalDepositInvoiceBody } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: de90 (hex only).
const USER = { id: '00000000-0000-4000-8000-00000de90001', email: 'owner@dep.com' };
const ORG = 'ea000000-0000-4000-8000-00000de90001';
const BRANCH = 'ba000000-0000-4000-8000-00000de90001';
const MEMBER = 'ca000000-0000-4000-8000-00000de90001';
const PERSON = 'fa000000-0000-4000-8000-00000de90001';
const PATIENT = 'aa000000-0000-4000-8000-00000de90001';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'Deposit Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Deposit', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_invoice_line_item, dental_invoice, dental_treatment, dental_visit CASCADE`);
});

/** Active visit with PLANNED (not performed) treatments summing to `estimate`. */
async function seedPlannedVisit(estimateCents = 6300): Promise<string> {
  const visitRepo = new VisitRepository(db);
  const v = await visitRepo.createOne({ patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER });
  const visit = await visitRepo.activate(v.id);
  const visitId = visit!.id;
  await new TreatmentRepository(db).createOne({
    visitId, patientId: PATIENT, cdtCode: 'D2740', description: 'Crown (planned)',
    priceCents: estimateCents, carriedOver: false, status: 'planned',
  });
  return visitId;
}

/** Active visit with NO treatments (no plan to deposit against). */
async function seedEmptyVisit(): Promise<string> {
  const visitRepo = new VisitRepository(db);
  const v = await visitRepo.createOne({ patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER });
  const visit = await visitRepo.activate(v.id);
  return visit!.id;
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
    ctx.set('requestId', 'test-req');
    await next();
  });
  app.post('/dental/billing/invoices/deposit', zValidator('json', CreateDentalDepositInvoiceBody, ve), createDentalDepositInvoice as any);
  return app;
}

async function postDeposit(visitId: string, depositCents: number, localId?: string) {
  const body: Record<string, unknown> = { visitId, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, depositCents };
  if (localId !== undefined) body['localId'] = localId;
  return buildApp().request('/dental/billing/invoices/deposit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('§g createDentalDepositInvoice', () => {
  test('mints a finalized kind=deposit invoice with one non-treatment line, due-on-receipt', async () => {
    const visitId = await seedPlannedVisit(6300);
    const res = await postDeposit(visitId, 3000);
    expect(res.status).toBe(201);
    const inv = await res.json() as any;
    expect(inv.kind).toBe('deposit');
    expect(inv.status).toBe('issued');          // payable now (not draft)
    expect(inv.totalCents).toBe(3000);
    expect(inv.balanceCents).toBe(3000);
    expect(inv.dueDate).toBeTruthy();            // due-on-receipt (never overdue)
    expect(inv.lineItems).toHaveLength(1);
    expect(inv.lineItems[0].treatmentId == null).toBe(true);  // non-treatment line
    expect(inv.lineItems[0].amountCents).toBe(3000);
  });

  test('does NOT touch treatment status / billedInvoiceId (FSM untouched)', async () => {
    const visitId = await seedPlannedVisit(6300);
    await postDeposit(visitId, 3000);
    const rows = await db.execute(sql`SELECT status, billed_invoice_id FROM dental_treatment WHERE visit_id = ${visitId}`);
    const t = ((rows as any).rows ?? rows)[0];
    expect(t.status).toBe('planned');                 // still planned, not billed
    expect(t.billed_invoice_id == null).toBe(true);
  });

  test('caps the deposit at the planned estimate (DQ1)', async () => {
    const visitId = await seedPlannedVisit(6300);
    const res = await postDeposit(visitId, 7000);      // > estimate
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('DEPOSIT_EXCEEDS_ESTIMATE');
  });

  test('rejects when there is no active plan to deposit against', async () => {
    const visitId = await seedEmptyVisit();
    const res = await postDeposit(visitId, 1000);
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('NO_PLANNED_WORK');
  });

  // F-03 (re-review #2): the estimate cap is CUMULATIVE across deposits.
  test('caps deposits cumulatively across multiple deposits on the visit', async () => {
    const visitId = await seedPlannedVisit(6300);
    expect((await postDeposit(visitId, 4000)).status).toBe(201);  // 4000 ≤ 6300
    const second = await postDeposit(visitId, 3000);              // 4000+3000 > 6300
    expect(second.status).toBe(422);
    expect((await second.json() as any).code).toBe('DEPOSIT_EXCEEDS_ESTIMATE');
    expect((await postDeposit(visitId, 2000)).status).toBe(201);  // 4000+2000 = 6300 ok
  });

  // F-06 (re-review #2): no deposit on a completed visit (service delivered).
  test('rejects a deposit on a completed visit', async () => {
    const visitId = await seedPlannedVisit(6300);
    await db.execute(sql`UPDATE dental_visit SET completed_at = now() WHERE id = ${visitId}`);
    const res = await postDeposit(visitId, 1000);
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('VISIT_ALREADY_COMPLETED');
  });

  test('is idempotent on localId (double-tap returns the SAME invoice, no duplicate)', async () => {
    const visitId = await seedPlannedVisit(6300);
    const first = await postDeposit(visitId, 3000, 'dep-local-1');
    expect(first.status).toBe(201);
    const i1 = await first.json() as any;
    const second = await postDeposit(visitId, 3000, 'dep-local-1');
    expect(second.status).toBe(201);
    const i2 = await second.json() as any;
    expect(i2.id).toBe(i1.id);
    const cnt = await db.execute(sql`SELECT count(*)::int AS n FROM dental_invoice WHERE branch_id = ${BRANCH}`);
    expect((((cnt as any).rows ?? cnt)[0]).n).toBe(1);
  });

  // F-04: a deposit invoice must NOT inflate revenue/AR reports (it is unearned;
  // its cash re-enters via the performed invoice's credit-application).
  test('deposit invoice is excluded from KPI revenue + AR aging facades', async () => {
    const visitId = await seedPlannedVisit(6300);
    // A standard (performed-work) invoice the reports SHOULD count.
    const repo = new DentalInvoiceRepository(db);
    await db.insert((await import('./repos/dental-invoice.schema')).dentalInvoices).values({
      id: crypto.randomUUID(), patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER,
      invoiceNumber: await repo.generateInvoiceNumber(), kind: 'standard', status: 'issued',
      subtotalCents: 6300, taxCents: 0, taxRate: '0', totalCents: 6300, paidCents: 0,
      balanceCents: 6300, issuedAt: new Date(), createdBy: USER.id, updatedBy: USER.id,
    });
    // A deposit invoice the reports MUST ignore.
    await postDeposit(visitId, 3000, 'dep-rep-1');

    const kpiRows = await getInvoicesForKpis(db, BRANCH);
    expect(kpiRows).toHaveLength(1);                       // only the standard invoice
    expect(kpiRows[0]!.totalCents).toBe(6300);
    expect(kpiRows.some((r) => r.totalCents === 3000)).toBe(false);  // deposit excluded

    const aging = await getOutstandingInvoicesForAging(db, BRANCH);
    expect(aging.every((r) => r.balanceCents !== 3000)).toBe(true);  // deposit not in AR
  });
});
