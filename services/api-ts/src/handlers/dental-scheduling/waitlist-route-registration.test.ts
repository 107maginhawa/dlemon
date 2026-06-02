/**
 * P2-15 — waitlist route registration smoke (real app)
 *
 * The waitlist endpoints (ASAP fill) are declared in TypeSpec
 * (dental-ops-extras.tsp → WaitlistEntryCreation / WaitlistListing /
 * WaitlistPromotion in main.tsp) and wired via the generated OpenAPI routes.
 * Each route must resolve on the REAL app: an unauthenticated request returns
 * 401 (route registered + auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const ID = 'b3000000-0000-4000-8000-0000000000bb';
const app = createApp(parseConfig());

describe('P2-15 — waitlist routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/branches/${ID}/waitlist`],
    ['GET', `/dental/branches/${ID}/waitlist`],
    ['POST', `/dental/waitlist/${ID}/promote`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
