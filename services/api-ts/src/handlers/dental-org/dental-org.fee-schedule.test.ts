/**
 * EF-ORG-P016 — Fee schedule endpoints (WF-025, FR6.3)
 *
 *   GET   /dental/fee-schedule?branchId=...        (dentist_owner, dentist_associate)
 *   PATCH /dental/fee-schedule/:cdt                (dentist_owner only)
 *
 * The fee schedule is the active CDT procedure-code catalog (owned by
 * dental-visit, read via a facade) with per-branch price overrides stored on
 * `dental_branch.settings.feeSchedule` (Record<cdtCode, priceCents>). Currency
 * comes from `settings.currency`.
 *
 * Two layers of coverage:
 *  1. Real-app registration smoke (createApp) — proves the routes are wired in
 *     app.ts, not just locally (handler-only tests miss route-registration bugs).
 *  2. Behavioral tests via a local Hono app mirroring app.ts registration.
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { createApp, parseConfig } from '@/index';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalProcedureCodes } from '@/handlers/dental-visit/repos/procedure-code.schema';
import { getFeeSchedule, updateFeeScheduleEntry } from './feeSchedule';

const DB_URL = process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test';
const db = createDatabase({ url: DB_URL });

// UUID prefix `fc` — avoids collision with ee/bb/ff/ac namespaces in sibling tests.
const USER_OWNER  = { id: 'fc000000-0000-4000-8000-000000000001', email: 'owner@fee.test' };
const USER_ASSOC  = { id: 'fc000000-0000-4000-8000-000000000002', email: 'assoc@fee.test' };
const USER_STAFF  = { id: 'fc000000-0000-4000-8000-000000000003', email: 'staff@fee.test' };
const USER_NOMEM  = { id: 'fc000000-0000-4000-8000-000000000099', email: 'nomem@fee.test' };
const ORG_ID      = 'fc500000-0000-4000-8000-000000000001';
const BRANCH_ID   = 'fc400000-0000-4000-8000-000000000001';
const MEMBER_OWNER = 'fc600000-0000-4000-8000-000000000001';
const MEMBER_ASSOC = 'fc600000-0000-4000-8000-000000000002';
const MEMBER_STAFF = 'fc600000-0000-4000-8000-000000000003';

// Test-specific CDT codes (D99xx) — not in the standard procedure-code seed,
// so assertions stay deterministic regardless of seed state.
const CDT_A = 'D9990';
const CDT_A_DESC = 'Fee-test comprehensive eval';
const CDT_A_DEFAULT = 100000; // ₱1000.00 default
const CDT_B = 'D9991';
const CDT_B_DESC = 'Fee-test periodic eval';
const CDT_B_DEFAULT = 50000;
const CDT_UNKNOWN = 'D0000-not-a-code';

function buildApp(user?: { id: string; email: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof ZodError) return c.json({ error: err.issues.map(i => i.message).join('; '), code: 'VALIDATION_ERROR' }, 400);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    if (user) ctx.set('user', user);
    await next();
  });
  app.get('/dental/fee-schedule', getFeeSchedule as any);
  app.patch('/dental/fee-schedule/:cdt', updateFeeScheduleEntry as any);
  return app;
}

async function seedBase() {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Fee Clinic', tier: 'solo',
    ownerPersonId: USER_OWNER.id, countryCode: 'PH',
    createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    settings: { currency: 'PHP' },
    createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values([
    { id: MEMBER_OWNER, branchId: BRANCH_ID, personId: USER_OWNER.id, displayName: 'Dr Owner', role: 'dentist_owner', status: 'active', createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id },
    { id: MEMBER_ASSOC, branchId: BRANCH_ID, personId: USER_ASSOC.id, displayName: 'Dr Assoc', role: 'dentist_associate', status: 'active', createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id },
    { id: MEMBER_STAFF, branchId: BRANCH_ID, personId: USER_STAFF.id, displayName: 'Front Desk', role: 'staff_full', status: 'active', createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id },
  ]).onConflictDoNothing();

  await db.insert(dentalProcedureCodes).values([
    { cdtCode: CDT_A, description: CDT_A_DESC, category: 'diagnostic', defaultFeePhp: CDT_A_DEFAULT, active: true, createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id },
    { cdtCode: CDT_B, description: CDT_B_DESC, category: 'diagnostic', defaultFeePhp: CDT_B_DEFAULT, active: true, createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id },
  ]).onConflictDoNothing();
}

async function resetBranchSettings() {
  await db.update(dentalBranches).set({ settings: { currency: 'PHP' } }).where(eq(dentalBranches.id, BRANCH_ID));
}

beforeAll(async () => {
  await seedBase();
});

afterAll(async () => {
  await db.delete(dentalProcedureCodes).where(eq(dentalProcedureCodes.cdtCode, CDT_A)).catch(() => {});
  await db.delete(dentalProcedureCodes).where(eq(dentalProcedureCodes.cdtCode, CDT_B)).catch(() => {});
  await db.execute(sql`DELETE FROM dental_membership WHERE branch_id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_branch WHERE id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_organization WHERE id = ${ORG_ID}`).catch(() => {});
});

// ---------------------------------------------------------------------------
// 1. Real-app route registration smoke (createApp) — catches unwired routes
// ---------------------------------------------------------------------------

describe('fee-schedule routes are registered in app.ts (real createApp)', () => {
  const realApp = createApp(parseConfig());

  test('GET /dental/fee-schedule is wired (401 not 404 without auth)', async () => {
    const res = await realApp.request('/dental/fee-schedule?branchId=' + BRANCH_ID);
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  test('PATCH /dental/fee-schedule/:cdt is wired (401 not 404 without auth)', async () => {
    const res = await realApp.request('/dental/fee-schedule/' + CDT_A, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, priceCents: 1000 }),
    });
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 2a. GET /dental/fee-schedule
// ---------------------------------------------------------------------------

describe('GET /dental/fee-schedule', () => {
  afterEach(resetBranchSettings);

  test('401 without auth', async () => {
    const res = await buildApp().request(`/dental/fee-schedule?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(401);
  });

  test('400 when branchId query param missing', async () => {
    const res = await buildApp(USER_OWNER).request('/dental/fee-schedule');
    expect(res.status).toBe(400);
  });

  test('403 for a user with no membership in the branch', async () => {
    const res = await buildApp(USER_NOMEM).request(`/dental/fee-schedule?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(403);
  });

  test('403 for staff_full (role not permitted to read fee schedule)', async () => {
    const res = await buildApp(USER_STAFF).request(`/dental/fee-schedule?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(403);
  });

  test('owner gets the active CDT catalog with default prices and branch currency', async () => {
    const res = await buildApp(USER_OWNER).request(`/dental/fee-schedule?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const entryA = body.data.find((e: any) => e.cdtCode === CDT_A);
    expect(entryA).toBeDefined();
    expect(entryA.description).toBe(CDT_A_DESC);
    expect(entryA.priceCents).toBe(CDT_A_DEFAULT); // no override → default
    expect(entryA.currency).toBe('PHP');
  });

  test('dentist_associate is allowed to read the fee schedule', async () => {
    const res = await buildApp(USER_ASSOC).request(`/dental/fee-schedule?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
  });

  test('branch price override is reflected over the default', async () => {
    await db.update(dentalBranches)
      .set({ settings: { currency: 'PHP', feeSchedule: { [CDT_A]: 12345 } } })
      .where(eq(dentalBranches.id, BRANCH_ID));
    const res = await buildApp(USER_OWNER).request(`/dental/fee-schedule?branchId=${BRANCH_ID}`);
    const body = await res.json() as any;
    const entryA = body.data.find((e: any) => e.cdtCode === CDT_A);
    expect(entryA.priceCents).toBe(12345); // override wins
    const entryB = body.data.find((e: any) => e.cdtCode === CDT_B);
    expect(entryB.priceCents).toBe(CDT_B_DEFAULT); // untouched → default
  });
});

// ---------------------------------------------------------------------------
// 2b. PATCH /dental/fee-schedule/:cdt
// ---------------------------------------------------------------------------

describe('PATCH /dental/fee-schedule/:cdt', () => {
  afterEach(resetBranchSettings);

  test('401 without auth', async () => {
    const res = await buildApp().request(`/dental/fee-schedule/${CDT_A}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, priceCents: 1000 }),
    });
    expect(res.status).toBe(401);
  });

  test('400 when priceCents is missing', async () => {
    const res = await buildApp(USER_OWNER).request(`/dental/fee-schedule/${CDT_A}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(400);
  });

  test('400 when priceCents is negative', async () => {
    const res = await buildApp(USER_OWNER).request(`/dental/fee-schedule/${CDT_A}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, priceCents: -1 }),
    });
    expect(res.status).toBe(400);
  });

  test('400 when priceCents exceeds max (999999)', async () => {
    const res = await buildApp(USER_OWNER).request(`/dental/fee-schedule/${CDT_A}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, priceCents: 1000000 }),
    });
    expect(res.status).toBe(400);
  });

  test('403 for staff_full (PATCH is dentist_owner only)', async () => {
    const res = await buildApp(USER_STAFF).request(`/dental/fee-schedule/${CDT_A}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, priceCents: 20000 }),
    });
    expect(res.status).toBe(403);
  });

  test('403 for dentist_associate (PATCH is dentist_owner only)', async () => {
    const res = await buildApp(USER_ASSOC).request(`/dental/fee-schedule/${CDT_A}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, priceCents: 20000 }),
    });
    expect(res.status).toBe(403);
  });

  test('422 INVALID_CDT_CODE for an unknown CDT code', async () => {
    const res = await buildApp(USER_OWNER).request(`/dental/fee-schedule/${CDT_UNKNOWN}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, priceCents: 20000 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_CDT_CODE');
  });

  test('owner sets a price; response echoes the updated entry and it persists', async () => {
    const res = await buildApp(USER_OWNER).request(`/dental/fee-schedule/${CDT_A}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, priceCents: 77777 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.cdtCode).toBe(CDT_A);
    expect(body.data.description).toBe(CDT_A_DESC);
    expect(body.data.priceCents).toBe(77777);
    expect(body.data.currency).toBe('PHP');

    // Persisted on branch settings
    const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, BRANCH_ID));
    expect((branch!.settings as any).feeSchedule[CDT_A]).toBe(77777);
  });

  test('patching a price preserves other branch settings keys', async () => {
    await db.update(dentalBranches)
      .set({ settings: { currency: 'PHP', clinicName: 'Keep Me', feeSchedule: { [CDT_B]: 9999 } } })
      .where(eq(dentalBranches.id, BRANCH_ID));
    await buildApp(USER_OWNER).request(`/dental/fee-schedule/${CDT_A}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, priceCents: 55555 }),
    });
    const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, BRANCH_ID));
    const settings = branch!.settings as any;
    expect(settings.clinicName).toBe('Keep Me');         // unrelated key preserved
    expect(settings.feeSchedule[CDT_B]).toBe(9999);        // existing override preserved
    expect(settings.feeSchedule[CDT_A]).toBe(55555);       // new override added
  });
});
