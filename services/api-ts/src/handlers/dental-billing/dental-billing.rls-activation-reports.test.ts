/**
 * RLS P1b activation — dental-billing EM-BIL-002 multi-branch reports (Tier-1).
 *
 * The five report/list endpoints that take an OPTIONAL `branchId` are the exact
 * leak class ADR-010's RLS gate was built for (EM-BIL-002): when branchId is
 * omitted they scope to the caller's active-branch set. P1b makes that scope a
 * DB-enforced second wall by routing each report's payload reads through
 * `withTenantTx({branchIds: scope})` — opening a tx, publishing the branch set,
 * and `SET LOCAL ROLE app_rls` so the read is filtered by the policies, not just
 * by the app-level `inArray(branchId, …)` filter.
 *
 * This file is the activation contract for the 5 reports. It asserts:
 *
 *   1. ROUTING (RED-first): each report opens a tenant transaction — its data
 *      access goes through withTenantTx. Observable as a db.transaction() call
 *      (these reports do no other tx work; logAuditEvent is not called here).
 *      Before activation the reports read the pooled db directly → ZERO
 *      transactions → this assertion FAILS (RED).
 *   2. CORRECT SCOPE (behavioral): the omitted-branchId report still returns the
 *      caller's own (ORG_A) data. Because the query now runs as app_rls, a
 *      wrong/empty branch scope would make RLS return ZERO rows → the happy path
 *      would go empty — so a populated ORG_A result proves the scope passed to
 *      withTenantTx (the caller's active-branch set) was correct.
 *   3. ISOLATION: ORG_B rows seeded as the superuser are NOT returned to the
 *      ORG_A caller (the EM-BIL-002 leak class, now double-walled).
 *
 * Runs against its own cloned DB (scripts/test-with-db.ts), which carries
 * migrations 0104–0106 (app_rls + policies on dental_invoice / dental_payment /
 * dental_insurance_claim et al).
 */

import { describe, test, expect, beforeAll, spyOn } from 'bun:test';
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

// File-unique ids (own clone, distinct prefix 1ba = P1b billing).
const USER_A = { id: '1ba00000-0000-4000-8000-00000000a001', email: 'owner@a.com' };
const ORG_A = '1ba00000-0000-4000-8000-00000000a002';
const BRANCH_A = '1ba00000-0000-4000-8000-00000000a003';
const MEMBER_A = '1ba00000-0000-4000-8000-00000000a004';
const PA = { patient: '1ba00000-0000-4000-8000-00000000a006', person: '1ba00000-0000-4000-8000-00000000a005', name: 'Aaron Aclinic' };
const PROFILE_A = '1ba00000-0000-4000-8000-00000000a007';

const OWNER_B = '1ba00000-0000-4000-8000-00000000b001';
const ORG_B = '1ba00000-0000-4000-8000-00000000b002';
const BRANCH_B = '1ba00000-0000-4000-8000-00000000b003';
const MEMBER_B = '1ba00000-0000-4000-8000-00000000b004';
const PB = { patient: '1ba00000-0000-4000-8000-00000000b006', person: '1ba00000-0000-4000-8000-00000000b005', name: 'Bianca Bclinic' };
const PROFILE_B = '1ba00000-0000-4000-8000-00000000b007';

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

beforeAll(async () => {
  // Two independent orgs. USER_A is a member of BRANCH_A only. All seeded as the
  // postgres superuser (bypasses RLS) — exactly the production write path today.
  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: '1ba Clinic A', tier: 'solo', ownerPersonId: USER_A.id, countryCode: 'PH', createdBy: USER_A.id, updatedBy: USER_A.id },
    { id: ORG_B, name: '1ba Clinic B', tier: 'solo', ownerPersonId: OWNER_B, countryCode: 'PH', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'Branch A', timezone: 'Asia/Manila', createdBy: USER_A.id, updatedBy: USER_A.id },
    { id: BRANCH_B, organizationId: ORG_B, name: 'Branch B', timezone: 'Asia/Manila', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: MEMBER_A, branchId: BRANCH_A, personId: USER_A.id, displayName: 'Owner A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER_A.id, updatedBy: USER_A.id },
    { id: MEMBER_B, branchId: BRANCH_B, personId: OWNER_B, displayName: 'Owner B', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  for (const [p, branch, owner] of [[PA, BRANCH_A, USER_A.id], [PB, BRANCH_B, OWNER_B]] as const) {
    const parts = p.name.split(' ');
    await db.insert(persons).values({ id: p.person, firstName: parts[0] ?? 'X', lastName: parts.slice(1).join(' '), createdBy: owner, updatedBy: owner }).onConflictDoNothing();
    await db.insert(patients).values({ id: p.patient, person: p.person, preferredBranchId: branch, createdBy: owner, updatedBy: owner }).onConflictDoNothing();
  }

  // Idempotent re-run cleanup.
  await db.delete(dentalPayments).where(sql`branch_id in (${BRANCH_A}, ${BRANCH_B})`);
  await db.delete(dentalInsuranceClaims).where(sql`branch_id in (${BRANCH_A}, ${BRANCH_B})`);
  await db.delete(dentalInvoices).where(sql`branch_id in (${BRANCH_A}, ${BRANCH_B})`);

  let n = 0;
  async function inv(patientId: string, branchId: string, owner: string, member: string, status: string, total: number, paid: number, balance: number, ageDays: number) {
    n += 1;
    const due = daysAgo(ageDays);
    const [row] = await db.insert(dentalInvoices).values({
      patientId, branchId, dentistMemberId: member,
      invoiceNumber: `INV-1ba-${branchId.slice(-2)}-${n}`,
      status: status as any,
      subtotalCents: total, totalCents: total, paidCents: paid, balanceCents: balance, discountCents: 0,
      dueDate: due, issuedAt: due, createdBy: owner, updatedBy: owner,
    }).returning();
    return row!;
  }

  // ORG_A: outstanding (overdue) invoice + a payment.
  const invA = await inv(PA.patient, BRANCH_A, USER_A.id, MEMBER_A, 'overdue', 5000, 0, 5000, 40);
  await db.insert(dentalPayments).values({
    invoiceId: invA.id, patientId: PA.patient, branchId: BRANCH_A, amountCents: 1000, method: 'cash',
    receiptNumber: 'RCP-1ba-A1', recordedByMemberId: MEMBER_A, isVoid: false, createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();

  // ORG_B: outstanding invoice + large payment. MUST stay invisible to USER_A.
  const invB = await inv(PB.patient, BRANCH_B, OWNER_B, MEMBER_B, 'overdue', 90000, 0, 90000, 200);
  await db.insert(dentalPayments).values({
    invoiceId: invB.id, patientId: PB.patient, branchId: BRANCH_B, amountCents: 77777, method: 'card',
    receiptNumber: 'RCP-1ba-B1', recordedByMemberId: MEMBER_B, isVoid: false, createdBy: OWNER_B, updatedBy: OWNER_B,
  }).onConflictDoNothing();

  await db.insert(dentalInsuranceClaims).values([
    { patientId: PA.patient, insuranceProfileId: PROFILE_A, branchId: BRANCH_A, invoiceId: invA.id, claimNumber: 'CLM-1ba-A1', status: 'submitted', billedAmountCents: 5000, paidByPayerCents: 0, patientPortionCents: 5000, submittedAt: daysAgo(30), createdBy: USER_A.id, updatedBy: USER_A.id },
    { patientId: PB.patient, insuranceProfileId: PROFILE_B, branchId: BRANCH_B, invoiceId: invB.id, claimNumber: 'CLM-1ba-B1', status: 'submitted', billedAmountCents: 90000, paidByPayerCents: 0, patientPortionCents: 90000, submittedAt: daysAgo(30), createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
});

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
    ctx.set('user', USER_A);
    ctx.set('session', { id: 's', userId: USER_A.id });
    await next();
  });
  app.get('/dental/billing/collections/aging', zValidator('query', GetArAgingQuery, ve), getArAging as any);
  app.get('/dental/billing/collections/summary', zValidator('query', GetCollectionsSummaryQuery, ve), getCollectionsSummary as any);
  app.get('/dental/billing/claims/aging', zValidator('query', GetPayerArAgingQuery, ve), getPayerArAging as any);
  app.get('/dental/billing/claims', zValidator('query', ListInsuranceClaimsQuery, ve), listInsuranceClaims as any);
  app.post('/dental/billing/statements/batch', zValidator('json', GenerateStatementBatchBody, ve), generateStatementBatch as any);
  return app;
}

describe('RLS P1b — dental-billing EM-BIL-002 reports route through withTenantTx (activation)', () => {
  test('getArAging (omitted branchId) opens a tenant tx and excludes ORG_B', async () => {
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/billing/collections/aging');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      const ids = body.patients.map((p: any) => p.patientId);
      expect(ids).toContain(PA.patient);          // CORRECT SCOPE
      expect(ids).not.toContain(PB.patient);       // ISOLATION
      expect(body.summary.totalOutstandingCents).toBe(5000);
      expect(txSpy).toHaveBeenCalled();            // ROUTING (RED before activation)
    } finally {
      txSpy.mockRestore();
    }
  });

  test('getCollectionsSummary (omitted branchId) opens a tenant tx and excludes ORG_B', async () => {
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/billing/collections/summary?period=year');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.totalCollectedCents).toBe(1000); // CORRECT SCOPE (ORG_A only)
      expect(body.totalBilledCents).toBe(5000);    // ISOLATION (ORG_B 90000 excluded)
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('getPayerArAging (omitted branchId) opens a tenant tx and excludes ORG_B', async () => {
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/billing/claims/aging');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      const profileIds = body.payers.map((p: any) => p.insuranceProfileId);
      expect(profileIds).toContain(PROFILE_A);
      expect(profileIds).not.toContain(PROFILE_B);
      expect(body.summary.totalOutstandingCents).toBe(5000);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('listInsuranceClaims (omitted branchId) opens a tenant tx and excludes ORG_B', async () => {
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/billing/claims');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      const claimNumbers = body.items.map((c: any) => c.claimNumber);
      expect(claimNumbers).toContain('CLM-1ba-A1');
      expect(claimNumbers).not.toContain('CLM-1ba-B1');
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('generateStatementBatch (omitted branchId) opens a tenant tx and excludes ORG_B', async () => {
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/billing/statements/batch', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      const ids = body.statements.map((s: any) => s.patientId);
      expect(ids).toContain(PA.patient);
      expect(ids).not.toContain(PB.patient);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });
});
