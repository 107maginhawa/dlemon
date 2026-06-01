/**
 * TR-DG-002 — post-op template route registration smoke (real app)
 *
 * The post-op template endpoints (P2-008) are now declared in TypeSpec
 * (dental-clinical-ops.tsp → PostopTemplateMgmt in main.tsp) and wired via the
 * generated OpenAPI routes, replacing the former app.ts hand-registration.
 * Each route must resolve on the REAL app: an unauthenticated request returns
 * 401 (route registered + auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const BRANCH_ID = 'b3000000-0000-4000-8000-0000000000bb';
const TEMPLATE_ID = 'b3000000-0000-4000-8000-0000000000cc';
const app = createApp(parseConfig());

describe('TR-DG-002 — post-op template routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/branches/${BRANCH_ID}/postop-templates`],
    ['GET', `/dental/branches/${BRANCH_ID}/postop-templates`],
    ['PATCH', `/dental/branches/${BRANCH_ID}/postop-templates/${TEMPLATE_ID}`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
