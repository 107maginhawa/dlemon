/**
 * EM-CLI-001 — consent-revoke route registration smoke (real app)
 *
 * revokeConsentForm is now declared in TypeSpec and wired via the generated
 * OpenAPI routes (PATCH /dental/visits/:visitId/consents/:cid/revoke), replacing
 * the former app.ts hand-registration. This boot-smoke proves the route actually
 * resolves on the REAL application (createApp) — an unauthenticated request must
 * return 401 (route registered + auth-gated), NOT 404 (route missing). Mirrors
 * the audit-append-only / imported-pmd-immutable real-app pattern.
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const VISIT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CID = 'bbbbbbbb-1111-4000-8000-000000000002';

const app = createApp(parseConfig());

describe('EM-CLI-001 — consent-revoke route is registered (real app)', () => {
  test('PATCH /dental/visits/:visitId/consents/:cid/revoke unauthenticated → 401 (not 404)', async () => {
    const res = await app.request(`/dental/visits/${VISIT_ID}/consents/${CID}/revoke`, {
      method: 'PATCH',
    });
    // 401 proves the route resolved and hit authMiddleware; 404 would mean the
    // generated registration is missing.
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });
});
