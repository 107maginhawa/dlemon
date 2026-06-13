/**
 * Provisional-org PHI write gate (decision C-1 / ADR-007 fast-follow).
 *
 * Self-service onboarding sets dental_organization.status = 'provisional'. Until
 * the owner activates the clinic (accepts terms/BAA → status 'live'), PHI writes
 * must be blocked IN PRODUCTION. The gate is production-only by design — it mirrors
 * createOnboarding's sibling guardrails (verified-email, rate-limit) which are also
 * production-only so local/CI signups keep working (ADR-007: "Relaxed in dev/test").
 *
 * These tests run the REAL gate by toggling NODE_ENV, so the enforcement path is
 * exercised (not fake-green): provisional → 403 ORG_NOT_LIVE under production;
 * 201 once activated; and relaxed (201) outside production.
 */
import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateDentalPatientBody, CreateDentalVisitBody } from '@/generated/openapi/validators';
import { createDentalPatient } from './identity/createDentalPatient';
import { createDentalVisit } from '@/handlers/dental-visit/visits/createDentalVisit';
import { AppError, UnauthorizedError, ValidationError } from '@/core/errors';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const owner = { id: '00000000-0000-0000-0000-0000000000c1', email: 'owner@provgate.com' };
const ORG_ID = 'dc100000-0000-1000-8000-0000000000c1';
const BRANCH_ID = 'bc100000-0000-1000-8000-0000000000c1';

async function setOrgStatus(status: 'provisional' | 'live') {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  await db.update(dentalOrganizations).set({ status }).where(eq(dentalOrganizations.id, ORG_ID));
}

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Provisional Gate Clinic', tier: 'clinic', ownerPersonId: owner.id, countryCode: 'PH', status: 'provisional', createdBy: owner.id, updatedBy: owner.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: owner.id, updatedBy: owner.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: 'ec100000-0000-1000-8000-0000000000c1', branchId: BRANCH_ID, personId: owner.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: owner.id, updatedBy: owner.id }).onConflictDoNothing();
});

function buildTestApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof UnauthorizedError) return c.json({ error: err.message }, 401);
    if (err instanceof ValidationError) return c.json({ error: err.message }, 400);
    return c.json({ error: String(err) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', owner);
    await next();
  });
  const ve = (result: any, c: any) => {
    if (!result.success) return c.json({ error: result.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400);
  };
  app.post('/dental/patients', zValidator('json', CreateDentalPatientBody, ve), createDentalPatient as any);
  app.post('/dental/visits', zValidator('json', CreateDentalVisitBody, ve), createDentalVisit as any);
  return app;
}

function registerPatient() {
  return buildTestApp().request('/dental/patients', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'Gate Tester', consentGiven: true, branchId: BRANCH_ID }),
  });
}

describe('provisional-org PHI gate — createDentalPatient', () => {
  const realEnv = process.env['NODE_ENV'];
  afterEach(async () => {
    process.env['NODE_ENV'] = realEnv;
    await setOrgStatus('provisional');
    await db.execute(sql`TRUNCATE TABLE patient, person CASCADE`);
  });

  test('PRODUCTION + provisional org → 403 ORG_NOT_LIVE', async () => {
    process.env['NODE_ENV'] = 'production';
    await setOrgStatus('provisional');
    const res = await registerPatient();
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('ORG_NOT_LIVE');
  });

  test('PRODUCTION + activated (live) org → 201', async () => {
    process.env['NODE_ENV'] = 'production';
    await setOrgStatus('live');
    const res = await registerPatient();
    expect(res.status).toBe(201);
  });

  test('non-production + provisional org → 201 (gate relaxed, mirrors onboarding guards)', async () => {
    process.env['NODE_ENV'] = 'test';
    await setOrgStatus('provisional');
    const res = await registerPatient();
    expect(res.status).toBe(201);
  });
});

describe('provisional-org PHI gate — createDentalVisit', () => {
  const realEnv = process.env['NODE_ENV'];
  afterEach(async () => {
    process.env['NODE_ENV'] = realEnv;
    await setOrgStatus('provisional');
  });

  test('PRODUCTION + provisional org → 403 ORG_NOT_LIVE (gate fires before visit logic)', async () => {
    process.env['NODE_ENV'] = 'production';
    await setOrgStatus('provisional');
    const res = await buildTestApp().request('/dental/visits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: '11111111-0000-1000-8000-0000000000c1', branchId: BRANCH_ID, dentistMemberId: 'ec100000-0000-1000-8000-0000000000c1', visitType: 'general' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('ORG_NOT_LIVE');
  });
});
