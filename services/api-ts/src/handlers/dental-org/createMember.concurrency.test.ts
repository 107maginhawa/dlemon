/**
 * createMember.concurrency.test.ts — concurrent creates overshoot the tier limit.
 *
 * createMember reads countActiveStaffByBranch then createOne. Under READ COMMITTED two
 * concurrent creates at activeCount = limit-1 both pass the `>= limit` check (neither sees
 * the other's uncommitted insert) and both insert — exceeding the FR6.3 tier cap. PIN-only
 * staff have personId=null, so the (personId,branchId) partial unique can't bound the count,
 * and a count has no row to lock.
 *
 * Fix: serialize creation per branch with pg_advisory_xact_lock(3001, hashtext(branchId))
 * inside a tx and re-count under it; the loser sees the winner's committed member and is
 * rejected TIER_LIMIT_REACHED.
 *
 * RED-proof: without the lock+re-count a race leaves 3 active staff on a solo (limit 2) org,
 * both 201. GREEN: exactly 2, one 201 + one 409.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { createMember } from './createMember';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 115.
const USER = { id: '00000000-0000-4000-8000-000000115001', email: 'owner@memberrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000115001';
const BRANCH = 'ba000000-0000-4000-8000-000000115001';
const OWNER_MEMBER = 'ca000000-0000-4000-8000-000000115001';
const STAFF_MEMBER = 'ca000000-0000-4000-8000-000000115002';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization, person CASCADE`);
});

async function seedSoloOrgAtLimitMinusOne() {
  // solo tier → limit 2 active staff (owner not counted). Seed owner + 1 staff = count 1.
  await db.insert(persons).values({ id: USER.id, firstName: 'Owner', lastName: 'MemberRace', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'MemberRace', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id });
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id });
  await db.insert(dentalMemberships).values({ id: OWNER_MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id });
  await db.insert(dentalMemberships).values({ id: STAFF_MEMBER, branchId: BRANCH, personId: null, displayName: 'Staff One', role: 'staff_full', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id });
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
    ctx.set('session', { id: 'sess', userId: USER.id });
    await next();
  });
  app.post('/dental/org/members', createMember as any);
  return app;
}

function addStaff(name: string) {
  return buildApp().request(`/dental/org/members?branchId=${BRANCH}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: name, role: 'staff_full' }),
  });
}

async function activeStaffCount(): Promise<number> {
  const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM dental_membership WHERE branch_id = ${BRANCH} AND status='active' AND role <> 'dentist_owner'`);
  return Number(((r as any).rows?.[0] ?? (r as any)[0]).n);
}

describe('createMember — concurrent creates cannot overshoot the tier limit', () => {
  test('two simultaneous creates at limit-1 → exactly one 201, one 409, count stays at the limit', async () => {
    const ROUNDS = 6;
    for (let i = 0; i < ROUNDS; i++) {
      await seedSoloOrgAtLimitMinusOne(); // count = 1, solo limit = 2

      const [a, b] = await Promise.all([addStaff(`Race A ${i}`), addStaff(`Race B ${i}`)]);
      const statuses = [a.status, b.status];

      const count = await activeStaffCount();
      // FR6.3 invariant: never exceed the tier cap.
      expect(count, `round ${i}: active staff must not exceed the solo limit of 2 (count=${count} statuses=${statuses})`).toBe(2);

      const winners = [a, b].filter((r) => r.status === 201);
      expect(winners.length, `round ${i}: exactly one create may succeed (statuses ${statuses})`).toBe(1);
      const loser = [a, b].find((r) => r.status !== 201)!;
      expect(loser.status, `round ${i}: the loser must be 409`).toBe(409);
      const loserBody = (await loser.json()) as { code?: string };
      expect(loserBody.code, `round ${i}: loser must be TIER_LIMIT_REACHED`).toBe('TIER_LIMIT_REACHED');

      await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization, person CASCADE`);
    }
  });
});
