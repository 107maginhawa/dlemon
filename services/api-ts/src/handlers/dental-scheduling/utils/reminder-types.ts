/**
 * reminder-types.ts (P1-24)
 *
 * The notification types this module enqueues for an appointment. Centralized so
 * the armer (write), canceller (expire), and tests share one source of truth.
 */

export const REMINDER_NOTIFICATION_TYPES = [
  'appointment.reminder',
  'appointment.confirmation-request',
] as const;

export type ReminderNotificationType = (typeof REMINDER_NOTIFICATION_TYPES)[number];
