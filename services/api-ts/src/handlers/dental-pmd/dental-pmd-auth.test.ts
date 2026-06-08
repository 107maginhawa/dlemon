/**
 * dental-pmd RBAC / identity hardening tests
 *
 * Coverage hardening for the confidence/trace audit gap: dental-pmd previously
 * had ZERO deny-403 RBAC tests. This file pins:
 *
 *   (a) deny-403 — an authenticated user WITHOUT the required role/branch access
 *       is rejected with 403 on the mutating endpoint (generatePMD, restricted
 *       to dentist_owner/dentist_associate via assertBranchRole) and on a read
 *       endpoint (getPMDForVisit, requiring branch membership). Each is paired
 *       with an allow case proving an authorized persona gets 2xx.
 *
 *   (b) identity pin (N-PMD-02) — generatePMD derives patientId from the visit
 *       (the single source of truth), so a body.patientId that disagrees with
 *       the visit is rejected and the sealed record always carries the visit
 *       patient. The existing tests in dental-pmd.test.ts already pin the
 *       mismatch-rejection path; here we add a regression pin proving the
 *       generated PMD record + its checksum-sealed content are bound to the
 *       VISIT patient even when the (matching) body is supplied, and that no
 *       client-controllable patientId can leak into the record.
 *
 * Behavior already holds in code (assertBranchRole / assertBranchAccess +
 * generatePMD's `patientId = visit.patientId`); these stand as regression pins.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { generatePMD } from './generatePMD';
import { getPMDForVisit } from './getPMDForVisit';
import { listPMDs } from './listPMDs';
import { listImportedPMDs } from './listImportedPMDs';
import { exportPMD } from './exportPMD';
import {
  GeneratePMDBody,
  GeneratePMDParams,
  GetPMDForVisitParams,
  ListPMDsQuery,
  ListImportedPMDsQuery,
  ExportPMDParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique branch/membership ids (tag a05) avoid the cross-suite collision
// on dental_membership's (person_id, branch_id) partial unique index. Org/patient/
// person ids stay deterministic so onConflictDoNothing is a correct no-op.
const ORG_ID = 'ef000000-0000-1000-8000-000000000a05';
const BRANCH_ID = '7b000000-0000-4000-8000-000000000a05';
// V-PMD-008 cross-branch: a SECOND branch in the SAME org. A full-role member of
// this branch is NOT a member of BRANCH_ID and must be denied the BRANCH_ID
// patient's PMDs (branch is derived from the resource, never the caller's own
// branch context). Carry-forward class V-PAT-002 → V-VIS-011 → imaging V-IMG-002.
const OTHER_BRANCH_ID = '7b000000-0000-4000-8000-000000000a0b';
const PERSON_ID = 'f1000000-0000-1000-8000-000000000a05';
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000a05';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

// Personas
const OWNER = { id: '00000000-0000-0000-0000-000000000a51', email: 'owner@clinic.com' }; // dentist_owner — authorized
const HYGIENIST = { id: '00000000-0000-0000-0000-000000000a52', email: 'hyg@clinic.com' }; // staff_full member of branch — wrong role for generatePMD, but read-allowed
const OUTSIDER = { id: '00000000-0000-0000-0000-000000000a53', email: 'outsider@clinic.com' }; // NOT a member of the branch
// OTHER_BRANCH_DENTIST: a dentist_owner of OTHER_BRANCH (same org), with NO
// membership in BRANCH_ID. Denies for a DIFFERENT reason than OUTSIDER (who has
// no membership anywhere) — only this persona proves the resource-scoped-branch
// invariant, not merely "no membership anywhere".
const OTHER_BRANCH_DENTIST = { id: '00000000-0000-0000-0000-000000000a54', email: 'otherbranch@clinic.com' };
// PATIENT_SELF: a user whose id IS the patient's person id — V-PMD-008 self-access.
const PATIENT_SELF = { id: PERSON_ID, email: 'patient@self.com' };

const OWNER_MEMBER_ID = '7c000000-0000-4000-8000-000000000a51';
const HYG_MEMBER_ID = '7c000000-0000-4000-8000-000000000a52';
const OTHER_BRANCH_MEMBER_ID = '7c000000-0000-4000-8000-000000000a54';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'PMD Auth Clinic', tier: 'solo', ownerPersonId: OWNER.id, countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: OTHER_BRANCH_ID, organizationId: ORG_ID, name: 'Other Branch', timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  // dentist_owner — authorized for generatePMD
  await db.insert(dentalMemberships).values({ id: OWNER_MEMBER_ID, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Dr. Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  // staff_full — a branch member but NOT a clinician → must be denied generatePMD, allowed reads
  await db.insert(dentalMemberships).values({ id: HYG_MEMBER_ID, branchId: BRANCH_ID, personId: HYGIENIST.id, displayName: 'Front Desk', role: 'staff_full', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  // dentist_owner of OTHER_BRANCH (same org), but NOT a member of BRANCH_ID.
  await db.insert(dentalMemberships).values({ id: OTHER_BRANCH_MEMBER_ID, branchId: OTHER_BRANCH_ID, personId: OTHER_BRANCH_DENTIST.id, displayName: 'Dr. Other', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  // OUTSIDER intentionally has NO membership in any branch.

  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Auth', lastName: 'Patient', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
});

function buildTestApp(user?: { id: string; email: string }) {
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
  app.get('/dental/visits/:visitId/pmd/export', zValidator('param', ExportPMDParams, ve), exportPMD as any);
  app.get('/dental/visits/pmd', zValidator('query', ListPMDsQuery, ve), listPMDs as any);
  app.get('/dental/pmd/imported', zValidator('query', ListImportedPMDsQuery, ve), listImportedPMDs as any);

  return app;
}

async function seedCompletedVisit() {
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: OWNER_MEMBER_ID,
  });
  return repo.complete(visit.id);
}

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE pmd_document, imported_pmd, dental_visit CASCADE`);
});

// ---------------------------------------------------------------------------
// (a) deny-403 — generatePMD requires dentist_owner / dentist_associate
// ---------------------------------------------------------------------------

describe('generatePMD RBAC [N-PMD deny-403]', () => {
  test('DENY: branch member with a non-clinician role (staff_full) → 403', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(403);
  });

  test('DENY: non-member of the branch → 403', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(OUTSIDER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(403);
  });

  test('ALLOW: dentist_owner of the branch → 201', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(OWNER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// (a) deny-403 — getPMDForVisit requires branch membership (read)
// ---------------------------------------------------------------------------

describe('getPMDForVisit RBAC [N-PMD deny-403]', () => {
  async function generateAsOwner(visitId: string) {
    const app = buildTestApp(OWNER);
    const res = await app.request(`/dental/visits/${visitId}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
  }

  test('DENY: non-member of the branch cannot read the visit PMD → 403', async () => {
    const visit = await seedCompletedVisit();
    await generateAsOwner(visit!.id);
    const app = buildTestApp(OUTSIDER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`);
    expect(res.status).toBe(403);
  });

  test('ALLOW: any active branch member (staff_full) can read the visit PMD → 200', async () => {
    const visit = await seedCompletedVisit();
    await generateAsOwner(visit!.id);
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.visitId).toBe(visit!.id);
  });
});

// ---------------------------------------------------------------------------
// (b) identity pin — generatePMD binds patientId to the VISIT (N-PMD-02)
// ---------------------------------------------------------------------------

describe('generatePMD identity binding [N-PMD-02 regression pin]', () => {
  test('a body.patientId disagreeing with the visit patient is rejected → 422 PATIENT_VISIT_MISMATCH', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(OWNER);
    const FOREIGN_PATIENT = 'a0000000-0000-1000-8000-0000000000ff';
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: FOREIGN_PATIENT }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('PATIENT_VISIT_MISMATCH');
  });

  test('the sealed PMD record + checksum-content are bound to the VISIT patient (not client input)', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(OWNER);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // Record column is the visit patient...
    expect(body.patientId).toBe(visit!.patientId);
    expect(body.patientId).toBe(PATIENT_ID);
    // ...and so is the checksum-sealed content snapshot (no client-controllable leak).
    const content = JSON.parse(body.content);
    expect(content.patientId).toBe(visit!.patientId);
  });
});

// ---------------------------------------------------------------------------
// (c) patient-self read/export — V-PMD-008 / EF-PMD-007 (P1-BE-3)
// A user whose id === patient.person may read/export their OWN PMDs even without
// a branch membership (the `patient.person === user.id` allow branch). Pinned as
// not-403 against the shipped handlers.
// ---------------------------------------------------------------------------

describe('patient-self read/export [V-PMD-008]', () => {
  test('ALLOW: patient-self getPMDForVisit → not 403', async () => {
    const visit = await seedCompletedVisit();
    const app = buildTestApp(PATIENT_SELF);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`);
    expect(res.status).not.toBe(403);
  });

  test('ALLOW: patient-self listPMDs (own patientId) → not 403', async () => {
    const app = buildTestApp(PATIENT_SELF);
    const res = await app.request(`/dental/visits/pmd?patientId=${PATIENT_ID}`);
    expect(res.status).not.toBe(403);
  });

  test('ALLOW: patient-self listImportedPMDs (own patientId) → not 403', async () => {
    const app = buildTestApp(PATIENT_SELF);
    const res = await app.request(`/dental/pmd/imported?patientId=${PATIENT_ID}`);
    expect(res.status).not.toBe(403);
  });

  test('ALLOW: patient-self exportPMD of own generated PMD → not 403', async () => {
    const visit = await seedCompletedVisit();
    // Generate a PMD as the owner so there is something to export.
    const ownerApp = buildTestApp(OWNER);
    const gen = await ownerApp.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(gen.status).toBe(201);

    const selfApp = buildTestApp(PATIENT_SELF);
    const res = await selfApp.request(`/dental/visits/${visit!.id}/pmd/export`);
    expect(res.status).not.toBe(403);
  });

  test('DENY: an unrelated outsider (no membership, not patient-self) listPMDs → 403', async () => {
    const app = buildTestApp(OUTSIDER);
    const res = await app.request(`/dental/visits/pmd?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// (d) cross-branch PHI isolation — a FULL-ROLE member of ANOTHER branch (same
//     org) is denied the BRANCH_ID patient's PMDs. The branch is derived from
//     the resource (visit.branchId / patient.preferredBranchId), never from the
//     caller's own branch context — so a dentist_owner of OTHER_BRANCH (who
//     would pass any role-only check) is still 403'd here. This pins the
//     carry-forward class (V-PAT-002 → V-VIS-011 → imaging V-IMG-002): the
//     OUTSIDER cases above deny for "no membership anywhere"; only an
//     other-branch member proves the resource-scoped-branch invariant.
// ---------------------------------------------------------------------------

describe('cross-branch PHI isolation [V-PMD-008 / carry-forward]', () => {
  test('DENY: dentist_owner of OTHER_BRANCH cannot read a BRANCH_ID visit PMD → 403', async () => {
    const visit = await seedCompletedVisit();
    // generate the PMD as the legitimate owner
    const ownerApp = buildTestApp(OWNER);
    const gen = await ownerApp.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(gen.status).toBe(201);

    const app = buildTestApp(OTHER_BRANCH_DENTIST);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd`);
    expect(res.status).toBe(403);
  });

  test('DENY: dentist_owner of OTHER_BRANCH cannot export a BRANCH_ID visit PMD → 403', async () => {
    const visit = await seedCompletedVisit();
    const ownerApp = buildTestApp(OWNER);
    const gen = await ownerApp.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(gen.status).toBe(201);

    const app = buildTestApp(OTHER_BRANCH_DENTIST);
    const res = await app.request(`/dental/visits/${visit!.id}/pmd/export`);
    expect(res.status).toBe(403);
  });

  test('DENY: dentist_owner of OTHER_BRANCH cannot list the BRANCH_ID patient PMDs → 403', async () => {
    const app = buildTestApp(OTHER_BRANCH_DENTIST);
    const res = await app.request(`/dental/visits/pmd?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(403);
  });

  test('DENY: dentist_owner of OTHER_BRANCH cannot list the BRANCH_ID patient imported PMDs → 403', async () => {
    const app = buildTestApp(OTHER_BRANCH_DENTIST);
    const res = await app.request(`/dental/pmd/imported?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(403);
  });
});
