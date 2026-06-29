/**
 * createImagingStudy.multipart-storedfile.test.ts — G-03 (prod-readiness audit)
 *
 * Bug: a large-DICOM/CBCT upload routes through S3 multipart
 * (createImagingStudy.ts useMultipart) by calling storage.initiateMultipartUpload
 * directly, but NEVER creates a stored_file row. completeMultipartUpload /
 * abortMultipartUpload both look the file up via StorageFileRepository.findOneById
 * and throw NotFoundError (404) when it is absent — so every imaging-originated
 * multipart upload can never complete or abort. The study create must persist the
 * stored_file row (status 'uploading', multipartUploadId) like the /storage
 * multipart-initiate handler does.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { StorageFileRepository } from '@/handlers/storage/repos/file.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER = { id: '00000000-0000-0000-0000-0000000000b1', email: 'imaging-owner@clinic.com' };
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000000b1';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000000b1';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000000b2';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000000b3';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000000b4';
const ORG_ID = 'ec000000-0000-1000-8000-0000000000b1';

// Fake storage: multipart-capable, no real S3.
const fakeStorage = {
  generateUploadUrl: async (_fileId: string, _mime: string) => 'https://s3.test/put',
  generateDownloadUrl: async (fileId: string) => `https://s3.test/get/${fileId}`,
  initiateMultipartUpload: async (_fileId: string, _filename: string, _mime: string) => 'fake-s3-upload-id',
  generatePartUploadUrl: async (_fileId: string, _uploadId: string, partNumber: number) => `https://s3.test/part/${partNumber}`,
  completeMultipartUpload: async () => undefined,
  abortMultipartUpload: async () => undefined,
  deleteFile: async () => undefined,
  bucketExists: async () => true,
} as any;

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Imaging Clinic', tier: 'solo', ownerPersonId: OWNER.id, countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Imm', lastName: 'Aging', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'active', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM stored_file WHERE owner = ${OWNER.id}`);
  await db.execute(sql`DELETE FROM imaging_study_image WHERE study_id IN (SELECT id FROM imaging_study WHERE branch_id = ${BRANCH_ID})`);
  await db.execute(sql`DELETE FROM imaging_study WHERE branch_id = ${BRANCH_ID}`);
});

describe('G-03: imaging multipart upload persists a stored_file row', () => {
  test('large DICOM study create writes an uploading stored_file the complete/abort path can find', async () => {
    const app = buildTestApp({ db, user: OWNER, services: { storage: fakeStorage } });
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        branchId: BRANCH_ID,
        modality: 'other',
        filename: 'scan.dcm',
        mimeType: 'application/dicom',
        size: 12 * 1024 * 1024, // > 5MB → multipart
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.uploadMethod).toBe('MULTIPART');
    expect(typeof body.fileId).toBe('string');

    // The stored_file row MUST exist so completeMultipartUpload/abort can find it.
    const storedFile = await new StorageFileRepository(db).findOneById(body.fileId);
    expect(storedFile).not.toBeNull();
    expect(storedFile!.status).toBe('uploading');
    expect(storedFile!.multipartUploadId).toBe('fake-s3-upload-id');
  });

  test('single-PUT (small) imaging upload does NOT create a stored_file row (unchanged)', async () => {
    const app = buildTestApp({ db, user: OWNER, services: { storage: fakeStorage } });
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID, visitId: VISIT_ID, branchId: BRANCH_ID, modality: 'other',
        filename: 'bitewing.png', mimeType: 'image/png', size: 100 * 1024,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.uploadMethod).toBe('PUT');
    expect(await new StorageFileRepository(db).findOneById(body.fileId)).toBeNull();
  });
});
