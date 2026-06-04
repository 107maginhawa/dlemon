/**
 * V-DG-002 physical S3 radiograph deletion on erasure (DATA_GOVERNANCE §3).
 *
 * Proves the end-to-end seam: the imaging target surfaces the radiograph storage
 * `file` ids, `approveErasure` threads them up, and `physicalDeleteErasedFiles`
 * (handler scope, mock storage) deletes the S3 objects + storage rows. Also
 * proves FAIL-OPEN: a `deleteFile` throw does NOT fail the erasure — the file is
 * left pending (its storage row kept) for the next, idempotent retry.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import type { StorageProvider } from '@/core/storage';
import { persons } from '../person/repos/person.schema';
import { patients } from '../patient/repos/patient.schema';
import { storedFiles } from '../storage/repos/file.schema';
import { imagingStudies, imagingStudyImages } from '../dental-imaging/repos/imaging.schema';
import { requestErasure, approveErasure } from './erasure-service';
import { physicalDeleteErasedFiles } from './erasure-storage';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;

const PID = 'e7000000-0000-4000-8000-000000000001';
const PATIENT_ID = 'c7000000-0000-4000-8000-000000000001';
const TENANT = 'd7000000-0000-4000-8000-000000000001';
const BRANCH = 'b7000000-0000-4000-8000-000000000001';
const MEMBER = 'e8000000-0000-4000-8000-000000000001';
const REVIEWER = 'a7000000-0000-4000-8000-000000000001';
const FILE_ID = 'f7000000-0000-4000-8000-000000000001';
const STUDY_ID = 'f8000000-0000-4000-8000-000000000001';

/** Records every deleteFile call; can be configured to throw. */
function makeMockStorage(opts: { throwOn?: Set<string> } = {}) {
  const deleted: string[] = [];
  const storage = {
    async deleteFile(fileId: string) {
      if (opts.throwOn?.has(fileId)) throw new Error('S3 unavailable');
      deleted.push(fileId);
    },
  } as unknown as StorageProvider;
  return { storage, deleted };
}

async function seedSubjectWithRadiograph(db: NodePgDatabase) {
  await db.insert(persons).values({ id: PID, firstName: 'Jane', lastName: 'Doe' });
  await db.insert(patients).values({ id: PATIENT_ID, person: PID });
  await db.insert(storedFiles).values({
    id: FILE_ID,
    filename: 'radiograph.dcm',
    mimeType: 'application/dicom',
    size: 1024,
    status: 'available',
    owner: REVIEWER,
  });
  await db.insert(imagingStudies).values({
    id: STUDY_ID,
    patientId: PATIENT_ID,
    branchId: BRANCH,
    acquiredBy: MEMBER,
    modality: 'periapical',
  });
  await db.insert(imagingStudyImages).values({
    studyId: STUDY_ID,
    fileId: FILE_ID,
    dicomMetadata: { PatientName: 'Jane Doe' },
  });
}

const baseInput = {
  subjectPersonId: PID,
  subjectPatientId: PATIENT_ID,
  tenantId: TENANT,
  branchId: BRANCH,
  reason: 'GDPR Art.17 request',
  requestedBy: REVIEWER,
};

describe('erasure physically deletes radiograph S3 objects (V-DG-002)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    await seedSubjectWithRadiograph(db);
  });

  afterEach(() => teardown());

  test('approveErasure surfaces the radiograph file ids pending S3 delete', async () => {
    const req = await requestErasure(db, noopLogger, baseInput);
    const { request, fileIdsPendingS3Delete } = await approveErasure(db, noopLogger, req.id, {
      reviewedBy: REVIEWER,
    });

    expect(request.status).toBe('anonymized');
    expect(fileIdsPendingS3Delete).toContain(FILE_ID);
  });

  test('physicalDeleteErasedFiles deletes the S3 object AND the storage file row', async () => {
    const req = await requestErasure(db, noopLogger, baseInput);
    const { fileIdsPendingS3Delete } = await approveErasure(db, noopLogger, req.id, {
      reviewedBy: REVIEWER,
    });

    const { storage, deleted } = makeMockStorage();
    const auditEvents: any[] = [];
    const auditSpy = async (_db: any, _logger: any, e: any) => {
      auditEvents.push(e);
    };

    const res = await physicalDeleteErasedFiles(
      db,
      storage,
      noopLogger,
      { tenantId: TENANT, branchId: BRANCH, subjectPersonId: PID, actorId: REVIEWER },
      fileIdsPendingS3Delete,
      auditSpy as any,
    );

    // S3 object deleted.
    expect(deleted).toContain(FILE_ID);
    expect(res.deletedFileIds).toContain(FILE_ID);
    expect(res.pendingFileIds).toHaveLength(0);

    // storage `file` row hard-deleted.
    const rows = await db.select().from(storedFiles).where(eq(storedFiles.id, FILE_ID));
    expect(rows).toHaveLength(0);

    // physical delete is audited.
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0].action).toBe('erasure.s3_deleted');
    expect(auditEvents[0].metadata.deleted).toBe(1);
  });

  test('FAIL-OPEN: a deleteFile throw does NOT fail erasure — file left pending, row kept', async () => {
    const req = await requestErasure(db, noopLogger, baseInput);
    const { fileIdsPendingS3Delete } = await approveErasure(db, noopLogger, req.id, {
      reviewedBy: REVIEWER,
    });

    const { storage, deleted } = makeMockStorage({ throwOn: new Set([FILE_ID]) });
    const auditEvents: any[] = [];
    const auditSpy = async (_db: any, _logger: any, e: any) => {
      auditEvents.push(e);
    };

    // Must NOT throw — anonymization is already committed.
    const res = await physicalDeleteErasedFiles(
      db,
      storage,
      noopLogger,
      { tenantId: TENANT, branchId: BRANCH, subjectPersonId: PID, actorId: REVIEWER },
      fileIdsPendingS3Delete,
      auditSpy as any,
    );

    expect(deleted).not.toContain(FILE_ID); // S3 delete failed
    expect(res.deletedFileIds).toHaveLength(0);
    expect(res.pendingFileIds).toContain(FILE_ID);

    // storage `file` row KEPT so the handle survives for the next retry.
    const rows = await db.select().from(storedFiles).where(eq(storedFiles.id, FILE_ID));
    expect(rows).toHaveLength(1);

    // still audited, recording the pending file.
    expect(auditEvents[0].action).toBe('erasure.s3_deleted');
    expect(auditEvents[0].metadata.pending).toBe(1);
    expect(auditEvents[0].metadata.pendingFileIds).toContain(FILE_ID);
  });

  test('empty file list is a no-op (no audit, no error)', async () => {
    const { storage, deleted } = makeMockStorage();
    const auditEvents: any[] = [];
    const res = await physicalDeleteErasedFiles(
      db,
      storage,
      noopLogger,
      { tenantId: TENANT, subjectPersonId: PID },
      [],
      (async (_d: any, _l: any, e: any) => {
        auditEvents.push(e);
      }) as any,
    );
    expect(deleted).toHaveLength(0);
    expect(res.deletedFileIds).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });
});
