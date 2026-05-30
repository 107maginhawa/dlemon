/**
 * dental-patient-contacts.test.ts — PatientContact / Guardian (P0-A)
 *
 * Spec: docs/execution/slices/patient-contact/SLICE_SPEC.md
 * TDD: docs/execution/slices/patient-contact/TDD_PROOF.md
 *
 * AC-001  POST returns 201 with contact object
 * AC-002  GET returns 200 with array (active only)
 * AC-003  PATCH returns 200 with updated contact
 * AC-004  DELETE returns 204
 * AC-005  401 without auth
 * AC-006  404 for non-existent patient
 * AC-007  400 when name is missing / blank
 * AC-008  isGuardian flag stored and returned
 * AC-009  isEmergencyContact flag stored and returned
 * AC-010  PATCH 404 for non-existent contactId
 * BR-001  Minor guardian linkage via isGuardian
 * BR-002  name required non-blank
 * BR-003  Soft-deleted contacts excluded from GET
 * BR-004  isGuardian and isEmergencyContact independent flags
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  PatientContactParams,
  PatientContactContactParams,
  CreatePatientContactBody,
  UpdatePatientContactBody,
} from './utils/contact-validators';
import { createPatientContact } from './contacts/createPatientContact';
import { listPatientContacts } from './contacts/listPatientContacts';
import { updatePatientContact } from './contacts/updatePatientContact';
import { deletePatientContact } from './contacts/deletePatientContact';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-000000000001', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000011';
const ORG_ID = 'c0000000-0000-1000-8000-000000000011';
const PATIENT_ID = 'd0000000-0000-1000-8000-000000000011';
const PERSON_ID = 'e0000000-0000-1000-8000-000000000011';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Contacts Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Contacts Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-000000000011',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Staff Member', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Sofia', lastName: 'Dela Cruz',
    dateOfBirth: '2018-06-10', // ~8 years old — minor patient
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID,
    preferredBranchId: BRANCH_ID,
    status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
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
    if (user) ctx.set('user', user);
    await next();
  });

  app.post(
    '/dental/patients/:patientId/contacts',
    zValidator('param', PatientContactParams, ve),
    zValidator('json', CreatePatientContactBody, ve),
    createPatientContact as any,
  );
  app.get(
    '/dental/patients/:patientId/contacts',
    zValidator('param', PatientContactParams, ve),
    listPatientContacts as any,
  );
  app.patch(
    '/dental/patients/:patientId/contacts/:contactId',
    zValidator('param', PatientContactContactParams, ve),
    zValidator('json', UpdatePatientContactBody, ve),
    updatePatientContact as any,
  );
  app.delete(
    '/dental/patients/:patientId/contacts/:contactId',
    zValidator('param', PatientContactContactParams, ve),
    deletePatientContact as any,
  );

  return app;
}

async function truncateContacts() {
  const { dentalPatientContacts } = await import('./repos/patient-contact.schema');
  await db.delete(dentalPatientContacts).where(eq(dentalPatientContacts.patientId, PATIENT_ID));
}

afterEach(async () => {
  await truncateContacts();
});

// =============================================================================
// AC-001: POST returns 201 with contact object
// =============================================================================

describe('POST /dental/patients/:patientId/contacts (AC-001, AC-008, AC-009, BR-004)', () => {
  test('AC-001: creates contact and returns 201 with full object', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Maria Dela Cruz',
        relationship: 'parent',
        phone: '+639171234567',
        isGuardian: true,
        isEmergencyContact: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.name).toBe('Maria Dela Cruz');
    expect(body.relationship).toBe('parent');
    expect(body.phone).toBe('+639171234567');
  });

  test('AC-008: isGuardian flag stored and returned correctly', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Guardian Parent', isGuardian: true }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.isGuardian).toBe(true);
    expect(body.isEmergencyContact).toBe(false); // BR-004: independent
  });

  test('AC-009: isEmergencyContact flag stored and returned correctly', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Emergency Person', isEmergencyContact: true }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.isEmergencyContact).toBe(true);
    expect(body.isGuardian).toBe(false); // BR-004: independent
  });

  test('BR-001: can create guardian contact for minor patient', async () => {
    const app = buildTestApp(TEST_USER);

    // Sofia (PATIENT_ID) is a minor — DOB 2018-06-10
    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jose Dela Cruz',
        relationship: 'parent',
        phone: '+639179999999',
        isGuardian: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.isGuardian).toBe(true);
    expect(body.patientId).toBe(PATIENT_ID);
  });
});

// =============================================================================
// AC-002: GET returns 200 with array
// =============================================================================

describe('GET /dental/patients/:patientId/contacts (AC-002, BR-003)', () => {
  test('AC-002: returns 200 with empty array when no contacts', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('AC-002: returns all active contacts for patient', async () => {
    const app = buildTestApp(TEST_USER);

    // Create two contacts
    await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Contact One', isGuardian: true }),
    });
    await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Contact Two', isEmergencyContact: true }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    const names = body.map((c: any) => c.name);
    expect(names).toContain('Contact One');
    expect(names).toContain('Contact Two');
  });

  test('BR-003: soft-deleted contacts are excluded from list', async () => {
    const app = buildTestApp(TEST_USER);

    // Create then delete a contact
    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'To Be Deleted' }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as any;

    await app.request(`/dental/patients/${PATIENT_ID}/contacts/${created.id}`, {
      method: 'DELETE',
    });

    const listRes = await app.request(`/dental/patients/${PATIENT_ID}/contacts`);
    expect(listRes.status).toBe(200);
    const body = await listRes.json() as any;
    expect(body.find((c: any) => c.id === created.id)).toBeUndefined();
  });
});

// =============================================================================
// AC-003: PATCH returns 200 with updated contact
// =============================================================================

describe('PATCH /dental/patients/:patientId/contacts/:contactId (AC-003, AC-010)', () => {
  test('AC-003: updates name and returns 200', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Original Name' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name', phone: '+63917000000' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.name).toBe('Updated Name');
    expect(body.phone).toBe('+63917000000');
  });

  test('AC-003: can toggle isGuardian via PATCH', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Toggle Test' }),
    });
    const created = await createRes.json() as any;
    expect(created.isGuardian).toBe(false);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isGuardian: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.isGuardian).toBe(true);
  });

  test('AC-010: PATCH returns 404 for non-existent contactId', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Whatever' }),
    });

    expect(res.status).toBe(404);
  });
});

// =============================================================================
// AC-004: DELETE returns 204
// =============================================================================

describe('DELETE /dental/patients/:patientId/contacts/:contactId (AC-004)', () => {
  test('AC-004: soft-deletes contact and returns 204', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Delete Me' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts/${created.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);
  });

  test('AC-004: deleted contact returns 404 on subsequent delete', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Delete Twice' }),
    });
    const created = await createRes.json() as any;

    await app.request(`/dental/patients/${PATIENT_ID}/contacts/${created.id}`, { method: 'DELETE' });
    const res2 = await app.request(`/dental/patients/${PATIENT_ID}/contacts/${created.id}`, { method: 'DELETE' });

    expect(res2.status).toBe(404);
  });
});

// =============================================================================
// AC-005: 401 without auth
// =============================================================================

describe('Auth guard (AC-005)', () => {
  test('POST returns 401 without user', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });

    expect(res.status).toBe(401);
  });

  test('GET returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`);
    expect(res.status).toBe(401);
  });

  // CONF-DP-002: READ gate must deny a wrong principal, not just unauthenticated.
  // ROLE_PERMISSION_MATRIX grants sub-resource READ to all clinic roles, so the
  // denied principal is an authenticated non-member (assertPatientBranchAccess → 403).
  test('GET returns 403 for an authenticated non-member', async () => {
    const OUTSIDER = { id: 'a0000000-0000-1000-8000-0000000000ff', email: 'outsider@other.com' };
    const app = buildTestApp(OUTSIDER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`);
    expect(res.status).toBe(403);
  });

  test('PATCH returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(res.status).toBe(401);
  });

  test('DELETE returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts/${NONEXISTENT_ID}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// AC-006: 404 for non-existent patient
// =============================================================================

describe('Patient not found (AC-006)', () => {
  test('POST returns 404 for non-existent patient', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });

    expect(res.status).toBe(404);
  });

  test('GET returns 404 for non-existent patient', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/contacts`);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// AC-007 / BR-002: validation
// =============================================================================

describe('Validation (AC-007, BR-002)', () => {
  test('AC-007: POST returns 400 when name is missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relationship: 'parent' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/name/i);
  });

  test('BR-002: POST returns 400 when name is blank', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });

    expect(res.status).toBe(400);
  });
});
