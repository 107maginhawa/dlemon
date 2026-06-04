/**
 * TR-DG-002 — patient-tasks route registration smoke (real app)
 *
 * The patient task endpoints (P2-003) are now declared in TypeSpec
 * (dental-patient-engagement.tsp → PatientTaskMgmt in main.tsp) and wired via the
 * generated OpenAPI routes, replacing the former app.ts hand-registration.
 * Each route must resolve on the REAL app: an unauthenticated request returns
 * 401 (route registered + auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const PATIENT_ID = 'b3000000-0000-4000-8000-0000000000d1';
const TASK_ID = 'b3000000-0000-4000-8000-0000000000d2';
const app = createApp(parseConfig());

describe('TR-DG-002 — patient task routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/patients/${PATIENT_ID}/tasks`],
    ['GET', `/dental/patients/${PATIENT_ID}/tasks`],
    ['PATCH', `/dental/patients/${PATIENT_ID}/tasks/${TASK_ID}`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
