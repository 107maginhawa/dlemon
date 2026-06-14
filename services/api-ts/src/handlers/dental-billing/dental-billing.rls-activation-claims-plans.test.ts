/**
 * RLS P1b activation — dental-billing claims + payer remittance + payment-plan
 * create + patient balance (Tier-1 activation).
 *
 * Routes each handler's payload DB access through withTenantTx so the app_rls
 * policies on dental_insurance_claim + dental_payer_payment + dental_invoice
 * (all Tier-1, armed in P1a) enforce the branch scope as a DB-level second wall.
 *
 * Activation contract (locked pattern from dental_visit / billing PR-A/PR-B):
 *   - Entity-resolution fetch + authz + audit writes stay on the bypassing db
 *     connection → exact existing 403/404 behavior preserved (the claim handlers
 *     deliberately convert cross-tenant denial to 404).
 *   - Armed-table payload reads/writes wrap in withTenantTx.
 *   - Single-resource by-PK GETs (getInsuranceClaim, getDentalPaymentReceipt,
 *     getDentalPaymentPlan) get NO wrap, and the no-branch-resolved read-only
 *     estimateClaimCoverage gets NO wrap — asserted by control tests.
 *
 * RED-first: each activated handler must OPEN a tenant transaction (a
 * db.transaction() call; logAuditEvent is a plain insert). Before activation
 * these handlers read the pooled db directly → ZERO transactions → the routing
 * assertion FAILS.
 *
 * Note: dental_payment_plan / installment are Tier-3 (armed in P4).
 * createDentalPaymentPlan is wrapped here for atomicity (plan + installments)
 * and to pre-route the choke point; its branch scope is resolved via the armed
 * invoice. The plan-status GET/PATCH handlers are deferred to P4 (no armed-table
 * payload) and are covered by the no-wrap controls.
 *
 * Runs against its own cloned DB (scripts/test-with-db.ts) carrying 0104–0106.
 */

import { describe, test, expect, beforeAll, afterEach, spyOn } from 'bun:test';
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
import { dentalInsuranceProfiles } from '@/handlers/dental-patient/repos/insurance-profile.schema';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { createInsuranceClaim } from './createInsuranceClaim';
import { getInsuranceClaim } from './getInsuranceClaim';
import { updateInsuranceClaimStatus } from './updateInsuranceClaimStatus';
import { addInsuranceClaimLine } from './addInsuranceClaimLine';
import { updateInsuranceClaimLine } from './updateInsuranceClaimLine';
import { recordClaimRemittance } from './recordClaimRemittance';
import { estimateClaimCoverage } from './estimateClaimCoverage';
import { createDentalPaymentPlan } from './createDentalPaymentPlan';
import { getDentalPaymentReceipt } from './getDentalPaymentReceipt';
import { getPatientBalance } from './getPatientBalance';
import {
  CreateDentalPaymentPlanBody,
  CreateDentalPaymentPlanParams,
  CreateInsuranceClaimBody,
  GetInsuranceClaimParams,
  UpdateInsuranceClaimStatusParams,
  UpdateInsuranceClaimStatusBody,
  AddInsuranceClaimLineParams,
  AddInsuranceClaimLineBody,
  UpdateInsuranceClaimLineParams,
  UpdateInsuranceClaimLineBody,
  RecordClaimRemittanceParams,
  RecordClaimRemittanceBody,
  EstimateClaimCoverageBody,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// File-unique ids (own clone, distinct prefix 1bc = P1b billing claims/plans).
const USER = { id: '1bc00000-0000-4000-8000-00000000a001', email: 'owner@a.com' };
const ORG = '1bc00000-0000-4000-8000-00000000a002';
const BRANCH = '1bc00000-0000-4000-8000-00000000a003';
const MEMBER = '1bc00000-0000-4000-8000-00000000a004';
const PERSON = '1bc00000-0000-4000-8000-00000000a005';
const PATIENT = '1bc00000-0000-4000-8000-00000000a006';
const PROFILE = '1bc00000-0000-4000-8000-00000000a007';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({ id: ORG, name: '1bc Clinic A', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Test', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalInsuranceProfiles).values({
    id: PROFILE, patientId: PATIENT, insurerName: 'Acme HMO', policyNumber: 'POL-1', subscriberName: 'Test Patient',
    active: true, createdBy: USER.id, updatedBy: USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payer_payment, dental_insurance_claim_line, dental_insurance_claim, dental_payment, dental_payment_plan_installment, dental_payment_plan, dental_invoice CASCADE`);
});

async function seedInvoice(opts: { status?: string; totalCents?: number; paidCents?: number; balanceCents?: number } = {}) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const total = opts.totalCents ?? 10000;
  const paid = opts.paidCents ?? 0;
  const balance = opts.balanceCents ?? total - paid;
  const [row] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER,
    invoiceNumber: await invoiceRepo.generateInvoiceNumber(),
    status: (opts.status ?? 'issued') as any,
    subtotalCents: total, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: total, paidCents: paid, balanceCents: balance, issuedAt: new Date(),
    createdBy: USER.id, updatedBy: USER.id,
  }).returning();
  return row!;
}

/** Seed a claim with one line in the given status (optionally invoice-anchored). */
async function seedClaim(opts: { status?: string; invoiceId?: string; billed?: number } = {}) {
  const repo = new DentalInsuranceClaimRepository(db);
  const billed = opts.billed ?? 5000;
  const claim = await repo.createOne({
    patientId: PATIENT, insuranceProfileId: PROFILE, branchId: BRANCH,
    invoiceId: opts.invoiceId ?? null,
    claimNumber: repo.generateClaimNumber(), status: (opts.status ?? 'draft') as any,
    billedAmountCents: billed, paidByPayerCents: 0, patientPortionCents: billed,
    createdBy: USER.id, updatedBy: USER.id,
  });
  const [line] = await repo.createLines([{
    claimId: claim.id, cdtCode: 'D2150', description: 'Amalgam', billedAmountCents: billed,
    paidAmountCents: 0, status: 'pending', createdBy: USER.id, updatedBy: USER.id,
  }]);
  return { claim, line: line! };
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
    ctx.set('session', { id: 's', userId: USER.id });
    ctx.set('requestId', 'test-req');
    await next();
  });
  app.post('/dental/billing/claims', zValidator('json', CreateInsuranceClaimBody, ve), createInsuranceClaim as any);
  app.get('/dental/billing/claims/:claimId', zValidator('param', GetInsuranceClaimParams, ve), getInsuranceClaim as any);
  app.patch('/dental/billing/claims/:claimId/status', zValidator('param', UpdateInsuranceClaimStatusParams, ve), zValidator('json', UpdateInsuranceClaimStatusBody, ve), updateInsuranceClaimStatus as any);
  app.post('/dental/billing/claims/:claimId/lines', zValidator('param', AddInsuranceClaimLineParams, ve), zValidator('json', AddInsuranceClaimLineBody, ve), addInsuranceClaimLine as any);
  app.patch('/dental/billing/claims/:claimId/lines/:lineId', zValidator('param', UpdateInsuranceClaimLineParams, ve), zValidator('json', UpdateInsuranceClaimLineBody, ve), updateInsuranceClaimLine as any);
  app.post('/dental/billing/claims/:claimId/remittance', zValidator('param', RecordClaimRemittanceParams, ve), zValidator('json', RecordClaimRemittanceBody, ve), recordClaimRemittance as any);
  app.post('/dental/billing/estimate', zValidator('json', EstimateClaimCoverageBody, ve), estimateClaimCoverage as any);
  app.post('/dental/billing/invoices/:invoiceId/plan', zValidator('param', CreateDentalPaymentPlanParams, ve), zValidator('json', CreateDentalPaymentPlanBody, ve), createDentalPaymentPlan as any);
  app.get('/dental/billing/invoices/:invoiceId/payments/:paymentId/receipt', getDentalPaymentReceipt as any);
  app.get('/dental/billing/patients/:patientId/balance', getPatientBalance as any);
  return app;
}

describe('RLS P1b — dental-billing claims/plans route through withTenantTx (activation)', () => {
  test('createInsuranceClaim opens a tenant tx and writes the claim', async () => {
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/billing/claims', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patientId: PATIENT, insuranceProfileId: PROFILE, lines: [{ cdtCode: 'D2150', description: 'Amalgam', billedAmountCents: 5000 }] }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.branchId).toBe(BRANCH);
      expect(body.lines.length).toBe(1);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('updateInsuranceClaimStatus opens a tenant tx and transitions the claim', async () => {
    const { claim } = await seedClaim({ status: 'draft' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/claims/${claim.id}/status`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ready' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('ready');
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('addInsuranceClaimLine opens a tenant tx and adds the line', async () => {
    const { claim } = await seedClaim({ status: 'draft' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/claims/${claim.id}/lines`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cdtCode: 'D2160', description: 'Amalgam 2srf', billedAmountCents: 6000 }),
      });
      expect(res.status).toBe(201);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('updateInsuranceClaimLine opens a tenant tx and updates the line', async () => {
    const { claim, line } = await seedClaim({ status: 'draft' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/claims/${claim.id}/lines/${line.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'covered', approvedAmountCents: 4000, paidAmountCents: 4000 }),
      });
      expect(res.status).toBe(200);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('recordClaimRemittance opens a tenant tx and posts the payer payment', async () => {
    const inv = await seedInvoice({ status: 'issued', totalCents: 5000, balanceCents: 5000 });
    const { claim } = await seedClaim({ status: 'approved', invoiceId: inv.id, billed: 5000 });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/claims/${claim.id}/remittance`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountCents: 4000, method: 'bank_transfer' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.payerPayment.branchId).toBe(BRANCH);
      expect(body.payerPayment.amountCents).toBe(4000);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('createDentalPaymentPlan opens a tenant tx and creates the plan + installments', async () => {
    const inv = await seedInvoice({ status: 'issued', totalCents: 30000, balanceCents: 30000 });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices/${inv.id}/plan`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patientId: PATIENT, numberOfInstallments: 3, frequency: 'monthly', startDate: new Date().toISOString() }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.installments.length).toBe(3);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('getPatientBalance opens a tenant tx and returns the scoped balance', async () => {
    await seedInvoice({ status: 'issued', totalCents: 10000, paidCents: 3000, balanceCents: 7000 });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/patients/${PATIENT}/balance`);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.outstandingBalanceCents).toBe(7000);   // CORRECT SCOPE under app_rls
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  // ── No-wrap controls (single-resource by-PK GET / no-branch read-only) ──────
  test('getInsuranceClaim (by-PK GET) does NOT open a tenant tx', async () => {
    const { claim } = await seedClaim({ status: 'draft' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/claims/${claim.id}`);
      expect(res.status).toBe(200);
      expect(txSpy).not.toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('getDentalPaymentReceipt (by-PK GET) does NOT open a tenant tx', async () => {
    const inv = await seedInvoice({ status: 'partial', totalCents: 10000, paidCents: 5000, balanceCents: 5000 });
    const payment = await new DentalPaymentRepository(db).createOne({
      invoiceId: inv.id, patientId: PATIENT, branchId: BRANCH, amountCents: 5000, method: 'cash',
      receiptNumber: `RCP-1bc-${crypto.randomUUID().slice(0, 8)}`, recordedByMemberId: MEMBER,
    });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/billing/invoices/${inv.id}/payments/${payment.id}/receipt`);
      expect(res.status).toBe(200);
      expect(txSpy).not.toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('estimateClaimCoverage (read-only, no branch resolved) does NOT open a tenant tx', async () => {
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/billing/estimate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lines: [{ cdtCode: 'D2150', billedAmountCents: 5000 }] }),
      });
      expect(res.status).toBe(200);
      expect(txSpy).not.toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });
});
