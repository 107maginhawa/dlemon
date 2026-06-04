/**
 * TR-DG-002 — audit-events route registration smoke (real app)
 *
 * GET /dental/audit-events is now declared in TypeSpec (dental-audit.tsp →
 * DentalAuditMgmt in main.tsp) and wired via the generated OpenAPI routes,
 * replacing the former app.ts hand-registration. An unauthenticated request
 * must return 401 (route registered + auth-gated), NOT 404 (route missing).
 * The append-only /:id 405 guards remain hand-mounted and are covered by
 * audit-append-only.test.ts.
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const app = createApp(parseConfig());

describe('TR-DG-002 — audit-events route is codegen-registered (real app)', () => {
  test('GET /dental/audit-events unauthenticated → 401 (not 404)', async () => {
    const res = await app.request('/dental/audit-events?branchId=da090001-0000-0000-0000-000000000020');
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });
});
