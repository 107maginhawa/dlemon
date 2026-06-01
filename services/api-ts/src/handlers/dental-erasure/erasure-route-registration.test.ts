/**
 * TR-DG-002 — erasure routes registration smoke (real app)
 *
 * The right-to-erasure endpoints (V-DG-002) are now declared in TypeSpec
 * (dental-erasure.tsp → DentalErasureMgmt in main.tsp) and wired via the
 * generated OpenAPI routes, replacing the former app.ts hand-registration.
 * This boot-smoke proves each route actually resolves on the REAL application
 * (createApp): an unauthenticated request must return 401 (route registered +
 * auth-gated), NOT 404 (route missing). Mirrors the consent-revoke pattern.
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const ID = 'e3000000-0000-4000-8000-0000000000aa';
const app = createApp(parseConfig());

describe('TR-DG-002 — erasure routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', '/dental/erasure-requests'],
    ['GET', '/dental/erasure-requests'],
    ['GET', `/dental/erasure-requests/${ID}`],
    ['POST', `/dental/erasure-requests/${ID}/approve`],
    ['POST', `/dental/erasure-requests/${ID}/reject`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
