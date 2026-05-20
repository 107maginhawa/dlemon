/**
 * useInvoices — TanStack Query hook for the billing list
 *
 * Loads invoices with optional status and branchId filters.
 * Query key includes both filters so the cache is keyed per-filter-combination.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listDentalInvoicesOptions, listDentalInvoicesQueryKey } from '@monobase/sdk-ts/generated/react-query';
import { createDentalInvoice } from '@monobase/sdk-ts/generated';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName?: string;
  visitDate?: string;
  dueDate?: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  createdAt: string;
}

interface UseInvoicesOptions {
  branchId?: string;
  status?: string;
  patientId?: string;
}

export function useInvoices({ branchId, status, patientId }: UseInvoicesOptions) {
  const query = useQuery({
    ...listDentalInvoicesOptions({ query: { patientId: patientId, status: status as any, branchId: branchId ?? undefined } }),
    select: (data) => {
      const raw = data as any;
      const items = Array.isArray(raw) ? raw : (raw?.data ?? []);
      return items as Invoice[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    invoices: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export { createDentalInvoice, listDentalInvoicesQueryKey };
