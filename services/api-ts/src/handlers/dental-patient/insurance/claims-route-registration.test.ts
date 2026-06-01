/**
 * TR-DG-002 — claims (claim-draft) route registration smoke (real app)
 *
 * The patient claim-draft endpoints (create / list / readiness / status) are now
 * declared in TypeSpec (dental-patient-finance.tsp → DentalClaimDraftMgmt in
 * main.tsp) and wired via the generated OpenAPI routes, replacing the former
 * app.ts hand-registration. Each route must resolve on the REAL app: an
 * unauthenticated request returns 401 (route registered + auth-gated), NOT 404
 * (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const PATIENT_ID = 'b3000000-0000-4000-8000-0000000000d1';
const CLAIM_ID = 'b3000000-0000-4000-8000-0000000000d2';
const app = createApp(parseConfig());

describe('TR-DG-002 — claims routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/patients/${PATIENT_ID}/claims`],
    ['GET', `/dental/patients/${PATIENT_ID}/claims`],
    ['GET', `/dental/patients/${PATIENT_ID}/claims/${CLAIM_ID}/readiness`],
    ['PATCH', `/dental/patients/${PATIENT_ID}/claims/${CLAIM_ID}/status`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
