/**
 * dental-patient-alerts.test.ts — DentalAlert Entity (P2-001)
 *
 * alt01-AC-001  POST returns 201 with alert object (active defaults to true, severity defaults to medium)
 * alt01-AC-002  GET returns 200 with array of alerts (active + inactive)
 * alt01-AC-003  PATCH active→false deactivates alert
 * alt01-AC-004  401 without auth
 * alt01-AC-005  404 for non-existent patient
 * alt01-AC-006  400 when required fields missing (alertType)
 * alt01-AC-007  400 for invalid alertType enum
 * alt01-AC-008  404 for non-existent alertId on PATCH
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  DentalAlertParams,
  DentalAlertIdParams,
  CreateDentalAlertBody,
  UpdateDentalAlertBody,
} from './utils/dental-alert-validators';
import { createDentalAlert } from './alerts/createDentalAlert';
import { listDentalAlerts } from './alerts/listDentalAlerts';
import { updateDentalAlert } from './alerts/updateDentalAlert';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-000000000001', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000033';
const ORG_ID = 'c0000000-0000-1000-8000-000000000033';
const PATIENT_ID = 'd0000000-0000-1000-8000-000000000033';
const PERSON_ID = 'e0000000-0000-1000-8000-000000000033';
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
    id: ORG_ID, name: 'Alert Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-000000000033',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Staff Member', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Alert', lastName: 'Patient',
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
    '/dental/patients/:patientId/dental-alerts',
    zValidator('param', DentalAlertParams, ve),
    zValidator('json', CreateDentalAlertBody, ve),
    createDentalAlert as any,
  );
  app.get(
    '/dental/patients/:patientId/dental-alerts',
    zValidator('param', DentalAlertParams, ve),
    listDentalAlerts as any,
  );
  app.patch(
    '/dental/patients/:patientId/dental-alerts/:alertId',
    zValidator('param', DentalAlertIdParams, ve),
    zValidator('json', UpdateDentalAlertBody, ve),
    updateDentalAlert as any,
  );

  return app;
}

async function truncateAlerts() {
  const { dentalAlerts } = await import('./repos/dental-alert.schema');
  await db.delete(dentalAlerts).where(eq(dentalAlerts.patientId, PATIENT_ID));
}

afterEach(async () => {
  await truncateAlerts();
});

// =============================================================================
// alt01-AC-001: POST returns 201
// =============================================================================

describe('POST /dental/patients/:patientId/dental-alerts (alt01-AC-001, alt01-AC-006, alt01-AC-007)', () => {
  test('alt01-AC-001: creates alert and returns 201 with full object', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alertType: 'gag_reflex',
        severity: 'high',
        description: 'Severe gag reflex, use short impression trays',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.alertType).toBe('gag_reflex');
    expect(body.severity).toBe('high');
    expect(body.description).toBe('Severe gag reflex, use short impression trays');
    expect(body.active).toBe(true);
  });

  test('alt01-AC-001: severity defaults to medium', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType: 'latex_allergy' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.severity).toBe('medium');
    expect(body.active).toBe(true);
  });

  test('alt01-AC-001: accepts all valid alert types', async () => {
    const app = buildTestApp(TEST_USER);
    const types = [
      'gag_reflex', 'latex_allergy', 'needle_phobia', 'dental_anxiety',
      'tmj_disorder', 'excessive_salivation', 'dry_socket_history',
      'bisphosphonate_use', 'bleeding_disorder', 'other',
    ];

    for (const alertType of types) {
      await truncateAlerts();
      const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertType }),
      });
      expect(res.status).toBe(201);
    }
  });

  test('alt01-AC-007: rejects invalid alertType enum', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType: 'penicillin_allergy' }),
    });

    expect(res.status).toBe(400);
  });

  test('alt01-AC-006: returns 400 when alertType is missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ severity: 'high', description: 'No type provided' }),
    });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// alt01-AC-002: GET returns all alerts
// =============================================================================

describe('GET /dental/patients/:patientId/dental-alerts (alt01-AC-002)', () => {
  test('alt01-AC-002: returns empty array when no alerts exist', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('alt01-AC-002: returns list of alerts including inactive', async () => {
    const app = buildTestApp(TEST_USER);

    // Create two alerts
    await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType: 'needle_phobia' }),
    });
    await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType: 'dental_anxiety', severity: 'low' }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.length).toBe(2);
  });
});

// =============================================================================
// alt01-AC-003: PATCH active→false
// =============================================================================

describe('PATCH /dental/patients/:patientId/dental-alerts/:alertId (alt01-AC-003, alt01-AC-008)', () => {
  test('alt01-AC-003: deactivates alert (active→false)', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType: 'tmj_disorder', severity: 'high' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.active).toBe(false);
  });

  test('alt01-AC-003: updates description', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType: 'bleeding_disorder' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'On warfarin, check INR before procedure', severity: 'high' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.description).toBe('On warfarin, check INR before procedure');
    expect(body.severity).toBe('high');
  });

  test('alt01-AC-008: returns 404 for non-existent alertId', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });

    expect(res.status).toBe(404);
  });
});

// =============================================================================
// alt01-AC-004: 401 without auth
// =============================================================================

describe('Auth (alt01-AC-004)', () => {
  test('POST returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType: 'gag_reflex' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/dental-alerts`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// alt01-AC-005: 404 for non-existent patient
// =============================================================================

describe('Patient not found (alt01-AC-005)', () => {
  test('POST returns 404 for non-existent patient', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/dental-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType: 'gag_reflex' }),
    });

    expect(res.status).toBe(404);
  });

  test('GET returns 404 for non-existent patient', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/dental-alerts`);
    expect(res.status).toBe(404);
  });
});
