/**
 * dental-patient-insurance.test.ts — InsuranceProfile + ClaimDraft (B2 P1-007)
 *
 * AC-001  POST insurance-profile returns 201
 * AC-002  GET insurance-profiles returns array with created profile
 * AC-003  POST claim draft returns 201, status=draft
 * AC-004  GET claim readiness returns ready=false when icd10 missing
 * AC-005  PATCH claim status draft→ready returns 200
 * AC-006  PATCH claim status ready→draft returns 422 (invalid FSM)
 * AC-007  401 without auth
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  InsuranceProfileParams,
  InsuranceProfileIdParams,
  ClaimDraftParams,
  ClaimDraftIdParams,
  CreateInsuranceProfileBody,
  UpdateInsuranceProfileBody,
  CreateClaimDraftBody,
  UpdateClaimDraftStatusBody,
} from './utils/insurance-validators';
import { createInsuranceProfile } from './insurance/createInsuranceProfile';
import { listPatientInsuranceProfiles } from './insurance/listPatientInsuranceProfiles';
import { updateInsuranceProfile } from './insurance/updateInsuranceProfile';
import { createClaimDraft } from './insurance/createClaimDraft';
import { listPatientClaims } from './insurance/listPatientClaims';
import { getClaimReadiness } from './insurance/getClaimReadiness';
import { updateClaimStatus } from './insurance/updateClaimStatus';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique IDs (tag ins01)
const TEST_USER = { id: 'a0000000-0000-1000-8000-00000000a101', email: 'staff@ins01.com' };
const ORG_ID    = 'c0000000-0000-1000-8000-00000000a101';
const BRANCH_ID = 'b0000000-0000-1000-8000-00000000a101';
const PERSON_ID = 'e0000000-0000-1000-8000-00000000a101';
const PATIENT_ID = 'd0000000-0000-1000-8000-00000000a101';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-00000000a199';

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
    id: ORG_ID, name: 'Insurance Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Insurance Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-00000000a101',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Insurance Staff', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Carlos', lastName: 'Reyes',
    dateOfBirth: '1985-03-15',
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

  // Insurance profiles
  app.post('/dental/patients/:patientId/insurance-profiles',
    zValidator('param', InsuranceProfileParams, ve),
    zValidator('json', CreateInsuranceProfileBody, ve),
    createInsuranceProfile as any,
  );
  app.get('/dental/patients/:patientId/insurance-profiles',
    zValidator('param', InsuranceProfileParams, ve),
    listPatientInsuranceProfiles as any,
  );
  app.patch('/dental/patients/:patientId/insurance-profiles/:profileId',
    zValidator('param', InsuranceProfileIdParams, ve),
    zValidator('json', UpdateInsuranceProfileBody, ve),
    updateInsuranceProfile as any,
  );

  // Claims
  app.post('/dental/patients/:patientId/claims',
    zValidator('param', ClaimDraftParams, ve),
    zValidator('json', CreateClaimDraftBody, ve),
    createClaimDraft as any,
  );
  app.get('/dental/patients/:patientId/claims',
    zValidator('param', ClaimDraftParams, ve),
    listPatientClaims as any,
  );
  app.get('/dental/patients/:patientId/claims/:claimId/readiness',
    zValidator('param', ClaimDraftIdParams, ve),
    getClaimReadiness as any,
  );
  app.patch('/dental/patients/:patientId/claims/:claimId/status',
    zValidator('param', ClaimDraftIdParams, ve),
    zValidator('json', UpdateClaimDraftStatusBody, ve),
    updateClaimStatus as any,
  );

  return app;
}

async function truncateInsuranceData() {
  const { dentalClaimDrafts } = await import('./repos/claim-draft.schema');
  const { dentalInsuranceProfiles } = await import('./repos/insurance-profile.schema');
  await db.delete(dentalClaimDrafts).where(eq(dentalClaimDrafts.patientId, PATIENT_ID));
  await db.delete(dentalInsuranceProfiles).where(eq(dentalInsuranceProfiles.patientId, PATIENT_ID));
}

afterEach(async () => {
  await truncateInsuranceData();
});

// =============================================================================
// AC-007: 401 without auth
// =============================================================================

describe('Auth required (AC-007)', () => {
  test('POST insurance-profile returns 401 without user', async () => {
    const app = buildTestApp(); // no user
    const res = await app.request(`/dental/patients/${PATIENT_ID}/insurance-profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insurerName: 'Maxicare', policyNumber: 'P-001', subscriberName: 'Carlos Reyes',
      }),
    });
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// AC-001: POST insurance-profile returns 201
// =============================================================================

describe('POST /dental/patients/:patientId/insurance-profiles (AC-001)', () => {
  test('creates profile and returns 201', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/insurance-profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insurerName: 'Maxicare',
        policyNumber: 'P-001',
        subscriberName: 'Carlos Reyes',
        relationship: 'self',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.insurerName).toBe('Maxicare');
    expect(body.policyNumber).toBe('P-001');
    expect(body.active).toBe(true);
    expect(body.patientId).toBe(PATIENT_ID);
  });
});

// =============================================================================
// AC-002: GET insurance-profiles returns created profile
// =============================================================================

describe('GET /dental/patients/:patientId/insurance-profiles (AC-002)', () => {
  test('returns list including created profile', async () => {
    const app = buildTestApp(TEST_USER);

    // Create one
    await app.request(`/dental/patients/${PATIENT_ID}/insurance-profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insurerName: 'PhilHealth', policyNumber: 'PH-999', subscriberName: 'Carlos Reyes',
      }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/insurance-profiles`);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].insurerName).toBe('PhilHealth');
  });
});

// =============================================================================
// AC-003: POST claim draft returns 201, status=draft
// =============================================================================

describe('POST /dental/patients/:patientId/claims (AC-003)', () => {
  test('creates claim draft with status=draft', async () => {
    const app = buildTestApp(TEST_USER);

    // Create profile first
    const profileRes = await app.request(`/dental/patients/${PATIENT_ID}/insurance-profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insurerName: 'Maxicare', policyNumber: 'P-002', subscriberName: 'Carlos Reyes',
      }),
    });
    const profile = await profileRes.json() as any;

    const res = await app.request(`/dental/patients/${PATIENT_ID}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insuranceProfileId: profile.id,
        cdtCode: 'D0150',
        feeAmountCents: 50000,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.status).toBe('draft');
    expect(body.cdtCode).toBe('D0150');
    expect(body.feeAmountCents).toBe(50000);
    expect(body.patientId).toBe(PATIENT_ID);
  });
});

// =============================================================================
// AC-004: GET claim readiness returns ready=false when icd10 missing
// =============================================================================

describe('GET /dental/patients/:patientId/claims/:claimId/readiness (AC-004)', () => {
  test('ready=false when icd10Code is missing', async () => {
    const app = buildTestApp(TEST_USER);

    const profileRes = await app.request(`/dental/patients/${PATIENT_ID}/insurance-profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insurerName: 'Maxicare', policyNumber: 'P-003', subscriberName: 'Carlos Reyes',
      }),
    });
    const profile = await profileRes.json() as any;

    const claimRes = await app.request(`/dental/patients/${PATIENT_ID}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insuranceProfileId: profile.id,
        cdtCode: 'D0150',
        feeAmountCents: 50000,
        // no icd10Code
      }),
    });
    const claim = await claimRes.json() as any;

    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/claims/${claim.id}/readiness`,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.claimId).toBe(claim.id);
    expect(body.hasCdtCode).toBe(true);
    expect(body.hasIcd10Code).toBe(false);
    expect(body.hasInsuranceProfile).toBe(true);
    expect(body.hasFee).toBe(true);
    expect(body.ready).toBe(false);
  });
});

// =============================================================================
// AC-005: PATCH claim status draft→ready returns 200
// =============================================================================

describe('PATCH /dental/patients/:patientId/claims/:claimId/status (AC-005, AC-006)', () => {
  test('AC-005: draft→ready transition returns 200', async () => {
    const app = buildTestApp(TEST_USER);

    const profileRes = await app.request(`/dental/patients/${PATIENT_ID}/insurance-profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insurerName: 'Maxicare', policyNumber: 'P-004', subscriberName: 'Carlos Reyes',
      }),
    });
    const profile = await profileRes.json() as any;

    const claimRes = await app.request(`/dental/patients/${PATIENT_ID}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insuranceProfileId: profile.id,
        cdtCode: 'D0150',
        feeAmountCents: 50000,
      }),
    });
    const claim = await claimRes.json() as any;

    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/claims/${claim.id}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('ready');
  });

  test('AC-006: ready→draft transition returns 422 (invalid FSM)', async () => {
    const app = buildTestApp(TEST_USER);

    const profileRes = await app.request(`/dental/patients/${PATIENT_ID}/insurance-profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insurerName: 'Maxicare', policyNumber: 'P-005', subscriberName: 'Carlos Reyes',
      }),
    });
    const profile = await profileRes.json() as any;

    const claimRes = await app.request(`/dental/patients/${PATIENT_ID}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insuranceProfileId: profile.id,
        cdtCode: 'D0150',
        feeAmountCents: 50000,
      }),
    });
    const claim = await claimRes.json() as any;

    // Advance to ready
    await app.request(
      `/dental/patients/${PATIENT_ID}/claims/${claim.id}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      },
    );

    // Try invalid: ready→draft
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/claims/${claim.id}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      },
    );
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('INVALID_STATUS_TRANSITION');
  });
});
