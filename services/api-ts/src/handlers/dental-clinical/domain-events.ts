/**
 * dental-clinical domain events
 *
 * DE-013 ConsentRevoked — emitted after a consent form is successfully revoked
 *
 * Events are enqueued via the shared pg-boss JobScheduler so they survive
 * handler failures and are processed asynchronously by any registered consumer.
 */

import type { JobScheduler } from '@/core/jobs';

export const DENTAL_CLINICAL_EVENTS_QUEUE = 'dental.clinical.domain-events';

export const DENTAL_CLINICAL_EVENT_TYPES = {
  CONSENT_REVOKED: 'ConsentRevoked',
} as const;

export type DentalClinicalEventType =
  (typeof DENTAL_CLINICAL_EVENT_TYPES)[keyof typeof DENTAL_CLINICAL_EVENT_TYPES];

export interface ConsentRevokedPayload {
  event: typeof DENTAL_CLINICAL_EVENT_TYPES.CONSENT_REVOKED;
  consentId: string;
  visitId: string;
  patientId: string;
  revokedBy: string;
}

export type DentalClinicalDomainEvent = ConsentRevokedPayload;

/**
 * Enqueue a DE-013 ConsentRevoked event.
 * Best-effort: never throws — failure is logged via the scheduler but does not
 * roll back the revocation.
 */
export function emitConsentRevoked(
  scheduler: JobScheduler,
  payload: { consentId: string; visitId: string; patientId: string; revokedBy: string },
): Promise<string> {
  const event: ConsentRevokedPayload = {
    event: DENTAL_CLINICAL_EVENT_TYPES.CONSENT_REVOKED,
    ...payload,
  };
  return scheduler.trigger(DENTAL_CLINICAL_EVENTS_QUEUE, event);
}
