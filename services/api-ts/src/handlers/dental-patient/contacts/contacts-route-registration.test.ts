/**
 * TR-DG-002 — patient-contacts route registration smoke (real app)
 *
 * The patient contact endpoints (PAT-BR-002) are now declared in TypeSpec
 * (dental-patient-engagement.tsp → PatientContactMgmt in main.tsp) and wired via
 * the generated OpenAPI routes, replacing the former app.ts hand-registration.
 * Each route must resolve on the REAL app: an unauthenticated request returns
 * 401 (route registered + auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const PATIENT_ID = 'b3000000-0000-4000-8000-0000000000a1';
const CONTACT_ID = 'b3000000-0000-4000-8000-0000000000a2';
const app = createApp(parseConfig());

describe('TR-DG-002 — patient contacts routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/patients/${PATIENT_ID}/contacts`],
    ['GET', `/dental/patients/${PATIENT_ID}/contacts`],
    ['PATCH', `/dental/patients/${PATIENT_ID}/contacts/${CONTACT_ID}`],
    ['DELETE', `/dental/patients/${PATIENT_ID}/contacts/${CONTACT_ID}`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
