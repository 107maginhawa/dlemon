/**
 * authMiddleware unit tests
 *
 * Tests authentication gating, role-based access, and owner pattern routing.
 * Better-Auth session resolution is mocked.
 */

import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { authMiddleware } from './auth';
import { AppError } from '@/core/errors';

// Mock auth instance
function mockAuth(sessionUser?: { id: string; role?: string }) {
  return {
    api: {
      getSession: mock(async () => {
        if (!sessionUser) return null;
        return {
          user: { id: sessionUser.id, role: sessionUser.role || 'user', email: 'test@test.com', name: 'Test' },
          session: { id: 'session-1', userId: sessionUser.id },
        };
      }),
    },
  };
}

function buildApp(
  sessionUser?: { id: string; role?: string },
  middlewareOpts?: Parameters<typeof authMiddleware>[0]
) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: err.message }, 500);
  });

  const auth = mockAuth(sessionUser);

  app.use('*', async (c, next) => {
    (c as any).set('auth', auth);
    (c as any).set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    (c as any).set('internalServiceToken', 'secret-token');
    await next();
  });

  app.use('/protected/*', authMiddleware(middlewareOpts));
  app.get('/protected/resource', (c) => c.json({ ok: true }));

  return app;
}

describe('authMiddleware', () => {
  // --------------------------------------------------------------------------
  // Required auth (default)
  // --------------------------------------------------------------------------

  test('returns 401 when no session and auth required', async () => {
    const app = buildApp(undefined); // no session
    const res = await app.request('/protected/resource');
    expect(res.status).toBe(401);
  });

  test('returns 200 when session exists and auth required', async () => {
    const app = buildApp({ id: 'user-1' });
    const res = await app.request('/protected/resource');
    expect(res.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // Optional auth
  // --------------------------------------------------------------------------

  test('returns 200 when no session and auth not required', async () => {
    const app = buildApp(undefined, { required: false });
    const res = await app.request('/protected/resource');
    expect(res.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // Role-based access
  // --------------------------------------------------------------------------

  test('returns 200 when user has required role', async () => {
    const app = buildApp({ id: 'user-1', role: 'admin' }, { roles: ['admin'] });
    const res = await app.request('/protected/resource');
    expect(res.status).toBe(200);
  });

  test('returns 403 when user lacks required role', async () => {
    const app = buildApp({ id: 'user-1', role: 'user' }, { roles: ['admin'] });
    const res = await app.request('/protected/resource');
    expect(res.status).toBe(403);
  });

  test('OR logic: user with any matching role is allowed', async () => {
    const app = buildApp({ id: 'user-1', role: 'host' }, { roles: ['client', 'host', 'admin'] });
    const res = await app.request('/protected/resource');
    expect(res.status).toBe(200);
  });

  test('comma-separated roles in user.role are checked', async () => {
    const app = buildApp({ id: 'user-1', role: 'user,admin' }, { roles: ['admin'] });
    const res = await app.request('/protected/resource');
    expect(res.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // Owner pattern
  // --------------------------------------------------------------------------

  test('owner pattern allows access and delegates to handler', async () => {
    const app = buildApp({ id: 'user-1', role: 'client' }, { roles: ['client:owner'] });
    const res = await app.request('/protected/resource');
    expect(res.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // Internal service bypass
  // --------------------------------------------------------------------------

  test('internal service token bypasses auth', async () => {
    const app = new Hono();
    const auth = mockAuth(undefined);

    app.use('*', async (c, next) => {
      (c as any).set('auth', auth);
      (c as any).set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
      (c as any).set('internalServiceToken', 'secret-token');
      await next();
    });

    app.use('/protected/*', authMiddleware());
    app.get('/protected/resource', (c) => c.json({ ok: true }));

    const res = await app.request('/protected/resource', {
      headers: {
        'X-Internal-Service-Token': 'secret-token',
        'X-Expand-Context': 'true',
      },
    });
    expect(res.status).toBe(200);
  });
});
