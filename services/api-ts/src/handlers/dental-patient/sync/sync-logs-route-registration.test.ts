/**
 * TR-DG-002 — sync-logs route registration smoke (real app)
 *
 * The local-first sync-log endpoints (create / list / update) are now declared
 * in TypeSpec (dental-patient-finance.tsp → DentalSyncLogMgmt in main.tsp, base
 * /dental/sync-logs — NOT under /patients) and wired via the generated OpenAPI
 * routes, replacing the former app.ts hand-registration. Each route must resolve
 * on the REAL app: an unauthenticated request returns 401 (route registered +
 * auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const LOG_ID = 'b3000000-0000-4000-8000-0000000000b1';
const app = createApp(parseConfig());

describe('TR-DG-002 — sync-logs routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', '/dental/sync-logs'],
    ['GET', '/dental/sync-logs'],
    ['PATCH', `/dental/sync-logs/${LOG_ID}`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
