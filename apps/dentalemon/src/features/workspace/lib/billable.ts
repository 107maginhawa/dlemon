/**
 * Billable treatments — the SINGLE source of truth for "what can be invoiced now".
 *
 * Server contract BR-009: createDentalInvoice bills ONLY treatments whose status is
 * `performed` or `verified`. Planned/diagnosed work is an ESTIMATE (a plan), not a
 * bill; anything else (declined, voided) is neither. This mirrors the server exactly
 * (services/api-ts/src/handlers/dental-billing/createDentalInvoice.ts:79) so the
 * footer summary, the payment modal, and the server can never disagree about what a
 * clinician will be charged — the "summary-vs-body coherence" bug class that put an
 * enabled "Create Invoice & Pay" on an all-planned visit and 422'd on click.
 *
 * Consume `splitBillable` instead of re-writing `status === 'performed' || ...` inline.
 */

/** The shape this module needs — any treatment-like value with a status. */
export interface HasStatus {
  status?: string | null;
}

const BILLABLE_STATUSES = new Set(['performed', 'verified']);
const ESTIMATE_STATUSES = new Set(['diagnosed', 'planned']);

/** True for a status the server will put on an invoice (performed | verified). */
export function isBillableStatus(status: string | null | undefined): boolean {
  return BILLABLE_STATUSES.has(status ?? '');
}

/** True for a planned/diagnosed status — shown as a non-payable estimate. */
export function isEstimateStatus(status: string | null | undefined): boolean {
  return ESTIMATE_STATUSES.has(status ?? '');
}

/** True when this treatment can be invoiced now. */
export function isBillable<T extends HasStatus>(t: T): boolean {
  return isBillableStatus(t.status);
}

/**
 * Partition treatments into the payable `billable` set (performed|verified) and the
 * non-payable `estimate` set (diagnosed|planned). Anything else (declined/voided) is
 * excluded from BOTH — it is neither billed now nor part of the estimate the patient
 * is quoted.
 */
export function splitBillable<T extends HasStatus>(treatments: T[]): {
  billable: T[];
  estimate: T[];
} {
  const billable: T[] = [];
  const estimate: T[] = [];
  for (const t of treatments) {
    if (isBillableStatus(t.status)) billable.push(t);
    else if (isEstimateStatus(t.status)) estimate.push(t);
  }
  return { billable, estimate };
}
