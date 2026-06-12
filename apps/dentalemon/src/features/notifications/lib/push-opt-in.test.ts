/**
 * push-opt-in pure-logic tests (notifications FIX-002 / GAP-2).
 */
import { describe, test, expect, afterEach } from 'bun:test';
import {
  shouldShowPushOptIn,
  isPushOptInDismissed,
  markPushOptInDismissed,
  PUSH_OPT_IN_DISMISSED_KEY,
} from './push-opt-in';

afterEach(() => {
  try {
    globalThis.localStorage?.removeItem(PUSH_OPT_IN_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
});

describe('shouldShowPushOptIn', () => {
  test('shows only when enabled, not granted, and not dismissed', () => {
    expect(shouldShowPushOptIn({ enabled: true, granted: false, dismissed: false })).toBe(true);
  });

  test('hidden when push is unconfigured — no fake affordance', () => {
    expect(shouldShowPushOptIn({ enabled: false, granted: false, dismissed: false })).toBe(false);
  });

  test('hidden when permission already granted', () => {
    expect(shouldShowPushOptIn({ enabled: true, granted: true, dismissed: false })).toBe(false);
  });

  test('hidden when already dismissed on this device', () => {
    expect(shouldShowPushOptIn({ enabled: true, granted: false, dismissed: true })).toBe(false);
  });
});

describe('dismissed flag persistence', () => {
  test('round-trips through localStorage', () => {
    expect(isPushOptInDismissed()).toBe(false);
    markPushOptInDismissed();
    expect(isPushOptInDismissed()).toBe(true);
  });
});
