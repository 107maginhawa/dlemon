/**
 * dental-pmd handler tests
 *
 * Covers: generatePMD, getPMDForVisit, importPMD, listImportedPMDs, listPMDs
 *
 * Tests HTTP-level behavior: auth, validation, success on seeded data.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { generatePMD } from './generatePMD';
import { PMDDocumentRepository } from './repos/pmd-document.repo';
import { getPMDForVisit } from './getPMDForVisit';
import { importPMD } from './importPMD';
import { getImportedPMD } from './getImportedPMD';
import { listImportedPMDs } from './listImportedPMDs';
import { listPMDs } from './listPMDs';
import {
  GeneratePMDBody,
  GeneratePMDParams,
  GetPMDForVisitParams,
  ImportPMDBody,
  GetImportedPMDParams,
  ListImportedPMDsQuery,
  ListPMDsQuery,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique BRANCH_ID + membership id (tag a04) breaks the cross-suite
// collision on dental_membership's (person_id, branch_id) partial unique index.
// Org/patient/person ids stay at their original deterministic values so
// onConflictDoNothing is a correct no-op against rows from prior runs.
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = '7b000000-0000-4000-8000-000000000a04';
const DENTIST_MEMBER_ID = '7c000000-0000-4000-8000-000000000a04';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';
const ORG_ID = 'ef000000-0000-1000-8000-000000000001';

const PERSON_ID = 'f1000000-0000-1000-8000-000000000001';

// Batch B: a SECOND dentist who is the visit's treating clinician — distinct
// from the completing actor (TEST_USER → DENTIST_MEMBER_ID) so the attestor
// test can prove authorMemberId binds the treating dentist, not the actor (#5).
const TREATING_DENTIST_MEMBER_ID = '7c000000-0000-4000-8000-000000000b04';
const TREATING_DENTIST_PERSON_ID = 'f1000000-0000-1000-8000-000000000b04';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'PMD Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: DENTIST_MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Dr. Test', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  // Batch B: narrowed demographics (DOB + sex) on the test patient's Person so
  // the PMD snapshot's demographics block has real values to capture (#6).
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', dateOfBirth: '1990-05-15', gender: 'female', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  // Batch B: the treating dentist (distinct from the actor) referenced by the
  // visit's dentistMemberId in the attestor test.
  await db.insert(persons).values({ id: TREATING_DENTIST_PERSON_ID, firstName: 'Treating', lastName: 'Dentist', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: TREATING_DENTIST_MEMBER_ID, branchId: BRANCH_ID, personId: TREATING_DENTIST_PERSON_ID, displayName: 'Dr. Treating', role: 'dentist_associate', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

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

  const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: r.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400); };
  const GeneratePMDBodyOnly = GeneratePMDBody.omit({ visitId: true });
  app.post('/dental/visits/:visitId/pmd', zValidator('param', GeneratePMDParams, ve), zValidator('json', GeneratePMDBodyOnly, ve), generatePMD as any);
  app.get('/dental/visits/:visitId/pmd', zValidator('param', GetPMDForVisitParams, ve), getPMDForVisit as any);
  app.post('/dental/pmd/import', zValidator('json', ImportPMDBody, ve), importPMD as any);
  app.get('/dental/pmd/imported/:id', zValidator('param', GetImportedPMDParams, ve), getImportedPMD as any);
  app.get('/dental/pmd/imported', zValidator('query', ListImportedPMDsQuery, ve), listImportedPMDs as any);
  app.get('/dental/visits/pmd', zValidator('query', ListPMDsQuery, ve), listPMDs as any);

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

// Batch B: a completed visit whose treating dentist is the given member —
// used to prove the snapshot attestor is the visit clinician, not the actor.
async function seedCompletedVisitTreatedBy(treatingMemberId: string) {
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: treatingMemberId,
  });
  return repo.complete(visit.id);
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE pmd_document, imported_pmd, dental_visit, medical_history_entry CASCADE`,
  );
});

// ---------------------------------------------------------------------------
// generatePMD
// ---------------------------------------------------------------------------

describe('generatePMD handler [AC-PMD-01]', () => {
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

  // V-PMD-003 (AC-PMD-001): non-completed visit → 422 VISIT_NOT_COMPLETED (business-rule
  // violation), not 400 VALIDATION_ERROR.
  test('returns 422 VISIT_NOT_COMPLETED when visit is not completed or locked', async () => {
    const visit = await seedDraftVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_NOT_COMPLETED');
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
    expect(body.checksum).not.toBeNull();
    expect(body.content).not.toBeNull();
    // Signing honestly deferred (decision #4 / FR12.4): V1 produces an UNSIGNED,
    // checksum-sealed document. Pin the honest deferral so a future accidental wiring
    // of signing (status 'signed' / a signature) is caught as a regression.
    expect(body.status).not.toBe('signed');
    expect(body.signature ?? null).toBeNull();
    expect(body.signedAt ?? null).toBeNull();
  });

  // N-PMD-02 (immutable-record integrity): the PMD's patientId is derived from the
  // visit (single source of truth). A body.patientId that disagrees with the visit's
  // patientId must be rejected — a caller must not be able to bind an arbitrary patient
  // into a checksum-sealed PMD record. (The checksum is tamper-evidence integrity,
  // NOT non-repudiation — digital signing is Phase-2/FR12.4.)
  test('returns 422 PATIENT_VISIT_MISMATCH when body.patientId does not match the visit patient', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    const OTHER_PATIENT = 'a0000000-0000-1000-8000-000000000099';
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: OTHER_PATIENT }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('PATIENT_VISIT_MISMATCH');
  });

  test('immutable PMD record binds the visit patientId (not an attacker-supplied one)', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    // Matching patientId → happy path; record + snapshot must carry the visit patient.
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.patientId).toBe(visit!.patientId);
    expect(body.patientId).toBe(PATIENT_ID);
    const content = JSON.parse(body.content);
    expect(content.patientId).toBe(visit!.patientId);
  });

  // AC-PMD-004 / BR-021: a generated PMD is a frozen, checksum-sealed snapshot.
  // Mutating a treatment on the SOURCE VISIT after generation MUST NOT change the
  // stored PMD's content or checksum (medico-legal immutability, §15). The handler
  // persists `content`+`checksum` at generation time; re-fetching must return them
  // byte-identical regardless of later edits to the underlying visit data.
  test('PMD content + checksum are immutable against future edits to the source visit treatments [AC-PMD-004]', async () => {
    const visit = await seedCompletedVisitWithTreatment();
    const app = buildTestApp(TEST_USER);

    // Generate the PMD and capture its frozen content + checksum.
    const genRes = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(genRes.status).toBe(201);
    const generated = await genRes.json() as any;
    const originalContent: string = generated.content;
    const originalChecksum: string = generated.checksum;
    expect(originalContent).toBeTruthy();
    expect(originalChecksum).toBeTruthy();
    // Sanity: the source treatment (cdtCode D2140) is captured in the snapshot.
    expect(JSON.parse(originalContent).treatments[0].cdtCode).toBe('D2140');

    // Mutate a treatment on the SOURCE visit after PMD generation.
    const treatmentRepo = new TreatmentRepository(db);
    const visitTreatments = await treatmentRepo.findByVisit(visit!.id);
    expect(visitTreatments.length).toBeGreaterThanOrEqual(1);
    const updated = await treatmentRepo.update(visitTreatments[0]!.id, {
      cdtCode: 'D9999',
      description: 'MUTATED AFTER PMD GENERATION',
      priceCents: 99999,
    });
    expect(updated!.cdtCode).toBe('D9999');

    // Re-fetch the PMD; the stored snapshot must be byte-identical and the
    // checksum unchanged — the mutated treatment must NOT leak into the PMD.
    const getRes = await app.request(`/dental/visits/${visit!.id}/pmd`);
    expect(getRes.status).toBe(200);
    const refetched = await getRes.json() as any;
    expect(refetched.content).toBe(originalContent);
    expect(refetched.checksum).toBe(originalChecksum);
    // The frozen snapshot still carries the ORIGINAL treatment data, not the mutation.
    const refetchedTreatments = JSON.parse(refetched.content).treatments;
    expect(refetchedTreatments[0].cdtCode).toBe('D2140');
    expect(refetchedTreatments[0].cdtCode).not.toBe('D9999');
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

describe('getPMDForVisit handler [AC-PMD-02]', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/pmd`);
    expect(res.status).toBe(401);
  });

  test('returns 204 when visit exists but no PMD has been generated yet', async () => {
    // Absent optional sub-resource → 204 (matches the perio-chart precedent),
    // so the client reads "no PMD" without a console-noise 404. A genuinely
    // nonexistent visit still 404s (getVisitOrThrow).
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`);
    expect(res.status).toBe(204);
  });

  test('returns 404 when the visit itself does not exist', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/pmd`);
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
        sourceDescription: 'Open Dental v21.1',
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
      body: JSON.stringify({ sourceFacility: 'City Dental Clinic', sourceDescription: 'Open Dental v21.1', content: '{}' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when sourceFacility is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, sourceDescription: 'Open Dental v21.1', content: '{}' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when content is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, sourceFacility: 'City Dental Clinic', sourceDescription: 'Open Dental v21.1' }),
    });
    expect(res.status).toBe(400);
  });

  // EF-PMD-005: sourceDescription is required
  test('returns 400 when sourceDescription is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        sourceFacility: 'City Dental Clinic',
        content: '{}',
        // sourceDescription intentionally omitted
      }),
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
        sourceDescription: 'Open Dental v21.1',
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

  test('sourceDescription is stored and returned [EF-PMD-005]', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        sourceFacility: 'Metro Dental Partners',
        sourceDescription: 'Dentrix G7',
        content: '{}',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.sourceDescription).toBe('Dentrix G7');
  });

  test('imported PMD content is stored verbatim and retrievable as-is [AC-PMD-03]', async () => {
    const app = buildTestApp(TEST_USER);
    const originalContent = { teeth: [{ toothNumber: 11, state: 'caries' }], prescriptions: [{ drug: 'Amoxicillin' }] };

    // Import
    const importRes = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        sourceFacility: 'External Clinic',
        sourceReference: 'EXT-001',
        sourceDescription: 'Dentrix G7',
        content: JSON.stringify(originalContent),
      }),
    });
    expect(importRes.status).toBe(201);
    const imported = await importRes.json() as any;

    // Read back the imported PMD
    const getRes = await app.request(`/dental/pmd/imported/${imported.id}`);
    expect(getRes.status).toBe(200);
    const retrieved = await getRes.json() as any;
    expect(retrieved.contentType).toBe('json');
    expect(retrieved.content).toEqual(originalContent);
    expect(retrieved.sourceFacility).toBe('External Clinic');
    expect(retrieved.sourceReference).toBe('EXT-001');
  });

  // EF-PMD-006: Checksum mismatch test cases
  test('returns 422 CHECKSUM_MISMATCH when provided checksum does not match content [EF-PMD-006]', async () => {
    const app = buildTestApp(TEST_USER);
    const content = JSON.stringify({ teeth: [], prescriptions: [] });
    const wrongChecksum = 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        sourceFacility: 'External Clinic',
        sourceDescription: 'Open Dental v21.1',
        content,
        checksum: wrongChecksum,
      }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('CHECKSUM_MISMATCH');
  });

  test('returns 201 when provided checksum matches content [EF-PMD-006]', async () => {
    const { createHash } = await import('node:crypto');
    const app = buildTestApp(TEST_USER);
    const content = JSON.stringify({ teeth: [], prescriptions: [] });
    const correctChecksum = `sha256-${createHash('sha256').update(content).digest('hex')}`;
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        sourceFacility: 'External Clinic',
        sourceDescription: 'Open Dental v21.1',
        content,
        checksum: correctChecksum,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
  });

  test('returns 201 when no checksum is provided (checksum is optional) [EF-PMD-006]', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        sourceFacility: 'External Clinic',
        sourceDescription: 'Open Dental v21.1',
        content: JSON.stringify({ teeth: [] }),
        // checksum intentionally omitted — should pass without verification
      }),
    });
    expect(res.status).toBe(201);
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
    expect(body.data).toEqual([]);
    expect(body.pagination.totalCount).toBe(0);
  });

  test('returns 200 with imported PMDs for patient', async () => {
    const app = buildTestApp(TEST_USER);

    // Import two PMDs
    await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, sourceFacility: 'Clinic A', sourceDescription: 'Open Dental v21.1', content: '{}' }),
    });
    await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, sourceFacility: 'Clinic B', sourceDescription: 'Dentrix G7', content: '{}' }),
    });

    const res = await app.request(`/dental/pmd/imported?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(2);
    expect(body.pagination.totalCount).toBe(2);
  });

  test('filters by patientId — does not return other patients records', async () => {
    const OTHER_PATIENT = 'a0000000-0000-1000-8000-000000000002';
    const app = buildTestApp(TEST_USER);

    await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, sourceFacility: 'Clinic A', sourceDescription: 'Open Dental v21.1', content: '{}' }),
    });
    await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: OTHER_PATIENT, sourceFacility: 'Clinic B', sourceDescription: 'Dentrix G7', content: '{}' }),
    });

    const res = await app.request(`/dental/pmd/imported?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].patientId).toBe(PATIENT_ID);
  });
});

// ---------------------------------------------------------------------------
// listPMDs
// ---------------------------------------------------------------------------

describe('listPMDs handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/pmd?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId query param is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/visits/pmd');
    expect(res.status).toBe(400);
  });

  test('returns 200 with empty list when no PMDs exist for patient', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/pmd?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toEqual([]);
    expect(body.pagination.totalCount).toBe(0);
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

    const res = await app.request(`/dental/visits/pmd?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // At least one PMD returned (generated status only — superseded excluded by repo)
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].patientId).toBe(PATIENT_ID);
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

  // EF-PMD-004: authorMemberId must be in the snapshot so the checksum binds the
  // attesting author to the content (integrity/attestation — NOT non-repudiation, which
  // would require a digital signature; signing is Phase-2/FR12.4).
  test('PMD content snapshot includes authorMemberId so the checksum binds the attesting author [EF-PMD-004]', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // EF-PMD-004: authorMemberId must be in content so the checksum binds it
    const content = JSON.parse(body.content);
    expect(typeof content.authorMemberId).toBe('string');
    expect(content.authorMemberId).toBeTruthy();
    // The authorMemberId in the snapshot must match the stored authorMemberId
    expect(content.authorMemberId).toBe(body.authorMemberId);
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

// ===========================================================================
// FR12.1 Batch B: snapshot carries the safety floor + narrowed demographics,
// and the attesting clinician is the visit's treating dentist (#5, #6).
// ===========================================================================

describe('FR12.1 Batch B: PMD snapshot safety floor + demographics + attestor', () => {
  async function generatePmd(visitId: string) {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visitId}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    return res;
  }

  // Decision #6: ship the narrowed demographics minimum (name, DOB, sex).
  test('snapshot includes narrowed patient demographics (name, DOB, sex)', async () => {
    const visit = await seedCompletedVisitTreatedBy(TREATING_DENTIST_MEMBER_ID);
    const res = await generatePmd(visit!.id);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    const content = JSON.parse(body.content);
    expect(content.demographics).toBeTruthy();
    expect(content.demographics.firstName).toBe('Test');
    expect(content.demographics.lastName).toBe('Patient');
    expect(content.demographics.dateOfBirth).toBe('1990-05-15');
    expect(content.demographics.gender).toBe('female');
  });

  // Decision #6 / FR12.1: the document exists to carry the safety floor.
  test('snapshot includes the safety floor (active allergies, medications, conditions)', async () => {
    const { medicalHistoryEntries } = await import('@/handlers/dental-clinical/repos/medical-history.schema');
    await db.insert(medicalHistoryEntries).values([
      { patientId: PATIENT_ID, entryType: 'allergy', displayName: 'Penicillin', code: 'Z88.0', codeSystem: 'ICD-10', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
      { patientId: PATIENT_ID, entryType: 'medication', displayName: 'Warfarin', code: '11289', codeSystem: 'RxNorm', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
      { patientId: PATIENT_ID, entryType: 'condition', displayName: 'Type 2 Diabetes', code: 'E11.9', codeSystem: 'ICD-10', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
      // inactive → must be excluded from the floor
      { patientId: PATIENT_ID, entryType: 'allergy', displayName: 'Resolved Latex Allergy', active: false, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
      // non-floor type → must be excluded
      { patientId: PATIENT_ID, entryType: 'procedure', displayName: 'Appendectomy', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    ]);

    const visit = await seedCompletedVisitTreatedBy(TREATING_DENTIST_MEMBER_ID);
    const res = await generatePmd(visit!.id);
    expect(res.status).toBe(201);
    const content = JSON.parse((await res.json() as any).content);

    expect(content.safetyFloor).toBeTruthy();
    const allergyNames = content.safetyFloor.allergies.map((a: any) => a.displayName);
    const medNames = content.safetyFloor.medications.map((m: any) => m.displayName);
    const condNames = content.safetyFloor.conditions.map((c: any) => c.displayName);
    expect(allergyNames).toContain('Penicillin');
    expect(allergyNames).not.toContain('Resolved Latex Allergy'); // inactive excluded
    expect(medNames).toContain('Warfarin');
    expect(condNames).toContain('Type 2 Diabetes');
    expect(condNames).not.toContain('Appendectomy'); // non-floor type excluded
    // coded entries carry their code + codeSystem for portability
    const penicillin = content.safetyFloor.allergies.find((a: any) => a.displayName === 'Penicillin');
    expect(penicillin.code).toBe('Z88.0');
    expect(penicillin.codeSystem).toBe('ICD-10');
  });

  // Decision #6 honesty pin: the V1 snapshot is the NARROWED set. The fields deferred
  // to Phase-2 (structured ICD-10 diagnoses + free-text clinical notes + full
  // identifiers) must NOT appear, and allergies live ONLY nested under safetyFloor
  // (never top-level) — the exact shape the corrected TypeSpec @example documents. A
  // wide-snapshot regression, or a return of the old fake `{allergies,diagnoses}`
  // example shape, flips this RED.
  test('snapshot is the narrowed V1 set: no top-level diagnoses/clinicalNotes/identifiers/allergies (#6)', async () => {
    const visit = await seedCompletedVisitTreatedBy(TREATING_DENTIST_MEMBER_ID);
    const res = await generatePmd(visit!.id);
    expect(res.status).toBe(201);
    const content = JSON.parse((await res.json() as any).content);
    // narrowed-set keys present
    expect(content).toHaveProperty('demographics');
    expect(content).toHaveProperty('safetyFloor');
    expect(content).toHaveProperty('treatments');
    expect(content).toHaveProperty('prescriptions');
    // Phase-2 / wide-set fields absent
    expect(content.diagnoses).toBeUndefined();
    expect(content.clinicalNotes).toBeUndefined();
    expect(content.notes).toBeUndefined();
    expect(content.identifiers).toBeUndefined();
    // allergies are nested under safetyFloor only, never top-level (matches the @example)
    expect(content.allergies).toBeUndefined();
    expect(content.safetyFloor).toHaveProperty('allergies');
  });

  // Decision #5: the attesting clinician is the visit's treating dentist —
  // NOT the actor who triggered completion (the actor is in the audit trail).
  test('snapshot attestor (authorMemberId) is the visit treating dentist, not the completing actor', async () => {
    // TEST_USER (actor) resolves to DENTIST_MEMBER_ID; the visit is treated by
    // a different member, so the two genuinely differ.
    const visit = await seedCompletedVisitTreatedBy(TREATING_DENTIST_MEMBER_ID);
    const res = await generatePmd(visit!.id);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.authorMemberId).toBe(TREATING_DENTIST_MEMBER_ID);
    const content = JSON.parse(body.content);
    expect(content.authorMemberId).toBe(TREATING_DENTIST_MEMBER_ID);
    expect(content.authorMemberId).not.toBe(DENTIST_MEMBER_ID); // not the actor's membership
  });

  // "checksum stable": the checksum seals the FULL extended content, and
  // regenerating over unchanged source is byte-deterministic (ordered reads).
  test('checksum seals the extended content and regeneration is deterministic', async () => {
    const { createHash } = await import('node:crypto');
    const { medicalHistoryEntries } = await import('@/handlers/dental-clinical/repos/medical-history.schema');
    await db.insert(medicalHistoryEntries).values([
      { patientId: PATIENT_ID, entryType: 'medication', displayName: 'Metformin', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
      { patientId: PATIENT_ID, entryType: 'allergy', displayName: 'Aspirin', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    ]);

    const visit = await seedCompletedVisitTreatedBy(TREATING_DENTIST_MEMBER_ID);
    const first = await (await generatePmd(visit!.id)).json() as any;
    const content1 = JSON.parse(first.content);
    // the seal covers demographics + safety floor (RED until Batch B lands)
    expect(content1.demographics).toBeTruthy();
    expect(content1.safetyFloor).toBeTruthy();
    expect(first.checksum).toBe(`sha256-${createHash('sha256').update(first.content).digest('hex')}`);

    // regenerate (supersede) — same source → byte-identical content + checksum
    const second = await (await generatePmd(visit!.id)).json() as any;
    expect(second.content).toBe(first.content);
    expect(second.checksum).toBe(first.checksum);
  });
});

// ===========================================================================
// Batch C / schema-fix #4: at most one live (generated) PMD per visit, and
// concurrent completion resolves idempotently (no duplicate generated rows).
// ===========================================================================

describe('Batch C: single-generated-PMD-per-visit invariant + race safety', () => {
  // Deterministic DB-invariant check: the partial unique index forbids a second
  // 'generated' row for the same visit.
  test('a second generated PMD row for the same visit is rejected by the DB', async () => {
    const visit = await seedCompletedVisit();
    const repo = new PMDDocumentRepository(db);
    const base = {
      visitId: visit!.id,
      patientId: PATIENT_ID,
      authorMemberId: DENTIST_MEMBER_ID,
      branchId: BRANCH_ID,
      checksum: 'sha256-deadbeef',
    };
    await repo.createOne({ ...base, content: '{"n":1}' });
    // second 'generated' row for the same visit → partial unique index violation
    await expect(repo.createOne({ ...base, content: '{"n":2}' })).rejects.toThrow();
  });

  // Concurrent completion: two generations fired together must not produce two
  // 'generated' rows, and neither call may 500 — the loser resolves idempotently.
  test('concurrent generation for the same visit yields exactly one generated PMD', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(TEST_USER);
    const fire = () =>
      app.request(`/dental/visits/${visit!.id}/pmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: PATIENT_ID }),
      });

    const results = await Promise.all([fire(), fire(), fire()]);
    for (const r of results) {
      expect(r.status).toBe(201); // no 500 — race handled idempotently
    }

    const repo = new PMDDocumentRepository(db);
    const generated = await repo.findMany({ visitId: visit!.id, status: 'generated' });
    expect(generated.length).toBe(1);
  });
});
