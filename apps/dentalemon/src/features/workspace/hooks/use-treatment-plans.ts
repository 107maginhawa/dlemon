/**
 * useTreatmentPlans — plan-level treatment plan documents with FSM status
 *
 * NOTE: Different from use-treatment-plan.ts (visit-level treatments).
 * This manages the plan document itself: draft → presented → approved → partially_completed → completed | cancelled
 *
 * API: GET  /dental/patients/:patientId/treatment-plans
 *      POST /dental/patients/:patientId/treatment-plans
 *      PATCH /dental/patients/:patientId/treatment-plans/:planId
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

export type TreatmentPlanStatus =
  | 'draft'
  | 'presented'
  | 'approved'
  | 'partially_completed'
  | 'completed'
  | 'cancelled';

export interface TreatmentPlanDoc {
  id: string;
  patientId: string;
  providerId: string;
  status: TreatmentPlanStatus;
  totalEstimateCents?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTreatmentPlanBody {
  providerId: string;
  totalEstimateCents?: number;
  notes?: string;
}

export interface UpdateTreatmentPlanBody {
  status?: TreatmentPlanStatus;
  notes?: string;
  totalEstimateCents?: number;
}

function treatmentPlansQueryKey(patientId: string) {
  return ['dental-treatment-plans', patientId] as const;
}

export function useTreatmentPlans(patientId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: treatmentPlansQueryKey(patientId),
    queryFn: async (): Promise<TreatmentPlanDoc[]> => {
      const res = await fetch(`${apiBaseUrl}/dental/patients/${patientId}/treatment-plans`);
      if (!res.ok) throw new Error(`Failed to fetch treatment plans (${res.status})`);
      const data: unknown = await res.json();
      if (Array.isArray(data)) return data as TreatmentPlanDoc[];
      const obj = data as Record<string, unknown>;
      return (Array.isArray(obj.data) ? obj.data : (obj.plans ?? [])) as TreatmentPlanDoc[];
    },
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });

  const createPlan = useMutation({
    mutationFn: async (body: CreateTreatmentPlanBody) => {
      const res = await fetch(`${apiBaseUrl}/dental/patients/${patientId}/treatment-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to create treatment plan (${res.status})`);
      return res.json() as Promise<TreatmentPlanDoc>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treatmentPlansQueryKey(patientId) });
    },
  });

  const updatePlan = useMutation({
    mutationFn: async ({ planId, body }: { planId: string; body: UpdateTreatmentPlanBody }) => {
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/treatment-plans/${planId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`Failed to update treatment plan (${res.status})`);
      return res.json() as Promise<TreatmentPlanDoc>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treatmentPlansQueryKey(patientId) });
    },
  });

  return {
    plans: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createPlan: (body: CreateTreatmentPlanBody) => createPlan.mutate(body),
    updatePlan: (planId: string, body: UpdateTreatmentPlanBody) =>
      updatePlan.mutate({ planId, body }),
    isCreating: createPlan.isPending,
    isUpdating: updatePlan.isPending,
  };
}
