/**
 * PinSessionManager tests
 *
 * Tests local PIN session lifecycle: start, inactivity timeout, auto-lock,
 * state preservation on re-auth, and session clearing.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { PinSessionManager, INACTIVITY_TIMEOUT_MS } from './pin-session';

describe('PinSessionManager', () => {
  let manager: PinSessionManager;

  beforeEach(() => {
    manager = new PinSessionManager();
  });

  // --------------------------------------------------------------------------
  // Session start / get
  // --------------------------------------------------------------------------

  test('getSession returns null when no session is active', () => {
    expect(manager.getSession()).toBeNull();
  });

  test('startSession sets the active member', () => {
    manager.startSession({ memberId: 'mem-1', displayName: 'Dr. Juan Cruz', role: 'dentist_owner' });
    const session = manager.getSession();
    expect(session).not.toBeNull();
    expect(session!.memberId).toBe('mem-1');
    expect(session!.displayName).toBe('Dr. Juan Cruz');
    expect(session!.role).toBe('dentist_owner');
  });

  test('startSession records lastActiveAt as now', () => {
    const before = Date.now();
    manager.startSession({ memberId: 'mem-1', displayName: 'Staff Ana', role: 'staff_full' });
    const after = Date.now();
    const session = manager.getSession();
    expect(session!.lastActiveAt).toBeGreaterThanOrEqual(before);
    expect(session!.lastActiveAt).toBeLessThanOrEqual(after);
  });

  // --------------------------------------------------------------------------
  // Activity tracking
  // --------------------------------------------------------------------------

  test('updateActivity refreshes lastActiveAt', () => {
    manager.startSession({ memberId: 'mem-1', displayName: 'Staff Ana', role: 'staff_full' });
    const initial = manager.getSession()!.lastActiveAt;

    // Simulate some time passing
    const future = initial + 1000;
    manager.updateActivity(future);

    expect(manager.getSession()!.lastActiveAt).toBe(future);
  });

  test('updateActivity is a no-op when no session is active', () => {
    expect(() => manager.updateActivity(Date.now())).not.toThrow();
    expect(manager.getSession()).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Inactivity detection
  // --------------------------------------------------------------------------

  test('isExpired returns false when session is fresh', () => {
    manager.startSession({ memberId: 'mem-1', displayName: 'Staff Ana', role: 'staff_full' });
    expect(manager.isExpired()).toBe(false);
  });

  test('isExpired returns true when lastActiveAt exceeds INACTIVITY_TIMEOUT_MS', () => {
    manager.startSession({ memberId: 'mem-1', displayName: 'Staff Ana', role: 'staff_full' });
    const expiredTime = Date.now() - INACTIVITY_TIMEOUT_MS - 1;
    manager.updateActivity(expiredTime);
    expect(manager.isExpired()).toBe(true);
  });

  test('isExpired returns false when no session', () => {
    expect(manager.isExpired()).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Session clear / lock
  // --------------------------------------------------------------------------

  test('clearSession removes the active session', () => {
    manager.startSession({ memberId: 'mem-1', displayName: 'Dr. Juan Cruz', role: 'dentist_owner' });
    manager.clearSession();
    expect(manager.getSession()).toBeNull();
  });

  test('clearSession is idempotent (no-op when no session)', () => {
    expect(() => manager.clearSession()).not.toThrow();
    expect(manager.getSession()).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Re-auth (session preservation)
  // --------------------------------------------------------------------------

  test('lockForReauth marks session as locked but preserves memberId', () => {
    manager.startSession({ memberId: 'mem-1', displayName: 'Dr. Juan Cruz', role: 'dentist_owner' });
    manager.lockForReauth();

    const session = manager.getSession();
    expect(session).not.toBeNull();
    expect(session!.locked).toBe(true);
    expect(session!.memberId).toBe('mem-1'); // preserved for re-auth
  });

  test('unlockSession clears lock and refreshes lastActiveAt', () => {
    manager.startSession({ memberId: 'mem-1', displayName: 'Dr. Juan Cruz', role: 'dentist_owner' });
    manager.lockForReauth();

    const before = Date.now();
    manager.unlockSession();
    const after = Date.now();

    const session = manager.getSession();
    expect(session!.locked).toBe(false);
    expect(session!.lastActiveAt).toBeGreaterThanOrEqual(before);
    expect(session!.lastActiveAt).toBeLessThanOrEqual(after);
  });

  test('isLocked returns true when session is locked', () => {
    manager.startSession({ memberId: 'mem-1', displayName: 'Staff Ana', role: 'staff_full' });
    manager.lockForReauth();
    expect(manager.isLocked()).toBe(true);
  });

  test('isLocked returns false when session is active', () => {
    manager.startSession({ memberId: 'mem-1', displayName: 'Staff Ana', role: 'staff_full' });
    expect(manager.isLocked()).toBe(false);
  });

  test('isLocked returns false when no session', () => {
    expect(manager.isLocked()).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Active auto-logoff (HIPAA workstation security) — timer fires onExpire
  // --------------------------------------------------------------------------

  test('onExpire callback fires and session locks after the inactivity timeout elapses', async () => {
    const shortManager = new PinSessionManager();
    let expiredCalls = 0;
    shortManager.onExpire(() => { expiredCalls += 1; });
    shortManager.startSession({ memberId: 'mem-1', displayName: 'Staff Ana', role: 'staff_full', timeoutMs: 20 });

    expect(shortManager.isLocked()).toBe(false);
    await new Promise((r) => setTimeout(r, 40));

    expect(expiredCalls).toBe(1);
    expect(shortManager.isLocked()).toBe(true);
    // Session identity preserved so the re-auth screen knows who to prompt.
    expect(shortManager.getSession()!.memberId).toBe('mem-1');
  });

  test('updateActivity defers the auto-logoff (timer is reset on interaction)', async () => {
    const shortManager = new PinSessionManager();
    let expiredCalls = 0;
    shortManager.onExpire(() => { expiredCalls += 1; });
    shortManager.startSession({ memberId: 'mem-1', displayName: 'Staff Ana', role: 'staff_full', timeoutMs: 40 });

    // Keep interacting before the timeout would fire.
    await new Promise((r) => setTimeout(r, 25));
    shortManager.updateActivity();
    await new Promise((r) => setTimeout(r, 25));

    expect(expiredCalls).toBe(0);
    expect(shortManager.isLocked()).toBe(false);
  });

  test('onExpire does not double-fire when already locked', async () => {
    const shortManager = new PinSessionManager();
    let expiredCalls = 0;
    shortManager.onExpire(() => { expiredCalls += 1; });
    shortManager.startSession({ memberId: 'mem-1', displayName: 'Staff Ana', role: 'staff_full', timeoutMs: 15 });
    await new Promise((r) => setTimeout(r, 30));
    // Already locked; a stray updateActivity must not re-arm and re-fire.
    shortManager.updateActivity();
    await new Promise((r) => setTimeout(r, 30));
    expect(expiredCalls).toBe(1);
  });

  // --------------------------------------------------------------------------
  // INACTIVITY_TIMEOUT_MS constant
  // --------------------------------------------------------------------------

  test('INACTIVITY_TIMEOUT_MS defaults to 5 minutes', () => {
    expect(INACTIVITY_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });
});
