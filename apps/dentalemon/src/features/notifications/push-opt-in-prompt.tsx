/**
 * PushOptInPrompt — push notification opt-in (notifications FIX-002 / GAP-2).
 *
 * A dismissible, in-context nudge that asks the clinician to enable push. Per the
 * product decision (Q2: "prompt at the first relevant clinical action, not at
 * login") it is mounted in the patient-workspace shell, so it appears the first
 * time a user opens a patient record — not on a cold login screen.
 *
 * Honesty rules:
 *   - If push is unconfigured/uninitialized (no OneSignal app id), render NOTHING.
 *     A button that can't request permission is worse than no button.
 *   - Permission is requested only on a real user gesture (clicking "Enable").
 *   - After any response (grant, deny, or "Not now") we stop nagging on this device.
 *
 * The OneSignal adapters are injectable so the show/hide + gesture wiring is
 * testable without mocking the SDK module (avoids cross-file mock pollution).
 */
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import {
  isOneSignalEnabled,
  hasNotificationPermission,
  requestNotificationPermission,
} from './onesignal';
import {
  shouldShowPushOptIn,
  isPushOptInDismissed,
  markPushOptInDismissed,
} from './lib/push-opt-in';

export interface PushOptInPromptProps {
  /** Adapters default to the real OneSignal exports; overridden in tests. */
  isEnabled?: () => boolean;
  checkPermission?: () => Promise<boolean>;
  requestPermission?: () => Promise<boolean>;
}

export function PushOptInPrompt({
  isEnabled = isOneSignalEnabled,
  checkPermission = hasNotificationPermission,
  requestPermission = requestNotificationPermission,
}: PushOptInPromptProps = {}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Decide once on mount. If push isn't available, never show the nudge.
    if (!isEnabled()) {
      setVisible(false);
      return;
    }
    void (async () => {
      const granted = await checkPermission().catch(() => false);
      if (cancelled) return;
      setVisible(
        shouldShowPushOptIn({ enabled: true, granted, dismissed: isPushOptInDismissed() }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [isEnabled, checkPermission]);

  if (!visible) return null;

  async function handleEnable() {
    try {
      await requestPermission();
    } finally {
      // Whatever the browser answered, the opt-in moment is over — don't re-prompt.
      markPushOptInDismissed();
      setVisible(false);
    }
  }

  function handleDismiss() {
    markPushOptInDismissed();
    setVisible(false);
  }

  // z-40 keeps this non-critical nudge BELOW the workspace bottom-sheets (z-50) so
  // it never sits over a sheet's controls when one is open.
  return (
    <div
      data-testid="push-opt-in"
      role="region"
      aria-label="Enable push notifications"
      className="fixed bottom-4 right-4 z-40 w-80 max-w-[90vw] rounded-xl border border-border bg-background p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Turn on push notifications</span>
          <span className="text-xs text-muted-foreground">
            Get appointment, recall, and billing alerts on this device — even when Dentalemon isn’t
            open.
          </span>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          data-testid="push-opt-in-dismiss"
          onClick={handleDismiss}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Not now
        </button>
        <button
          type="button"
          data-testid="push-opt-in-enable"
          onClick={handleEnable}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Enable notifications
        </button>
      </div>
    </div>
  );
}
