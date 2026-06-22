/**
 * updateInsuranceClaimLine.immutability.test.ts — claim-line billed-amount immutability (G1).
 *
 * Bug (plan 014 S1): updateInsuranceClaimLine accepted billedAmountCents + description with
 * NO claim.status guard, so the clinic-controlled billed amount on a SUBMITTED/PAID/written_off
 * claim could be silently rewritten (and recalculateBilled propagated it to the claim total),
 * with no audit row. Its sibling addInsuranceClaimLine rejects writes to a non-draft/ready claim
 * with CLAIM_IMMUTABLE.
 *
 * Policy after the fix:
 *   - draft/ready claim  → all line fields mutable (billed/description + payer-decision fields).
 *   - otherwise          → ONLY payer-decision fields (approvedAmountCents, paidAmountCents,
 *                          status) mutable; any billedAmountCents/description change is rejected
 *                          CLAIM_IMMUTABLE. Every accepted mutation writes a dental_audit_log row.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
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
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import { updateInsuranceClaimLine } from './updateInsuranceClaimLine';
import {
  UpdateInsuranceClaimLineParams,
  UpdateInsuranceClaimLineBody,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// File-unique tag: 114.
const USER = { id: '11400000-0000-4000-8000-000000000001', email: 'owner@claimimmut.com' };
const ORG = '11400000-0000-4000-8000-000000000002';
const BRANCH = '11400000-0000-4000-8000-000000000003';
const MEMBER = '11400000-0000-4000-8000-000000000004';
const PERSON = '11400000-0000-4000-8000-000000000005';
const PATIENT = '11400000-0000-4000-8000-000000000006';
const PROFILE = '11400000-0000-4000-8000-000000000007';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({ id: ORG, name: '114 Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Claim', lastName: 'Immut', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_insurance_claim_line, dental_insurance_claim CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
});

async function seedClaim(status: string, billed = 5000): Promise<{ claimId: string; lineId: string }> {
  const repo = new DentalInsuranceClaimRepository(db);
  const claim = await repo.createOne({
    patientId: PATIENT, insuranceProfileId: PROFILE, branchId: BRANCH,
    claimNumber: repo.generateClaimNumber(), status: status as any,
    billedAmountCents: billed, paidByPayerCents: 0, patientPortionCents: billed,
    createdBy: USER.id, updatedBy: USER.id,
  });
  const line = await repo.addLine({
    claimId: claim.id, cdtCode: 'D2150', description: 'Amalgam', billedAmountCents: billed,
    paidAmountCents: 0, status: 'pending', createdBy: USER.id, updatedBy: USER.id,
  });
  return { claimId: claim.id, lineId: line.id };
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
  app.patch('/dental/billing/claims/:claimId/lines/:lineId', zValidator('param', UpdateInsuranceClaimLineParams, ve), zValidator('json', UpdateInsuranceClaimLineBody, ve), updateInsuranceClaimLine as any);
  return app;
}

async function lineBilled(lineId: string): Promise<number> {
  const r = await db.execute(sql`SELECT billed_amount_cents FROM dental_insurance_claim_line WHERE id = ${lineId}`);
  return Number(((r as any).rows?.[0] ?? (r as any)[0]).billed_amount_cents);
}
async function auditCount(action: string): Promise<number> {
  const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM dental_audit_log WHERE action = ${action}`);
  return Number(((r as any).rows?.[0] ?? (r as any)[0]).n);
}

describe('updateInsuranceClaimLine — billed-amount immutability after submission (G1)', () => {
  test('rejects a billedAmountCents edit on a PAID claim line (CLAIM_IMMUTABLE)', async () => {
    const { claimId, lineId } = await seedClaim('paid', 5000);
    const res = await buildApp().request(`/dental/billing/claims/${claimId}/lines/${lineId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ billedAmountCents: 99999 }),
    });
    expect(res.status, 'billed edit on a paid claim must be rejected 422').toBe(422);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('CLAIM_IMMUTABLE');
    expect(await lineBilled(lineId), 'billed amount must be unchanged').toBe(5000);
  });

  test('rejects a description edit on a SUBMITTED claim line (CLAIM_IMMUTABLE)', async () => {
    const { claimId, lineId } = await seedClaim('submitted', 5000);
    const res = await buildApp().request(`/dental/billing/claims/${claimId}/lines/${lineId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'rewritten' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('CLAIM_IMMUTABLE');
  });

  test('allows a payer-decision update on a SUBMITTED claim line + writes an audit row', async () => {
    const { claimId, lineId } = await seedClaim('submitted', 5000);
    const res = await buildApp().request(`/dental/billing/claims/${claimId}/lines/${lineId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approvedAmountCents: 4000, status: 'covered' }),
    });
    expect(res.status, 'payer-decision update on a submitted claim must succeed').toBe(200);
    const body = (await res.json()) as { approvedAmountCents?: number; status?: string };
    expect(body.approvedAmountCents).toBe(4000);
    expect(body.status).toBe('covered');
    expect(await auditCount('insurance_claim_line.update'), 'an audit row must be written').toBe(1);
  });

  test('allows all fields (incl. billed) on a DRAFT claim line', async () => {
    const { claimId, lineId } = await seedClaim('draft', 5000);
    const res = await buildApp().request(`/dental/billing/claims/${claimId}/lines/${lineId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ billedAmountCents: 7000, description: 'edited pre-submission' }),
    });
    expect(res.status, 'billed edit on a draft claim is allowed').toBe(200);
    expect(await lineBilled(lineId)).toBe(7000);
  });
});
