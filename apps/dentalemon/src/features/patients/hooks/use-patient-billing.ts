/**
 * usePatientBilling — TanStack Query hook for a patient's invoices (PROF-03)
 *
 * Fetches billing history filtered by patientId for the Patient Profile page.
 *
 * API: GET /dental/billing/invoices?patientId=&branchId=
 */
import { useQuery } from '@tanstack/react-query';
import { listDentalInvoicesOptions } from '@monobase/sdk-ts/generated/react-query';
import type { Invoice } from '../../../features/billing/hooks/use-invoices';

export type { Invoice };

interface UsePatientBillingOptions {
  patientId: string;
  branchId: string | null;
}

export function usePatientBilling({ patientId, branchId }: UsePatientBillingOptions) {
  const query = useQuery({
    ...listDentalInvoicesOptions({
      query: { patientId, branchId: branchId ?? undefined },
    }),
    // Same endpoint as use-invoices.ts — reuse its proven SDK-derived Invoice type.
    // The SDK response is { data: DentalInvoice[]; pagination }; a single `as`
    // widens to the documented enrichment shape (no blind `as unknown as` — GAP-D).
    select: (data) => {
      const items = Array.isArray(data) ? data : (data?.data ?? []);
      return items as Invoice[];
    },
    enabled: !!patientId,
  });

  return {
    invoices: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
