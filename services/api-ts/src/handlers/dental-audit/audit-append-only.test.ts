/**
 * EM-AUD-006 / AC-AUD-002: Audit log append-only enforcement
 *
 * DELETE, PUT, and PATCH on /dental/audit-events/:id must return 405 with code
 * AUDIT_EVENT_IMMUTABLE regardless of auth state.
 *
 * V-AUD-008: this suite previously stood up a throwaway Hono app with inline
 * closures, so it asserted nothing about the routes ACTUALLY registered in
 * app.ts — a passing test that proved zero wiring (see [[feedback_test_verification]]).
 * It now builds the REAL application via createApp(parseConfig()) and exercises
 * the registered immutability guards end-to-end.
 *
 * V-AUD-005: the immutability code is AUDIT_EVENT_IMMUTABLE (ERROR_TAXONOMY §5),
 * not the legacy AUDIT_APPEND_ONLY.
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const FAKE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER_ID = 'bbbbbbbb-1111-4000-8000-000000000002';

// Build the real, fully-wired application once. The append-only guards are
// inline 405 responders with no auth/DB dependency, so they respond directly.
const app = createApp(parseConfig());

describe('AC-AUD-002 / EM-AUD-006 — audit log append-only (real app routes)', () => {
  test('DELETE /dental/audit-events/:id → 405 AUDIT_EVENT_IMMUTABLE', async () => {
    const res = await app.request(`/dental/audit-events/${FAKE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(405);
    const body = (await res.json()) as any;
    expect(body.code).toBe('AUDIT_EVENT_IMMUTABLE');
  });

  test('PUT /dental/audit-events/:id → 405 AUDIT_EVENT_IMMUTABLE', async () => {
    const res = await app.request(`/dental/audit-events/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tamper' }),
    });
    expect(res.status).toBe(405);
    const body = (await res.json()) as any;
    expect(body.code).toBe('AUDIT_EVENT_IMMUTABLE');
  });

  test('PATCH /dental/audit-events/:id → 405 AUDIT_EVENT_IMMUTABLE', async () => {
    const res = await app.request(`/dental/audit-events/${FAKE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tamper' }),
    });
    expect(res.status).toBe(405);
    const body = (await res.json()) as any;
    expect(body.code).toBe('AUDIT_EVENT_IMMUTABLE');
  });

  test('DELETE with a different ID also returns 405 [route param independence]', async () => {
    const res = await app.request(`/dental/audit-events/${OTHER_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(405);
    const body = (await res.json()) as any;
    expect(body.code).toBe('AUDIT_EVENT_IMMUTABLE');
  });
});
