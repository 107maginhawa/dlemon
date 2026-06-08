/**
 * Cross-tenant financial-report isolation tests (EM-BIL-002).
 *
 * The branchId-auth-boundary class for dental-billing. Five report/list
 * endpoints take an OPTIONAL `branchId`:
 *   - GET  /dental/billing/collections/aging   (getArAging)
 *   - GET  /dental/billing/collections/summary (getCollectionsSummary)
 *   - GET  /dental/billing/claims/aging        (getPayerArAging)
 *   - GET  /dental/billing/claims              (listInsuranceClaims)
 *   - POST /dental/billing/statements/batch    (generateStatementBatch)
 *
 * When `branchId` is supplied the caller's membership is asserted. But when it
 * is OMITTED, the handler must still scope results to the branches the caller
 * is actually a member of — NOT the entire database. A caller in ORG_A who
 * omits branchId must NEVER see ORG_B's invoices, payments, claims, balances,
 * or patient names (cross-tenant financial-data + PHI leak).
 *
 * This suite seeds two independent orgs/branches and asserts the ORG_A caller
 * sees only ORG_A data on every omitted-branchId report.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalPayments } from './repos/dental-payment.schema';
import { dentalInsuranceClaims } from './repos/dental-insurance-claim.schema';
import { getArAging } from './getArAging';
import { getCollectionsSummary } from './getCollectionsSummary';
import { getPayerArAging } from './getPayerArAging';
import { listInsuranceClaims } from './listInsuranceClaims';
import { generateStatementBatch } from './generateStatementBatch';
import {
  GetArAgingQuery,
  GetCollectionsSummaryQuery,
  GetPayerArAgingQuery,
  ListInsuranceClaimsQuery,
  GenerateStatementBatchBody,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag (xt = cross-tenant) to avoid cross-suite collisions.
const USER_A = { id: '00000000-0000-0000-0000-0000000a7a01', email: 'a@clinic-a.com' };

const ORG_A = 'ed000000-0000-1000-8000-0000000000a1';
const ORG_B = 'ed000000-0000-1000-8000-0000000000b1';
const BRANCH_A = '7b000000-0000-4000-8000-0000000000a1';
const BRANCH_B = '7b000000-0000-4000-8000-0000000000b1';
const MEMBER_A = '7c000000-0000-4000-8000-0000000000a1';

const PA = { patient: 'a0000000-0000-1000-8000-0000000000a1', person: 'e0000000-0000-1000-8000-0000000000a1', name: 'Aaron Aclinic' };
const PB = { patient: 'a0000000-0000-1000-8000-0000000000b1', person: 'e0000000-0000-1000-8000-0000000000b1', name: 'Bianca Bclinic' };
const PROFILE_A = 'f0000000-0000-1000-8000-0000000000a1';
const PROFILE_B = 'f0000000-0000-1000-8000-0000000000b1';

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

beforeAll(async () => {
  // Two independent orgs. USER_A is a member of BRANCH_A only.
  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: 'Clinic A', tier: 'solo', ownerPersonId: USER_A.id, countryCode: 'PH', createdBy: USER_A.id, updatedBy: USER_A.id },
    { id: ORG_B, name: 'Clinic B', tier: 'solo', ownerPersonId: PB.person, countryCode: 'PH', createdBy: PB.person, updatedBy: PB.person },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'Branch A', timezone: 'Asia/Manila', createdBy: USER_A.id, updatedBy: USER_A.id },
    { id: BRANCH_B, organizationId: ORG_B, name: 'Branch B', timezone: 'Asia/Manila', createdBy: PB.person, updatedBy: PB.person },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_A, branchId: BRANCH_A, personId: USER_A.id, displayName: 'Owner A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();

  for (const [p, branch] of [[PA, BRANCH_A], [PB, BRANCH_B]] as const) {
    const parts = p.name.split(' ');
    const first = parts[0] ?? 'X';
    const rest = parts.slice(1).join(' ');
    await db.insert(persons).values({ id: p.person, firstName: first, lastName: rest, createdBy: USER_A.id, updatedBy: USER_A.id }).onConflictDoNothing();
    await db.insert(patients).values({ id: p.patient, person: p.person, preferredBranchId: branch, createdBy: USER_A.id, updatedBy: USER_A.id }).onConflictDoNothing();
  }

  // Clean prior rows for idempotent re-runs.
  await db.delete(dentalPayments).where(sql`branch_id in (${BRANCH_A}, ${BRANCH_B})`);
  await db.delete(dentalInsuranceClaims).where(sql`branch_id in (${BRANCH_A}, ${BRANCH_B})`);
  await db.delete(dentalInvoices).where(sql`branch_id in (${BRANCH_A}, ${BRANCH_B})`);

  let n = 0;
  async function inv(patientId: string, branchId: string, status: string, total: number, paid: number, balance: number, ageDays: number) {
    n += 1;
    const due = daysAgo(ageDays);
    const [row] = await db.insert(dentalInvoices).values({
      patientId, branchId, dentistMemberId: MEMBER_A,
      invoiceNumber: `INV-XT-${branchId.slice(-2)}-${n}`,
      status: status as any,
      subtotalCents: total, totalCents: total, paidCents: paid, balanceCents: balance, discountCents: 0,
      dueDate: due, issuedAt: due, createdBy: USER_A.id, updatedBy: USER_A.id,
    }).returning();
    return row!;
  }

  // ORG_A: outstanding (overdue) invoice + a payment.
  const invA = await inv(PA.patient, BRANCH_A, 'overdue', 5000, 0, 5000, 40);
  await db.insert(dentalPayments).values({
    invoiceId: invA.id, patientId: PA.patient, branchId: BRANCH_A, amountCents: 1000, method: 'cash',
    receiptNumber: 'RCP-XT-A1', recordedByMemberId: MEMBER_A, isVoid: false, createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();

  // ORG_B: outstanding (overdue) invoice + a (large) payment. MUST stay invisible to USER_A.
  const invB = await inv(PB.patient, BRANCH_B, 'overdue', 90000, 0, 90000, 200);
  await db.insert(dentalPayments).values({
    invoiceId: invB.id, patientId: PB.patient, branchId: BRANCH_B, amountCents: 77777, method: 'card',
    receiptNumber: 'RCP-XT-B1', recordedByMemberId: MEMBER_A, isVoid: false, createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();

  // Insurance claims, one per org.
  await db.insert(dentalInsuranceClaims).values([
    { patientId: PA.patient, insuranceProfileId: PROFILE_A, branchId: BRANCH_A, invoiceId: invA.id, claimNumber: 'CLM-XT-A1', status: 'submitted', billedAmountCents: 5000, paidByPayerCents: 0, patientPortionCents: 5000, submittedAt: daysAgo(30), createdBy: USER_A.id, updatedBy: USER_A.id },
    { patientId: PB.patient, insuranceProfileId: PROFILE_B, branchId: BRANCH_B, invoiceId: invB.id, claimNumber: 'CLM-XT-B1', status: 'submitted', billedAmountCents: 90000, paidByPayerCents: 0, patientPortionCents: 90000, submittedAt: daysAgo(30), createdBy: USER_A.id, updatedBy: USER_A.id },
  ]).onConflictDoNothing();
});

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

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
    ctx.set('user', USER_A);
    ctx.set('session', { id: 's', userId: USER_A.id });
    await next();
  });
  app.get('/dental/billing/collections/aging', zValidator('query', GetArAgingQuery, validationErrorHandler), getArAging as any);
  app.get('/dental/billing/collections/summary', zValidator('query', GetCollectionsSummaryQuery, validationErrorHandler), getCollectionsSummary as any);
  app.get('/dental/billing/claims/aging', zValidator('query', GetPayerArAgingQuery, validationErrorHandler), getPayerArAging as any);
  app.get('/dental/billing/claims', zValidator('query', ListInsuranceClaimsQuery, validationErrorHandler), listInsuranceClaims as any);
  app.post('/dental/billing/statements/batch', zValidator('json', GenerateStatementBatchBody, validationErrorHandler), generateStatementBatch as any);
  return app;
}

describe('EM-BIL-002: omitted-branchId reports are scoped to caller branches (no cross-tenant leak)', () => {
  test('getArAging without branchId excludes ORG_B patients/balances', async () => {
    const res = await buildApp().request('/dental/billing/collections/aging');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.patients.map((p: any) => p.patientId);
    expect(ids).toContain(PA.patient);
    expect(ids).not.toContain(PB.patient);
    // ORG_B's 90000 balance must not be aggregated into the practice-wide summary.
    expect(body.summary.totalOutstandingCents).toBe(5000);
  });

  test('getCollectionsSummary without branchId excludes ORG_B payments/invoices', async () => {
    const res = await buildApp().request('/dental/billing/collections/summary?period=year');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // Only ORG_A's 1000 payment should be collected; ORG_B's 77777 must be invisible.
    expect(body.totalCollectedCents).toBe(1000);
    expect(body.totalBilledCents).toBe(5000);
  });

  test('getPayerArAging without branchId excludes ORG_B claims', async () => {
    const res = await buildApp().request('/dental/billing/claims/aging');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const profileIds = body.payers.map((p: any) => p.insuranceProfileId);
    expect(profileIds).toContain(PROFILE_A);
    expect(profileIds).not.toContain(PROFILE_B);
    expect(body.summary.totalOutstandingCents).toBe(5000);
  });

  test('listInsuranceClaims without branchId excludes ORG_B claims', async () => {
    const res = await buildApp().request('/dental/billing/claims');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const claimNumbers = body.items.map((c: any) => c.claimNumber);
    expect(claimNumbers).toContain('CLM-XT-A1');
    expect(claimNumbers).not.toContain('CLM-XT-B1');
  });

  test('generateStatementBatch without branchId excludes ORG_B patients', async () => {
    const res = await buildApp().request('/dental/billing/statements/batch', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.statements.map((s: any) => s.patientId);
    expect(ids).toContain(PA.patient);
    expect(ids).not.toContain(PB.patient);
  });
});
