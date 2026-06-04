/**
 * TR-DG-002 — legal-hold route registration smoke (real app)
 *
 * The legal-hold endpoints (V-DG-002 support) are now declared in TypeSpec
 * (dental-legal-hold.tsp → DentalLegalHoldMgmt in main.tsp) and wired via the
 * generated OpenAPI routes, replacing the former app.ts hand-registration.
 * Each route must resolve on the REAL app: an unauthenticated request returns
 * 401 (route registered + auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const ID = 'b3000000-0000-4000-8000-0000000000aa';
const app = createApp(parseConfig());

describe('TR-DG-002 — legal-hold routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', '/dental/legal-holds'],
    ['GET', '/dental/legal-holds'],
    ['POST', `/dental/legal-holds/${ID}/release`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
