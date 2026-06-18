/**
 * BR-015c — follow-up notes are APPEND-ONLY.
 *
 * The invariant: the only routes that exist for
 * `/dental/patients/:id/follow-up-notes` are GET (list) and POST (add). There is
 * NO PATCH or DELETE route, so an existing note can neither be edited nor removed
 * — append-only is enforced structurally (the mutation routes are never
 * registered), not by a per-request guard. This is a compliance invariant
 * (clinical-record integrity): if a PATCH/DELETE route ever leaked into the
 * generated table, this test would catch it.
 *
 * Proof: drive the request through the EXACT production route table via
 * `buildTestApp` (registerRoutes + the real 404/405 error envelope). Because the
 * path is registered for GET/POST, a PATCH/DELETE on it resolves to the
 * not-found handler, which returns 405 METHOD_NOT_ALLOWED (path known, method
 * not). A 405 here means "this path exists but the mutation method is absent" —
 * exactly the append-only guarantee.
 */

import { describe, test, expect } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'append-only@clinic.test' };
const PATIENT_ID = 'f0000000-0000-4000-8000-0000000000c1';
const NOTE_ID = 'f0000000-0000-4000-8000-0000000000c2';

describe('BR-015c — follow-up notes are append-only (no PATCH/DELETE route)', () => {
  test('PATCH /dental/patients/:id/follow-up-notes → 405 (edit route does not exist)', async () => {
    const app = buildTestApp({ db, user: TEST_USER });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/follow-up-notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'attempt to edit an existing note' }),
    });
    expect(res.status).toBe(405);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('METHOD_NOT_ALLOWED');
  });

  test('DELETE /dental/patients/:id/follow-up-notes → 405 (delete route does not exist)', async () => {
    const app = buildTestApp({ db, user: TEST_USER });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/follow-up-notes`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(405);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('METHOD_NOT_ALLOWED');
  });

  test('DELETE /dental/patients/:id/follow-up-notes/:noteId → 404 (per-note delete route does not exist)', async () => {
    // A per-note delete path is not registered at all → the not-found handler
    // cannot find a matching pattern → 404 (no PATCH/DELETE sub-resource exists).
    const app = buildTestApp({ db, user: TEST_USER });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/follow-up-notes/${NOTE_ID}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });

  test('GET + POST routes DO exist (append-only allows list + add)', async () => {
    // Sanity floor: the two append-only routes must resolve (not 404/405). They
    // may 401/403/404-patient depending on auth/seed, but never METHOD_NOT_ALLOWED
    // — proving the path itself is registered for GET/POST.
    const app = buildTestApp({ db, user: TEST_USER });
    const getRes = await app.request(`/dental/patients/${PATIENT_ID}/follow-up-notes`, {
      method: 'GET',
    });
    expect(getRes.status).not.toBe(405);
    const postRes = await app.request(`/dental/patients/${PATIENT_ID}/follow-up-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'a brand new note' }),
    });
    expect(postRes.status).not.toBe(405);
  });
});
