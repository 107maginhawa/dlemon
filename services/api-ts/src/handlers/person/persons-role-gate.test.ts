/**
 * listPersons role-gate regression pin (roleOp HARD — cross-tenant PII-list leak).
 *
 * GAP: person-listpersons-role-gate-untested.
 *
 * GET /persons returns the FULL person directory (PII across the whole deployment).
 * The ONLY authorization on this operation is the route-level
 * `authMiddleware({ roles: ['admin', 'support'] })` mounted in the generated route
 * table (services/api-ts/src/generated/openapi/routes.ts). The handler
 * (services/api-ts/src/handlers/person/listPersons.ts) performs NO role check of its
 * own, so if that roles array ever regresses (e.g. drops to no gate, or `['user']`),
 * any authenticated plain user could enumerate every person row.
 *
 * This pins the gate via the SHARED buildTestApp harness, which mounts the REAL
 * authMiddleware through registerRoutes (NOT the bespoke buildTestApp in
 * person.test.ts, which bypasses the middleware). A row is seeded first so a
 * regressed 200 would actually return leaked PII rather than an empty list.
 *
 * NON-VACUITY: the admin→200 / support→200 / user→403 split is the proof — the
 * gate discriminates by role. (Verified manually: temporarily widening the
 * generated route's roles array to include "user" turns the user case 403→200,
 * failing this test; restored byte-identical.)
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Stable seed ids (a9 = role-gate suffix block) so the seed is idempotent across runs.
const SEED_PERSON_ID = '0000a900-0000-4000-8000-000000000001';
const SEEDER_ID = '0000a900-0000-4000-8000-0000000000ff';

beforeAll(async () => {
  // Seed >= 1 person so a regressed 200 would leak real directory PII (not an
  // empty list). onConflictDoNothing keeps it safe to re-run.
  await db
    .insert(persons)
    .values({
      id: SEED_PERSON_ID,
      firstName: 'RoleGate',
      lastName: 'Seed',
      createdBy: SEEDER_ID,
      updatedBy: SEEDER_ID,
    })
    .onConflictDoNothing();
});

describe('GET /persons role gate (route-level authMiddleware)', () => {
  test('plain user (role: user) is denied with 403 FORBIDDEN', async () => {
    const app = buildTestApp({
      db,
      user: {
        id: '00000000-0000-4000-8000-0000000000a1',
        email: 'nonadmin@test.com',
        role: 'user',
      },
    });

    const res = await app.request('/persons');

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('FORBIDDEN');
  });

  test('admin (role: admin) is allowed with 200', async () => {
    const app = buildTestApp({
      db,
      user: {
        id: '00000000-0000-4000-8000-0000000000a2',
        email: 'admin@test.com',
        role: 'admin',
      },
    });

    const res = await app.request('/persons');

    expect(res.status).toBe(200);
  });

  test('support (role: support) is allowed with 200', async () => {
    const app = buildTestApp({
      db,
      user: {
        id: '00000000-0000-4000-8000-0000000000a3',
        email: 'support@test.com',
        role: 'support',
      },
    });

    const res = await app.request('/persons');

    expect(res.status).toBe(200);
  });
});
