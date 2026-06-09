/**
 * dental-clinical-postop.test.ts — PostOp Instruction Templates (P2-008)
 *
 * pop01-AC-001  POST returns 201 with template object
 * pop01-AC-002  GET returns list containing created template
 * pop01-AC-003  GET with ?category filter returns only matching templates
 * pop01-AC-004  PATCH active→false deactivates template
 * pop01-AC-005  401 without auth
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  PostopBranchParams,
  PostopTemplateIdParams,
  CreatePostopTemplateBody,
  UpdatePostopTemplateBody,
} from './utils/postop-validators';
import { createPostopTemplate } from './postop/createPostopTemplate';
import { listPostopTemplates } from './postop/listPostopTemplates';
import { updatePostopTemplate } from './postop/updatePostopTemplate';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite tag: pop01 — unique IDs
const TEST_USER = { id: 'a0000000-0000-1000-8000-000000000003', email: 'pop@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000d3';
const ORG_ID    = 'c0000000-0000-1000-8000-0000000000d3';

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'PostOp Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a3000000-0000-1000-8000-0000000000d3',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'PostOp Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  const { dentalPostopTemplates } = await import('./repos/postop-template.schema');
  await db.delete(dentalPostopTemplates).where(eq(dentalPostopTemplates.branchId, BRANCH_ID));
});

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) ctx.set('user', user);
    await next();
  });

  app.post(
    '/dental/branches/:branchId/postop-templates',
    zValidator('param', PostopBranchParams, ve),
    zValidator('json', CreatePostopTemplateBody, ve),
    createPostopTemplate as any,
  );
  app.get(
    '/dental/branches/:branchId/postop-templates',
    zValidator('param', PostopBranchParams, ve),
    listPostopTemplates as any,
  );
  app.patch(
    '/dental/branches/:branchId/postop-templates/:templateId',
    zValidator('param', PostopTemplateIdParams, ve),
    zValidator('json', UpdatePostopTemplateBody, ve),
    updatePostopTemplate as any,
  );

  return app;
}

// =============================================================================
// pop01-AC-001: POST returns 201
// =============================================================================

describe('POST /dental/branches/:branchId/postop-templates (pop01-AC-001)', () => {
  test('pop01-AC-001: creates template and returns 201', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/branches/${BRANCH_ID}/postop-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'extraction',
        title: 'After Extraction Care',
        content: 'Bite on gauze for 30 minutes. Avoid rinsing for 24 hours.',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.branchId).toBe(BRANCH_ID);
    expect(body.category).toBe('extraction');
    expect(body.title).toBe('After Extraction Care');
    expect(body.active).toBe(true);
  });
});

// =============================================================================
// pop01-AC-002: GET returns list
// =============================================================================

describe('GET /dental/branches/:branchId/postop-templates (pop01-AC-002)', () => {
  test('pop01-AC-002: returns list containing created template', async () => {
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/branches/${BRANCH_ID}/postop-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'implant', title: 'Implant Care', content: 'Rest for 48 hours.' }),
    });

    const res = await app.request(`/dental/branches/${BRANCH_ID}/postop-templates`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // G10: { data, pagination } envelope (was a bare array).
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].branchId).toBe(BRANCH_ID);
    expect(body.pagination.totalCount).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// pop01-AC-003: GET with category filter
// =============================================================================

describe('GET with category filter (pop01-AC-003)', () => {
  test('pop01-AC-003: ?category filter returns only matching templates', async () => {
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/branches/${BRANCH_ID}/postop-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'extraction', title: 'Extraction Care', content: 'Rest.' }),
    });
    await app.request(`/dental/branches/${BRANCH_ID}/postop-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'crown', title: 'Crown Care', content: 'Avoid sticky foods.' }),
    });

    const res = await app.request(`/dental/branches/${BRANCH_ID}/postop-templates?category=extraction`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.every((t: any) => t.category === 'extraction')).toBe(true);
  });
});

// =============================================================================
// pop01-AC-004: PATCH active→false
// =============================================================================

describe('PATCH active→false (pop01-AC-004)', () => {
  test('pop01-AC-004: deactivates template', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/branches/${BRANCH_ID}/postop-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'filling', title: 'Filling Care', content: 'Avoid hard foods for 24h.' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/branches/${BRANCH_ID}/postop-templates/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.active).toBe(false);
  });
});

// =============================================================================
// pop01-AC-005: 401 without auth
// =============================================================================

describe('Auth (pop01-AC-005)', () => {
  test('POST returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/postop-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'extraction', title: 'T', content: 'C' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/postop-templates`);
    expect(res.status).toBe(401);
  });
});
