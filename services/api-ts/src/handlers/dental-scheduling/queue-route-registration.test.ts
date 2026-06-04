/**
 * TR-DG-002 — queue-board route registration smoke (real app)
 *
 * The queue-board endpoints (A5 P1-003) are now declared in TypeSpec
 * (dental-ops-extras.tsp → QueueItemCreation / QueueBoardListing /
 * QueueItemStatusManagement in main.tsp) and wired via the generated OpenAPI
 * routes, replacing the former app.ts hand-registration. Each route must
 * resolve on the REAL app: an unauthenticated request returns 401 (route
 * registered + auth-gated), NOT 404 (route missing).
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const ID = 'b3000000-0000-4000-8000-0000000000aa';
const app = createApp(parseConfig());

describe('TR-DG-002 — queue-board routes are codegen-registered (real app)', () => {
  const cases: Array<[string, string]> = [
    ['POST', `/dental/appointments/${ID}/queue-item`],
    ['GET', `/dental/branches/${ID}/queue-board`],
    ['PATCH', `/dental/queue-items/${ID}/status`],
  ];

  for (const [method, path] of cases) {
    test(`${method} ${path} unauthenticated → 401 (not 404)`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });
  }
});
