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
import {
  listPatientTreatmentPlansOptions,
  listPatientTreatmentPlansQueryKey,
  createTreatmentPlanMutation,
  updateTreatmentPlanMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalPatientFinanceModuleTreatmentPlan,
  DentalPatientFinanceModuleCreateTreatmentPlanRequest,
  DentalPatientFinanceModuleUpdateTreatmentPlanRequest,
} from '@monobase/sdk-ts/generated';

// Re-export SDK types under the original public names so consumers stay green.
export type TreatmentPlanStatus = DentalPatientFinanceModuleTreatmentPlan['status'];
export type TreatmentPlanDoc = DentalPatientFinanceModuleTreatmentPlan;
export type CreateTreatmentPlanBody = DentalPatientFinanceModuleCreateTreatmentPlanRequest;
export type UpdateTreatmentPlanBody = DentalPatientFinanceModuleUpdateTreatmentPlanRequest;

export function useTreatmentPlans(patientId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    ...listPatientTreatmentPlansOptions({ path: { patientId } }),
    enabled: Boolean(patientId),
    staleTime: 30_000,
    select: (data): TreatmentPlanDoc[] => {
      // SDK response is Array<DentalPatientFinanceModuleTreatmentPlan> | ErrorResponse.
      // Narrow to the array branch; ErrorResponse is a non-array object.
      if (Array.isArray(data)) return data;
      return [];
    },
  });

  const createPlan = useMutation({
    ...createTreatmentPlanMutation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listPatientTreatmentPlansQueryKey({ path: { patientId } }) });
    },
  });

  const updatePlan = useMutation({
    ...updateTreatmentPlanMutation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listPatientTreatmentPlansQueryKey({ path: { patientId } }) });
    },
  });

  return {
    plans: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createPlan: (body: CreateTreatmentPlanBody) =>
      createPlan.mutate({ path: { patientId }, body }),
    updatePlan: (planId: string, body: UpdateTreatmentPlanBody) =>
      updatePlan.mutate({ path: { patientId, planId }, body }),
    isCreating: createPlan.isPending,
    isUpdating: updatePlan.isPending,
  };
}
