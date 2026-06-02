/**
 * P2-14 handler tests — AR aging + batch statements (HTTP-level).
 *
 * Verifies auth gating, branch authorization, aging bucket computation across
 * patients, and batch statement generation (all-outstanding + explicit subset).
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { getArAging } from './getArAging';
import { generateStatementBatch } from './generateStatementBatch';
import {
  GetArAgingQuery,
  GenerateStatementBatchBody,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag (a14) to avoid cross-suite membership unique-index collisions.
const TEST_USER = { id: '00000000-0000-0000-0000-0000000a1401', email: 'aging@clinic.com' };
const OUTSIDER = { id: '00000000-0000-0000-0000-0000000a1499', email: 'outsider@clinic.com' };
const ORG_ID = 'ed000000-0000-1000-8000-00000000a141';
const BRANCH_ID = '7b000000-0000-4000-8000-00000000a141';
const OTHER_BRANCH_ID = '7b000000-0000-4000-8000-00000000a142';
const MEMBER_ID = '7c000000-0000-4000-8000-00000000a141';

const P1 = { patient: 'a0000000-0000-1000-8000-00000000a141', person: 'e0000000-0000-1000-8000-00000000a141' };
const P2 = { patient: 'a0000000-0000-1000-8000-00000000a142', person: 'e0000000-0000-1000-8000-00000000a142' };
const P3 = { patient: 'a0000000-0000-1000-8000-00000000a143', person: 'e0000000-0000-1000-8000-00000000a143' };

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Aging Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Aging Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: OTHER_BRANCH_ID, organizationId: ORG_ID, name: 'Other Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();

  for (const [p, name] of [[P1, 'Ana'], [P2, 'Ben'], [P3, 'Cy']] as const) {
    await db.insert(persons).values({ id: p.person, firstName: name, lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
    await db.insert(patients).values({ id: p.patient, person: p.person, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  }

  // Clean any prior invoices for these patients (idempotent re-runs).
  await db.delete(dentalInvoices).where(sql`branch_id = ${BRANCH_ID}`);

  let n = 0;
  async function inv(patientId: string, status: string, totalCents: number, paidCents: number, balanceCents: number, ageDays: number) {
    n += 1;
    const due = daysAgo(ageDays);
    await db.insert(dentalInvoices).values({
      patientId,
      branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID,
      invoiceNumber: `INV-AGING-${BRANCH_ID.slice(-4)}-${n}`,
      status: status as any,
      subtotalCents: totalCents,
      totalCents,
      paidCents,
      balanceCents,
      discountCents: 0,
      dueDate: due,
      issuedAt: due,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    }).onConflictDoNothing();
  }

  // P1: current 1000 + 90+ 4000
  await inv(P1.patient, 'partial', 5000, 0, 1000, 5);
  await inv(P1.patient, 'overdue', 4000, 0, 4000, 120);
  // P2: 30-bucket 2000
  await inv(P2.patient, 'overdue', 2000, 0, 2000, 45);
  // P2: voided (ignored)
  await inv(P2.patient, 'voided', 9999, 0, 9999, 200);
  // P3: fully paid -> no outstanding
  await inv(P3.patient, 'paid', 3000, 3000, 0, 10);
});

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

function buildApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 's', userId: user.id });
    }
    await next();
  });
  app.get('/dental/billing/collections/aging', zValidator('query', GetArAgingQuery, validationErrorHandler), getArAging as any);
  app.post('/dental/billing/statements/batch', zValidator('json', GenerateStatementBatchBody, validationErrorHandler), generateStatementBatch as any);
  return app;
}

afterEach(() => {});

describe('getArAging', () => {
  test('401 without auth', async () => {
    const res = await buildApp().request('/dental/billing/collections/aging?branchId=' + BRANCH_ID);
    expect(res.status).toBe(401);
  });

  test('403 when caller lacks branch access', async () => {
    const res = await buildApp(OUTSIDER).request('/dental/billing/collections/aging?branchId=' + BRANCH_ID);
    expect(res.status).toBe(403);
  });

  test('buckets outstanding balances per patient + summary', async () => {
    const res = await buildApp(TEST_USER).request('/dental/billing/collections/aging?branchId=' + BRANCH_ID);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const p1 = body.patients.find((r: any) => r.patientId === P1.patient);
    const p2 = body.patients.find((r: any) => r.patientId === P2.patient);
    const p3 = body.patients.find((r: any) => r.patientId === P3.patient);
    expect(p1.currentCents).toBe(1000);
    expect(p1.days90PlusCents).toBe(4000);
    expect(p1.totalOutstandingCents).toBe(5000);
    expect(p2.days30Cents).toBe(2000);
    expect(p2.totalOutstandingCents).toBe(2000); // voided excluded
    expect(p3).toBeUndefined(); // zero balance excluded
    expect(body.summary.totalOutstandingCents).toBe(7000);
    expect(body.summary.days90PlusCents).toBe(4000);
    expect(body.summary.patientCount).toBe(2);
  });
});

describe('generateStatementBatch', () => {
  test('401 without auth', async () => {
    const res = await buildApp().request('/dental/billing/statements/batch', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(401);
  });

  test('403 when caller lacks branch access', async () => {
    const res = await buildApp(OUTSIDER).request('/dental/billing/statements/batch', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(403);
  });

  test('generates statements for all outstanding patients in branch', async () => {
    const res = await buildApp(TEST_USER).request('/dental/billing/statements/batch', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.batchId).toBeTruthy();
    expect(body.statementCount).toBe(2); // P1 + P2 outstanding, P3 excluded
    expect(body.totalBalanceCents).toBe(7000);
    const p1 = body.statements.find((s: any) => s.patientId === P1.patient);
    expect(p1.balanceCents).toBe(5000);
    expect(p1.statementNumber).toMatch(/^STMT-/);
    expect(p1.oldestUnpaidInvoiceDays).toBeGreaterThanOrEqual(120);
  });

  test('explicit patientIds subset honored', async () => {
    const res = await buildApp(TEST_USER).request('/dental/billing/statements/batch', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ branchId: BRANCH_ID, patientIds: [P2.patient] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.statementCount).toBe(1);
    expect(body.statements[0].patientId).toBe(P2.patient);
  });

  test('includeZeroBalance returns zero-balance patients too', async () => {
    const res = await buildApp(TEST_USER).request('/dental/billing/statements/batch', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ branchId: BRANCH_ID, includeZeroBalance: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.statementCount).toBe(3); // includes P3
  });
});
