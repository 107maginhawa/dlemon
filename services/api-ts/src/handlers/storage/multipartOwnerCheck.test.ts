/**
 * Multipart upload owner-check tests
 *
 * Verifies that abortMultipartUpload and completeMultipartUpload
 * reject requests from users who don't own the file (P1 security fix).
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';

const OWNER_USER = { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'owner@clinic.com' };
const OTHER_USER = { id: 'bbbbbbbb-0000-0000-0000-000000000002', email: 'other@clinic.com' };
const FILE_ID = 'cccccccc-0000-0000-0000-000000000003';

const MOCK_FILE = {
  id: FILE_ID,
  filename: 'scan.dcm',
  mimeType: 'image/jpeg',
  size: 1024,
  status: 'uploading',
  owner: OWNER_USER.id,
  multipartUploadId: 'mp-upload-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** DB mock that returns MOCK_FILE from select queries */
function makeDb() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([MOCK_FILE]),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...MOCK_FILE, status: 'available' }]),
          then: (resolve: any, reject: any) => Promise.resolve().then(resolve, reject),
        }),
      }),
    }),
  };
}

function buildApp(
  handler: (ctx: any) => Promise<Response>,
  { user, method, path }: { user: typeof OWNER_USER; method: string; path: string },
) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: err.message }, 500);
  });

  app.use('*', async (c, next) => {
    c.set('database' as any, makeDb());
    c.set('storage' as any, {
      abortMultipartUpload: async () => {},
      completeMultipartUpload: async () => {},
    });
    c.set('logger' as any, { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    c.set('user' as any, user);
    c.set('session' as any, { id: 'test-session' });

    // Pre-parse JSON body so req.valid('json') returns it synchronously
    let jsonBody: any = undefined;
    try {
      jsonBody = await c.req.json();
    } catch (_e) { /* no body */ }

    // Patch req.valid() to return route params/body from Hono's native extraction
    const origValid = c.req.valid.bind(c.req);
    (c.req as any).valid = (target: 'param' | 'json' | 'query' | 'form' | 'header' | 'cookie') => {
      if (target === 'param') return c.req.param();
      if (target === 'json') return jsonBody;
      return origValid(target);
    };

    await next();
  });

  (app as any)[method.toLowerCase()](path, handler);
  return app;
}

// ---------------------------------------------------------------------------
// abortMultipartUpload owner check
// ---------------------------------------------------------------------------

describe('abortMultipartUpload owner check', () => {
  test('owner can abort → 204', async () => {
    const { abortMultipartUpload } = await import('./abortMultipartUpload');
    const app = buildApp(abortMultipartUpload as any, {
      user: OWNER_USER,
      method: 'DELETE',
      path: '/storage/multipart/:file/abort',
    });

    const res = await app.request(`/storage/multipart/${FILE_ID}/abort`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('non-owner gets 403', async () => {
    const { abortMultipartUpload } = await import('./abortMultipartUpload');
    const app = buildApp(abortMultipartUpload as any, {
      user: OTHER_USER,
      method: 'DELETE',
      path: '/storage/multipart/:file/abort',
    });

    const res = await app.request(`/storage/multipart/${FILE_ID}/abort`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// completeMultipartUpload owner check
// ---------------------------------------------------------------------------

describe('completeMultipartUpload owner check', () => {
  test('owner can complete → 200', async () => {
    const { completeMultipartUpload } = await import('./completeMultipartUpload');
    const app = buildApp(completeMultipartUpload as any, {
      user: OWNER_USER,
      method: 'POST',
      path: '/storage/multipart/:file/complete',
    });

    const res = await app.request(`/storage/multipart/${FILE_ID}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ partNumber: 1, etag: '"abc123"' }] }),
    });
    expect(res.status).toBe(200);
  });

  test('non-owner gets 403', async () => {
    const { completeMultipartUpload } = await import('./completeMultipartUpload');
    const app = buildApp(completeMultipartUpload as any, {
      user: OTHER_USER,
      method: 'POST',
      path: '/storage/multipart/:file/complete',
    });

    const res = await app.request(`/storage/multipart/${FILE_ID}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ partNumber: 1, etag: '"abc123"' }] }),
    });
    expect(res.status).toBe(403);
  });
});
