/**
 * useInvoices — TanStack Query hook for the billing list
 *
 * Loads invoices with optional status and branchId filters.
 * Query key includes both filters so the cache is keyed per-filter-combination.
 */
import { useQuery } from '@tanstack/react-query';
import { listDentalInvoicesOptions, listDentalInvoicesQueryKey } from '@monobase/sdk-ts/generated/react-query';
import { createDentalInvoice, type DentalInvoice } from '@monobase/sdk-ts/generated';

// Cause-fix recipe (QA_ESCAPES §6): intersect the generated SDK type instead of
// re-declaring an independent one + casting. tsc now checks every SDK-modeled field
// (catches priceCents/balanceCents-style drift); the two genuine backend enrichments
// (patientName, visitDate) are explicit here because they are NOT yet in the OpenAPI
// spec/SDK. TODO(spec): add patientName + visitDate to the invoice-list response schema,
// regenerate the SDK, then drop this intersection.
export type Invoice = DentalInvoice & { patientName?: string; visitDate?: string };

interface UseInvoicesOptions {
  branchId?: string;
  status?: string;
  patientId?: string;
}

export function useInvoices({ branchId, status, patientId }: UseInvoicesOptions) {
  const query = useQuery({
    ...listDentalInvoicesOptions({
      // Only include DEFINED filters — a literal `?patientId=undefined` /
      // `?status=undefined` fails UUID/enum validation (400). branchId is
      // required by the endpoint for per-branch scoping.
      query: {
        ...(branchId ? { branchId } : {}),
        ...(patientId ? { patientId } : {}),
        ...(status ? { status: status as DentalInvoice['status'] } : {}),
      },
    }),
    enabled: !!branchId,
    select: (data) => {
      // No blind `as any`: the SDK response is { data: DentalInvoice[]; pagination }.
      // The single `as Invoice[]` only widens to the documented enrichment (above).
      const items = Array.isArray(data) ? data : (data?.data ?? []);
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
