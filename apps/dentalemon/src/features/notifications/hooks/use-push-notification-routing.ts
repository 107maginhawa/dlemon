/**
 * usePushNotificationRouting — route a clicked push to its in-app deep link
 * (notifications FIX-002 / GAP-2).
 *
 * Registers a single OneSignal click listener (no-op when push is unconfigured)
 * that navigates to the notification's deep link. Registration is module-guarded
 * because the OneSignal SDK can't remove anonymous listeners, so mounting this in
 * more than one shell still attaches exactly one handler for the page lifetime.
 *
 * The click → deep-link mapping itself lives in (and is tested via) the pure
 * `makeNotificationClickHandler` / `resolveNotificationDeepLink`.
 */
import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { onNotificationClick } from '../onesignal';
import { makeNotificationClickHandler } from '../lib/notification-routing';

let registered = false;

export function usePushNotificationRouting(): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (registered) return;
    registered = true;
    onNotificationClick(makeNotificationClickHandler((opts) => void navigate({ to: opts.to as never })));
  }, [navigate]);
}
