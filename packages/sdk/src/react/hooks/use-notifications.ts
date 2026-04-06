import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as notificationsApi from '../../services/notifications'
import { queryKeys } from '../query-keys'
import { toast } from 'sonner'
import type {
  ListNotificationsParams,
  Notification,
} from '../../services/notifications'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * List notifications with optional filters
 *
 * @param params - Filter and pagination parameters
 * @returns Query result with notifications data
 */
export function useNotifications(params?: ListNotificationsParams) {
  return useQuery({
    queryKey: queryKeys.notificationsList(params),
    queryFn: () => notificationsApi.listNotifications(params),
    staleTime: 1 * 60 * 1000, // 1 minute - notifications should be fresh
  })
}

/**
 * Get unread notifications only
 * Convenience hook for fetching unread notifications
 *
 * @returns Query result with unread notifications
 */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: queryKeys.notificationsList({ status: 'unread' }),
    queryFn: () => notificationsApi.listNotifications({ status: 'unread' }),
    staleTime: 30 * 1000, // 30 seconds - unread count should be very fresh
    refetchInterval: 60 * 1000, // Refetch every minute for unread notifications
  })
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Mark notification as read
 *
 * @returns Mutation for marking notification as read
 */
export function useMarkNotificationAsRead(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationsApi.markNotificationAsRead(notificationId),
    onMutate: async (notificationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications() })

      // Snapshot the previous value
      const previousNotification = queryClient.getQueryData<Notification>(
        queryKeys.notification(notificationId)
      )

      // Optimistically update notification
      if (previousNotification) {
        queryClient.setQueryData<Notification>(
          queryKeys.notification(notificationId),
          {
            ...previousNotification,
            readAt: new Date(),
            status: 'read',
          }
        )
      }

      return { previousNotification }
    },
    onSuccess: (data) => {
      options?.onSuccess?.(data)
    },
    onError: (error, notificationId, context) => {
      // Rollback on error
      if (context?.previousNotification) {
        queryClient.setQueryData(
          queryKeys.notification(notificationId),
          context.previousNotification
        )
      }
      
      if (options?.toastError !== false) {
        toast.error('Failed to mark notification as read')
      }
      
      options?.onError?.(error)
    },
    onSettled: () => {
      // Refetch all notification queries
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() })
    },
  })
}

/**
 * Mark all notifications as read
 *
 * @returns Mutation for marking all notifications as read
 */
export function useMarkAllNotificationsAsRead(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => notificationsApi.markAllNotificationsAsRead(),
    onSuccess: (data) => {
      if (options?.toastSuccess !== false) {
        toast.success(`${data.markedCount} notifications marked as read`)
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error) => {
      if (options?.toastError !== false) {
        toast.error('Failed to mark all notifications as read')
      }
      
      options?.onError?.(error)
    },
    onSettled: () => {
      // Refetch all notification queries
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() })
    },
  })
}
