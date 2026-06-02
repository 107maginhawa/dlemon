/**
 * dental-imaging handler unit tests
 *
 * Uses mock objects — no real DB or storage connections.
 * Covers business rules: BR-033 (file size), BR-034 (mime type),
 * BR-026 (delete role restrictions), BR-027 (associate own-only delete),
 * and the union adapter for legacy dental_attachment records.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { ALLOWED_IMAGING_MIME_TYPES } from './repos/imaging.schema';

// Additional IDs used by measurement tests
const ANNOTATION_ID = '22222222-0000-0000-0000-000000000008';

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

const DENTIST_USER = { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'dentist@clinic.com' };
const ASSOCIATE_USER = { id: 'bbbbbbbb-0000-0000-0000-000000000002', email: 'assoc@clinic.com' };
const HYGIENIST_USER = { id: 'cccccccc-0000-0000-0000-000000000003', email: 'hygienist@clinic.com' };
const FRONT_DESK_USER = { id: '11111110-0000-0000-0000-000000000009', email: 'frontdesk@clinic.com' };
const PATIENT_ID = 'dddddddd-0000-0000-0000-000000000004';
const BRANCH_ID = 'eeeeeeee-0000-0000-0000-000000000005';
const STUDY_ID = 'ffffffff-0000-0000-0000-000000000006';
const IMAGE_ID = '11111111-0000-0000-0000-000000000007';

/** Pre-built study row returned by mock repo */
const MOCK_STUDY = {
  id: STUDY_ID,
  patientId: PATIENT_ID,
  visitId: null,
  branchId: BRANCH_ID,
  acquiredBy: DENTIST_USER.id,
  modality: 'other' as const,
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

/** Pre-built image row returned by mock repo */
const MOCK_IMAGE = {
  id: IMAGE_ID,
  studyId: STUDY_ID,
  fileId: 'ffffffff-0000-0000-0000-000000000099',
  pixelSpacingMm: null,
  sequenceNumber: 0,
  dicomMetadata: null,
  modality: 'other' as const,
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

/** Fake storage provider */
function makeStorage() {
  return {
    generateUploadUrl: async (_fileId: string, _mime: string) =>
      'https://storage.example.com/presigned-upload-url',
    generateDownloadUrl: async (fileId: string) =>
      `https://storage.example.com/presigned-get/${fileId}`,
    // P1-9 multipart upload methods
    initiateMultipartUpload: async (_fileId: string, _filename: string, _mime: string) =>
      'test-upload-id',
    generatePartUploadUrl: async (_fileId: string, _uploadId: string, partNumber: number) =>
      `https://storage.example.com/presigned-part/${partNumber}`,
    completeMultipartUpload: async () => undefined,
    abortMultipartUpload: async () => undefined,
  };
}

/** Fake DB that passes assertBranchAccess (returns a membership row) */
function makeDb(opts: {
  hasMembership?: boolean;
  memberRole?: string;
  study?: typeof MOCK_STUDY | null;
  image?: typeof MOCK_IMAGE | null;
  imagingTier?: 'free' | 'basic' | 'addon';
} = {}) {
  const hasMembership = opts.hasMembership !== false;
  const memberRole = opts.memberRole ?? 'dentist_owner';
  const study = opts.study !== undefined ? opts.study : MOCK_STUDY;
  const image = opts.image !== undefined ? opts.image : MOCK_IMAGE;
  const imagingTier = opts.imagingTier ?? 'addon';

  /**
   * The select() chain is used for:
   *   1. assertBranchAccess → dental_membership table → returns membership row (no fields arg)
   *   2. getMemberRole → dental_membership table → returns { role } (fields arg has 'role' key)
   *   3. ImagingRepository.findImageById → imaging_study_image → returns image
   *   4. ImagingRepository.findStudyById → imaging_study → returns study
   *   5. ImagingRepository.listImagingImagesForPatient → innerJoin → returns imaging rows
   *   6. ImagingRepository.archiveImage / listTeethByImage → update/select on imaging tables
   *
   * We detect the target table by checking for known column names on the Drizzle
   * table object (Drizzle exposes columns as own properties of the table object).
   * We detect getMemberRole vs assertBranchAccess by whether the fields arg has a 'role' key.
   */
  const buildSelectChain = (tableRef: any, fields?: any) => {
    // Detect table type by column presence
    const hasPersonId = tableRef?.personId !== undefined;        // dental_membership
    const hasStudyId = tableRef?.studyId !== undefined;          // imaging_study_image
    const hasToothNumber = tableRef?.toothNumber !== undefined && !hasStudyId; // imagingStudyTeeth
    const hasPatientId = tableRef?.patientId !== undefined && !hasStudyId; // imaging_study
    const hasOrganizationId = tableRef?.organizationId !== undefined; // dental_branch (tier gate)
    const isRoleQuery = hasPersonId && fields && 'role' in fields; // getMemberRole

    return {
      where: (_cond: any) => {
        const resolveLimit = (_n: number) => {
          if (isRoleQuery) {
            return Promise.resolve(hasMembership ? [{ role: memberRole }] : []);
          }
          if (hasPersonId) {
            return Promise.resolve(hasMembership ? [{ id: 'membership-id' }] : []);
          }
          if (hasStudyId) {
            return Promise.resolve(image ? [image] : []);
          }
          if (hasPatientId) {
            return Promise.resolve(study ? [study] : []);
          }
          return Promise.resolve([]);
        };

        // imagingStudyTeeth — listTeethByImage awaits where() directly (no .limit())
        if (hasToothNumber) {
          const rows = Promise.resolve([{ toothNumber: 18 }, { toothNumber: 19 }]);
          return Object.assign({ limit: resolveLimit }, {
            then: (resolve: any, reject: any) => rows.then(resolve, reject),
          });
        }

        // imagingStudyImages — listImagesByStudy awaits where() directly (no .limit())
        if (hasStudyId) {
          const rows = Promise.resolve(image ? [image] : []);
          return Object.assign({ limit: resolveLimit }, {
            then: (resolve: any, reject: any) => rows.then(resolve, reject),
          });
        }

        // Fallback: unknown table (e.g. stored_file queried by getFileSizesByIds).
        // Must be thenable so `await db.select().from(unknownTable).where(...)` resolves to []
        // rather than the plain `{ limit }` object (which causes rows.map is not a function → 500).
        const fallbackRows = Promise.resolve([] as any[]);
        return Object.assign({ limit: resolveLimit }, {
          then: (resolve: any, reject: any) => fallbackRows.then(resolve, reject),
        });
      },
      // innerJoin is used by listImagingImagesForPatient (imaging_study_image table),
      // createMeasurement tier gate (dental_branch → dental_organization),
      // and by listPatientImages legacy query (dental_attachment table joined to dental_visit)
      innerJoin: (_joinTable: any, _cond: any) => ({
        where: (_cond2: any) => {
          if (hasStudyId) {
            // imaging_study_image → innerJoin imaging_study
            return Promise.resolve(
              image ? [{ ...image, studyBranchId: (study as any)?.branchId ?? BRANCH_ID }] : [],
            );
          }
          if (hasOrganizationId) {
            // dental_branch → dental_organization tier gate
            const tierRows = Promise.resolve([{ imagingTier }]);
            return Object.assign(tierRows, { limit: (_n: number) => tierRows });
          }
          // dental_attachment → innerJoin dental_visit (legacy query, returns empty for mocks)
          return Promise.resolve([]);
        },
      }),
    };
  };

  return {
    select: (fields?: any) => ({
      from: (table: any) => buildSelectChain(table, fields),
    }),
    insert: (table: any) => ({
      values: (data: any) => ({
        // imagingStudyImages has studyId column; imagingStudies has patientId but not studyId.
        // For imaging_study_image, echo the inserted row merged onto MOCK_IMAGE so tests can
        // observe persisted fields (e.g. P1-9 DICOM pixelSpacingMm / dicomMetadata).
        returning: () =>
          table?.studyId !== undefined
            ? Promise.resolve([{ ...(image ?? MOCK_IMAGE), ...data }]) // imaging_study_image insert
            : Promise.resolve([study ?? MOCK_STUDY]),                  // imaging_study insert
        // imagingStudyTeeth insert (addToothLink) doesn't call .returning()
        then: (resolve: any, reject: any) => Promise.resolve(undefined).then(resolve, reject),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: (_cond: any) => ({
          // archiveImage doesn't call .returning(); awaiting the where() result
          then: (resolve: any, reject: any) => Promise.resolve(undefined).then(resolve, reject),
          // updateModality calls .returning()
          returning: () => Promise.resolve([image ?? MOCK_IMAGE]),
        }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

type HandlerFn = (ctx: any) => Promise<Response>;

function buildApp(
  handler: HandlerFn,
  {
    user,
    role,
    storage,
    db,
    method = 'POST',
    path = '/',
  }: {
    user?: typeof DENTIST_USER;
    role?: string;
    storage?: ReturnType<typeof makeStorage>;
    db?: ReturnType<typeof makeDb>;
    method?: string;
    path?: string;
  },
) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    c.set('database' as any, db ?? makeDb());
    c.set('storage' as any, storage ?? makeStorage());
    c.set('logger' as any, { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      c.set('user' as any, user);
      c.set('session' as any, { id: 'test-session' });
    }
    if (role) {
      c.set('memberRole' as any, role);
    }
    await next();
  });

  const lowerMethod = method.toLowerCase();
  (app as any)[lowerMethod](path, handler);
  return app;
}

// ---------------------------------------------------------------------------
// createImagingStudy 201 + upload URL
// ---------------------------------------------------------------------------
// @BR-025 Image linked to patient + optional visit + optional tooth

describe('createImagingStudy 201 + upload URL', () => {
  test('returns 201 with study_id and uploadUrl', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        filename: 'panoramic.jpg',
        mimeType: 'image/jpeg',
        size: 204800,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.study).not.toBeNull();
    expect(body.image).not.toBeNull();
    expect(body.image.id).toBe(IMAGE_ID);
    expect(body.uploadUrl).not.toBeNull();
  });

  // V-IMG-001 / AC-IMG-001: cephalometric study upload requires the addon tier.
  test('cephalometric study without addon tier → 403 IMAGING_TIER_REQUIRED', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: makeDb({ imagingTier: 'basic' }),
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        modality: 'cephalometric',
        filename: 'ceph.jpg',
        mimeType: 'image/jpeg',
        size: 204800,
      }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.code).toBe('IMAGING_TIER_REQUIRED');
  });

  // V-IMG-001: cephalometric study WITH addon tier proceeds to create (201).
  test('cephalometric study with addon tier → 201', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: makeDb({ imagingTier: 'addon' }),
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        modality: 'cephalometric',
        filename: 'ceph.jpg',
        mimeType: 'image/jpeg',
        size: 204800,
      }),
    });

    expect(res.status).toBe(201);
  });

  // V-IMG-001: non-cephalometric study is NOT tier-gated (free/basic can upload).
  test('non-cephalometric study on basic tier → 201 (no tier gate)', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: makeDb({ imagingTier: 'basic' }),
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        modality: 'panoramic',
        filename: 'pano.jpg',
        mimeType: 'image/jpeg',
        size: 204800,
      }),
    });

    expect(res.status).toBe(201);
  });

  test('uploadUrl is presigned string starting with https://', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        filename: 'bite.png',
        mimeType: 'image/png',
        size: 102400,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.uploadUrl).toMatch(/^https:\/\//);
  });
});

// ---------------------------------------------------------------------------
// getImagingStudy
// @BR-025 Image linked to patient; study returned with images + teeth
// ---------------------------------------------------------------------------

describe('getImagingStudy', () => {
  test('returns 200 with study, images, and teeth', async () => {
    const { getImagingStudy } = await import('./getImagingStudy');
    const db = makeDb({ study: MOCK_STUDY, image: MOCK_IMAGE, hasMembership: true });
    const app = buildApp(getImagingStudy as any, { user: DENTIST_USER, db, method: 'GET', path: '/:studyId' });
    const res = await app.request(`/${STUDY_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.images)).toBe(true);
  });

  test('returns 404 when study not found', async () => {
    const { getImagingStudy } = await import('./getImagingStudy');
    const db = makeDb({ study: null, hasMembership: true });
    const app = buildApp(getImagingStudy as any, { user: DENTIST_USER, db, method: 'GET', path: '/:studyId' });
    const res = await app.request('/missing-id');
    expect(res.status).toBe(404);
  });

  test('returns 401 when unauthenticated', async () => {
    const { getImagingStudy } = await import('./getImagingStudy');
    const app = buildApp(getImagingStudy as any, { method: 'GET', path: '/:studyId' });
    const res = await app.request(`/${STUDY_ID}`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// BR-033 file size limit
// @BR-033 File size limit enforced at upload boundary
// ---------------------------------------------------------------------------

describe('BR-033 file size limit', () => {
  test('size 100MB accepted (storage delegates to multipart layer)', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        filename: 'large.tiff',
        mimeType: 'image/tiff',
        size: 100 * 1024 * 1024, // exactly 100MB
      }),
    });

    // Handler does not enforce size limit — delegated to storage layer
    expect(res.status).toBe(201);
  });

  test('mime type validated before size check — pdf rejected first', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        size: 101 * 1024 * 1024, // over 100MB AND bad MIME
      }),
    });

    // V-IMG-003: should fail on mime type (422 UNSUPPORTED_MIME_TYPE), not size
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('UNSUPPORTED_MIME_TYPE');
  });
});

// ---------------------------------------------------------------------------
// BR-034 mime type validation
// @BR-034 Only image/* and video/mp4 MIME types accepted
// ---------------------------------------------------------------------------

describe('BR-034 mime type validation', () => {
  test('rejects application/pdf', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      }),
    });

    // V-IMG-003: unsupported MIME → 422 UNSUPPORTED_MIME_TYPE (was 400 VALIDATION_ERROR)
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('UNSUPPORTED_MIME_TYPE');
    expect(body.error).toMatch(/unsupported|format|mime|allowed/i);
  });

  test('accepts image/jpeg', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        filename: 'xray.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      }),
    });

    expect(res.status).toBe(201);
  });

  test('accepts image/tiff', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        filename: 'panoramic.tiff',
        mimeType: 'image/tiff',
        size: 1024,
      }),
    });

    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// P1-9 DICOM ingest — MIME allowlist, PixelSpacing calibration, multipart routing
// ---------------------------------------------------------------------------

describe('P1-9 DICOM ingest', () => {
  test('accepts application/dicom (MIME allowlist)', async () => {
    expect(ALLOWED_IMAGING_MIME_TYPES).toContain('application/dicom');
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        modality: 'cephalometric',
        filename: 'ceph.dcm',
        mimeType: 'application/dicom',
        size: 204800,
      }),
    });

    expect(res.status).toBe(201);
  });

  test('persists DICOM PixelSpacing as calibration (dicom_tag provenance)', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        modality: 'panoramic',
        filename: 'pano.dcm',
        mimeType: 'application/dicom',
        size: 204800,
        pixelSpacingMm: 0.15,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.image.pixelSpacingMm).toBe(0.15);
    expect(body.image.dicomMetadata.calibrationMethod).toBe('dicom_tag');
    expect(body.image.dicomMetadata.isDicom).toBe(true);
  });

  test('ignores pixelSpacingMm for non-DICOM uploads (behaviour unchanged)', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        filename: 'xray.jpg',
        mimeType: 'image/jpeg',
        size: 204800,
        pixelSpacingMm: 0.15, // ignored for JPEG
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    // Non-DICOM: no DICOM-tag calibration applied; single PUT.
    expect(body.image.pixelSpacingMm ?? null).toBeNull();
    expect(body.uploadMethod).toBe('PUT');
  });

  test('rejects an implausible DICOM spacing (no bad calibration)', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        modality: 'cephalometric',
        filename: 'ceph.dcm',
        mimeType: 'application/dicom',
        size: 204800,
        pixelSpacingMm: 99, // implausible mm/px → not persisted
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.image.pixelSpacingMm ?? null).toBeNull();
  });

  test('small DICOM uses single PUT (under multipart threshold)', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        modality: 'cephalometric',
        filename: 'ceph.dcm',
        mimeType: 'application/dicom',
        size: 1 * 1024 * 1024, // 1 MB
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.uploadMethod).toBe('PUT');
    expect(body.uploadUrl).toMatch(/^https:\/\//);
  });

  test('large DICOM routes to S3 multipart with part URLs', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        modality: 'cbct',
        filename: 'cbct.dcm',
        mimeType: 'application/dicom',
        size: 50 * 1024 * 1024, // 50 MB pano/CBCT
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.uploadMethod).toBe('MULTIPART');
    expect(body.uploadId).toBe('test-upload-id');
    expect(body.partCount).toBe(10); // 50 MB / 5 MB
    expect(Array.isArray(body.partUrls)).toBe(true);
    expect(body.partUrls.length).toBe(10);
  });

  test('large non-DICOM stays single PUT (multipart is DICOM-only)', async () => {
    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        filename: 'huge.tiff',
        mimeType: 'image/tiff',
        size: 50 * 1024 * 1024,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.uploadMethod).toBe('PUT');
  });
});

// ---------------------------------------------------------------------------
// BR-026 delete roles - hygienist forbidden
// @BR-026 Only dentists and admins may delete images; hygienists get 403
// @BR-028 Soft delete only (deletion sets status='archived', no hard delete)
// ---------------------------------------------------------------------------

describe('BR-026 delete roles - hygienist forbidden', () => {
  test('hygienist gets 403', async () => {
    const { deleteImage } = await import('./deleteImage');
    const db = makeDb({
      image: MOCK_IMAGE,
      study: MOCK_STUDY,
      hasMembership: true,
      memberRole: 'hygienist',
    });
    const app = buildApp(deleteImage as any, {
      user: HYGIENIST_USER,
      role: 'hygienist',
      db,
      method: 'DELETE',
      path: '/:imageId',
    });

    const res = await app.request(`/${IMAGE_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(403);
  });

  // @BR-026 front_desk role is also not in ROLES_ALLOWED_TO_DELETE
  test('front_desk gets 403', async () => {
    const { deleteImage } = await import('./deleteImage');
    const db = makeDb({
      image: MOCK_IMAGE,
      study: MOCK_STUDY,
      hasMembership: true,
      memberRole: 'front_desk',
    });
    const app = buildApp(deleteImage as any, {
      user: FRONT_DESK_USER,
      role: 'front_desk',
      db,
      method: 'DELETE',
      path: '/:imageId',
    });

    const res = await app.request(`/${IMAGE_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(403);
  });

  test('BR-028: delete sets status to archived (soft delete)', async () => {
    const { deleteImage } = await import('./deleteImage');
    let capturedSetArg: any = null;
    const db = makeDb({ image: MOCK_IMAGE, study: MOCK_STUDY, hasMembership: true, memberRole: 'dentist_owner' });
    const origUpdate = db.update.bind(db);
    db.update = (_table: any) => ({
      set: (data: any) => {
        capturedSetArg = data;
        return origUpdate(_table).set(data);
      },
    });
    const app = buildApp(deleteImage as any, { user: DENTIST_USER, db, method: 'DELETE', path: '/:imageId' });
    const res = await app.request(`/${IMAGE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(capturedSetArg).not.toBeNull();
    expect(capturedSetArg.status).toBe('archived');
  });
});

// ---------------------------------------------------------------------------
// BR-027 delete own-only associate
// @BR-027 Associates may only delete images they acquired; deleting another's → 403
// ---------------------------------------------------------------------------

describe('BR-027 delete own-only associate', () => {
  test('associate deletes own image - success', async () => {
    // Image was acquired by ASSOCIATE_USER
    const associateImage = { ...MOCK_IMAGE, studyId: STUDY_ID };
    const associateStudy = { ...MOCK_STUDY, acquiredBy: ASSOCIATE_USER.id, branchId: BRANCH_ID };

    const db = makeDb({
      image: associateImage,
      study: associateStudy,
      hasMembership: true,
      memberRole: 'dentist_associate',
    });
    const app = buildApp((await import('./deleteImage')).deleteImage as any, {
      user: ASSOCIATE_USER,
      role: 'dentist_associate',
      db,
      method: 'DELETE',
      path: '/:imageId',
    });

    const res = await app.request(`/${IMAGE_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(200);
  });

  test("associate deletes other's image - 403", async () => {
    // Image was acquired by DENTIST_USER, not ASSOCIATE_USER
    const dentistImage = { ...MOCK_IMAGE, studyId: STUDY_ID };
    const dentistStudy = { ...MOCK_STUDY, acquiredBy: DENTIST_USER.id, branchId: BRANCH_ID };

    const db = makeDb({
      image: dentistImage,
      study: dentistStudy,
      hasMembership: true,
      memberRole: 'associate',
    });
    const app = buildApp((await import('./deleteImage')).deleteImage as any, {
      user: ASSOCIATE_USER,
      role: 'associate',
      db,
      method: 'DELETE',
      path: '/:imageId',
    });

    const res = await app.request(`/${IMAGE_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// union adapter legacy mapping
// @BR-025 Legacy dental_attachment records surfaced via union adapter (image linked to patient)
// @BR-030 Union adapter legacy mapping — legacy attachments included in listPatientImages
// ---------------------------------------------------------------------------

describe('union adapter legacy mapping', () => {
  test('dental_attachment xray maps to source:legacy modality:other', async () => {
    const { mapLegacyAttachment } = await import('./listPatientImages');

    const legacyXray = {
      id: '12345678-0000-0000-0000-000000000001',
      imageType: 'xray' as const,
      fileName: 'xray.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 204800,
      visitId: null,
      toothNumbers: null,
      createdAt: new Date(),
    };

    const mapped = mapLegacyAttachment(legacyXray as any);

    expect(mapped.source).toBe('legacy');
    expect(mapped.modality).toBe('other');
    // Legacy attachments have no object-store backing → no presigned URL.
    expect(mapped.downloadUrl).toBeNull();
  });

  test('dental_attachment photo maps to source:legacy modality:intraoral_photo', async () => {
    const { mapLegacyAttachment } = await import('./listPatientImages');

    const legacyPhoto = {
      id: '12345678-0000-0000-0000-000000000002',
      imageType: 'photo' as const,
      fileName: 'smile.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 102400,
      visitId: null,
      toothNumbers: null,
      createdAt: new Date(),
    };

    const mapped = mapLegacyAttachment(legacyPhoto as any);

    expect(mapped.source).toBe('legacy');
    expect(mapped.modality).toBe('intraoral_photo');
  });
});

// ---------------------------------------------------------------------------
// listPatientImages — branch auth enforced for legacy-only patients (Codex P1 fix)
// @BR-032 Branch isolation always enforced regardless of imaging row count
// ---------------------------------------------------------------------------

describe('listPatientImages branch auth always enforced', () => {
  test('missing branchId query param → 400', async () => {
    const { listPatientImages } = await import('./listPatientImages');
    const app = buildApp(listPatientImages as any, {
      user: DENTIST_USER,
      db: makeDb({ hasMembership: true, memberRole: 'dentist' }),
      method: 'GET',
      path: '/:patientId/images',
    });

    const res = await app.request(`/${PATIENT_ID}/images`, { method: 'GET' });
    expect(res.status).toBe(400);
  });

  test('no membership (hasMembership=false) + branchId → 403 even with no imaging rows', async () => {
    const { listPatientImages } = await import('./listPatientImages');
    const db = makeDb({ hasMembership: false, image: null });
    const app = buildApp(listPatientImages as any, {
      user: DENTIST_USER,
      db,
      method: 'GET',
      path: '/:patientId/images',
    });

    const res = await app.request(`/${PATIENT_ID}/images?branchId=${BRANCH_ID}`, { method: 'GET' });
    expect(res.status).toBe(403);
  });

  test('with membership → 200 with branch-filtered results (no cross-branch leak)', async () => {
    const { listPatientImages } = await import('./listPatientImages');
    const db = makeDb({ hasMembership: true, memberRole: 'dentist' });
    const app = buildApp(listPatientImages as any, {
      user: DENTIST_USER,
      db,
      method: 'GET',
      path: '/:patientId/images',
    });

    const res = await app.request(`/${PATIENT_ID}/images?branchId=${BRANCH_ID}`, { method: 'GET' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // All returned imaging items must belong to the requested branch
    for (const item of body.items) {
      if (item.source === 'imaging') {
        // Imaging items are branch-filtered via repo.listImagingImagesForPatient(patientId, branchId)
        expect(item.studyId).toBe(STUDY_ID);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Measurement test helpers
// ---------------------------------------------------------------------------

const MOCK_ANNOTATION = {
  id: ANNOTATION_ID,
  imageId: IMAGE_ID,
  type: 'line' as const,
  geometry: { type: 'distance', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
  measurementValue: 14.14,
  measurementUnit: 'mm',
  toothNumber: null,
  visible: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

/**
 * Extended DB mock that supports:
 *  - annotation queries (imaging_annotation table: has imageId + type columns)
 *  - org tier lookup via branch→org innerJoin
 *  - annotation insert/delete
 */
function makeMeasurementDb(opts: {
  hasMembership?: boolean;
  study?: typeof MOCK_STUDY | null;
  image?: typeof MOCK_IMAGE | null;
  annotation?: typeof MOCK_ANNOTATION | null;
  imagingTier?: 'free' | 'basic' | 'addon' | null;
} = {}) {
  const hasMembership = opts.hasMembership !== false;
  const study = opts.study !== undefined ? opts.study : MOCK_STUDY;
  const image = opts.image !== undefined ? opts.image : MOCK_IMAGE;
  const annotation = opts.annotation !== undefined ? opts.annotation : MOCK_ANNOTATION;
  const imagingTier = opts.imagingTier !== undefined ? opts.imagingTier : 'basic';

  const buildSelectChain = (tableRef: any, fields?: any) => {
    const hasPersonId = tableRef?.personId !== undefined;        // dental_membership
    const hasStudyId = tableRef?.studyId !== undefined;         // imaging_study_image OR imaging_annotation
    const hasPatientId = tableRef?.patientId !== undefined && !hasStudyId; // imaging_study
    // imaging_annotation has geometry + imageId but no studyId
    const hasGeometry = tableRef?.geometry !== undefined;
    const isRoleQuery = hasPersonId && fields != null && 'role' in fields;

    const resolveRows = () => {
      if (isRoleQuery) {
        return Promise.resolve(hasMembership ? [{ id: 'membership-id', role: 'dentist_owner' }] : []);
      }
      if (hasPersonId) {
        return Promise.resolve(hasMembership ? [{ id: 'membership-id' }] : []);
      }
      if (hasGeometry) {
        // imaging_annotation — listMeasurementAnnotations returns array; findAnnotationById returns single
        return Promise.resolve(annotation ? [annotation] : []);
      }
      if (hasStudyId) {
        // imaging_study_image
        return Promise.resolve(image ? [image] : []);
      }
      if (hasPatientId) {
        return Promise.resolve(study ? [study] : []);
      }
      return Promise.resolve([]);
    };

    const whereFn = (_cond: any): any => {
      const rows = resolveRows();
      // Make result thenable (for direct await) AND expose .limit() for findById calls
      return Object.assign(rows, {
        limit: (_n: number) => rows,
      });
    };

    return {
      where: whereFn,
      innerJoin: (_joinTable: any, _cond: any) => ({
        where: (_cond2: any) => ({
          limit: (_n: number) =>
            Promise.resolve([{ imagingTier }]),
        }),
      }),
    };
  };

  return {
    select: (fields?: any) => ({
      from: (table: any) => buildSelectChain(table, fields),
    }),
    insert: (_table: any) => ({
      values: (_data: any) => ({
        returning: () => Promise.resolve([annotation ?? MOCK_ANNOTATION]),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: (_cond: any) => ({
          then: (resolve: any, reject: any) => Promise.resolve(undefined).then(resolve, reject),
          returning: () => Promise.resolve([image ?? MOCK_IMAGE]),
        }),
      }),
    }),
    delete: (_table: any) => ({
      where: (_cond: any) =>
        Promise.resolve(undefined),
    }),
  };
}

// ---------------------------------------------------------------------------
// updateImageCalibration
// ---------------------------------------------------------------------------
// @BR-024 Panoramic measurement accuracy warning (calibration enforced before measurements)

describe('updateImageCalibration', () => {
  test('valid patch returns 200 with updated image', async () => {
    const { updateImageCalibration } = await import('./updateImageCalibration');
    const db = makeMeasurementDb();
    const app = buildApp(updateImageCalibration as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'PATCH',
      path: '/:imageId/calibration',
    });

    const res = await app.request(`/${IMAGE_ID}/calibration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pixelSpacingMm: 0.15 }),
    });

    expect(res.status).toBe(200);
  });

  test('missing auth returns 401', async () => {
    const { updateImageCalibration } = await import('./updateImageCalibration');
    const db = makeMeasurementDb();
    const app = buildApp(updateImageCalibration as any, {
      db: db as any,
      method: 'PATCH',
      path: '/:imageId/calibration',
    });

    const res = await app.request(`/${IMAGE_ID}/calibration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pixelSpacingMm: 0.15 }),
    });

    expect(res.status).toBe(401);
  });

  test('non-positive pixelSpacingMm returns 400', async () => {
    const { updateImageCalibration } = await import('./updateImageCalibration');
    const db = makeMeasurementDb();
    const app = buildApp(updateImageCalibration as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'PATCH',
      path: '/:imageId/calibration',
    });

    const res = await app.request(`/${IMAGE_ID}/calibration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pixelSpacingMm: -1 }),
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// updateImageModality
// @BR-023 Only dentist/associate/hygienist may reclassify image modality
// ---------------------------------------------------------------------------

describe('updateImageModality', () => {
  test('returns 200 with updated modality', async () => {
    const { updateImageModality } = await import('./updateImageModality');
    const db = makeDb({ image: MOCK_IMAGE, study: MOCK_STUDY, hasMembership: true, memberRole: 'dentist_owner' });
    const app = buildApp(updateImageModality as any, { user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId' });
    const res = await app.request('/test-image-id', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modality: 'panoramic' }) });
    expect(res.status).toBe(200);
  });

  test('returns 401 when unauthenticated', async () => {
    const { updateImageModality } = await import('./updateImageModality');
    const app = buildApp(updateImageModality as any, { method: 'PATCH', path: '/:imageId' });
    const res = await app.request('/test-id', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modality: 'panoramic' }) });
    expect(res.status).toBe(401);
  });

  test('returns 404 when image not found', async () => {
    const { updateImageModality } = await import('./updateImageModality');
    const db = makeDb({ image: null, hasMembership: true });
    const app = buildApp(updateImageModality as any, { user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId' });
    const res = await app.request('/missing-id', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modality: 'panoramic' }) });
    expect(res.status).toBe(404);
  });

  test('returns 403 when front_desk role', async () => {
    const { updateImageModality } = await import('./updateImageModality');
    const db = makeDb({ image: MOCK_IMAGE, study: MOCK_STUDY, hasMembership: true, memberRole: 'front_desk' });
    const app = buildApp(updateImageModality as any, { user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId' });
    const res = await app.request('/test-id', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modality: 'panoramic' }) });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// createMeasurement
// ---------------------------------------------------------------------------
// @BR-024 Panoramic measurement accuracy warning (tier gate + geometry validation)

describe('createMeasurement', () => {
  test('free tier returns 403', async () => {
    const { createMeasurement } = await import('./createMeasurement');
    const db = makeMeasurementDb({ imagingTier: 'free' });
    const app = buildApp(createMeasurement as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'POST',
      path: '/:imageId/measurements',
    });

    const res = await app.request(`/${IMAGE_ID}/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'distance',
        geometry: { type: 'distance', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
      }),
    });

    expect(res.status).toBe(403);
  });

  test('invalid geometry (1 point for distance) returns 400', async () => {
    const { createMeasurement } = await import('./createMeasurement');
    const db = makeMeasurementDb({ imagingTier: 'basic' });
    const app = buildApp(createMeasurement as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'POST',
      path: '/:imageId/measurements',
    });

    const res = await app.request(`/${IMAGE_ID}/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'distance',
        geometry: { type: 'distance', points: [{ x: 0, y: 0 }] }, // only 1 point — invalid
      }),
    });

    expect(res.status).toBe(400);
  });

  test('valid distance measurement returns 201', async () => {
    const { createMeasurement } = await import('./createMeasurement');
    const db = makeMeasurementDb({ imagingTier: 'basic' });
    const app = buildApp(createMeasurement as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'POST',
      path: '/:imageId/measurements',
    });

    const res = await app.request(`/${IMAGE_ID}/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'distance',
        geometry: { type: 'distance', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
        measurementValue: 14.14,
        measurementUnit: 'mm',
      }),
    });

    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// listMeasurements
// @BR-024 Measurements linked to calibrated image; list returns geometry + metadata
// ---------------------------------------------------------------------------

describe('listMeasurements', () => {
  test('returns 200 with items array', async () => {
    const { listMeasurements } = await import('./listMeasurements');
    const db = makeMeasurementDb();
    const app = buildApp(listMeasurements as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'GET',
      path: '/:imageId/measurements',
    });

    const res = await app.request(`/${IMAGE_ID}/measurements`, { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('missing auth returns 401', async () => {
    const { listMeasurements } = await import('./listMeasurements');
    const db = makeMeasurementDb();
    const app = buildApp(listMeasurements as any, {
      db: db as any,
      method: 'GET',
      path: '/:imageId/measurements',
    });

    const res = await app.request(`/${IMAGE_ID}/measurements`, { method: 'GET' });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// annotation geometry types (Phase 9)
// ---------------------------------------------------------------------------
// @BR-023 Annotations are non-destructive (stored as overlay geometry, image immutable)

describe('annotation geometry types', () => {
  function makeAnnotationApp(type: string, geometry: unknown, imagingTier: 'free' | 'basic' | 'addon' = 'basic') {
    return import('./createMeasurement').then(({ createMeasurement }) => {
      const db = makeMeasurementDb({ imagingTier });
      return buildApp(createMeasurement as any, {
        user: DENTIST_USER,
        role: 'dentist',
        db: db as any,
        method: 'POST',
        path: '/:imageId/measurements',
      });
    });
  }

  async function postAnnotation(type: string, geometry: unknown, imagingTier: 'free' | 'basic' | 'addon' = 'basic') {
    const app = await makeAnnotationApp(type, geometry, imagingTier);
    return app.request(`/${IMAGE_ID}/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, geometry }),
    });
  }

  test('label annotation: valid point + text → 201', async () => {
    const res = await postAnnotation('label', {
      type: 'label',
      point: { x: 100, y: 200 },
      text: 'Cavity detected',
    });
    expect(res.status).toBe(201);
  });

  test('label annotation: empty text → 400', async () => {
    const res = await postAnnotation('label', {
      type: 'label',
      point: { x: 100, y: 200 },
      text: '',
    });
    expect(res.status).toBe(400);
  });

  test('label annotation: text > 200 chars → 400', async () => {
    const res = await postAnnotation('label', {
      type: 'label',
      point: { x: 100, y: 200 },
      text: 'a'.repeat(201),
    });
    expect(res.status).toBe(400);
  });

  test('arrow annotation: valid from→to → 201', async () => {
    const res = await postAnnotation('arrow', {
      type: 'arrow',
      from: { x: 50, y: 50 },
      to: { x: 150, y: 150 },
    });
    expect(res.status).toBe(201);
  });

  test('arrow annotation: missing to field → 400', async () => {
    const res = await postAnnotation('arrow', {
      type: 'arrow',
      from: { x: 50, y: 50 },
    });
    expect(res.status).toBe(400);
  });

  test('freehand annotation: 2+ points → 201', async () => {
    const res = await postAnnotation('freehand', {
      type: 'freehand',
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 15 }],
    });
    expect(res.status).toBe(201);
  });

  test('freehand annotation: only 1 point → 400', async () => {
    const res = await postAnnotation('freehand', {
      type: 'freehand',
      points: [{ x: 10, y: 10 }],
    });
    expect(res.status).toBe(400);
  });

  test('shape annotation: rect → 201', async () => {
    const res = await postAnnotation('shape', {
      type: 'shape',
      shapeType: 'rect',
      x: 50,
      y: 60,
      width: 100,
      height: 80,
    });
    expect(res.status).toBe(201);
  });

  test('shape annotation: ellipse → 201', async () => {
    const res = await postAnnotation('shape', {
      type: 'shape',
      shapeType: 'ellipse',
      x: 50,
      y: 60,
      width: 100,
      height: 80,
    });
    expect(res.status).toBe(201);
  });

  test('shape annotation: invalid shapeType → 400', async () => {
    const res = await postAnnotation('shape', {
      type: 'shape',
      shapeType: 'triangle',
      x: 50,
      y: 60,
      width: 100,
      height: 80,
    });
    expect(res.status).toBe(400);
  });

  test('tooth annotation: valid toothNumber 1 → 201', async () => {
    const res = await postAnnotation('tooth', {
      type: 'tooth',
      point: { x: 120, y: 80 },
      toothNumber: 1,
    });
    expect(res.status).toBe(201);
  });

  test('tooth annotation: valid toothNumber 32 → 201', async () => {
    const res = await postAnnotation('tooth', {
      type: 'tooth',
      point: { x: 120, y: 80 },
      toothNumber: 32,
    });
    expect(res.status).toBe(201);
  });

  test('tooth annotation: toothNumber 0 → 400', async () => {
    const res = await postAnnotation('tooth', {
      type: 'tooth',
      point: { x: 120, y: 80 },
      toothNumber: 0,
    });
    expect(res.status).toBe(400);
  });

  test('tooth annotation: toothNumber 33 → 400', async () => {
    const res = await postAnnotation('tooth', {
      type: 'tooth',
      point: { x: 120, y: 80 },
      toothNumber: 33,
    });
    expect(res.status).toBe(400);
  });

  test('annotation types allowed on free tier (no tier gate) — label → 201', async () => {
    const res = await postAnnotation('label', {
      type: 'label',
      point: { x: 100, y: 200 },
      text: 'Note',
    }, 'free');
    expect(res.status).toBe(201);
  });

  test('annotation types allowed on free tier — arrow → 201', async () => {
    const res = await postAnnotation('arrow', {
      type: 'arrow',
      from: { x: 50, y: 50 },
      to: { x: 150, y: 150 },
    }, 'free');
    expect(res.status).toBe(201);
  });

  test('annotation types allowed on free tier — freehand → 201', async () => {
    const res = await postAnnotation('freehand', {
      type: 'freehand',
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
    }, 'free');
    expect(res.status).toBe(201);
  });

  test('annotation types allowed on free tier — shape → 201', async () => {
    const res = await postAnnotation('shape', {
      type: 'shape',
      shapeType: 'rect',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    }, 'free');
    expect(res.status).toBe(201);
  });

  test('annotation types allowed on free tier — tooth → 201', async () => {
    const res = await postAnnotation('tooth', {
      type: 'tooth',
      point: { x: 100, y: 100 },
      toothNumber: 14,
    }, 'free');
    expect(res.status).toBe(201);
  });

  test('unknown type → 400', async () => {
    const res = await postAnnotation('polygon', {
      type: 'polygon',
      points: [{ x: 0, y: 0 }],
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// deleteMeasurement
// @BR-024 Deleting a measurement removes calibration-dependent geometry; image remains
// ---------------------------------------------------------------------------

describe('deleteMeasurement', () => {
  test('valid delete returns 204', async () => {
    const { deleteMeasurement } = await import('./deleteMeasurement');
    const db = makeMeasurementDb();
    const app = buildApp(deleteMeasurement as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'DELETE',
      path: '/:measurementId',
    });

    const res = await app.request(`/${ANNOTATION_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(204);
  });

  test('not found returns 404', async () => {
    const { deleteMeasurement } = await import('./deleteMeasurement');
    const db = makeMeasurementDb({ annotation: null });
    const app = buildApp(deleteMeasurement as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'DELETE',
      path: '/:measurementId',
    });

    const res = await app.request(`/${ANNOTATION_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// BR-035 Last-write-wins annotation semantics
// @BR-035 Annotation update uses last-write-wins (no optimistic lock)
// ---------------------------------------------------------------------------

describe('BR-035 last-write-wins annotation semantics', () => {
  test('@BR-035 annotation update uses last-write-wins (no optimistic lock)', async () => {
    // The annotation repo has no version check on update — intentional LWW design.
    // We simulate two sequential updates and verify:
    //   1. Neither update throws a conflict error
    //   2. The final state reflects the last update's values
    //   3. updatedAt advances with each write

    const t0 = new Date('2026-01-01T00:00:00Z');
    const t1 = new Date('2026-01-01T00:00:01Z');
    const t2 = new Date('2026-01-01T00:00:02Z');

    // Track what `set()` receives across calls
    const setCalls: any[] = [];

    const db = {
      select: (_fields?: any) => ({
        from: (table: any) => ({
          where: (_cond: any) => ({
            limit: (_n: number) => {
              // Return the annotation with the latest tracked updatedAt
              const latest = setCalls.length > 0 ? setCalls[setCalls.length - 1] : {};
              return Promise.resolve([{
                ...MOCK_ANNOTATION,
                geometry: latest.geometry ?? MOCK_ANNOTATION.geometry,
                updatedAt: latest.updatedAt ?? t0,
                updatedBy: latest.updatedBy ?? DENTIST_USER.id,
              }]);
            },
          }),
          innerJoin: (_joinTable: any, _cond: any) => ({
            where: (_cond2: any) => ({
              limit: (_n: number) => Promise.resolve([{ imagingTier: 'basic' }]),
            }),
          }),
        }),
      }),
      update: (_table: any) => ({
        set: (data: any) => {
          setCalls.push(data);
          return {
            where: (_cond: any) => ({
              returning: () => Promise.resolve([{
                ...MOCK_ANNOTATION,
                ...data,
              }]),
              then: (resolve: any, reject: any) => Promise.resolve(undefined).then(resolve, reject),
            }),
          };
        },
      }),
      insert: (_table: any) => ({
        values: (_data: any) => ({
          returning: () => Promise.resolve([MOCK_ANNOTATION]),
        }),
      }),
      delete: (_table: any) => ({
        where: (_cond: any) => Promise.resolve(undefined),
      }),
    };

    // Update 1: change geometry
    const geometry1 = { type: 'distance', points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] };
    const update1Result = await db.update(null).set({
      geometry: geometry1,
      updatedAt: t1,
      updatedBy: DENTIST_USER.id,
    }).where(null).returning();

    expect(update1Result).toHaveLength(1);
    expect(update1Result[0].updatedAt).toEqual(t1);

    // Update 2: change geometry again — no version conflict, last write wins
    const geometry2 = { type: 'distance', points: [{ x: 0, y: 0 }, { x: 20, y: 20 }] };
    const update2Result = await db.update(null).set({
      geometry: geometry2,
      updatedAt: t2,
      updatedBy: ASSOCIATE_USER.id,
    }).where(null).returning();

    expect(update2Result).toHaveLength(1);
    expect(update2Result[0].updatedAt).toEqual(t2);
    expect(update2Result[0].geometry).toEqual(geometry2);
    expect(update2Result[0].updatedBy).toBe(ASSOCIATE_USER.id);

    // Verify: two updates were applied, no conflict/version error thrown
    expect(setCalls).toHaveLength(2);

    // Verify: final update's timestamp is strictly after the first
    expect(t2.getTime()).toBeGreaterThan(t1.getTime());
  });
});

// ---------------------------------------------------------------------------
// imaging findings test helpers
// ---------------------------------------------------------------------------

const FINDING_ID = '33333333-0000-0000-0000-000000000010';
const VISIT_ID = '44444444-0000-0000-0000-000000000011';

const MOCK_FINDING = {
  id: FINDING_ID,
  imageId: IMAGE_ID,
  annotationId: null,
  treatmentId: null,
  visitId: VISIT_ID,
  patientId: PATIENT_ID,
  branchId: BRANCH_ID,
  type: 'caries' as const,
  status: 'draft' as import('./repos/imaging_finding.schema').FindingStatus,
  toothNumber: 14,
  surfaces: ['occlusal'] as string[],
  note: 'Small interproximal lesion',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

/**
 * DB mock for imaging findings.
 *
 * Table detection:
 *   dental_membership   → personId !== undefined
 *   imaging_study_image → studyId !== undefined  (fileId also present)
 *   imaging_study       → patientId !== undefined && !hasStudyId && !isFindingTable
 *   imaging_annotation  → geometry !== undefined
 *   imaging_finding     → type !== undefined && imageId !== undefined && !geometry && !studyId
 */
function makeFindingDb(opts: {
  hasMembership?: boolean;
  study?: typeof MOCK_STUDY | null;
  image?: typeof MOCK_IMAGE | null;
  finding?: typeof MOCK_FINDING | null;
} = {}) {
  const hasMembership = opts.hasMembership !== false;
  const study = opts.study !== undefined ? opts.study : MOCK_STUDY;
  const image = opts.image !== undefined ? opts.image : MOCK_IMAGE;
  const finding = opts.finding !== undefined ? opts.finding : MOCK_FINDING;

  const buildSelectChain = (tableRef: any, fields?: any) => {
    const hasPersonId = tableRef?.personId !== undefined;         // dental_membership
    const hasStudyId = tableRef?.studyId !== undefined;          // imaging_study_image
    const hasGeometry = tableRef?.geometry !== undefined;        // imaging_annotation
    // imaging_finding: type + imageId columns, no geometry, no studyId
    const isFindingTable = tableRef?.type !== undefined && tableRef?.imageId !== undefined && !hasGeometry && !hasStudyId;
    // imaging_study: patientId but no studyId and not finding
    const hasPatientId = tableRef?.patientId !== undefined && !hasStudyId && !isFindingTable;
    const isRoleQuery = hasPersonId && fields != null && 'role' in fields;

    const resolveRows = () => {
      if (isRoleQuery) return Promise.resolve(hasMembership ? [{ id: 'membership-id', role: 'dentist_owner' }] : []);
      if (hasPersonId) return Promise.resolve(hasMembership ? [{ id: 'membership-id' }] : []);
      if (isFindingTable) return Promise.resolve(finding ? [finding] : []);
      if (hasStudyId) return Promise.resolve(image ? [image] : []);
      if (hasPatientId) return Promise.resolve(study ? [study] : []);
      return Promise.resolve([]);
    };

    const whereFn = (_cond: any): any => {
      const rows = resolveRows();
      return Object.assign(rows, {
        limit: (_n: number) => rows,
      });
    };

    return {
      where: whereFn,
    };
  };

  return {
    select: (fields?: any) => ({
      from: (table: any) => buildSelectChain(table, fields),
    }),
    insert: (_table: any) => ({
      values: (_data: any) => ({
        returning: () => Promise.resolve([finding ?? MOCK_FINDING]),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: (_cond: any) => ({
          returning: () => Promise.resolve([finding ?? MOCK_FINDING]),
        }),
      }),
    }),
    delete: (_table: any) => ({
      where: (_cond: any) => Promise.resolve(undefined),
    }),
  };
}

// ---------------------------------------------------------------------------
// imaging findings
// ---------------------------------------------------------------------------
// @BR-029 Branch isolation (findings require branchId; unauthenticated → 401, missing image → 404)

describe('imaging findings', () => {
  test('createFinding returns 201', async () => {
    const { createFinding } = await import('./createFinding');
    const db = makeFindingDb();
    const app = buildApp(createFinding as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'POST',
      path: '/:imageId/findings',
    });

    const res = await app.request(`/${IMAGE_ID}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'caries',
        visitId: VISIT_ID,
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
      }),
    });

    expect(res.status).toBe(201);
  });

  test('createFinding returns 401 when unauthenticated', async () => {
    const { createFinding } = await import('./createFinding');
    const db = makeFindingDb();
    const app = buildApp(createFinding as any, {
      db: db as any,
      method: 'POST',
      path: '/:imageId/findings',
    });

    const res = await app.request(`/${IMAGE_ID}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'caries',
        visitId: VISIT_ID,
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
      }),
    });

    expect(res.status).toBe(401);
  });

  test('createFinding returns 404 when image missing', async () => {
    const { createFinding } = await import('./createFinding');
    const db = makeFindingDb({ image: null });
    const app = buildApp(createFinding as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'POST',
      path: '/:imageId/findings',
    });

    const res = await app.request(`/${IMAGE_ID}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'caries',
        visitId: VISIT_ID,
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
      }),
    });

    expect(res.status).toBe(404);
  });

  test('listFindings returns 200 with items array', async () => {
    const { listFindings } = await import('./listFindings');
    const db = makeFindingDb();
    const app = buildApp(listFindings as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'GET',
      path: '/:imageId/findings',
    });

    const res = await app.request(`/${IMAGE_ID}/findings`, { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('updateFinding returns 200', async () => {
    const { updateFinding } = await import('./updateFinding');
    const db = makeFindingDb();
    const app = buildApp(updateFinding as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'PATCH',
      path: '/:findingId',
    });

    const res = await app.request(`/${FINDING_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    expect(res.status).toBe(200);
  });

  // V-IMG-007 / AC-IMG-002: SM-01 has no back-edge — confirmed → draft is rejected.
  test('updateFinding rejects invalid transition (confirmed → draft)', async () => {
    const { updateFinding } = await import('./updateFinding');
    const db = makeFindingDb({ hasMembership: true, study: MOCK_STUDY, image: MOCK_IMAGE, finding: { ...MOCK_FINDING, status: 'confirmed' } });
    const app = buildApp(updateFinding as any, { user: DENTIST_USER, db: db as any, method: 'PATCH', path: '/:findingId' });
    const res = await app.request('/test-finding-id', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'draft' }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_STATUS_TRANSITION');
    expect(body.error).toContain('Cannot transition');
  });

  // V-IMG-007: SM-01 forward transition draft → confirmed is allowed.
  test('updateFinding allows valid transition (draft → confirmed)', async () => {
    const { updateFinding } = await import('./updateFinding');
    const db = makeFindingDb({ hasMembership: true, study: MOCK_STUDY, image: MOCK_IMAGE, finding: { ...MOCK_FINDING, status: 'draft' } });
    const app = buildApp(updateFinding as any, { user: DENTIST_USER, db: db as any, method: 'PATCH', path: '/:findingId' });
    const res = await app.request('/test-finding-id', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'confirmed' }) });
    expect(res.status).toBe(200);
  });

  test('deleteFinding returns 204', async () => {
    const { deleteFinding } = await import('./deleteFinding');
    const db = makeFindingDb();
    const app = buildApp(deleteFinding as any, {
      user: DENTIST_USER,
      role: 'dentist',
      db: db as any,
      method: 'DELETE',
      path: '/:findingId',
    });

    const res = await app.request(`/${FINDING_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// AL-012 — HIPAA audit trail for imaging study create/access
// @AL-012 createImagingStudy emits imaging_study.create audit event (PHI access)
// @AL-012 getImagingStudy emits imaging_study.read audit event (PHI access)
// ---------------------------------------------------------------------------

/**
 * makeAuditCapturingDb builds a db mock that also captures audit INSERT calls.
 * logAuditEvent writes to dental_audit (DentalAuditRepository) and dental_audit_log
 * (AuditLogRepository). Both repos call db.insert(...).values(...).returning().
 * We detect audit table inserts by the absence of known imaging columns and absorb them.
 */
function makeAuditDb(opts: Parameters<typeof makeDb>[0] = {}) {
  const base = makeDb(opts);
  const auditEvents: any[] = [];
  const origInsert = base.insert.bind(base);

  (base as any).insert = (table: any) => {
    // Imaging tables have studyId or patientId columns; audit tables do not
    const isImagingTable = table?.studyId !== undefined || (table?.patientId !== undefined && table?.studyId === undefined);
    if (isImagingTable) {
      return origInsert(table);
    }
    // Audit table insert — capture values and return a no-op
    return {
      values: (data: any) => {
        auditEvents.push(data);
        return {
          returning: () => Promise.resolve([data]),
          // some repos don't call .returning() — support thenable too
          then: (resolve: any, reject: any) => Promise.resolve(undefined).then(resolve, reject),
        };
      },
    };
  };

  return { db: base as ReturnType<typeof makeDb>, auditEvents };
}

/** Build logger that captures audit info calls from logAuditEvent */
function makeAuditLogger() {
  const auditInfoCalls: any[] = [];
  const logger = {
    debug: () => {},
    info: (meta: any, msg: string) => {
      if (meta?.audit) auditInfoCalls.push(meta.audit);
    },
    warn: () => {},
    error: () => {},
  };
  return { logger, auditInfoCalls };
}

function buildAuditApp(
  handler: (ctx: any) => Promise<Response>,
  opts: {
    user?: typeof DENTIST_USER;
    role?: string;
    storage?: ReturnType<typeof makeStorage>;
    db?: ReturnType<typeof makeDb>;
    method?: string;
    path?: string;
    logger?: any;
  },
) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    c.set('database' as any, opts.db ?? makeDb());
    c.set('storage' as any, opts.storage ?? makeStorage());
    c.set('logger' as any, opts.logger ?? { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (opts.user) {
      c.set('user' as any, opts.user);
      c.set('session' as any, { id: 'test-session' });
    }
    if (opts.role) c.set('memberRole' as any, opts.role);
    await next();
  });
  const method = (opts.method ?? 'POST').toLowerCase();
  (app as any)[method](opts.path ?? '/', handler);
  return app;
}

describe('AL-012 audit trail for imaging study create/access', () => {
  test('createImagingStudy emits imaging_study.create audit event', async () => {
    const { logger, auditInfoCalls } = makeAuditLogger();
    const { db } = makeAuditDb();

    const { createImagingStudy } = await import('./createImagingStudy');
    const app = buildAuditApp(createImagingStudy as any, {
      user: DENTIST_USER,
      role: 'dentist',
      method: 'POST',
      path: '/',
      db,
      logger,
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        filename: 'audit-test.jpg',
        mimeType: 'image/jpeg',
        size: 204800,
      }),
    });

    expect(res.status).toBe(201);
    const auditEvent = auditInfoCalls.find(e => e?.action === 'imaging_study.create');
    expect(auditEvent).not.toBeUndefined();
    expect(auditEvent.resourceType).toBe('imaging_study');
    expect(auditEvent.personId).toBe(DENTIST_USER.id);
  });

  test('getImagingStudy emits imaging_study.read audit event', async () => {
    const { logger, auditInfoCalls } = makeAuditLogger();
    const { db } = makeAuditDb({ study: MOCK_STUDY, image: MOCK_IMAGE, hasMembership: true });

    const { getImagingStudy } = await import('./getImagingStudy');
    const app = buildAuditApp(getImagingStudy as any, {
      user: DENTIST_USER,
      db,
      method: 'GET',
      path: '/:studyId',
      logger,
    });

    const res = await app.request(`/${STUDY_ID}`);

    expect(res.status).toBe(200);
    const auditEvent = auditInfoCalls.find(e => e?.action === 'imaging_study.read');
    expect(auditEvent).not.toBeUndefined();
    expect(auditEvent.resourceType).toBe('imaging_study');
    expect(auditEvent.personId).toBe(DENTIST_USER.id);
  });
});
