/**
 * TR-DG-002 — treatment-plans (plural) route registration smoke (real app)
 *
 * The plural treatment-plan header endpoints (create / list / update / approval)
 * are now declared in TypeSpec (dental-patient-finance.tsp →
 * DentalTreatmentPlanHeaderMgmt in main.tsp) and wired via the generated OpenAPI
 * routes, replacing the former app.ts hand-registration. Each route must resolve
 * on the REAL app: an unauthenticated request returns 401 (route registered +
 * auth-gated), NOT 404 (route missing).
 *
 * NOTE: the GET-by-id and /accept plural routes are re-export shims of the
 * dental-visit singular handlers and keep their original operationIds, so they
 * are intentionally NOT migrated here (a global operationId cannot be duplicated).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const PATIENT_ID = 'b3000000-0000-4000-8000-0000000000a1';
const PLAN_ID = 'b3000000-0000-4000-8000-0000000000a2';
const app = createApp(parseConfig());

describe('TR-DG-002 — treatment-plans (plural) routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/patients/${PATIENT_ID}/treatment-plans`],
    ['GET', `/dental/patients/${PATIENT_ID}/treatment-plans`],
    ['PATCH', `/dental/patients/${PATIENT_ID}/treatment-plans/${PLAN_ID}`],
    ['POST', `/dental/patients/${PATIENT_ID}/treatment-plans/${PLAN_ID}/approval`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
