/**
 * Provider module — P0 business-rule invariants (BR-coverage matrix).
 *
 * Pattern: real Postgres via openTestTx (auto-rollback) + buildTestApp, so every
 * request traverses the EXACT production route table:
 *   authMiddleware (role gate) → generated zValidator → handler → error envelope.
 * The provider/practitioner confidentiality + write guards live in the ROUTE
 * role gates (services/api-ts/src/generated/openapi/routes.ts), not in the
 * handler bodies — so these tests drive the real `authMiddleware` and assert the
 * gate's refusal (403) for an unprivileged caller, plus the handler-level 409.
 *
 * Covered BRs (br-registry.json):
 *   - V-PROV-001 — provider profile is self-service: POST /providers creates for
 *     the AUTHENTICATED user only (person derived server-side; demographics are
 *     NOT in the body schema, so you cannot create for someone else). A 2nd
 *     create for the same person → 409 PROVIDER_EXISTS; on success the `provider`
 *     role is granted to the user.
 *   - V-PROV-002 — practitioner credentials are privileged-read-only:
 *     GET /providers/practitioners[/:id] is gated to admin|clinician|support
 *     (no public/patient route). A non-privileged (patient) caller → 403.
 *   - V-PROV-003 — practitioner writes are admin/credentialing role-gated;
 *     deactivate requires admin. A non-admin/non-credentialing (patient) caller
 *     → 403 on create/update/deactivate.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';
import { providers } from '@/handlers/provider/repos/provider.schema';
import { practitioners } from '@/handlers/provider/repos/practitioner.schema';
import { user as userTable } from '@/generated/better-auth/schema';

// ── Fixed IDs (namespace: provider-br) ───────────────────────────────────────
const PROVIDER_USER_ID  = 'ed000000-0000-4000-8000-0000000b0001'; // self-service creator
const EXISTING_PERSON_ID = 'ed000000-0000-4000-8000-0000000b0002'; // already has a provider
const EXISTING_PROVIDER_ID = 'ed000000-0000-4000-8000-0000000b0003';
const PRACTITIONER_ID   = 'ed000000-0000-4000-8000-0000000b0004';

// A patient — NOT admin|clinician|support|credentialing. Must be 403'd by the
// route role gate on every privileged practitioner read/write.
const PATIENT_USER = { id: PROVIDER_USER_ID, email: 'patient@clinic.test', role: 'patient' };

let db: NodePgDatabase;
let teardown: () => Promise<void>;

beforeEach(async () => {
  const tx = await openTestTx();
  db = tx.db;
  teardown = tx.rollback;

  // A real better-auth `user` row so addUserRole's role-grant UPDATE is observable.
  await db
    .insert(userTable)
    .values({
      id: PROVIDER_USER_ID,
      name: 'Self Service',
      email: 'selfservice@clinic.test',
      emailVerified: true,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    .onConflictDoNothing();

  // A person + provider that already exist → the 2nd-create 409 fixture.
  await db
    .insert(persons)
    .values([{ id: EXISTING_PERSON_ID, firstName: 'Already', lastName: 'Provider' }])
    .onConflictDoNothing();
  await db
    .insert(providers)
    .values([{ id: EXISTING_PROVIDER_ID, person: EXISTING_PERSON_ID, providerType: 'dentist' }])
    .onConflictDoNothing();
});

afterEach(() => teardown());

// ─────────────────────────────────────────────────────────────────────────────
// V-PROV-001 — provider profile is self-service
// ─────────────────────────────────────────────────────────────────────────────

describe('V-PROV-001 — provider profile is self-service (POST /providers)', () => {
  test('creates a provider for the AUTHENTICATED user (person derived from session) and grants the provider role', async () => {
    const app = buildTestApp({ db, user: { id: PROVIDER_USER_ID, email: PATIENT_USER.email, role: 'user' } });
    const res = await app.request('/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerType: 'dentist', yearsOfExperience: 5 }),
    });
    expect(res.status).toBe(201);
    // createProvider returns the provider with its person EXPANDED (an object).
    const body = (await res.json()) as { person: { id: string } };
    // The provider's person is the SESSION user — never an arbitrary id from the body.
    expect(body.person.id).toBe(PROVIDER_USER_ID);

    // Role grant side effect: the user row now carries the `provider` role.
    const [row] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, PROVIDER_USER_ID));
    expect(row?.role?.split(',').map((r) => r.trim())).toContain('provider');
  });

  test('a foreign person id smuggled in the body is IGNORED — the provider is created for the session user only', async () => {
    // The CreateProviderBody schema admits only providerType/yearsOfExperience/…
    // (no person / firstName / lastName), so any extra keys are stripped by the
    // validator. Even if a `person` id is smuggled, the handler derives the person
    // server-side from the session user — the foreign id can never own the new row.
    const app = buildTestApp({ db, user: { id: PROVIDER_USER_ID, role: 'user' } });
    const res = await app.request('/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerType: 'dentist', person: EXISTING_PERSON_ID, firstName: 'Victim' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { person: { id: string } };
    // Bound to the SESSION user, NOT the smuggled foreign person id.
    expect(body.person.id).toBe(PROVIDER_USER_ID);
    expect(body.person.id).not.toBe(EXISTING_PERSON_ID);

    // The foreign person still owns exactly its pre-seeded provider — the smuggled
    // create did NOT attach a second provider to someone else.
    const rows = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.person, EXISTING_PERSON_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(EXISTING_PROVIDER_ID);
  });

  test('a 2nd create for the same person → 409 PROVIDER_EXISTS', async () => {
    // EXISTING_PERSON_ID already has a provider; an authenticated user whose
    // session id IS that person re-creating → conflict.
    const app = buildTestApp({ db, user: { id: EXISTING_PERSON_ID, role: 'user' } });
    const res = await app.request('/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerType: 'dentist' }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('PROVIDER_EXISTS');
  });

  test('unauthenticated create → 401', async () => {
    const app = buildTestApp({ db, user: null });
    const res = await app.request('/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerType: 'dentist' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// V-PROV-002 — practitioner credentials are privileged-read-only
// ─────────────────────────────────────────────────────────────────────────────

describe('V-PROV-002 — practitioner credentials privileged-read-only (no public/patient read)', () => {
  test('a patient (non-privileged) caller GET /providers/practitioners/:id → 403', async () => {
    // The credential-bearing read is gated to admin|clinician|support. A patient
    // is none of those, so the route role gate refuses BEFORE any handler/DB read —
    // there is no public/patient projection of NPI/DEA/license numbers.
    const app = buildTestApp({ db, user: PATIENT_USER });
    const res = await app.request(`/providers/practitioners/${PRACTITIONER_ID}`);
    expect(res.status).toBe(403);
  });

  test('a patient (non-privileged) caller GET /providers/practitioners (list) → 403', async () => {
    const app = buildTestApp({ db, user: PATIENT_USER });
    const res = await app.request('/providers/practitioners');
    expect(res.status).toBe(403);
  });

  test('unauthenticated GET /providers/practitioners/:id → 401 (no public read)', async () => {
    const app = buildTestApp({ db, user: null });
    const res = await app.request(`/providers/practitioners/${PRACTITIONER_ID}`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// V-PROV-003 — practitioner writes are admin/credentialing role-gated
// ─────────────────────────────────────────────────────────────────────────────

describe('V-PROV-003 — practitioner writes admin/credentialing role-gated', () => {
  test('a patient cannot CREATE a practitioner → 403', async () => {
    // POST /providers/practitioners is gated to admin|credentialing.
    const app = buildTestApp({ db, user: PATIENT_USER });
    const res = await app.request('/providers/practitioners', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: EXISTING_PROVIDER_ID, name: [{ family: 'X', given: ['Y'] }] }),
    });
    expect(res.status).toBe(403);
  });

  test('a patient cannot UPDATE a practitioner → 403', async () => {
    // PATCH /providers/practitioners/:id is gated to admin|credentialing.
    const app = buildTestApp({ db, user: PATIENT_USER });
    const res = await app.request(`/providers/practitioners/${PRACTITIONER_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    expect(res.status).toBe(403);
  });

  test('a patient cannot DEACTIVATE a practitioner → 403 (deactivate requires admin)', async () => {
    // DELETE /providers/practitioners/:id is gated to admin only.
    const app = buildTestApp({ db, user: PATIENT_USER });
    const res = await app.request(`/providers/practitioners/${PRACTITIONER_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// V-PROV-004 — deactivate is a SOFT delete (records retained); missing id → 404
// ─────────────────────────────────────────────────────────────────────────────

describe('V-PROV-004 — deactivate is a soft-delete, records retained', () => {
  const ADMIN_USER = { id: PROVIDER_USER_ID, email: 'admin@clinic.test', role: 'admin' };
  const MISSING_ID = 'ed000000-0000-4000-8000-0000000bdead';

  test('admin DELETE /providers/practitioners/:id → 204 and the row is RETAINED with active=false + deactivatedAt', async () => {
    // Seed a live practitioner on the pre-existing provider.
    await db.insert(practitioners).values({
      id: PRACTITIONER_ID,
      providerId: EXISTING_PROVIDER_ID,
      active: true,
      name: [{ family: 'Cruz', given: ['Jose'] }],
    } as never);

    const app = buildTestApp({ db, user: ADMIN_USER });
    const res = await app.request(`/providers/practitioners/${PRACTITIONER_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(204);

    // SOFT delete: the row survives (not hard-deleted) with active=false + a deactivatedAt stamp.
    const [row] = await db
      .select({ active: practitioners.active, deactivatedAt: practitioners.deactivatedAt })
      .from(practitioners)
      .where(eq(practitioners.id, PRACTITIONER_ID));
    expect(row).toBeDefined();
    expect(row?.active).toBe(false);
    expect(row?.deactivatedAt).not.toBeNull();
  });

  test('admin DELETE a non-existent practitioner → 404 (never a silent 204)', async () => {
    const app = buildTestApp({ db, user: ADMIN_USER });
    const res = await app.request(`/providers/practitioners/${MISSING_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  test('admin DELETE a non-existent practitioner-role → 404 (same soft-delete contract)', async () => {
    const app = buildTestApp({ db, user: ADMIN_USER });
    const res = await app.request(`/providers/practitioner-roles/${MISSING_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
