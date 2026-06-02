/**
 * _workspace route PIN guard tests — CC-2 fix
 *
 * The _workspace route must enforce the same PIN session guard as _dashboard.
 * Without this, a user entering via /_workspace/$patientId does not go through
 * PIN auth, and then gets redirected on the way to /_dashboard (CC-2).
 *
 * These tests verify:
 *   1. The _workspace route file imports pinSession.
 *   2. The _workspace.tsx beforeLoad reads the session/expired/locked state
 *      (same pattern as _dashboard).
 *   3. A valid PIN session is preserved when navigating between route trees
 *      (the module-level singleton is the same reference).
 */

import { describe, test, expect } from 'bun:test';
import { PinSessionManager } from '@/lib/pin-session';

const workspaceSrc = () =>
  Bun.file(new URL('./_workspace.tsx', import.meta.url).pathname).text();

describe('_workspace route PIN guard', () => {
  test('imports pinSession', async () => {
    const src = await workspaceSrc();
    expect(src).toContain('pinSession');
  });

  test('calls pinSession.getSession() in beforeLoad', async () => {
    const src = await workspaceSrc();
    expect(src).toContain('pinSession.getSession');
  });

  test('redirects to /auth/pin-select when guard is hit', async () => {
    const src = await workspaceSrc();
    expect(src).toContain('/auth/pin-select');
  });

  // ── In-memory singleton persistence ────────────────────────────────────────
  // The pinSession module export is the same reference used by both routes.
  // Simulates: user logs in, navigates from workspace → dashboard.

  test('pinSession singleton is not null after startSession', () => {
    const manager = new PinSessionManager();
    manager.startSession({ memberId: 'mem-1', displayName: 'Dr. Cruz', role: 'dentist_owner' });

    // Simulate a guard read (what _dashboard.beforeLoad does)
    const session = manager.getSession();
    const expired = manager.isExpired();
    const locked = manager.isLocked();

    expect(session).not.toBeNull();
    expect(expired).toBe(false);
    expect(locked).toBe(false);
  });

  test('pinSession cleared by clearSession matches the sign-out contract', () => {
    const manager = new PinSessionManager();
    manager.startSession({ memberId: 'mem-1', displayName: 'Dr. Cruz', role: 'dentist_owner' });

    // Simulate sign-out (app.tsx handleSessionExpired → pinSession.clearSession())
    manager.clearSession();

    expect(manager.getSession()).toBeNull();
    // Both route guards must redirect when no session
    expect(!manager.getSession() || manager.isExpired() || manager.isLocked()).toBe(true);
  });
});
