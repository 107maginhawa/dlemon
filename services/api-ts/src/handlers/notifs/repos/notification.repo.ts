/**
 * NotificationRepository - Data access and business logic for notifications
 * Handles all notification operations including creation, delivery, and status management
 */

import { eq, and, or, gte, lte, inArray, isNull, desc, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions, type PaginatedResult } from '@/core/database.repo';
import {
  notifications,
  type Notification,
  type NewNotification,
  type NotificationFilters,
  type CreateNotificationRequest
} from './notification.schema';
import type { Logger } from '@/types/logger';
import { findNotificationRecipient } from '../../person/repos/person-notifs.facade';
import { ValidationError, NotFoundError, ForbiddenError } from '@/core/errors';
import * as OneSignal from '@onesignal/node-onesignal';
import { SYSTEM_USER_ID } from '@/core/constants';
import { subDays } from 'date-fns';
import type { EmailService } from '@/core/email';

export class NotificationRepository extends DatabaseRepository<Notification, NewNotification, NotificationFilters> {
  private oneSignalClient?: OneSignal.DefaultApi;
  private oneSignalAppId?: string;
  private emailService?: EmailService;

  constructor(
    db: DatabaseInstance,
    logger?: Logger,
    oneSignalConfig?: { appId: string; apiKey: string },
    emailService?: EmailService
  ) {
    super(db, notifications, logger);
    this.emailService = emailService;

    // Initialize OneSignal if config provided
    if (oneSignalConfig) {
      const configuration = OneSignal.createConfiguration({
        restApiKey: oneSignalConfig.apiKey
      });
      this.oneSignalClient = new OneSignal.DefaultApi(configuration);
      this.oneSignalAppId = oneSignalConfig.appId;
    }
  }

  /**
   * Build where conditions for notification-specific filtering
   */
  protected buildWhereConditions(filters?: NotificationFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.recipient) {
      conditions.push(eq(notifications.recipient, filters.recipient));
    }

    if (filters.type) {
      conditions.push(eq(notifications.type, filters.type as Notification['type']));
    }

    // Auto-filter to in-app notifications if no channel specified
    if (!filters.channel) {
      conditions.push(eq(notifications.channel, 'in-app'));
    } else {
      conditions.push(eq(notifications.channel, filters.channel as Notification['channel']));
    }

    // Handle special 'unread' status value
    if (filters.status === 'unread') {
      // 'unread' maps to sent or delivered (not yet read)
      conditions.push(
        inArray(notifications.status, ['sent', 'delivered'])
      );
    } else if (filters.status) {
      conditions.push(eq(notifications.status, filters.status as Notification['status']));
    }
    
    if (filters.startDate) {
      conditions.push(gte(notifications.createdAt, filters.startDate));
    }
    
    if (filters.endDate) {
      conditions.push(lte(notifications.createdAt, filters.endDate));
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Create a notification for module integration
   * This is the primary method other modules will use to create notifications
   */
  async createNotificationForModule(request: CreateNotificationRequest): Promise<Notification> {
    this.logger?.debug({ request }, 'Creating notification from module');

    // Validate recipient exists (optional - Person records may not exist for all User IDs)
    const recipient = await findNotificationRecipient(this.db, request.recipient, this.logger);

    if (!recipient) {
      // Log warning but allow notification creation
      // In production, Person records should be created via Better-Auth hooks
      this.logger?.warn({
        recipient: request.recipient,
        type: request.type
      }, 'Creating notification for recipient without Person record');
    }

    // Validate consent for medical notifications
    if (this.isMedicalNotification(request.type) && !request.consentValidated) {
      // In a real implementation, we would check Person consent fields here
      // For now, we'll log a warning
      this.logger?.warn({
        type: request.type,
        recipient: request.recipient
      }, 'Medical notification created without explicit consent validation');
    }

    // Determine final status and sentAt based on scheduling and channel
    // This allows us to create the notification with its final state in a single operation
    const isImmediate = !request.scheduledAt || request.scheduledAt <= new Date();
    const isInApp = request.channel === 'in-app';

    // For immediate in-app notifications, create with 'sent' status directly
    // For scheduled or non-in-app notifications, create with 'queued' status
    const finalStatus = (isImmediate && isInApp) ? 'sent' : 'queued';
    const sentAt = (isImmediate && isInApp) ? new Date() : null;

    // Create notification record with final status in single operation
    const notification = await this.createOne({
      recipient: request.recipient,
      type: request.type as Notification['type'],
      channel: request.channel as Notification['channel'],
      title: request.title,
      message: request.message,
      scheduledAt: request.scheduledAt || null,
      relatedEntityType: request.relatedEntityType || null,
      relatedEntity: request.relatedEntity || null,
      status: finalStatus,
      sentAt: sentAt,
      consentValidated: request.consentValidated || false,
      createdBy: SYSTEM_USER_ID, // Module-created notifications are system-generated
      updatedBy: SYSTEM_USER_ID,
    });

    this.logger?.info({
      notificationId: notification.id,
      type: notification.type,
      channel: notification.channel,
      status: notification.status,
      scheduled: !!notification.scheduledAt
    }, 'Notification created successfully');

    return notification;
  }

  /**
   * P1-24: idempotently enqueue a scheduled notification keyed on
   * (relatedEntity, type, channel, scheduledAt). If a row with that exact key
   * already exists (any status), nothing is written and the existing row is
   * returned — this is the duplicate-send guard for the reminder/recall jobs.
   * Returns { created: boolean, notification }.
   */
  async enqueueScheduledIfAbsent(request: CreateNotificationRequest): Promise<{ created: boolean; notification: Notification }> {
    const scheduledAt = request.scheduledAt ?? null;
    const existingConds = [
      eq(notifications.type, request.type as Notification['type']),
      eq(notifications.channel, request.channel as Notification['channel']),
    ];
    if (request.relatedEntity) existingConds.push(eq(notifications.relatedEntity, request.relatedEntity));
    else existingConds.push(isNull(notifications.relatedEntity));
    if (scheduledAt) existingConds.push(eq(notifications.scheduledAt, scheduledAt));
    else existingConds.push(isNull(notifications.scheduledAt));

    const [existing] = await this.db
      .select()
      .from(notifications)
      .where(and(...existingConds))
      .limit(1);

    if (existing) {
      return { created: false, notification: existing };
    }

    const notification = await this.createNotificationForModule(request);
    return { created: true, notification };
  }

  /**
   * P1-24: synchronously expire queued reminder/confirmation-request rows for an
   * appointment (or any related entity). Called inside cancel/reschedule/check-in/
   * confirm handlers so a reminder can never fire after the appointment moved on.
   * Only touches `queued` rows (delivered/read are left intact for history).
   * Returns the number of rows expired.
   */
  async expireQueuedByEntity(
    relatedEntity: string,
    types: readonly string[],
  ): Promise<number> {
    const result = await this.db
      .update(notifications)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(
        eq(notifications.relatedEntity, relatedEntity),
        eq(notifications.status, 'queued'),
        inArray(notifications.type, types as readonly Notification['type'][]),
      ));
    return result.rowCount ?? 0;
  }

  /**
   * Find notifications for a specific recipient with pagination
   */
  async findManyByRecipient(
    recipientId: string,
    filters?: Omit<NotificationFilters, 'recipient'>,
    options?: { pagination?: PaginationOptions }
  ): Promise<PaginatedResult<Notification>> {
    this.logger?.debug({ recipientId, filters, options }, 'Finding notifications for recipient');
    
    // Merge recipient filter with other filters
    const mergedFilters = {
      ...filters,
      recipient: recipientId
    };
    
    return this.findManyWithPagination(mergedFilters, options);
  }

  /**
   * Find a single notification by ID with ownership check
   */
  async findOneByIdAndRecipient(notificationId: string, recipientId: string): Promise<Notification | null> {
    this.logger?.debug({ notificationId, recipientId }, 'Finding notification with ownership check');

    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipient, recipientId)
        )
      )
      .limit(1);

    return notification || null;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, recipientId: string): Promise<Notification> {
    this.logger?.debug({ notificationId, recipientId }, 'Marking notification as read');

    // Verify ownership
    const notification = await this.findOneByIdAndRecipient(notificationId, recipientId);

    if (!notification) {
      throw new NotFoundError('Notification not found', {
        resourceType: 'notification',
        resource: notificationId,
        suggestions: ['Check notification ID format', 'Verify notification exists']
      });
    }

    // Idempotent: only update if not already read
    if (notification.status === 'read') {
      this.logger?.debug({ notificationId }, 'Notification already marked as read');
      return notification;
    }

    // Update read status
    const updated = await this.updateOneById(notificationId, {
      status: 'read',
      readAt: new Date(),
      updatedBy: recipientId
    });

    this.logger?.info({ notificationId }, 'Notification marked as read');

    return updated;
  }

  /**
   * Mark all notifications as read for a recipient
   */
  async markAllAsRead(recipientId: string, type?: string): Promise<number> {
    this.logger?.debug({ recipientId, type }, 'Marking all notifications as read');

    const conditions = [
      eq(notifications.recipient, recipientId),
      // Only mark sent/delivered notifications (exclude queued/scheduled ones)
      inArray(notifications.status, ['sent', 'delivered'])
    ];

    if (type) {
      conditions.push(eq(notifications.type, type as Notification['type']));
    }
    
    const result = await this.db
      .update(notifications)
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date(),
        updatedBy: recipientId
      })
      .where(and(...conditions));
    
    const count = result.rowCount || 0;
    
    this.logger?.info({ recipientId, type, count }, 'Notifications marked as read');
    
    return count;
  }

  /**
   * Get count of unread notifications for a recipient
   */
  async getUnreadCount(recipientId: string): Promise<number> {
    this.logger?.debug({ recipientId }, 'Getting unread notification count');
    
    const result = await this.db
      .select({ count: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipient, recipientId),
          inArray(notifications.status, ['sent', 'delivered'])
        )
      );
    
    return result.length;
  }

  /**
   * Process scheduled notifications (called by background job)
   */
  async processScheduledNotifications(): Promise<void> {
    this.logger?.debug('Processing scheduled notifications');
    
    const now = new Date();
    
    // Find due notifications
    const dueNotifications = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.status, 'queued'),
          lte(notifications.scheduledAt, now)
        )
      )
      .limit(100); // Process in batches
    
    this.logger?.info({ count: dueNotifications.length }, 'Found due notifications');
    
    // Process each notification
    for (const notification of dueNotifications) {
      try {
        await this.deliverNotification(notification);
      } catch (error) {
        this.logger?.error({ 
          error, 
          notificationId: notification.id 
        }, 'Failed to deliver notification');
        
        // Update status to failed
        await this.updateOneById(notification.id, {
          status: 'failed',
          updatedAt: new Date()
        });
      }
    }
  }

  /**
   * Deliver a notification based on its channel
   */
  private async deliverNotification(notification: Notification): Promise<void> {
    this.logger?.debug({ 
      notificationId: notification.id,
      channel: notification.channel 
    }, 'Delivering notification');
    
    // Update status to sent
    await this.updateOneById(notification.id, {
      status: 'sent',
      sentAt: new Date(),
      updatedAt: new Date()
    });
    
    switch (notification.channel) {
      case 'email': {
        // Use email service to queue the email
        if (this.emailService) {
          // Map notification type to email template tag
          const templateTag = this.mapNotificationToEmailTemplate(notification.type);

          if (templateTag) {
            // Get recipient email via the person facade
            const person = await findNotificationRecipient(this.db, notification.recipient, this.logger);
            const recipientEmail = person?.contactInfo?.email;

            if (person && recipientEmail) {
              await this.emailService.queueEmail({
                templateTags: [templateTag],
                recipient: recipientEmail,
                variables: {
                  title: notification.title,
                  message: notification.message,
                  // Additional context could be added based on notification type
                },
                metadata: {
                  notificationId: notification.id,
                  relatedEntity: notification.relatedEntity
                }
              });
              
              this.logger?.info({ notificationId: notification.id }, 'Email queued for delivery');
            } else {
              this.logger?.warn({ notificationId: notification.id }, 'No email address found for recipient');
            }
          }
        } else {
          this.logger?.warn({ notificationId: notification.id }, 'Email service not available');
        }
        
        // Mark as delivered (email is queued separately)
        await this.updateOneById(notification.id, { status: 'delivered' });
        break;
      }

      case 'push':
        // Send push notification via OneSignal
        if (this.oneSignalClient && this.oneSignalAppId) {
          try {
            // Create OneSignal notification
            const oneSignalNotification = new OneSignal.Notification();
            oneSignalNotification.app_id = this.oneSignalAppId;

            // Set content
            oneSignalNotification.headings = { en: notification.title };
            oneSignalNotification.contents = { en: notification.message };

            // Set targeting - use external_id for user targeting
            oneSignalNotification.include_aliases = {
              external_id: [notification.recipient]
            };

            // Optional: Filter by app tag if targetApp is specified
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `data` is not a schema column; targetApp is stored as an in-memory hint only
            const targetApp = (notification as any).data?.targetApp;
            if (targetApp) {
              oneSignalNotification.filters = [
                { field: 'tag', key: 'app', relation: '=', value: targetApp }
              ];
              this.logger?.debug({
                notificationId: notification.id,
                targetApp
              }, 'Filtering push notification by app tag');
            }

            // Set data payload
            oneSignalNotification.data = {
              notificationId: notification.id,
              type: notification.type,
              relatedEntity: notification.relatedEntity || ''
            };

            // Set priority based on notification type
            if (this.isMedicalNotification(notification.type)) {
              oneSignalNotification.priority = 10; // High priority
            }

            // Send the notification
            const result = await this.oneSignalClient.createNotification(oneSignalNotification);

            if (result && result.id) {
              this.logger?.info({
                notificationId: notification.id,
                oneSignalId: result.id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OneSignal SDK omits `recipients` from its response type
                recipients: (result as any).recipients
              }, 'Push notification sent via OneSignal');

              await this.updateOneById(notification.id, {
                status: 'delivered',
                sentAt: new Date(),
                deliveredAt: new Date(),
                metadata: {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `metadata` is not a schema column; accessing persisted JSONB workaround
                  ...(notification as any).metadata,
                  oneSignalId: result.id
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see suppress above; cast closes the same oversize update object
              } as any);
            } else {
              this.logger?.warn({
                notificationId: notification.id,
                result
              }, 'OneSignal notification created but no ID returned');

              await this.updateOneById(notification.id, { status: 'failed' });
            }
          } catch (error) {
            this.logger?.error({
              error,
              notificationId: notification.id
            }, 'Failed to send push notification via OneSignal');

            await this.updateOneById(notification.id, { status: 'failed' });
          }
        } else {
          // No OneSignal configured
          throw new Error('OneSignal not configured, marking notification as failed');
        }
        break;
        
      case 'sms':
        // P1-24: SMS channel enum lands now; the actual provider (Twilio/Vonage/
        // OneSignal-SMS) is deferred to P4. Until then an `sms` row is a logged
        // no-op marked `failed` ("no SMS provider configured") — mirrors the
        // OneSignal-not-configured path. Consent/cadence logic is unaffected.
        this.logger?.warn({ notificationId: notification.id }, 'No SMS provider configured — SMS notification not delivered (P4)');
        await this.updateOneById(notification.id, { status: 'failed' });
        break;

      case 'in-app':
        // In-app notifications are already available in database
        // Just update status to indicate they're ready
        await this.updateOneById(notification.id, { status: 'delivered' });
        this.logger?.info({ notificationId: notification.id }, 'In-app notification delivered');
        break;
        
      default:
        this.logger?.error({ 
          notificationId: notification.id,
          channel: notification.channel 
        }, 'Unknown notification channel');
        throw new Error(`Unknown notification channel: ${notification.channel}`);
    }
  }

  /**
   * Check if a notification type requires medical consent
   */
  private isMedicalNotification(type: string): boolean {
    return false; // No medical notifications in current system
  }
  
  /**
   * Map notification type to email template tag
   */
  private mapNotificationToEmailTemplate(type: string): string | null {
    const mapping: Record<string, string> = {
      'security': 'auth.password-reset',
      'system': 'auth.welcome',
      // P1-24: appointment reminder + recall (continuing-care) templates
      'appointment.reminder': 'appointment.reminder',
      'appointment.confirmation-request': 'appointment.confirmation-request',
      'recall.due': 'recall.due',
      'recall.reminder': 'recall.reminder',
    };
    
    return mapping[type] || null;
  }

  /**
   * Clean up expired notifications (maintenance task)
   */
  async cleanupExpiredNotifications(daysOld: number = 90): Promise<number> {
    this.logger?.debug({ daysOld }, 'Cleaning up expired notifications');

    const cutoffDate = subDays(new Date(), daysOld);
    
    const result = await this.db
      .delete(notifications)
      .where(
        lte(notifications.createdAt, cutoffDate)
      );
    
    const count = result.rowCount || 0;
    
    this.logger?.info({ count, daysOld }, 'Expired notifications cleaned up');
    
    return count;
  }
}
