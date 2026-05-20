/**
 * uploadFile handler tests
 *
 * Tests file upload initiation, size validation, and auth.
 */

import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { uploadFile } from './uploadFile';
import { AppError } from '@/core/errors';

function buildTestApp(user?: { id: string; email: string }) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: err.message }, 500);
  });

  const mockStorage = {
    generateUploadUrl: mock(async (fileId: string, mimeType: string) => {
      return `https://storage.example.com/upload/${fileId}?mime=${mimeType}`;
    }),
  };

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', {});
    ctx.set('storage', mockStorage);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', { id: user.id, email: user.email, role: 'user' });
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/storage/files/upload', uploadFile as any);

  return { app, mockStorage };
}

describe('uploadFile handler', () => {
  const authedUser = { id: 'user-1', email: 'test@test.com' };

  test('returns error when file exceeds 100MB', async () => {
    const { app } = buildTestApp(authedUser);

    const res = await app.request('/storage/files/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'huge.zip',
        size: 110 * 1024 * 1024, // 110MB
        mimeType: 'application/zip',
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns error when user is not authenticated', async () => {
    const { app } = buildTestApp(undefined);

    const res = await app.request('/storage/files/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('accepts valid file under size limit', async () => {
    const { app } = buildTestApp(authedUser);

    const res = await app.request('/storage/files/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'doc.pdf',
        size: 1024 * 10, // 10KB
        mimeType: 'application/pdf',
      }),
    });

    // Will fail at repo level (mocked DB) but the size check should pass
    // If it gets past validation, it's either 201 or 500 (mock db error)
    expect(res.status).not.toBe(400);
  });

  test('50MB is within the 100MB limit', async () => {
    const { app } = buildTestApp(authedUser);

    const res = await app.request('/storage/files/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'exact-limit.bin',
        size: 50 * 1024 * 1024, // exactly 50MB
        mimeType: 'application/octet-stream',
      }),
    });

    // 50MB is not > 100MB, so it should pass validation
    expect(res.status).not.toBe(400);
  });

  test('100MB exactly is within limit', async () => {
    const { app } = buildTestApp(authedUser);

    const res = await app.request('/storage/files/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'big-scan.dcm',
        size: 100 * 1024 * 1024, // exactly 100MB
        mimeType: 'application/dicom',
      }),
    });

    // 100MB is not > 100MB, passes validation
    expect(res.status).not.toBe(400);
  });

  test('101MB is rejected', async () => {
    const { app } = buildTestApp(authedUser);

    const res = await app.request('/storage/files/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'oversized.dcm',
        size: 101 * 1024 * 1024, // 101MB
        mimeType: 'application/dicom',
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
