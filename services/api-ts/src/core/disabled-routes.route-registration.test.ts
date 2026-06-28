/**
 * #37 — prod attack-surface guard, REAL app wiring smoke.
 *
 * Unit tests (disabled-routes.test.ts) prove the matcher; this proves the guard
 * is actually wired into createApp BEFORE the generated routes. The harness's
 * buildTestApp mounts only the generated route table and does NOT run the
 * app.ts middleware, so this must go through the real createApp(parseConfig()).
 *
 * Built with the test config but NODE_ENV forced to 'production' across the
 * createApp call so the guard activates; config object stays the test one.
 */
import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const cfg = parseConfig();

function buildApp(production: boolean) {
  const prev = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = production ? 'production' : 'test';
  try {
    return createApp(cfg);
  } finally {
    process.env['NODE_ENV'] = prev;
  }
}

const prodApp = buildApp(true);
const devApp = buildApp(false);

describe('#37 prod-disabled routes — real app wiring', () => {
  test('denylisted base route is 404 in production', async () => {
    const res = await prodApp.request('/comms/ice-servers');
    expect(res.status).toBe(404);
  });

  test('same denylisted route is live (auth-gated, 401) outside production', async () => {
    const res = await devApp.request('/comms/ice-servers');
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  test('a :param denylisted route is 404 in production', async () => {
    const res = await prodApp.request('/patients/p_1', { method: 'GET' });
    expect(res.status).toBe(404);
  });

  test('dental product routes are NOT blocked in production (401 auth-gate, not 404)', async () => {
    const res = await prodApp.request('/dental/legal-holds');
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  test('storage stays live in production (auth-gated, not 404)', async () => {
    const res = await prodApp.request('/storage/files');
    expect(res.status).not.toBe(404);
  });
});
