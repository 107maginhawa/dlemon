/**
 * Push opt-in decision logic (notifications FIX-002 / GAP-2).
 *
 * Pure helpers shared by the PushOptInPrompt. Kept separate from the component so
 * the show/hide rule is unit-testable without a DOM or the OneSignal SDK.
 */

/** Per-device flag: the user has already responded to (or dismissed) the prompt. */
export const PUSH_OPT_IN_DISMISSED_KEY = 'dentalemon.pushOptInDismissed';

export interface PushOptInState {
  /** OneSignal is configured AND initialized (push is actually available). */
  enabled: boolean;
  /** The browser has already granted push permission. */
  granted: boolean;
  /** The user already opted in/out via the prompt on this device. */
  dismissed: boolean;
}

/**
 * Show the opt-in prompt only when push is genuinely available, not yet granted,
 * and not previously dismissed. When push is unconfigured we render nothing — an
 * honest absence beats a button that can't do anything.
 */
export function shouldShowPushOptIn(state: PushOptInState): boolean {
  return state.enabled && !state.granted && !state.dismissed;
}

/** Read the dismissed flag, tolerating a missing/sandboxed localStorage. */
export function isPushOptInDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(PUSH_OPT_IN_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist the dismissed flag, tolerating a missing/sandboxed localStorage. */
export function markPushOptInDismissed(): void {
  try {
    globalThis.localStorage?.setItem(PUSH_OPT_IN_DISMISSED_KEY, '1');
  } catch {
    /* no-op: best-effort persistence */
  }
}
