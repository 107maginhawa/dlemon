/**
 * deactivateMember — REAL route-registration test (TR-PHANTOM-ORG-001 regression guard).
 *
 * The handler-level test (deactivateMember.test.ts) hand-mounts the route on a
 * throwaway Hono app, so it cannot catch a missing entry in the GENERATED route
 * table. The FE (apps/dentalemon staff "Deactivate") calls
 * `DELETE /dental/org/members/:memberId`; this asserts that path is actually
 * registered by the generated `registerRoutes`, and that the handler is wired
 * into the registry — the two things that were broken when the FE 404'd.
 *
 * Pure wiring assertion: inspects `app.routes`, hits no database.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import type { Variables } from '@/types/app';
import { registerRoutes } from '@/generated/openapi/routes';
import { registry } from '@/generated/openapi/registry';

describe('deactivateMember route registration (TR-PHANTOM-ORG-001)', () => {
  test('DELETE /dental/org/members/:memberId is registered in the generated route table', () => {
    const app = new Hono<{ Variables: Variables }>();
    registerRoutes(app);

    const hasDeleteMember = app.routes.some(
      (r) => r.method === 'DELETE' && r.path === '/dental/org/members/:memberId',
    );

    expect(hasDeleteMember).toBe(true);
  });

  test('deactivateMember handler is wired into the registry', () => {
    expect(typeof (registry as Record<string, unknown>)['deactivateMember']).toBe('function');
  });
});
