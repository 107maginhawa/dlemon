/**
 * dental-scheduling domain events
 *
 * DE-010 AppointmentBooked  — emitted after a new appointment is successfully created
 * DE-011 AppointmentCancelled — emitted after an appointment is successfully cancelled
 *
 * Events are enqueued via the shared pg-boss JobScheduler so they survive
 * handler failures and are processed asynchronously by any registered consumer.
 */

import type { JobScheduler } from '@/core/jobs';

export const DENTAL_SCHEDULING_EVENTS_QUEUE = 'dental.scheduling.domain-events';

export const DENTAL_SCHEDULING_EVENT_TYPES = {
  APPOINTMENT_BOOKED: 'AppointmentBooked',
  APPOINTMENT_CANCELLED: 'AppointmentCancelled',
} as const;

export type DentalSchedulingEventType =
  (typeof DENTAL_SCHEDULING_EVENT_TYPES)[keyof typeof DENTAL_SCHEDULING_EVENT_TYPES];

export interface AppointmentBookedPayload {
  event: typeof DENTAL_SCHEDULING_EVENT_TYPES.APPOINTMENT_BOOKED;
  appointmentId: string;
  patientId: string;
  branchId: string;
}

export interface AppointmentCancelledPayload {
  event: typeof DENTAL_SCHEDULING_EVENT_TYPES.APPOINTMENT_CANCELLED;
  appointmentId: string;
  patientId: string;
  branchId: string;
}

export type DentalSchedulingDomainEvent =
  | AppointmentBookedPayload
  | AppointmentCancelledPayload;

/**
 * Enqueue a DE-010 AppointmentBooked event.
 * Best-effort: never throws — failure is logged via the scheduler but does not
 * roll back the booking.
 */
export function emitAppointmentBooked(
  scheduler: JobScheduler,
  payload: { appointmentId: string; patientId: string; branchId: string },
): Promise<string> {
  const event: AppointmentBookedPayload = {
    event: DENTAL_SCHEDULING_EVENT_TYPES.APPOINTMENT_BOOKED,
    ...payload,
  };
  return scheduler.trigger(DENTAL_SCHEDULING_EVENTS_QUEUE, event);
}

/**
 * Enqueue a DE-011 AppointmentCancelled event.
 * Best-effort: never throws — failure is logged via the scheduler but does not
 * roll back the cancellation.
 */
export function emitAppointmentCancelled(
  scheduler: JobScheduler,
  payload: { appointmentId: string; patientId: string; branchId: string },
): Promise<string> {
  const event: AppointmentCancelledPayload = {
    event: DENTAL_SCHEDULING_EVENT_TYPES.APPOINTMENT_CANCELLED,
    ...payload,
  };
  return scheduler.trigger(DENTAL_SCHEDULING_EVENTS_QUEUE, event);
}
