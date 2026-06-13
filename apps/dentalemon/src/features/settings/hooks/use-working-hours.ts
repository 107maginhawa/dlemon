/**
 * useWorkingHours — TanStack Query hooks for the DEDICATED working-hours endpoint
 *
 *   GET /dental/branches/{branchId}/working-hours
 *   PUT /dental/branches/{branchId}/working-hours   (owner-only)
 *
 * This is the column the scheduler enforces (`dental_branch.working_hours`), in
 * the canonical `{ enabled, open, close }` shape — NOT the `settings` blob. The
 * Working Hours UI must read/write here so the saved hours actually gate booking
 * (G1 / decision §6).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getWorkingHoursOptions,
  getWorkingHoursQueryKey,
  updateWorkingHoursMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { CanonicalWorkingHours } from '../components/working-hours.logic';

export function useWorkingHours(branchId: string | null) {
  const query = useQuery({
    ...getWorkingHoursOptions({ path: { branchId: branchId! } }),
    enabled: !!branchId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    workingHours: (query.data?.workingHours ?? null) as CanonicalWorkingHours | null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}

export function useUpdateWorkingHours(branchId: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...updateWorkingHoursMutation(),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({
          queryKey: getWorkingHoursQueryKey({ path: { branchId } }),
        });
      }
    },
  });

  return {
    update: (workingHours: CanonicalWorkingHours) => {
      if (!branchId) return Promise.reject(new Error('No branch selected'));
      return mutation.mutateAsync({
        path: { branchId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated body type is the canonical working-hours map
        body: { workingHours } as any,
      });
    },
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error as Error | null,
    reset: mutation.reset,
  };
}
