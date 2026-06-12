/**
 * useCarryOverTreatments — FIX-002 (Batch B) carry-over mutation.
 *
 * Wraps the canonical carryOverTreatmentsMutation (POST /dental/visits/:visitId/carry-over).
 * Carries the patient's pending (diagnosed/planned) treatments from prior visits into the
 * destination visit (auto-discovery when no sourceVisitId is given), marking the copies
 * carriedOver=true. On success it invalidates:
 *   - the destination visit's treatment list (listDentalTreatments), and
 *   - the patient-level treatment-plan aggregate (hand-rolled key in use-treatment-plan.ts),
 *     which feeds the table's "Carried Over" section AND the chart's cumulative layers.
 *
 * The toast text comes from the backend response `message` (the source of truth for the
 * carried count) — never a separately-computed FE number.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  carryOverTreatmentsMutation,
  listDentalTreatmentsQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';

interface UseCarryOverTreatmentsOptions {
  visitId: string | null;
  patientId: string;
  branchId: string | null;
}

export function useCarryOverTreatments({ visitId, patientId, branchId }: UseCarryOverTreatmentsOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...carryOverTreatmentsMutation(),
    onSuccess: (data) => {
      if (visitId) {
        queryClient.invalidateQueries({
          queryKey: listDentalTreatmentsQueryKey({ path: { visitId } }),
        });
      }
      // carriedOverItems (table) + the chart's cumulative Completed/Proposed/Declined/
      // carried layers both read from the patient-level treatment-plan aggregate.
      queryClient.invalidateQueries({
        queryKey: ['dental-treatment-plan', patientId, branchId],
      });
      const message = (data as { message?: string } | undefined)?.message;
      toast.success(message ?? 'Treatments carried over.');
    },
    onError: (err) => {
      toastError(err, 'Failed to carry over treatments. Please try again.');
    },
  });

  /**
   * Carry treatments into the destination visit.
   * - restoreDismissedIds: restore specific deferred (dismissed) treatments from a prior
   *   visit as new planned/carriedOver rows (FR1.11 — the gate-compatible carry-over path,
   *   since completed visits never retain diagnosed/planned treatments).
   * - sourceVisitId: carry a specific prior visit's pending treatments (legacy/auto path).
   */
  const carryOver = (opts?: { sourceVisitId?: string; restoreDismissedIds?: string[] }): Promise<unknown> => {
    if (!visitId) return Promise.resolve();
    const body: { sourceVisitId?: string; restoreDismissedIds?: string[] } = {};
    if (opts?.sourceVisitId) body.sourceVisitId = opts.sourceVisitId;
    if (opts?.restoreDismissedIds?.length) body.restoreDismissedIds = opts.restoreDismissedIds;
    return mutation.mutateAsync({ path: { visitId }, body });
  };

  return { carryOver, isPending: mutation.isPending };
}
