/**
 * P1-26 — revenue-cycle route registration smoke (REAL app)
 *
 * The new insurance/revenue-cycle endpoints are declared in TypeSpec and wired
 * via generated OpenAPI routes. Each must resolve on the REAL app: an
 * unauthenticated request returns 401 (route registered + auth-gated), NOT 404
 * (route missing) — per the route-registration learning in MEMORY.
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const CLAIM_ID = 'b3000000-0000-4000-8000-0000000000e1';
const LINE_ID = 'b3000000-0000-4000-8000-0000000000e2';
const PATIENT_ID = 'b3000000-0000-4000-8000-0000000000e3';
const AUTH_ID = 'b3000000-0000-4000-8000-0000000000e4';
const app = createApp(parseConfig());

describe('P1-26 — revenue-cycle routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', '/dental/billing/claims'],
    ['GET', '/dental/billing/claims'],
    ['GET', '/dental/billing/claims/aging'],
    ['POST', '/dental/billing/estimate'],
    ['GET', `/dental/billing/claims/${CLAIM_ID}`],
    ['PATCH', `/dental/billing/claims/${CLAIM_ID}/status`],
    ['POST', `/dental/billing/claims/${CLAIM_ID}/lines`],
    ['PATCH', `/dental/billing/claims/${CLAIM_ID}/lines/${LINE_ID}`],
    ['POST', `/dental/billing/claims/${CLAIM_ID}/remittance`],
    ['POST', `/dental/patients/${PATIENT_ID}/authorizations`],
    ['GET', `/dental/patients/${PATIENT_ID}/authorizations`],
    ['PATCH', `/dental/patients/${PATIENT_ID}/authorizations/${AUTH_ID}/status`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
