/**
 * Erasure tenancy hardening (GAP-2 / FIX-001).
 *
 * The erasure request handler must NOT trust the caller-supplied tenantId/branchId
 * for a PATIENT subject — it derives them from the subject's patient row
 * (patient → preferredBranchId → organizationId) and rejects a forged/mismatched
 * tenant or branch. A bare-person subject (no patient row) keeps the supplied
 * tenancy (no resolution source; still platform-admin gated).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { openTestTx } from '@/core/test-tx';
import { AppError } from '@/core/errors';
import { persons } from '../person/repos/person.schema';
import { patients } from '../patient/repos/patient.schema';
import { dentalOrganizations } from '../dental-org/repos/organization.schema';
import { dentalBranches } from '../dental-org/repos/branch.schema';
import { requestErasureHandler } from './requestErasureHandler';
import { listErasureRequestsHandler } from './listErasureRequestsHandler';
import { RequestErasureBody, ListErasureQuery } from './utils/erasure-validators';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const ADMIN = { id: 'a4000000-0000-4000-8000-000000000001', email: 'admin@clinic.com', role: 'admin' };

const ORG_A = 'c4000000-0000-4000-8000-0000000000a1';
const BRANCH_A = 'c4000000-0000-4000-8000-0000000000b1';
const ORG_B = 'c4000000-0000-4000-8000-0000000000a2';
const BRANCH_B = 'c4000000-0000-4000-8000-0000000000b2';
const PERSON_PATIENT = 'c4000000-0000-4000-8000-0000000000e1';
const PATIENT_ID = 'c4000000-0000-4000-8000-0000000000f1';
const PERSON_PATIENT_B = 'c4000000-0000-4000-8000-0000000000e3';
const PATIENT_B_ID = 'c4000000-0000-4000-8000-0000000000f3';
const PERSON_BARE = 'c4000000-0000-4000-8000-0000000000e2';

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

function makeApp(db: NodePgDatabase, user: typeof ADMIN) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    ctx.set('user', user);
    await next();
  });
  app.post('/dental/erasure-requests', zValidator('json', RequestErasureBody, validationErrorHandler), requestErasureHandler as any);
  app.get('/dental/erasure-requests', zValidator('query', ListErasureQuery, validationErrorHandler), listErasureRequestsHandler as any);
  return app;
}

const J = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('erasure tenancy resolution (FIX-001)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    // ORG_A and ORG_B are both real orgs, each with one branch + one patient
    // subject (so list-scoping can be proven across two real tenants). In the
    // forged-tenant tests ORG_B doubles as a "wrong tenant" UUID for ORG_A's
    // patient — still a genuine mismatch the resolver rejects.
    await db.insert(dentalOrganizations).values([
      { id: ORG_A, name: 'Org A', tier: 'solo', ownerPersonId: ADMIN.id, countryCode: 'PH', createdBy: ADMIN.id, updatedBy: ADMIN.id },
      { id: ORG_B, name: 'Org B', tier: 'solo', ownerPersonId: 'a4000000-0000-4000-8000-0000000000b9', countryCode: 'PH', createdBy: ADMIN.id, updatedBy: ADMIN.id },
    ]);
    await db.insert(dentalBranches).values([
      { id: BRANCH_A, organizationId: ORG_A, name: 'Branch A', timezone: 'Asia/Manila', createdBy: ADMIN.id, updatedBy: ADMIN.id },
      { id: BRANCH_B, organizationId: ORG_B, name: 'Branch B', timezone: 'Asia/Manila', createdBy: ADMIN.id, updatedBy: ADMIN.id },
    ]);
    await db.insert(persons).values([
      { id: PERSON_PATIENT, firstName: 'Pat', lastName: 'Subject' },
      { id: PERSON_PATIENT_B, firstName: 'Pat', lastName: 'SubjectB' },
      { id: PERSON_BARE, firstName: 'Bare', lastName: 'Person' },
    ]);
    await db.insert(patients).values([
      { id: PATIENT_ID, person: PERSON_PATIENT, preferredBranchId: BRANCH_A, createdBy: ADMIN.id, updatedBy: ADMIN.id },
      { id: PATIENT_B_ID, person: PERSON_PATIENT_B, preferredBranchId: BRANCH_B, createdBy: ADMIN.id, updatedBy: ADMIN.id },
    ]);
  });

  afterEach(async () => { await teardown(); });

  test('forged tenantId for a patient subject is rejected (4xx)', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/erasure-requests', J({
      subjectPersonId: PERSON_PATIENT,
      subjectPatientId: PATIENT_ID,
      tenantId: ORG_B, // WRONG — patient belongs to ORG_A
      reason: 'GDPR erasure',
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('correct tenant for a patient subject persists the server-resolved tenant + branch', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/erasure-requests', J({
      subjectPersonId: PERSON_PATIENT,
      subjectPatientId: PATIENT_ID,
      tenantId: ORG_A,
      reason: 'GDPR erasure',
    }));
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.tenantId).toBe(ORG_A);
    expect(body.branchId).toBe(BRANCH_A);
  });

  test('tenant is resolved from subjectPersonId alone (no subjectPatientId); forged tenant rejected', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/erasure-requests', J({
      subjectPersonId: PERSON_PATIENT,
      tenantId: ORG_B, // WRONG — person's patient is in ORG_A
      reason: 'GDPR erasure',
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('forged branchId for a patient subject is rejected (4xx)', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/erasure-requests', J({
      subjectPersonId: PERSON_PATIENT,
      subjectPatientId: PATIENT_ID,
      tenantId: ORG_A,
      branchId: ORG_B, // not the patient's real branch (BRANCH_A)
      reason: 'GDPR erasure',
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('subjectPatientId that does not belong to subjectPersonId is rejected (4xx)', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/erasure-requests', J({
      subjectPersonId: PERSON_BARE, // different person
      subjectPatientId: PATIENT_ID, // belongs to PERSON_PATIENT
      tenantId: ORG_A,
      reason: 'GDPR erasure',
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('ghost subjectPatientId (non-existent) is rejected — cannot bypass resolution (4xx)', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/erasure-requests', J({
      subjectPersonId: PERSON_PATIENT, // a person who DOES have a branched patient (ORG_A)
      subjectPatientId: 'c4000000-0000-4000-8000-0000000000ff', // does not exist
      tenantId: ORG_B, // forged — would persist if the ghost id forced fallback
      reason: 'GDPR erasure',
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  // C-4 (patients-only V1): a person-only subject (no patient anchor) USED to be
  // accepted, keeping the caller-supplied tenantId — the exact cross-tenant leak
  // (a bare person + a forged tenant attribution the server cannot validate). V1
  // erasure is patients-only: reject it so every request carries a server-resolved
  // tenant via the subject's patient anchor.
  test('person-only subject (no patient anchor) is rejected — patients-only V1 (4xx)', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/erasure-requests', J({
      subjectPersonId: PERSON_BARE,
      tenantId: ORG_B, // no patient → no resolution source → no longer accepted
      reason: 'GDPR erasure',
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  // FIX-002 (ER-P2-2): the list endpoint is platform-admin only and platform-wide
  // by design; the optional tenantId filter scopes by the (server-resolved) tenant
  // attribution. With C-4 every request is patient-anchored, so both subjects here
  // are real patients in two different real orgs — the filter proves isolation.
  test('list is platform-wide for admin; tenantId filter scopes by resolved tenant', async () => {
    const app = makeApp(db, ADMIN);
    // Two patient-subject requests, resolving to ORG_A and ORG_B respectively.
    await app.request('/dental/erasure-requests', J({ subjectPersonId: PERSON_PATIENT, subjectPatientId: PATIENT_ID, tenantId: ORG_A, reason: 'A erasure' }));
    await app.request('/dental/erasure-requests', J({ subjectPersonId: PERSON_PATIENT_B, subjectPatientId: PATIENT_B_ID, tenantId: ORG_B, reason: 'B erasure' }));

    const all = await (await app.request('/dental/erasure-requests', { method: 'GET' })).json() as any;
    expect(all.data.length).toBeGreaterThanOrEqual(2);

    const scoped = await (await app.request(`/dental/erasure-requests?tenantId=${ORG_A}`, { method: 'GET' })).json() as any;
    expect(scoped.data.every((r: any) => r.tenantId === ORG_A)).toBe(true);
    expect(scoped.data.some((r: any) => r.subjectPersonId === PERSON_PATIENT)).toBe(true);
    expect(scoped.data.some((r: any) => r.tenantId === ORG_B)).toBe(false);
    expect(scoped.data.some((r: any) => r.subjectPersonId === PERSON_PATIENT_B)).toBe(false);
  });
});
