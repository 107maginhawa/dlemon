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
    select: (data) => {
      const raw = data as Record<string, unknown>;
      const items = Array.isArray(data)
        ? data
        : Array.isArray(raw.data)
          ? raw.data
          : Array.isArray(raw.invoices)
            ? raw.invoices
            : [];
      return items as unknown as Invoice[];
    },
    enabled: !!patientId,
  });

  return {
    invoices: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
