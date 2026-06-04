/**
 * TR-DG-002 — fee-schedule route registration smoke (real app)
 *
 * The fee-schedule endpoints (EF-ORG-P016 / WF-025, FR6.3) are now declared in
 * TypeSpec (dental-ops-extras.tsp → FeeScheduleMgmt in main.tsp) and wired via
 * the generated OpenAPI routes, replacing the former app.ts hand-registration.
 * Each route must resolve on the REAL app: an unauthenticated request returns
 * 401 (route registered + auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const CDT = 'D1110';
const app = createApp(parseConfig());

describe('TR-DG-002 — fee-schedule routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['GET', '/dental/fee-schedule'],
    ['PATCH', `/dental/fee-schedule/${CDT}`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
