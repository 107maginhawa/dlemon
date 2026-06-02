/**
 * P1-20 — case-presentation route registration smoke (real app)
 *
 * The case-presentation endpoints are declared in TypeSpec
 * (dental-patient-finance.tsp → DentalCasePresentationMgmt in main.tsp) and wired
 * via the generated OpenAPI routes. Each route must resolve on the REAL app: an
 * unauthenticated request returns 401 (route registered + auth-gated), NOT 404
 * (route missing). Phase 1 is entirely staff bearerAuth — there is NO public
 * by-token route in this pass.
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const PATIENT_ID = 'c5000000-0000-4000-8000-0000000000a1';
const PRESENTATION_ID = 'c5000000-0000-4000-8000-0000000000a2';
const app = createApp(parseConfig());

describe('P1-20 — case-presentation routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/patients/${PATIENT_ID}/case-presentations`],
    ['GET', `/dental/patients/${PATIENT_ID}/case-presentations`],
    ['GET', `/dental/patients/${PATIENT_ID}/case-presentations/${PRESENTATION_ID}`],
    ['POST', `/dental/patients/${PATIENT_ID}/case-presentations/${PRESENTATION_ID}/accept`],
    ['POST', `/dental/patients/${PATIENT_ID}/case-presentations/${PRESENTATION_ID}/reject`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
