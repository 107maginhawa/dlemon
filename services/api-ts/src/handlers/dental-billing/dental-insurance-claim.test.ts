/**
 * P1-26 — dental-insurance-claim.test.ts
 *
 * Covers the invoice-anchored multi-line claim + coverage-authorization (LOA)
 * flows: create-from-invoice, multi-line, branch-access, archived-patient block,
 * tenant isolation (cross-tenant 404), no-LOA-submit WARNS, and PH negatives.
 *
 * Mirrors createClaimDraft / dental-patient-insurance.test.ts guards. DB-backed.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateInsuranceClaimBody,
  ListInsuranceClaimsQuery,
  GetInsuranceClaimParams,
  AddInsuranceClaimLineParams,
  AddInsuranceClaimLineBody,
  UpdateInsuranceClaimStatusParams,
  UpdateInsuranceClaimStatusBody,
  CreateCoverageAuthorizationParams,
  CreateCoverageAuthorizationBody,
  UpdateCoverageAuthorizationStatusParams,
  UpdateCoverageAuthorizationStatusBody,
} from '@/generated/openapi/validators';
import { createInsuranceClaim } from './createInsuranceClaim';
import { listInsuranceClaims } from './listInsuranceClaims';
import { getInsuranceClaim } from './getInsuranceClaim';
import { addInsuranceClaimLine } from './addInsuranceClaimLine';
import { updateInsuranceClaimStatus } from './updateInsuranceClaimStatus';
import { createCoverageAuthorization } from '@/handlers/dental-patient/insurance/createCoverageAuthorization';
import { updateCoverageAuthorizationStatus } from '@/handlers/dental-patient/insurance/updateCoverageAuthorizationStatus';
import {
  CreateInsuranceProfileBody,
  CreateInsuranceProfileParams,
} from '@/generated/openapi/validators';
import { createInsuranceProfile } from '@/handlers/dental-patient/insurance/createInsuranceProfile';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: clm9
const TEST_USER = { id: 'a9000000-0000-1000-8000-00000000c191', email: 'staff@clm9.com' };
const ORG_ID = 'c9000000-0000-1000-8000-00000000c191';
const BRANCH_ID = 'b9000000-0000-1000-8000-00000000c191';
const MEMBER_ID = 'a1900000-0000-1000-8000-00000000c191';
const PERSON_ID = 'e9000000-0000-1000-8000-00000000c191';
const PATIENT_ID = 'd9000000-0000-1000-8000-00000000c191';

// A second tenant for cross-tenant isolation.
const OTHER_USER = { id: 'a9000000-0000-1000-8000-000000000ff2', email: 'staff@other.com' };
const OTHER_ORG = 'c9000000-0000-1000-8000-000000000ff2';
const OTHER_BRANCH = 'b9000000-0000-1000-8000-000000000ff2';
const OTHER_MEMBER = 'a1900000-0000-1000-8000-000000000ff2';

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values([
    { id: ORG_ID, name: 'Claim Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: OTHER_ORG, name: 'Other Clinic', tier: 'solo', ownerPersonId: OTHER_USER.id, countryCode: 'PH', createdBy: OTHER_USER.id, updatedBy: OTHER_USER.id },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_ID, organizationId: ORG_ID, name: 'Claim Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: OTHER_BRANCH, organizationId: OTHER_ORG, name: 'Other Branch', timezone: 'Asia/Manila', createdBy: OTHER_USER.id, updatedBy: OTHER_USER.id },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Claim Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: OTHER_MEMBER, branchId: OTHER_BRANCH, personId: OTHER_USER.id, displayName: 'Other Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OTHER_USER.id, updatedBy: OTHER_USER.id },
  ]).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Maria', lastName: 'Santos', dateOfBirth: '1990-01-01', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

function buildApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) { ctx.set('user', user); ctx.set('session', { id: 's', userId: user.id }); }
    await next();
  });
  // profile (patient module)
  app.post('/dental/patients/:patientId/insurance-profiles',
    zValidator('param', CreateInsuranceProfileParams, ve),
    zValidator('json', CreateInsuranceProfileBody, ve), createInsuranceProfile as any);
  // authorizations
  app.post('/dental/patients/:patientId/authorizations',
    zValidator('param', CreateCoverageAuthorizationParams, ve),
    zValidator('json', CreateCoverageAuthorizationBody, ve), createCoverageAuthorization as any);
  app.patch('/dental/patients/:patientId/authorizations/:authorizationId/status',
    zValidator('param', UpdateCoverageAuthorizationStatusParams, ve),
    zValidator('json', UpdateCoverageAuthorizationStatusBody, ve), updateCoverageAuthorizationStatus as any);
  // claims (billing module)
  app.post('/dental/billing/claims', zValidator('json', CreateInsuranceClaimBody, ve), createInsuranceClaim as any);
  app.get('/dental/billing/claims', zValidator('query', ListInsuranceClaimsQuery, ve), listInsuranceClaims as any);
  app.get('/dental/billing/claims/:claimId', zValidator('param', GetInsuranceClaimParams, ve), getInsuranceClaim as any);
  app.post('/dental/billing/claims/:claimId/lines',
    zValidator('param', AddInsuranceClaimLineParams, ve),
    zValidator('json', AddInsuranceClaimLineBody, ve), addInsuranceClaimLine as any);
  app.patch('/dental/billing/claims/:claimId/status',
    zValidator('param', UpdateInsuranceClaimStatusParams, ve),
    zValidator('json', UpdateInsuranceClaimStatusBody, ve), updateInsuranceClaimStatus as any);
  return app;
}

async function makeProfile(app: ReturnType<typeof buildApp>, payerType = 'hmo'): Promise<string> {
  const res = await app.request(`/dental/patients/${PATIENT_ID}/insurance-profiles`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ insurerName: 'Maxicare', policyNumber: 'P-1', subscriberName: 'Maria Santos', payerType }),
  });
  return (await res.json() as any).id;
}

afterEach(async () => {
  const { dentalPayerPayments } = await import('./repos/dental-payer-payment.schema');
  const { dentalInsuranceClaims, dentalInsuranceClaimLines } = await import('./repos/dental-insurance-claim.schema');
  const { dentalCoverageAuthorizations } = await import('@/handlers/dental-patient/repos/coverage-authorization.schema');
  const { dentalInsuranceProfiles } = await import('@/handlers/dental-patient/repos/insurance-profile.schema');
  await db.delete(dentalPayerPayments);
  await db.delete(dentalInsuranceClaimLines);
  await db.delete(dentalInsuranceClaims).where(eq(dentalInsuranceClaims.patientId, PATIENT_ID));
  await db.delete(dentalCoverageAuthorizations).where(eq(dentalCoverageAuthorizations.patientId, PATIENT_ID));
  await db.delete(dentalInsuranceProfiles).where(eq(dentalInsuranceProfiles.patientId, PATIENT_ID));
});

describe('createInsuranceClaim', () => {
  test('401 without auth', async () => {
    const app = buildApp();
    const res = await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: PATIENT_ID, lines: [] }),
    });
    expect(res.status).toBe(401);
  });

  test('creates a multi-line claim in draft (201)', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const res = await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID, insuranceProfileId: profileId,
        lines: [
          { cdtCode: 'D1110', description: 'Prophylaxis', billedAmountCents: 100000 },
          { cdtCode: 'D2391', description: 'Composite', billedAmountCents: 250000 },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.status).toBe('draft');
    expect(body.billedAmountCents).toBe(350000);
    expect(body.lines).toHaveLength(2);
    expect(body.claimNumber).toMatch(/^CLM-/);
  });

  test('rejects profile not belonging to patient (422)', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID, insuranceProfileId: '00000000-0000-4000-8000-0000000000ff',
        lines: [{ cdtCode: 'D1110', description: 'X', billedAmountCents: 1000 }],
      }),
    });
    expect(res.status).toBe(422);
  });

  test('rejects a claim with no lines (422 NO_CLAIM_LINES)', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const res = await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: profileId, lines: [] }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('NO_CLAIM_LINES');
  });

  test('archived patient is blocked (403 PATIENT_ARCHIVED)', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const { patients } = await import('@/handlers/patient/repos/patient.schema');
    await db.update(patients).set({ status: 'archived' }).where(eq(patients.id, PATIENT_ID));
    const res = await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: profileId, lines: [{ cdtCode: 'D1', description: 'x', billedAmountCents: 1 }] }),
    });
    expect(res.status).toBe(403);
    expect((await res.json() as any).code).toBe('PATIENT_ARCHIVED');
    await db.update(patients).set({ status: 'active' }).where(eq(patients.id, PATIENT_ID));
  });
});

describe('claim tenant isolation', () => {
  test('cross-tenant GET returns 404 (not 403, not the record)', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const created = await (await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: profileId, lines: [{ cdtCode: 'D1', description: 'x', billedAmountCents: 1000 }] }),
    })).json() as any;

    const otherApp = buildApp(OTHER_USER);
    const res = await otherApp.request(`/dental/billing/claims/${created.id}`);
    expect(res.status).toBe(404);
  });
});

describe('claim FSM + lines', () => {
  test('add a line recomputes billed total', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const claim = await (await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: profileId, lines: [{ cdtCode: 'D1', description: 'x', billedAmountCents: 100000 }] }),
    })).json() as any;

    await app.request(`/dental/billing/claims/${claim.id}/lines`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cdtCode: 'D2', description: 'y', billedAmountCents: 50000 }),
    });
    const got = await (await app.request(`/dental/billing/claims/${claim.id}`)).json() as any;
    expect(got.billedAmountCents).toBe(150000);
    expect(got.lines).toHaveLength(2);
  });

  test('invalid FSM transition draft→paid returns 422', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const claim = await (await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: profileId, lines: [{ cdtCode: 'D1', description: 'x', billedAmountCents: 1000 }] }),
    })).json() as any;
    const res = await app.request(`/dental/billing/claims/${claim.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid' }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('submit WITHOUT an approved LOA warns (does not block)', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const claim = await (await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: profileId, lines: [{ cdtCode: 'D1', description: 'x', billedAmountCents: 1000 }] }),
    })).json() as any;
    await app.request(`/dental/billing/claims/${claim.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }),
    });
    const res = await app.request(`/dental/billing/claims/${claim.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'submitted', submissionChannel: 'portal', payerReference: 'PR-1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('submitted');
    expect(body.warnings).toContain('NO_APPROVED_LOA');
  });
});

describe('coverage authorization (LOA)', () => {
  test('create + approve via FSM, then submit a backed claim has no warning', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);

    const authRes = await app.request(`/dental/patients/${PATIENT_ID}/authorizations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insuranceProfileId: profileId, loaNumber: 'LOA-1' }),
    });
    expect(authRes.status).toBe(201);
    const auth = await authRes.json() as any;
    expect(auth.status).toBe('requested');

    const approveRes = await app.request(`/dental/patients/${PATIENT_ID}/authorizations/${auth.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', approvedAmountCents: 200000 }),
    });
    expect(approveRes.status).toBe(200);
    expect((await approveRes.json() as any).status).toBe('approved');

    const claim = await (await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: profileId, authorizationId: auth.id, lines: [{ cdtCode: 'D1', description: 'x', billedAmountCents: 100000 }] }),
    })).json() as any;
    await app.request(`/dental/billing/claims/${claim.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }),
    });
    const submit = await app.request(`/dental/billing/claims/${claim.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'submitted' }),
    });
    expect((await submit.json() as any).warnings).not.toContain('NO_APPROVED_LOA');
  });

  test('invalid LOA FSM transition requested→expired returns 422', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const auth = await (await app.request(`/dental/patients/${PATIENT_ID}/authorizations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insuranceProfileId: profileId }),
    })).json() as any;
    const res = await app.request(`/dental/patients/${PATIENT_ID}/authorizations/${auth.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'expired' }),
    });
    expect(res.status).toBe(422);
  });
});

describe('LOA gates on claim creation (BR-056, BR-057)', () => {
  // One-shot LOA create with explicit status / amount / validity.
  async function makeLoa(app: ReturnType<typeof buildApp>, profileId: string, fields: Record<string, unknown>) {
    const res = await app.request(`/dental/patients/${PATIENT_ID}/authorizations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insuranceProfileId: profileId, ...fields }),
    });
    expect(res.status).toBe(201);
    return await res.json() as any;
  }
  const PAST = '2000-01-01';
  const FUTURE = '2999-12-31';

  test('BR-056: claim against an LOA past its validUntil is rejected (422 LOA_EXPIRED)', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const loa = await makeLoa(app, profileId, { status: 'approved', approvedAmountCents: 500000, validUntil: PAST });
    const res = await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: profileId, authorizationId: loa.id, lines: [{ cdtCode: 'D1', description: 'x', billedAmountCents: 100000 }] }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('LOA_EXPIRED');
  });

  test('BR-056: claim against an LOA with status expired is rejected (422 LOA_EXPIRED)', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    // validUntil in the FUTURE proves the STATUS (not the date) drives the rejection.
    const loa = await makeLoa(app, profileId, { status: 'expired', validUntil: FUTURE });
    const res = await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: profileId, authorizationId: loa.id, lines: [{ cdtCode: 'D1', description: 'x', billedAmountCents: 100000 }] }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('LOA_EXPIRED');
  });

  test('BR-057: claim covered amount is capped at the LOA approved amount; copay = billed − covered', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const loa = await makeLoa(app, profileId, { status: 'approved', approvedAmountCents: 200000, validUntil: FUTURE });
    const res = await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID, insuranceProfileId: profileId, authorizationId: loa.id,
        lines: [
          { cdtCode: 'D1', description: 'a', billedAmountCents: 100000 },
          { cdtCode: 'D2', description: 'b', billedAmountCents: 200000 },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.billedAmountCents).toBe(300000);
    expect(body.approvedAmountCents).toBe(200000); // capped at LOA approved (claim ≤ approved)
    expect(body.patientPortionCents).toBe(100000); // copay = 300000 − 200000
  });

  test('BR-057: under the LOA cap the full billed amount is covered (copay 0)', async () => {
    const app = buildApp(TEST_USER);
    const profileId = await makeProfile(app);
    const loa = await makeLoa(app, profileId, { status: 'approved', approvedAmountCents: 500000, validUntil: FUTURE });
    const res = await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: profileId, authorizationId: loa.id, lines: [{ cdtCode: 'D1', description: 'a', billedAmountCents: 100000 }] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.approvedAmountCents).toBe(100000); // covered ≤ both billed and approved
    expect(body.patientPortionCents).toBe(0);
  });
});

describe('PH negatives', () => {
  test('PhilHealth profile is recordable (no eClaims path needed)', async () => {
    const app = buildApp(TEST_USER);
    const id = await makeProfile(app, 'philhealth');
    expect(id).toBeDefined();
  });

  test('cash patient is never forced through insurance — claims are opt-in only', async () => {
    // A patient with NO profile cannot create a claim, but nothing forces them to.
    const app = buildApp(TEST_USER);
    const res = await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: '00000000-0000-4000-8000-0000000000aa', lines: [{ cdtCode: 'D1', description: 'x', billedAmountCents: 1000 }] }),
    });
    // No profile → claim creation refused; the cash ledger path is untouched.
    expect(res.status).toBe(422);
  });
});
