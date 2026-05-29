/**
 * dental-billing domain events
 *
 * DE-020 InvoiceCreated — emitted after a new invoice is successfully created
 * DE-021 InvoicePaid    — emitted after a payment fully settles an invoice
 *
 * Events are enqueued via the shared pg-boss JobScheduler so they survive
 * handler failures and are processed asynchronously by any registered consumer.
 */

import type { JobScheduler } from '@/core/jobs';

export const DENTAL_BILLING_EVENTS_QUEUE = 'dental.billing.domain-events';

export const DENTAL_BILLING_EVENT_TYPES = {
  INVOICE_CREATED: 'InvoiceCreated',
  INVOICE_PAID: 'InvoicePaid',
} as const;

export type DentalBillingEventType =
  (typeof DENTAL_BILLING_EVENT_TYPES)[keyof typeof DENTAL_BILLING_EVENT_TYPES];

export interface InvoiceCreatedPayload {
  event: typeof DENTAL_BILLING_EVENT_TYPES.INVOICE_CREATED;
  invoiceId: string;
  patientId: string;
  branchId: string;
  totalCents: number;
}

export interface InvoicePaidPayload {
  event: typeof DENTAL_BILLING_EVENT_TYPES.INVOICE_PAID;
  invoiceId: string;
  patientId: string;
  branchId: string;
  amountCents: number;
}

export type DentalBillingDomainEvent =
  | InvoiceCreatedPayload
  | InvoicePaidPayload;

/**
 * Enqueue a DE-020 InvoiceCreated event.
 * Best-effort: never throws — failure is logged via the scheduler but does not
 * roll back the invoice creation.
 */
export function emitInvoiceCreated(
  scheduler: JobScheduler,
  payload: { invoiceId: string; patientId: string; branchId: string; totalCents: number },
): Promise<string> {
  const event: InvoiceCreatedPayload = {
    event: DENTAL_BILLING_EVENT_TYPES.INVOICE_CREATED,
    ...payload,
  };
  return scheduler.trigger(DENTAL_BILLING_EVENTS_QUEUE, event);
}

/**
 * Enqueue a DE-021 InvoicePaid event.
 * Best-effort: never throws — failure is logged via the scheduler but does not
 * roll back the payment.
 */
export function emitInvoicePaid(
  scheduler: JobScheduler,
  payload: { invoiceId: string; patientId: string; branchId: string; amountCents: number },
): Promise<string> {
  const event: InvoicePaidPayload = {
    event: DENTAL_BILLING_EVENT_TYPES.INVOICE_PAID,
    ...payload,
  };
  return scheduler.trigger(DENTAL_BILLING_EVENTS_QUEUE, event);
}
