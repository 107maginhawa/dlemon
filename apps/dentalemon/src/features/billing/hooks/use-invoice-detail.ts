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
// instead of re-declaring an independent interface + `as unknown as` cast. tsc
// now checks every SDK-modeled field (cents/status/invoiceNumber drift) against
// the real backend type; the enrichments below are explicit because they are NOT
// in the OpenAPI spec/SDK (the response also carries `outstandingCents` —
// V-BIL-012 — aliasing `balanceCents`).
// TODO(spec): add outstandingCents/patientName/visitDate/lineItems/payments to
// the invoice-detail response schema, regenerate the SDK, then drop this intersection.
export type InvoiceDetail = DentalInvoice & {
  outstandingCents?: number;
  patientName?: string;
  visitDate?: string;
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
