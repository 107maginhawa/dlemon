/**
 * useFindings — P0-C structured findings for a visit (optionally a single tooth).
 *
 * Lists findings and exposes create / resolve / convert-to-treatment mutations.
 * Inactive (resolved) findings are filtered out of `activeFindings` so they stop
 * rendering as active.
 *
 * API:
 *   GET  /dental/visits/{visitId}/findings
 *   POST /dental/visits/{visitId}/findings
 *   PATCH /dental/visits/{visitId}/findings/{findingId}
 *   POST /dental/visits/{visitId}/findings/{findingId}/treatment
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listDentalFindingsOptions,
  listDentalFindingsQueryKey,
  createDentalFindingMutation,
  updateDentalFindingMutation,
  convertFindingToTreatmentMutation,
  listDentalTreatmentsQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import type { DentalFinding, ConditionCode, ToothSurfaceCode } from '@monobase/sdk-ts/generated';

export interface UseFindingsResult {
  findings: DentalFinding[];
  activeFindings: DentalFinding[];
  isLoading: boolean;
  isMutating: boolean;
  createFinding: (input: { toothNumber: number; surface?: ToothSurfaceCode; conditionCode: ConditionCode; note?: string }) => Promise<void>;
  resolveFinding: (findingId: string) => Promise<void>;
  convertFinding: (findingId: string, input: { cdtCode: string; description: string; priceCents?: number }) => Promise<void>;
}

export function useFindings(visitId: string | null, toothNumber?: number | null, patientId?: string | null): UseFindingsResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    ...listDentalFindingsOptions({ path: { visitId: visitId as string } }),
    enabled: Boolean(visitId),
    staleTime: 10_000,
  });

  function invalidate() {
    if (visitId) {
      queryClient.invalidateQueries({ queryKey: listDentalFindingsQueryKey({ path: { visitId } }) });
    }
  }

  const onMutationError = (verb: string) => () => toast.error(`Could not ${verb}. Please try again.`);

  const createMut = useMutation({ ...createDentalFindingMutation(), onSuccess: invalidate, onError: onMutationError('add the finding') });
  const updateMut = useMutation({ ...updateDentalFindingMutation(), onSuccess: invalidate, onError: onMutationError('update the finding') });
  const convertMut = useMutation({
    ...convertFindingToTreatmentMutation(),
    onSuccess: () => {
      // Converting a finding creates a TREATMENT — refresh the findings list AND the
      // treatments table + treatment plan, or the new treatment is invisible until reload.
      invalidate();
      if (visitId) queryClient.invalidateQueries({ queryKey: listDentalTreatmentsQueryKey({ path: { visitId } }) });
      queryClient.invalidateQueries({ queryKey: patientId ? ['dental-treatment-plan', patientId] : ['dental-treatment-plan'] });
    },
    onError: onMutationError('convert the finding to a treatment'),
  });

  const raw = ((query.data as { data?: DentalFinding[] } | undefined)?.data ?? []) as DentalFinding[];
  const findings = toothNumber != null ? raw.filter((f) => f.toothNumber === toothNumber) : raw;
  const activeFindings = findings.filter((f) => f.status === 'active');

  async function createFinding(input: { toothNumber: number; surface?: ToothSurfaceCode; conditionCode: ConditionCode; note?: string }) {
    await createMut.mutateAsync({ path: { visitId: visitId as string }, body: input });
  }

  async function resolveFinding(findingId: string) {
    await updateMut.mutateAsync({ path: { visitId: visitId as string, findingId }, body: { status: 'resolved' } });
  }

  async function convertFinding(findingId: string, input: { cdtCode: string; description: string; priceCents?: number }) {
    await convertMut.mutateAsync({ path: { visitId: visitId as string, findingId }, body: input });
  }

  return {
    findings,
    activeFindings,
    isLoading: query.isLoading,
    isMutating: createMut.isPending || updateMut.isPending || convertMut.isPending,
    createFinding,
    resolveFinding,
    convertFinding,
  };
}
