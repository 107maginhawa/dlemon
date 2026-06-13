/**
 * PushOptInPrompt tests (notifications FIX-002 / GAP-2).
 *
 * Adapters are injected (no SDK module mock → no cross-file pollution). Pins:
 *   - unconfigured push renders nothing (no fake affordance)
 *   - already-granted / already-dismissed render nothing
 *   - the available case shows the nudge; "Enable" requests permission on the
 *     user gesture and then stops nagging; "Not now" dismisses without requesting.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { PushOptInPrompt } from './push-opt-in-prompt';
import { PUSH_OPT_IN_DISMISSED_KEY } from './lib/push-opt-in';

afterEach(() => {
  cleanup();
  try {
    globalThis.localStorage?.removeItem(PUSH_OPT_IN_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
});

function adapters(overrides: {
  enabled?: boolean;
  granted?: boolean;
  requestResult?: boolean;
  onRequest?: () => void;
}) {
  return {
    isEnabled: () => overrides.enabled ?? true,
    checkPermission: async () => overrides.granted ?? false,
    requestPermission: async () => {
      overrides.onRequest?.();
      return overrides.requestResult ?? true;
    },
  };
}

describe('PushOptInPrompt', () => {
  test('renders nothing when push is unconfigured (honest absence)', async () => {
    let requested = false;
    render(<PushOptInPrompt {...adapters({ enabled: false, onRequest: () => (requested = true) })} />);
    // Give the effect a tick; the nudge must never appear.
    await waitFor(() => expect(screen.queryByTestId('push-opt-in')).toBeNull());
    expect(requested).toBe(false);
  });

  test('renders nothing when permission already granted', async () => {
    render(<PushOptInPrompt {...adapters({ enabled: true, granted: true })} />);
    await waitFor(() => expect(screen.queryByTestId('push-opt-in')).toBeNull());
  });

  test('shows the nudge when available; Enable requests permission then stops nagging', async () => {
    let requested = false;
    render(
      <PushOptInPrompt {...adapters({ enabled: true, granted: false, onRequest: () => (requested = true) })} />,
    );

    const prompt = await screen.findByTestId('push-opt-in');
    expect(prompt).toBeTruthy();

    fireEvent.click(screen.getByTestId('push-opt-in-enable'));

    // Permission was requested on the gesture, and the nudge goes away.
    await waitFor(() => expect(screen.queryByTestId('push-opt-in')).toBeNull());
    expect(requested).toBe(true);
    expect(globalThis.localStorage.getItem(PUSH_OPT_IN_DISMISSED_KEY)).toBe('1');
  });

  test('Not now dismisses without requesting permission', async () => {
    let requested = false;
    render(
      <PushOptInPrompt {...adapters({ enabled: true, granted: false, onRequest: () => (requested = true) })} />,
    );

    await screen.findByTestId('push-opt-in');
    fireEvent.click(screen.getByTestId('push-opt-in-dismiss'));

    await waitFor(() => expect(screen.queryByTestId('push-opt-in')).toBeNull());
    expect(requested).toBe(false);
    expect(globalThis.localStorage.getItem(PUSH_OPT_IN_DISMISSED_KEY)).toBe('1');
  });

  test('renders nothing when already dismissed on this device', async () => {
    globalThis.localStorage.setItem(PUSH_OPT_IN_DISMISSED_KEY, '1');
    render(<PushOptInPrompt {...adapters({ enabled: true, granted: false })} />);
    await waitFor(() => expect(screen.queryByTestId('push-opt-in')).toBeNull());
  });
});
