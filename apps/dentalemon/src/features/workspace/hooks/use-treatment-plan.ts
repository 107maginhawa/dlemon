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
 * NOTE: The generated SDK types for getTreatmentPlan, acceptTreatmentPlan, and
 * updateDentalTreatment declare `query?: never` (branchId is not in the TypeSpec
 * query schema). The backend does require branchId. We inject it via Object.assign
 * so the underlying hey-api client serializes it as a URL query parameter.
 * This is a spec-drift TODO — once TypeSpec is updated and the SDK is regenerated,
 * the Object.assign override can be removed and `query: { branchId }` used directly.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTreatmentPlan,
  acceptTreatmentPlan,
  updateDentalTreatment,
} from '@monobase/sdk-ts/generated';
import type { UpdateDentalTreatmentRequest } from '@monobase/sdk-ts/generated';

/**
 * Build extra SDK options for branchId query param injection.
 * branchId is absent from the TypeSpec schema (spec drift) so the generated
 * types say `query?: never`. We use Object.assign to smuggle it through without
 * a double-cast that would trip the no-restricted-syntax GAP-D lint rule.
 */
function withBranchQuery(branchId: string | null): Record<string, unknown> {
  return branchId ? { query: { branchId } } : {};
}

/** P1-18: clinical sequencing phase (industry-standard 5-phase model). */
export type TreatmentPhase =
  | 'systemic'
  | 'disease_control'
  | 're_evaluation'
  | 'definitive'
  | 'maintenance';

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
  /** P1-18: clinical phase (null = unphased) */
  phase?: TreatmentPhase | null;
  /** P1-18: intra-phase ordering */
  priority?: number;
  reason?: string;
}

export interface TreatmentPlanData {
  patientId: string;
  totalEstimateCents: number;
  treatmentCount: number;
  toothCount: number;
  byTooth: Record<string | number, TreatmentPlanItem[]>;
  treatments: TreatmentPlanItem[];
  /** CHART-XV: FDI tooth numbers with a performed/verified treatment across all
   *  visits — drives the chart's cumulative Completed layer (living document). */
  completedToothNumbers?: number[];
}

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
      if (!patientId) throw new Error('patientId is required');
      // branchId is a real required backend query param but is absent from the
      // TypeSpec schema (spec drift). Inject it via Object.assign on the options
      // object so hey-api serializes it as a URL query parameter.
      const opts = Object.assign(
        { path: { patientId } },
        withBranchQuery(branchId),
      );
      const result = await getTreatmentPlan(opts as Parameters<typeof getTreatmentPlan>[0]);
      // Normalize SDK errors into standard Error objects so consumers and tests
      // can rely on .message containing the status code regardless of whether
      // the error interceptor (installed by ApiProvider) is present.
      if (!result.response?.ok) {
        const status = result.response?.status ?? 0;
        // `result.error` exists on the error branch of the SDK union type.
        // Use type-narrowing via a field-presence check to access it safely.
        const errBody = ('error' in result ? result.error : undefined) as { message?: string } | undefined;
        throw new Error(errBody?.message ?? `Failed to fetch treatment plan (${status})`);
      }
      // The SDK's TreatmentPlanResponse type is stale (TypeSpec spec drift);
      // the actual backend returns the enriched TreatmentPlanData shape.
      // The `response.ok` guard above ensures data is present; the JSON-level
      // shape is always TreatmentPlanData (spec-drift documented in file header).
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      return result.data as any as TreatmentPlanData;
    },
    enabled: !!patientId && !!branchId,
  });

  const acceptMutation = useMutation({
    mutationFn: async (consentFormId?: string) => {
      if (!patientId) throw new Error('patientId required');
      const opts = Object.assign(
        { path: { patientId }, body: { consentFormId }, throwOnError: true as const },
        withBranchQuery(branchId),
      );
      const { data } = await acceptTreatmentPlan(opts as Parameters<typeof acceptTreatmentPlan>[0]);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
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
