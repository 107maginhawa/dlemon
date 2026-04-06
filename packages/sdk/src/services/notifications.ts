import { apiGet, apiPost, type PaginatedResponse } from '../api'
import type { components } from '@monobase/api-spec/types'
import { mapPaginatedResponse } from '../utils/api'

// ============================================================================
// API Type Aliases
// ============================================================================

type ApiNotification = components["schemas"]["Notification"]
export type NotificationType = components["schemas"]["NotificationType"]
export type NotificationChannel = components["schemas"]["NotificationChannel"]
export type NotificationStatus = components["schemas"]["NotificationStatus"]

// ============================================================================
// Frontend Types
// ============================================================================

/**
 * Frontend representation of a Notification with Date objects
 */
export interface Notification {
  id: string
  recipient: string
  type: NotificationType
  channel: NotificationChannel
  title: string
  message: string
  scheduledAt?: Date
  relatedEntityType?: string
  relatedEntity?: string
  status: NotificationStatus
  sentAt?: Date
  readAt?: Date
  consentValidated: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Paginated list of notifications
 */
export type NotificationsList = PaginatedResponse<Notification>

/**
 * Parameters for listing notifications
 */
export interface ListNotificationsParams {
  type?: NotificationType
  channel?: NotificationChannel
  status?: NotificationStatus
  startDate?: string
  endDate?: string
  offset?: number
  limit?: number
  page?: number
  pageSize?: number
  search?: string
  sort?: string
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Convert API Notification response to Frontend Notification
 */
export function mapApiNotificationToFrontend(api: ApiNotification): Notification {
  return {
    id: api.id,
    recipient: api.recipient,
    type: api.type,
    channel: api.channel,
    title: api.title,
    message: api.message,
    scheduledAt: api.scheduledAt ? new Date(api.scheduledAt) : undefined,
    relatedEntityType: api.relatedEntityType,
    relatedEntity: api.relatedEntity,
    status: api.status,
    sentAt: api.sentAt ? new Date(api.sentAt) : undefined,
    readAt: api.readAt ? new Date(api.readAt) : undefined,
    consentValidated: api.consentValidated,
    createdAt: new Date(api.createdAt),
    updatedAt: new Date(api.updatedAt),
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * List notifications with optional filters
 */
export async function listNotifications(params?: ListNotificationsParams): Promise<NotificationsList> {
  const response = await apiGet<PaginatedResponse<ApiNotification>>(
    '/notifs',
    params as Record<string, any>
  )
  return mapPaginatedResponse(response, mapApiNotificationToFrontend)
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<Notification> {
  const apiNotification = await apiPost<ApiNotification>(`/notifs/${notificationId}/read`, {})
  return mapApiNotificationToFrontend(apiNotification)
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<{ markedCount: number }> {
  const response = await apiPost<{ markedCount: number }>('/notifs/read-all', {})
  return response
}