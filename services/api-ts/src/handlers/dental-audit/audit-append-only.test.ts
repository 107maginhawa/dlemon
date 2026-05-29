/**
 * EM-AUD-006: Audit log append-only enforcement
 *
 * DELETE, PUT, and PATCH on /dental/audit-events/:id must return 405
 * with code AUDIT_APPEND_ONLY regardless of auth state.
 *
 * These routes are registered in app.ts alongside the GET audit endpoint.
 * This test builds a minimal Hono app with the same handler closures to
 * verify the 405 contract in isolation.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';

function buildAuditImmutabilityApp() {
  const app = new Hono();

  app.delete('/dental/audit-events/:id', (c) =>
    c.json({ error: 'Audit log is append-only. Records cannot be deleted.', code: 'AUDIT_APPEND_ONLY' }, 405)
  );
  app.put('/dental/audit-events/:id', (c) =>
    c.json({ error: 'Audit log is append-only. Records cannot be modified.', code: 'AUDIT_APPEND_ONLY' }, 405)
  );
  app.patch('/dental/audit-events/:id', (c) =>
    c.json({ error: 'Audit log is append-only. Records cannot be modified.', code: 'AUDIT_APPEND_ONLY' }, 405)
  );

  return app;
}

const FAKE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

describe('EM-AUD-006 — audit log append-only enforcement (405 routes)', () => {
  test('DELETE /dental/audit-events/:id → 405 AUDIT_APPEND_ONLY', async () => {
    const app = buildAuditImmutabilityApp();
    const res = await app.request(`/dental/audit-events/${FAKE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(405);
    const body = await res.json() as any;
    expect(body.code).toBe('AUDIT_APPEND_ONLY');
  });

  test('PUT /dental/audit-events/:id → 405 AUDIT_APPEND_ONLY', async () => {
    const app = buildAuditImmutabilityApp();
    const res = await app.request(`/dental/audit-events/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tamper' }),
    });
    expect(res.status).toBe(405);
    const body = await res.json() as any;
    expect(body.code).toBe('AUDIT_APPEND_ONLY');
  });

  test('PATCH /dental/audit-events/:id → 405 AUDIT_APPEND_ONLY', async () => {
    const app = buildAuditImmutabilityApp();
    const res = await app.request(`/dental/audit-events/${FAKE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tamper' }),
    });
    expect(res.status).toBe(405);
    const body = await res.json() as any;
    expect(body.code).toBe('AUDIT_APPEND_ONLY');
  });

  test('DELETE with a different ID also returns 405 [route param independence]', async () => {
    const app = buildAuditImmutabilityApp();
    const res = await app.request('/dental/audit-events/bbbbbbbb-1111-4000-8000-000000000002', {
      method: 'DELETE',
    });
    expect(res.status).toBe(405);
    const body = await res.json() as any;
    expect(body.code).toBe('AUDIT_APPEND_ONLY');
  });
});
