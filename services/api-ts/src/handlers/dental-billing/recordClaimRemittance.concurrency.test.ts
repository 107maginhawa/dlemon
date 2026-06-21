/**
 * recordClaimRemittance.concurrency.test.ts — concurrent claim over-post race.
 *
 * The PAYER_OVERPOST guard (recordClaimRemittance.ts:87) compares paid+disallowed against
 * claim.paidByPayerCents/disallowedCents read by a plain SELECT BEFORE the tx (line 57).
 * applyRemittance (dental-insurance-claim.repo.ts:154-175) is a JS read-modify-write with
 * NO row lock and NO conditional WHERE (the "Atomically" comment is wrong). Under READ
 * COMMITTED two remittances with DIFFERENT references both read the same alreadySettled,
 * both pass the guard (the partial-unique on (claim_id, reference) only stops same-ref
 * replay), and both post — together exceeding billed. The claim total even masks it (last
 * read-modify-write wins → paidByPayerCents understates the SUM of payer_payment rows),
 * so cumulative payer money on the claim silently exceeds what was billed.
 *
 * Fix: serialize remittances per claim with a per-claim pg_advisory_xact_lock(1004,…) at
 * the top of the tx + re-assert the over-post guard against the committed state under the
 * lock (mirrors refundDentalPayment's advisory lock). The loser re-reads the settled total
 * and throws PAYER_OVERPOST before recording anything.
 *
 * RED-proof: without the lock+re-check a round races → both 201, two payer_payment rows
 * summing 12000 > billed 10000. GREEN: exactly one 201 + one 422 PAYER_OVERPOST, and the
 * sum of payer payments == claim.paidByPayerCents <= billed.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import { recordClaimRemittance } from './recordClaimRemittance';
import { RecordClaimRemittanceBody, RecordClaimRemittanceParams } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 108.
const USER = { id: '00000000-0000-4000-8000-000000108001', email: 'owner@remitrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000108001';
const BRANCH = 'ba000000-0000-4000-8000-000000108001';
const MEMBER = 'ca000000-0000-4000-8000-000000108001';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_payer_payment, dental_insurance_claim_line, dental_insurance_claim, patient, person CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'RemitRace Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

/** Seed an approved, invoice-less claim billed at 10000 (focuses the test on the claim over-post). */
async function seedApprovedClaim(): Promise<{ claimId: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'Remit', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id });
  await db.insert(patients).values({ id: patientId, person: personId, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id });
  const repo = new DentalInsuranceClaimRepository(db);
  const claim = await repo.createOne({
    patientId,
    insuranceProfileId: crypto.randomUUID(), // no FK on this column
    branchId: BRANCH,
    invoiceId: null,
    claimNumber: repo.generateClaimNumber(),
    status: 'approved',
    billedAmountCents: 10000,
    paidByPayerCents: 0,
    patientPortionCents: 10000,
    createdBy: USER.id,
    updatedBy: USER.id,
  });
  return { claimId: claim.id };
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
  app.post('/dental/billing/claims/:claimId/remittance', zValidator('param', RecordClaimRemittanceParams, ve), zValidator('json', RecordClaimRemittanceBody, ve), recordClaimRemittance as any);
  return app;
}

function remit(claimId: string, amountCents: number, ref: string) {
  return buildApp().request(`/dental/billing/claims/${claimId}/remittance`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents, remittanceReference: ref, method: 'bank_transfer' }),
  });
}

async function claimState(claimId: string): Promise<{ paidByPayer: number; billed: number; payerSum: number; payerRows: number }> {
  const cr = await db.execute(sql`SELECT paid_by_payer_cents, billed_amount_cents FROM dental_insurance_claim WHERE id = ${claimId}`);
  const c = (cr as any).rows?.[0] ?? (cr as any)[0];
  const pr = await db.execute(sql`SELECT COALESCE(SUM(amount_cents),0)::int AS s, COUNT(*)::int AS n FROM dental_payer_payment WHERE claim_id = ${claimId}`);
  const p = (pr as any).rows?.[0] ?? (pr as any)[0];
  return { paidByPayer: Number(c.paid_by_payer_cents), billed: Number(c.billed_amount_cents), payerSum: Number(p.s), payerRows: Number(p.n) };
}

describe('recordClaimRemittance — concurrent remittances cannot over-post a claim past billed', () => {
  test('two simultaneous remittances each <= billed but summing > billed → exactly one 201, one 422 PAYER_OVERPOST', async () => {
    const ROUNDS = 8;
    for (let i = 0; i < ROUNDS; i++) {
      const { claimId } = await seedApprovedClaim();
      // Each pays 6000 (<= billed 10000 alone), distinct refs so the (claim,ref) unique
      // does not collide; together 12000 > 10000.
      const [a, b] = await Promise.all([remit(claimId, 6000, `RA-${i}-A`), remit(claimId, 6000, `RA-${i}-B`)]);
      const statuses = [a.status, b.status];

      const { paidByPayer, billed, payerSum, payerRows } = await claimState(claimId);

      // Money-integrity invariant: cumulative payer money on the claim never exceeds billed,
      // and the claim's recorded total equals the sum of its payer-payment rows.
      expect(payerSum, `round ${i}: payer payments must not exceed billed (sum=${payerSum} billed=${billed} statuses=${statuses})`).toBeLessThanOrEqual(billed);
      expect(paidByPayer, `round ${i}: claim total must equal the payer-payment sum`).toBe(payerSum);
      expect(payerRows, `round ${i}: exactly one remittance may post`).toBe(1);
      expect(paidByPayer, `round ${i}: exactly one 6000 remittance posted`).toBe(6000);

      const winners = [a, b].filter((r) => r.status === 201);
      expect(winners.length, `round ${i}: exactly one remittance may succeed (statuses ${statuses})`).toBe(1);
      const loser = [a, b].find((r) => r.status !== 201)!;
      expect(loser.status, `round ${i}: the loser must be a clean 422`).toBe(422);
      const loserBody = (await loser.json()) as { code?: string };
      expect(loserBody.code, `round ${i}: loser must be PAYER_OVERPOST`).toBe('PAYER_OVERPOST');

      await db.execute(sql`TRUNCATE TABLE dental_payer_payment, dental_insurance_claim_line, dental_insurance_claim, patient, person CASCADE`);
    }
  });
});
