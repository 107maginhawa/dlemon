/**
 * attachment-erasure.facade tests (V-DG-002, schema-fix #2 / decision #7).
 *
 * Erases a subject's clinical attachment PII: nulls the free-text `fileName` and
 * `note`, REDACTS `filePath` (which is an unvalidated client string that can
 * itself embed PHI for legacy `/uploads/...` rows), marks the row deleted, and
 * surfaces — for physical S3 deletion — ONLY the filePaths that are confirmed
 * object-store `stored_file` keys (so a legacy/free-form path is never handed to
 * the storage client as a silently-succeeding bogus delete). Idempotent.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import { storedFiles } from '../../storage/repos/file.schema';
import { dentalAttachments } from './attachment.schema';
import {
  anonymizeAttachmentsByPerson,
  anonymizeAttachmentsByPersonDetailed,
} from './attachment-erasure.facade';
import { ERASED_MARKER } from './clinical-erasure.facade';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const OBJECT_STORE_KEY = 'a9000000-0000-4000-8000-0000000000f1'; // == stored_file.id
const LEGACY_PATH = '/uploads/maria-santos/periapical-2024.jpg'; // free-form, PHI-bearing
const ATT_OBJECT = 'a9000000-0000-4000-8000-000000000a01';
const ATT_LEGACY = 'a9000000-0000-4000-8000-000000000a02';
const REVIEWER = 'a9000000-0000-4000-8000-0000000000a9';

async function seedObjectStoreAttachment(db: NodePgDatabase) {
  await db.insert(storedFiles).values({
    id: OBJECT_STORE_KEY,
    filename: 'periapical.jpg',
    mimeType: 'image/jpeg',
    size: 204800,
    status: 'available',
    owner: REVIEWER,
  });
  await db.insert(dentalAttachments).values({
    id: ATT_OBJECT,
    visitId: CHAIN_IDS.VISIT_1,
    patientId: CHAIN_IDS.PATIENT_1,
    imageType: 'xray',
    toothNumbers: [21, 22],
    fileName: 'maria-santos-periapical-2024.jpg', // PHI: patient name in filename
    filePath: OBJECT_STORE_KEY, // FE sets filePath = storage file id
    fileSizeBytes: 204800,
    mimeType: 'image/jpeg',
    note: 'Maria mentioned sharp pain on tooth 21', // PHI: free-text
  });
}

describe('attachment-erasure facade', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    await seedClinicalChain(db, { visits: 1 });
  });

  afterEach(() => teardown());

  test('nulls PHI, redacts filePath, retains clinical metadata, surfaces the object-store key', async () => {
    await seedObjectStoreAttachment(db);

    const res = await anonymizeAttachmentsByPersonDetailed(db, CHAIN_IDS.PERSON_1);
    expect(res.rowsAnonymized).toBe(1);
    // Only the confirmed object-store key is surfaced for physical S3 delete.
    expect(res.fileIdsPendingS3Delete).toEqual([OBJECT_STORE_KEY]);

    const [att] = await db
      .select()
      .from(dentalAttachments)
      .where(eq(dentalAttachments.id, ATT_OBJECT));

    // PHI redacted — including filePath (no PHI-bearing string left behind).
    expect(att!.fileName).toBe(ERASED_MARKER);
    expect(att!.note).toBeNull();
    expect(att!.filePath).toBe(ERASED_MARKER);
    // Erasure marker (row kept, not hard-deleted).
    expect(att!.deletedAt).not.toBeNull();
    // Clinical / non-PII metadata retained.
    expect(att!.imageType).toBe('xray');
    expect(att!.toothNumbers).toEqual([21, 22]);
    expect(att!.fileSizeBytes).toBe(204800);
  });

  test('legacy free-form filePath: PHI redacted but NOT surfaced as a deletable S3 key', async () => {
    await db.insert(dentalAttachments).values({
      id: ATT_LEGACY,
      visitId: CHAIN_IDS.VISIT_1,
      patientId: CHAIN_IDS.PATIENT_1,
      imageType: 'photo',
      fileName: 'maria-santos-intraoral.jpg',
      filePath: LEGACY_PATH, // not an object-store key
      fileSizeBytes: 1024,
      mimeType: 'image/jpeg',
      note: 'pre-op photo',
    });

    const res = await anonymizeAttachmentsByPersonDetailed(db, CHAIN_IDS.PERSON_1);
    expect(res.rowsAnonymized).toBe(1);
    // No false-success: a non-object-store path is never handed to the S3 client.
    expect(res.fileIdsPendingS3Delete).toEqual([]);

    const [att] = await db
      .select()
      .from(dentalAttachments)
      .where(eq(dentalAttachments.id, ATT_LEGACY));
    // PHI fully redacted — the path (which embeds the patient name) is gone too.
    expect(att!.fileName).toBe(ERASED_MARKER);
    expect(att!.note).toBeNull();
    expect(att!.filePath).toBe(ERASED_MARKER);
  });

  test('mixed: erases both, surfaces only the confirmed object-store key', async () => {
    await seedObjectStoreAttachment(db);
    await db.insert(dentalAttachments).values({
      id: ATT_LEGACY,
      visitId: CHAIN_IDS.VISIT_1,
      patientId: CHAIN_IDS.PATIENT_1,
      imageType: 'photo',
      fileName: 'legacy.jpg',
      filePath: LEGACY_PATH,
      fileSizeBytes: 1024,
      mimeType: 'image/jpeg',
    });

    const res = await anonymizeAttachmentsByPersonDetailed(db, CHAIN_IDS.PERSON_1);
    expect(res.rowsAnonymized).toBe(2);
    expect(res.fileIdsPendingS3Delete).toEqual([OBJECT_STORE_KEY]);
  });

  test('is idempotent — re-run preserves the original deletion time, no throw', async () => {
    await seedObjectStoreAttachment(db);

    const first = await anonymizeAttachmentsByPerson(db, CHAIN_IDS.PERSON_1);
    expect(first).toBe(1);
    const [afterFirst] = await db
      .select({ deletedAt: dentalAttachments.deletedAt })
      .from(dentalAttachments)
      .where(eq(dentalAttachments.id, ATT_OBJECT));

    const second = await anonymizeAttachmentsByPerson(db, CHAIN_IDS.PERSON_1);
    expect(second).toBe(1); // re-matches the same row, no error
    const [afterSecond] = await db
      .select({ deletedAt: dentalAttachments.deletedAt })
      .from(dentalAttachments)
      .where(eq(dentalAttachments.id, ATT_OBJECT));

    // deletedAt is COALESCE-preserved across runs (first erasure time wins).
    expect(afterSecond!.deletedAt?.getTime()).toBe(afterFirst!.deletedAt?.getTime());
  });

  test('also erases an already soft-deleted attachment (PHI persists past soft-delete)', async () => {
    await seedObjectStoreAttachment(db);
    await db
      .update(dentalAttachments)
      .set({ deletedAt: new Date('2025-01-01T00:00:00Z') })
      .where(eq(dentalAttachments.id, ATT_OBJECT));

    const res = await anonymizeAttachmentsByPersonDetailed(db, CHAIN_IDS.PERSON_1);
    expect(res.rowsAnonymized).toBe(1);
    expect(res.fileIdsPendingS3Delete).toEqual([OBJECT_STORE_KEY]);

    const [att] = await db
      .select()
      .from(dentalAttachments)
      .where(eq(dentalAttachments.id, ATT_OBJECT));
    expect(att!.fileName).toBe(ERASED_MARKER);
    expect(att!.note).toBeNull();
  });

  test('uuid filePath with no stored_file row (orphan) is redacted but NOT surfaced', async () => {
    const ORPHAN_UUID = 'a9000000-0000-4000-8000-00000000dead'; // valid uuid, no stored_file
    await db.insert(dentalAttachments).values({
      id: ATT_LEGACY,
      visitId: CHAIN_IDS.VISIT_1,
      patientId: CHAIN_IDS.PATIENT_1,
      imageType: 'xray',
      fileName: 'orphan.jpg',
      filePath: ORPHAN_UUID,
      fileSizeBytes: 1024,
      mimeType: 'image/jpeg',
    });

    const res = await anonymizeAttachmentsByPersonDetailed(db, CHAIN_IDS.PERSON_1);
    expect(res.rowsAnonymized).toBe(1);
    expect(res.fileIdsPendingS3Delete).toEqual([]); // no real object → not surfaced

    const [att] = await db
      .select({ filePath: dentalAttachments.filePath })
      .from(dentalAttachments)
      .where(eq(dentalAttachments.id, ATT_LEGACY));
    expect(att!.filePath).toBe(ERASED_MARKER);
  });

  test('returns 0 / empty for a person with no attachments', async () => {
    // PERSON_2 exists (seedClinicalChain default), has no attachment.
    const res = await anonymizeAttachmentsByPersonDetailed(db, CHAIN_IDS.PERSON_2);
    expect(res.rowsAnonymized).toBe(0);
    expect(res.fileIdsPendingS3Delete).toEqual([]);

    // unknown person (no patient profile) → 0
    const none = await anonymizeAttachmentsByPerson(db, '00000000-0000-4000-8000-0000000000ff');
    expect(none).toBe(0);
  });
});
