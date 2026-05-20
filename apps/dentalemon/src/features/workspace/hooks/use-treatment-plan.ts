/**
 * useTreatmentPlan — TanStack Query hook for patient-level treatment plan
 *
 * Fetches all pending (diagnosed/planned) treatments across all visits for a patient.
 * Used by TreatmentPlanTab (TXPL-01, TXPL-02, TXPL-03).
 *
 * API: GET /dental/patients/:patientId/treatment-plan?branchId=...
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

export interface TreatmentPlanItem {
  id: string;
  toothNumber: number | null;
  cdtCode: string;
  description: string;
  surfaces: string[] | null;
  priceCents: number;
  status: 'diagnosed' | 'planned' | 'declined';
  conditionCode: string | null;
  visitId: string;
  carriedOver: boolean;
  reason?: string;
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
  const queryClient = useQueryClient();
  const queryKey = ['dental-treatment-plan', patientId, branchId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<TreatmentPlanData> => {
      if (!patientId) throw new Error('patientId is required');
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      // No SDK react-query option exists for this endpoint — intentional raw fetch
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/treatment-plan?${params}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to fetch treatment plan (${res.status})`);
      return res.json();
    },
    enabled: !!patientId && !!branchId,
  });

  const acceptMutation = useMutation({
    mutationFn: async (consentFormId?: string) => {
      if (!patientId) throw new Error('patientId required');
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/treatment-plan/accept?${params}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consentFormId }),
        },
      );
      if (!res.ok) throw new Error(`Accept plan failed (${res.status})`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async ({ treatmentId, visitId, reason }: { treatmentId: string; visitId: string; reason: string }) => {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      const res = await fetch(
        `${apiBaseUrl}/dental/visits/${visitId}/treatments/${treatmentId}?${params}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'declined', refusalReason: reason }),
        },
      );
      if (!res.ok) throw new Error(`Decline treatment failed (${res.status})`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    acceptPlan: (consentFormId?: string) => acceptMutation.mutate(consentFormId),
    isAccepting: acceptMutation.isPending,
    acceptedVersion: acceptMutation.data ?? null,
    declineTreatment: (treatmentId: string, visitId: string, reason: string) =>
      declineMutation.mutate({ treatmentId, visitId, reason }),
    isDeclining: declineMutation.isPending,
  };
}
