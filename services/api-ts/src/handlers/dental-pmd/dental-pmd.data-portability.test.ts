/**
 * Module 8: PMD — FR12.2 (read/parse), FR12.5 (import/accept), FR12.6 (share/export)
 *
 * Tests:
 * FR12.2 — GET /dental/pmd/imported/:id
 *   - Returns parsed JSON content when content is valid JSON
 *   - Returns raw text content when content is not JSON
 *   - 404 for unknown imported PMD
 *   - 401 without auth
 *
 * FR12.5 — POST /dental/pmd/import already tested in dental-pmd.test.ts
 *   This file adds: import with structured JSON content
 *
 * FR12.6 — GET /dental/visits/:visitId/pmd/export
 *   - Returns JSON file with Content-Disposition attachment header
 *   - Includes visit content, checksum, and metadata
 *   - 404 when no PMD exists for visit
 *   - 401 without auth
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { GeneratePMDBody, GeneratePMDParams, ImportPMDBody } from '@/generated/openapi/validators';
import { z } from 'zod';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { ImportedPMDRepository } from './repos/imported-pmd.repo';
import { getImportedPMD } from './getImportedPMD';
import { importPMD } from './importPMD';
import { generatePMD } from './generatePMD';
import { exportPMD } from './exportPMD';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const DENTIST_MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';
const ORG_ID = 'ee000000-0000-1000-8000-000000000001';
const PERSON_ID = 'f2000000-0000-1000-8000-000000000001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'PMDModule8 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: DENTIST_MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Dr. Test', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) { ctx.set('user', user); ctx.set('session', { id: 'test-session' }); }
    await next();
  });
  const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: r.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400); };
  const GeneratePMDBodyOnly = GeneratePMDBody.omit({ visitId: true });
  app.get('/dental/pmd/imported/:id', getImportedPMD);
  app.post('/dental/pmd/import', zValidator('json', ImportPMDBody, ve), importPMD as any);
  app.post('/dental/visits/:visitId/pmd', zValidator('param', GeneratePMDParams, ve), zValidator('json', GeneratePMDBodyOnly, ve), generatePMD as any);
  app.get('/dental/visits/:visitId/pmd/export', exportPMD);
  return app;
}

async function seedCompletedVisit() {
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({
    patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID,
  });
  return repo.complete(visit.id);
}

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE pmd_document, imported_pmd, dental_visit CASCADE`);
});

// ---------------------------------------------------------------------------
// FR12.2: Read / parse imported PMD
// ---------------------------------------------------------------------------

describe('GET /dental/pmd/imported/:id (FR12.2)', () => {
  test('returns parsed JSON content when content is valid JSON', async () => {
    const repo = new ImportedPMDRepository(db);
    const content = { allergies: ['penicillin'], medications: ['aspirin'] };
    const record = await repo.createOne({
      patientId: PATIENT_ID,
      sourceFacility: 'General Hospital',
      sourceDescription: 'Open Dental v21.1',
      content: JSON.stringify(content),
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/pmd/imported/${record.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.contentType).toBe('json');
    expect(body.content.allergies).toEqual(['penicillin']);
    expect(body.safetyFloorMerged).toBe(false);
  });

  test('returns raw text when content is not JSON', async () => {
    const repo = new ImportedPMDRepository(db);
    const record = await repo.createOne({
      patientId: PATIENT_ID,
      sourceFacility: 'Regional Clinic',
      sourceDescription: 'Legacy System v1.0',
      content: 'Plain text PMD content — allergies: penicillin',
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/pmd/imported/${record.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.contentType).toBe('text');
    expect(typeof body.content).toBe('string');
  });

  test('404 for unknown imported PMD', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/pmd/imported/${NONEXISTENT_ID}`);
    expect(res.status).toBe(404);
  });

  test('401 without auth', async () => {
    const app = buildTestApp();
    const res = await app.request(`/dental/pmd/imported/${NONEXISTENT_ID}`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// FR12.5: Import with structured JSON content
// ---------------------------------------------------------------------------

describe('POST /dental/pmd/import with structured content (FR12.5)', () => {
  test('imports PMD with JSON content', async () => {
    const app = buildTestApp(TEST_USER);
    const structuredContent = {
      visitDate: '2026-04-01',
      treatments: [{ cdtCode: 'D0120', description: 'Periodic oral evaluation' }],
      allergies: ['latex'],
    };
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        sourceFacility: 'External Clinic',
        sourceDescription: 'Open Dental v21.1',
        content: JSON.stringify(structuredContent),
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.sourceFacility).toBe('External Clinic');
  });
});

// ---------------------------------------------------------------------------
// FR12.6: Export / share PMD
// ---------------------------------------------------------------------------

describe('GET /dental/visits/:visitId/pmd/export (FR12.6)', () => {
  test('returns PMD as downloadable JSON with Content-Disposition', async () => {
    const visit = await seedCompletedVisit();
    if (!visit) throw new Error('Failed to seed visit');
    // Generate a PMD first
    const app = buildTestApp(TEST_USER);
    await app.request(`/dental/visits/${visit.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });

    const res = await app.request(`/dental/visits/${visit.id}/pmd/export`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/);
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment/);
    expect(res.headers.get('Content-Disposition')).toMatch(/\.json/);

    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.visitId).toBe(visit.id);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.checksum).not.toBeNull();
  });

  test('404 when no PMD exists for visit', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/pmd/export`);
    expect(res.status).toBe(404);
  });

  test('401 without auth', async () => {
    const app = buildTestApp();
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/pmd/export`);
    expect(res.status).toBe(401);
  });
});
