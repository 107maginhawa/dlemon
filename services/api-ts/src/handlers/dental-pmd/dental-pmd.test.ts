/**
 * dental-pmd handler tests
 *
 * Covers: generatePMD, getPMDForVisit, importPMD, listImportedPMDs, listPMDs
 *
 * Tests HTTP-level behavior: auth, validation, success on seeded data.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { generatePMD } from './generatePMD';
import { getPMDForVisit } from './getPMDForVisit';
import { importPMD } from './importPMD';
import { listImportedPMDs } from './listImportedPMDs';
import { listPMDs } from './listPMDs';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const DENTIST_MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/dental/visits/:visitId/pmd', generatePMD as any);
  app.get('/dental/visits/:visitId/pmd', getPMDForVisit as any);
  app.post('/dental/pmd/import', importPMD as any);
  app.get('/dental/pmd/imported', listImportedPMDs as any);
  app.get('/dental/pmd', listPMDs as any);

  return app;
}

async function seedCompletedVisit() {
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: DENTIST_MEMBER_ID,
  });
  return repo.complete(visit.id);
}

async function seedDraftVisit() {
  const repo = new VisitRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: DENTIST_MEMBER_ID,
  });
}

async function seedCompletedVisitWithTreatment() {
  const visitRepo = new VisitRepository(db);
  const treatmentRepo = new TreatmentRepository(db);
  const visit = await visitRepo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: DENTIST_MEMBER_ID,
  });
  await treatmentRepo.createOne({
    visitId: visit.id,
    patientId: PATIENT_ID,
    cdtCode: 'D2140',
    description: 'Amalgam restoration — 1 surface',
    priceCents: 4500,
    conditionCode: 'K02.1',
    status: 'performed',
  });
  return visitRepo.complete(visit.id);
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE pmd_document, imported_pmd, dental_visit CASCADE`,
  );
});

// ---------------------------------------------------------------------------
// generatePMD
// ---------------------------------------------------------------------------

describe('generatePMD handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when visit does not exist', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when patientId is missing', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when visit is not completed or locked', async () => {
    const visit = await seedDraftVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with generated PMD on completed visit', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.visitId).toBe(visit!.id);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.status).toBe('generated');
    expect(body.checksum).toBeTruthy();
    expect(body.content).toBeTruthy();
  });

  test('supersedes previous PMD on second generation', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);

    const firstRes = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(firstRes.status).toBe(201);
    const firstBody = await firstRes.json() as any;

    const secondRes = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(secondRes.status).toBe(201);
    const secondBody = await secondRes.json() as any;
    expect(secondBody.id).not.toBe(firstBody.id);
    expect(secondBody.supersedesId).toBe(firstBody.id);
  });
});

// ---------------------------------------------------------------------------
// getPMDForVisit
// ---------------------------------------------------------------------------

describe('getPMDForVisit handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/pmd`);
    expect(res.status).toBe(401);
  });

  test('returns 404 when no PMD exists for visit', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`);
    expect(res.status).toBe(404);
  });

  test('returns 200 with PMD after it has been generated', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);

    // Generate first
    await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });

    const res = await app.request(`/dental/visits/${visit!.id}/pmd`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.visitId).toBe(visit!.id);
    expect(body.status).toBe('generated');
  });
});

// ---------------------------------------------------------------------------
// importPMD
// ---------------------------------------------------------------------------

describe('importPMD handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        sourceFacility: 'City Dental Clinic',
        content: '{"teeth":[]}',
      }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFacility: 'City Dental Clinic', content: '{}' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when sourceFacility is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, content: '{}' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when content is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, sourceFacility: 'City Dental Clinic' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with imported PMD on valid input', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        sourceFacility: 'Metro Dental Partners',
        sourceReference: 'PMD-2025-001',
        content: JSON.stringify({ teeth: [], prescriptions: [] }),
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.sourceFacility).toBe('Metro Dental Partners');
    expect(body.sourceReference).toBe('PMD-2025-001');
  });
});

// ---------------------------------------------------------------------------
// listImportedPMDs
// ---------------------------------------------------------------------------

describe('listImportedPMDs handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/pmd/imported?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId query param is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/imported');
    expect(res.status).toBe(400);
  });

  test('returns 200 with empty list when no imported PMDs', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/pmd/imported?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('returns 200 with imported PMDs for patient', async () => {
    const app = buildTestApp(TEST_USER);

    // Import two PMDs
    await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, sourceFacility: 'Clinic A', content: '{}' }),
    });
    await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, sourceFacility: 'Clinic B', content: '{}' }),
    });

    const res = await app.request(`/dental/pmd/imported?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items.length).toBe(2);
    expect(body.total).toBe(2);
  });

  test('filters by patientId — does not return other patients records', async () => {
    const OTHER_PATIENT = 'a0000000-0000-1000-8000-000000000002';
    const app = buildTestApp(TEST_USER);

    await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, sourceFacility: 'Clinic A', content: '{}' }),
    });
    await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: OTHER_PATIENT, sourceFacility: 'Clinic B', content: '{}' }),
    });

    const res = await app.request(`/dental/pmd/imported?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items.length).toBe(1);
    expect(body.items[0].patientId).toBe(PATIENT_ID);
  });
});

// ---------------------------------------------------------------------------
// listPMDs
// ---------------------------------------------------------------------------

describe('listPMDs handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/pmd?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId query param is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd');
    expect(res.status).toBe(400);
  });

  test('returns 200 with empty list when no PMDs exist for patient', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/pmd?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('returns 200 with generated PMDs for patient', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);

    // Generate a PMD
    await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });

    const res = await app.request(`/dental/pmd?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // At least one PMD returned (generated status only — superseded excluded by repo)
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items[0].patientId).toBe(PATIENT_ID);
  });
});

// ===========================================================================
// FR12.1: PMD content includes CDT procedures and RxNorm prescriptions
// ===========================================================================

describe('FR12.1: PMD content includes coded clinical data', () => {
  test('PMD content snapshot includes CDT code from performed treatment', async () => {
    const visit = await seedCompletedVisitWithTreatment();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // FR12.1: content must contain CDT codes (procedures)
    const content = JSON.parse(body.content);
    expect(Array.isArray(content.treatments)).toBe(true);
    expect(content.treatments.length).toBeGreaterThanOrEqual(1);
    expect(content.treatments[0].cdtCode).toBe('D2140');
  });

  test('PMD content includes patientId and visitId for identity anchoring', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // FR12.1: patient identity anchored in content
    const content = JSON.parse(body.content);
    expect(content.patientId).toBe(PATIENT_ID);
    expect(content.visitId).toBe(visit!.id);
  });

  test('PMD content includes prescriptions array (may be empty)', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // FR12.1: prescriptions (RxNorm) must be present in content (even if empty)
    const content = JSON.parse(body.content);
    expect(Array.isArray(content.prescriptions)).toBe(true);
  });
});

// ===========================================================================
// FR12.4: PMD has checksum for integrity (digital signature foundation)
// ===========================================================================

describe('FR12.4: PMD checksum (integrity anchor for digital signature)', () => {
  test('generated PMD has a non-empty checksum', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // FR12.4: checksum required (SHA-256 of content)
    expect(typeof body.checksum).toBe('string');
    expect(body.checksum.length).toBeGreaterThan(0);
  });

  test('two PMDs with different content produce different checksums', async () => {
    const visit1 = await seedCompletedVisit();
    const visit2 = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);

    const res1 = await app.request(`/dental/visits/${visit1!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    const res2 = await app.request(`/dental/visits/${visit2!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });

    const body1 = await res1.json() as any;
    const body2 = await res2.json() as any;
    // Different visit IDs → different content → different checksums
    expect(body1.checksum).not.toBe(body2.checksum);
  });
});
