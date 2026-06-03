/**
 * POST /dental/onboarding route-registration smoke (real app).
 *
 * The handler-logic tests (createOnboarding.test.ts) wire the handler into a bare
 * Hono app, so they cannot catch a codegen/registry wiring break. This hits the
 * REAL app built from the generated routes: unauthenticated must 401 (registered +
 * auth-gated), NOT 404 (missing route).
 */
import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const app = createApp(parseConfig());

describe('POST /dental/onboarding is codegen-registered (real app)', () => {
  test('unauthenticated → 401 (not 404)', async () => {
    const res = await app.request('/dental/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationName: 'X', tier: 'clinic', countryCode: 'PH' }),
    });
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });
});
