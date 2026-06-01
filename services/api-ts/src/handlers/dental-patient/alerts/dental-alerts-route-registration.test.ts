/**
 * TR-DG-002 — dental-alerts route registration smoke (real app)
 *
 * The dental alert endpoints (P2-001) are now declared in TypeSpec
 * (dental-patient-engagement.tsp → DentalAlertMgmt in main.tsp) and wired via the
 * generated OpenAPI routes, replacing the former app.ts hand-registration.
 * Each route must resolve on the REAL app: an unauthenticated request returns
 * 401 (route registered + auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const PATIENT_ID = 'b3000000-0000-4000-8000-0000000000c1';
const ALERT_ID = 'b3000000-0000-4000-8000-0000000000c2';
const app = createApp(parseConfig());

describe('TR-DG-002 — dental-alert routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/patients/${PATIENT_ID}/dental-alerts`],
    ['GET', `/dental/patients/${PATIENT_ID}/dental-alerts`],
    ['PATCH', `/dental/patients/${PATIENT_ID}/dental-alerts/${ALERT_ID}`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
