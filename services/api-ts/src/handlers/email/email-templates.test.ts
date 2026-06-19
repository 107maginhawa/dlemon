/**
 * email-templates handler tests — createEmailTemplate, getEmailTemplate,
 * updateEmailTemplate, listEmailTemplates, testEmailTemplate
 *
 * Fixture tag: em01
 * All deterministic UUIDs use namespace em01.
 *
 * RED-for-right-reason: each happy-path test was run against the seeded
 * DB BEFORE the seed helper existed to confirm it returned 404/500/etc,
 * then the seed was added to make it GREEN.
 *
 * Pattern: buildTestApp (handler-unit, NOT real router)
 *
 * Note: zValidator middleware returns 400 for Zod schema violations (missing/invalid fields);
 * BusinessLogicError from handler logic returns 422. Tests assert actual server behavior.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateEmailTemplateBody,
  UpdateEmailTemplateBody,
  UpdateEmailTemplateParams,
  GetEmailTemplateParams,
  TestEmailTemplateBody,
  TestEmailTemplateParams,
  ListEmailTemplatesQuery,
} from '@/generated/openapi/validators';
import { emailTemplates } from './repos/email.schema';
import { createEmailTemplate } from './createEmailTemplate';
import { getEmailTemplate } from './getEmailTemplate';
import { updateEmailTemplate } from './updateEmailTemplate';
import { listEmailTemplates } from './listEmailTemplates';
import { testEmailTemplate } from './testEmailTemplate';

// ---------------------------------------------------------------------------
// DB + fixtures
// ---------------------------------------------------------------------------

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Fixture tag: em01 — all IDs are valid UUIDs (hex only)
const ADMIN_USER = {
  id: 'ae010000-0000-4000-8000-000000000001',
  email: 'admin-em01@test.com',
  role: 'admin',
};
const NON_ADMIN_USER = {
  id: 'ae010000-0000-4000-8000-000000000002',
  email: 'user-em01@test.com',
  role: 'user',
};

const TEMPLATE_ID_1 = 'be010000-0000-4000-8000-000000000001';
const TEMPLATE_ID_2 = 'be010000-0000-4000-8000-000000000002';
const FIXED_TS = new Date('2026-01-15T12:00:00Z');

// ---------------------------------------------------------------------------
// buildTestApp
// ---------------------------------------------------------------------------

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

function buildTestApp(user?: typeof ADMIN_USER) {
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
      ctx.set('session', { id: 'test-session-em01' });
    }
    await next();
  });

  // Template routes — param/query validators required so ctx.req.valid('param'/'query') works
  app.post('/email/templates', zValidator('json', CreateEmailTemplateBody, ve), createEmailTemplate as any);
  app.get('/email/templates', zValidator('query', ListEmailTemplatesQuery, ve), listEmailTemplates as any);
  app.get('/email/templates/:template', zValidator('param', GetEmailTemplateParams, ve), getEmailTemplate as any);
  app.patch('/email/templates/:template', zValidator('param', UpdateEmailTemplateParams, ve), zValidator('json', UpdateEmailTemplateBody, ve), updateEmailTemplate as any);
  app.post('/email/templates/:template/test', zValidator('param', TestEmailTemplateParams, ve), zValidator('json', TestEmailTemplateBody, ve), testEmailTemplate as any);

  return app;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedTemplate(overrides: Partial<typeof emailTemplates.$inferInsert> = {}) {
  const [tpl] = await db.insert(emailTemplates).values({
    id: TEMPLATE_ID_1,
    name: 'em01 Welcome Template',
    subject: 'Welcome to em01',
    bodyHtml: '<p>Hello {{name}}</p>',
    bodyText: 'Hello {{name}}',
    variables: [],
    status: 'active',
    createdBy: ADMIN_USER.id,
    updatedBy: ADMIN_USER.id,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
    ...overrides,
  }).onConflictDoNothing().returning();

  // Post-seed read-back assert to defeat .onConflictDoNothing() masking
  const [readback] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, overrides.id ?? TEMPLATE_ID_1));
  expect(readback!.name).toBe(overrides.name ?? 'em01 Welcome Template');
  return tpl ?? readback!;
}

async function truncateTemplates() {
  await db.delete(emailTemplates).where(eq(emailTemplates.id, TEMPLATE_ID_1));
  await db.delete(emailTemplates).where(eq(emailTemplates.id, TEMPLATE_ID_2));
}

// ---------------------------------------------------------------------------
// createEmailTemplate
// ---------------------------------------------------------------------------

describe('createEmailTemplate', () => {
  afterEach(truncateTemplates);

  test('non-admin → 403 FORBIDDEN', async () => {
    // RED verified: without admin role, handler throws ForbiddenError
    const app = buildTestApp(NON_ADMIN_USER);
    const res = await app.request('/email/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x', subject: 'x', bodyHtml: '<p>x</p>', variables: [] }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('no user → 403 (no roles, denied gracefully — no crash)', async () => {
    // No user in context → parseUserRoles yields no roles → the role gate denies
    // with 403 (previously this crashed with a 500 on user.role.split of undefined).
    const app = buildTestApp(undefined);
    const res = await app.request('/email/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x', subject: 'x', bodyHtml: '<p>x</p>', variables: [] }),
    });
    expect(res.status).toBe(403);
  });

  test('missing name → 400 (zValidator catches required field)', async () => {
    // CreateTemplateRequestSchema requires name — zValidator returns 400 before handler runs
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Welcome', bodyHtml: '<p>Hi</p>', variables: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(typeof body.error).toBe('string');
  });

  test('missing subject → 400 (zValidator catches required field)', async () => {
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', bodyHtml: '<p>Hi</p>', variables: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(typeof body.error).toBe('string');
  });

  test('missing bodyHtml → 400 (zValidator catches required field)', async () => {
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', subject: 'Hello', variables: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(typeof body.error).toBe('string');
  });

  test('happy path → 201 with template returned', async () => {
    // RED verified: before this test existed, POST returned 500 (no db seed needed for create)
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'em01 Welcome Template',
        subject: 'Welcome to em01',
        bodyHtml: '<p>Hello {{name}}</p>',
        bodyText: 'Hello {{name}}',
        variables: [],
        status: 'draft',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.name).toBe('em01 Welcome Template');
    expect(body.subject).toBe('Welcome to em01');
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    expect(body.status).toBe('draft');
  });
});

// ---------------------------------------------------------------------------
// getEmailTemplate
// ---------------------------------------------------------------------------

describe('getEmailTemplate', () => {
  afterEach(truncateTemplates);

  test('non-admin → 403 FORBIDDEN', async () => {
    const app = buildTestApp(NON_ADMIN_USER);
    const res = await app.request(`/email/templates/${TEMPLATE_ID_1}`);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('not found → 404 NOT_FOUND', async () => {
    // RED verified: no seed → repo.findOneById returns null → throws NotFoundError
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/templates/00000000-0000-4000-8000-000099990001');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('happy path → 200 with template', async () => {
    await seedTemplate();
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/templates/${TEMPLATE_ID_1}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(TEMPLATE_ID_1);
    expect(body.name).toBe('em01 Welcome Template');
  });
});

// ---------------------------------------------------------------------------
// updateEmailTemplate
// ---------------------------------------------------------------------------

describe('updateEmailTemplate', () => {
  afterEach(truncateTemplates);

  test('non-admin → 403 FORBIDDEN', async () => {
    const app = buildTestApp(NON_ADMIN_USER);
    const res = await app.request(`/email/templates/${TEMPLATE_ID_1}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('not found → 404 NOT_FOUND', async () => {
    // RED verified: no seed → findOneById null → NotFoundError
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/templates/00000000-0000-4000-8000-000099980001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('happy path → 200 with updated template', async () => {
    await seedTemplate();
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/templates/${TEMPLATE_ID_1}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'em01 Updated Template' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(TEMPLATE_ID_1);
    expect(body.name).toBe('em01 Updated Template');
  });
});

// ---------------------------------------------------------------------------
// listEmailTemplates
// ---------------------------------------------------------------------------

describe('listEmailTemplates', () => {
  afterEach(truncateTemplates);

  test('non-admin → 403 FORBIDDEN', async () => {
    const app = buildTestApp(NON_ADMIN_USER);
    const res = await app.request('/email/templates');
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('happy path empty → 200 with items array', async () => {
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/templates');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('happy path with seeded template → 200 contains template', async () => {
    // RED verified: before seed, items returned empty array not containing our template
    await seedTemplate();
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/templates');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((t: any) => t.id === TEMPLATE_ID_1);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(TEMPLATE_ID_1);
    expect(found.name).toBe('em01 Welcome Template');
  });

  test('status filter → 200 filters by status', async () => {
    await seedTemplate({ id: TEMPLATE_ID_1, name: 'em01 Welcome Template', status: 'active' });
    await seedTemplate({ id: TEMPLATE_ID_2, name: 'em01 Draft Template', status: 'draft' });

    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/templates?status=draft');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.data.map((t: any) => t.id);
    expect(ids).not.toContain(TEMPLATE_ID_1); // active, should be excluded
    expect(ids).toContain(TEMPLATE_ID_2);      // draft, should be included
  });
});

// ---------------------------------------------------------------------------
// testEmailTemplate
// ---------------------------------------------------------------------------

describe('testEmailTemplate', () => {
  afterEach(async () => {
    // Also clean up queue items that may have been created by happy-path test
    const { emailQueue } = await import('./repos/email.schema');
    await db.delete(emailQueue).where(eq(emailQueue.template, TEMPLATE_ID_1));
    await truncateTemplates();
  });

  test('non-admin → 403 FORBIDDEN', async () => {
    const app = buildTestApp(NON_ADMIN_USER);
    const res = await app.request(`/email/templates/${TEMPLATE_ID_1}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail: 'test@example.com' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('missing recipientEmail → 400 (zValidator rejects before handler)', async () => {
    // zValidator catches missing required field; returns 400 without code field
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/templates/${TEMPLATE_ID_1}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(typeof body.error).toBe('string');
  });

  test('bad email format → 400 (zValidator rejects invalid email)', async () => {
    // TestTemplateRequestSchema requires z.string().email() — zValidator catches format error
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/templates/${TEMPLATE_ID_1}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(typeof body.error).toBe('string');
  });

  test('template not found → 404 NOT_FOUND', async () => {
    // RED verified: no seed → templateRepo.findActiveById null → NotFoundError
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request('/email/templates/00000000-0000-4000-8000-000099970001/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail: 'test@example.com' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('template not active → 404 NOT_FOUND', async () => {
    // testEmailTemplate requires active status — draft template should 404
    await seedTemplate({ id: TEMPLATE_ID_1, name: 'em01 Welcome Template', status: 'draft' });
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/templates/${TEMPLATE_ID_1}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail: 'test@example.com' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('happy path → 200 with queue item (SMTP delivery mocked via test db)', async () => {
    // RED verified: before seed, returned 404 for template not found
    await seedTemplate({ id: TEMPLATE_ID_1, name: 'em01 Welcome Template', status: 'active' });
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/email/templates/${TEMPLATE_ID_1}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail: 'test@example.com', recipientName: 'Test User' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.queue).not.toBeNull();
    expect(body.queue.recipientEmail).toBe('test@example.com');
    expect(body.queue.template).toBe(TEMPLATE_ID_1);
  });
});
