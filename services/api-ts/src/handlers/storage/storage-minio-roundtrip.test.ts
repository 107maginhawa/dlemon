/**
 * storage-minio-roundtrip.test.ts — JC-7: a REAL binary round-trip against MinIO.
 *
 * The attachment (WF-039) and imaging (WF-098/099) storage handoffs were only ever
 * tested with stubbed filePath strings / mocked presigners — no test ever PUT a real
 * binary to object storage, GET it back, and proved delete removes the object. This
 * exercises the actual S3StorageProvider against a live MinIO: presign PUT → upload
 * real bytes → verify exists → presign GET → download and assert the bytes round-trip
 * unchanged → delete → verify the object is gone.
 *
 * MinIO-gated (like the ceph journeys): if object storage is not reachable the test
 * SKIPS (honest environment-absence), it does not fail.
 */

import { describe, test, expect } from 'bun:test';
import { S3StorageProvider } from '@/core/storage';

const config = {
  provider: (process.env['STORAGE_PROVIDER'] as 'minio' | 's3') || 'minio',
  endpoint: process.env['STORAGE_ENDPOINT'] || 'http://localhost:9000',
  publicEndpoint:
    process.env['STORAGE_PUBLIC_ENDPOINT'] || process.env['STORAGE_ENDPOINT'] || 'http://localhost:9000',
  bucket: process.env['STORAGE_BUCKET'] || 'monobase-files',
  region: process.env['STORAGE_REGION'] || 'us-east-1',
  credentials: {
    accessKeyId: process.env['STORAGE_ACCESS_KEY_ID'] || 'minioadmin',
    secretAccessKey: process.env['STORAGE_SECRET_ACCESS_KEY'] || 'minioadmin',
  },
  uploadUrlExpiry: 300,
  downloadUrlExpiry: 900,
} as never;

// Resolve MinIO reachability at module load so test.skipIf sees a settled value.
const provider = new S3StorageProvider(config);
let minioUp = false;
try {
  minioUp = await provider.healthCheck();
  if (minioUp) await provider.initializeBucket();
} catch {
  minioUp = false;
}

if (!minioUp) {
  // eslint-disable-next-line no-console
  console.log('[storage-minio-roundtrip] MinIO not reachable — skipping (environment-absence).');
}

describe('storage — real binary round-trip against MinIO (WF-039/098/099)', () => {
  test.skipIf(!minioUp)('presign PUT → upload → exists → download (bytes match) → delete → gone', async () => {
    const fileId = `jc7-roundtrip-${crypto.randomUUID()}`;
    // A small but real binary payload (PNG magic bytes + body) — not a filePath string.
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 250, 251, 252]);

    // 1. Presigned PUT → upload the real bytes to MinIO.
    const putUrl = await provider.generateUploadUrl(fileId, 'image/png');
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: bytes,
    });
    expect(putRes.ok, `PUT to presigned URL → ${putRes.status} ${await putRes.text().catch(() => '')}`).toBe(true);

    // 2. The object now exists in the bucket.
    expect(await provider.verifyFileExists(fileId), 'uploaded object must exist').toBe(true);

    // 3. Presigned GET → download → the bytes must round-trip UNCHANGED.
    const getUrl = await provider.generateDownloadUrl(fileId);
    const getRes = await fetch(getUrl);
    expect(getRes.ok, `GET presigned URL → ${getRes.status}`).toBe(true);
    const got = new Uint8Array(await getRes.arrayBuffer());
    expect(got.length, 'downloaded length must match uploaded').toBe(bytes.length);
    expect([...got], 'downloaded bytes must equal uploaded bytes').toEqual([...bytes]);

    // 4. Delete → the object is durably gone from the bucket.
    await provider.deleteFile(fileId);
    expect(await provider.verifyFileExists(fileId), 'deleted object must no longer exist').toBe(false);
  });
});
