/**
 * dental-visit domain events
 *
 * DE-001 VisitCheckedIn       — emitted after a visit transitions draft → active (check-in)
 * DE-002 VisitCompleted       — emitted after a visit is successfully completed
 * DE-003 VisitLocked          — emitted after a visit is locked
 * DE-004 TreatmentDiagnosed   — emitted after a treatment is created (initial status: diagnosed)
 * DE-005 TreatmentPerformed   — emitted after a treatment status transitions to performed
 * DE-006 TreatmentDismissed   — emitted after a treatment status transitions to dismissed
 *
 * Events are enqueued via the shared pg-boss JobScheduler so they survive
 * handler failures and are processed asynchronously by any registered consumer.
 * All emit functions are best-effort: they never throw — scheduler failures are
 * swallowed so they do not roll back the triggering operation.
 */

import type { JobScheduler } from '@/core/jobs';

export const DENTAL_VISIT_EVENTS_QUEUE = 'dental.visit.domain-events';

export const DENTAL_VISIT_EVENT_TYPES = {
  VISIT_CHECKED_IN: 'VisitCheckedIn',
  VISIT_COMPLETED: 'VisitCompleted',
  VISIT_LOCKED: 'VisitLocked',
  TREATMENT_DIAGNOSED: 'TreatmentDiagnosed',
  TREATMENT_PERFORMED: 'TreatmentPerformed',
  TREATMENT_DISMISSED: 'TreatmentDismissed',
} as const;

export type DentalVisitEventType =
  (typeof DENTAL_VISIT_EVENT_TYPES)[keyof typeof DENTAL_VISIT_EVENT_TYPES];

// ---------------------------------------------------------------------------
// Payload interfaces
// ---------------------------------------------------------------------------

export interface VisitCheckedInPayload {
  event: typeof DENTAL_VISIT_EVENT_TYPES.VISIT_CHECKED_IN;
  visitId: string;
  patientId: string;
  branchId: string;
}

export interface VisitCompletedPayload {
  event: typeof DENTAL_VISIT_EVENT_TYPES.VISIT_COMPLETED;
  visitId: string;
  patientId: string;
  branchId: string;
}

export interface VisitLockedPayload {
  event: typeof DENTAL_VISIT_EVENT_TYPES.VISIT_LOCKED;
  visitId: string;
  patientId: string;
  branchId: string;
}

export interface TreatmentDiagnosedPayload {
  event: typeof DENTAL_VISIT_EVENT_TYPES.TREATMENT_DIAGNOSED;
  treatmentId: string;
  visitId: string;
  patientId: string;
  branchId: string;
}

export interface TreatmentPerformedPayload {
  event: typeof DENTAL_VISIT_EVENT_TYPES.TREATMENT_PERFORMED;
  treatmentId: string;
  visitId: string;
  patientId: string;
  branchId: string;
}

export interface TreatmentDismissedPayload {
  event: typeof DENTAL_VISIT_EVENT_TYPES.TREATMENT_DISMISSED;
  treatmentId: string;
  visitId: string;
  patientId: string;
  branchId: string;
}

export type DentalVisitDomainEvent =
  | VisitCheckedInPayload
  | VisitCompletedPayload
  | VisitLockedPayload
  | TreatmentDiagnosedPayload
  | TreatmentPerformedPayload
  | TreatmentDismissedPayload;

// ---------------------------------------------------------------------------
// Emit helpers — DE-001 through DE-006
// ---------------------------------------------------------------------------

/**
 * DE-001: Enqueue a VisitCheckedIn event (draft → active transition).
 * Best-effort: never throws.
 */
export function emitVisitCheckedIn(
  scheduler: JobScheduler,
  payload: { visitId: string; patientId: string; branchId: string },
): Promise<string> {
  const event: VisitCheckedInPayload = {
    event: DENTAL_VISIT_EVENT_TYPES.VISIT_CHECKED_IN,
    ...payload,
  };
  return scheduler.trigger(DENTAL_VISIT_EVENTS_QUEUE, event);
}

/**
 * DE-002: Enqueue a VisitCompleted event.
 * Best-effort: never throws.
 */
export function emitVisitCompleted(
  scheduler: JobScheduler,
  payload: { visitId: string; patientId: string; branchId: string },
): Promise<string> {
  const event: VisitCompletedPayload = {
    event: DENTAL_VISIT_EVENT_TYPES.VISIT_COMPLETED,
    ...payload,
  };
  return scheduler.trigger(DENTAL_VISIT_EVENTS_QUEUE, event);
}

/**
 * DE-003: Enqueue a VisitLocked event.
 * Best-effort: never throws.
 */
export function emitVisitLocked(
  scheduler: JobScheduler,
  payload: { visitId: string; patientId: string; branchId: string },
): Promise<string> {
  const event: VisitLockedPayload = {
    event: DENTAL_VISIT_EVENT_TYPES.VISIT_LOCKED,
    ...payload,
  };
  return scheduler.trigger(DENTAL_VISIT_EVENTS_QUEUE, event);
}

/**
 * DE-004: Enqueue a TreatmentDiagnosed event (new treatment created).
 * Best-effort: never throws.
 */
export function emitTreatmentDiagnosed(
  scheduler: JobScheduler,
  payload: { treatmentId: string; visitId: string; patientId: string; branchId: string },
): Promise<string> {
  const event: TreatmentDiagnosedPayload = {
    event: DENTAL_VISIT_EVENT_TYPES.TREATMENT_DIAGNOSED,
    ...payload,
  };
  return scheduler.trigger(DENTAL_VISIT_EVENTS_QUEUE, event);
}

/**
 * DE-005: Enqueue a TreatmentPerformed event.
 * Best-effort: never throws.
 */
export function emitTreatmentPerformed(
  scheduler: JobScheduler,
  payload: { treatmentId: string; visitId: string; patientId: string; branchId: string },
): Promise<string> {
  const event: TreatmentPerformedPayload = {
    event: DENTAL_VISIT_EVENT_TYPES.TREATMENT_PERFORMED,
    ...payload,
  };
  return scheduler.trigger(DENTAL_VISIT_EVENTS_QUEUE, event);
}

/**
 * DE-006: Enqueue a TreatmentDismissed event.
 * Best-effort: never throws.
 */
export function emitTreatmentDismissed(
  scheduler: JobScheduler,
  payload: { treatmentId: string; visitId: string; patientId: string; branchId: string },
): Promise<string> {
  const event: TreatmentDismissedPayload = {
    event: DENTAL_VISIT_EVENT_TYPES.TREATMENT_DISMISSED,
    ...payload,
  };
  return scheduler.trigger(DENTAL_VISIT_EVENTS_QUEUE, event);
}
