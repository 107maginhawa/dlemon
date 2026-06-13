/**
 * useApplyTemplate — dental-visit GAP-2 / decision #13 apply-template mutation.
 *
 * Wraps applyTemplateMutation (POST /dental/visits/:visitId/apply-template/:templateId).
 * The handler creates the template's items as `planned` treatments on the visit, so on
 * success we invalidate:
 *   - the visit's treatment list (listDentalTreatments) — the new rows surface in the table;
 *   - the patient-level treatment-plan aggregate (hand-rolled key in use-treatment-plan.ts).
 *
 * SDK-only (no raw fetch — no-raw-fetch ESLint rule). Success/error toasts mirror the
 * carry-over hook precedent.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  applyTemplateMutation,
  listDentalTreatmentsQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';

interface UseApplyTemplateOptions {
  visitId: string;
  patientId: string;
  branchId: string | null;
}

export function useApplyTemplate({ visitId, patientId, branchId }: UseApplyTemplateOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...applyTemplateMutation(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: listDentalTreatmentsQueryKey({ path: { visitId } }),
      });
      queryClient.invalidateQueries({
        queryKey: ['dental-treatment-plan', patientId, branchId],
      });
      const count = (data as { count?: number } | undefined)?.count ?? 0;
      toast.success(`Applied ${count} ${count === 1 ? 'treatment' : 'treatments'} from template.`);
    },
    onError: (err) => {
      toastError(err, 'Failed to apply template. Please try again.');
    },
  });

  const applyTemplate = (templateId: string): Promise<unknown> =>
    mutation.mutateAsync({ path: { visitId, templateId } });

  return { applyTemplate, isPending: mutation.isPending };
}
