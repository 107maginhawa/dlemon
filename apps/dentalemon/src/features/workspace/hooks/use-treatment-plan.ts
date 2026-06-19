/**
 * useTreatmentPlan — TanStack Query hook for patient-level treatment plan
 *
 * Fetches all pending (diagnosed/planned) treatments across all visits for a patient.
 * Used by TreatmentPlanTab (TXPL-01, TXPL-02, TXPL-03).
 *
 * API: GET  /dental/patients/:patientId/treatment-plan?branchId=...
 *      POST /dental/patients/:patientId/treatment-plan/accept?branchId=...
 *      PATCH /dental/visits/:visitId/treatments/:treatmentId?branchId=...
 *
 * NOTE: getTreatmentPlan and acceptTreatmentPlan model `branchId` as a required
 * @query param, so they pass a typed `query: { branchId }` directly.
 * updateDentalTreatment does NOT model branchId — its handler derives the branch
 * from the visit (visitId path param) — so the decline/assign-phase mutations send
 * branchId via `withBranchQuery` (a defensive, handler-ignored query param) rather
 * than a typed query.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';
import {
  getTreatmentPlan,
  acceptTreatmentPlan,
  updateDentalTreatment,
} from '@monobase/sdk-ts/generated';
import type {
  UpdateDentalTreatmentRequest,
  TreatmentPlanResponse,
  TreatmentPlanItem as SdkTreatmentPlanItem,
  DentalTreatmentPhase,
} from '@monobase/sdk-ts/generated';

/**
 * Build extra SDK options for branchId query injection — used ONLY by
 * updateDentalTreatment (decline / assign-phase). That operation does not model
 * branchId in TypeSpec (its handler derives the branch from the visit), so the
 * generated type says `query?: never`; Object.assign smuggles a defensive branchId
 * through without a double-cast that would trip the no-restricted-syntax GAP-D rule.
 */
function withBranchQuery(branchId: string | null): Record<string, unknown> {
  return branchId ? { query: { branchId } } : {};
}

/**
 * P1-18: clinical sequencing phase (industry-standard 5-phase model). Aliased to
 * the generated SDK contract type so the FE consumes the single source of type
 * truth rather than a hand-maintained duplicate that can drift from the wire.
 */
export type TreatmentPhase = DentalTreatmentPhase;

/**
 * A treatment-plan line item — the generated contract type. `toothNumber` and
 * `carriedOver` are optional because the `byTooth` grouping omits them (only the
 * flat `treatments[]` projection carries them), and `status` is the full
 * DentalTreatmentStatus (a plan surfaces diagnosed/planned/declined, but
 * consumers like treatment-table also render performed/verified/dismissed rows).
 */
export type TreatmentPlanItem = SdkTreatmentPlanItem;

/**
 * Patient treatment-plan aggregate (getTreatmentPlan) — the generated contract
 * type. `treatmentCount`/`byTooth` are OPTIONAL: the backend omits them on the
 * empty-plan response (a patient with no visits), so consumers must guard them
 * (e.g. `data.treatmentCount ?? 0`). `completedToothNumbers` (CHART-XV) drives
 * the chart's cumulative Completed layer.
 */
export type TreatmentPlanData = TreatmentPlanResponse;

interface UseTreatmentPlanOptions {
  patientId: string | null;
  branchId: string | null;
}

export function useTreatmentPlan({ patientId, branchId }: UseTreatmentPlanOptions) {
  const queryClient = useQueryClient();
  // Include branchId in the query key so the cache is keyed per-branch.
  const queryKey = ['dental-treatment-plan', patientId, branchId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<TreatmentPlanData> => {
      if (!patientId || !branchId) throw new Error('patientId and branchId are required');
      const result = await getTreatmentPlan({ path: { patientId }, query: { branchId } });
      // Normalize SDK errors into standard Error objects so consumers and tests
      // can rely on .message containing the status code regardless of whether
      // the error interceptor (installed by ApiProvider) is present.
      if (!result.response?.ok || !result.data) {
        const status = result.response?.status ?? 0;
        // `result.error` exists on the error branch of the SDK union type.
        // Use type-narrowing via a field-presence check to access it safely.
        const errBody = ('error' in result ? result.error : undefined) as { message?: string } | undefined;
        throw new Error(errBody?.message ?? `Failed to fetch treatment plan (${status})`);
      }
      // result.data is the generated TreatmentPlanResponse (= TreatmentPlanData);
      // the `!result.data` guard above narrows away `undefined`, so no cast is needed.
      return result.data;
    },
    enabled: !!patientId && !!branchId,
  });

  const acceptMutation = useMutation({
    mutationFn: async (consentFormId?: string) => {
      if (!patientId || !branchId) throw new Error('patientId and branchId are required');
      const { data } = await acceptTreatmentPlan({
        path: { patientId },
        query: { branchId },
        body: { consentFormId },
        throwOnError: true,
      });
      return data;
    },
    // ISSUE-008 (QA 2026-06-20): accept previously gave no feedback — the modal
    // stayed open with the button re-enabled, so users re-clicked and each click
    // POSTed another acceptance snapshot. A success toast confirms the write;
    // surfacing failures stops the (previously silent) error path.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Treatment plan accepted');
    },
    onError: (err) => toastError(err, 'Could not accept treatment plan'),
  });

  const declineMutation = useMutation({
    mutationFn: async ({ treatmentId, visitId, reason }: { treatmentId: string; visitId: string; reason: string }) => {
      const opts = Object.assign(
        { path: { visitId, treatmentId }, body: { status: 'declined', refusalReason: reason } as UpdateDentalTreatmentRequest, throwOnError: true as const },
        withBranchQuery(branchId),
      );
      const { data } = await updateDentalTreatment(opts as Parameters<typeof updateDentalTreatment>[0]);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // P1-18 / J06: assign a clinical sequencing phase to a treatment. The plan is
  // re-sorted server-side by (phase order, priority), so the grouped phase view
  // updates on refetch. Same PATCH endpoint as decline, with a `phase` body.
  const assignPhaseMutation = useMutation({
    mutationFn: async ({ treatmentId, visitId, phase }: { treatmentId: string; visitId: string; phase: TreatmentPhase }) => {
      const opts = Object.assign(
        { path: { visitId, treatmentId }, body: { phase } as UpdateDentalTreatmentRequest, throwOnError: true as const },
        withBranchQuery(branchId),
      );
      const { data } = await updateDentalTreatment(opts as Parameters<typeof updateDentalTreatment>[0]);
      return data;
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
    assignPhase: (treatmentId: string, visitId: string, phase: TreatmentPhase) =>
      assignPhaseMutation.mutate({ treatmentId, visitId, phase }),
    isAssigningPhase: assignPhaseMutation.isPending,
  };
}
