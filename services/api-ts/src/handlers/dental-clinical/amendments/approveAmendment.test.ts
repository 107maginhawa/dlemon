/**
 * V-CLI-001 / TR-P1-05 / BR-019: approveAmendment endpoint is contract-present
 * but deferred. Per MODULE_SPEC §5/§13/§15 + §15 error table, the supervisor
 * approval endpoint must EXIST and return 501 NOT_IMPLEMENTED until the
 * dental_clinical_amendment_approval feature flag is lifted (spec §18).
 *
 * Tests:
 *   (a) authenticated request → 501 NOT_IMPLEMENTED
 *   (b) unauthenticated request → 401
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { ApproveAmendmentParams } from '@/generated/openapi/validators';
import { approveAmendment } from './approveAmendment';

const VISIT_ID     = '11111111-1111-4000-8000-000000000001';
const AMENDMENT_ID = '22222222-2222-4000-8000-000000000002';

const ve = (result: any, c: any) => {
  if (!result.success)
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

function buildTestApp(authed: boolean) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (authed) {
      ctx.set('user', { id: '00000000-0000-0000-0000-000000000001', email: 'sup@clinic.com' });
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });
  app.post(
    '/dental/visits/:visitId/amendments/:amendmentId/approve',
    zValidator('param', ApproveAmendmentParams, ve),
    approveAmendment as any,
  );
  return app;
}

describe('V-CLI-001 / BR-019: approveAmendment deferred endpoint', () => {
  test('501 NOT_IMPLEMENTED — supervisor approval is deferred', async () => {
    const app = buildTestApp(true);
    const res = await app.request(
      `/dental/visits/${VISIT_ID}/amendments/${AMENDMENT_ID}/approve`,
      { method: 'POST' },
    );
    expect(res.status).toBe(501);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_IMPLEMENTED');
  });

  test('401 — unauthenticated request is rejected', async () => {
    const app = buildTestApp(false);
    const res = await app.request(
      `/dental/visits/${VISIT_ID}/amendments/${AMENDMENT_ID}/approve`,
      { method: 'POST' },
    );
    expect(res.status).toBe(401);
  });
});
