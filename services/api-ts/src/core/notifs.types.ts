/**
 * Shared notification types used by core/notifs.ts
 * Extracted from handlers/notifs/repos/notification.schema.ts to avoid core→handler dependency
 */

export interface Notification {
  id: string;
  recipient: string;
  type: 'billing' | 'security' | 'system' | 'booking.created' | 'booking.confirmed' | 'booking.rejected' | 'booking.cancelled' | 'booking.no-show-client' | 'booking.no-show-host' | 'comms.video-call-started' | 'comms.video-call-joined' | 'comms.video-call-left' | 'comms.video-call-ended' | 'comms.chat-message';
  channel: 'email' | 'push' | 'in-app';
  title: string;
  message: string;
  scheduledAt: Date | null;
  relatedEntityType: string | null;
  relatedEntity: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'expired';
  sentAt: Date | null;
  readAt: Date | null;
  consentValidated: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  version: number;
}

export interface CreateNotificationRequest {
  recipient: string;
  type: 'billing' | 'security' | 'system' | 'booking.created' | 'booking.confirmed' | 'booking.rejected' | 'booking.cancelled' | 'booking.no-show-client' | 'booking.no-show-host' | 'comms.video-call-started' | 'comms.video-call-joined' | 'comms.video-call-left' | 'comms.video-call-ended' | 'comms.chat-message';
  channel: 'email' | 'push' | 'in-app';
  title: string;
  message: string;
  scheduledAt?: Date;
  relatedEntityType?: string;
  relatedEntity?: string;
  consentValidated?: boolean;
  targetApp?: string; // Optional: Filter push notifications by app tag (e.g., 'web', 'mobile')
}
