/**
 * imaging-coverage.test.ts
 *
 * Coverage tests for the ImagingMgmt_*, ImagingFindingsMgmt_*, and
 * PatientImageMgmt_* wrapper handlers.  Every wrapper is a one-line
 * pass-through to the underlying impl; one happy-path call per wrapper
 * is sufficient to bring function coverage to 100% for each file.
 *
 * Also covers the mapLegacyAttachment path inside listPatientImages.ts
 * to push that file's function coverage to 100%.
 *
 * Mock strategy: identical to imaging.test.ts — fake Drizzle DB objects
 * detected by column-name duck-typing, no real DB or storage connections.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------

const DENTIST_USER = { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'dentist@clinic.com' };
const PATIENT_ID   = 'dddddddd-0000-0000-0000-000000000004';
const BRANCH_ID    = 'eeeeeeee-0000-0000-0000-000000000005';
const STUDY_ID     = 'ffffffff-0000-0000-0000-000000000006';
const IMAGE_ID     = '11111111-0000-0000-0000-000000000007';
const FINDING_ID   = '33333333-0000-0000-0000-000000000010';
const MEASURE_ID   = '55555555-0000-0000-0000-000000000020';
const ANNOTATION_ID = '22222222-0000-0000-0000-000000000008';

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

const MOCK_FINDING = {
  id: FINDING_ID,
  imageId: IMAGE_ID,
  annotationId: null,
  treatmentId: null,
  visitId: null,
  patientId: PATIENT_ID,
  branchId: BRANCH_ID,
  type: 'caries' as const,
  status: 'suspected' as const,
  toothNumber: 14,
  surfaces: ['occlusal'] as string[],
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

const MOCK_ANNOTATION = {
  id: ANNOTATION_ID,
  imageId: IMAGE_ID,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
  geometry: { type: 'point', x: 10, y: 20 },
  label: null,
  annotationType: 'measurement' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

const MOCK_MEASUREMENT = {
  id: MEASURE_ID,
  imageId: IMAGE_ID,
  annotationId: ANNOTATION_ID,
  branchId: BRANCH_ID,
  measurementType: 'linear' as const,
  valueMm: 5.2,
  label: null,
  calibrated: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

// ---------------------------------------------------------------------------
// DB mock factories
// ---------------------------------------------------------------------------

/**
 * Generic DB mock for ImagingMgmt handlers (study + image lookups).
 * Column duck-typing mirrors the pattern in imaging.test.ts.
 */
function makeDb(opts: {
  hasMembership?: boolean;
  memberRole?: string;
  study?: typeof MOCK_STUDY | null;
  image?: typeof MOCK_IMAGE | null;
} = {}) {
  const hasMembership = opts.hasMembership !== false;
  const memberRole    = opts.memberRole ?? 'dentist_owner';
  const study  = opts.study  !== undefined ? opts.study  : MOCK_STUDY;
  const image  = opts.image  !== undefined ? opts.image  : MOCK_IMAGE;

  const buildSelectChain = (tableRef: any, fields?: any) => {
    const hasPersonId  = tableRef?.personId  !== undefined; // dental_membership
    const hasStudyId   = tableRef?.studyId   !== undefined; // imaging_study_image
    const hasToothNum  = tableRef?.toothNumber !== undefined && !hasStudyId; // imagingStudyTeeth
    const hasPatientId = tableRef?.patientId !== undefined && !hasStudyId;   // imaging_study
    const isRoleQuery  = hasPersonId && fields && 'role' in fields;

    return {
      where: (_cond: any): any => {
        const resolve = (_n?: number) => {
          if (isRoleQuery)  return Promise.resolve(hasMembership ? [{ role: memberRole }] : []);
          if (hasPersonId)  return Promise.resolve(hasMembership ? [{ id: 'membership-id' }] : []);
          if (hasStudyId)   return Promise.resolve(image  ? [image]  : []);
          if (hasPatientId) return Promise.resolve(study  ? [study]  : []);
          if (hasToothNum)  return Promise.resolve([]);
          return Promise.resolve([]);
        };
        return Object.assign(resolve(), { limit: (n: number) => resolve(n) });
      },
      // listImagesByStudy awaits where() directly (no .limit())
      then: (res: any, rej: any) =>
        Promise.resolve(image ? [image] : []).then(res, rej),
    };
  };

  return {
    select: (fields?: any) => ({
      from: (table: any) => buildSelectChain(table, fields),
    }),
    insert: (table: any) => ({
      values: (_data: any) => ({
        returning: () =>
          table?.studyId !== undefined
            ? Promise.resolve([image ?? MOCK_IMAGE])
            : Promise.resolve([study ?? MOCK_STUDY]),
        then: (res: any, rej: any) => Promise.resolve(undefined).then(res, rej),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: (_cond: any) => ({
          then: (res: any, rej: any) => Promise.resolve(undefined).then(res, rej),
          returning: () => Promise.resolve([image ?? MOCK_IMAGE]),
        }),
      }),
    }),
  };
}

/**
 * DB mock for findings-related handlers.
 * Adds detection of the imaging_finding table.
 */
function makeFindingDb(opts: {
  hasMembership?: boolean;
  study?:   typeof MOCK_STUDY   | null;
  image?:   typeof MOCK_IMAGE   | null;
  finding?: typeof MOCK_FINDING | null;
} = {}) {
  const hasMembership = opts.hasMembership !== false;
  const study   = opts.study   !== undefined ? opts.study   : MOCK_STUDY;
  const image   = opts.image   !== undefined ? opts.image   : MOCK_IMAGE;
  const finding = opts.finding !== undefined ? opts.finding : MOCK_FINDING;

  const buildSelectChain = (tableRef: any, fields?: any) => {
    const hasPersonId    = tableRef?.personId  !== undefined;
    const hasStudyId     = tableRef?.studyId   !== undefined;
    const hasGeometry    = tableRef?.geometry  !== undefined;
    const isFindingTable = tableRef?.type !== undefined && tableRef?.imageId !== undefined && !hasGeometry && !hasStudyId;
    const hasPatientId   = tableRef?.patientId !== undefined && !hasStudyId && !isFindingTable;
    const isRoleQuery    = hasPersonId && fields != null && 'role' in fields;

    const resolveRows = () => {
      if (isRoleQuery)    return Promise.resolve(hasMembership ? [{ id: 'membership-id', role: 'dentist_owner' }] : []);
      if (hasPersonId)    return Promise.resolve(hasMembership ? [{ id: 'membership-id' }] : []);
      if (isFindingTable) return Promise.resolve(finding ? [finding] : []);
      if (hasStudyId)     return Promise.resolve(image   ? [image]   : []);
      if (hasPatientId)   return Promise.resolve(study   ? [study]   : []);
      return Promise.resolve([]);
    };

    const whereFn = (_cond: any): any => {
      const rows = resolveRows();
      return Object.assign(rows, { limit: (_n: number) => rows });
    };

    return { where: whereFn };
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

/**
 * DB mock for measurement handlers (annotation + measurement tables).
 */
function makeMeasurementDb(opts: {
  hasMembership?: boolean;
  study?:       typeof MOCK_STUDY      | null;
  image?:       typeof MOCK_IMAGE      | null;
  annotation?:  typeof MOCK_ANNOTATION | null;
  measurement?: typeof MOCK_MEASUREMENT | null;
} = {}) {
  const hasMembership = opts.hasMembership !== false;
  const study       = opts.study       !== undefined ? opts.study       : MOCK_STUDY;
  const image       = opts.image       !== undefined ? opts.image       : MOCK_IMAGE;
  const annotation  = opts.annotation  !== undefined ? opts.annotation  : MOCK_ANNOTATION;
  const measurement = opts.measurement !== undefined ? opts.measurement : MOCK_MEASUREMENT;

  const buildSelectChain = (tableRef: any, fields?: any) => {
    const hasPersonId     = tableRef?.personId  !== undefined;
    const hasStudyId      = tableRef?.studyId   !== undefined;
    const hasGeometry     = tableRef?.geometry  !== undefined;
    const hasMeasureType  = tableRef?.measurementType !== undefined;
    const hasPatientId    = tableRef?.patientId !== undefined && !hasStudyId && !hasGeometry && !hasMeasureType;
    const isRoleQuery     = hasPersonId && fields && 'role' in fields;

    const resolveRows = () => {
      if (isRoleQuery)    return Promise.resolve(hasMembership ? [{ role: 'dentist_owner' }] : []);
      if (hasPersonId)    return Promise.resolve(hasMembership ? [{ id: 'membership-id' }] : []);
      if (hasMeasureType) return Promise.resolve(measurement ? [measurement] : []);
      if (hasGeometry)    return Promise.resolve(annotation  ? [annotation]  : []);
      if (hasStudyId)     return Promise.resolve(image       ? [image]       : []);
      if (hasPatientId)   return Promise.resolve(study       ? [study]       : []);
      return Promise.resolve([]);
    };

    const whereFn = (_cond: any): any => {
      const rows = resolveRows();
      return Object.assign(rows, { limit: (_n: number) => rows });
    };

    return { where: whereFn };
  };

  return {
    select: (fields?: any) => ({
      from: (table: any) => buildSelectChain(table, fields),
    }),
    insert: (_table: any) => ({
      values: (_data: any) => ({
        returning: () => Promise.resolve([annotation ?? MOCK_ANNOTATION]),
        then: (res: any, rej: any) => Promise.resolve(undefined).then(res, rej),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: (_cond: any) => ({
          returning: () => Promise.resolve([image ?? MOCK_IMAGE]),
          then: (res: any, rej: any) => Promise.resolve(undefined).then(res, rej),
        }),
      }),
    }),
    delete: (_table: any) => ({
      where: (_cond: any) => Promise.resolve(undefined),
    }),
  };
}

/**
 * DB mock for listPatientImages — needs innerJoin support for legacy rows.
 */
function makeListPatientImagesDb(opts: { hasMembership?: boolean } = {}) {
  const hasMembership = opts.hasMembership !== false;

  return {
    select: (_fields?: any) => ({
      from: (_table: any) => ({
        where: (_cond: any) => ({
          // listImagingImagesForPatient returns imaging rows
          then: (res: any, rej: any) => Promise.resolve([]).then(res, rej),
        }),
        innerJoin: (_joinTable: any, _cond: any) => ({
          where: (_cond2: any) =>
            // legacy dental_attachment rows
            Promise.resolve([
              {
                id: 'legacy-1',
                patientId: PATIENT_ID,
                visitId: null,
                imageType: 'xray',
                fileName: 'panoramic.dcm',
                mimeType: 'image/jpeg',
                fileSizeBytes: 204800,
                toothNumbers: [11, 12],
                createdAt: new Date('2024-01-01'),
                deletedAt: null,
              },
            ]),
        }),
      }),
    }),
    // assertBranchAccess
    // uses select().from(dental_membership).where().limit()
    // We need to also handle that path — override per table
  };
}

/**
 * Full mock for listPatientImages: handles both assertBranchAccess membership
 * check AND the two data queries (imaging rows + legacy attachment innerJoin).
 */
function makeFullListPatientImagesDb(opts: { hasMembership?: boolean } = {}) {
  const hasMembership = opts.hasMembership !== false;

  return {
    select: (_fields?: any) => ({
      from: (tableRef: any) => {
        const hasPersonId  = tableRef?.personId !== undefined; // dental_membership

        if (hasPersonId) {
          // assertBranchAccess
          return {
            where: (_cond: any) => ({
              limit: (_n: number) =>
                Promise.resolve(hasMembership ? [{ id: 'membership-id' }] : []),
            }),
          };
        }

        // imaging rows (listImagingImagesForPatient)
        return {
          where: (_cond: any) => Promise.resolve([]),
          innerJoin: (_joinTable: any, _cond: any) => ({
            where: (_cond2: any) =>
              Promise.resolve([
                {
                  id: 'legacy-att-1',
                  patientId: PATIENT_ID,
                  visitId: null,
                  imageType: 'xray',
                  fileName: 'panoramic.jpg',
                  mimeType: 'image/jpeg',
                  fileSizeBytes: 102400,
                  toothNumbers: [14],
                  createdAt: new Date('2024-06-01'),
                  deletedAt: null,
                },
                {
                  id: 'legacy-att-2',
                  patientId: PATIENT_ID,
                  visitId: null,
                  imageType: 'photo',
                  fileName: 'photo.jpg',
                  mimeType: 'image/jpeg',
                  fileSizeBytes: 51200,
                  toothNumbers: null,     // exercises null-branch in mapLegacyAttachment
                  createdAt: new Date('2024-05-01'),
                  deletedAt: null,
                },
                {
                  id: 'legacy-att-3',
                  patientId: PATIENT_ID,
                  visitId: null,
                  imageType: 'scan',
                  fileName: 'scan.dcm',
                  mimeType: 'application/dicom',
                  fileSizeBytes: 512000,
                  toothNumbers: [],       // exercises empty-array branch
                  createdAt: new Date('2024-04-01'),
                  deletedAt: null,
                },
              ]),
          }),
        };
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

type HandlerFn = (ctx: any) => Promise<Response>;

function buildApp(
  handler: HandlerFn,
  opts: {
    user?:    { id: string; email: string };
    role?:    string;
    db?:      any;
    storage?: any;
    method?:  string;
    path?:    string;
  } = {},
) {
  const { user, role, db, storage, method = 'GET', path = '/' } = opts;

  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    c.set('database' as any, db ?? makeDb());
    c.set('storage'  as any, storage ?? {});
    c.set('logger'   as any, { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      c.set('user'    as any, user);
      c.set('session' as any, { id: 'test-session' });
    }
    if (role) c.set('memberRole' as any, role);
    await next();
  });

  const m = method.toLowerCase();
  (app as any)[m](path, handler);
  return app;
}

// ---------------------------------------------------------------------------
// ImagingMgmt_createImagingStudy
// ---------------------------------------------------------------------------

describe('ImagingMgmt_createImagingStudy wrapper', () => {
  test('delegates to createImagingStudy — returns 201', async () => {
    const { ImagingMgmt_createImagingStudy } = await import('./ImagingMgmt_createImagingStudy');
    const db = makeDb();
    const storage = {
      generateUploadUrl: async (_fileId: string, _mime: string) =>
        'https://storage.example.com/upload',
    };
    const app = buildApp(ImagingMgmt_createImagingStudy as any, {
      user: DENTIST_USER,
      db,
      storage,
      method: 'POST',
      path: '/:patientId/studies',
    });
    const res = await app.request(`/${PATIENT_ID}/studies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modality: 'other',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1024,
        branchId: BRANCH_ID,
      }),
    });
    expect(res.status).toBe(201);
  });

  test('returns 401 when unauthenticated', async () => {
    const { ImagingMgmt_createImagingStudy } = await import('./ImagingMgmt_createImagingStudy');
    const app = buildApp(ImagingMgmt_createImagingStudy as any, {
      db: makeDb(),
      method: 'POST',
      path: '/:patientId/studies',
    });
    const res = await app.request(`/${PATIENT_ID}/studies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modality: 'other', mimeType: 'image/jpeg', fileSizeBytes: 1024, branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// ImagingMgmt_getImagingStudy
// ---------------------------------------------------------------------------

describe('ImagingMgmt_getImagingStudy wrapper', () => {
  test('delegates to getImagingStudy — returns 200', async () => {
    const { ImagingMgmt_getImagingStudy } = await import('./ImagingMgmt_getImagingStudy');

    // getImagingStudy calls: findStudyById + assertBranchAccess + listImagesByStudy + listTeethByImage
    const db = {
      select: (fields?: any) => ({
        from: (tableRef: any) => {
          const hasPersonId  = tableRef?.personId !== undefined;
          const hasStudyId   = tableRef?.studyId  !== undefined;
          const hasToothNum  = tableRef?.toothNumber !== undefined && !hasStudyId;
          const hasPatientId = tableRef?.patientId !== undefined && !hasStudyId;
          const isRole       = hasPersonId && fields && 'role' in fields;

          return {
            where: (_cond: any): any => {
              const resolve = (_n?: number) => {
                if (isRole)       return Promise.resolve([{ role: 'dentist_owner' }]);
                if (hasPersonId)  return Promise.resolve([{ id: 'membership-id' }]);
                if (hasStudyId)   return Promise.resolve([MOCK_IMAGE]);
                if (hasPatientId) return Promise.resolve([MOCK_STUDY]);
                if (hasToothNum)  return Promise.resolve([]);
                return Promise.resolve([]);
              };
              return Object.assign(resolve(), { limit: (n: number) => resolve(n) });
            },
            // listImagesByStudy calls .where() directly (thenable)
            then: (res: any, rej: any) => Promise.resolve([MOCK_IMAGE]).then(res, rej),
          };
        },
      }),
    };

    const app = buildApp(ImagingMgmt_getImagingStudy as any, {
      user: DENTIST_USER,
      db,
      method: 'GET',
      path: '/:studyId',
    });
    const res = await app.request(`/${STUDY_ID}`, { method: 'GET' });
    expect(res.status).toBe(200);
  });

  test('returns 404 when study missing', async () => {
    const { ImagingMgmt_getImagingStudy } = await import('./ImagingMgmt_getImagingStudy');
    const app = buildApp(ImagingMgmt_getImagingStudy as any, {
      user: DENTIST_USER,
      db: makeDb({ study: null }),
      method: 'GET',
      path: '/:studyId',
    });
    const res = await app.request(`/${STUDY_ID}`, { method: 'GET' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// ImagingMgmt_deleteImage
// ---------------------------------------------------------------------------

describe('ImagingMgmt_deleteImage wrapper', () => {
  test('delegates to deleteImage — dentist can delete, returns 204', async () => {
    const { ImagingMgmt_deleteImage } = await import('./ImagingMgmt_deleteImage');
    const app = buildApp(ImagingMgmt_deleteImage as any, {
      user: DENTIST_USER,
      db:   makeDb({ memberRole: 'dentist_owner' }),
      method: 'DELETE',
      path: '/:imageId',
    });
    const res = await app.request(`/${IMAGE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('returns 401 when unauthenticated', async () => {
    const { ImagingMgmt_deleteImage } = await import('./ImagingMgmt_deleteImage');
    const app = buildApp(ImagingMgmt_deleteImage as any, {
      db:     makeDb(),
      method: 'DELETE',
      path:   '/:imageId',
    });
    const res = await app.request(`/${IMAGE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  test('returns 404 when image missing', async () => {
    const { ImagingMgmt_deleteImage } = await import('./ImagingMgmt_deleteImage');
    const app = buildApp(ImagingMgmt_deleteImage as any, {
      user:   DENTIST_USER,
      db:     makeDb({ image: null }),
      method: 'DELETE',
      path:   '/:imageId',
    });
    const res = await app.request(`/${IMAGE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// ImagingMgmt_updateImageCalibration
// ---------------------------------------------------------------------------

describe('ImagingMgmt_updateImageCalibration wrapper', () => {
  test('delegates to updateImageCalibration — returns 200', async () => {
    const { ImagingMgmt_updateImageCalibration } = await import('./ImagingMgmt_updateImageCalibration');
    const app = buildApp(ImagingMgmt_updateImageCalibration as any, {
      user:   DENTIST_USER,
      db:     makeDb(),
      method: 'PATCH',
      path:   '/:imageId/calibration',
    });
    const res = await app.request(`/${IMAGE_ID}/calibration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pixelSpacingMm: 0.1 }),
    });
    expect(res.status).toBe(200);
  });

  test('returns 404 when image missing', async () => {
    const { ImagingMgmt_updateImageCalibration } = await import('./ImagingMgmt_updateImageCalibration');
    const app = buildApp(ImagingMgmt_updateImageCalibration as any, {
      user:   DENTIST_USER,
      db:     makeDb({ image: null }),
      method: 'PATCH',
      path:   '/:imageId/calibration',
    });
    const res = await app.request(`/${IMAGE_ID}/calibration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pixelSpacingMm: 0.1 }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// ImagingMgmt_updateImageModality
// ---------------------------------------------------------------------------

describe('ImagingMgmt_updateImageModality wrapper', () => {
  test('delegates to updateImageModality — returns 200', async () => {
    const { ImagingMgmt_updateImageModality } = await import('./ImagingMgmt_updateImageModality');
    // getMemberRole must return a role in ['dentist', 'associate', 'hygienist']
    const app = buildApp(ImagingMgmt_updateImageModality as any, {
      user:   DENTIST_USER,
      db:     makeDb({ memberRole: 'dentist_owner' }),
      method: 'PATCH',
      path:   '/:imageId/modality',
    });
    const res = await app.request(`/${IMAGE_ID}/modality`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modality: 'periapical' }),
    });
    expect(res.status).toBe(200);
  });

  test('returns 401 when unauthenticated', async () => {
    const { ImagingMgmt_updateImageModality } = await import('./ImagingMgmt_updateImageModality');
    const app = buildApp(ImagingMgmt_updateImageModality as any, {
      db:     makeDb(),
      method: 'PATCH',
      path:   '/:imageId/modality',
    });
    const res = await app.request(`/${IMAGE_ID}/modality`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modality: 'periapical' }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// ImagingMgmt_createMeasurement
// ---------------------------------------------------------------------------

describe('ImagingMgmt_createMeasurement wrapper', () => {
  test('delegates to createMeasurement — returns 201', async () => {
    const { ImagingMgmt_createMeasurement } = await import('./ImagingMgmt_createMeasurement');
    const db = makeMeasurementDb();
    const app = buildApp(ImagingMgmt_createMeasurement as any, {
      user:   DENTIST_USER,
      db,
      method: 'POST',
      path:   '/:imageId/measurements',
    });
    // Use annotation type 'label' — no tier gate, simple geometry
    const res = await app.request(`/${IMAGE_ID}/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'label',
        geometry: { type: 'label', point: { x: 10, y: 20 }, text: 'Caries suspect' },
      }),
    });
    expect(res.status).toBe(201);
  });

  test('returns 404 when image missing', async () => {
    const { ImagingMgmt_createMeasurement } = await import('./ImagingMgmt_createMeasurement');
    const app = buildApp(ImagingMgmt_createMeasurement as any, {
      user:   DENTIST_USER,
      db:     makeMeasurementDb({ image: null }),
      method: 'POST',
      path:   '/:imageId/measurements',
    });
    const res = await app.request(`/${IMAGE_ID}/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'label',
        geometry: { type: 'label', point: { x: 10, y: 20 }, text: 'Caries suspect' },
      }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// ImagingMgmt_listMeasurements
// ---------------------------------------------------------------------------

describe('ImagingMgmt_listMeasurements wrapper', () => {
  test('delegates to listMeasurements — returns 200', async () => {
    const { ImagingMgmt_listMeasurements } = await import('./ImagingMgmt_listMeasurements');
    const app = buildApp(ImagingMgmt_listMeasurements as any, {
      user:   DENTIST_USER,
      db:     makeMeasurementDb(),
      method: 'GET',
      path:   '/:imageId/measurements',
    });
    const res = await app.request(`/${IMAGE_ID}/measurements`, { method: 'GET' });
    expect(res.status).toBe(200);
  });

  test('returns 401 when unauthenticated', async () => {
    const { ImagingMgmt_listMeasurements } = await import('./ImagingMgmt_listMeasurements');
    const app = buildApp(ImagingMgmt_listMeasurements as any, {
      db:     makeMeasurementDb(),
      method: 'GET',
      path:   '/:imageId/measurements',
    });
    const res = await app.request(`/${IMAGE_ID}/measurements`, { method: 'GET' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// ImagingMgmt_deleteMeasurement
// ---------------------------------------------------------------------------

describe('ImagingMgmt_deleteMeasurement wrapper', () => {
  test('delegates to deleteMeasurement — returns 204', async () => {
    const { ImagingMgmt_deleteMeasurement } = await import('./ImagingMgmt_deleteMeasurement');
    const app = buildApp(ImagingMgmt_deleteMeasurement as any, {
      user:   DENTIST_USER,
      db:     makeMeasurementDb(),
      method: 'DELETE',
      path:   '/:measurementId',
    });
    const res = await app.request(`/${MEASURE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('returns 404 when annotation (measurement) missing', async () => {
    const { ImagingMgmt_deleteMeasurement } = await import('./ImagingMgmt_deleteMeasurement');
    // deleteMeasurement calls findAnnotationById first; pass annotation:null to trigger 404
    const app = buildApp(ImagingMgmt_deleteMeasurement as any, {
      user:   DENTIST_USER,
      db:     makeMeasurementDb({ annotation: null }),
      method: 'DELETE',
      path:   '/:measurementId',
    });
    const res = await app.request(`/${MEASURE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// ImagingFindingsMgmt_createFinding
// ---------------------------------------------------------------------------

describe('ImagingFindingsMgmt_createFinding wrapper', () => {
  test('delegates to createFinding — returns 201', async () => {
    const { ImagingFindingsMgmt_createFinding } = await import('./ImagingFindingsMgmt_createFinding');
    const app = buildApp(ImagingFindingsMgmt_createFinding as any, {
      user:   DENTIST_USER,
      db:     makeFindingDb(),
      method: 'POST',
      path:   '/:imageId/findings',
    });
    const res = await app.request(`/${IMAGE_ID}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'caries' }),
    });
    expect(res.status).toBe(201);
  });

  test('returns 401 when unauthenticated', async () => {
    const { ImagingFindingsMgmt_createFinding } = await import('./ImagingFindingsMgmt_createFinding');
    const app = buildApp(ImagingFindingsMgmt_createFinding as any, {
      db:     makeFindingDb(),
      method: 'POST',
      path:   '/:imageId/findings',
    });
    const res = await app.request(`/${IMAGE_ID}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'caries' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when image missing', async () => {
    const { ImagingFindingsMgmt_createFinding } = await import('./ImagingFindingsMgmt_createFinding');
    const app = buildApp(ImagingFindingsMgmt_createFinding as any, {
      user:   DENTIST_USER,
      db:     makeFindingDb({ image: null }),
      method: 'POST',
      path:   '/:imageId/findings',
    });
    const res = await app.request(`/${IMAGE_ID}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'caries' }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// ImagingFindingsMgmt_listFindings
// ---------------------------------------------------------------------------

describe('ImagingFindingsMgmt_listFindings wrapper', () => {
  test('delegates to listFindings — returns 200 with items array', async () => {
    const { ImagingFindingsMgmt_listFindings } = await import('./ImagingFindingsMgmt_listFindings');
    const app = buildApp(ImagingFindingsMgmt_listFindings as any, {
      user:   DENTIST_USER,
      db:     makeFindingDb(),
      method: 'GET',
      path:   '/:imageId/findings',
    });
    const res = await app.request(`/${IMAGE_ID}/findings`, { method: 'GET' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('returns 404 when image missing', async () => {
    const { ImagingFindingsMgmt_listFindings } = await import('./ImagingFindingsMgmt_listFindings');
    const app = buildApp(ImagingFindingsMgmt_listFindings as any, {
      user:   DENTIST_USER,
      db:     makeFindingDb({ image: null }),
      method: 'GET',
      path:   '/:imageId/findings',
    });
    const res = await app.request(`/${IMAGE_ID}/findings`, { method: 'GET' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// ImagingFindingsMgmt_updateFinding
// ---------------------------------------------------------------------------

describe('ImagingFindingsMgmt_updateFinding wrapper', () => {
  test('delegates to updateFinding — returns 200', async () => {
    const { ImagingFindingsMgmt_updateFinding } = await import('./ImagingFindingsMgmt_updateFinding');
    const app = buildApp(ImagingFindingsMgmt_updateFinding as any, {
      user:   DENTIST_USER,
      db:     makeFindingDb(),
      method: 'PATCH',
      path:   '/:findingId',
    });
    const res = await app.request(`/${FINDING_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'updated note' }),
    });
    expect(res.status).toBe(200);
  });

  test('returns 404 when finding missing', async () => {
    const { ImagingFindingsMgmt_updateFinding } = await import('./ImagingFindingsMgmt_updateFinding');
    const app = buildApp(ImagingFindingsMgmt_updateFinding as any, {
      user:   DENTIST_USER,
      db:     makeFindingDb({ finding: null }),
      method: 'PATCH',
      path:   '/:findingId',
    });
    const res = await app.request(`/${FINDING_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'x' }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// ImagingFindingsMgmt_deleteFinding
// ---------------------------------------------------------------------------

describe('ImagingFindingsMgmt_deleteFinding wrapper', () => {
  test('delegates to deleteFinding — returns 204', async () => {
    const { ImagingFindingsMgmt_deleteFinding } = await import('./ImagingFindingsMgmt_deleteFinding');
    const app = buildApp(ImagingFindingsMgmt_deleteFinding as any, {
      user:   DENTIST_USER,
      db:     makeFindingDb(),
      method: 'DELETE',
      path:   '/:findingId',
    });
    const res = await app.request(`/${FINDING_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('returns 404 when finding missing', async () => {
    const { ImagingFindingsMgmt_deleteFinding } = await import('./ImagingFindingsMgmt_deleteFinding');
    const app = buildApp(ImagingFindingsMgmt_deleteFinding as any, {
      user:   DENTIST_USER,
      db:     makeFindingDb({ finding: null }),
      method: 'DELETE',
      path:   '/:findingId',
    });
    const res = await app.request(`/${FINDING_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PatientImageMgmt_listPatientImages
// ---------------------------------------------------------------------------

describe('PatientImageMgmt_listPatientImages wrapper', () => {
  test('delegates to listPatientImages — returns 200 with items', async () => {
    const { PatientImageMgmt_listPatientImages } = await import('./PatientImageMgmt_listPatientImages');
    const app = buildApp(PatientImageMgmt_listPatientImages as any, {
      user:   DENTIST_USER,
      db:     makeFullListPatientImagesDb(),
      method: 'GET',
      path:   '/:patientId/images',
    });
    const res = await app.request(`/${PATIENT_ID}/images?branchId=${BRANCH_ID}`, { method: 'GET' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('returns 400 when branchId missing', async () => {
    const { PatientImageMgmt_listPatientImages } = await import('./PatientImageMgmt_listPatientImages');
    const app = buildApp(PatientImageMgmt_listPatientImages as any, {
      user:   DENTIST_USER,
      db:     makeFullListPatientImagesDb(),
      method: 'GET',
      path:   '/:patientId/images',
    });
    const res = await app.request(`/${PATIENT_ID}/images`, { method: 'GET' });
    expect(res.status).toBe(400);
  });

  test('returns 401 when unauthenticated', async () => {
    const { PatientImageMgmt_listPatientImages } = await import('./PatientImageMgmt_listPatientImages');
    const app = buildApp(PatientImageMgmt_listPatientImages as any, {
      db:     makeFullListPatientImagesDb(),
      method: 'GET',
      path:   '/:patientId/images',
    });
    const res = await app.request(`/${PATIENT_ID}/images?branchId=${BRANCH_ID}`, { method: 'GET' });
    expect(res.status).toBe(401);
  });

  test('returns 403 when not a branch member', async () => {
    const { PatientImageMgmt_listPatientImages } = await import('./PatientImageMgmt_listPatientImages');
    const app = buildApp(PatientImageMgmt_listPatientImages as any, {
      user:   DENTIST_USER,
      db:     makeFullListPatientImagesDb({ hasMembership: false }),
      method: 'GET',
      path:   '/:patientId/images',
    });
    const res = await app.request(`/${PATIENT_ID}/images?branchId=${BRANCH_ID}`, { method: 'GET' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CephMgmt wrapper coverage helpers
//
// These use the same column duck-typing as the other mocks but also need to
// support the innerJoin call in getImagingTierForBranch / getOrgDataForBranch.
// imagingTier defaults to 'addon' (ceph-enabled); pass 'free' or 'basic' to test the gate.
// ---------------------------------------------------------------------------

const LANDMARK_ID  = '77777777-0000-0000-0000-000000000030';
const CEPH_REPORT_ID = '88888888-0000-0000-0000-000000000040';

const MOCK_CEPH_IMAGE = {
  ...MOCK_IMAGE,
  modality: 'other' as const,
};

const MOCK_LANDMARK = {
  id: LANDMARK_ID,
  imageId: IMAGE_ID,
  landmarkCode: 'N',
  x: 300,
  y: 200,
  source: 'manual' as const,
  confidence: null as number | null,
  status: 'placed' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

/** A, B, Go, Po all confirmed — satisfies D-L gate for createCephReport */
const GATE_LANDMARKS = (['A', 'B', 'Go', 'Po'] as const).map((code, i) => ({
  ...MOCK_LANDMARK,
  id: `gate-lm-${i}`,
  landmarkCode: code,
  status: 'confirmed' as const,
}));

const MOCK_CEPH_ANALYSIS = {
  id: 'analysis-cov-1',
  imageId: IMAGE_ID,
  analysisType: 'steiner_hybrid_sn' as const,
  measurements: {} as Record<string, number | null>,
  calibrationValue: null as number | null,
  calibrationMethod: 'not_calibrated' as const,
  calibratedAt: null as Date | null,
  calibratedBy: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

const MOCK_CEPH_REPORT = {
  id: CEPH_REPORT_ID,
  imageId: IMAGE_ID,
  version: 1,
  snapshot: {
    landmarks: [],
    measurements: {},
    analysis_label: 'steiner_hybrid_sn',
    calibration: { value: null, method: 'not_calibrated' },
    software_version: '1.4.0',
    operator: DENTIST_USER.id,
    generated_at: new Date().toISOString(),
    study_date: '2026-01-01',
    patient_display_id: PATIENT_ID,
    branch_name: 'Main Branch',
  } as Record<string, unknown>,
  createdAt: new Date(),
  createdBy: DENTIST_USER.id,
};

function makeCephCoverageDb(opts: {
  hasMembership?: boolean;
  memberRole?: string;
  imagingTier?: 'free' | 'basic' | 'addon' | null;
  image?: typeof MOCK_CEPH_IMAGE | null;
  study?: typeof MOCK_STUDY | null;
  landmark?: typeof MOCK_LANDMARK | null;
  landmarks?: any[];
  analysis?: typeof MOCK_CEPH_ANALYSIS | null;
  report?: typeof MOCK_CEPH_REPORT | null;
  reportVersion?: number;
} = {}) {
  const hasMembership = opts.hasMembership !== false;
  const memberRole    = opts.memberRole ?? 'dentist_owner';
  const imagingTier   = opts.imagingTier !== undefined ? opts.imagingTier : 'addon';
  const image         = opts.image     !== undefined ? opts.image    : MOCK_CEPH_IMAGE;
  const study         = opts.study     !== undefined ? opts.study    : MOCK_STUDY;
  const landmark      = opts.landmark  !== undefined ? opts.landmark : MOCK_LANDMARK;
  const landmarks     = opts.landmarks !== undefined ? opts.landmarks : (landmark ? [landmark] : []);
  const analysis      = opts.analysis  !== undefined ? opts.analysis : MOCK_CEPH_ANALYSIS;
  const report        = opts.report    !== undefined ? opts.report   : MOCK_CEPH_REPORT;
  const reportVersion = opts.reportVersion ?? 0;

  const buildSelectChain = (tableRef: any, fields?: any) => {
    const hasPersonId     = tableRef?.personId    !== undefined;
    const hasStudyId      = tableRef?.studyId     !== undefined;
    const hasPatientId    = tableRef?.patientId   !== undefined && !hasStudyId;
    const hasLandmarkCode = tableRef?.landmarkCode !== undefined;
    const hasAnalysisType = tableRef?.analysisType !== undefined;
    const hasSnapshot     = tableRef?.snapshot    !== undefined;
    // G6: imaging_calibration — getLatestCalibration does .where().orderBy().limit(1).
    const hasKnownDistance = tableRef?.knownDistanceMm !== undefined;
    const isMaxVersionQuery = hasSnapshot && fields != null && 'maxVersion' in fields;
    const hasBranchNameField = fields != null && 'branchName' in fields;

    const whereFn = (_cond: any): any => {
      if (hasPersonId) {
        const isRoleQuery = fields != null && 'role' in fields;
        const memberRow = hasMembership
          ? (isRoleQuery ? [{ id: 'membership-id', role: memberRole }] : [{ id: 'membership-id' }])
          : [];
        const rows = Promise.resolve(memberRow);
        return Object.assign(rows, { limit: (_n: number) => rows });
      }
      if (hasLandmarkCode) {
        const allRows  = Promise.resolve(landmarks);
        const oneRow   = Promise.resolve(landmark ? [landmark] : []);
        return Object.assign(allRows, { limit: (_n: number) => oneRow });
      }
      if (hasAnalysisType) {
        const rows = Promise.resolve(analysis ? [analysis] : []);
        return Object.assign(rows, { limit: (_n: number) => rows });
      }
      if (hasSnapshot) {
        let rows: Promise<any[]>;
        if (isMaxVersionQuery) {
          rows = Promise.resolve([{ maxVersion: reportVersion }]);
        } else {
          rows = Promise.resolve(report ? [report] : []);
        }
        return Object.assign(rows, {
          limit: (_n: number) => rows,
          orderBy: (_col: any) => Object.assign(rows, { limit: (_n: number) => rows }),
        });
      }
      if (hasKnownDistance) {
        // G6: no versioned calibration record by default → getLatestCalibration null.
        const rows = Promise.resolve([]);
        return Object.assign(rows, {
          orderBy: (_col: any) => Object.assign(rows, { limit: (_n: number) => rows }),
          limit: (_n: number) => rows,
        });
      }
      if (hasStudyId) {
        const rows = Promise.resolve(image ? [image] : []);
        return Object.assign(rows, { limit: (_n: number) => rows });
      }
      if (hasPatientId) {
        const rows = Promise.resolve(study ? [study] : []);
        return Object.assign(rows, { limit: (_n: number) => rows });
      }
      const rows = Promise.resolve([]);
      return Object.assign(rows, { limit: (_n: number) => rows });
    };

    return {
      where: whereFn,
      // listByImage uses direct await on .where() (thenable)
      then: (res: any, rej: any) => Promise.resolve(landmarks).then(res, rej),
      innerJoin: (_joinTable: any, _cond: any) => ({
        where: (_cond2: any) => ({
          limit: (_n: number) =>
            Promise.resolve([{
              imagingTier,
              ...(hasBranchNameField ? { branchName: 'Main Branch' } : {}),
            }]),
        }),
      }),
    };
  };

  return {
    select: (fields?: any) => ({
      from: (tableRef: any) => buildSelectChain(tableRef, fields),
    }),
    insert: (tableRef: any) => {
      const isReportTable = tableRef?.snapshot !== undefined;
      return {
        values: (_data: any) => ({
          returning: () =>
            isReportTable
              ? Promise.resolve([{ ...MOCK_CEPH_REPORT, version: reportVersion + 1 }])
              : Promise.resolve([analysis ?? MOCK_CEPH_ANALYSIS]),
          onConflictDoUpdate: (_opts: any) => ({
            returning: () => Promise.resolve([analysis ?? MOCK_CEPH_ANALYSIS]),
          }),
        }),
      };
    },
    update: (_tableRef: any) => ({
      set: (_data: any) => ({
        where: (_cond: any) => ({
          returning: () => Promise.resolve([landmark ?? MOCK_LANDMARK]),
        }),
      }),
    }),
    delete: (_tableRef: any) => ({
      where: (_cond: any) => Promise.resolve(undefined),
    }),
  };
}

// ---------------------------------------------------------------------------
// CephMgmt_listCephLandmarks
// ---------------------------------------------------------------------------

describe('CephMgmt_listCephLandmarks wrapper', () => {
  test('delegates to listCephLandmarks — returns 200 with {items, analysis}', async () => {
    const { CephMgmt_listCephLandmarks } = await import('./CephMgmt_listCephLandmarks');
    const app = buildApp(CephMgmt_listCephLandmarks as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb(),
      method: 'GET',
      path:   '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, { method: 'GET' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_listCephLandmarks } = await import('./CephMgmt_listCephLandmarks');
    const app = buildApp(CephMgmt_listCephLandmarks as any, {
      db:     makeCephCoverageDb(),
      method: 'GET',
      path:   '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, { method: 'GET' });
    expect(res.status).toBe(401);
  });

  test('returns 403 on basic tier (EF-IMG-009)', async () => {
    const { CephMgmt_listCephLandmarks } = await import('./CephMgmt_listCephLandmarks');
    const app = buildApp(CephMgmt_listCephLandmarks as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ imagingTier: 'basic' }),
      method: 'GET',
      path:   '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, { method: 'GET' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CephMgmt_batchUpsertCephLandmarks
// ---------------------------------------------------------------------------

describe('CephMgmt_batchUpsertCephLandmarks wrapper', () => {
  test('delegates to batchUpsertCephLandmarks — returns 200', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const app = buildApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb(),
      method: 'POST',
      path:   '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(200);
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const app = buildApp(CephMgmt_batchUpsertCephLandmarks as any, {
      db:     makeCephCoverageDb(),
      method: 'POST',
      path:   '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 403 on basic tier (EF-IMG-009)', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const app = buildApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ imagingTier: 'basic' }),
      method: 'POST',
      path:   '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CephMgmt_updateCephLandmark
// ---------------------------------------------------------------------------

describe('CephMgmt_updateCephLandmark wrapper', () => {
  test('delegates to updateCephLandmark — returns 200', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const app = buildApp(CephMgmt_updateCephLandmark as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb(),
      method: 'PATCH',
      path:   '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 310 }),
    });
    expect(res.status).toBe(200);
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const app = buildApp(CephMgmt_updateCephLandmark as any, {
      db:     makeCephCoverageDb(),
      method: 'PATCH',
      path:   '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 310 }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 403 on basic tier (EF-IMG-009)', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const app = buildApp(CephMgmt_updateCephLandmark as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ imagingTier: 'basic' }),
      method: 'PATCH',
      path:   '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 310 }),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CephMgmt_deleteCephLandmark
// ---------------------------------------------------------------------------

describe('CephMgmt_deleteCephLandmark wrapper', () => {
  test('delegates to deleteCephLandmark — returns 204', async () => {
    const { CephMgmt_deleteCephLandmark } = await import('./CephMgmt_deleteCephLandmark');
    const app = buildApp(CephMgmt_deleteCephLandmark as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb(),
      method: 'DELETE',
      path:   '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_deleteCephLandmark } = await import('./CephMgmt_deleteCephLandmark');
    const app = buildApp(CephMgmt_deleteCephLandmark as any, {
      db:     makeCephCoverageDb(),
      method: 'DELETE',
      path:   '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  test('returns 403 on basic tier (EF-IMG-009)', async () => {
    const { CephMgmt_deleteCephLandmark } = await import('./CephMgmt_deleteCephLandmark');
    const app = buildApp(CephMgmt_deleteCephLandmark as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ imagingTier: 'basic' }),
      method: 'DELETE',
      path:   '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CephMgmt_getCephAnalysis
// ---------------------------------------------------------------------------

describe('CephMgmt_getCephAnalysis wrapper', () => {
  test('delegates to getCephAnalysis — returns 200', async () => {
    const { CephMgmt_getCephAnalysis } = await import('./CephMgmt_getCephAnalysis');
    const app = buildApp(CephMgmt_getCephAnalysis as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb(),
      method: 'GET',
      path:   '/:imageId/analysis',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis`, { method: 'GET' });
    expect(res.status).toBe(200);
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_getCephAnalysis } = await import('./CephMgmt_getCephAnalysis');
    const app = buildApp(CephMgmt_getCephAnalysis as any, {
      db:     makeCephCoverageDb(),
      method: 'GET',
      path:   '/:imageId/analysis',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis`, { method: 'GET' });
    expect(res.status).toBe(401);
  });

  test('returns 403 on basic tier (EF-IMG-009)', async () => {
    const { CephMgmt_getCephAnalysis } = await import('./CephMgmt_getCephAnalysis');
    const app = buildApp(CephMgmt_getCephAnalysis as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ imagingTier: 'basic' }),
      method: 'GET',
      path:   '/:imageId/analysis',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis`, { method: 'GET' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CephMgmt_recomputeCephAnalysis
// ---------------------------------------------------------------------------

describe('CephMgmt_recomputeCephAnalysis wrapper', () => {
  test('delegates to recomputeCephAnalysis — returns 200', async () => {
    const { CephMgmt_recomputeCephAnalysis } = await import('./CephMgmt_recomputeCephAnalysis');
    // V-IMG-004: recompute now enforces NOT_CALIBRATED / INSUFFICIENT_LANDMARKS.
    // Seed S+N reference landmarks on a calibrated image so the happy path reaches 200.
    const calibratedImage = { ...MOCK_CEPH_IMAGE, pixelSpacingMm: 0.1 } as unknown as typeof MOCK_CEPH_IMAGE;
    const snLandmarks = (['S', 'N'] as const).map((code, i) => ({
      ...MOCK_LANDMARK,
      id: `cov-sn-${i}`,
      landmarkCode: code,
      x: 300 + i * 50,
      y: 200 + i * 10,
    }));
    const app = buildApp(CephMgmt_recomputeCephAnalysis as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ image: calibratedImage, landmarks: snLandmarks }),
      method: 'POST',
      path:   '/:imageId/analysis/recompute',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' });
    expect(res.status).toBe(200);
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_recomputeCephAnalysis } = await import('./CephMgmt_recomputeCephAnalysis');
    const app = buildApp(CephMgmt_recomputeCephAnalysis as any, {
      db:     makeCephCoverageDb(),
      method: 'POST',
      path:   '/:imageId/analysis/recompute',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  test('returns 403 on basic tier (EF-IMG-009)', async () => {
    const { CephMgmt_recomputeCephAnalysis } = await import('./CephMgmt_recomputeCephAnalysis');
    const app = buildApp(CephMgmt_recomputeCephAnalysis as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ imagingTier: 'basic' }),
      method: 'POST',
      path:   '/:imageId/analysis/recompute',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CephMgmt_createCephReport
// ---------------------------------------------------------------------------

describe('CephMgmt_createCephReport wrapper', () => {
  test('delegates to createCephReport — returns 201', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const app = buildApp(CephMgmt_createCephReport as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ landmarks: GATE_LANDMARKS, reportVersion: 0 }),
      method: 'POST',
      path:   '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.version).toBe(1);
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const app = buildApp(CephMgmt_createCephReport as any, {
      db:     makeCephCoverageDb({ landmarks: GATE_LANDMARKS }),
      method: 'POST',
      path:   '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  test('returns 403 on basic tier (EF-IMG-009)', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const app = buildApp(CephMgmt_createCephReport as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ imagingTier: 'basic', landmarks: GATE_LANDMARKS }),
      method: 'POST',
      path:   '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CephMgmt_getCephReport
// ---------------------------------------------------------------------------

describe('CephMgmt_getCephReport wrapper', () => {
  test('delegates to getCephReport — returns 200', async () => {
    const { CephMgmt_getCephReport } = await import('./CephMgmt_getCephReport');
    const app = buildApp(CephMgmt_getCephReport as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb(),
      method: 'GET',
      path:   '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, { method: 'GET' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.version).toBe(1);
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_getCephReport } = await import('./CephMgmt_getCephReport');
    const app = buildApp(CephMgmt_getCephReport as any, {
      db:     makeCephCoverageDb(),
      method: 'GET',
      path:   '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, { method: 'GET' });
    expect(res.status).toBe(401);
  });

  test('returns 404 when no report exists', async () => {
    const { CephMgmt_getCephReport } = await import('./CephMgmt_getCephReport');
    const app = buildApp(CephMgmt_getCephReport as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ report: null }),
      method: 'GET',
      path:   '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, { method: 'GET' });
    expect(res.status).toBe(404);
  });

  test('returns 403 on basic tier (EF-IMG-009)', async () => {
    const { CephMgmt_getCephReport } = await import('./CephMgmt_getCephReport');
    const app = buildApp(CephMgmt_getCephReport as any, {
      user:   DENTIST_USER,
      db:     makeCephCoverageDb({ imagingTier: 'basic' }),
      method: 'GET',
      path:   '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, { method: 'GET' });
    expect(res.status).toBe(403);
  });
});
