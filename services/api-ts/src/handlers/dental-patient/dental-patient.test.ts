/**
 * dental-patient.test.ts — Module 1: Patient Records (FR2.x)
 *
 * FRs covered:
 *   FR2.1  Patient List (listDentalPatients)
 *   FR2.2  Patient Search (listDentalPatients?q=)
 *   FR2.4  Patient Profile (getDentalPatient)
 *   FR2.5  Duplicate Detection on create (createDentalPatient warning)
 *   FR2.7  Archive/Restore with EC1 guard
 *   FR2.8  Data Export CSV/JSON
 *   FR2.9  Status Management
 *   FR2.10 Follow-Up Indicators filter
 *   FR2.12 Follow-Up Notes CRUD
 *   FR2.13 Bulk Archive with EC1
 *   FR2.15 Safety Floor aggregation
 *   FR2.16 Emergency Contact fields
 *   FR2.17 Communication Preferences fields
 *   FR2.18 Recall/Next Visit Tracking
 *   FR2.21 Itemized Statement
 *   EC1    Archive blocked by active payment plan
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateDentalPatientBody,
  ListDentalPatientsQuery,
  GetDentalPatientParams,
  UpdateDentalPatientBody, UpdateDentalPatientParams,
  ArchiveDentalPatientParams,
  RestoreDentalPatientParams,
  BulkArchiveDentalPatientsBody,
  ExportDentalPatientsQuery,
  AddFollowUpNoteBody, AddFollowUpNoteParams,
  GetDentalPatientSafetyFloorParams,
  GetDentalPatientStatementParams,
} from '@/generated/openapi/validators';
import { createDentalPatient } from './identity/createDentalPatient';
import { listDentalPatients } from './identity/listDentalPatients';
import { getDentalPatient } from './identity/getDentalPatient';
import { updateDentalPatient } from './identity/updateDentalPatient';
import { archiveDentalPatient } from './identity/archiveDentalPatient';
import { restoreDentalPatient } from './identity/restoreDentalPatient';
import { bulkArchiveDentalPatients } from './identity/bulkArchiveDentalPatients';
import { exportDentalPatients } from './identity/exportDentalPatients';
import { listFollowUpNotes, addFollowUpNote } from './engagement/followUpNotes';
import { getDentalPatientSafetyFloor } from './identity/getDentalPatientSafetyFloor';
import { getDentalPatientStatement } from './identity/getDentalPatientStatement';
import { PatientRepository } from '../patient/repos/patient.repo';
import { patients } from '../patient/repos/patient.schema';
import { medicalHistoryEntries } from '../dental-clinical/repos/medical-history.schema';
import { dentalInvoices } from '../dental-billing/repos/dental-invoice.schema';
import { dentalPayments } from '../dental-billing/repos/dental-payment.schema';
import { DentalAuditRepository } from '@/db/audit.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const STAFF_USER_ID = 'c1000000-0000-1000-8000-000000000001';
const authedUser = { id: STAFF_USER_ID, email: 'staff@clinic.com' };

const BRANCH_ID = 'd1000000-0000-1000-8000-000000000001';
const ORG_ID = 'e1000000-0000-1000-8000-000000000001';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'DentalPatient Clinic', tier: 'solo', ownerPersonId: STAFF_USER_ID, countryCode: 'PH', createdBy: STAFF_USER_ID, updatedBy: STAFF_USER_ID }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: STAFF_USER_ID, updatedBy: STAFF_USER_ID }).onConflictDoNothing();
  // EM-PAT-002: use dentist_owner so archive tests pass with the new role guard
  await db.insert(dentalMemberships).values({ id: 'eedd0000-0000-1000-8000-000000000001', branchId: BRANCH_ID, personId: STAFF_USER_ID, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: STAFF_USER_ID, updatedBy: STAFF_USER_ID })
    .onConflictDoUpdate({ target: dentalMemberships.id, set: { role: 'dentist_owner', displayName: 'Owner' } });
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400);
};

// ─── App builder ─────────────────────────────────────────────────────────────

function buildTestApp(user?: typeof authedUser) {
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

  // Routes — export + bulk-archive must be before /:id
  app.get('/dental/patients/export', zValidator('query', ExportDentalPatientsQuery, ve), exportDentalPatients as any);
  app.post('/dental/patients/bulk-archive', zValidator('json', BulkArchiveDentalPatientsBody, ve), bulkArchiveDentalPatients as any);
  app.post('/dental/patients', zValidator('json', CreateDentalPatientBody, ve), createDentalPatient as any);
  app.get('/dental/patients', zValidator('query', ListDentalPatientsQuery, ve), listDentalPatients as any);
  app.get('/dental/patients/:id', zValidator('param', GetDentalPatientParams, ve), getDentalPatient as any);
  app.patch('/dental/patients/:id', zValidator('param', UpdateDentalPatientParams, ve), zValidator('json', UpdateDentalPatientBody, ve), updateDentalPatient as any);
  app.post('/dental/patients/:id/archive', zValidator('param', ArchiveDentalPatientParams, ve), archiveDentalPatient as any);
  app.post('/dental/patients/:id/restore', zValidator('param', RestoreDentalPatientParams, ve), restoreDentalPatient as any);
  app.get('/dental/patients/:id/follow-up-notes', zValidator('param', AddFollowUpNoteParams, ve), listFollowUpNotes as any);
  app.post('/dental/patients/:id/follow-up-notes', zValidator('param', AddFollowUpNoteParams, ve), zValidator('json', AddFollowUpNoteBody, ve), addFollowUpNote as any);
  app.get('/dental/patients/:id/safety-floor', zValidator('param', GetDentalPatientSafetyFloorParams, ve), getDentalPatientSafetyFloor as any);
  app.get('/dental/patients/:id/statement', zValidator('param', GetDentalPatientStatementParams, ve), getDentalPatientStatement as any);

  return app;
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function createPatient(
  app: Hono,
  displayName = 'Maria Santos',
  extra: Record<string, any> = {}
) {
  const res = await app.request('/dental/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, consentGiven: true, branchId: BRANCH_ID, ...extra }),
  });
  expect(res.status).toBe(201);
  return res.json() as Promise<any>;
}

async function truncate() {
  await db.execute(sql`TRUNCATE TABLE dental_payment, dental_invoice, medical_history_entry CASCADE`);
  await db.execute(sql`TRUNCATE TABLE patient CASCADE`);
  await db.execute(sql`TRUNCATE TABLE person CASCADE`);
}

// =============================================================================
// FR2.1: Patient List
// =============================================================================

describe('FR2.1: listDentalPatients', () => {
  afterEach(truncate);

  test('returns 200 with patients array', async () => {
    const app = buildTestApp(authedUser);
    await createPatient(app, 'Juan dela Cruz');
    await createPatient(app, 'Maria Santos');

    const res = await app.request(`/dental/patients?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(typeof body.pagination.totalCount).toBe('number');
  });

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(401);
  });

  test('filters by branchId', async () => {
    const app = buildTestApp(authedUser);
    await createPatient(app, 'Branch Patient', { branchId: BRANCH_ID });

    const res = await app.request(`/dental/patients?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.every((p: any) => p.preferredBranchId === BRANCH_ID)).toBe(true);
  });

  test('returns empty array when no patients', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request(`/dental/patients?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toEqual([]);
  });
});

// =============================================================================
// FR2.2: Patient Search
// =============================================================================

describe('FR2.2: patient search via ?q= param', () => {
  afterEach(truncate);

  test('finds patient by first name partial match', async () => {
    const app = buildTestApp(authedUser);
    await createPatient(app, 'Roberto Lim');
    await createPatient(app, 'Elena Garcia');

    const res = await app.request(`/dental/patients?branchId=${BRANCH_ID}&q=rob`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.some((p: any) => p.displayName.toLowerCase().includes('roberto'))).toBe(true);
  });

  test('finds patient by last name partial match', async () => {
    const app = buildTestApp(authedUser);
    await createPatient(app, 'Carlos Mendoza');

    const res = await app.request(`/dental/patients?branchId=${BRANCH_ID}&q=mendoz`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data.some((p: any) => p.displayName.includes('Mendoza'))).toBe(true);
  });

  test('returns empty when no match', async () => {
    const app = buildTestApp(authedUser);
    await createPatient(app, 'Maria Santos');

    const res = await app.request(`/dental/patients?branchId=${BRANCH_ID}&q=nonexistentxyz`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(0);
  });
});

// =============================================================================
// FR2.4: Patient Profile
// =============================================================================

describe('FR2.4: getDentalPatient — patient profile', () => {
  afterEach(truncate);

  test('returns full profile with visitCount, outstandingBalanceCents', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Elena Garcia');

    const res = await app.request(`/dental/patients/${p.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(p.id);
    expect(body.displayName).toBe('Elena Garcia');
    expect(typeof body.visitCount).toBe('number');
    expect(typeof body.outstandingBalanceCents).toBe('number');
    expect(body.status).toBe('active');
  });

  test('returns 404 for non-existent patient', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}`);
    expect(res.status).toBe(404);
  });

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// FR2.5: Duplicate Detection (non-blocking warning)
// =============================================================================

describe('FR2.5: duplicate detection on create', () => {
  afterEach(truncate);

  test('creates patient and returns warning when similar name exists', async () => {
    const app = buildTestApp(authedUser);

    // Create first patient
    await createPatient(app, 'Maria Santos');

    // Create second with same first name — should get warning
    const res = await app.request('/dental/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Maria Santos', consentGiven: true, branchId: BRANCH_ID }),
    });

    // Non-blocking: still creates (201), but includes warning
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).not.toBeNull();
    expect(body.warning).not.toBeNull();
    expect(body.warning.hasDuplicates).toBe(true);
    expect(body.warning.count).toBeGreaterThanOrEqual(1);
  });

  test('no warning when name is unique', async () => {
    const app = buildTestApp(authedUser);

    const res = await app.request('/dental/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Unique Patient XYZ', consentGiven: true, branchId: BRANCH_ID }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warning).toBeUndefined();
  });
});

// =============================================================================
// FR2.7: Archive/Restore + EC1
// =============================================================================

describe('FR2.7: archive and restore patient (EC1 guard)', () => {
  afterEach(truncate);

  test('archives an active patient successfully', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Carlos Mendoza');

    const res = await app.request(`/dental/patients/${p.id}/archive`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('archived');
  });

  test('EC1: returns error when patient has active payment plan', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Payment Plan Patient');

    // Set hasActivePaymentPlan=true directly
    await db.update(patients).set({ hasActivePaymentPlan: true }).where(eq(patients.id, p.id));

    const res = await app.request(`/dental/patients/${p.id}/archive`, { method: 'POST' });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('ARCHIVE_BLOCKED');
  });

  test('restore brings patient back to active status', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Roberto Lim');

    // Archive first
    await app.request(`/dental/patients/${p.id}/archive`, { method: 'POST' });

    // Then restore
    const res = await app.request(`/dental/patients/${p.id}/restore`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('active');
  });

  test('returns 404 for non-existent patient', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/archive`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// FR2.8: Data Export
// =============================================================================

describe('FR2.8: export dental patients', () => {
  afterEach(truncate);

  test('exports as JSON by default', async () => {
    const app = buildTestApp(authedUser);
    await createPatient(app, 'Export Test Patient');

    const res = await app.request(`/dental/patients/export?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.exportedAt).toBe('string');
    expect(typeof body.total).toBe('number');
  });

  test('exports as CSV with correct Content-Type', async () => {
    const app = buildTestApp(authedUser);
    await createPatient(app, 'CSV Patient');

    const res = await app.request(`/dental/patients/export?branchId=${BRANCH_ID}&format=csv`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/csv/i);
    const text = await res.text();
    expect(text).toContain('id,displayName');
    expect(text).toContain('CSV Patient');
  });

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/export?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// FR2.9: Status Management
// =============================================================================

describe('FR2.9: patient status management', () => {
  afterEach(truncate);

  test('new patient has status=active', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Status Patient');
    expect(p.status).toBe('active');
  });

  test('PATCH /dental/patients/:id can set status to archived', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Status Patient 2');

    const res = await app.request(`/dental/patients/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('archived');
  });

  test('returns 400 for invalid status value', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Status Patient 3');

    const res = await app.request(`/dental/patients/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid_status' }),
    });
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// FR2.10: Follow-Up Indicators
// =============================================================================

describe('FR2.10: follow-up indicator filter', () => {
  afterEach(truncate);

  test('filters patients by needsFollowUp=true', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Follow-Up Patient');

    // Set needsFollowUp=true
    await db.update(patients).set({ needsFollowUp: true }).where(eq(patients.id, p.id));

    const res = await app.request(`/dental/patients?branchId=${BRANCH_ID}&needsFollowUp=true`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.some((pt: any) => pt.id === p.id)).toBe(true);
    expect(body.data.every((pt: any) => pt.needsFollowUp === true)).toBe(true);
  });

  test('patient in list response includes needsFollowUp field', async () => {
    const app = buildTestApp(authedUser);
    await createPatient(app, 'NeedsFU Patient');

    const res = await app.request(`/dental/patients?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data[0]).toHaveProperty('needsFollowUp');
  });
});

// =============================================================================
// FR2.12: Follow-Up Notes CRUD
// =============================================================================

describe('FR2.12: follow-up notes CRUD', () => {
  afterEach(truncate);

  test('adds a follow-up note and returns 201', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Note Patient');

    const res = await app.request(`/dental/patients/${p.id}/follow-up-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Schedule 3-month recall for crown check' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.note.text).toBe('Schedule 3-month recall for crown check');
    expect(body.note.id).not.toBeNull();
    expect(body.note.createdAt).not.toBeNull();
    expect(body.total).toBe(1);
  });

  test('lists follow-up notes for patient', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Note Patient 2');

    await app.request(`/dental/patients/${p.id}/follow-up-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'First note' }),
    });
    await app.request(`/dental/patients/${p.id}/follow-up-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Second note' }),
    });

    const res = await app.request(`/dental/patients/${p.id}/follow-up-notes`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.notes.length).toBe(2);
    expect(body.total).toBe(2);
  });

  test('returns 400 when note text is empty', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Note Patient 3');

    const res = await app.request(`/dental/patients/${p.id}/follow-up-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    });
    expect(res.status).toBe(400);
  });

  test('adding a note sets needsFollowUp=true', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Note Patient 4');

    await app.request(`/dental/patients/${p.id}/follow-up-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Needs follow-up' }),
    });

    const profileRes = await app.request(`/dental/patients/${p.id}`);
    const profile = await profileRes.json() as any;
    expect(profile.needsFollowUp).toBe(true);
  });

  test('returns 404 for non-existent patient', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/follow-up-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Test' }),
    });
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// FR2.13: Bulk Archive with EC1
// =============================================================================

describe('FR2.13: bulk archive with EC1 guard', () => {
  afterEach(truncate);

  test('archives multiple patients and returns per-patient results', async () => {
    const app = buildTestApp(authedUser);
    const p1 = await createPatient(app, 'Bulk Patient 1');
    const p2 = await createPatient(app, 'Bulk Patient 2');

    const res = await app.request('/dental/patients/bulk-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientIds: [p1.id, p2.id] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.results.length).toBe(2);
    expect(body.successCount).toBe(2);
    expect(body.failCount).toBe(0);
  });

  test('EC1: reports failure for patients with active payment plans', async () => {
    const app = buildTestApp(authedUser);
    const p1 = await createPatient(app, 'Bulk No Plan');
    const p2 = await createPatient(app, 'Bulk Has Plan');

    // Mark p2 with active payment plan
    await db.update(patients).set({ hasActivePaymentPlan: true }).where(eq(patients.id, p2.id));

    const res = await app.request('/dental/patients/bulk-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientIds: [p1.id, p2.id] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.successCount).toBe(1);
    expect(body.failCount).toBe(1);
    const p2Result = body.results.find((r: any) => r.id === p2.id);
    expect(p2Result?.success).toBe(false);
    expect(p2Result?.reason).toMatch(/payment plan/i);
  });

  test('returns 400 when patientIds is empty', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request('/dental/patients/bulk-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/patients/bulk-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientIds: [NONEXISTENT_ID] }),
    });
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// FR2.15: Safety Floor
// =============================================================================

describe('FR2.15: patient safety floor', () => {
  afterEach(truncate);

  test('returns empty safety floor for new patient', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Safety Patient');

    const res = await app.request(`/dental/patients/${p.id}/safety-floor`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.patientId).toBe(p.id);
    expect(body.allergies).toEqual([]);
    expect(body.medications).toEqual([]);
    expect(body.conditions).toEqual([]);
    expect(body.hasAlerts).toBe(false);
  });

  test('returns allergies and hasAlerts=true when allergies exist', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Allergy Patient');

    // Seed a medical history allergy entry
    await db.insert(medicalHistoryEntries).values({
      id: crypto.randomUUID(),
      patientId: p.id,
      entryType: 'allergy',
      displayName: 'Penicillin',
      active: true,
      createdBy: STAFF_USER_ID,
      updatedBy: STAFF_USER_ID,
    });

    const res = await app.request(`/dental/patients/${p.id}/safety-floor`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.hasAlerts).toBe(true);
    expect(body.allergies.length).toBe(1);
    expect(body.allergies[0].displayName).toBe('Penicillin');
  });

  test('returns 404 for non-existent patient', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/safety-floor`);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// FR2.16: Emergency Contact fields
// =============================================================================

describe('FR2.16: emergency contact', () => {
  afterEach(truncate);

  test('sets and retrieves emergency contact', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'EC Patient');

    const ec = { name: 'Jose Santos', relationship: 'spouse', phone: '+63 917 123 4567' };

    const patchRes = await app.request(`/dental/patients/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emergencyContact: ec }),
    });
    expect(patchRes.status).toBe(200);

    const getRes = await app.request(`/dental/patients/${p.id}`);
    const body = await getRes.json() as any;
    expect(body.emergencyContact.name).toBe('Jose Santos');
    expect(body.emergencyContact.relationship).toBe('spouse');
  });
});

// =============================================================================
// FR2.17: Communication Preferences
// =============================================================================

describe('FR2.17: communication preferences', () => {
  afterEach(truncate);

  test('sets and retrieves communication preferences', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Comms Patient');

    const prefs = { preferredChannel: 'sms', reminderOptIn: true, preferredLanguage: 'fil' };

    const patchRes = await app.request(`/dental/patients/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communicationPreferences: prefs }),
    });
    expect(patchRes.status).toBe(200);

    const getRes = await app.request(`/dental/patients/${p.id}`);
    const body = await getRes.json() as any;
    expect(body.communicationPreferences.preferredChannel).toBe('sms');
    expect(body.communicationPreferences.reminderOptIn).toBe(true);
  });
});

// =============================================================================
// FR2.18: Recall / Next Visit Tracking
// =============================================================================

describe('FR2.18: recall / next visit tracking', () => {
  afterEach(truncate);

  test('sets recall date and note', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Recall Patient');

    const patchRes = await app.request(`/dental/patients/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recallDate: '2026-08-15', recallNote: '6-month cleaning' }),
    });
    expect(patchRes.status).toBe(200);

    const getRes = await app.request(`/dental/patients/${p.id}`);
    const body = await getRes.json() as any;
    expect(body.recallDate).toBe('2026-08-15');
    expect(body.recallNote).toBe('6-month cleaning');
  });

  test('recall date appears in patient list response', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Recall List Patient');

    await app.request(`/dental/patients/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recallDate: '2026-09-01' }),
    });

    const listRes = await app.request(`/dental/patients?branchId=${BRANCH_ID}`);
    const body = await listRes.json() as any;
    const found = body.data.find((pt: any) => pt.id === p.id);
    expect(found?.recallDate).toBe('2026-09-01');
  });
});

// =============================================================================
// FR2.21: Itemized Statement
// =============================================================================

describe('FR2.21: itemized patient statement', () => {
  afterEach(truncate);

  test('returns statement with summary, visits, invoices, payments arrays', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Statement Patient');

    const res = await app.request(`/dental/patients/${p.id}/statement`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.patientId).toBe(p.id);
    expect(body.summary).not.toBeNull();
    expect(typeof body.summary.totalBilledCents).toBe('number');
    expect(typeof body.summary.totalPaidCents).toBe('number');
    expect(typeof body.summary.outstandingBalanceCents).toBe('number');
    expect(Array.isArray(body.visits)).toBe(true);
    expect(Array.isArray(body.invoices)).toBe(true);
    expect(Array.isArray(body.payments)).toBe(true);
    expect(typeof body.generatedAt).toBe('string');
  });

  test('returns 404 for non-existent patient', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/statement`);
    expect(res.status).toBe(404);
  });

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/statement`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// EF-PAT-002: consent check returns 422 CONSENT_REQUIRED (not 400)
// =============================================================================

describe('EF-PAT-002: consent check returns 422 CONSENT_REQUIRED', () => {
  afterEach(truncate);

  test('POST /dental/patients with consentGiven:false returns 422 CONSENT_REQUIRED', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request('/dental/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'No Consent Patient', consentGiven: false, branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('CONSENT_REQUIRED');
  });

  test('POST /dental/patients with consentGiven:true returns 201', async () => {
    const app = buildTestApp(authedUser);
    const res = await app.request('/dental/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Consent Patient', consentGiven: true, branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(201);
  });
});

// =============================================================================
// EM-PAT-002: archiveDentalPatient requires dentist_owner role
// =============================================================================

describe('EM-PAT-002: archiveDentalPatient requires dentist_owner role', () => {
  afterEach(truncate);

  test('archive by hygienist (non-owner) returns 403', async () => {
    const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
    const HYGIENIST_ID = 'c1000000-0000-1000-8000-000000000099';
    await db.insert(dentalMemberships).values({
      id: 'eedd0000-0000-1000-8000-000000000099',
      branchId: BRANCH_ID,
      personId: HYGIENIST_ID,
      displayName: 'Hygienist',
      role: 'hygienist',
      status: 'active',
      pinFailedAttempts: 0,
      createdBy: STAFF_USER_ID,
      updatedBy: STAFF_USER_ID,
    }).onConflictDoNothing();

    const hygienistUser = { id: HYGIENIST_ID, email: 'hygienist@clinic.com' };
    const app = buildTestApp(hygienistUser);
    const ownerApp = buildTestApp(authedUser);
    const patientRes = await ownerApp.request('/dental/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Archive Target', consentGiven: true, branchId: BRANCH_ID }),
    });
    const p = await patientRes.json() as any;

    const res = await app.request(`/dental/patients/${p.id}/archive`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  test('archive by dentist_owner returns 200', async () => {
    // authedUser is dentist_owner (set in beforeAll) — no role change needed
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Owner Archive Patient');
    const res = await app.request(`/dental/patients/${p.id}/archive`, { method: 'POST' });
    expect(res.status).toBe(200);
  });
});

// =============================================================================
// EM-PAT-003: archiveDentalPatient parses and stores reason
// =============================================================================

describe('EM-PAT-003: archiveDentalPatient stores archiveNote', () => {
  afterEach(truncate);

  test('archive with reason body stores archiveNote on patient', async () => {
    // authedUser is dentist_owner (set in beforeAll)
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Reason Archive Patient');

    const res = await app.request(`/dental/patients/${p.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Patient moved to another clinic' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('archived');
    expect(body.archiveNote).toBe('Patient moved to another clinic');
  });

  test('archive without reason body stores null archiveNote', async () => {
    // authedUser is dentist_owner (set in beforeAll)
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'No Reason Archive Patient');

    const res = await app.request(`/dental/patients/${p.id}/archive`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('archived');
  });
});

// =============================================================================
// EM-PAT-004 / EF-PAT-003: listDentalPatients strict branchId scope
// =============================================================================

describe('EM-PAT-004/EF-PAT-003: listDentalPatients is strictly scoped to branchId', () => {
  afterEach(truncate);

  test('patients registered at another branch in the same org are NOT returned', async () => {
    const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
    const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

    const BRANCH_B_ID = 'd2000000-0000-1000-8000-000000000002';
    await db.insert(dentalBranches).values({
      id: BRANCH_B_ID,
      organizationId: ORG_ID,
      name: 'Branch B',
      timezone: 'Asia/Manila',
      createdBy: STAFF_USER_ID,
      updatedBy: STAFF_USER_ID,
    }).onConflictDoNothing();
    await db.insert(dentalMemberships).values({
      id: 'eedd0000-0000-1000-8000-000000000002',
      branchId: BRANCH_B_ID,
      personId: STAFF_USER_ID,
      displayName: 'Staff B',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
      createdBy: STAFF_USER_ID,
      updatedBy: STAFF_USER_ID,
    }).onConflictDoNothing();

    const appA = buildTestApp(authedUser);

    // Create patient at branch A
    await createPatient(appA, 'Branch A Patient', { branchId: BRANCH_ID });

    // Create patient at branch B using a separate app with branch B context
    const appB = new Hono();
    appB.use('*', async (c, next) => {
      (c as any).set('database', db);
      (c as any).set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
      (c as any).set('user', authedUser);
      (c as any).set('session', { id: 'test-session' });
      await next();
    });
    const { CreateDentalPatientBody: CDP } = await import('@/generated/openapi/validators');
    const { zValidator: zv } = await import('@hono/zod-validator');
    const { createDentalPatient: cdp } = await import('./identity/createDentalPatient');
    appB.post('/dental/patients', zv('json', CDP, (r: any, c: any) => c.json({ error: 'bad' }, 400)), cdp as any);
    await appB.request('/dental/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Branch B Patient', consentGiven: true, branchId: BRANCH_B_ID }),
    });

    // List with branchId=BRANCH_ID — should NOT include Branch B patient
    const res = await appA.request(`/dental/patients?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const names = body.data.map((p: any) => p.displayName);
    expect(names.some((n: string) => n.includes('Branch B Patient'))).toBe(false);
    expect(names.some((n: string) => n.includes('Branch A Patient'))).toBe(true);
  });
});

// =============================================================================
// EF-PAT-001: archived patient write-block
// =============================================================================

describe('EF-PAT-001: write operations on archived patient return 422 PATIENT_ARCHIVED', () => {
  afterEach(truncate);

  async function archivePatientDirectly(patientId: string) {
    await db.update(patients).set({ status: 'archived', archivedAt: new Date() }).where(eq(patients.id, patientId));
  }

  test('updateDentalPatient on archived patient returns 422 PATIENT_ARCHIVED', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Archive Write Patient');
    await archivePatientDirectly(p.id);

    const res = await app.request(`/dental/patients/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recallNote: 'blocked' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('PATIENT_ARCHIVED');
  });

  test('addFollowUpNote on archived patient returns 422 PATIENT_ARCHIVED', async () => {
    const app = buildTestApp(authedUser);
    const p = await createPatient(app, 'Archive Note Patient');
    await archivePatientDirectly(p.id);

    const res = await app.request(`/dental/patients/${p.id}/follow-up-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'should be blocked' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('PATIENT_ARCHIVED');
  });

  test('createRecall on archived patient returns 422 PATIENT_ARCHIVED', async () => {
    // Test createRecall via direct handler invocation (bypasses Hono routing complexity)
    const { createRecall: cr } = await import('./recalls/createRecall');
    const { AppError: AE } = await import('@/core/errors');

    const patientApp = buildTestApp(authedUser);
    const p = await createPatient(patientApp, 'Archive Recall Patient');
    await archivePatientDirectly(p.id);

    // Build a fake Hono context matching what the handler expects
    const fakeCtx: any = {
      get: (key: string) => {
        if (key === 'user') return authedUser;
        if (key === 'database') return db;
        if (key === 'logger') return { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
        return undefined;
      },
      req: {
        valid: (type: string) => {
          if (type === 'param') return { patientId: p.id };
          if (type === 'json') return { type: 'cleaning', dueDate: '2026-09-01' };
          return {};
        },
      },
      json: (body: any, status: number) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    };

    let caughtError: any = null;
    try {
      await cr(fakeCtx);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError instanceof AE).toBe(true);
    expect(caughtError.statusCode).toBe(422);
    expect(caughtError.code).toBe('PATIENT_ARCHIVED');
  });
});

// =============================================================================
// AL-006: PHI Export Audit Trail
// =============================================================================

describe('AL-006: exportDentalPatients writes audit record to DB', () => {
  afterEach(truncate);

  test('persists patient.export audit record after successful JSON export', async () => {
    const app = buildTestApp(authedUser);
    await createPatient(app, 'Audit Export Patient');

    const before = new Date();
    const res = await app.request(`/dental/patients/export?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);

    const auditRepo = new DentalAuditRepository(db);
    const { entries } = await auditRepo.query(
      { personId: STAFF_USER_ID, action: 'patient.export', branchId: BRANCH_ID },
      { limit: 10, offset: 0 },
    );
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const entry = entries[0]!;
    expect(entry.action).toBe('patient.export');
    expect(entry.resourceType).toBe('dental_patient');
    expect(entry.personId).toBe(STAFF_USER_ID);
    expect(entry.branchId).toBe(BRANCH_ID);
    expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  test('persists patient.export audit record after successful CSV export', async () => {
    const app = buildTestApp(authedUser);
    await createPatient(app, 'CSV Audit Patient');

    const res = await app.request(`/dental/patients/export?branchId=${BRANCH_ID}&format=csv`);
    expect(res.status).toBe(200);

    const auditRepo = new DentalAuditRepository(db);
    const { entries } = await auditRepo.query(
      { personId: STAFF_USER_ID, action: 'patient.export', branchId: BRANCH_ID },
      { limit: 10, offset: 0 },
    );
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const meta = entries[0]!.metadata as Record<string, unknown> | null;
    expect(meta?.['format']).toBe('csv');
  });
});
