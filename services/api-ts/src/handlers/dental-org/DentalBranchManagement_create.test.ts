/**
 * DentalBranchManagement_create handler tests
 *
 * Path: POST /dental/organizations/:orgId/branches
 * Tests: 401 unauthenticated, 403 non-owner, 404 missing org, 201 success.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { DentalBranchManagement_create } from './DentalBranchManagement_create';
import {
  DentalBranchManagement_createParams,
  DentalBranchManagement_createBody,
} from '@/generated/openapi/validators';
import { OrganizationRepository } from './repos/organization.repo';
import { MembershipRepository } from './repos/membership.repo';
import { BranchRepository } from './repos/branch.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// UUID namespace: gg-prefix — no collision with other test files
const OWNER_ID  = 'gg000000-0000-1000-8000-000000000001';
const OTHER_ID  = 'gg000000-0000-1000-8000-000000000002';
const ORG_ID    = 'gg000000-0000-1000-8000-000000000010';

const ownerUser = { id: OWNER_ID, email: 'owner@clinic.com' };
const otherUser = { id: OTHER_ID, email: 'other@clinic.com' };

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed' }, 400);
};

function buildTestApp(user?: { id: string; email: string }) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post(
    '/dental/organizations/:orgId/branches',
    zValidator('param', DentalBranchManagement_createParams, validationErrorHandler),
    zValidator('json', DentalBranchManagement_createBody, validationErrorHandler),
    DentalBranchManagement_create as any,
  );

  return app;
}

async function seedOrg() {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({
    id: ORG_ID,
    name: 'Test Clinic',
    tier: 'clinic',
    ownerPersonId: OWNER_ID,
    countryCode: 'PH',
    active: true,
  });
}

describe('DentalBranchManagement_create handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    await seedOrg();
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Branch A', timezone: 'Asia/Manila' }),
    });

    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Authorization
  // --------------------------------------------------------------------------

  test('returns 403 when caller is not the org owner', async () => {
    await seedOrg();
    const app = buildTestApp(otherUser);

    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Branch A', timezone: 'Asia/Manila' }),
    });

    expect(res.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // Not found
  // --------------------------------------------------------------------------

  test('returns 404 when org does not exist', async () => {
    const app = buildTestApp(ownerUser);
    const nonexistentOrgId = 'gg000000-0000-1000-8000-000000000099';

    const res = await app.request(`/dental/organizations/${nonexistentOrgId}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Branch A', timezone: 'Asia/Manila' }),
    });

    expect(res.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------

  test('returns 400 when name is missing', async () => {
    await seedOrg();
    const app = buildTestApp(ownerUser);

    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: 'Asia/Manila' }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when timezone is missing', async () => {
    await seedOrg();
    const app = buildTestApp(ownerUser);

    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Branch A' }),
    });

    expect(res.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Success
  // --------------------------------------------------------------------------

  test('returns 201 with created branch on valid input', async () => {
    await seedOrg();
    const app = buildTestApp(ownerUser);

    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'North Branch', timezone: 'Asia/Manila', city: 'Manila' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.name).toBe('North Branch');
    expect(body.timezone).toBe('Asia/Manila');
    expect(body.city).toBe('Manila');
    expect(body.organizationId).toBe(ORG_ID);
    expect(body.active).toBe(true);
  });

  test('branch is isolated to its org — listByOrg returns only this org branches', async () => {
    await seedOrg();
    // Seed a second org
    const orgRepo = new OrganizationRepository(db);
    const OTHER_ORG_ID = 'gg000000-0000-1000-8000-000000000011';
    await orgRepo.createOne({
      id: OTHER_ORG_ID,
      name: 'Other Clinic',
      tier: 'solo',
      ownerPersonId: OWNER_ID,
      countryCode: 'PH',
      active: true,
    });

    const app = buildTestApp(ownerUser);

    // Create branch in first org
    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Org1 Branch', timezone: 'Asia/Manila' }),
    });
    expect(res.status).toBe(201);

    // Verify branch repo isolation
    const branchRepo = new BranchRepository(db);
    const org1Branches = await branchRepo.listByOrg(ORG_ID);
    const org2Branches = await branchRepo.listByOrg(OTHER_ORG_ID);
    expect(org1Branches).toHaveLength(1);
    expect(org2Branches).toHaveLength(0);
  });
});
