/**
 * usePatientBilling — TanStack Query hook for a patient's invoices (PROF-03)
 *
 * Fetches billing history filtered by patientId for the Patient Profile page.
 *
 * API: GET /dental/billing/invoices?patientId=&branchId=
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';
import type { Invoice } from '../../../features/billing/hooks/use-invoices';

export type { Invoice };

interface UsePatientBillingOptions {
  patientId: string;
  branchId: string | null;
}

export function usePatientBilling({ patientId, branchId }: UsePatientBillingOptions) {
  const query = useQuery({
    queryKey: ['patient-billing', patientId, branchId],
    queryFn: async (): Promise<Invoice[]> => {
      const params = new URLSearchParams({ patientId });
      if (branchId) params.set('branchId', branchId);
      const res = await fetch(
        `${apiBaseUrl}/dental/billing/invoices?${params.toString()}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to fetch billing (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data.invoices ?? []);
    },
    enabled: !!patientId,
  });

  return {
    invoices: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
