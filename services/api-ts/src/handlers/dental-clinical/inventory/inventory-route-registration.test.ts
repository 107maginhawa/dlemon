/**
 * TR-DG-002 — inventory route registration smoke (real app)
 *
 * The inventory item + adjustment endpoints (P2-004) are now declared in
 * TypeSpec (dental-clinical-ops.tsp → InventoryMgmt in main.tsp) and wired via
 * the generated OpenAPI routes, replacing the former app.ts hand-registration.
 * Each route must resolve on the REAL app: an unauthenticated request returns
 * 401 (route registered + auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const BRANCH_ID = 'b3000000-0000-4000-8000-0000000000bb';
const ITEM_ID = 'b3000000-0000-4000-8000-0000000000dd';
const app = createApp(parseConfig());

describe('TR-DG-002 — inventory routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/branches/${BRANCH_ID}/inventory`],
    ['GET', `/dental/branches/${BRANCH_ID}/inventory`],
    ['PATCH', `/dental/branches/${BRANCH_ID}/inventory/${ITEM_ID}`],
    ['POST', `/dental/branches/${BRANCH_ID}/inventory/${ITEM_ID}/adjustments`],
    ['GET', `/dental/branches/${BRANCH_ID}/inventory/${ITEM_ID}/adjustments`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
