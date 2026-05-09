/**
 * useTreatmentPlan — TanStack Query hook for patient-level treatment plan
 *
 * Fetches all pending (diagnosed/planned) treatments across all visits for a patient.
 * Used by TreatmentPlanTab (TXPL-01, TXPL-02, TXPL-03).
 *
 * API: GET /dental/patients/:patientId/treatment-plan?branchId=...
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

export interface TreatmentPlanItem {
  id: string;
  toothNumber: number | null;
  cdtCode: string;
  description: string;
  surfaces: string[] | null;
  priceCents: number;
  status: 'diagnosed' | 'planned';
  conditionCode: string | null;
  visitId: string;
  carriedOver: boolean;
}

export interface TreatmentPlanData {
  patientId: string;
  totalEstimateCents: number;
  treatmentCount: number;
  toothCount: number;
  byTooth: Record<string | number, TreatmentPlanItem[]>;
  treatments: TreatmentPlanItem[];
}

interface UseTreatmentPlanOptions {
  patientId: string | null;
  branchId: string | null;
}

export function useTreatmentPlan({ patientId, branchId }: UseTreatmentPlanOptions) {
  const query = useQuery({
    queryKey: ['dental-treatment-plan', patientId, branchId],
    queryFn: async (): Promise<TreatmentPlanData> => {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/treatment-plan?${params}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to fetch treatment plan (${res.status})`);
      return res.json();
    },
    enabled: !!patientId && !!branchId,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
