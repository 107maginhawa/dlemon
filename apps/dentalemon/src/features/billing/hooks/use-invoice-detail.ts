/**
 * useInvoiceDetail — TanStack Query hook for a single dental invoice
 *
 * RPT-01: enables report row drilldown to invoice detail
 * RPT-02: returns lineItems and payments for the detail sheet
 *
 * API: GET /dental/billing/invoices/:invoiceId
 */
import { useQuery } from '@tanstack/react-query';
import { getDentalInvoiceOptions } from '@monobase/sdk-ts/generated/react-query';
import { type DentalInvoice } from '@monobase/sdk-ts/generated';

// Line items + payments are returned by the detail endpoint as ENRICHMENTS the
// generated SDK does not model (GetDentalInvoiceResponses[200] is the bare
// `DentalInvoice`). Their shapes are ground-truthed against the LIVE response
// (GET /dental/billing/invoices/:invoiceId, 2026-06-04 — see oli QA_ESCAPES §6).
// IMPORTANT: enrichments are NOT run through the SDK's date transformer (which
// only knows the modeled fields), so their timestamp fields arrive as ISO
// strings, not `Date` — they must stay `string` here. Likewise `method` is kept
// `string` because the dental payment-method union (gcash/maya/insurance/other)
// is wider than the generated `PaymentMethod` ('cash'|'card'|'bank_transfer').
export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  treatmentId?: string | null;
  cdtCode?: string | null;
  description: string;
  quantity?: number;
  priceCents: number; // backend maps amountCents → priceCents (getDentalInvoice.ts)
  amountCents: number;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amountCents: number;
  method: string;
  createdAt: string;
}

// Cause-fix recipe (QA_ESCAPES §6): intersect the generated SDK `DentalInvoice`
// instead of re-declaring an independent interface + `as unknown as` cast. tsc now
// checks every SDK-modeled field against the real backend type. `patientName` and
// `visitDate` are now on the base `DentalInvoice` (modeled 2026-06-13), so they are
// dropped from this intersection; the enrichments below are still NOT in the spec.
// TODO(spec): add `outstandingCents` (V-BIL-012, aliases `balanceCents`) + `lineItems`
// + `payments` to the invoice-detail response, regen, then drop this intersection.
// Deferred because modeling the payment/lineItem timestamps would pull them under the
// SDK date transformer (a `string`→`Date` shift) and the dental `method` union is
// wider than the generated `PaymentMethod`.
export type InvoiceDetail = DentalInvoice & {
  outstandingCents?: number;
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
};

export function useInvoiceDetail(invoiceId: string | null) {
  const query = useQuery({
    ...getDentalInvoiceOptions({ path: { invoiceId: invoiceId! } }),
    enabled: Boolean(invoiceId),
    staleTime: 30_000,
  });

  return {
    // Single narrowing assertion (no `as unknown as`): query.data is the SDK
    // `DentalInvoice`; we widen to the live enrichment shape declared above.
    invoice: (query.data as InvoiceDetail | undefined) ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
