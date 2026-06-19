/**
 * dental-portal.test.ts — E4 patient self-service portal (read-only foundation)
 *
 * This is an EXTERNAL trust boundary. IDOR safety is the headline invariant:
 * a patient may ONLY ever read their OWN data. The patient identity is derived
 * server-side from the session (user.id === person.id → dental_patient.person_id),
 * so there is no client-supplied patientId to tamper with.
 *
 * Coverage:
 *   1. assertSelfPatient core primitive:
 *        - self → ok
 *        - other patient's id → ForbiddenError (no leak)
 *        - nonexistent patient id → NotFoundError
 *        - resolveSelfPatientIdOrThrow: user with no patient → Forbidden
 *   2. The three /me handlers:
 *        - 200 returns ONLY the caller's own rows (isolation)
 *        - patient A NEVER sees patient B's rows
 *        - unauthenticated → 401
 *        - staff-only user (no linked patient) → 403
 *        - patient-appropriate projection (no staff-only fields)
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, beforeAll } from 'bun:test';
import { ForbiddenError, NotFoundError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import {
  assertSelfPatient,
  resolveSelfPatientId,
  resolveSelfPatientIdOrThrow,
} from '@/handlers/shared/assert-self-patient';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Two distinct patients, each is their own user (userId === personId === patient.person).
// The `022` segment in every id is a suite-unique tag avoiding cross-suite collisions.
const USER_A = { id: `a0220000-0000-4000-8000-000000000001`, email: 'patientA@example.com' };
const USER_B = { id: `a0220000-0000-4000-8000-000000000002`, email: 'patientB@example.com' };
// USER_C is a real patient with ZERO appointments/invoices — the empty-self-scope case.
const USER_C = { id: `a0220000-0000-4000-8000-000000000003`, email: 'patientC@example.com' };
const STAFF_ONLY = { id: `a0220000-0000-4000-8000-000000000099`, email: 'staffonly@example.com' };

const PATIENT_A = `b0220000-0000-4000-8000-000000000001`;
const PATIENT_B = `b0220000-0000-4000-8000-000000000002`;
const PATIENT_C = `b0220000-0000-4000-8000-000000000003`;

const ORG_ID = `c0220000-0000-4000-8000-000000000001`;
const BRANCH_ID = `d0220000-0000-4000-8000-000000000001`;
const MEMBER_A = `e0220000-0000-4000-8000-000000000001`; // a dentist member to satisfy appt FK
const NONEXISTENT = `ffffffff-ffff-4000-8000-ffffffffff22`;

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { dentalAppointments } = await import('@/handlers/dental-scheduling/repos/dental-appointment.schema');
  const { dentalInvoices } = await import('@/handlers/dental-billing/repos/dental-invoice.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Portal Clinic', tier: 'solo',
    ownerPersonId: USER_A.id, countryCode: 'PH',
    createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();

  // A dentist member (just to satisfy appointment.dentistMemberId FK).
  await db.insert(dentalMemberships).values({
    id: MEMBER_A, branchId: BRANCH_ID, personId: USER_A.id,
    displayName: 'Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();

  // person.id === user.id (the portal invariant).
  await db.insert(persons).values([
    { id: USER_A.id, firstName: 'Alice', lastName: 'Anderson', createdBy: USER_A.id, updatedBy: USER_A.id },
    { id: USER_B.id, firstName: 'Bob', lastName: 'Brown', createdBy: USER_B.id, updatedBy: USER_B.id },
    { id: USER_C.id, firstName: 'Carol', lastName: 'Clark', createdBy: USER_C.id, updatedBy: USER_C.id },
    { id: STAFF_ONLY.id, firstName: 'Sam', lastName: 'Staff', createdBy: STAFF_ONLY.id, updatedBy: STAFF_ONLY.id },
  ]).onConflictDoNothing();

  await db.insert(patients).values([
    { id: PATIENT_A, person: USER_A.id, preferredBranchId: BRANCH_ID, createdBy: USER_A.id, updatedBy: USER_A.id },
    { id: PATIENT_B, person: USER_B.id, preferredBranchId: BRANCH_ID, createdBy: USER_B.id, updatedBy: USER_B.id },
    // PATIENT_C is a real, owned patient row with NO appointments/invoices.
    { id: PATIENT_C, person: USER_C.id, preferredBranchId: BRANCH_ID, createdBy: USER_C.id, updatedBy: USER_C.id },
  ]).onConflictDoNothing();
  // NB: STAFF_ONLY has NO patient row — the "staff-only account" case.

  // Appointments: 1 for A, 1 for B.
  await db.insert(dentalAppointments).values([
    {
      id: `f0220000-0000-4000-8000-0000000000a1`, patientId: PATIENT_A, dentistMemberId: MEMBER_A,
      branchId: BRANCH_ID, scheduledAt: new Date('2030-01-10T09:00:00.000Z'), durationMinutes: 30,
      serviceType: 'checkup', status: 'scheduled', createdBy: USER_A.id, updatedBy: USER_A.id,
    },
    {
      id: `f0220000-0000-4000-8000-0000000000b1`, patientId: PATIENT_B, dentistMemberId: MEMBER_A,
      branchId: BRANCH_ID, scheduledAt: new Date('2030-02-10T09:00:00.000Z'), durationMinutes: 60,
      serviceType: 'treatment', status: 'confirmed', confirmedAt: new Date('2030-01-01T00:00:00.000Z'),
      createdBy: USER_B.id, updatedBy: USER_B.id,
    },
  ]).onConflictDoNothing();

  // Invoices: 1 issued for A (with a balance), 1 for B, plus a voided one for A (must be hidden).
  await db.insert(dentalInvoices).values([
    {
      id: `f1220000-0000-4000-8000-0000000000a1`, patientId: PATIENT_A, branchId: BRANCH_ID,
      dentistMemberId: MEMBER_A, invoiceNumber: 'INV-A-1', status: 'issued',
      subtotalCents: 10000, totalCents: 10000, paidCents: 4000, balanceCents: 6000,
      issuedAt: new Date('2030-01-05T00:00:00.000Z'), createdBy: USER_A.id, updatedBy: USER_A.id,
    },
    {
      id: `f1220000-0000-4000-8000-0000000000a2`, patientId: PATIENT_A, branchId: BRANCH_ID,
      dentistMemberId: MEMBER_A, invoiceNumber: 'INV-A-VOID', status: 'voided',
      subtotalCents: 5000, totalCents: 5000, paidCents: 0, balanceCents: 5000,
      voidedAt: new Date('2030-01-06T00:00:00.000Z'), createdBy: USER_A.id, updatedBy: USER_A.id,
    },
    {
      // Internally written-off debt: must NOT be shown to the patient as owed,
      // and must be excluded from the balance roll-up (review fix #2).
      id: `f1220000-0000-4000-8000-0000000000a3`, patientId: PATIENT_A, branchId: BRANCH_ID,
      dentistMemberId: MEMBER_A, invoiceNumber: 'INV-A-UNCOLLECTIBLE', status: 'uncollectible',
      subtotalCents: 7000, totalCents: 7000, paidCents: 0, balanceCents: 7000,
      uncollectibleAt: new Date('2030-01-07T00:00:00.000Z'), createdBy: USER_A.id, updatedBy: USER_A.id,
    },
    {
      id: `f1220000-0000-4000-8000-0000000000b1`, patientId: PATIENT_B, branchId: BRANCH_ID,
      dentistMemberId: MEMBER_A, invoiceNumber: 'INV-B-1', status: 'overdue',
      subtotalCents: 20000, totalCents: 20000, paidCents: 0, balanceCents: 20000,
      issuedAt: new Date('2030-01-05T00:00:00.000Z'), createdBy: USER_B.id, updatedBy: USER_B.id,
    },
  ]).onConflictDoNothing();
});

// Build the app from the EXACT production generated route table (authMiddleware →
// generated zValidator → handler → error envelope) via the shared harness, so the
// same assertions below now run through the real validator chain.
function buildApp(user?: { id: string; email: string }) {
  return buildTestApp({ db, user: user ?? null });
}

// ---------------------------------------------------------------------------
// 1 — assertSelfPatient core primitive (the IDOR gate)
// ---------------------------------------------------------------------------

// V-PORTAL-001 — IDOR-free self-scope (headline invariant). The IDOR gate
// itself: ownership is patient.person === userId; any mismatch → 403, no leak.
describe('assertSelfPatient (IDOR core) [V-PORTAL-001]', () => {
  test('self → resolves without throwing', async () => {
    await expect(assertSelfPatient(db, USER_A.id, PATIENT_A)).resolves.toBeUndefined();
  });

  test("V-PORTAL-001: another patient's id → ForbiddenError 403 (no data leak)", async () => {
    let err: unknown;
    try {
      await assertSelfPatient(db, USER_A.id, PATIENT_B);
    } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).statusCode).toBe(403);
  });

  test('nonexistent patient id → NotFoundError', async () => {
    let err: unknown;
    try {
      await assertSelfPatient(db, USER_A.id, NONEXISTENT);
    } catch (e) { err = e; }
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as NotFoundError).statusCode).toBe(404);
  });

  test('resolveSelfPatientId: returns the caller own patient id', async () => {
    expect(await resolveSelfPatientId(db, USER_A.id)).toBe(PATIENT_A);
    expect(await resolveSelfPatientId(db, USER_B.id)).toBe(PATIENT_B);
  });

  test('resolveSelfPatientId: staff-only user (no patient) → null', async () => {
    expect(await resolveSelfPatientId(db, STAFF_ONLY.id)).toBeNull();
  });

  // V-PORTAL-002 — staff-only account (no linked patient) denied 403; the
  // patient-only boundary. Negative path asserted (403 NOT_A_SELF_PATIENT).
  test('V-PORTAL-002: resolveSelfPatientIdOrThrow: staff-only user → ForbiddenError 403', async () => {
    let err: unknown;
    try {
      await resolveSelfPatientIdOrThrow(db, STAFF_ONLY.id);
    } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 2 — GET /me/appointments
// ---------------------------------------------------------------------------

describe('GET /me/appointments', () => {
  test('V-PORTAL-001: 200 returns ONLY the caller own appointments (B absent)', async () => {
    const res = await buildApp(USER_A).request('/me/appointments');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].visitType).toBe('checkup');
    // Isolation: patient B's appointment id must NOT appear.
    const ids = body.map((a: any) => a.id);
    expect(ids).not.toContain('f0220000-0000-4000-8000-0000000000b1');
  });

  test('V-PORTAL-001: patient B sees only B own appointment (isolation, both directions)', async () => {
    const res = await buildApp(USER_B).request('/me/appointments');
    const body = (await res.json()) as any[];
    expect(body.length).toBe(1);
    expect(body[0].visitType).toBe('treatment');
    expect(body.map((a: any) => a.id)).not.toContain('f0220000-0000-4000-8000-0000000000a1');
  });

  test('V-PORTAL-004: projection excludes staff-only fields (no dentistMemberId / notes)', async () => {
    const res = await buildApp(USER_A).request('/me/appointments');
    const body = (await res.json()) as any[];
    expect(body[0]).not.toHaveProperty('dentistMemberId');
    expect(body[0]).not.toHaveProperty('notes');
    expect(body[0]).not.toHaveProperty('cancellationReason');
    expect(body[0]).toHaveProperty('startAt');
    expect(body[0]).toHaveProperty('endAt');
  });

  test('V-PORTAL-002: unauthenticated → 401', async () => {
    const res = await buildApp(undefined).request('/me/appointments');
    expect(res.status).toBe(401);
  });

  test('V-PORTAL-002: staff-only account (no linked patient) → 403', async () => {
    const res = await buildApp(STAFF_ONLY).request('/me/appointments');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 3 — GET /me/invoices
// ---------------------------------------------------------------------------

describe('GET /me/invoices', () => {
  test('V-PORTAL-001: 200 returns ONLY caller own non-voided invoices (B absent)', async () => {
    const res = await buildApp(USER_A).request('/me/invoices');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBe(1); // voided one is hidden
    expect(body[0].invoiceNumber).toBe('INV-A-1');
    expect(body[0].balanceCents).toBe(6000);
    // Isolation: B's invoice number must not leak.
    expect(body.map((i: any) => i.invoiceNumber)).not.toContain('INV-B-1');
  });

  test('V-PORTAL-004: voided invoices are hidden from the patient', async () => {
    const res = await buildApp(USER_A).request('/me/invoices');
    const body = (await res.json()) as any[];
    expect(body.map((i: any) => i.invoiceNumber)).not.toContain('INV-A-VOID');
  });

  test('V-PORTAL-004: uncollectible (internally written-off) invoices are hidden from the patient', async () => {
    const res = await buildApp(USER_A).request('/me/invoices');
    const body = (await res.json()) as any[];
    expect(body.map((i: any) => i.invoiceNumber)).not.toContain('INV-A-UNCOLLECTIBLE');
    // Only the single live (issued) invoice remains visible.
    expect(body.length).toBe(1);
  });

  test('V-PORTAL-004: projection excludes staff-only fields (no dentistMemberId / discountReason / discountedBy / line items)', async () => {
    const res = await buildApp(USER_A).request('/me/invoices');
    const body = (await res.json()) as any[];
    expect(body[0]).not.toHaveProperty('dentistMemberId');
    expect(body[0]).not.toHaveProperty('discountReason');
    expect(body[0]).not.toHaveProperty('discountedBy');
    expect(body[0]).not.toHaveProperty('lineItems');
    expect(body[0]).not.toHaveProperty('lines');
  });

  test('V-PORTAL-002: unauthenticated → 401', async () => {
    const res = await buildApp(undefined).request('/me/invoices');
    expect(res.status).toBe(401);
  });

  test('V-PORTAL-002: staff-only account → 403', async () => {
    const res = await buildApp(STAFF_ONLY).request('/me/invoices');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 4 — GET /me/balance
// ---------------------------------------------------------------------------

describe('GET /me/balance', () => {
  test('V-PORTAL-004: 200 returns caller own roll-up (voided AND uncollectible excluded)', async () => {
    const res = await buildApp(USER_A).request('/me/balance');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // INV-A-1 only: the ₱50 voided + ₱70 uncollectible invoices are excluded.
    // If uncollectible leaked, totalBilled would be 17000 and balance 13000.
    expect(body.totalBilledCents).toBe(10000);
    expect(body.totalPaidCents).toBe(4000);
    expect(body.outstandingBalanceCents).toBe(6000);
    expect(body.invoiceCount).toBe(1);
  });

  test('V-PORTAL-001: patient B balance is computed from B own invoices only (isolation)', async () => {
    const res = await buildApp(USER_B).request('/me/balance');
    const body = (await res.json()) as any;
    expect(body.outstandingBalanceCents).toBe(20000);
    expect(body.overdueAmountCents).toBe(20000);
  });

  test('V-PORTAL-002: unauthenticated → 401', async () => {
    const res = await buildApp(undefined).request('/me/balance');
    expect(res.status).toBe(401);
  });

  test('V-PORTAL-002: staff-only account → 403', async () => {
    const res = await buildApp(STAFF_ONLY).request('/me/balance');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 5 — Adversarial IDOR: client-supplied patientId is INERT (carry-forward #1)
//
// The headline portal invariant is that there is NO client-supplied patientId
// to tamper with — identity is derived from the session. These tests prove that
// even when a caller DELIBERATELY appends ?patientId=<another patient> (or
// ?patientId=<self> / a path-ish param), the handler ignores it entirely and
// still returns ONLY the SESSION patient's own rows. If a future refactor ever
// wired a query param into the scope, the cross-patient assertions here go RED.
// ---------------------------------------------------------------------------

describe('IDOR: tampered ?patientId is ignored (session-derived identity wins) [V-PORTAL-001]', () => {
  test('V-PORTAL-001: A appending ?patientId=PATIENT_B still gets ONLY A own appointments', async () => {
    const res = await buildApp(USER_A).request(`/me/appointments?patientId=${PATIENT_B}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBe(1);
    expect(body[0].visitType).toBe('checkup'); // A's appointment, not B's 'treatment'
    expect(body.map((a: any) => a.id)).not.toContain('f0220000-0000-4000-8000-0000000000b1');
  });

  test('V-PORTAL-001: A appending ?patientId=PATIENT_B still gets ONLY A own invoices', async () => {
    const res = await buildApp(USER_A).request(`/me/invoices?patientId=${PATIENT_B}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.map((i: any) => i.invoiceNumber)).not.toContain('INV-B-1');
    expect(body.map((i: any) => i.invoiceNumber)).toContain('INV-A-1');
  });

  test('V-PORTAL-001: A appending ?patientId=PATIENT_B still gets ONLY A own balance', async () => {
    const res = await buildApp(USER_A).request(`/me/balance?patientId=${PATIENT_B}`);
    const body = (await res.json()) as any;
    // A's own roll-up (6000), NEVER B's 20000.
    expect(body.outstandingBalanceCents).toBe(6000);
  });
});

// ---------------------------------------------------------------------------
// 6 — Empty self-scope: a real owned patient with zero rows gets [] / zero,
//     NOT an error and NOT another patient's data. Proves the scope is the
//     SESSION patient's set even when that set is empty (no fallback to all).
// ---------------------------------------------------------------------------

describe('empty self-scope (patient C has no appointments/invoices) [V-PORTAL-003]', () => {
  test('V-PORTAL-003: GET /me/appointments → 200 []', async () => {
    const res = await buildApp(USER_C).request('/me/appointments');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('V-PORTAL-003: GET /me/invoices → 200 []', async () => {
    const res = await buildApp(USER_C).request('/me/invoices');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('V-PORTAL-003: GET /me/balance → 200 zeroed roll-up (not another patient data)', async () => {
    const res = await buildApp(USER_C).request('/me/balance');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.outstandingBalanceCents).toBe(0);
    expect(body.totalBilledCents).toBe(0);
    expect(body.invoiceCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7 — Read-only portal: NO write/pay/mutate route exists on /me. [V-PORTAL-005]
//
// The guarantee is the ABSENCE of any state-changing route. A patient must not
// be able to mark a treatment performed, edit notes, void/pay an invoice, or
// otherwise mutate clinic-owned data through the portal. Self-booking and
// self-pay are Phase-2 deferred and intentionally not built. We assert this
// two ways:
//   (a) a live request with each write verb against every /me route is rejected
//       (the route does not exist → Hono returns 404, never 2xx); and
//   (b) the production generated route table registers ONLY GET handlers for
//       /me/* — no app.post/put/patch/delete('/me…') is present.
// If a future change ever wired a portal mutation, BOTH halves go RED.
// ---------------------------------------------------------------------------

describe('V-PORTAL-005: portal is read-only (no /me write/mutate routes)', () => {
  const ME_ROUTES = ['/me/appointments', '/me/invoices', '/me/balance'] as const;
  const WRITE_VERBS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

  for (const route of ME_ROUTES) {
    for (const method of WRITE_VERBS) {
      test(`V-PORTAL-005: ${method} ${route} is not a route (404/405, never a mutation)`, async () => {
        // Authenticated as a real owned patient so a 404/405 means "no such
        // write route", not "unauthorized" — proving the ABSENCE of the route.
        const res = await buildApp(USER_A).request(route, { method });
        expect([404, 405]).toContain(res.status);
        expect(res.status).not.toBe(200);
        expect(res.status).not.toBe(201);
        expect(res.status).not.toBe(204);
      });
    }
  }

  test('V-PORTAL-005: generated route table registers ONLY GET handlers under /me/* (no post/put/patch/delete)', async () => {
    // Read the production generated route table and assert no write verb is
    // wired to any /me path. This is the source-of-truth half of the guarantee:
    // it stays RED even if a future handler stub were added without a test.
    const routesPath = new URL(
      '../../generated/openapi/routes.ts',
      import.meta.url,
    );
    const src = await Bun.file(routesPath).text();
    // Any of app.post|put|patch|delete('/me… → a forbidden portal mutation.
    const writeMeRoute = /app\.(post|put|patch|delete)\(\s*['"]\/me\//;
    expect(writeMeRoute.test(src)).toBe(false);
    // Sanity: the three read routes ARE registered (guards against the regex
    // silently passing because the file moved / is empty).
    expect(src).toContain(`app.get('/me/appointments'`);
    expect(src).toContain(`app.get('/me/invoices'`);
    expect(src).toContain(`app.get('/me/balance'`);
  });
});
