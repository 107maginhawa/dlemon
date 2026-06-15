/**
 * E2: dental_assistant clinical-assist workflow — authorization role guard.
 *
 * The dental_assistant works UNDER dentist supervision. This suite pins the
 * intended scope with BOTH allow and deny cases (non-vacuous, real-DB so
 * assertBranchRole actually runs against memberships):
 *
 *   ALLOW (dental_assistant → 2xx):
 *     - createImagingStudy           (capture imaging)
 *     - upsertDentalChart            (chart-condition write)
 *     - updateTooth                  (per-tooth condition write)
 *     - initializeDentition          (dentition scaffold — condition write)
 *     - upsertVisitNotes             (DRAFT notes)
 *     - createAttachment             (upload attachment)
 *
 *   DENY (dental_assistant → 403):
 *     - signVisitNotes               (must NOT sign)
 *     - createDentalTreatment        (must NOT add/finalize treatment)
 *     - finalizeCbctStudy            (must NOT finalize CBCT — dentist-only)
 *
 * Guardrail control: dentist_owner is allowed everywhere it should be (sanity
 * the deny cases are role-driven, not blanket failures).
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  UpsertDentalChartBody,
  UpsertDentalChartParams,
  UpdateToothBody,
  UpdateToothParams,
  UpsertVisitNotesBody,
  UpsertVisitNotesParams,
  SignVisitNotesBody,
  SignVisitNotesParams,
  CreateAttachmentBody,
  CreateAttachmentParams,
  CreateDentalTreatmentBody,
  CreateDentalTreatmentParams,
  InitializeDentitionBody,
  InitializeDentitionParams,
} from '@/generated/openapi/validators';

import { upsertDentalChart } from './chart/upsertDentalChart';
import { updateTooth } from './chart/updateTooth';
import { initializeDentition } from '@/handlers/dental-patient/identity/initializeDentition';
import { upsertVisitNotes } from './notes/upsertVisitNotes';
import { signVisitNotes } from './notes/signVisitNotes';
import { createDentalTreatment } from './treatments/createDentalTreatment';
import { createImagingStudy } from '@/handlers/dental-imaging/createImagingStudy';
import { finalizeCbctStudy } from '@/handlers/dental-imaging/finalizeCbctStudy';
import { buildSyntheticDicom } from '@/handlers/dental-imaging/repos/dicom-fixture';
import { createAttachment } from '@/handlers/dental-clinical/attachments/createAttachment';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// ─── Fixed IDs (namespace: e2-asst) ─────────────────────────────────────────
const ORG_ID     = 'd0000000-0000-1000-8000-0000000e2001';
const BRANCH_ID  = 'b0000000-0000-1000-8000-0000000e2001';
const PERSON_ID  = 'f0000000-0000-1000-8000-0000000e2001';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000e2001';

const OWNER_USER     = { id: '00000000-0000-0000-0000-e20001000000', email: 'owner.e2@clinic.com' };
const ASSISTANT_USER = { id: '00000000-0000-0000-0000-e20009000000', email: 'asst.e2@clinic.com' };

const OWNER_MEMBER_ID     = 'c0000000-0000-1000-8000-e20001000000';
const ASSISTANT_MEMBER_ID = 'c0000000-0000-1000-8000-e20009000000';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons }             = await import('@/handlers/person/repos/person.schema');
  const { patients }            = await import('@/handlers/patient/repos/patient.schema');

  for (const userId of [OWNER_USER.id, ASSISTANT_USER.id]) {
    await db.delete(dentalMemberships).where(
      and(eq(dentalMemberships.personId, userId), eq(dentalMemberships.branchId, BRANCH_ID)),
    );
  }

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'E2 Assistant Clinic', tier: 'solo',
    ownerPersonId: OWNER_USER.id,
    countryCode: 'PH', createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();

  const memberValues = [
    { id: OWNER_MEMBER_ID,     personId: OWNER_USER.id,     role: 'dentist_owner'    },
    { id: ASSISTANT_MEMBER_ID, personId: ASSISTANT_USER.id, role: 'dental_assistant' },
  ] as const;

  for (const m of memberValues) {
    await db.insert(dentalMemberships as any).values({
      id: m.id, branchId: BRANCH_ID, personId: m.personId,
      displayName: m.role, role: m.role, status: 'active',
      pinFailedAttempts: 0,
      createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
    }).onConflictDoNothing();
  }

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'E2', lastName: 'Patient',
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
  await db.execute(sql`TRUNCATE TABLE imaging_study CASCADE`);
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const ve = (result: any, c: any) => {
  if (!result.success)
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

function makeStorage() {
  return {
    generateUploadUrl: async () => 'https://storage.example.com/presigned-upload-url',
    generateDownloadUrl: async (fileId: string) => `https://storage.example.com/get/${fileId}`,
    initiateMultipartUpload: async () => 'test-upload-id',
    generatePartUploadUrl: async (_f: string, _u: string, p: number) => `https://storage.example.com/part/${p}`,
    completeMultipartUpload: async () => undefined,
    abortMultipartUpload: async () => undefined,
  };
}

function buildApp(user?: { id: string; email: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('storage', makeStorage());
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  // imaging
  app.post('/dental/imaging/studies', createImagingStudy as any);
  app.post('/dental/imaging/studies/:studyId/cbct/finalize', finalizeCbctStudy as any);

  // chart
  app.post('/dental/visits/:visitId/chart',
    zValidator('param', UpsertDentalChartParams, ve),
    zValidator('json', UpsertDentalChartBody, ve),
    upsertDentalChart as any,
  );
  app.patch('/dental/visits/:visitId/chart/teeth/:toothNumber',
    zValidator('param', UpdateToothParams, ve),
    zValidator('json', UpdateToothBody, ve),
    updateTooth as any,
  );
  app.post('/dental/patients/:patientId/dentition',
    zValidator('param', InitializeDentitionParams, ve),
    zValidator('json', InitializeDentitionBody, ve),
    initializeDentition as any,
  );

  // notes
  app.post('/dental/visits/:visitId/notes',
    zValidator('param', UpsertVisitNotesParams, ve),
    zValidator('json', UpsertVisitNotesBody, ve),
    upsertVisitNotes as any,
  );
  app.post('/dental/visits/:visitId/notes/sign',
    zValidator('param', SignVisitNotesParams, ve),
    zValidator('json', SignVisitNotesBody, ve),
    signVisitNotes as any,
  );

  // treatments
  app.post('/dental/visits/:visitId/treatments',
    zValidator('param', CreateDentalTreatmentParams, ve),
    zValidator('json', CreateDentalTreatmentBody, ve),
    createDentalTreatment as any,
  );

  // attachments
  app.post('/dental/visits/:visitId/attachments',
    zValidator('param', CreateAttachmentParams, ve),
    zValidator('json', CreateAttachmentBody, ve),
    createAttachment as any,
  );

  return app;
}

async function seedVisit(status = 'active') {
  const { dentalVisits } = await import('./repos/visit.schema');
  const [visit] = await db.insert(dentalVisits).values({
    id: crypto.randomUUID(), patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: OWNER_MEMBER_ID, status: status as any,
    ...(status === 'active' ? { activatedAt: new Date() } : {}),
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).returning();
  return visit!;
}

async function seedNote(visitId: string) {
  const { visitNotes } = await import('./repos/treatment.schema');
  const [note] = await db.insert(visitNotes).values({
    id: crypto.randomUUID(), visitId, authorMemberId: OWNER_MEMBER_ID,
    subjective: 'S', objective: 'O', assessment: 'A', plan: 'P',
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).returning();
  return note!;
}

async function seedStudy() {
  const { imagingStudies, imagingStudyImages } = await import('@/handlers/dental-imaging/repos/imaging.schema');
  const [study] = await db.insert(imagingStudies).values({
    id: crypto.randomUUID(), patientId: PATIENT_ID, branchId: BRANCH_ID,
    acquiredBy: OWNER_USER.id, modality: 'cbct',
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  } as any).returning();
  const [image] = await db.insert(imagingStudyImages).values({
    id: crypto.randomUUID(), studyId: study!.id, fileId: crypto.randomUUID(),
    modality: 'cbct', sequenceNumber: 0,
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  } as any).returning();
  return { study: study!, image: image! };
}

function chartBody(visitId: string) {
  return JSON.stringify({
    visitId,
    patientId: PATIENT_ID,
    teeth: [{ toothNumber: 16, state: 'caries', surfaces: ['occlusal'] }],
  });
}

function imagingBody() {
  return JSON.stringify({
    patientId: PATIENT_ID, branchId: BRANCH_ID,
    filename: 'pano.jpg', mimeType: 'image/jpeg', size: 204800,
  });
}

function notesBody(visitId: string) {
  return JSON.stringify({ visitId, subjective: 'Patient reports pain', objective: 'Swelling' });
}

function treatmentBody(visitId: string) {
  return JSON.stringify({
    visitId, patientId: PATIENT_ID, toothNumber: 16, cdtCode: 'D2391',
    description: 'Composite restoration', priceCents: 15000,
  });
}

function attachmentBody(visitId: string) {
  return JSON.stringify({
    visitId, patientId: PATIENT_ID, imageType: 'photo',
    fileName: 'photo.jpg', filePath: 'attachments/photo.jpg',
    fileSizeBytes: 1024, mimeType: 'image/jpeg',
  });
}

// =============================================================================
// ALLOW — dental_assistant clinical-assist scope
// =============================================================================

describe('dental_assistant ALLOW — clinical-assist scope', () => {
  test('201 — assistant can capture imaging (createImagingStudy)', async () => {
    const app = buildApp(ASSISTANT_USER);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: imagingBody(),
    });
    expect(res.status).toBe(201);
  });

  test('201 — assistant can write chart conditions (upsertDentalChart)', async () => {
    const app = buildApp(ASSISTANT_USER);
    const visit = await seedVisit('active');
    const res = await app.request(`/dental/visits/${visit.id}/chart`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chartBody(visit.id),
    });
    expect(res.status).toBe(201);
  });

  test('200 — assistant can update a tooth condition (updateTooth)', async () => {
    const app = buildApp(ASSISTANT_USER);
    const visit = await seedVisit('active');
    // seed the chart first via owner-equivalent direct repo
    await app.request(`/dental/visits/${visit.id}/chart`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chartBody(visit.id),
    });
    const res = await app.request(`/dental/visits/${visit.id}/chart/teeth/16`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'filled', conditionCode: 'restored' }),
    });
    expect(res.status).toBe(200);
  });

  test('201 — assistant can initialize dentition (condition scaffold)', async () => {
    const app = buildApp(ASSISTANT_USER);
    const visit = await seedVisit('active');
    const res = await app.request(`/dental/patients/${PATIENT_ID}/dentition`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateOfBirth: '1990-01-01', visitId: visit.id }),
    });
    expect(res.status).toBe(201);
  });

  test('201 — assistant can DRAFT visit notes (upsertVisitNotes)', async () => {
    const app = buildApp(ASSISTANT_USER);
    const visit = await seedVisit('active');
    const res = await app.request(`/dental/visits/${visit.id}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: notesBody(visit.id),
    });
    expect(res.status).toBe(201);
  });

  test('201 — assistant can upload an attachment (createAttachment)', async () => {
    const app = buildApp(ASSISTANT_USER);
    const visit = await seedVisit('active');
    const res = await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: attachmentBody(visit.id),
    });
    expect(res.status).toBe(201);
  });
});

// =============================================================================
// DENY — dentist-only operations
// =============================================================================

describe('dental_assistant DENY — dentist-only operations', () => {
  test('403 — assistant CANNOT sign visit notes', async () => {
    const app = buildApp(ASSISTANT_USER);
    const visit = await seedVisit('active');
    await seedNote(visit.id);
    const res = await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  test('403 — assistant CANNOT add a treatment', async () => {
    const app = buildApp(ASSISTANT_USER);
    const visit = await seedVisit('active');
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: treatmentBody(visit.id),
    });
    expect(res.status).toBe(403);
  });

  test('403 — assistant CANNOT finalize a CBCT study', async () => {
    const app = buildApp(ASSISTANT_USER);
    const { study, image } = await seedStudy();
    const res = await app.request(`/dental/imaging/studies/${study.id}/cbct/finalize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId: image.id, dicomBase64: 'AAAA' }),
    });
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// CONTROL — dentist_owner is allowed where assistant is denied (deny is role-driven)
// =============================================================================

describe('control — dentist_owner allowed on dentist-only ops', () => {
  test('200 — owner can sign visit notes', async () => {
    const app = buildApp(OWNER_USER);
    const visit = await seedVisit('active');
    await seedNote(visit.id);
    const res = await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
  });

  test('201 — owner can add a treatment', async () => {
    const app = buildApp(OWNER_USER);
    const visit = await seedVisit('active');
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: treatmentBody(visit.id),
    });
    expect(res.status).toBe(201);
  });

  // Parity with the sign/treatment controls: prove the CBCT-finalize 403 above is
  // role-driven by showing dentist_owner CAN finalize a (valid synthetic) CBCT.
  test('200 — owner can finalize a CBCT study', async () => {
    const app = buildApp(OWNER_USER);
    const { study, image } = await seedStudy();
    const dicomBase64 = Buffer.from(buildSyntheticDicom()).toString('base64');
    const res = await app.request(`/dental/imaging/studies/${study.id}/cbct/finalize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId: image.id, dicomBase64 }),
    });
    expect(res.status).toBe(200);
  });
});
