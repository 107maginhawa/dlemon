/**
 * V-DG-002 attachment erasure end-to-end (decision #7, schema-fix #2).
 *
 * Proves the full seam for a clinical attachment (x-ray/photo): the new
 * `attachment` erasure target nulls the PHI (`fileName`/`note`), `approveErasure`
 * aggregates the attachment's storage `file` id into `fileIdsPendingS3Delete`,
 * and `physicalDeleteErasedFiles` (handler scope, mock storage) deletes the S3
 * object + storage row. This closes the database-schema-audit P1
 * "dental_attachment PHI survives erasure".
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import type { StorageProvider } from '@/core/storage';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import { storedFiles } from '../storage/repos/file.schema';
import { dentalAttachments } from '../dental-clinical/repos/attachment.schema';
import { requestErasure, approveErasure } from './erasure-service';
import { physicalDeleteErasedFiles } from './erasure-storage';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;

const FILE_ID = 'a8000000-0000-4000-8000-0000000000f1'; // storedFiles.id == attachment.filePath
const ATT_ID = 'a8000000-0000-4000-8000-000000000a01';
const REVIEWER = 'a8000000-0000-4000-8000-0000000000a1';

function makeMockStorage() {
  const deleted: string[] = [];
  const storage = {
    async deleteFile(fileId: string) {
      deleted.push(fileId);
    },
  } as unknown as StorageProvider;
  return { storage, deleted };
}

async function seedSubjectWithAttachment(db: NodePgDatabase) {
  await seedClinicalChain(db, { visits: 1 });
  await db.insert(storedFiles).values({
    id: FILE_ID,
    filename: 'periapical.jpg',
    mimeType: 'image/jpeg',
    size: 204800,
    status: 'available',
    owner: REVIEWER,
  });
  await db.insert(dentalAttachments).values({
    id: ATT_ID,
    visitId: CHAIN_IDS.VISIT_1,
    patientId: CHAIN_IDS.PATIENT_1,
    imageType: 'xray',
    fileName: 'maria-santos-xray.jpg',
    filePath: FILE_ID, // FE sets filePath = the storage file id (== S3 key)
    fileSizeBytes: 204800,
    mimeType: 'image/jpeg',
    note: 'sharp pain tooth 21',
  });
}

const baseInput = {
  subjectPersonId: CHAIN_IDS.PERSON_1,
  subjectPatientId: CHAIN_IDS.PATIENT_1,
  tenantId: CHAIN_IDS.ORG,
  branchId: CHAIN_IDS.BRANCH_1,
  reason: 'GDPR Art.17 / RA-10173 request',
  requestedBy: REVIEWER,
};

describe('erasure nulls attachment PHI and deletes its S3 object (V-DG-002)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    await seedSubjectWithAttachment(db);
  });

  afterEach(() => teardown());

  test('approveErasure nulls the PHI and surfaces the attachment file id pending S3 delete', async () => {
    const req = await requestErasure(db, noopLogger, baseInput);
    const { request, fileIdsPendingS3Delete } = await approveErasure(db, noopLogger, req.id, {
      reviewedBy: REVIEWER,
    });

    expect(request.status).toBe('anonymized');
    // The attachment target (now registered in ERASURE_TARGETS) surfaced the file.
    expect(fileIdsPendingS3Delete).toContain(FILE_ID);

    // PHI fields redacted in place.
    const [att] = await db
      .select()
      .from(dentalAttachments)
      .where(eq(dentalAttachments.id, ATT_ID));
    expect(att!.fileName).toBe('[ERASED]');
    expect(att!.note).toBeNull();
    expect(att!.filePath).toBe('[ERASED]'); // PHI-bearing path redacted too
  });

  test('physicalDeleteErasedFiles deletes the attachment S3 object AND the storage row', async () => {
    const req = await requestErasure(db, noopLogger, baseInput);
    const { fileIdsPendingS3Delete } = await approveErasure(db, noopLogger, req.id, {
      reviewedBy: REVIEWER,
    });

    const { storage, deleted } = makeMockStorage();
    const res = await physicalDeleteErasedFiles(
      db,
      storage,
      noopLogger,
      { tenantId: CHAIN_IDS.ORG, branchId: CHAIN_IDS.BRANCH_1, subjectPersonId: CHAIN_IDS.PERSON_1, actorId: REVIEWER },
      fileIdsPendingS3Delete,
      (async () => {}) as any,
    );

    // S3 object deleted.
    expect(deleted).toContain(FILE_ID);
    expect(res.deletedFileIds).toContain(FILE_ID);

    // storage `file` row hard-deleted (filePath == storedFiles.id).
    const rows = await db.select().from(storedFiles).where(eq(storedFiles.id, FILE_ID));
    expect(rows).toHaveLength(0);
  });
});
