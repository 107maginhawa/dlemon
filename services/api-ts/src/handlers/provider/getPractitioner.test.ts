/**
 * getPractitioner handler unit tests
 *
 * Tests the getPractitioner handler in isolation with mocked repository.
 */

import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { getPractitioner } from './getPractitioner';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePractitioner(overrides: Record<string, any> = {}) {
  return {
    id: 'pr-00000000-0000-0000-0000-000000000001',
    providerId: 'pv-00000000-0000-0000-0000-000000000001',
    active: true,
    name: [{ family: 'Smith', given: ['Jane'] }],
    telecom: null,
    address: null,
    gender: null,
    birthDate: null,
    photo: null,
    qualification: [],
    credential: [],
    specialties: [],
    languages: null,
    deactivatedAt: null,
    tenantId: 'default',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function buildApp(options: {
  session?: object | null;
  practitioner?: object | null;
}) {
  const app = new Hono();

  app.use('/practitioners/:id', async (c, next) => {
    // Inject mock session
    if (options.session !== undefined) {
      (c as any).set('session', options.session);
    }

    // Inject mock database that returns the practitioner
    const mockDb = {
      select: mock(() => {
        const p = options.practitioner;
        const limit = mock(() => Promise.resolve(p ? [p] : []));
        const where = mock(() => ({ limit }));
        const from = mock(() => ({ where }));
        return { from };
      }),
      insert: mock(() => ({})),
      update: mock(() => ({})),
    };
    (c as any).set('database', mockDb);
    (c as any).set('logger', null);

    // Mock valid() for param
    const originalValid = c.req.valid.bind(c.req);
    (c.req as any).valid = (target: string) => {
      if (target === 'param') return { id: c.req.param('id') };
      return originalValid(target as any);
    };

    await next();
  });

  app.get('/practitioners/:id', (c) => getPractitioner(c as any));

  // Global error handler
  app.onError((err, c) => {
    if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
    if (err instanceof UnauthorizedError) return c.json({ error: err.message }, 401);
    return c.json({ error: 'Internal Server Error' }, 500);
  });

  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getPractitioner', () => {
  test('returns 200 with practitioner when found', async () => {
    const practitioner = makePractitioner();
    const app = buildApp({ session: { user: { id: 'user-1' } }, practitioner });

    const res = await app.request('/practitioners/pr-00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe(practitioner.id);
  });

  test('returns 401 when no session', async () => {
    const app = buildApp({ session: null, practitioner: makePractitioner() });

    const res = await app.request('/practitioners/pr-00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
  });

  test('returns 404 when practitioner not found', async () => {
    const app = buildApp({ session: { user: { id: 'user-1' } }, practitioner: null });

    const res = await app.request('/practitioners/non-existent-id');
    expect(res.status).toBe(404);
  });
});
