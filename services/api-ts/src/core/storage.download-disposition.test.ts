/**
 * storage.download-disposition.test.ts — P1-7a security pin.
 *
 * The download presign served the stored object with its (uploader-supplied)
 * Content-Type and the storage backend's default inline disposition — and the
 * object is served from the storage origin, not proxied through the API, so the
 * app's nosniff header never applies. An uploaded text/html / SVG-with-script
 * therefore rendered/executed on view (stored XSS). Fix: force
 * ResponseContentDisposition=attachment (+ octet-stream) on the download presign
 * so the browser downloads instead of rendering.
 *
 * This mocks the AWS presigner to capture the GetObjectCommand the handler builds.
 */

import { describe, test, expect, mock } from 'bun:test';

let captured: { input?: Record<string, unknown> } | null = null;
mock.module('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: async (_client: unknown, command: { input?: Record<string, unknown> }) => {
    captured = command;
    return 'https://storage.example/signed?response-content-disposition=attachment';
  },
}));

const { S3StorageProvider } = await import('./storage');

const config = {
  provider: 's3',
  region: 'us-east-1',
  credentials: { accessKeyId: 'x', secretAccessKey: 'y' },
  bucket: 'test-bucket',
  downloadUrlExpiry: 300,
} as never;

describe('S3StorageProvider.generateDownloadUrl — P1-7a stored-XSS hardening', () => {
  test('forces Content-Disposition: attachment + octet-stream content type', async () => {
    const provider = new S3StorageProvider(config);
    // Stub the S3 clients so ensureBucketExists() does not make a real call.
    (provider as unknown as { client: unknown }).client = { send: async () => ({}) };
    (provider as unknown as { publicClient: unknown }).publicClient = { send: async () => ({}) };

    await provider.generateDownloadUrl('file-123');

    expect(captured?.input?.['ResponseContentDisposition']).toBe('attachment');
    expect(captured?.input?.['ResponseContentType']).toBe('application/octet-stream');
  });
});
