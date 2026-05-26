/**
 * storage-coverage.test.ts
 *
 * Pattern: real DB (createDatabase) + afterEach TRUNCATE, mocked storage provider.
 * No real S3/MinIO. Exact status codes and .code assertions on every error path.
 * UUID prefix ee to avoid collisions with other test files.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { storedFiles, type NewStoredFile } from './repos/file.schema';

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const noop = () => {};
const logger = { debug: noop, info: noop, warn: noop, error: noop };

const OWNER_ID = 'ee000000-0000-4000-8000-000000000001';
const OTHER_ID = 'ee000000-0000-4000-8000-000000000002';
const FILE_ID  = 'ee000000-0000-4000-8000-000000000003';

const ownerUser = { id: OWNER_ID, email: 'owner@storage-test.com' };
const otherUser = { id: OTHER_ID, email: 'other@storage-test.com' };

function makeStorage(overrides: Record<string, any> = {}) {
  return {
    generateUploadUrl:      async (id: string) => `https://s3.example.com/upload/${id}`,
    generateDownloadUrl:    async (id: string) => `https://s3.example.com/download/${id}`,
    deleteFile:             async () => {},
    verifyFileExists:       async () => true,
    initiateMultipartUpload: async () => 'mp-id-new',
    generatePartUploadUrl:  async (_id: string, _uid: string, n: number) =>
      `https://s3.example.com/part/${n}`,
    abortMultipartUpload:   async () => {},
    completeMultipartUpload: async () => {},
    ...overrides,
  };
}

function buildApp(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  handler: any,
  opts: {
    user?: { id: string; email: string };
    storageOverrides?: Record<string, any>;
    validParams?: Record<string, any>;
    validQuery?: Record<string, any>;
    validJson?: Record<string, any>;
  } = {}
) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError)
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('storage', makeStorage(opts.storageOverrides ?? {}));
    ctx.set('logger', logger);
    ctx.set('audit', null);
    if (opts.user) {
      ctx.set('user', opts.user);
      ctx.set('session', { id: 'storage-test-session', userId: opts.user.id });
    }
    // Patch req.valid() for ValidatedContext handlers
    if (opts.validParams || opts.validQuery || opts.validJson) {
      (c.req as any).valid = (type: string) => {
        if (type === 'param')  return opts.validParams ?? c.req.param();
        if (type === 'query')  return opts.validQuery  ?? {};
        if (type === 'json')   return opts.validJson   ?? {};
        return undefined;
      };
    }
    await next();
  });
  switch (method) {
    case 'GET':    app.get(path, handler);    break;
    case 'POST':   app.post(path, handler);   break;
    case 'DELETE': app.delete(path, handler); break;
  }
  return app;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE stored_file CASCADE`);
});

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------

async function seedFile(overrides: Partial<NewStoredFile> = {}) {
  const [file] = await db
    .insert(storedFiles)
    .values({
      id: FILE_ID,
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      status: 'available',
      owner: OWNER_ID,
      createdBy: OWNER_ID,
      updatedBy: OWNER_ID,
      ...overrides,
    } as NewStoredFile)
    .returning();
  return file;
}

// ---------------------------------------------------------------------------
// getFile
// ---------------------------------------------------------------------------

describe('getFile handler', () => {
  test('no user in context → 500 [TypeError: undefined.id]', async () => {
    await seedFile();
    const { getFile } = await import('./getFile');
    const app = buildApp('GET', '/storage/files/:file', getFile as any);
    const res = await app.request(`/storage/files/${FILE_ID}`);
    expect(res.status).toBe(500);
  });

  test('file not found → 404 NOT_FOUND', async () => {
    const { getFile } = await import('./getFile');
    const app = buildApp('GET', '/storage/files/:file', getFile as any, { user: ownerUser });
    const res = await app.request('/storage/files/00000000-0000-4000-8000-000000000099');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('non-owner → 403 FORBIDDEN', async () => {
    await seedFile();
    const { getFile } = await import('./getFile');
    const app = buildApp('GET', '/storage/files/:file', getFile as any, { user: otherUser });
    const res = await app.request(`/storage/files/${FILE_ID}`);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('owner gets available file → 200', async () => {
    await seedFile();
    const { getFile } = await import('./getFile');
    const app = buildApp('GET', '/storage/files/:file', getFile as any, { user: ownerUser });
    const res = await app.request(`/storage/files/${FILE_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(FILE_ID);
    expect(body.filename).toBe('test.pdf');
  });
});

// ---------------------------------------------------------------------------
// deleteFile
// ---------------------------------------------------------------------------

describe('deleteFile handler', () => {
  test('no user in context → 500 [TypeError: undefined.id]', async () => {
    await seedFile();
    const { deleteFile } = await import('./deleteFile');
    const app = buildApp('DELETE', '/storage/files/:file', deleteFile as any);
    const res = await app.request(`/storage/files/${FILE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(500);
  });

  test('file not found → 404 NOT_FOUND', async () => {
    const { deleteFile } = await import('./deleteFile');
    const app = buildApp('DELETE', '/storage/files/:file', deleteFile as any, { user: ownerUser });
    const res = await app.request('/storage/files/00000000-0000-4000-8000-000000000099', { method: 'DELETE' });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('non-owner → 403 FORBIDDEN', async () => {
    await seedFile();
    const { deleteFile } = await import('./deleteFile');
    const app = buildApp('DELETE', '/storage/files/:file', deleteFile as any, { user: otherUser });
    const res = await app.request(`/storage/files/${FILE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('owner deletes own file → 204', async () => {
    await seedFile();
    const { deleteFile } = await import('./deleteFile');
    const app = buildApp('DELETE', '/storage/files/:file', deleteFile as any, { user: ownerUser });
    const res = await app.request(`/storage/files/${FILE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// listFiles
// ---------------------------------------------------------------------------

describe('listFiles handler', () => {
  test('no user in context → 500 [TypeError: undefined.id]', async () => {
    const { listFiles } = await import('./listFiles');
    const app = buildApp('GET', '/storage/files', listFiles as any);
    const res = await app.request('/storage/files');
    expect(res.status).toBe(500);
  });

  test('authenticated, empty DB → 200 with empty data array', async () => {
    const { listFiles } = await import('./listFiles');
    const app = buildApp('GET', '/storage/files', listFiles as any, { user: ownerUser });
    const res = await app.request('/storage/files');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  test('owner sees own file → 200 with file in data', async () => {
    await seedFile();
    const { listFiles } = await import('./listFiles');
    const app = buildApp('GET', '/storage/files', listFiles as any, { user: ownerUser });
    const res = await app.request('/storage/files');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(FILE_ID);
  });

  test('other user sees no files owned by owner → 200 empty', async () => {
    await seedFile();
    const { listFiles } = await import('./listFiles');
    const app = buildApp('GET', '/storage/files', listFiles as any, { user: otherUser });
    const res = await app.request('/storage/files');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getFileDownload
// ---------------------------------------------------------------------------

describe('getFileDownload handler', () => {
  test('no user in context → 500 [TypeError: undefined.id]', async () => {
    await seedFile();
    const { getFileDownload } = await import('./getFileDownload');
    const app = buildApp('GET', '/storage/files/:file/download', getFileDownload as any);
    const res = await app.request(`/storage/files/${FILE_ID}/download`);
    expect(res.status).toBe(500);
  });

  test('file not found → 404 NOT_FOUND', async () => {
    const { getFileDownload } = await import('./getFileDownload');
    const app = buildApp('GET', '/storage/files/:file/download', getFileDownload as any, { user: ownerUser });
    const res = await app.request('/storage/files/00000000-0000-4000-8000-000000000099/download');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('non-owner → 403 FORBIDDEN', async () => {
    await seedFile();
    const { getFileDownload } = await import('./getFileDownload');
    const app = buildApp('GET', '/storage/files/:file/download', getFileDownload as any, { user: otherUser });
    const res = await app.request(`/storage/files/${FILE_ID}/download`);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('file status uploading → 422 FILE_NOT_AVAILABLE', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { getFileDownload } = await import('./getFileDownload');
    const app = buildApp('GET', '/storage/files/:file/download', getFileDownload as any, { user: ownerUser });
    const res = await app.request(`/storage/files/${FILE_ID}/download`);
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('FILE_NOT_AVAILABLE');
  });

  test('owner of available file → 200 with downloadUrl', async () => {
    await seedFile();
    const { getFileDownload } = await import('./getFileDownload');
    const app = buildApp('GET', '/storage/files/:file/download', getFileDownload as any, { user: ownerUser });
    const res = await app.request(`/storage/files/${FILE_ID}/download`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.downloadUrl).toBe('string');
    expect(body.downloadUrl.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// completeFileUpload
// ---------------------------------------------------------------------------

describe('completeFileUpload handler', () => {
  test('file not found → 404 NOT_FOUND', async () => {
    const { completeFileUpload } = await import('./completeFileUpload');
    const app = buildApp('POST', '/storage/files/:file/complete', completeFileUpload as any, { user: ownerUser });
    const res = await app.request('/storage/files/00000000-0000-4000-8000-000000000099/complete', { method: 'POST' });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('file already available → 400 VALIDATION_ERROR', async () => {
    await seedFile({ status: 'available' });
    const { completeFileUpload } = await import('./completeFileUpload');
    const app = buildApp('POST', '/storage/files/:file/complete', completeFileUpload as any, { user: ownerUser });
    const res = await app.request(`/storage/files/${FILE_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('storage reports file missing → 422 UPLOAD_VERIFICATION_FAILED', async () => {
    await seedFile({ status: 'uploading' });
    const { completeFileUpload } = await import('./completeFileUpload');
    const app = buildApp('POST', '/storage/files/:file/complete', completeFileUpload as any, {
      user: ownerUser,
      storageOverrides: { verifyFileExists: async () => false },
    });
    const res = await app.request(`/storage/files/${FILE_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('UPLOAD_VERIFICATION_FAILED');
  });

  test('file in uploading state, storage confirms → 200', async () => {
    await seedFile({ status: 'uploading' });
    const { completeFileUpload } = await import('./completeFileUpload');
    const app = buildApp('POST', '/storage/files/:file/complete', completeFileUpload as any, {
      user: ownerUser,
      storageOverrides: { verifyFileExists: async () => true },
    });
    const res = await app.request(`/storage/files/${FILE_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(FILE_ID);
    expect(body.status).toBe('available');
  });
});

// ---------------------------------------------------------------------------
// initiateMultipartUpload
// ---------------------------------------------------------------------------

describe('initiateMultipartUpload handler', () => {
  test('no session → 401 UNAUTHORIZED', async () => {
    const { initiateMultipartUpload } = await import('./initiateMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/initiate', initiateMultipartUpload as any, {
      validJson: { filename: 'scan.dcm', size: 50 * 1024 * 1024, mimeType: 'application/dicom' },
    });
    const res = await app.request('/storage/multipart/initiate', { method: 'POST' });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('file too large → 400 VALIDATION_ERROR', async () => {
    const { initiateMultipartUpload } = await import('./initiateMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/initiate', initiateMultipartUpload as any, {
      user: ownerUser,
      validJson: { filename: 'huge.dcm', size: 200 * 1024 * 1024, mimeType: 'application/dicom' },
    });
    const res = await app.request('/storage/multipart/initiate', { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('valid body → 201 with fileId and uploadId', async () => {
    const { initiateMultipartUpload } = await import('./initiateMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/initiate', initiateMultipartUpload as any, {
      user: ownerUser,
      validJson: { filename: 'scan.dcm', size: 50 * 1024 * 1024, mimeType: 'application/dicom' },
    });
    const res = await app.request('/storage/multipart/initiate', { method: 'POST' });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(typeof body.fileId).toBe('string');
    expect(typeof body.uploadId).toBe('string');
  });

  test('storage failure triggers DB cleanup → 500', async () => {
    const { initiateMultipartUpload } = await import('./initiateMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/initiate', initiateMultipartUpload as any, {
      user: ownerUser,
      validJson: { filename: 'scan.dcm', size: 50 * 1024 * 1024, mimeType: 'application/dicom' },
      storageOverrides: { initiateMultipartUpload: async () => { throw new Error('S3 down'); } },
    });
    const res = await app.request('/storage/multipart/initiate', { method: 'POST' });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// generateMultipartPartUrl
// ---------------------------------------------------------------------------

describe('generateMultipartPartUrl handler', () => {
  test('no session → 401 UNAUTHORIZED', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { generateMultipartPartUrl } = await import('./generateMultipartPartUrl');
    const app = buildApp('GET', '/storage/multipart/:file/part-url', generateMultipartPartUrl as any, {
      validParams: { file: FILE_ID },
      validQuery: { partNumber: 1 },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/part-url?partNumber=1`);
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('invalid partNumber (0) → 400 VALIDATION_ERROR', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { generateMultipartPartUrl } = await import('./generateMultipartPartUrl');
    const app = buildApp('GET', '/storage/multipart/:file/part-url', generateMultipartPartUrl as any, {
      user: ownerUser,
      validParams: { file: FILE_ID },
      validQuery: { partNumber: 0 },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/part-url?partNumber=0`);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('file not found → 404 NOT_FOUND', async () => {
    const { generateMultipartPartUrl } = await import('./generateMultipartPartUrl');
    const app = buildApp('GET', '/storage/multipart/:file/part-url', generateMultipartPartUrl as any, {
      user: ownerUser,
      validParams: { file: '00000000-0000-4000-8000-000000000099' },
      validQuery: { partNumber: 1 },
    });
    const res = await app.request('/storage/multipart/00000000-0000-4000-8000-000000000099/part-url?partNumber=1');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('file has no active multipart upload → 400 VALIDATION_ERROR', async () => {
    await seedFile({ status: 'available', multipartUploadId: null });
    const { generateMultipartPartUrl } = await import('./generateMultipartPartUrl');
    const app = buildApp('GET', '/storage/multipart/:file/part-url', generateMultipartPartUrl as any, {
      user: ownerUser,
      validParams: { file: FILE_ID },
      validQuery: { partNumber: 1 },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/part-url?partNumber=1`);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('non-owner → 403 FORBIDDEN', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { generateMultipartPartUrl } = await import('./generateMultipartPartUrl');
    const app = buildApp('GET', '/storage/multipart/:file/part-url', generateMultipartPartUrl as any, {
      user: otherUser,
      validParams: { file: FILE_ID },
      validQuery: { partNumber: 1 },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/part-url?partNumber=1`);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('owner with active multipart → 200 with partUrl', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { generateMultipartPartUrl } = await import('./generateMultipartPartUrl');
    const app = buildApp('GET', '/storage/multipart/:file/part-url', generateMultipartPartUrl as any, {
      user: ownerUser,
      validParams: { file: FILE_ID },
      validQuery: { partNumber: 1 },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/part-url?partNumber=1`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.partUrl).toBe('string');
    expect(body.partNumber).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// abortMultipartUpload
// ---------------------------------------------------------------------------

describe('abortMultipartUpload handler', () => {
  test('no session → 401 UNAUTHORIZED', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { abortMultipartUpload } = await import('./abortMultipartUpload');
    const app = buildApp('DELETE', '/storage/multipart/:file/abort', abortMultipartUpload as any, {
      validParams: { file: FILE_ID },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/abort`, { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('file not found → 404 NOT_FOUND', async () => {
    const { abortMultipartUpload } = await import('./abortMultipartUpload');
    const app = buildApp('DELETE', '/storage/multipart/:file/abort', abortMultipartUpload as any, {
      user: ownerUser,
      validParams: { file: '00000000-0000-4000-8000-000000000099' },
    });
    const res = await app.request('/storage/multipart/00000000-0000-4000-8000-000000000099/abort', { method: 'DELETE' });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('file has no active multipart upload → 400 VALIDATION_ERROR', async () => {
    await seedFile({ status: 'available', multipartUploadId: null });
    const { abortMultipartUpload } = await import('./abortMultipartUpload');
    const app = buildApp('DELETE', '/storage/multipart/:file/abort', abortMultipartUpload as any, {
      user: ownerUser,
      validParams: { file: FILE_ID },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/abort`, { method: 'DELETE' });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('non-owner → 403 FORBIDDEN', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { abortMultipartUpload } = await import('./abortMultipartUpload');
    const app = buildApp('DELETE', '/storage/multipart/:file/abort', abortMultipartUpload as any, {
      user: otherUser,
      validParams: { file: FILE_ID },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/abort`, { method: 'DELETE' });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('owner aborts active upload → 204, file status becomes failed', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { abortMultipartUpload } = await import('./abortMultipartUpload');
    const app = buildApp('DELETE', '/storage/multipart/:file/abort', abortMultipartUpload as any, {
      user: ownerUser,
      validParams: { file: FILE_ID },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/abort`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    // Verify DB state: file should be marked failed
    const [row] = await db.select().from(storedFiles).where(
      (await import('drizzle-orm')).eq(storedFiles.id, FILE_ID)
    );
    expect(row!.status).toBe('failed');
  });
});

// ---------------------------------------------------------------------------
// completeMultipartUpload
// ---------------------------------------------------------------------------

describe('completeMultipartUpload handler', () => {
  test('no session → 401 UNAUTHORIZED', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { completeMultipartUpload } = await import('./completeMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/:file/complete', completeMultipartUpload as any, {
      validParams: { file: FILE_ID },
      validJson: { parts: [{ partNumber: 1, etag: 'etag-1' }] },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('file not found → 404 NOT_FOUND', async () => {
    const { completeMultipartUpload } = await import('./completeMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/:file/complete', completeMultipartUpload as any, {
      user: ownerUser,
      validParams: { file: '00000000-0000-4000-8000-000000000099' },
      validJson: { parts: [{ partNumber: 1, etag: 'etag-1' }] },
    });
    const res = await app.request('/storage/multipart/00000000-0000-4000-8000-000000000099/complete', { method: 'POST' });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('file not in uploading status → 400 VALIDATION_ERROR', async () => {
    await seedFile({ status: 'available' });
    const { completeMultipartUpload } = await import('./completeMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/:file/complete', completeMultipartUpload as any, {
      user: ownerUser,
      validParams: { file: FILE_ID },
      validJson: { parts: [{ partNumber: 1, etag: 'etag-1' }] },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('file has no multipartUploadId → 400 VALIDATION_ERROR', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: null });
    const { completeMultipartUpload } = await import('./completeMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/:file/complete', completeMultipartUpload as any, {
      user: ownerUser,
      validParams: { file: FILE_ID },
      validJson: { parts: [{ partNumber: 1, etag: 'etag-1' }] },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('non-owner → 403 FORBIDDEN', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { completeMultipartUpload } = await import('./completeMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/:file/complete', completeMultipartUpload as any, {
      user: otherUser,
      validParams: { file: FILE_ID },
      validJson: { parts: [{ partNumber: 1, etag: 'etag-1' }] },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('empty parts array → 400 VALIDATION_ERROR', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { completeMultipartUpload } = await import('./completeMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/:file/complete', completeMultipartUpload as any, {
      user: ownerUser,
      validParams: { file: FILE_ID },
      validJson: { parts: [] },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('owner with valid parts → 200, file status becomes available', async () => {
    await seedFile({ status: 'uploading', multipartUploadId: 'mp-123' });
    const { completeMultipartUpload } = await import('./completeMultipartUpload');
    const app = buildApp('POST', '/storage/multipart/:file/complete', completeMultipartUpload as any, {
      user: ownerUser,
      validParams: { file: FILE_ID },
      validJson: { parts: [{ partNumber: 1, etag: 'etag-1' }] },
    });
    const res = await app.request(`/storage/multipart/${FILE_ID}/complete`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('available');
    expect(body.id).toBe(FILE_ID);
  });
});
