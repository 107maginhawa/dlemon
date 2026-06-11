/**
 * useNotifications / useMarkNotificationRead / useMarkAllNotificationsRead
 * — in-app notification surface (notifications FIX-001, GAP-1).
 *
 * Pure FE wiring over the generated SDK notification operations. The backend is
 * frozen; this consumes already-tested ops with zero schema/TypeSpec change:
 *   - GET  /notifs?status=unread&channel=in-app   (listNotifications)
 *   - POST /notifs/{notif}/read                   (markNotificationAsRead)
 *   - POST /notifs/read-all                        (markAllNotificationsAsRead)
 *
 * SINGLE SOURCE OF TRUTH: the unread badge count and the rendered rows both come
 * from this one unread query (`pagination.totalCount` and `data`). They cannot
 * diverge — the summary/body coherence bug class is structurally impossible here.
 * Notifications are recipient-scoped server-side (the handler filters by the
 * authenticated user's id), so the panel only ever shows the viewer's own rows.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listNotificationsOptions,
  listNotificationsQueryKey,
  markNotificationAsReadMutation,
  markAllNotificationsAsReadMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { Notification } from '@monobase/sdk-ts/generated';

export const NOTIFICATION_PAGE_SIZE = 25;

/** The unread, in-app query that feeds BOTH the badge and the inbox panel. */
const unreadQueryOptions = {
  query: {
    status: 'unread' as const,
    channel: 'in-app' as const,
    limit: NOTIFICATION_PAGE_SIZE,
  },
};

export function useNotifications() {
  const query = useQuery({
    ...listNotificationsOptions(unreadQueryOptions),
    // V1 polling refresh (no websockets — see fix plan §11 Do Not Build). Keeps the
    // badge live without a realtime channel.
    refetchInterval: 60_000,
  });

  const data = query.data as
    | { data?: Notification[]; pagination?: { totalCount?: number } }
    | undefined;

  const notifications = data?.data ?? [];

  return {
    notifications,
    // Authoritative unread total from the same response that lists the rows.
    unreadCount: data?.pagination?.totalCount ?? notifications.length,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

/** Invalidate every listNotifications query (partial key match) so the badge + panel refetch. */
function invalidateNotifications(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: listNotificationsQueryKey() });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...markNotificationAsReadMutation(),
    onSuccess: () => invalidateNotifications(queryClient),
  });
  return {
    markRead: (id: string) => mutation.mutate({ path: { notif: id } }),
    isPending: mutation.isPending,
  };
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...markAllNotificationsAsReadMutation(),
    onSuccess: () => invalidateNotifications(queryClient),
  });
  return {
    markAllRead: () => mutation.mutate({}),
    isPending: mutation.isPending,
  };
}
