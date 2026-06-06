/**
 * useCreateVisit -- TanStack Query mutation for STARTING a new dental visit
 *
 * Replaces the inline fetch in handleNewVisit() in $patientId.tsx.
 * API: POST /dental/visits (creates a draft) → PATCH /dental/visits/:id (→ active)
 * On success: invalidates listDentalVisits query so the timeline refreshes.
 *
 * The workspace "Start new visit" action must land the visit ACTIVE, not draft:
 * the backend creates visits in `draft`, a draft has no UI affordance to
 * activate, and the Complete-visit action is gated on status === 'active'
 * (draft → completed is an invalid FSM jump). So a visit started from the
 * workspace is created then immediately transitioned draft → active, mirroring
 * the documented lifecycle (draft → active → completed → locked).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDentalVisit, updateDentalVisit, type CreateDentalVisitRequest } from '@monobase/sdk-ts/generated';
import { listDentalVisitsQueryKey } from '@monobase/sdk-ts/generated/react-query';
import { toastError } from '@/lib/error-toast';

// Cause-fix (oli QA_ESCAPES §6): consume the SDK request type (the FE input is a
// subset — patientId/branchId/dentistMemberId are all required) and let the SDK
// response (DentalVisit) flow through. The previous `as Parameters<…>['body']` +
// `as unknown as CreatedVisit` casts disabled tsc at both ends.
type CreateVisitInput = Pick<CreateDentalVisitRequest, 'patientId' | 'branchId' | 'dentistMemberId'>;

export function useCreateVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVisitInput) => {
      const { data: created } = await createDentalVisit({ body: input, throwOnError: true });
      // Transition draft → active so the started visit is chartable AND
      // completable through the UI (Complete-visit requires status === 'active').
      const { data: activated } = await updateDentalVisit({
        path: { visitId: created!.id },
        body: { status: 'active' },
        throwOnError: true,
      });
      return activated ?? created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listDentalVisitsQueryKey({ query: { patientId } }),
      });
    },
    // V-FE-ERR-001: hook-level error surface so a failed create isn't swallowed
    // when a call site forgets its own .catch.
    onError: (err) => {
      toastError(err, 'Failed to create visit. Please try again.');
    },
  });
}
