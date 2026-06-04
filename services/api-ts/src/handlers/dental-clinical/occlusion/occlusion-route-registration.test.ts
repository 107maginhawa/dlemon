/**
 * TR-DG-002 — occlusion-screening route registration smoke (real app)
 *
 * The occlusion-screening endpoints (P2-002) are now declared in TypeSpec
 * (dental-clinical-ops.tsp → OcclusionScreeningMgmt in main.tsp) and wired via
 * the generated OpenAPI routes, replacing the former app.ts hand-registration.
 * Each route must resolve on the REAL app: an unauthenticated request returns
 * 401 (route registered + auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const PATIENT_ID = 'b3000000-0000-4000-8000-0000000000aa';
const app = createApp(parseConfig());

describe('TR-DG-002 — occlusion-screening routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/patients/${PATIENT_ID}/occlusion-screenings`],
    ['GET', `/dental/patients/${PATIENT_ID}/occlusion-screenings`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
