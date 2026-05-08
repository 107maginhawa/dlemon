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

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  treatmentId?: string | null;
  cdtCode?: string | null;
  description: string;
  quantity?: number;
  priceCents: number;
  amountCents: number;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amountCents: number;
  method: string;
  createdAt: string;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName?: string;
  visitId: string;
  visitDate?: string;
  status: string;
  subtotalCents: number;
  discountCents?: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  createdAt: string;
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
}

export function useInvoiceDetail(invoiceId: string | null) {
  const query = useQuery({
    ...getDentalInvoiceOptions({ path: { invoiceId: invoiceId! } }),
    enabled: Boolean(invoiceId),
    staleTime: 30_000,
  });

  return {
    invoice: (query.data as unknown as InvoiceDetail) ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
