/**
 * Module 10: Onboarding — FR7.2 CSV / JSON patient import + FR7.5 First-Time Detection
 *
 * Tests:
 * - Import via JSON array (happy path)
 * - Import via CSV body (happy path)
 * - Returns imported count and patient IDs
 * - 422 with errors when firstName missing
 * - 422 with errors when branchId missing
 * - Transaction rollback: if one row fails, none are imported
 * - 401 without auth
 * - Empty array → 400
 * - CSV missing required header columns → 422
 * - FR7.5: getOrgContext returns { org: null } for a fresh user with no org
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { importPatients } from './identity/importPatients';
import { getOrgContext } from '@/handlers/dental-org/getOrgContext';
import { buildTestApp as buildHarnessApp } from '@/tests/helpers/test-app';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const BRANCH_ID = 'bb000000-0000-1000-8000-000000000001';
const ORG_ID = 'ea000000-0000-1000-8000-000000000001';

// Second org/branch that TEST_USER is NOT a member of — cross-tenant isolation fixture
// (the 2-org pattern from the module-audit series; an import into org A must never
// attach/write to org B's branch).
const OTHER_ORG_ID = 'ea000000-0000-1000-8000-000000000002';
const OTHER_BRANCH_ID = 'bb000000-0000-1000-8000-000000000002';
const OTHER_OWNER = { id: '00000000-0000-0000-0000-000000000002', email: 'owner@other-clinic.com' };

// A same-branch member whose role is NOT dentist_owner — bulk import is owner-only
// (V-PAT-002 / CONF-DP-001 in importPatients.ts), so this caller must be 403'd.
const ASSOCIATE_USER = { id: '00000000-0000-0000-0000-000000000003', email: 'assoc@clinic.com' };

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Module10 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: 'eb000000-0000-1000-8000-000000000001', branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  // ASSOCIATE_USER is an active member of TEST_USER's branch but only dentist_associate (not owner)
  await db.insert(dentalMemberships).values({ id: 'eb000000-0000-1000-8000-000000000003', branchId: BRANCH_ID, personId: ASSOCIATE_USER.id, displayName: 'Associate', role: 'dentist_associate', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  // A SEPARATE org/branch owned by OTHER_OWNER; TEST_USER has NO membership here
  await db.insert(dentalOrganizations).values({ id: OTHER_ORG_ID, name: 'Rival Clinic', tier: 'solo', ownerPersonId: OTHER_OWNER.id, countryCode: 'PH', createdBy: OTHER_OWNER.id, updatedBy: OTHER_OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: OTHER_BRANCH_ID, organizationId: OTHER_ORG_ID, name: 'Rival Branch', timezone: 'Asia/Manila', createdBy: OTHER_OWNER.id, updatedBy: OTHER_OWNER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: 'eb000000-0000-1000-8000-000000000002', branchId: OTHER_BRANCH_ID, personId: OTHER_OWNER.id, displayName: 'Rival Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OTHER_OWNER.id, updatedBy: OTHER_OWNER.id }).onConflictDoNothing();
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
    if (user) ctx.set('user', user);
    await next();
  });
  app.post('/dental/patients/import', importPatients);
  return app;
}

afterEach(async () => {
  await db.execute(sql`TRUNCATE patient, person RESTART IDENTITY CASCADE`);
});

function jsonBody(rows: object[]) {
  return JSON.stringify(rows);
}

// Count patients written into a given branch — proves the cross-tenant guard runs
// BEFORE the all-or-nothing transaction (a rejected import writes zero rows).
async function countPatientsInBranch(branchId: string): Promise<number> {
  const result = await db.execute(
    sql`SELECT count(*)::int AS n FROM patient WHERE preferred_branch_id = ${branchId}`,
  );
  const rows = (result as unknown as { rows?: Array<{ n: number }> }).rows
    ?? (result as unknown as Array<{ n: number }>);
  return Number(rows[0]?.n ?? 0);
}

// ---------------------------------------------------------------------------
// FR7.2: JSON import
// ---------------------------------------------------------------------------

describe('POST /dental/patients/import (FR7.2)', () => {
  test('imports via JSON array', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([
        { firstName: 'Maria', lastName: 'Santos', dateOfBirth: '1990-05-15', branchId: BRANCH_ID },
        { firstName: 'Juan', lastName: 'dela Cruz', branchId: BRANCH_ID },
      ]),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.imported).toBe(2);
    expect(body.patients).toHaveLength(2);
    expect(body.patients[0].firstName).toBe('Maria');
  });

  test('422 when firstName missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([{ lastName: 'Santos', branchId: BRANCH_ID }]),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  test('422 when branchId missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([{ firstName: 'Ana' }]),
    });
    expect(res.status).toBe(422);
  });

  test('400 for non-array body', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Ana', branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(400);
  });

  test('401 without auth', async () => {
    const app = buildTestApp();
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([{ firstName: 'Ana', branchId: BRANCH_ID }]),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// FR7.2: CSV import
// ---------------------------------------------------------------------------

describe('POST /dental/patients/import via CSV', () => {
  test('imports via CSV body', async () => {
    const csv = [
      'firstName,lastName,dateOfBirth,branchId',
      `Maria,Santos,1990-05-15,${BRANCH_ID}`,
      `Juan,dela Cruz,1985-03-20,${BRANCH_ID}`,
    ].join('\n');

    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csv,
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.imported).toBe(2);
  });

  test('422 when required CSV column missing', async () => {
    const csv = [
      'lastName,dateOfBirth', // missing firstName and branchId
      'Santos,1990-05-15',
    ].join('\n');

    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csv,
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.errors.some((e: string) => e.toLowerCase().includes('firstname') || e.toLowerCase().includes('firstname'))).toBe(true);
  });

  test('422 when row has empty firstName', async () => {
    const csv = [
      'firstName,lastName,branchId',
      `,,${BRANCH_ID}`, // empty firstName
    ].join('\n');

    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csv,
    });
    expect(res.status).toBe(422);
  });

  // G3: RFC-4180 — quoted fields with embedded commas / escaped quotes must round-trip.
  // With naive line.split(','), the quoted lastName mis-splits and every later column
  // shifts (branchId ends up holding the dateOfBirth value), so the import 403/422s
  // entirely AND the demographic is silently corrupted.
  test('G3: quoted CSV field with embedded comma round-trips intact', async () => {
    const csv = [
      'firstName,lastName,dateOfBirth,branchId',
      `Maria,"dela Cruz, Jr.",1990-05-15,${BRANCH_ID}`,
      `Juan,"O""Brien, Sr.",1985-03-20,${BRANCH_ID}`,
    ].join('\n');

    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csv,
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.imported).toBe(2);
    const byFirst = Object.fromEntries(body.patients.map((p: any) => [p.firstName, p]));
    // Embedded comma preserved (not truncated to "dela Cruz" + a shifted column).
    expect(byFirst['Maria'].lastName).toBe('dela Cruz, Jr.');
    // Escaped double-quote ("") collapses to a single quote per RFC-4180.
    expect(byFirst['Juan'].lastName).toBe('O"Brien, Sr.');
  });
});

// ---------------------------------------------------------------------------
// FR7.2: CSV import through the REAL generated route (contract path)
//
// The other tests in this file mount the RAW handler, so they exercise the
// handler's own body parsing but BYPASS the generated zValidator. Through the
// real route, only what the contract (ImportPatientsBody) accepts can reach the
// handler. These tests use the validator-mounting harness (real
// authMiddleware → generated zValidator → handler) to prove CSV import is
// actually reachable in production via the `{ csv }` JSON field — previously the
// handler could parse CSV but no contract shape could deliver it through the
// route, so CSV import was effectively unreachable. (The legacy text/csv
// content-type + bare-array branches remain handler-internal; they are still
// covered by the raw-mount tests above and are not part of the wire contract.)
// ---------------------------------------------------------------------------

describe('POST /dental/patients/import — CSV via { csv } field through the real route', () => {
  test('imports via the { csv } contract field (generated zValidator → handler)', async () => {
    const csv = [
      'firstName,lastName,dateOfBirth,branchId',
      `Maria,Santos,1990-05-15,${BRANCH_ID}`,
      `Juan,dela Cruz,1985-03-20,${BRANCH_ID}`,
    ].join('\n');

    const app = buildHarnessApp({ db, user: TEST_USER });
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.imported).toBe(2);
  });

  test('imports via the { patients } contract field through the real route', async () => {
    const app = buildHarnessApp({ db, user: TEST_USER });
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patients: [{ firstName: 'Ana', branchId: BRANCH_ID }] }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.imported).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// INGESTION SAFETY + CROSS-TENANT + ROLE-GATING (adversarial — external-records-import audit)
//
// importPatients is the BUILT external-records ingestion surface (FR7.2 bulk
// CSV/JSON patient demographics). The handler enforces, before any DB write:
//   (1) cross-tenant isolation — assertBranchRole(user, row.branchId, ['dentist_owner'])
//       for EVERY unique branchId, so an import naming another org's branch is 403'd
//       (no person/patient row written into a branch the caller can't reach);
//   (2) owner-only role gate — a same-branch non-owner (dentist_associate) is 403'd;
//   (3) ingestion safety — malformed / oversized-field / garbage payloads return a
//       specific 4xx (400/422), never a 500/crash.
// These were previously UNPINNED (all happy-path tests used a matching-branch owner).
// ---------------------------------------------------------------------------

// V-XRI-001 — bulk patient import is cross-tenant isolated: the handler calls
// assertBranchRole(user, row.branchId, ['dentist_owner']) for EVERY unique
// branchId BEFORE the all-or-nothing tx, so a caller who is not an active
// dentist_owner of a named branch is 403'd and ZERO rows are written (no patient
// can be smuggled into another org's branch). The two tests below assert exactly
// that: the 403 refusal AND countPatientsInBranch == 0.
describe('V-XRI-001 — importPatients cross-tenant isolation (V-PAT-002 lens)', () => {
  test('V-XRI-001: 403 when importing into a branch the caller is NOT a member of', async () => {
    // TEST_USER is owner of BRANCH_ID but has NO membership in OTHER_BRANCH_ID.
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([{ firstName: 'Exfil', lastName: 'Target', branchId: OTHER_BRANCH_ID }]),
    });
    expect(res.status).toBe(403);
    // No patient/person row was written into the foreign branch (guard runs BEFORE the tx).
    expect(await countPatientsInBranch(OTHER_BRANCH_ID)).toBe(0);
  });

  test('403 + all-or-nothing when ONE row in a multi-branch batch targets a foreign branch', async () => {
    // Mixing a legal branch (own) with a foreign branch must fail the WHOLE import —
    // the per-branch assertBranchRole loop runs before the transaction, so even the
    // legal rows are NOT committed.
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([
        { firstName: 'Legit', branchId: BRANCH_ID },
        { firstName: 'Smuggled', branchId: OTHER_BRANCH_ID },
      ]),
    });
    expect(res.status).toBe(403);
    expect(await countPatientsInBranch(BRANCH_ID)).toBe(0);
    expect(await countPatientsInBranch(OTHER_BRANCH_ID)).toBe(0);
  });
});

describe('importPatients — role gating (owner-only bulk import)', () => {
  test('403 for a same-branch non-owner (dentist_associate)', async () => {
    // ASSOCIATE_USER is an active member of BRANCH_ID but only dentist_associate —
    // bulk import is restricted to dentist_owner (V-PAT-002 / CONF-DP-001).
    const app = buildTestApp(ASSOCIATE_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([{ firstName: 'Ana', branchId: BRANCH_ID }]),
    });
    expect(res.status).toBe(403);
    expect(await countPatientsInBranch(BRANCH_ID)).toBe(0);
  });
});

describe('importPatients — ingestion safety (untrusted external input → 4xx, never 500)', () => {
  test('malformed JSON body → 400 (not a 500/crash) [V-XRI-002]', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ this is not valid json',
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });

  test('empty JSON array → 400 (no-op, not a crash)', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([]),
    });
    expect(res.status).toBe(400);
  });

  test('oversized field values are accepted as data, never crash the parser (no unbounded-field 500)', async () => {
    // A 50k-char name is unusual but must be handled as ordinary string data —
    // validation must not throw an unhandled error. This pins that the validator
    // tolerates large field values (the surfaced row-count cap is a separate concern).
    const huge = 'x'.repeat(50_000);
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody([{ firstName: huge, branchId: BRANCH_ID }]),
    });
    // Either committed (201) or rejected with a 4xx — never a 500.
    expect(res.status).toBeLessThan(500);
    expect([201, 422, 400]).toContain(res.status);
  });

  test('CSV with a malformed/short data row → no crash (extra columns tolerated)', async () => {
    // A row with fewer/odd columns than the header must not throw — missing values
    // become empty strings and fail validation cleanly, not a parser exception.
    const csv = [
      'firstName,lastName,branchId',
      `OnlyOne`, // short row — lastName + branchId missing
    ].join('\n');
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csv,
    });
    // branchId missing → 422 (validation), never a 500.
    expect(res.status).toBe(422);
  });
});

// FR7.5: First-Time Detection — GET /dental/org/context returns null fields for new user
describe('FR7.5 — First-Time Detection', () => {
  const FRESH_USER = { id: 'ff000000-0000-0000-0000-000000000099', email: 'fresh@clinic.com' };

  function buildOrgContextApp(user?: typeof FRESH_USER) {
    const app = new Hono();
    app.onError((err, c) => {
      if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
      return c.json({ error: String(err.message) }, 500);
    });
    app.use('*', async (c, next) => {
      const ctx = c as any;
      ctx.set('database', db);
      if (user) ctx.set('user', user);
      await next();
    });
    app.get('/dental/org/context', getOrgContext as any);
    return app;
  }

  test('returns { org: null, branch: null, member: null } for a user with no org', async () => {
    // FRESH_USER has never completed onboarding — no org exists for this person ID
    const app = buildOrgContextApp(FRESH_USER);
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.org).toBeNull();
    expect(body.branch).toBeNull();
    expect(body.member).toBeNull();
  });

  test('returns 401 when called without auth', async () => {
    const app = buildOrgContextApp(); // no user
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(401);
  });
});
