/**
 * useInvoiceDetail — TanStack Query hook for a single dental invoice
 *
 * RPT-01: enables report row drilldown to invoice detail
 * RPT-02: returns lineItems and payments for the detail sheet
 *
 * API: GET /dental/billing/invoices/:invoiceId
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

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

async function fetchInvoiceDetail(invoiceId: string): Promise<InvoiceDetail> {
  const res = await fetch(`${API}/dental/billing/invoices/${encodeURIComponent(invoiceId)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load invoice (${res.status})`);
  return res.json() as Promise<InvoiceDetail>;
}

export function useInvoiceDetail(invoiceId: string | null) {
  const query = useQuery({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: () => fetchInvoiceDetail(invoiceId!),
    enabled: Boolean(invoiceId),
    staleTime: 30_000,
  });

  return {
    invoice: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
