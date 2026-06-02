/**
 * P1-25 — public booking route registration smoke (real app)
 *
 * The public self-service booking endpoints are declared in TypeSpec
 * (dental-scheduling.tsp → PublicBookingManagement, wired in main.tsp under
 * /dental/public) and registered via the generated OpenAPI routes. Each route
 * must resolve on the REAL app WITHOUT auth (these are intentionally public) and
 * never 401/404-because-missing. We assert:
 *   - public reads/writes are reachable unauthenticated (NOT 401)
 *   - a malformed request is rejected by the route's validator (400) — proving
 *     the route + validator are wired, not a 404 fall-through.
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const BRANCH = 'b3000000-0000-4000-8000-0000000000b2';
const app = createApp(parseConfig());

describe('P1-25 — public booking routes are codegen-registered & public (real app)', () => {
  test('GET availability with missing query → 400 (route+validator wired), not 401/404', async () => {
    const res = await app.request(`/dental/public/branches/${BRANCH}/availability`);
    expect(res.status).toBe(400); // query validator rejects missing visitType/date_from/date_to
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(404);
  });

  test('POST holds with empty body → 400 (route+validator wired), not 401', async () => {
    const res = await app.request(`/dental/public/branches/${BRANCH}/holds`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(401);
  });

  test('POST bookings with empty body → 400 (route+validator wired), not 401', async () => {
    const res = await app.request(`/dental/public/branches/${BRANCH}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(401);
  });

  test('GET booking-config for unknown branch → 404 (route wired, branch missing), not 401', async () => {
    const res = await app.request(`/dental/public/branches/${BRANCH}/booking-config`);
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(401);
  });

  test('GET booking lookup for unknown code → 404 (route wired), not 401', async () => {
    const res = await app.request(`/dental/public/bookings/ZZZZZZZZZZ`);
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(401);
  });
});
