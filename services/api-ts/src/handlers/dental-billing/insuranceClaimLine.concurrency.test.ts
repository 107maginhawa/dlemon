/**
 * insuranceClaimLine.concurrency.test.ts — claim line mutations vs concurrent claim writes.
 *
 * Both line handlers recompute the claim's aggregate (recalculateBilled: an unlocked
 * read-modify-write) and read claim.status pre-tx. Without serialization on the claim row:
 *  - updateInsuranceClaimLine: two PATCHes to different lines each recompute the claim
 *    total from a snapshot missing the other's edit → the last write loses one line's
 *    contribution (claim.billed != sum of lines).
 *  - addInsuranceClaimLine: a claim submitted (status→'submitted') mid-flight still gains a
 *    line because the mutability check read the pre-tx status → "submitted is immutable"
 *    violated; the locally-recorded claim no longer matches what was transmitted.
 *
 * Fix: both mutating txns take repo.lockClaim(claimId) (SELECT … FOR UPDATE) first. The
 * lock serializes line edits against each other and against the status UPDATE, so the
 * later writer re-reads the committed state (correct aggregate / submitted status).
 *
 * Interleavings are forced deterministically with a dedicated pg connection holding the
 * claim row lock.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
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
import { addInsuranceClaimLine } from './addInsuranceClaimLine';
import { updateInsuranceClaimLine } from './updateInsuranceClaimLine';
import {
  AddInsuranceClaimLineBody,
  AddInsuranceClaimLineParams,
  UpdateInsuranceClaimLineBody,
  UpdateInsuranceClaimLineParams,
} from '@/generated/openapi/validators';

const URL = process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test';
const db = createDatabase({ url: URL });

// Suite-unique tag: 113.
const USER = { id: '00000000-0000-4000-8000-000000113001', email: 'owner@claimlinerace.com' };
const ORG = 'ea000000-0000-4000-8000-000000113001';
const BRANCH = 'ba000000-0000-4000-8000-000000113001';
const MEMBER = 'ca000000-0000-4000-8000-000000113001';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_insurance_claim_line, dental_insurance_claim, patient, person CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'ClaimLineRace', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

async function seedClaim(status: 'draft' | 'ready', lines: number[]): Promise<{ claimId: string; lineIds: string[] }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'Claim', lastName: 'Line', createdBy: USER.id, updatedBy: USER.id });
  await db.insert(patients).values({ id: patientId, person: personId, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id });
  const repo = new DentalInsuranceClaimRepository(db);
  const billed = lines.reduce((s, n) => s + n, 0);
  const claim = await repo.createOne({
    patientId, insuranceProfileId: crypto.randomUUID(), branchId: BRANCH,
    claimNumber: repo.generateClaimNumber(), status, billedAmountCents: billed,
    patientPortionCents: billed, createdBy: USER.id, updatedBy: USER.id,
  });
  const lineIds: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = await repo.addLine({ claimId: claim.id, cdtCode: `D000${i}`, description: `Line ${i}`, billedAmountCents: lines[i]!, paidAmountCents: 0, status: 'pending', createdBy: USER.id, updatedBy: USER.id });
    lineIds.push(l.id);
  }
  return { claimId: claim.id, lineIds };
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
  app.post('/dental/billing/claims/:claimId/lines', zValidator('param', AddInsuranceClaimLineParams, ve), zValidator('json', AddInsuranceClaimLineBody, ve), addInsuranceClaimLine as any);
  app.patch('/dental/billing/claims/:claimId/lines/:lineId', zValidator('param', UpdateInsuranceClaimLineParams, ve), zValidator('json', UpdateInsuranceClaimLineBody, ve), updateInsuranceClaimLine as any);
  return app;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function claimBilled(claimId: string): Promise<number> {
  const r = await db.execute(sql`SELECT billed_amount_cents FROM dental_insurance_claim WHERE id = ${claimId}`);
  return Number(((r as any).rows?.[0] ?? (r as any)[0]).billed_amount_cents);
}
async function lineSum(claimId: string): Promise<number> {
  const r = await db.execute(sql`SELECT COALESCE(SUM(billed_amount_cents),0)::int AS s, COUNT(*)::int AS n FROM dental_insurance_claim_line WHERE claim_id = ${claimId}`);
  const x = (r as any).rows?.[0] ?? (r as any)[0];
  return Number(x.s);
}
async function lineCount(claimId: string): Promise<number> {
  const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM dental_insurance_claim_line WHERE claim_id = ${claimId}`);
  return Number(((r as any).rows?.[0] ?? (r as any)[0]).n);
}

describe('insurance claim line mutations — serialized on the claim row', () => {
  test('updateLine: a concurrent edit to another line must not be lost from the claim aggregate', async () => {
    const { claimId, lineIds } = await seedClaim('ready', [1000, 1000]); // billed 2000
    const [L1, L2] = lineIds;

    // A dedicated connection simulates handler A mid-tx: holds the claim FOR UPDATE lock,
    // has bumped L1 to 5000 and recomputed the claim to 6000 — uncommitted.
    const pool = new Pool({ connectionString: URL, max: 1 });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT id FROM dental_insurance_claim WHERE id = $1 FOR UPDATE`, [claimId]);
      await client.query(`UPDATE dental_insurance_claim_line SET billed_amount_cents = 5000 WHERE id = $1`, [L1]);
      await client.query(`UPDATE dental_insurance_claim SET billed_amount_cents = 6000 WHERE id = $1`, [claimId]);

      // Handler B edits L2 → 3000. With the fix its lockClaim blocks here; without it, it
      // recomputes from a stale snapshot (L1 still 1000) and its claim UPDATE blocks.
      const bP = buildApp().request(`/dental/billing/claims/${claimId}/lines/${L2}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billedAmountCents: 3000 }),
      });
      await sleep(300);
      await client.query('COMMIT'); // commit A (L1=5000, claim=6000)
      await bP;
    } finally {
      client.release();
      await pool.end();
    }

    const billed = await claimBilled(claimId);
    const sum = await lineSum(claimId); // L1 5000 + L2 3000 = 8000
    expect(billed, `claim.billed must equal the sum of its lines (billed=${billed} sum=${sum})`).toBe(sum);
    expect(billed).toBe(8000);
  });

  test('addLine: a claim submitted mid-flight must not gain a line', async () => {
    const { claimId } = await seedClaim('draft', []); // 0 lines

    const pool = new Pool({ connectionString: URL, max: 1 });
    const client = await pool.connect();
    let res: Response;
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE dental_insurance_claim SET status = 'submitted', submitted_at = now() WHERE id = $1`, [claimId]);

      // addLine reads status='draft' pre-tx (submit uncommitted), then its lockClaim/recalc
      // contends with the held row lock.
      const addP = buildApp().request(`/dental/billing/claims/${claimId}/lines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cdtCode: 'D2150', description: 'Amalgam', billedAmountCents: 2000 }),
      });
      await sleep(300);
      await client.query('COMMIT'); // submit commits
      res = await addP;
    } finally {
      client.release();
      await pool.end();
    }

    const status = (((await db.execute(sql`SELECT status FROM dental_insurance_claim WHERE id = ${claimId}`)) as any).rows?.[0] ?? []).status;
    expect(status, 'claim is submitted').toBe('submitted');
    expect(await lineCount(claimId), `a submitted claim must gain no line (res=${res!.status})`).toBe(0);
    expect(res!.status, 'addLine must be rejected 422').toBe(422);
    const body = (await res!.json()) as { code?: string };
    expect(body.code, 'rejected CLAIM_IMMUTABLE').toBe('CLAIM_IMMUTABLE');
  });
});
