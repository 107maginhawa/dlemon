/**
 * Push notification click → in-app deep-link routing (notifications FIX-002 / GAP-2).
 *
 * The backend attaches a `data` payload to every OneSignal push
 * (services/api-ts/.../notification.repo.ts): `{ notificationId, type, relatedEntity }`.
 * On click, the SDK surfaces that as the event's `additionalData`. These pure
 * helpers turn that payload into a concrete app route so a click always lands on a
 * real screen — never a dead tap.
 */

export interface PushClickData {
  type?: string;
  relatedEntity?: string;
  notificationId?: string;
}

/**
 * Map a push payload to an in-app route. Best-effort by notification `type`
 * prefix; anything unrecognised falls back to the dashboard (where the in-app
 * bell/inbox lives) so the click is never a no-op.
 */
export function resolveNotificationDeepLink(data: PushClickData | null | undefined): string {
  const type = (data?.type ?? '').toLowerCase();
  if (type.startsWith('appointment') || type.startsWith('booking')) return '/calendar';
  if (type.startsWith('recall')) return '/patients';
  if (type.startsWith('invoice') || type.startsWith('payment') || type.startsWith('billing')) {
    return '/billing';
  }
  return '/dashboard';
}

/** Loosely-typed OneSignal click event (its `additionalData` is the backend `data`). */
interface NotificationClickEventLike {
  notification?: { additionalData?: unknown };
  additionalData?: unknown;
}

/**
 * Build the click handler that routes a clicked push to its deep link. Factored
 * out of the hook so the click → navigate wiring is testable with a spy navigate
 * and no router/SDK mounting.
 */
export function makeNotificationClickHandler(
  navigate: (opts: { to: string }) => void,
): (event: NotificationClickEventLike | undefined) => void {
  return (event) => {
    const raw = event?.notification?.additionalData ?? event?.additionalData;
    const data = (raw && typeof raw === 'object' ? raw : undefined) as PushClickData | undefined;
    navigate({ to: resolveNotificationDeepLink(data) });
  };
}
